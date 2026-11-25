"""render.yaml describes the Render web service G16 asks for, so it can't drift silently."""

import pytest
import yaml

from app.config import REPO_ROOT

SETTINGS = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]


@pytest.fixture(scope="module")
def service() -> dict:
    blueprint = yaml.safe_load((REPO_ROOT / "render.yaml").read_text())
    [web] = blueprint["services"]
    return web


def test_it_is_one_web_service_on_the_free_plan(service):
    assert service["type"] == "web"
    assert service["plan"] == "free"


def test_it_builds_the_frontend_and_starts_with_npm_starts_script(service):
    assert "npm run build" in service["buildCommand"]
    assert service["startCommand"] == "node scripts/start.mjs"


def test_render_checks_the_health_route(service):
    assert service["healthCheckPath"] == "/api/health"


def test_the_three_settings_are_named_without_values(service):
    settings = {var["key"]: var for var in service["envVars"] if var["key"] in SETTINGS}
    assert sorted(settings) == sorted(SETTINGS)
    for var in settings.values():
        assert var == {"key": var["key"], "sync": False}


def test_local_sign_in_is_never_set(service):
    assert "ACCOUNTABLE_SIGN_IN" not in {var["key"] for var in service["envVars"]}
