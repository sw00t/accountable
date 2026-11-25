"""TB46 to TB48: checking tokens, protecting every route, and keeping the users table."""

import base64
import hashlib
import hmac
import io
import json
import re
import urllib.error
from dataclasses import asdict
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi import FastAPI
from fastapi.routing import APIRoute, RouteContext, iter_route_contexts
from fastapi.testclient import TestClient
from jwt.algorithms import ECAlgorithm, RSAAlgorithm
from sqlalchemy import select

from app import auth
from app.auth import LOCAL_ISSUER, LOCAL_KEY_ID, SIGN_IN_MESSAGE, TEST_USER, Claims, local_token
from app.db import organizations, users
from app.deps import Person, get_conn
from app.main import app

SUPABASE_URL = "https://test-project.supabase.co"
SUPABASE_ISSUER = f"{SUPABASE_URL}/auth/v1"
KEY_ID = "supabase-key-1"
# Made once per test session: key generation is the slow part of these tests (R10).
SUPABASE_KEY = ec.generate_private_key(ec.SECP256R1())
ROTATED_KEY = ec.generate_private_key(ec.SECP256R1())
STRANGER_KEY = ec.generate_private_key(ec.SECP256R1())
RSA_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
JANE = Claims(auth_id="supabase-jane", email="jane@example.com", name="Jane Smith")


def claims_payload(claims: Claims = TEST_USER, **changes) -> dict:
    """A payload like Supabase's. A change to None leaves that claim out."""
    now = int(datetime.now(UTC).timestamp())
    payload = {
        "sub": claims.auth_id,
        "email": claims.email,
        "user_metadata": {"display_name": claims.name},
        "aud": "authenticated",
        "iss": LOCAL_ISSUER,
        "iat": now,
        "exp": now + 3600,
        **changes,
    }
    return {name: value for name, value in payload.items() if value is not None}


def signed(key, payload: dict, key_id: str = LOCAL_KEY_ID, algorithm: str = "ES256") -> str:
    return jwt.encode(payload, key, algorithm=algorithm, headers={"kid": key_id})


def hs256_signed_with_public_key(private_key, payload: dict, key_id: str) -> str:
    """The classic forgery: an HMAC token whose secret is the server's public key.
    PyJWT refuses to make one, so it's built by hand."""
    public_pem = private_key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    signing_input = _segments({"alg": "HS256", "typ": "JWT", "kid": key_id}, payload)
    signature = hmac.new(public_pem, signing_input, hashlib.sha256).digest()
    return (signing_input + b"." + _b64(signature)).decode()


def unsigned(payload: dict, key_id: str) -> str:
    """An `alg: none` token, with no signature at all."""
    return (_segments({"alg": "none", "typ": "JWT", "kid": key_id}, payload) + b".").decode()


def _segments(header: dict, payload: dict) -> bytes:
    return b".".join(_b64(json.dumps(part).encode()) for part in (header, payload))


def _b64(data: bytes) -> bytes:
    return base64.urlsafe_b64encode(data).rstrip(b"=")


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def local_forgeries() -> dict[str, dict[str, str]]:
    """Requests that mustn't get in while local sign-in is on, by name."""
    local_key = auth.local_signing_key()
    hour_ago = int(datetime.now(UTC).timestamp()) - 3600
    return {
        "no token": {},
        "not a bearer token": {"Authorization": "Basic dGVzdDpsb2NhbC10ZXN0LW9ubHk="},
        "malformed": bearer("not-a-token"),
        "expired": bearer(signed(local_key, claims_payload(exp=hour_ago, iat=hour_ago - 60))),
        "no expiry": bearer(signed(local_key, claims_payload(exp=None))),
        "wrong signature": bearer(signed(STRANGER_KEY, claims_payload())),
        "alg none": bearer(unsigned(claims_payload(), LOCAL_KEY_ID)),
        "HS256 with the public key": bearer(
            hs256_signed_with_public_key(local_key, claims_payload(), LOCAL_KEY_ID)
        ),
        "wrong issuer": bearer(signed(local_key, claims_payload(iss=SUPABASE_ISSUER))),
        "wrong audience": bearer(signed(local_key, claims_payload(aud="anon"))),
        "no email": bearer(signed(local_key, claims_payload(email=None))),
    }


