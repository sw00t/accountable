"""TB55: `npm run seed:supabase` asks before it deletes anything, and keeps users (G15, R16).
A temporary SQLite database stands in for Supabase, so nothing reaches the internet."""

import pytest
from sqlalchemy import inspect, select

from app import seed_supabase
from app.db import count_rows, deals, engine_for, organizations, users


def answering(reply: str):
    return lambda _question: reply


def names(engine) -> list[str]:
    with engine.connect() as conn:
        return list(conn.scalars(select(organizations.c.name)))


def test_it_shows_the_counts_there_now(engine, api, capsys):
    api.org("Acme Ltd")
    api.contact("Ada Park")
    api.contact("Bo Chen")
    seed_supabase.load(engine, answering("no"))
    shown = capsys.readouterr().out
    assert "1 organization, 2 contacts, 0 deals and 0 activities" in shown


@pytest.mark.parametrize("reply", ["no", "", "y", "yes please"])
def test_any_answer_but_yes_leaves_the_data_as_it_was(engine, api, capsys, reply):
    api.org("Acme Ltd")
    assert seed_supabase.load(engine, answering(reply)) is False
    assert names(engine) == ["Acme Ltd"]
    assert "Nothing was changed." in capsys.readouterr().out


def test_a_database_with_no_tables_is_left_without_them(tmp_path, capsys):
    empty = engine_for((tmp_path / "empty.db").resolve())
    seed_supabase.load(empty, answering("no"))
    assert inspect(empty).get_table_names() == []
    assert "0 organizations, 0 contacts, 0 deals and 0 activities" in capsys.readouterr().out


@pytest.mark.parametrize("reply", ["yes", " YES "])
def test_yes_loads_the_sample_data_and_keeps_users(engine, api, reply):
    api.org("Acme Ltd")
    with engine.connect() as conn:
        people = conn.execute(select(users)).all()
    assert people

    assert seed_supabase.load(engine, answering(reply)) is True
    with engine.connect() as conn:
        assert count_rows(conn, deals) == 30
        assert conn.execute(select(users)).all() == people
    assert "Acme Ltd" not in names(engine)


def test_yes_migrates_a_database_with_no_tables(tmp_path):
    empty = engine_for((tmp_path / "empty.db").resolve())
    seed_supabase.load(empty, answering("yes"))
    with empty.connect() as conn:
        assert count_rows(conn, deals) == 30


def test_an_unreachable_database_never_shows_its_url(monkeypatch, capsys):
    monkeypatch.setenv("DATABASE_URL", "postgresql://someone:s3cret-password@127.0.0.1:1/postgres")
    with pytest.raises(SystemExit) as stopped:
        seed_supabase.main()
    printed = capsys.readouterr()
    shown = str(stopped.value) + printed.out + printed.err
    assert "couldn't reach the Supabase database" in shown
    assert "s3cret-password" not in shown and "127.0.0.1:1" not in shown


def test_it_needs_database_url():
    with pytest.raises(SystemExit) as stopped:
        seed_supabase.main()
    assert "DATABASE_URL" in str(stopped.value)
