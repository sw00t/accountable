"""Checking sign-in tokens and keeping each person's `users` row (U5, Concern 16, Concern 17).

With Supabase, a token is checked against the signing keys the project publishes.
With local sign-in, the backend signs its own tokens with a key made when the process starts.
A token from one mode is never accepted by the other: the keys and issuers differ.
"""

import json
import logging
import threading
import urllib.request
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import cache
from time import monotonic
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from sqlalchemy import Connection, select, update
from sqlalchemy.exc import IntegrityError

from app import config
from app.db import insert_row, users

log = logging.getLogger("accountable")

SIGN_IN_MESSAGE = "Sign in to use Accountable."
AUDIENCE = "authenticated"
SUPABASE_ALGORITHMS = {"ES256", "RS256"}
# A token naming a key we don't have fetches the key set again, but no more often than this,
# so tokens with made-up key ids can't make every request call Supabase (R8).
REFETCH_AFTER_SECONDS = 300
# After a fetch fails, such as while Supabase is slow to answer a service that has just woken,
# the next try waits only this long.
RETRY_AFTER_FAILURE_SECONDS = 5
KEYS_UNAVAILABLE_MESSAGE = "Accountable can't check your sign-in right now. Try again in a moment."

LOCAL_ISSUER = "accountable-local-sign-in"
LOCAL_KEY_ID = "accountable-local"
LOCAL_ALGORITHM = "ES256"
TOKEN_LIFETIME = timedelta(hours=1)


class NotSignedIn(HTTPException):
    """No token, or one that fails a check. main.py answers it with SIGN_IN_MESSAGE."""

    def __init__(self) -> None:
        super().__init__(401, SIGN_IN_MESSAGE, headers={"WWW-Authenticate": "Bearer"})


class KeysUnavailable(HTTPException):
    """Supabase's signing keys couldn't be fetched, so a token can't be checked either way.
    A 503 rather than a 401, so the frontend keeps a session that may be fine (U5)."""

    def __init__(self) -> None:
        super().__init__(503, KEYS_UNAVAILABLE_MESSAGE)


@dataclass(frozen=True)
class Claims:
    """Who a token says the person is."""

    auth_id: str
    email: str
    name: str | None


@dataclass(frozen=True)
class User:
    """The signed-in person's row in `users`."""

    id: int
    auth_id: str
    email: str
    name: str | None


# Local sign-in's one person (U7). The password is written in the spec and is nobody's real one.
TEST_USER = Claims(auth_id="local-test-user", email="test@accountable.local", name="Test User")
TEST_USER_PASSWORD = "local-test-only"


def claims_from(token: str) -> Claims:
    """The person a token names, or NotSignedIn when any check fails."""
    settings = config.settings()
    try:
        header = jwt.get_unverified_header(token)
        if settings.local:
            key, algorithm, issuer = local_signing_key().public_key(), LOCAL_ALGORITHM, LOCAL_ISSUER
        else:
            key, algorithm, issuer = _supabase_key(settings, header)
        payload = jwt.decode(
            token,
            key,
            algorithms=[algorithm],
            audience=AUDIENCE,
            issuer=issuer,
            options={"require": ["exp", "aud", "iss", "sub"]},
        )
    except jwt.PyJWTError as error:
        raise NotSignedIn() from error
    return _claims(payload)


def _claims(payload: dict[str, Any]) -> Claims:
    auth_id, email = payload.get("sub"), payload.get("email")
    if not isinstance(auth_id, str) or not auth_id or not isinstance(email, str) or not email:
        raise NotSignedIn()
    return Claims(auth_id=auth_id, email=email, name=display_name(payload.get("user_metadata")))


def display_name(metadata: object) -> str | None:
    """Supabase's dashboard may not set display_name (R18), so the usual alternatives count too."""
    if not isinstance(metadata, dict):
        return None
    for field in ("display_name", "full_name", "name"):
        value = metadata.get(field)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


# --- Supabase --------------------------------------------------------------


def _supabase_key(settings: config.Settings, header: dict[str, Any]) -> tuple[Any, str, str]:
    if settings.supabase_url is None:
        raise config.SettingsError("Accountable can't check sign-ins without SUPABASE_URL.")
    key_id = header.get("kid")
    if not isinstance(key_id, str):
        raise NotSignedIn()
    key = supabase_keys(settings.supabase_url).get(key_id)
    return key.key, key.algorithm_name, f"{settings.supabase_url}/auth/v1"


def fetch_key_set(url: str) -> dict[str, Any]:
    with urllib.request.urlopen(url, timeout=10) as response:
        key_set = json.load(response)
    if not isinstance(key_set, dict):
        raise TypeError("Supabase's key set isn't a JSON object.")
    return key_set


