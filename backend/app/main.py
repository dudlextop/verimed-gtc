import re
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app.api import router
from app.config import settings
from app.database import Base, SessionLocal, engine

IMMUTABLE_GET_PATHS = {
    "/api/analytics/summary",
    "/api/analytics/changes",
    "/api/analytics/risk-distribution",
    "/api/analytics/timeline",
    "/api/analytics/key-findings",
    "/api/analytics/financial-impact",
    "/api/analytics/pattern-changes",
    "/api/analysis/metrics",
    "/api/analysis/metrics/by-anomaly-type",
    "/api/methodology",
}
IMMUTABLE_GET_PATTERNS = (
    re.compile(r"^/api/organizations/\d+/(comparison|financial-impact|priority-history)$"),
    re.compile(r"^/api/patterns/\d+/(graph|timeline)$"),
)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if settings.bootstrap_database_on_start:
        from app.seed import seed_database

        Base.metadata.create_all(engine)
        with SessionLocal() as db:
            seed_database(db)
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.middleware("http")
async def public_cache_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    path = request.url.path
    cacheable = path in IMMUTABLE_GET_PATHS or any(
        pattern.match(path) for pattern in IMMUTABLE_GET_PATTERNS
    )
    if request.method == "GET" and response.status_code == 200 and cacheable:
        response.headers["Cache-Control"] = (
            "public, max-age=60, s-maxage=300, stale-while-revalidate=86400"
        )
        response.headers["Vary"] = "Accept-Encoding"
    elif request.method != "GET" or path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.exception_handler(Exception)
async def unexpected_error(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500, content={"detail": "Не удалось обработать запрос. Повторите попытку."}
    )
