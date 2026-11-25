"""Search across organizations, contacts and deals (F2, F3, Concern 20).

Only portable SQL here, so SQLite in the tests behaves as Postgres does.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import ColumnElement, Connection, Select, Table, case, func, select

from app.db import contacts, deals, organizations
from app.deps import Conn
from app.rules import Stage, search_key

router = APIRouter(tags=["search"])

GROUP_SIZE = 5


class OrganizationResult(BaseModel):
    id: int
    name: str
    industry: str | None


class ContactResult(BaseModel):
    id: int
    name: str
    organization_name: str | None


class DealResult(BaseModel):
    id: int
    name: str
    organization_name: str | None
    stage: Stage


class OrganizationResults(BaseModel):
    items: list[OrganizationResult]
    total: int


class ContactResults(BaseModel):
    items: list[ContactResult]
    total: int


class DealResults(BaseModel):
    items: list[DealResult]
    total: int


class SearchResults(BaseModel):
    """Up to GROUP_SIZE of each kind, with how many match in all."""

    organizations: OrganizationResults
    contacts: ContactResults
    deals: DealResults


def _matching(table: Table, text: str, *columns: ColumnElement) -> Select:
    """Names containing `text`, starting with it first, then alphabetical.
    autoescape makes % and _ match only themselves, with an explicit ESCAPE."""
    search_name = table.c.search_name
    starts_first = case((search_name.startswith(text, autoescape=True), 0), else_=1)
    return (
        select(table.c.id, table.c.name, *columns, func.count().over().label("total"))
        .where(search_name.contains(text, autoescape=True))
        .order_by(starts_first, search_name, table.c.id)
        .limit(GROUP_SIZE)
    )


def _group(conn: Connection, query: Select) -> tuple[list[dict], int]:
    """The rows and the group's total. The result models ignore each row's own copy of it."""
    rows = conn.execute(query).mappings().all()
    return [dict(row) for row in rows], rows[0]["total"] if rows else 0


def _organizations(conn: Connection, text: str) -> OrganizationResults:
    items, total = _group(conn, _matching(organizations, text, organizations.c.industry))
    return OrganizationResults(items=[OrganizationResult(**item) for item in items], total=total)


def _contacts(conn: Connection, text: str) -> ContactResults:
    query = _matching(contacts, text, organizations.c.name.label("organization_name")).select_from(
        contacts.outerjoin(organizations, organizations.c.id == contacts.c.organization_id)
    )
    items, total = _group(conn, query)
    return ContactResults(items=[ContactResult(**item) for item in items], total=total)


def _deals(conn: Connection, text: str) -> DealResults:
    query = _matching(
        deals, text, organizations.c.name.label("organization_name"), deals.c.stage
    ).select_from(deals.outerjoin(organizations, organizations.c.id == deals.c.organization_id))
    items, total = _group(conn, query)
    return DealResults(items=[DealResult(**item) for item in items], total=total)


def _nothing_found() -> SearchResults:
    return SearchResults(
        organizations=OrganizationResults(items=[], total=0),
        contacts=ContactResults(items=[], total=0),
        deals=DealResults(items=[], total=0),
    )


@router.get("/search")
def search(conn: Conn, q: str = "") -> SearchResults:
    """F3: results start at one character, so blank text finds nothing."""
    text = search_key(q.strip())
    if not text:
        return _nothing_found()
    return SearchResults(
        organizations=_organizations(conn, text),
        contacts=_contacts(conn, text),
        deals=_deals(conn, text),
    )
