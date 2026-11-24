"""Shared fixtures. Every test gets its own database file, so tests never touch
data/accountable.db (R13), and today is fixed (R4).
Tests use local sign-in and never reach Supabase (Concern 16): `client` is signed in as Test User.
"""

import os
from datetime import date

os.environ["ACCOUNTABLE_TESTING"] = "1"
os.environ["ACCOUNTABLE_TODAY"] = "2026-11-16"
os.environ["ACCOUNTABLE_SIGN_IN"] = "local"
for name in (
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "RENDER",
    "RENDER_EXTERNAL_HOSTNAME",
):
    os.environ.pop(name, None)
os.environ.setdefault(
    "ACCOUNTABLE_DB",
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "pytest-unused.db"),
)

import pytest
from fastapi.testclient import TestClient

from app.auth import TEST_USER, Claims, local_signing_key, local_token
from app.db import engine_for, migrate
from app.main import app

TODAY = date(2026, 11, 16)
SECOND_PERSON = Claims(auth_id="local-second-person", email="sam@accountable.local", name="Sam Lee")
# IC14: CI's machine is much slower, so the limit applies only on this computer.
TIME_LIMIT_SECONDS = 1.0


def pytest_sessionstart(session):
    """One local signing key for the whole run: making one per test would slow every test (R10)."""
    local_signing_key()


@pytest.hookimpl(wrapper=True)
def pytest_runtest_makereport(item, call):
    report = yield
    if call.when == "setup":
        item.setup_seconds = report.duration
    elif call.when == "call" and report.passed and not os.environ.get("CI"):
        seconds = getattr(item, "setup_seconds", 0.0) + report.duration
        if seconds >= TIME_LIMIT_SECONDS:
            report.outcome = "failed"
            report.longrepr = (
                f"Took {seconds:.2f}s with its setup. Unit tests must take under a second (IC14)."
            )
    return report


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "test.db"
    monkeypatch.setenv("ACCOUNTABLE_DB", str(path))
    yield path
    engine_for(path.resolve()).dispose()


@pytest.fixture
def engine(db_path):
    engine = engine_for(db_path.resolve())
    migrate(engine)
    return engine


@pytest.fixture
def conn(engine):
    with engine.connect() as connection:
        yield connection


@pytest.fixture
def activity_exists(engine):
    """Whether an activity is still in the database (there's no endpoint to read one)."""
    from sqlalchemy import select

    from app.db import activities

    def check(activity_id: int) -> bool:
        with engine.connect() as connection:
            return (
                connection.scalar(select(activities.c.id).where(activities.c.id == activity_id))
                is not None
            )

    return check


def signed_in(claims: Claims) -> TestClient:
    return TestClient(
        app,
        raise_server_exceptions=False,
        headers={"Authorization": f"Bearer {local_token(claims)}"},
    )


@pytest.fixture
def client(engine):
    """Signed in as Test User."""
    return signed_in(TEST_USER)


@pytest.fixture
def second_person() -> Claims:
    return SECOND_PERSON


@pytest.fixture
def second_client(engine):
    """Signed in as second_person, Sam Lee."""
    return signed_in(SECOND_PERSON)


@pytest.fixture
def signed_out_client(engine):
    return TestClient(app, raise_server_exceptions=False)


class Api:
    """Small helpers for building test data through the API."""

    def __init__(self, client: TestClient):
        self.client = client

    def ok(self, method: str, url: str, status: int = 200, **kwargs):
        response = self.client.request(method, url, **kwargs)
        assert response.status_code == status, response.text
        return response.json() if response.content else None

    def org(self, name="Acme Ltd", **fields):
        return self.ok("POST", "/api/organizations", 201, json={"name": name, **fields})

    def contact(self, name="Ada Park", **fields):
        return self.ok("POST", "/api/contacts", 201, json={"name": name, **fields})

    def deal(self, organization_id, name="Big deal", value=1000, **fields):
        body = {
            "name": name,
            "organization_id": organization_id,
            "value": value,
            **fields,
        }
        return self.ok("POST", "/api/deals", 201, json=body)

    def activity(self, description="Called them", type="call", occurred_on="2026-11-10", **fields):
        body = {
            "type": type,
            "description": description,
            "occurred_on": occurred_on,
            **fields,
        }
        return self.ok("POST", "/api/activities", 201, json=body)

    def move(self, deal_id, stage, before_id=None, after_id=None):
        body = {"stage": stage, "before_id": before_id, "after_id": after_id}
        return self.ok("POST", f"/api/deals/{deal_id}/move", json=body)


@pytest.fixture
def api(client):
    return Api(client)
