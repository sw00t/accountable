"""The FastAPI app: routers, error handlers, startup and serving the built frontend."""

import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.datastructures import Headers
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import config
from app.auth import SIGN_IN_MESSAGE
from app.db import app_engine, migrate
from app.deps import get_person
from app.routers import (
    account,
    activities,
    contacts,
    dashboard,
    deals,
    health,
    organizations,
    search,
    timeline,
)
from app.schemas import MESSAGES, FieldErrors, NotFound

log = logging.getLogger("accountable")

GENERAL_ERROR = (
    "Something went wrong in Accountable. Try again, and if it keeps happening, restart the app."
)


def start_database() -> None:
    """Check the settings, migrate (G12), then fill a brand-new SQLite file with the sample data (G4).
    Postgres is never filled here: that's `npm run seed:supabase` (G15)."""
    settings = config.settings()
    settings.check()
    is_new = settings.local and not config.db_path().exists()
    engine = app_engine()
    migrate(engine)
    if is_new:
        from app.seed import seed

        seed(engine, config.server_today())


@asynccontextmanager
async def lifespan(_app: FastAPI):
    start_database()
    yield


app = FastAPI(title="Accountable", version="0.1.0", lifespan=lifespan)

# Only answer requests addressed to this computer or to the app's own address on Render,
# so a web page that points its own domain name at the backend (DNS rebinding) can't read
# or change the data (RV10, G6).
# The Vite proxy sends Host 127.0.0.1; "testserver" is FastAPI's test client.
LOCAL_HOSTS = {"127.0.0.1", "localhost"}
WRONG_HOST = "Accountable only answers requests made on this computer."


def allowed_hosts() -> set[str]:
    """Read on each request, so the tests can name a Render host."""
    render_host = config.settings().render_host
    return (
        LOCAL_HOSTS
        | ({render_host} if render_host else set())
        | ({"testserver"} if config.testing() else set())
    )


class KnownHostsOnly:
    """Like Starlette's TrustedHostMiddleware, but the refusal uses the API's usual
    error shape (spec: errors are {"message", "fields"})."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            host = Headers(scope=scope).get("host", "").split(":")[0]
            if host not in allowed_hosts():
                if scope["type"] == "websocket":
                    await send({"type": "websocket.close", "code": 1008})
                else:
                    response = JSONResponse(
                        status_code=400, content={"message": WRONG_HOST, "fields": {}}
                    )
                    await response(scope, receive, send)
                return
        await self.app(scope, receive, send)


app.add_middleware(KnownHostsOnly)

API = "/api"
SIGNED_IN = [Depends(get_person)]
app.include_router(health.router, prefix=API)
app.include_router(account.router, prefix=API)
if config.settings().local:
    app.include_router(account.local_auth, prefix=API)
for module in (organizations, contacts, deals, activities, timeline, dashboard, search):
    app.include_router(module.router, prefix=API, dependencies=SIGNED_IN)

if config.testing():
    from app.routers import testing

    app.include_router(testing.router, prefix=API)


# --- Errors (G8, V4) ------------------------------------------------------


def _field_name(loc: tuple) -> str:
    parts = [str(p) for p in loc if p not in ("body", "query", "path", "header")]
    return parts[0] if parts else ""


@app.exception_handler(RequestValidationError)
async def on_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    # A record id in the URL that can't exist (not a number, or too large) is
    # simply not found, like a deleted one (RV11).
    if exc.errors() and all(tuple(e.get("loc", ()))[:1] == ("path",) for e in exc.errors()):
        return JSONResponse(
            status_code=404,
            content={
                "message": "We couldn't find that record. It may have been deleted.",
                "fields": {},
            },
        )
    fields: dict[str, str] = {}
    for error in exc.errors():
        field = _field_name(tuple(error.get("loc", ())))
        if not field or field in fields:
            continue
        if error.get("type") == "value_error":
            message = str(error.get("ctx", {}).get("error", "")) or MESSAGES.get(
                field, "Check this field."
            )
        else:
            message = MESSAGES.get(field, "Check this field.")
        fields[field] = message
    if not fields:
        return JSONResponse(
            status_code=400,
            content={
                "message": "Accountable couldn't read that request. Try again.",
                "fields": {},
            },
        )
    return JSONResponse(
        status_code=400,
        content={
            "message": "Check the highlighted fields and try again.",
            "fields": fields,
        },
    )


@app.exception_handler(FieldErrors)
async def on_field_errors(_request: Request, exc: FieldErrors) -> JSONResponse:
    return JSONResponse(status_code=400, content={"message": exc.message, "fields": exc.fields})


@app.exception_handler(NotFound)
async def on_not_found(_request: Request, exc: NotFound) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={
            "message": f"We couldn't find that {exc.kind}. It may have been deleted.",
            "fields": {},
        },
    )


@app.exception_handler(StarletteHTTPException)
async def on_http_error(request: Request, exc: StarletteHTTPException) -> Response:
    if exc.status_code == 404 and (page := frontend_file(request)):
        return FileResponse(page)
    if exc.status_code == 401:
        message = SIGN_IN_MESSAGE
    elif exc.status_code == 404:
        message = "We couldn't find that page in Accountable."
    elif exc.status_code == 405:
        message = "Accountable can't do that here."
    else:
        message = GENERAL_ERROR
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": message, "fields": {}},
        headers=exc.headers,
    )


# --- The built frontend (G13) ----------------------------------------------


def frontend_file(request: Request) -> Path | None:
    """The built frontend's file for a request no route answered: the file at that path, or index.html.
    index.html lets a link to a record open after a refresh.
    None for /api paths, for other methods, and when the frontend isn't built (npm run dev)."""
    path = request.url.path
    if request.method not in ("GET", "HEAD") or path == API or path.startswith(API + "/"):
        return None
    dist = config.settings().frontend_dist.resolve()
    file = (dist / path.lstrip("/")).resolve()
    if file.is_file() and file.is_relative_to(dist):
        return file
    index = dist / "index.html"
    return index if index.is_file() else None


@app.exception_handler(Exception)
async def on_unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
    log.exception("Unexpected error", exc_info=exc)
    return JSONResponse(status_code=500, content={"message": GENERAL_ERROR, "fields": {}})


if __name__ == "__main__":
    # `uv run python -m app.main` prints the OpenAPI schema, used by `npm run types`.
    print(json.dumps(app.openapi(), indent=2))
