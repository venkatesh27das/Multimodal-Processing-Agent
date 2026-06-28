from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from time import perf_counter

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette import status

from backend.app.api.routes import (
    agent_skills,
    assets,
    dashboard,
    files,
    health,
    jobs,
    mcp,
    observability,
    parsers,
    skills,
)
from backend.app.core.config import settings
from backend.app.core.logging import configure_logging, get_logger
from backend.app.db.init_db import init_db

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    configure_logging(settings.log_level)
    logger.info("Starting %s %s", settings.app_name, settings.app_version)
    init_db()
    yield
    logger.info("Stopping %s", settings.app_name)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Enterprise multimodal parsing orchestration API.",
        openapi_url=f"{settings.api_prefix}/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        started_at = perf_counter()
        response = await call_next(request)
        duration_ms = int((perf_counter() - started_at) * 1000)
        logger.info(
            "request method=%s path=%s status=%s duration_ms=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        response.headers["X-Process-Time-Ms"] = str(duration_ms)
        return response

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        logger.warning("request validation failed errors=%s", exc.errors())
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Request validation failed", "errors": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def unexpected_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unexpected error path=%s", request.url.path, exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )

    app.include_router(health.router, prefix=settings.api_prefix, tags=["health"])
    app.include_router(assets.router, prefix=settings.api_prefix, tags=["assets"])
    app.include_router(files.router, prefix=settings.api_prefix, tags=["files"])
    app.include_router(agent_skills.router, prefix=settings.api_prefix, tags=["skills"])
    app.include_router(jobs.router, prefix=settings.api_prefix, tags=["jobs"])
    app.include_router(jobs.planning_router, prefix=settings.api_prefix, tags=["jobs"])
    app.include_router(dashboard.router, prefix=settings.api_prefix, tags=["dashboard"])
    app.include_router(dashboard.review_router, prefix=settings.api_prefix, tags=["review"])
    app.include_router(mcp.router, prefix=settings.api_prefix, tags=["mcp"])
    app.include_router(
        observability.observability_router,
        prefix=settings.api_prefix,
        tags=["observability"],
    )
    app.include_router(observability.audit_router, prefix=settings.api_prefix, tags=["audit"])
    app.include_router(parsers.router, prefix=settings.api_prefix, tags=["parser-registry"])
    app.include_router(parsers.metrics_router, prefix=settings.api_prefix, tags=["parsers"])
    app.include_router(skills.router, prefix=settings.api_prefix, tags=["skills-registry"])

    return app


app = create_app()
