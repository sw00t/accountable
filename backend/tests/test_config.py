"""TB44: the sign-in mode, the Supabase settings and the database URL."""

import os
import subprocess
import sys

import pytest

from app import config
from app.config import SettingsError, settings
from app.db import app_engine, engine_for

SETTINGS = (
    "ACCOUNTABLE_SIGN_IN",
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "RENDER",
    "RENDER_EXTERNAL_HOSTNAME",
)
PASSWORD = "pa55-not-for-logs"
PUBLISHABLE_KEY = "test-publishable-key"
POOLER_URL = (
    f"postgresql://postgres.abc:{PASSWORD}@aws-0-eu-west-2.pooler.supabase.com:5432/postgres"
)


@pytest.fixture(autouse=True)
def no_settings(monkeypatch):
    for name in SETTINGS:
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def supabase_settings(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", POOLER_URL)
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co/")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", PUBLISHABLE_KEY)


def test_supabase_is_the_mode_when_nothing_says_otherwise():
    assert settings().sign_in == "supabase"
    assert not settings().local


@pytest.mark.parametrize("value", ["", "LOCAL", "yes", "local ", "supabase"])
def test_only_the_exact_word_local_turns_on_local_sign_in(monkeypatch, value):
    monkeypatch.setenv("ACCOUNTABLE_SIGN_IN", value)
    assert settings().sign_in == "supabase"


def test_local_sign_in(monkeypatch):
    monkeypatch.setenv("ACCOUNTABLE_SIGN_IN", "local")
    assert settings().local
    settings().check()


def test_local_sign_in_is_refused_on_render(monkeypatch):
    monkeypatch.setenv("ACCOUNTABLE_SIGN_IN", "local")
    monkeypatch.setenv("RENDER", "true")
    with pytest.raises(SettingsError, match="won't start on Render"):
        settings().check()


def test_every_missing_supabase_setting_is_named():
    with pytest.raises(SettingsError) as error:
        settings().check()
    assert "DATABASE_URL, SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY" in str(error.value)


def test_only_the_missing_setting_is_named(supabase_settings, monkeypatch):
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "  ")
    with pytest.raises(SettingsError) as error:
        settings().check()
    message = str(error.value)
    assert "without SUPABASE_PUBLISHABLE_KEY." in message
    assert "DATABASE_URL" not in message


def test_supabase_settings_are_read(supabase_settings, monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("RENDER_EXTERNAL_HOSTNAME", "accountable.onrender.com")
    current = settings()
    current.check()
    assert current.supabase_url == "https://abc.supabase.co"
    assert current.supabase_publishable_key == PUBLISHABLE_KEY
    assert current.on_render
    assert current.render_host == "accountable.onrender.com"
    assert current.frontend_dist == config.REPO_ROOT / "frontend" / "dist"


@pytest.mark.parametrize("scheme", ["postgresql", "postgres"])
def test_a_postgres_url_becomes_a_psycopg_url(monkeypatch, scheme):
    monkeypatch.setenv("DATABASE_URL", f"{scheme}://user:pw@host:5432/postgres")
    assert settings().database_url == "postgresql+psycopg://user:pw@host:5432/postgres"


def test_a_psycopg_url_is_kept(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://user:pw@host/postgres")
    assert settings().database_url == "postgresql+psycopg://user:pw@host/postgres"


def test_the_database_password_is_never_shown(supabase_settings, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "")
    current = settings()
    with pytest.raises(SettingsError) as error:
        current.check()
    shown = [repr(current), str(current), str(error.value), repr(app_engine())]
    assert all(PASSWORD not in text for text in shown)


def test_the_mode_chooses_the_database(supabase_settings, monkeypatch, tmp_path):
    postgres = app_engine()
    assert (postgres.dialect.name, postgres.dialect.driver) == ("postgresql", "psycopg")
    monkeypatch.setenv("ACCOUNTABLE_SIGN_IN", "local")
    monkeypatch.setenv("ACCOUNTABLE_DB", str(tmp_path / "local.db"))
    local = app_engine()
    assert local is engine_for(config.db_path())
    assert local.dialect.name == "sqlite"


def test_supabase_mode_without_a_database_says_what_is_missing():
    with pytest.raises(SettingsError, match="DATABASE_URL"):
        app_engine()


def test_importing_the_app_needs_no_settings():
    """npm run types imports app.main with no settings at all (R13)."""
    env = {k: v for k, v in os.environ.items() if k not in SETTINGS}
    result = subprocess.run(
        [sys.executable, "-c", "import app.main, app.config; app.config.settings()"],
        cwd=config.REPO_ROOT / "backend",
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
