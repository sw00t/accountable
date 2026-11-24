"""TB54: the backend answers only this computer's names and, on Render, the app's own address (G6)."""

import pytest

RENDER_HOST = "accountable.onrender.com"


def test_the_render_host_is_answered_when_render_names_it(client, monkeypatch):
    monkeypatch.setenv("RENDER_EXTERNAL_HOSTNAME", RENDER_HOST)
    assert client.get("/api/organizations", headers={"Host": RENDER_HOST}).status_code == 200


def test_the_render_host_is_refused_when_render_doesnt_name_it(client):
    assert client.get("/api/health", headers={"Host": RENDER_HOST}).status_code == 400


@pytest.mark.parametrize(
    "host", ["evil.example.com", "other.onrender.com", f"{RENDER_HOST}.evil.example.com"]
)
def test_other_hosts_are_still_refused_on_render(client, monkeypatch, host):
    monkeypatch.setenv("RENDER_EXTERNAL_HOSTNAME", RENDER_HOST)
    refused = client.get("/api/health", headers={"Host": host})
    assert refused.status_code == 400
    assert refused.json()["fields"] == {}


def test_this_computer_is_still_answered_on_render(client, monkeypatch):
    monkeypatch.setenv("RENDER_EXTERNAL_HOSTNAME", RENDER_HOST)
    assert client.get("/api/health", headers={"Host": "127.0.0.1:8000"}).status_code == 200