class SupabaseKeys:
    """The project's published signing keys: fetched once and kept, and fetched again
    when a token names a key id they don't have, such as after Supabase rotates its keys.

    A failed fetch keeps the keys already held and is tried again a few seconds later.
    Until a fetch succeeds, a token naming a key not held gets KeysUnavailable, not
    NotSignedIn, since the key may well exist."""

    def __init__(self, supabase_url: str):
        self.url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
        self._keys: dict[str, jwt.PyJWK] = {}
        self._next_fetch_at: float | None = None
        self._last_fetch_failed = False
        self._lock = threading.Lock()

    def get(self, key_id: str) -> jwt.PyJWK:
        # The keys are replaced whole, never changed in place, so reading them needs no lock,
        # and a token with a known key never waits while another request fetches.
        key = self._keys.get(key_id)
        if key is None:
            key = self._fetched(key_id)
        if key is None:
            raise NotSignedIn()
        return key

    def _fetched(self, key_id: str) -> jwt.PyJWK | None:
        """The key after fetching the key set, if it's due, under the lock so only one
        request fetches at a time."""
        with self._lock:
            if key_id not in self._keys and self._may_fetch():
                self._fetch()
            key = self._keys.get(key_id)
            if key is None and self._last_fetch_failed:
                raise KeysUnavailable()
            return key

    def _may_fetch(self) -> bool:
        return self._next_fetch_at is None or monotonic() >= self._next_fetch_at

    def _fetch(self) -> None:
        try:
            key_set = jwt.PyJWKSet.from_dict(fetch_key_set(self.url))
        except (OSError, ValueError, TypeError, jwt.PyJWTError):
            log.warning("Couldn't fetch Supabase's signing keys", exc_info=True)
            self._last_fetch_failed = True
            self._next_fetch_at = monotonic() + RETRY_AFTER_FAILURE_SECONDS
            return
        self._keys = {
            key.key_id: key
            for key in key_set.keys
            if key.key_id and key.algorithm_name in SUPABASE_ALGORITHMS
        }
        self._last_fetch_failed = False
        self._next_fetch_at = monotonic() + REFETCH_AFTER_SECONDS


@cache
def supabase_keys(supabase_url: str) -> SupabaseKeys:
    return SupabaseKeys(supabase_url)


# --- Local sign-in ---------------------------------------------------------


@cache
def local_signing_key() -> ec.EllipticCurvePrivateKey:
    """Made once per process and never saved, so a restart ends every local session."""
    return ec.generate_private_key(ec.SECP256R1())


def local_token(claims: Claims, lifetime: timedelta = TOKEN_LIFETIME) -> str:
    """A token like Supabase's, signed with the local key."""
    now = datetime.now(UTC)
    payload = {
        "sub": claims.auth_id,
        "email": claims.email,
        "user_metadata": {"display_name": claims.name},
        "aud": AUDIENCE,
        "role": AUDIENCE,
        "iss": LOCAL_ISSUER,
        "iat": now,
        "exp": now + lifetime,
        "session_id": str(uuid.uuid4()),
    }
    return jwt.encode(
        payload, local_signing_key(), algorithm=LOCAL_ALGORITHM, headers={"kid": LOCAL_KEY_ID}
    )


# --- The users table -------------------------------------------------------


def person_for(conn: Connection, claims: Claims) -> User:
    """The person's row, added on their first request and written again only when
    their email or name changed, so most requests only read (R7)."""
    row = _find(conn, claims.auth_id)
    if row is None:
        return _add(conn, claims)
    if (row.email, row.name) != (claims.email, claims.name):
        conn.execute(
            update(users).where(users.c.id == row.id).values(email=claims.email, name=claims.name)
        )
        conn.commit()
    return User(id=row.id, **_fields(claims))


def _add(conn: Connection, claims: Claims) -> User:
    try:
        user_id = insert_row(conn, users, **_fields(claims))
        conn.commit()
    except IntegrityError:
        # Their first two requests arrived together and the other one added the row.
        conn.rollback()
        return person_for(conn, claims)
    return User(id=user_id, **_fields(claims))


def _find(conn: Connection, auth_id: str) -> User | None:
    row = conn.execute(
        select(users.c.id, users.c.auth_id, users.c.email, users.c.name).where(
            users.c.auth_id == auth_id
        )
    ).one_or_none()
    return User(**row._asdict()) if row else None


def _fields(claims: Claims) -> dict[str, Any]:
    return {"auth_id": claims.auth_id, "email": claims.email, "name": claims.name}
