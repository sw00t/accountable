"""TB49: /config, /me and local sign-in's stand-in for Supabase Auth.

These run on an app holding just the account routers, because main.py mounts them in
PT5's W1.7. test_auth.py checks the real app's routes."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import TEST_USER, Claims, local_token
from app.routers import account

PASSWORD = "local-test-only"
SIGN_IN = "/api/local-auth/token?grant_type=password"
RENEW = "/api/local-auth/token?grant_type=refresh_token"


@pytest.fixture
def account_app(engine) -> TestClient:
    app = FastAPI()
    app.include_router(account.router, prefix="/api")
    app.include_router(account.local_auth, prefix="/api")
    return TestClient(app)


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def sign_in(client: TestClient, email=TEST_USER.email, password=PASSWORD):
    return client.post(SIGN_IN, json={"email": email, "password": password})


def assert_auth_error(response, status: int, code: str) -> None:
    """Supabase Auth's error shape, which auth-js turns into an AuthApiError with this code."""
    assert response.status_code == status
    assert response.headers["X-Supabase-Api-Version"] == "2024-01-01"
    body = response.json()
    assert set(body) == {"code", "msg"}
    assert body["code"] == code


# --- /config ----------------------------------------------------------------


def test_config_says_local(account_app):
    assert account_app.get("/api/config").json() == {
        "sign_in": "local",
        "supabase_url": None,
        "supabase_publishable_key": None,
    }


def test_config_gives_supabase_url_and_publishable_key_and_nothing_else(account_app, monkeypatch):
    monkeypatch.delenv("ACCOUNTABLE_SIGN_IN")
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co/")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    monkeypatch.setenv("DATABASE_URL", "postgresql://postgres.abc:secret-pw@pooler:5432/postgres")

    response = account_app.get("/api/config")

    assert response.json() == {
        "sign_in": "supabase",
        "supabase_url": "https://abc.supabase.co",
        "supabase_publishable_key": "sb_publishable_test",
    }
    assert "secret-pw" not in response.text


# --- /me --------------------------------------------------------------------


def test_me_gives_the_person_and_the_name_to_show(account_app):
    response = account_app.get("/api/me", headers=bearer(local_token(TEST_USER)))
    assert response.json() == {
        "name": "Test User",
        "email": "test@accountable.local",
        "shown_name": "Test User",
    }


def test_me_shows_the_email_when_there_is_no_name(account_app):
    nameless = Claims(auth_id="local-nameless", email="pat@example.com", name=None)
    response = account_app.get("/api/me", headers=bearer(local_token(nameless)))
    assert response.json() == {
        "name": None,
        "email": "pat@example.com",
        "shown_name": "pat@example.com",
    }


def test_me_needs_sign_in(account_app):
    assert account_app.get("/api/me").status_code == 401


# --- The local stand-in -----------------------------------------------------


def test_test_user_signs_in_with_the_right_password(account_app):
    response = sign_in(account_app, email="  Test@Accountable.local ")

    assert response.status_code == 200
    session = response.json()
    assert session["token_type"] == "bearer"
    assert session["expires_in"] == 3600
    assert session["expires_at"] > 0
    assert session["refresh_token"]
    assert session["user"]["id"] == "local-test-user"
    assert session["user"]["email"] == "test@accountable.local"
    assert session["user"]["user_metadata"] == {"display_name": "Test User"}
    me = account_app.get("/api/me", headers=bearer(session["access_token"]))
    assert me.json()["shown_name"] == "Test User"


@pytest.mark.parametrize(
    ("email", "password"),
    [(TEST_USER.email, "wrong-password"), ("someone@example.com", PASSWORD), (TEST_USER.email, "")],
    ids=["wrong password", "wrong email", "no password"],
)
def test_a_wrong_email_or_password_is_refused_like_supabase(account_app, email, password):
    assert_auth_error(sign_in(account_app, email, password), 400, "invalid_credentials")


def test_an_unknown_grant_is_refused(account_app):
    response = account_app.post("/api/local-auth/token?grant_type=magic", json={})
    assert_auth_error(response, 400, "validation_failed")


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


@pytest.fixture
def clock(monkeypatch):
    clock = Clock()
    monkeypatch.setattr(account, "monotonic", clock)
    return clock


def renew(client: TestClient, refresh_token: str):
    return client.post(RENEW, json={"refresh_token": refresh_token})


def test_a_session_renews_with_a_new_refresh_token(account_app, clock):
    first = sign_in(account_app).json()

    renewed = renew(account_app, first["refresh_token"])

    assert renewed.status_code == 200
    assert renewed.json()["refresh_token"] != first["refresh_token"]
    assert renewed.json()["user"]["email"] == TEST_USER.email
    assert renew(account_app, renewed.json()["refresh_token"]).status_code == 200


def test_a_used_refresh_token_still_renews_within_the_reuse_interval(account_app, clock):
    """Two tabs renewing at once both stay signed in, as with Supabase (R5)."""
    first = sign_in(account_app).json()
    assert renew(account_app, first["refresh_token"]).status_code == 200

    clock.now += account.REUSE_INTERVAL_SECONDS
    assert renew(account_app, first["refresh_token"]).status_code == 200


def test_a_used_refresh_token_is_refused_after_the_reuse_interval(account_app, clock):
    first = sign_in(account_app).json()
    assert renew(account_app, first["refresh_token"]).status_code == 200

    clock.now += account.REUSE_INTERVAL_SECONDS + 1
    assert_auth_error(renew(account_app, first["refresh_token"]), 400, "refresh_token_not_found")


def test_an_unknown_refresh_token_is_refused(account_app):
    assert_auth_error(renew(account_app, "made-up"), 400, "refresh_token_not_found")


def test_reading_the_person_needs_a_valid_token(account_app):
    session = sign_in(account_app).json()

    response = account_app.get("/api/local-auth/user", headers=bearer(session["access_token"]))
    assert response.status_code == 200
    assert response.json()["email"] == TEST_USER.email

    assert_auth_error(account_app.get("/api/local-auth/user"), 403, "bad_jwt")
    forged = account_app.get("/api/local-auth/user", headers=bearer("not-a-token"))
    assert_auth_error(forged, 403, "bad_jwt")


def test_signing_out_ends_the_session(account_app, clock):
    session = sign_in(account_app).json()
    assert renew(account_app, session["refresh_token"]).status_code == 200

    response = account_app.post(
        "/api/local-auth/logout?scope=global", headers=bearer(session["access_token"])
    )
    assert response.status_code == 204

    # Refused even within the reuse interval.
    assert_auth_error(renew(account_app, session["refresh_token"]), 400, "refresh_token_not_found")


def test_signing_out_needs_a_valid_token(account_app):
    assert_auth_error(account_app.post("/api/local-auth/logout"), 403, "bad_jwt")


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", SIGN_IN),
        ("POST", RENEW),
        ("GET", "/api/local-auth/user"),
        ("POST", "/api/local-auth/logout"),
    ],
)
def test_local_auth_is_missing_with_supabase_sign_in(account_app, monkeypatch, method, path):
    monkeypatch.delenv("ACCOUNTABLE_SIGN_IN")
    body = {"email": TEST_USER.email, "password": PASSWORD}
    response = account_app.request(method, path, json=body, headers=bearer(local_token(TEST_USER)))
    assert response.status_code == 404