def supabase_forgeries() -> dict[str, dict[str, str]]:
    """Requests that mustn't get in with Supabase sign-in, by name."""
    payload = claims_payload(JANE, iss=SUPABASE_ISSUER)
    hour_ago = int(datetime.now(UTC).timestamp()) - 3600
    return {
        "local token": bearer(local_token(TEST_USER)),
        "another project's token": bearer(
            signed(SUPABASE_KEY, {**payload, "iss": "https://other.supabase.co/auth/v1"}, KEY_ID)
        ),
        "expired": bearer(signed(SUPABASE_KEY, {**payload, "exp": hour_ago}, KEY_ID)),
        "wrong signature": bearer(signed(STRANGER_KEY, payload, KEY_ID)),
        "unknown key id": bearer(signed(STRANGER_KEY, payload, "someone-elses-key")),
        "no key id": bearer(jwt.encode(payload, SUPABASE_KEY, algorithm="ES256")),
        "alg none": bearer(unsigned(payload, KEY_ID)),
        "HS256 with the public key": bearer(
            hs256_signed_with_public_key(SUPABASE_KEY, payload, KEY_ID)
        ),
    }


LOCAL_FORGERIES = list(local_forgeries())
SUPABASE_FORGERIES = list(supabase_forgeries())


class KeySet:
    """Stands in for Supabase's published key set, counting how often it's fetched."""

    def __init__(self):
        self.keys: list[dict] = []
        self.fetches = 0
        # Set to an error to make the next fetches fail with it, as when Supabase can't be reached.
        self.failure: Exception | None = None

    def publish(self, private_key, key_id: str) -> None:
        if isinstance(private_key, rsa.RSAPrivateKey):
            jwk, algorithm = RSAAlgorithm.to_jwk(private_key.public_key(), as_dict=True), "RS256"
        else:
            jwk, algorithm = ECAlgorithm.to_jwk(private_key.public_key(), as_dict=True), "ES256"
        self.keys.append({**jwk, "kid": key_id, "alg": algorithm, "use": "sig"})

    def __call__(self, url: str) -> dict:
        assert url == f"{SUPABASE_ISSUER}/.well-known/jwks.json"
        self.fetches += 1
        if self.failure is not None:
            raise self.failure
        return {"keys": list(self.keys)}


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


@pytest.fixture
def clock(monkeypatch):
    clock = Clock()
    monkeypatch.setattr(auth, "monotonic", clock)
    return clock


@pytest.fixture
def supabase(monkeypatch, clock):
    """Supabase sign-in, with its key set stubbed so nothing reaches the internet."""
    monkeypatch.delenv("ACCOUNTABLE_SIGN_IN")
    monkeypatch.setenv("SUPABASE_URL", SUPABASE_URL)
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key")
    monkeypatch.setenv("DATABASE_URL", "postgresql://unused@localhost/unused")
    key_set = KeySet()
    key_set.publish(SUPABASE_KEY, KEY_ID)
    monkeypatch.setattr(auth, "fetch_key_set", key_set)
    auth.supabase_keys.cache_clear()
    yield key_set
    auth.supabase_keys.cache_clear()


@pytest.fixture
def probe(engine):
    """A one-route app that needs the Person, on the test's database in either mode."""
    probe_app = FastAPI()

    @probe_app.get("/probe")
    def whoami(person: Person) -> dict:
        return asdict(person)

    def test_conn():
        with engine.connect() as conn:
            yield conn

    probe_app.dependency_overrides[get_conn] = test_conn
    return TestClient(probe_app)


def assert_refused(response) -> None:
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_MESSAGE


