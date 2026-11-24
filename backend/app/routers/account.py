"""Which sign-in to use, the signed-in person, and local sign-in's stand-in for Supabase Auth."""

import hmac
import secrets
from datetime import UTC, datetime
from time import monotonic
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from app import auth, config, rules
from app.auth import TEST_USER, TEST_USER_PASSWORD, Claims
from app.deps import Person

router = APIRouter(tags=["account"])


class SignInConfig(BaseModel):
    sign_in: Literal["local", "supabase"]
    supabase_url: str | None
    supabase_publishable_key: str | None


class Me(BaseModel):
    name: str | None
    email: str
    shown_name: str


@router.get("/config")
def get_config() -> SignInConfig:
    """Needs no sign-in: the frontend reads it to know where to sign in."""
    settings = config.settings()
    if settings.local:
        return SignInConfig(sign_in="local", supabase_url=None, supabase_publishable_key=None)
    return SignInConfig(
        sign_in="supabase",
        supabase_url=settings.supabase_url,
        supabase_publishable_key=settings.supabase_publishable_key,
    )


@router.get("/me")
def me(person: Person) -> Me:
    return Me(
        name=person.name, email=person.email, shown_name=rules.shown_name(person.name, person.email)
    )


# --- Local sign-in (U7) ----------------------------------------------------
# The part of Supabase Auth that auth-js uses, answered in Supabase Auth's JSON shapes,
# so the frontend's code is the same in both modes (R4). main.py mounts it only for local
# sign-in, and each route also checks the mode, so it can't answer in the built app (R1).


def local_sign_in_only() -> None:
    if not config.settings().local:
        raise HTTPException(404)


local_auth = APIRouter(
    prefix="/local-auth",
    tags=["local-auth"],
    include_in_schema=False,
    dependencies=[Depends(local_sign_in_only)],
)

# Refresh tokens are kept in memory like the signing key, so a restart ends the session.
# Each maps to when it was first used, or None. Renewing replaces it, as Supabase does,
# but like Supabase's reuse interval a used token still renews for a few seconds, so two
# tabs renewing at once both stay signed in (R5).
_refresh_tokens: dict[str, float | None] = {}
REUSE_INTERVAL_SECONDS = 10
_STARTED_AT = datetime.now(UTC).isoformat()
API_VERSION = "2024-01-01"


class TokenRequest(BaseModel):
    email: str | None = None
    password: str | None = None
    refresh_token: str | None = None


@local_auth.post("/token")
def token(grant_type: str, body: TokenRequest) -> JSONResponse:
    if grant_type == "password":
        return _sign_in(body)
    if grant_type == "refresh_token":
        return _renew(body)
    return _auth_error(400, "validation_failed", "Unsupported grant type")


@local_auth.get("/user")
def user(request: Request) -> JSONResponse:
    claims = _bearer_claims(request)
    if claims is None:
        return _bad_token()
    return _json(200, _user_json(claims))


@local_auth.post("/logout")
def logout(request: Request) -> Response:
    """Ends every local session: local sign-in has one person."""
    if _bearer_claims(request) is None:
        return _bad_token()
    _refresh_tokens.clear()
    return Response(status_code=204, headers=_version_header())


def _sign_in(body: TokenRequest) -> JSONResponse:
    email_matches = (body.email or "").strip().lower() == TEST_USER.email
    password_matches = hmac.compare_digest(
        (body.password or "").encode(), TEST_USER_PASSWORD.encode()
    )
    if not (email_matches and password_matches):
        return _auth_error(400, "invalid_credentials", "Invalid login credentials")
    return _json(200, _session(TEST_USER))


def _renew(body: TokenRequest) -> JSONResponse:
    token = body.refresh_token or ""
    if not _may_renew(token):
        return _auth_error(
            400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found"
        )
    if _refresh_tokens[token] is None:
        _refresh_tokens[token] = monotonic()
    return _json(200, _session(TEST_USER))


def _may_renew(token: str) -> bool:
    if token not in _refresh_tokens:
        return False
    first_used = _refresh_tokens[token]
    return first_used is None or monotonic() - first_used <= REUSE_INTERVAL_SECONDS


def _bearer_claims(request: Request) -> Claims | None:
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    try:
        return auth.claims_from(token)
    except auth.NotSignedIn:
        return None


def _session(claims: Claims) -> dict:
    refresh_token = secrets.token_urlsafe(32)
    _refresh_tokens[refresh_token] = None
    lifetime = int(auth.TOKEN_LIFETIME.total_seconds())
    return {
        "access_token": auth.local_token(claims),
        "token_type": "bearer",
        "expires_in": lifetime,
        "expires_at": int(datetime.now(UTC).timestamp()) + lifetime,
        "refresh_token": refresh_token,
        "user": _user_json(claims),
    }


def _user_json(claims: Claims) -> dict:
    return {
        "id": claims.auth_id,
        "aud": auth.AUDIENCE,
        "role": auth.AUDIENCE,
        "email": claims.email,
        "email_confirmed_at": _STARTED_AT,
        "phone": "",
        "confirmed_at": _STARTED_AT,
        "last_sign_in_at": _STARTED_AT,
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {"display_name": claims.name},
        "identities": [],
        "created_at": _STARTED_AT,
        "updated_at": _STARTED_AT,
        "is_anonymous": False,
    }


def _bad_token() -> JSONResponse:
    return _auth_error(403, "bad_jwt", "invalid JWT: unable to parse or verify signature")


def _auth_error(status: int, code: str, message: str) -> JSONResponse:
    """Supabase Auth's error shape for API version 2024-01-01, which auth-js asks for."""
    return _json(status, {"code": code, "msg": message})


def _json(status: int, content: dict) -> JSONResponse:
    return JSONResponse(status_code=status, content=content, headers=_version_header())


def _version_header() -> dict[str, str]:
    return {"X-Supabase-Api-Version": API_VERSION}
