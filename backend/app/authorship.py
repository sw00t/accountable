"""Who added and last changed a record (U8), and the names shown for them (U9)."""

from typing import Any

from sqlalchemy import FromClause, Label, Table

from app import rules
from app.auth import User
from app.db import users


def added(person: User) -> dict[str, int]:
    """Adding a record credits both who added it and who last changed it."""
    return {"created_by": person.id, "updated_by": person.id}


def changed(person: User) -> dict[str, int]:
    return {"updated_by": person.id}


class Authors:
    """The `users` rows behind a table's `created_by` and `updated_by`, joined for their names."""

    def __init__(self, table: Table):
        self.table = table
        self.adder = users.alias(f"{table.name}_adder")
        self.changer = users.alias(f"{table.name}_changer")

    def columns(self) -> list[Label]:
        return [
            self.adder.c.name.label("added_by_name"),
            self.adder.c.email.label("added_by_email"),
            self.changer.c.name.label("changed_by_name"),
            self.changer.c.email.label("changed_by_email"),
        ]

    def join(self, from_clause: FromClause) -> FromClause:
        return from_clause.outerjoin(
            self.adder, self.adder.c.id == self.table.c.created_by
        ).outerjoin(self.changer, self.changer.c.id == self.table.c.updated_by)


def with_names(row: dict[str, Any]) -> dict[str, Any]:
    """A row read with Authors.columns, plus the names to show for who added and changed it."""
    return {
        **row,
        "added_by": rules.shown_name(row["added_by_name"], row["added_by_email"]),
        "changed_by": rules.shown_name(row["changed_by_name"], row["changed_by_email"]),
    }
