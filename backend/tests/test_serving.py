"""TB53: the backend serves the built frontend beside the API (G13)."""

import pytest

from app import config

INDEX = "<!doctype html><title>Accountable</title>"
SCRIPT = "console.log('app')"


@pytest.fixture
def built(tmp_path, monkeypatch):
    """A built frontend in a temporary folder, with a secret file just outside it."""
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text(INDEX)
    (dist / "assets" / "app.js").write_text(SCRIPT)
    (tmp_path / "secret.txt").write_text("not for the browser")
    monkeypatch.setattr(config, "FRONTEND_DIST", dist)
    return dist


def test_files_are_served_by_their_path(signed_out_client, built):
    response = signed_out_client.get("/assets/app.js")
    assert response.status_code == 200
    assert response.text == SCRIPT
    assert "javascript" in response.headers["content-type"]


@pytest.mark.parametrize("path", ["/", "/deals/12", "/organizations/3/edit"])
def test_other_pages_get_index_html(signed_out_client, built, path):
    response = signed_out_client.get(path)
    assert response.status_code == 200
    assert response.text == INDEX


def test_no_file_outside_the_built_frontend_is_served(signed_out_client, built):
    # Encoded, so the client sends the dots as they are and the server decodes them.
    response = signed_out_client.get("/assets/%2E%2E/%2E%2E/secret.txt")
    assert response.text == INDEX


def test_an_unknown_api_path_still_gets_the_json_404(signed_out_client, built):
    response = signed_out_client.get("/api/nothing-here")
    assert response.status_code == 404
    assert response.json() == {
        "message": "We couldn't find that page in Accountable.",
        "fields": {},
    }


def test_the_api_still_needs_sign_in(signed_out_client, built):
    assert signed_out_client.get("/api/organizations").status_code == 401


def test_pages_are_not_found_when_the_frontend_isnt_built(signed_out_client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "FRONTEND_DIST", tmp_path / "not-built")
    response = signed_out_client.get("/deals/12")
    assert response.status_code == 404
    assert response.json()["message"] == "We couldn't find that page in Accountable."
