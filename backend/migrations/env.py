"""Alembic environment. Runs against the connection the backend hands over, or,
from the command line, against the database the sign-in mode chooses (app_engine).
Offline (`--sql`), it writes SQL for the URL in the sqlalchemy.url option, or for
the mode's database when that option isn't set."""

from alembic import context

from app.db import app_engine, metadata, migration_connection

target_metadata = metadata


def run_offline() -> None:
    url = context.config.get_main_option("sqlalchemy.url") or app_engine().url
    context.configure(
        url=url, target_metadata=target_metadata, literal_binds=True, render_as_batch=True
    )
    with context.begin_transaction():
        context.run_migrations()


def run_online() -> None:
    connection = context.config.attributes.get("connection")
    if connection is not None:
        run_on(connection)
        return
    with migration_connection(app_engine()) as conn:
        run_on(conn)


def run_on(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_offline()
else:
    run_online()
