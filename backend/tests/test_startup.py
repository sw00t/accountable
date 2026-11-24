"""TB56: what the backend does to its database when it starts, by sign-in mode (G4, G5, R1)."""

import pytest
from sqlalchemy import inspect

from app import main, seed
from app.config import SettingsError
from app.db import count_rows, deals, engine_for, organizations


@pytest.fixture
def supabase_mode(monkeypatch, tmp_path):
    """Supabase sign-in, with a SQLite file standing in for Postgres so nothing reaches the internet."""
    monkeypatch.delenv("ACCOUNTABLE_SIGN_IN")
    monkeypatch.setenv("DATABASE_URL", "postgresql://unused@localhost/unused")
    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key")
    stand_in = engine_for((tmp_path / "stand-in.db").resolve())
    monkeypatch.setattr(main, "app_engine", lambda: stand_in)
    return stand_in


def test_with_local_sign_in_a_missing_file_is_created_and_seeded(db_path):
    main.start_database()
    with engine_for(db_path.resolve()).connect() as conn:
        assert count_rows(conn, deals) == 30


def test_in_supabase_mode_the_database_is_migrated_and_never_seeded(supabase_mode):
    main.start_database()
    assert "organizations" in inspect(supabase_mode).get_table_names()
    with supabase_mode.connect() as conn:
        assert count_rows(conn, organizations) == 0


def test_supabase_mode_wont_start_without_its_settings(supabase_mode, monkeypatch):
    monkeypatch.delenv("SUPABASE_PUBLISHABLE_KEY")
    with pytest.raises(SettingsError, match="SUPABASE_PUBLISHABLE_KEY"):
        main.start_database()
    assert inspect(supabase_mode).get_table_names() == []


def test_local_sign_in_wont_start_on_render(db_path, monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    with pytest.raises(SettingsError, match="Render"):
        main.start_database()
    assert not db_path.exists()


def test_npm_run_seed_loads_the_sqlite_file_even_with_database_url_set(db_path, monkeypatch):
    monkeypatch.delenv("ACCOUNTABLE_SIGN_IN")
    monkeypatch.setenv("DATABASE_URL", "postgresql://unused@localhost/unused")
    seed.main()
    with engine_for(db_path.resolve()).connect() as conn:
        assert count_rows(conn, deals) == 30
