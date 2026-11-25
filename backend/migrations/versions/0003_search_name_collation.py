"""search name collation

On Postgres, search_name sorts by byte order ("C"), as it does on SQLite (IC9).
A language collation skips spaces, so "bankside" came before "banks ltd".
SQLite already compares bytes, so nothing changes there.
Changing a column's type makes Postgres rebuild its indexes, which then use the new collation.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-24 15:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

NAMED_TABLES = ("organizations", "contacts", "deals")


def upgrade() -> None:
    _set_search_name_type(sa.String(collation="C"), was=sa.String())


def downgrade() -> None:
    _set_search_name_type(sa.String(), was=sa.String(collation="C"))


def _set_search_name_type(type_: sa.String, was: sa.String) -> None:
    if op.get_context().dialect.name != "postgresql":
        return
    for table in NAMED_TABLES:
        op.alter_column(
            table, "search_name", type_=type_, existing_type=was, existing_nullable=False
        )
