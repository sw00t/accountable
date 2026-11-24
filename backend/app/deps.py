"""Per-request dependencies: a database connection, the signed-in person and today's date."""

from collections.abc import Iterator
from datetime import date, datetime
from typing import Annotated

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import Connection

from app import auth, config
from app.db import app_engine


def get_conn() -> Iterator[Connection]:
    """One connection per request. Write endpoints commit before they return."""
    with app_engine().connect() as conn:
        yield conn


Conn = Annotated[Connection, Depends(get_conn)]

bearer = HTTPBearer(auto_error=False)


def get_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> auth.Claims:
    """The token is checked before any database connection is opened."""
    if credentials is None:
        raise auth.NotSignedIn()
    return auth.claims_from(credentials.credentials)


def get_person(claims: Annotated[auth.Claims, Depends(get_claims)], conn: Conn) -> auth.User:
    """U5: the person comes from the token alone, never from the request's body or query."""
    return auth.person_for(conn, claims)


Person = Annotated[auth.User, Depends(get_person)]


# A browser's date is always well inside this range. Dates near the ends of the
# calendar would overflow the dashboard's date arithmetic, so they're ignored.
EARLIEST_TODAY = date(1900, 1, 1)
LATEST_TODAY = date(2999, 12, 31)


def get_today(x_local_date: Annotated[str | None, Header()] = None) -> date:
    """G10: the browser's local date when it sends a valid one, the server's otherwise."""
    if x_local_date:
        try:
            today = date.fromisoformat(x_local_date.strip())
        except ValueError:
            pass
        else:
            if EARLIEST_TODAY <= today <= LATEST_TODAY:
                return today
    return config.server_today()


def now_on(today: date) -> datetime:
    """A timestamp on the user's today, at the current time of day."""
    return datetime.combine(today, datetime.now().time())


Today = Annotated[date, Depends(get_today)]
