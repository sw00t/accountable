"""TB42: migrations match db.py and keep data. TB45: migration 0002."""

from datetime import date

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import func, select

from app.db import (
    activities,
    contacts,
    deals,
    metadata,
    migrate,
    organizations,
    stage_changes,
)
from app.seed import seed

TODAY = date(2026, 11, 16)


def test_migrated_schema_matches_db_py(engine):
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), metadata)
    assert diff == []


def test_upgrade_keeps_every_row(engine):
    seed(engine, TODAY)
    tables = [organizations, contacts, deals, activities, stage_changes]
    with engine.connect() as conn:
        before = {t.name: conn.scalar(select(func.count()).select_from(t)) for t in tables}
    migrate(engine)
    migrate(engine)
    with engine.connect() as conn:
        after = {t.name: conn.scalar(select(func.count()).select_from(t)) for t in tables}
    assert after == before
    assert before["deals"] == 30


def test_table_rebuild_in_a_migration_keeps_linked_rows(engine):
    """RV6: a batch rebuild of a parent table must not fire ON DELETE on its children."""
    from alembic.operations import Operations
    from sqlalchemy import Column, Integer

    from app.db import foreign_keys_off

    seed(engine, TODAY)
    tables = [contacts, deals, activities, stage_changes]
    with engine.connect() as conn:
        before = {t.name: conn.scalar(select(func.count()).select_from(t)) for t in tables}
        linked = conn.scalar(
            select(func.count())
            .select_from(contacts)
            .where(contacts.c.organization_id.is_not(None))
        )
    with foreign_keys_off(engine) as conn, conn.begin():
        ops = Operations(MigrationContext.configure(conn))
        for parent in ("organizations", "contacts", "deals"):
            with ops.batch_alter_table(parent, recreate="always") as batch:
                batch.add_column(Column("rv6_probe", Integer))
    with engine.connect() as conn:
        after = {t.name: conn.scalar(select(func.count()).select_from(t)) for t in tables}
        still_linked = conn.scalar(
            select(func.count())
            .select_from(contacts)
            .where(contacts.c.organization_id.is_not(None))
        )
        assert conn.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
    assert after == before
    assert still_linked == linked > 0


# --- RV6 around every way migrations run ---------------------------------------


def _pooled_foreign_keys(engine) -> list[int]:
    """Foreign keys on each of several connections, so a reused pooled one is included."""
    connections = [engine.connect() for _ in range(3)]
    try:
        return [c.exec_driver_sql("PRAGMA foreign_keys").scalar() for c in connections]
    finally:
        for c in connections:
            c.close()


def test_foreign_keys_are_back_on_after_migrating(engine):
    """The connection migrations used goes back to the pool; it must enforce links again."""
    seed(engine, TODAY)
    migrate(engine)
    assert _pooled_foreign_keys(engine) == [1, 1, 1]
    with engine.begin() as conn:
        deal_id = conn.scalar(select(deals.c.id).limit(1))
        assert conn.scalar(select(func.count()).where(activities.c.deal_id == deal_id)) > 0
        conn.execute(deals.delete().where(deals.c.id == deal_id))
        # D10: the cascade still runs after a migration.
        assert conn.scalar(select(func.count()).where(activities.c.deal_id == deal_id)) == 0
        assert conn.scalar(select(func.count()).where(stage_changes.c.deal_id == deal_id)) == 0


def test_a_migration_that_breaks_links_is_stopped_and_foreign_keys_come_back(engine):
    import pytest

    from app.db import foreign_keys_off

    seed(engine, TODAY)
    with (
        pytest.raises(RuntimeError, match="broken links"),
        foreign_keys_off(engine) as conn,
        conn.begin(),
    ):
        conn.exec_driver_sql("UPDATE contacts SET organization_id = 999999 WHERE id = 1")
    assert _pooled_foreign_keys(engine) == [1, 1, 1]


def test_a_failed_migration_still_turns_foreign_keys_back_on(engine):
    import pytest

    from app.db import foreign_keys_off

    with pytest.raises(ValueError, match="a migration step failed"), foreign_keys_off(engine):
        raise ValueError("a migration step failed")
    assert _pooled_foreign_keys(engine) == [1, 1, 1]


def test_command_line_upgrade_keeps_data_and_foreign_keys(engine, db_path, monkeypatch):
    """`alembic upgrade head` from a terminal takes the other branch of env.py."""
    from alembic import command
    from alembic.config import Config

    from app.config import REPO_ROOT

    monkeypatch.setenv("ACCOUNTABLE_SIGN_IN", "local")
    seed(engine, TODAY)
    tables = [organizations, contacts, deals, activities, stage_changes]
    with engine.connect() as conn:
        before = {t.name: conn.scalar(select(func.count()).select_from(t)) for t in tables}
    command.upgrade(Config(str(REPO_ROOT / "alembic.ini")), "head")
    with engine.connect() as conn:
        after = {t.name: conn.scalar(select(func.count()).select_from(t)) for t in tables}
    assert after == before
    assert _pooled_foreign_keys(engine) == [1, 1, 1]


# --- TB45: migration 0002, accounts and search ----------------------------------