def user_rows(engine) -> list:
    with engine.connect() as conn:
        return conn.execute(select(users)).all()


# --- TB46: every route refuses a missing or forged token --------------------


@pytest.mark.parametrize("kind", LOCAL_FORGERIES)
def test_local_sign_in_refuses_a_forged_token(probe, kind):
    assert_refused(probe.get("/probe", headers=local_forgeries()[kind]))


@pytest.mark.parametrize("kind", SUPABASE_FORGERIES)
def test_supabase_sign_in_refuses_a_forged_token(probe, supabase, kind):
    assert_refused(probe.get("/probe", headers=supabase_forgeries()[kind]))


def test_a_refused_token_adds_no_one(probe, engine):
    probe.get("/probe", headers=local_forgeries()["wrong signature"])
    assert user_rows(engine) == []


# The reset route is mounted only while tests run (ACCOUNTABLE_TESTING=1), never in the
# built app, and stays open so the end-to-end fixture can reset the data before signing in.
OPEN_PATHS = {"/api/health", "/api/config", "/api/testing/reset"}


def api_routes() -> list[RouteContext]:
    """The API's routes as the app serves them, with their prefixes and router-level dependencies."""
    return [
        route
        for route in iter_route_contexts(app.routes)
        if isinstance(route.original_route, APIRoute) and (route.path or "").startswith("/api/")
    ]


def protected_requests() -> list[tuple[str, str]]:
    """Every method and path the app answers except the open ones, read from the app
    so a new route can't be missed. Path parameters are filled with 1."""
    return [
        (method, re.sub(r"\{[^}]+\}", "1", path))
        for route in api_routes()
        if (path := route.path or "") not in OPEN_PATHS and not path.startswith("/api/local-auth/")
        for method in sorted(route.methods or ())
    ]


def refusals(client: TestClient, headers: dict[str, str]) -> list[str]:
    """The requests that weren't refused with the usual 401 reply."""
    expected = {"message": SIGN_IN_MESSAGE, "fields": {}}
    wrong = []
    for method, path in protected_requests():
        response = client.request(method, path, headers=headers)
        if response.status_code != 401 or response.json() != expected:
            wrong.append(f"{method} {path}: {response.status_code} {response.text[:80]}")
    return wrong


def test_the_app_has_routes_to_protect():
    assert len(protected_requests()) > 20


@pytest.mark.parametrize("kind", LOCAL_FORGERIES)
def test_every_route_refuses_a_forged_local_token(signed_out_client, kind):
    assert refusals(signed_out_client, local_forgeries()[kind]) == []


@pytest.mark.parametrize("kind", ["local token", "another project's token", "alg none"])
def test_every_route_refuses_a_forged_supabase_token(signed_out_client, supabase, kind):
    assert refusals(signed_out_client, supabase_forgeries()[kind]) == []


def test_health_and_config_need_no_token(signed_out_client):
    assert signed_out_client.get("/api/health").status_code == 200
    assert signed_out_client.get("/api/config").status_code == 200


def test_a_signed_in_person_gets_in(client):
    assert client.get("/api/organizations").status_code == 200


# --- TB47: Supabase's tokens and keys ---------------------------------------


def jane_token(key=SUPABASE_KEY, key_id: str = KEY_ID, algorithm: str = "ES256") -> str:
    return signed(key, claims_payload(JANE, iss=SUPABASE_ISSUER), key_id, algorithm)


def test_a_supabase_token_is_accepted(probe, supabase):
    response = probe.get("/probe", headers=bearer(jane_token()))
    assert response.status_code == 200
    assert response.json() | {"id": 0} == asdict(JANE) | {"id": 0}


def test_an_rs256_supabase_token_is_accepted(probe, supabase):
    supabase.publish(RSA_KEY, "rsa-key")
    response = probe.get("/probe", headers=bearer(jane_token(RSA_KEY, "rsa-key", "RS256")))
    assert response.status_code == 200


