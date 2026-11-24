"""`npm run seed:supabase` (G15): loads the sample data into the Supabase database at DATABASE_URL.

It says how many records are there now and deletes them only when the person types "yes".
The users table is kept, so everyone can still sign in.
DATABASE_URL is never printed, since it holds the database password (R16).
"""

import sys
from collections.abc import Callable

from sqlalchemy import Engine, inspect
from sqlalchemy.exc import OperationalError

from app import config
from app.db import (
    activities,
    contacts,
    count_rows,
    deals,
    migrate,
    organizations,
    postgres_engine_for,
)
from app.seed import load_sample_data

# Each table with how one record and several are named.
COUNTED = (
    (organizations, "organization", "organizations"),
    (contacts, "contact", "contacts"),
    (deals, "deal", "deals"),
    (activities, "activity", "activities"),
)
QUESTION = 'Type "yes" to delete them and load the sample data: '
UNREACHABLE = (
    "Accountable couldn't reach the Supabase database. Check that DATABASE_URL in .env is the "
    "project's session pooler connection string, and that the project isn't paused in Supabase."
)


def describe(engine: Engine) -> str:
    """The records there now, such as "12 organizations, 1 contact, 0 deals and 120 activities".
    A database that has never been migrated has none."""
    tables = set(inspect(engine).get_table_names())
    with engine.connect() as conn:
        counts = [
            (count_rows(conn, table) if table.name in tables else 0, one, many)
            for table, one, many in COUNTED
        ]
    parts = [f"{n} {one if n == 1 else many}" for n, one, many in counts]
    return ", ".join(parts[:-1]) + " and " + parts[-1]


def ask(question: str) -> str:
    """The person's answer, or nothing when the input ends."""
    try:
        return input(question)
    except EOFError:
        print()
        return ""


def load(engine: Engine, answer: Callable[[str], str] = ask) -> bool:
    """Ask first, then migrate and load the sample data. True when it was loaded."""
    print(f"The Supabase database has {describe(engine)}.")
    if answer(QUESTION).strip().lower() != "yes":
        print("Nothing was changed.")
        return False
    migrate(engine)
    with engine.begin() as conn:
        load_sample_data(conn, config.server_today())
    print("The sample data is loaded. Everyone who could sign in still can.")
    return True


def main() -> None:
    url = config.settings().database_url
    if url is None:
        sys.exit("npm run seed:supabase needs DATABASE_URL. Add it to .env.")
    try:
        load(postgres_engine_for(url))
    except OperationalError:
        sys.exit(UNREACHABLE)
    except KeyboardInterrupt:
        sys.exit("\nStopped before the sample data was loaded.")


if __name__ == "__main__":
    main()
