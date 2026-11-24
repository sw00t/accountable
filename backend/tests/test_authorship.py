"""TB50: who added and last changed each record (U8 to U10, Concern 18).
Also checks search_name on adding and renaming, which TB51 covers in full."""

import pytest
from conftest import Api, signed_in
from sqlalchemy import insert, select

from app.auth import Claims
from app.db import activities, contacts, deals, organizations, users
from app.routers.deals import renumber_column

TEST_USER = "Test User"
SAM = "Sam Lee"


@pytest.fixture
def sam(second_client):
    return Api(second_client)


def credited(conn, table, record_id):
    """Who added and who last changed a row, by name."""
    adder, changer = users.alias(), users.alias()
    row = conn.execute(
        select(adder.c.name, changer.c.name)
        .select_from(
            table.outerjoin(adder, adder.c.id == table.c.created_by).outerjoin(
                changer, changer.c.id == table.c.updated_by
            )
        )
        .where(table.c.id == record_id)
    ).one()
    return tuple(row)


def records(api):
    org = api.org()
    contact = api.contact(organization_id=org["id"])
    deal = api.deal(org["id"], contact_id=contact["id"])
    return org, contact, deal


def page(api, kind, record_id):
    return api.ok("GET", f"/api/{kind}/{record_id}")


def authors(record):
    return record["added_by"], record["changed_by"]


def test_adding_credits_both(api, conn):
    org, contact, deal = records(api)
    activity = api.activity(contact_id=contact["id"])
    for record in (org, contact, deal):
        assert authors(record) == (TEST_USER, TEST_USER)
    assert credited(conn, activities, activity["id"]) == (TEST_USER, TEST_USER)


def test_lists_show_who_added_each_row(api):
    org, _, _ = records(api)
    assert authors(api.ok("GET", "/api/organizations")["items"][0]) == (TEST_USER, TEST_USER)
    assert authors(api.ok("GET", "/api/contacts")["items"][0]) == (TEST_USER, TEST_USER)
    assert authors(api.ok("GET", "/api/deals")["items"][0]) == (TEST_USER, TEST_USER)
    detail = page(api, "organizations", org["id"])
    assert authors(detail["contacts"][0]) == (TEST_USER, TEST_USER)
    assert authors(detail["deals"][0]) == (TEST_USER, TEST_USER)


def test_editing_credits_who_last_changed(api, sam, conn):
    org, contact, deal = records(api)
    activity = api.activity(contact_id=contact["id"])
    sam.ok("PATCH", f"/api/organizations/{org['id']}", json={"industry": "Retail"})
    sam.ok("PATCH", f"/api/contacts/{contact['id']}", json={"phone": "555"})
    sam.ok("PATCH", f"/api/deals/{deal['id']}", json={"value": 2000})
    sam.ok("PATCH", f"/api/activities/{activity['id']}", json={"description": "Emailed"})
    assert authors(page(api, "organizations", org["id"])) == (TEST_USER, SAM)
    assert authors(page(api, "contacts", contact["id"])) == (TEST_USER, SAM)
    assert authors(page(api, "deals", deal["id"])) == (TEST_USER, SAM)
    assert credited(conn, activities, activity["id"]) == (TEST_USER, SAM)


def test_moving_on_the_board_credits_who_last_changed(api, sam):
    org = api.org()
    deal = api.deal(org["id"])
    moved = sam.move(deal["id"], "qualified")
    assert authors(moved) == (TEST_USER, SAM)


def test_marking_done_credits_who_last_changed(api, sam, conn):
    contact = api.contact()
    activity = api.activity(contact_id=contact["id"], follow_up_on="2026-11-20")
    sam.ok("PATCH", f"/api/activities/{activity['id']}", json={"done": True})
    assert credited(conn, activities, activity["id"]) == (TEST_USER, SAM)


@pytest.mark.parametrize("how", ["move", "edit", "add"])
def test_winning_credits_the_contacts_change_to_the_winner(api, sam, how):
    """D5 makes the contact a customer; that change is the winner's."""
    org = api.org()
    contact = api.contact(organization_id=org["id"])
    if how == "add":
        sam.deal(org["id"], contact_id=contact["id"], stage="won")
    else:
        deal = api.deal(org["id"], contact_id=contact["id"])
        if how == "move":
            sam.move(deal["id"], "won")
        else:
            sam.ok("PATCH", f"/api/deals/{deal['id']}", json={"stage": "won"})
    after = page(api, "contacts", contact["id"])
    assert after["status"] == "customer"
    assert authors(after) == (TEST_USER, SAM)


def test_deleting_an_organization_is_no_change_to_its_records(api, sam):
    """O4 clears the link in the database, which credits no one."""
    org, contact, deal = records(api)
    sam.ok("DELETE", f"/api/organizations/{org['id']}", 204)
    for kind, before in (("contacts", contact), ("deals", deal)):
        after = page(api, kind, before["id"])
        assert after["organization_id"] is None
        assert authors(after) == (TEST_USER, TEST_USER)
        assert after["updated_at"] == before["updated_at"]


def test_deleting_a_contact_is_no_change_to_their_deals(api, sam):
    """C6 clears the deal's main contact in the database, which credits no one."""
    _, contact, deal = records(api)
    sam.ok("DELETE", f"/api/contacts/{contact['id']}", 204)
    after = page(api, "deals", deal["id"])
    assert after["contact_id"] is None
    assert authors(after) == (TEST_USER, TEST_USER)
    assert after["updated_at"] == deal["updated_at"]


def test_renumbering_a_column_is_no_change_to_its_deals(api, conn):
    org = api.org()
    deal = api.deal(org["id"])
    renumber_column(conn, "new")
    conn.commit()
    assert page(api, "deals", deal["id"])["updated_at"] == deal["updated_at"]


def test_a_person_with_no_display_name_shows_as_their_email(engine):
    nameless = Api(signed_in(Claims(auth_id="no-name", email="pat@example.com", name=None)))
    org = nameless.org()
    assert authors(org) == ("pat@example.com", "pat@example.com")


def test_a_record_with_no_one_recorded_shows_sample_data(api, conn):
    """Concern 18: sample data, and anything added before sign-in existed."""
    org_id = conn.execute(
        insert(organizations)
        .values(name="Old Co", search_name="old co")
        .returning(organizations.c.id)
    ).scalar_one()
    conn.commit()
    assert authors(page(api, "organizations", org_id)) == ("Sample data", "Sample data")


def test_timeline_activities_show_who_added_them(api, sam):
    org = api.org()
    deal = api.deal(org["id"])
    sam.activity("Sam's call", deal_id=deal["id"])
    items = api.ok("GET", f"/api/deals/{deal['id']}/timeline")["items"]
    by_kind = {item["kind"]: item["added_by"] for item in items}
    assert by_kind == {"activity": SAM, "stage_change": None}


def test_adding_and_renaming_set_the_search_name(api, conn):
    org, contact, deal = records(api)
    for kind, table, record in (
        ("organizations", organizations, org),
        ("contacts", contacts, contact),
        ("deals", deals, deal),
    ):
        assert conn.scalar(select(table.c.search_name).where(table.c.id == record["id"])) == (
            record["name"].casefold()
        )
        api.ok("PATCH", f"/api/{kind}/{record['id']}", json={"name": "Élan Straße"})
        conn.rollback()  # see the committed rename, not this connection's earlier snapshot
        assert conn.scalar(select(table.c.search_name).where(table.c.id == record["id"])) == (
            "élan strasse"
        )
