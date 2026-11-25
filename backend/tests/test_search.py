"""TB51: every name write sets search_name. TB52: search by part of a name (F2, F3, Concern 20)."""

import pytest
from conftest import TODAY
from sqlalchemy import select

from app.db import contacts, deals, organizations
from app.rules import search_key
from app.seed import seed

GROUPS = ("organizations", "contacts", "deals")


def search(api, text: str | None) -> dict:
    params = {} if text is None else {"q": text}
    return api.ok("GET", "/api/search", params=params)


def names(results: dict, group: str) -> list[str]:
    return [item["name"] for item in results[group]["items"]]


def add(api, kind: str, name: str) -> dict:
    if kind == "organizations":
        return api.org(name)
    if kind == "contacts":
        return api.contact(name)
    return api.deal(api.org("Host Co")["id"], name)


TABLES = {"organizations": organizations, "contacts": contacts, "deals": deals}


def stored_search_name(conn, kind: str, record_id: int) -> str:
    conn.rollback()  # see what the API committed, not this connection's earlier snapshot
    table = TABLES[kind]
    return conn.scalar(select(table.c.search_name).where(table.c.id == record_id))


# --- TB51: search_name on every name write ------------------------------------


@pytest.mark.parametrize("kind", GROUPS)
def test_adding_a_record_sets_its_search_name(api, conn, kind):
    record = add(api, kind, "Élan Straße")
    assert stored_search_name(conn, kind, record["id"]) == "élan strasse"
    assert names(search(api, "STRASSE"), kind) == ["Élan Straße"]


@pytest.mark.parametrize("kind", GROUPS)
def test_renaming_a_record_updates_its_search_name(api, conn, kind):
    record = add(api, kind, "Old Name")
    api.ok("PATCH", f"/api/{kind}/{record['id']}", json={"name": "Élan Straße"})
    assert stored_search_name(conn, kind, record["id"]) == "élan strasse"
    assert names(search(api, "straße"), kind) == ["Élan Straße"]
    assert search(api, "old name")[kind]["total"] == 0


def test_the_sample_data_has_search_names(engine, api):
    seed(engine, TODAY)
    with engine.connect() as conn:
        for table in TABLES.values():
            for name, search_name in conn.execute(select(table.c.name, table.c.search_name)):
                assert search_name == search_key(name)
    results = search(api, "garcia")
    assert names(results, "organizations") == ["Garcia Freight"]
    assert names(results, "contacts") == ["Sabrina Garcia"]
    assert names(results, "deals") == ["Garcia data migration", "Garcia hardware refresh"]


# --- TB52: what search finds -----------------------------------------------------


def test_finds_part_of_a_name_in_any_case_in_every_group(api):
    org = api.org("Northwind Traders", industry="Retail")
    api.contact("Ada Northwind", organization_id=org["id"])
    api.deal(org["id"], "Northwind renewal", stage="proposal")
    api.org("Southwind Co")
    results = search(api, "RTHWIND")
    assert results["organizations"] == {
        "items": [{"id": org["id"], "name": "Northwind Traders", "industry": "Retail"}],
        "total": 1,
    }
    contact = results["contacts"]["items"][0]
    assert contact["name"] == "Ada Northwind"
    assert contact["organization_name"] == "Northwind Traders"
    deal = results["deals"]["items"][0]
    assert (deal["name"], deal["organization_name"], deal["stage"]) == (
        "Northwind renewal",
        "Northwind Traders",
        "proposal",
    )


def test_records_with_no_organization_say_so(api):
    api.contact("Solo Person")
    assert search(api, "solo")["contacts"]["items"][0]["organization_name"] is None


@pytest.mark.parametrize("text", ["élan", "ÉLAN", "Élan"])
def test_accented_letters_ignore_case(api, text):
    api.org("Élan Studio")
    assert names(search(api, text), "organizations") == ["Élan Studio"]


def test_spaces_at_the_ends_are_ignored(api):
    api.org("Acme Ltd")
    assert names(search(api, "  me l \t"), "organizations") == ["Acme Ltd"]


@pytest.mark.parametrize(
    ("text", "found"),
    [("%", "50% Off"), ("_", "A_B Co"), ("/", "A/B Co"), ("0%", "50% Off")],
)
def test_wildcards_match_only_themselves(api, text, found):
    for name in ("50% Off", "A_B Co", "A/B Co", "Plain Co"):
        api.org(name)
    assert names(search(api, text), "organizations") == [found]


def test_names_starting_with_the_text_come_first_then_alphabetical(api):
    for name in ("Zed Bank", "Bankside", "Alpha Bank", "bankcorp"):
        api.org(name)
    assert names(search(api, "bank"), "organizations") == [
        "bankcorp",
        "Bankside",
        "Alpha Bank",
        "Zed Bank",
    ]


def test_each_group_shows_five_with_the_full_count(api):
    for first in ("Ann", "Ben", "Cai", "Dee", "Eve", "Fay", "Gus"):
        api.contact(f"{first} Kim")
    results = search(api, "kim")
    assert names(results, "contacts") == ["Ann Kim", "Ben Kim", "Cai Kim", "Dee Kim", "Eve Kim"]
    assert results["contacts"]["total"] == 7
    assert results["organizations"] == {"items": [], "total": 0}


@pytest.mark.parametrize("text", [None, "", "   "])
def test_blank_text_finds_nothing(api, text):
    api.org("Acme Ltd")
    results = search(api, text)
    assert all(results[group] == {"items": [], "total": 0} for group in GROUPS)


def test_search_needs_sign_in(signed_out_client):
    response = signed_out_client.get("/api/search", params={"q": "a"})
    assert response.status_code == 401