def test_the_keys_are_fetched_once_over_many_requests(probe, supabase):
    for _ in range(5):
        assert probe.get("/probe", headers=bearer(jane_token())).status_code == 200
    assert supabase.fetches == 1


def test_a_new_key_id_fetches_the_keys_once_more(probe, supabase, clock):
    probe.get("/probe", headers=bearer(jane_token()))
    supabase.publish(ROTATED_KEY, "supabase-key-2")
    clock.now += auth.REFETCH_AFTER_SECONDS

    for _ in range(3):
        response = probe.get("/probe", headers=bearer(jane_token(ROTATED_KEY, "supabase-key-2")))
        assert response.status_code == 200
    assert supabase.fetches == 2


def test_unknown_key_ids_fetch_no_more_than_every_few_minutes(probe, supabase, clock):
    probe.get("/probe", headers=bearer(jane_token()))
    for key_id in ("made-up-1", "made-up-2", "made-up-3"):
        assert_refused(probe.get("/probe", headers=bearer(jane_token(STRANGER_KEY, key_id))))
    assert supabase.fetches == 1


# A failed fetch of the key set: Supabase can't be reached, is too slow, or sends something
# other than a key set. The fetch itself is stubbed, so these stand in for each.
FETCH_FAILURES = {
    "unreachable": urllib.error.URLError("connection refused"),
    "too slow": TimeoutError("timed out"),
    "not JSON": json.JSONDecodeError("Expecting value", "<html>", 0),
    "not a key set": TypeError("Supabase's key set isn't a JSON object."),
    "no usable keys": jwt.PyJWKSetError("The JWK Set did not contain any keys"),
}


@pytest.mark.parametrize("body", [b"[]", b'"keys"', b"null"])
def test_a_reply_that_isnt_a_key_set_is_a_failed_fetch(monkeypatch, body):
    monkeypatch.setattr(auth.urllib.request, "urlopen", lambda *_a, **_k: io.BytesIO(body))
    with pytest.raises(TypeError):
        auth.fetch_key_set(f"{SUPABASE_ISSUER}/.well-known/jwks.json")


def assert_unavailable(response) -> None:
    assert response.status_code == 503
    assert response.json()["detail"] == auth.KEYS_UNAVAILABLE_MESSAGE


@pytest.mark.parametrize("failure", FETCH_FAILURES)
def test_a_failed_fetch_keeps_the_session_and_is_tried_again_soon(probe, supabase, clock, failure):
    supabase.failure = FETCH_FAILURES[failure]
    assert_unavailable(probe.get("/probe", headers=bearer(jane_token())))

    supabase.failure = None
    clock.now += auth.RETRY_AFTER_FAILURE_SECONDS
    assert probe.get("/probe", headers=bearer(jane_token())).status_code == 200
    assert supabase.fetches == 2


def test_a_failed_fetch_isnt_tried_again_straight_away(probe, supabase, clock):
    supabase.failure = FETCH_FAILURES["unreachable"]
    for _ in range(3):
        assert_unavailable(probe.get("/probe", headers=bearer(jane_token())))
    assert supabase.fetches == 1


def test_a_failed_fetch_keeps_the_keys_already_held(probe, supabase, clock):
    probe.get("/probe", headers=bearer(jane_token()))
    supabase.publish(ROTATED_KEY, "supabase-key-2")
    supabase.failure = FETCH_FAILURES["unreachable"]
    clock.now += auth.REFETCH_AFTER_SECONDS

    rotated = bearer(jane_token(ROTATED_KEY, "supabase-key-2"))
    assert_unavailable(probe.get("/probe", headers=rotated))
    assert probe.get("/probe", headers=bearer(jane_token())).status_code == 200

    supabase.failure = None
    clock.now += auth.RETRY_AFTER_FAILURE_SECONDS
    assert probe.get("/probe", headers=rotated).status_code == 200