def _upgrade_to(engine, revision: str) -> None:
    from alembic import command
    from alembic.config import Config

    from app.config import REPO_ROOT
    from app.db import migration_connection

    cfg = Config(str(REPO_ROOT / "alembic.ini"))
    with migration_connection(engine) as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, revision)


def _add_0001_rows(engine) -> None:
    """Rows as the first schema has them: no search_name, no one recorded."""
    org = {"created_at": "2026-11-16 09:00:00", "updated_at": "2026-11-16 09:00:00"}
    with engine.begin() as conn:
        conn.exec_driver_sql(
            "INSERT INTO organizations (id, name, created_at, updated_at) VALUES "
            "(1, 'Élan Studio', :created_at, :updated_at), "
            "(2, 'Große Straße GmbH', :created_at, :updated_at)",
            org,
        )
        conn.exec_driver_sql(
            "INSERT INTO contacts (id, name, status, organization_id, created_at, updated_at) "
            "VALUES (1, 'ADA Park', 'lead', 1, :created_at, :updated_at)",
            org,
        )
        conn.exec_driver_sql(
            "INSERT INTO deals (id, name, organization_id, contact_id, stage, value, "
            "probability, position, created_at, updated_at) VALUES "
            "(1, 'Rebrand ΣΙΣΥΦΟΣ', 1, 1, 'new', 100, 10, 1.0, :created_at, :updated_at)",
            org,
        )
        conn.exec_driver_sql(
            "INSERT INTO activities (type, description, occurred_on, deal_id, done, created_at, "
            "updated_at) VALUES ('call', 'Called', '2026-11-10', 1, 0, :created_at, :updated_at)",
            org,
        )


def test_0002_upgrades_a_database_with_data(db_path):
    from sqlalchemy import inspect

    from app.db import engine_for, users

    engine = engine_for(db_path.resolve())
    _upgrade_to(engine, "0001")
    _add_0001_rows(engine)
    _upgrade_to(engine, "head")

    with engine.connect() as conn:
        search_names = {
            t.name: dict(conn.execute(select(t.c.name, t.c.search_name)).all())
            for t in (organizations, contacts, deals)
        }
        authors = [
            conn.execute(select(t.c.created_by, t.c.updated_by)).all()
            for t in (organizations, contacts, deals, activities)
        ]
        assert conn.scalar(select(func.count()).select_from(activities)) == 1
        assert conn.scalar(select(func.count()).select_from(users)) == 0
        assert conn.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
        assert conn.scalar(select(contacts.c.organization_id)) == 1
    assert search_names == {
        "organizations": {
            "Élan Studio": "élan studio",
            "Große Straße GmbH": "grosse strasse gmbh",
        },
        "contacts": {"ADA Park": "ada park"},
        "deals": {"Rebrand ΣΙΣΥΦΟΣ": "rebrand σισυφοσ"},
    }
    assert all(row == (None, None) for rows in authors for row in rows)
    assert "users" in inspect(engine).get_table_names()


def _postgres_sql(revisions: str, downgrade: bool = False) -> str:
    """The SQL the migrations would run on Postgres, made without a database."""
    import io

    from alembic import command
    from alembic.config import Config

    from app.config import REPO_ROOT

    output = io.StringIO()
    cfg = Config(str(REPO_ROOT / "alembic.ini"), output_buffer=output)
    cfg.set_main_option("sqlalchemy.url", "postgresql+psycopg://")
    run = command.downgrade if downgrade else command.upgrade
    run(cfg, revisions, sql=True)
    return output.getvalue()


def test_0002_as_postgres_sql_turns_on_row_level_security_for_every_table():
    """CN21: with no policies, row level security shuts out Supabase's Data API."""
    sql = _postgres_sql("0001:0002")

    tables = [*metadata.tables, "alembic_version"]
    assert len(tables) == 7
    for table in tables:
        assert f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;" in sql


NAMED_TABLES = ("organizations", "contacts", "deals")


def test_0003_as_postgres_sql_sorts_search_name_by_byte_order():
    """IC9: Postgres orders search_name as SQLite does."""
    upgrade = _postgres_sql("0002:0003")
    downgrade = _postgres_sql("0003:0002", downgrade=True)
    for table in NAMED_TABLES:
        alter = f"ALTER TABLE {table} ALTER COLUMN search_name TYPE"
        assert f'{alter} VARCHAR COLLATE "C";' in upgrade
        assert f"{alter} VARCHAR;" in downgrade


def _sqlite_schema(engine) -> list[tuple[str, str]]:
    with engine.connect() as conn:
        return conn.exec_driver_sql(
            "SELECT name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name"
        ).all()


def test_0003_changes_nothing_on_sqlite(db_path):
    from app.db import engine_for

    engine = engine_for(db_path.resolve())
    _upgrade_to(engine, "0001")
    _add_0001_rows(engine)
    _upgrade_to(engine, "0002")
    before = _sqlite_schema(engine)
    _upgrade_to(engine, "0003")
    with engine.connect() as conn:
        version = conn.exec_driver_sql("SELECT version_num FROM alembic_version").scalar()
        names = conn.execute(select(organizations.c.search_name).order_by(organizations.c.id))
        assert names.scalars().all() == ["élan studio", "grosse strasse gmbh"]
    assert version == "0003"
    assert _sqlite_schema(engine) == before
