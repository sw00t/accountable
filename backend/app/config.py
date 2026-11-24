"""Settings read from environment variables.

Never from .env: `npm start` loads that file before the backend starts (R13), so
`npm run dev`, `npm run seed` and the tests never see it (G14).
Reading settings never fails; `Settings.check()` says what's wrong when the app starts.

ACCOUNTABLE_DB            path to the SQLite file (default: data/accountable.db)
ACCOUNTABLE_TODAY         fix "today" as YYYY-MM-DD, used by the tests
ACCOUNTABLE_TESTING       "1" while tests run: seeding then refuses the default database
ACCOUNTABLE_SIGN_IN       "local" for local sign-in with SQLite; anything else, or unset, is Supabase
DATABASE_URL              Supabase's session pooler connection string (Concern 23)
SUPABASE_URL              the Supabase project's address
SUPABASE_PUBLISHABLE_KEY  the key the browser uses for Supabase Auth
RENDER                    set by Render on its services
RENDER_EXTERNAL_HOSTNAME  the service's onrender.com address, set by Render
"""

import os
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Literal

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = REPO_ROOT / "data" / "accountable.db"
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"

SignIn = Literal["local", "supabase"]


class SettingsError(Exception):
    """A setting is missing or doesn't fit how the app was started. The message says what to do."""


@dataclass(frozen=True)
class Settings:
    sign_in: SignIn
    # A SQLAlchemy URL for psycopg. It holds the database password, so it's left out of repr (R16).
    database_url: str | None = field(repr=False)
    supabase_url: str | None
    supabase_publishable_key: str | None
    on_render: bool
    render_host: str | None
    frontend_dist: Path

    @property
    def local(self) -> bool:
        return self.sign_in == "local"

    def missing(self) -> list[str]:
        """The Supabase settings that aren't set, by their names in .env."""
        values = {
            "DATABASE_URL": self.database_url,
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_PUBLISHABLE_KEY": self.supabase_publishable_key,
        }
        return [name for name, value in values.items() if not value]

    def check(self) -> None:
        """Raises SettingsError when the app shouldn't start with these settings (R1)."""
        if self.local:
            if self.on_render:
                raise SettingsError(
                    "Local sign-in is only for development and tests, so it won't start on "
                    "Render. Remove ACCOUNTABLE_SIGN_IN from the service's settings."
                )
            return
        missing = self.missing()
        if missing:
            raise SettingsError(
                f"Accountable can't sign in with Supabase without {_and_list(missing)}. "
                "Add them to .env on this computer, or to the service's settings on Render."
            )


def settings() -> Settings:
    """The settings as the environment has them now."""
    return Settings(
        sign_in="local" if os.environ.get("ACCOUNTABLE_SIGN_IN") == "local" else "supabase",
        database_url=_psycopg_url(_env("DATABASE_URL")),
        supabase_url=(_env("SUPABASE_URL") or "").rstrip("/") or None,
        supabase_publishable_key=_env("SUPABASE_PUBLISHABLE_KEY"),
        on_render=bool(_env("RENDER")),
        render_host=_env("RENDER_EXTERNAL_HOSTNAME"),
        frontend_dist=FRONTEND_DIST,
    )


def _env(name: str) -> str | None:
    return os.environ.get(name, "").strip() or None


def _psycopg_url(url: str | None) -> str | None:
    """Supabase gives a postgresql:// URL; SQLAlchemy needs the driver named to use psycopg."""
    if url is None:
        return None
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url.removeprefix(prefix)
    return url


def _and_list(names: list[str]) -> str:
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def db_path() -> Path:
    raw = os.environ.get("ACCOUNTABLE_DB")
    path = Path(raw) if raw else DEFAULT_DB
    if not path.is_absolute():
        path = REPO_ROOT / path
    return path.resolve()


def fixed_today() -> date | None:
    raw = os.environ.get("ACCOUNTABLE_TODAY")
    return date.fromisoformat(raw) if raw else None


def server_today() -> date:
    return fixed_today() or date.today()


def testing() -> bool:
    return os.environ.get("ACCOUNTABLE_TESTING") == "1"


def is_default_db(path: Path) -> bool:
    return path.resolve() == DEFAULT_DB.resolve()