def test_after_a_good_fetch_an_unknown_key_is_refused_again(probe, supabase, clock):
    supabase.failure = FETCH_FAILURES["unreachable"]
    probe.get("/probe", headers=bearer(jane_token()))
    supabase.failure = None
    clock.now += auth.RETRY_AFTER_FAILURE_SECONDS

    assert probe.get("/probe", headers=bearer(jane_token())).status_code == 200
    assert_refused(probe.get("/probe", headers=bearer(jane_token(STRANGER_KEY, "made-up"))))


def test_a_known_key_doesnt_wait_for_a_fetch(supabase):
    keys = auth.supabase_keys(SUPABASE_URL)
    keys.get(KEY_ID)
    with keys._lock:  # as while another request is fetching
        assert keys.get(KEY_ID).key_id == KEY_ID


def test_the_api_answers_a_failed_fetch_with_503_and_its_message(signed_out_client, supabase):
    supabase.failure = FETCH_FAILURES["unreachable"]
    response = signed_out_client.get("/api/organizations", headers=bearer(jane_token()))
    assert response.status_code == 503
    assert response.json() == {"message": auth.KEYS_UNAVAILABLE_MESSAGE, "fields": {}}


# --- TB48: the users table --------------------------------------------------


def test_a_first_request_adds_the_person(probe, engine):
    probe.get("/probe", headers=bearer(local_token(TEST_USER)))
    [row] = user_rows(engine)
    assert (row.auth_id, row.email, row.name) == (
        "local-test-user",
        "test@accountable.local",
        "Test User",
    )


def test_the_same_claims_again_write_nothing(probe, engine):
    probe.get("/probe", headers=bearer(local_token(TEST_USER)))
    before = user_rows(engine)
    probe.get("/probe", headers=bearer(local_token(TEST_USER)))
    assert user_rows(engine) == before


@pytest.mark.parametrize(
    "changed",
    [
        Claims(auth_id="local-test-user", email="test@accountable.local", name="Tess User"),
        Claims(auth_id="local-test-user", email="tess@accountable.local", name="Test User"),
        Claims(auth_id="local-test-user", email="test@accountable.local", name=None),
    ],
    ids=["new name", "new email", "name removed"],
)
def test_a_changed_name_or_email_updates_the_row(probe, engine, changed):
    first = probe.get("/probe", headers=bearer(local_token(TEST_USER))).json()
    second = probe.get("/probe", headers=bearer(local_token(changed))).json()
    [row] = user_rows(engine)
    assert second["id"] == first["id"] == row.id
    assert (row.email, row.name) == (changed.email, changed.name)
    assert row.updated_at >= row.created_at


def test_a_user_id_in_a_body_is_ignored(client, conn, second_person):
    sam_id = auth.person_for(conn, second_person).id

    body = {"name": "Acme Ltd", "created_by": sam_id, "updated_by": sam_id, "user_id": sam_id}
    org = client.post("/api/organizations", json=body).json()

    row = conn.execute(select(organizations).where(organizations.c.id == org["id"])).one()
    assert sam_id not in (row.created_by, row.updated_by)


@pytest.mark.parametrize(
    ("metadata", "name"),
    [
        ({"display_name": "Jane Smith", "full_name": "J Smith"}, "Jane Smith"),
        ({"display_name": "  ", "full_name": "Jane Smith"}, "Jane Smith"),
        ({"name": "Jane"}, "Jane"),
        ({}, None),
        (None, None),
        ({"display_name": 7}, None),
    ],
)
def test_the_display_name_falls_back_to_full_name_then_name(metadata, name):
    assert auth.display_name(metadata) == name


def test_supabase_mode_needs_its_url(monkeypatch):
    monkeypatch.delenv("ACCOUNTABLE_SIGN_IN")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    with pytest.raises(auth.config.SettingsError):
        auth.claims_from(jane_token())


def test_a_local_token_lasts_an_hour():
    payload = jwt.decode(local_token(TEST_USER), options={"verify_signature": False})
    assert payload["exp"] - payload["iat"] == timedelta(hours=1).total_seconds()
