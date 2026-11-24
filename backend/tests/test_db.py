"""TB09: foreign keys and the one-parent rule. The accounts and search columns, and the engines."""

from datetime import date

import pytest
from sqlalchemy import delete, insert, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import QueuePool

from app.db import (
    activities,
    contacts,
    deals,
    make_postgres_engine,
    organizations,
    users,
)


def test_foreign_keys_on_for_every_connection(engine):
    for _ in range(3):
        with engine.connect() as conn:
            assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1


def test_foreign_key_enforced(conn):
    with pytest.raises(IntegrityError):
        conn.execute(
            insert(contacts).values(
                name="Ghost", search_name="ghost", status="lead", organization_id=999
            )
        )


def _parents(conn):
    org_id = conn.execute(
        insert(organizations).values(name="Org", search_name="org")
    ).inserted_primary_key[0]
    contact_id = conn.execute(
        insert(contacts).values(name="C", search_name="c", status="lead")
    ).inserted_primary_key[0]
    deal_id = conn.execute(
        insert(deals).values(
            name="D",
            search_name="d",
            organization_id=org_id,
            stage="new",
            value=1,
            probability=10,
        )
    ).inserted_primary_key[0]
    return contact_id, deal_id


@pytest.mark.parametrize("which", ["both", "neither"])
def test_activity_needs_exactly_one_parent(conn, which):
    contact_id, deal_id = _parents(conn)
    values = {"type": "call", "description": "x", "occurred_on": date(2026, 11, 1)}
    if which == "both":
        values |= {"contact_id": contact_id, "deal_id": deal_id}
    with pytest.raises(IntegrityError):
        conn.execute(insert(activities).values(**values))


def test_activity_with_one_parent_is_fine(conn):
    contact_id, deal_id = _parents(conn)
    base = {"type": "call", "description": "x", "occurred_on": date(2026, 11, 1)}
    conn.execute(insert(activities).values(**base, contact_id=contact_id))
    conn.execute(insert(activities).values(**base, deal_id=deal_id))


# --- Accounts and search ---------------------------------------------------------

NAMED = [organizations, contacts, deals]
AUTHORED = [*NAMED, activities]


def _indexes(engine, table) -> dict[tuple[str, ...], bool]:
    """Each index's columns, and whether it's unique."""
    return {
        tuple(index["column_names"]): bool(index["unique"])
        for index in inspect(engine).get_indexes(table.name)
    }


def test_users_are_found_by_their_unique_auth_id(engine, conn):
    assert _indexes(engine, users)[("auth_id",)] is True
    conn.execute(insert(users).values(auth_id="a1", email="jane@example.com"))
    with pytest.raises(IntegrityError):
        conn.execute(insert(users).values(auth_id="a1", email="other@example.com"))


@pytest.mark.parametrize("table", AUTHORED, ids=lambda t: t.name)
def test_who_added_and_last_changed_link_to_users_and_are_indexed(engine, table):
    links = {
        fk["constrained_columns"][0]: (fk["referred_table"], fk["options"].get("ondelete"))
        for fk in inspect(engine).get_foreign_keys(table.name)
    }
    indexes = _indexes(engine, table)
    for column in ("created_by", "updated_by"):
        assert links[column] == ("users", "SET NULL")
        assert (column,) in indexes


@pytest.mark.parametrize("table", NAMED, ids=lambda t: t.name)
def test_search_name_is_indexed(engine, table):
    assert ("search_name",) in _indexes(engine, table)


@pytest.mark.parametrize("table", NAMED, ids=lambda t: t.name)
def test_search_name_is_required(engine, table):
    column = next(c for c in inspect(engine).get_columns(table.name) if c["name"] == "search_name")
    assert column["nullable"] is False


def test_a_record_without_search_name_is_refused(conn):
    with pytest.raises(IntegrityError):
        conn.execute(insert(organizations).values(name="Acme Ltd"))


def test_removing_a_person_keeps_their_records(conn):
    person = conn.execute(
        insert(users).values(auth_id="a1", email="jane@example.com", name="Jane Smith")
    ).inserted_primary_key[0]
    org_id = conn.execute(
        insert(organizations).values(
            name="Acme Ltd", search_name="acme ltd", created_by=person, updated_by=person
        )
    ).inserted_primary_key[0]
    conn.execute(delete(users).where(users.c.id == person))
    row = conn.execute(
        select(organizations.c.created_by, organizations.c.updated_by).where(
            organizations.c.id == org_id
        )
    ).one()
    assert tuple(row) == (None, None)


def test_postgres_engine_has_a_small_pool_that_replaces_dropped_connections():
    """R9: Supabase's pooler limits connections and drops them while Render sleeps.
    Making the engine doesn't connect, so no database is needed."""
    engine = make_postgres_engine("postgresql+psycopg://user:pw@db.example.com/postgres")
    assert engine.dialect.driver == "psycopg"
    pool = engine.pool
    assert isinstance(pool, QueuePool)
    assert pool.size() + pool._max_overflow <= 5
    assert pool._pre_ping is True
