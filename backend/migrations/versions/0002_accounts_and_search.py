"""accounts and search

Adds the users table, who added and last changed each organization, contact,
deal and activity (U8), and the search copy of each name (Concern 20).
On Postgres, turns on row level security for every table (Concern 21).

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-24 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import context, op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

NAMED_TABLES = ("organizations", "contacts", "deals")
AUTHORED_TABLES = (*NAMED_TABLES, "activities")
AUTHORSHIP = ("created_by", "updated_by")
# Every table Supabase's Data API would otherwise serve, alembic_version included.
ROW_LEVEL_SECURITY_TABLES = (
    "users",
    "organizations",
    "contacts",
    "deals",
    "activities",
    "stage_changes",
    "alembic_version",
)


def upgrade() -> None:
    _create_users()
    for table in AUTHORED_TABLES:
        with op.batch_alter_table(table) as batch:
            if table in NAMED_TABLES:
                batch.add_column(sa.Column("search_name", sa.String(), nullable=True))
            for column in AUTHORSHIP:
                batch.add_column(sa.Column(column, sa.Integer(), nullable=True))
        if table in NAMED_TABLES:
            _fill_search_names(table)
        _finish_columns(table)
    if op.get_context().dialect.name == "postgresql":
        for table in ROW_LEVEL_SECURITY_TABLES:
            op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def _create_users() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("auth_id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_auth_id", "users", ["auth_id"], unique=True)


def _fill_search_names(table: str) -> None:
    """Fills search_name in Python, so SQLite and Postgres get the same values.
    casefold() here is what rules.search_key does; a migration keeps its own copy
    so that later changes to the app can't change what it did.
    Offline SQL has no rows to read, so it leaves this step out."""
    if context.is_offline_mode():
        return
    rows = sa.table(table, sa.column("id"), sa.column("name"), sa.column("search_name"))
    conn = op.get_bind()
    keys = [
        {"row_id": row_id, "key": name.casefold()}
        for row_id, name in conn.execute(sa.select(rows.c.id, rows.c.name))
    ]
    if keys:
        conn.execute(
            rows.update()
            .where(rows.c.id == sa.bindparam("row_id"))
            .values(search_name=sa.bindparam("key")),
            keys,
        )


def _finish_columns(table: str) -> None:
    """Links, indexes and the required search_name. On SQLite this rebuilds the table."""
    with op.batch_alter_table(table) as batch:
        if table in NAMED_TABLES:
            batch.alter_column("search_name", existing_type=sa.String(), nullable=False)
            batch.create_index(f"ix_{table}_search_name", ["search_name"], unique=False)
        for column in AUTHORSHIP:
            batch.create_foreign_key(
                f"fk_{table}_{column}_users", "users", [column], ["id"], ondelete="SET NULL"
            )
            batch.create_index(f"ix_{table}_{column}", [column], unique=False)


def downgrade() -> None:
    # Row level security stays on: turning it off would open the tables to the Data API.
    for table in reversed(AUTHORED_TABLES):
        with op.batch_alter_table(table) as batch:
            for column in AUTHORSHIP:
                batch.drop_index(f"ix_{table}_{column}")
                batch.drop_constraint(f"fk_{table}_{column}_users", type_="foreignkey")
                batch.drop_column(column)
            if table in NAMED_TABLES:
                batch.drop_index(f"ix_{table}_search_name")
                batch.drop_column("search_name")
    op.drop_index("ix_users_auth_id", table_name="users")
    op.drop_table("users")
