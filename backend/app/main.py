from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes import (
    agent_skills,
    assets,
    files,
    health,
    jobs,
    mcp,
    observability,
    parsers,
    skills,
)
from backend.app.core.config import settings
from backend.app.db.init_db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


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

    app.include_router(health.router, prefix=settings.api_prefix, tags=["health"])
    app.include_router(assets.router, prefix=settings.api_prefix, tags=["assets"])
    app.include_router(files.router, prefix=settings.api_prefix, tags=["files"])
    app.include_router(agent_skills.router, prefix=settings.api_prefix, tags=["skills"])
    app.include_router(jobs.router, prefix=settings.api_prefix, tags=["jobs"])
    app.include_router(jobs.planning_router, prefix=settings.api_prefix, tags=["jobs"])
    app.include_router(mcp.router, prefix=settings.api_prefix, tags=["mcp"])
    app.include_router(
        observability.observability_router,
        prefix=settings.api_prefix,
        tags=["observability"],
    )
    app.include_router(observability.audit_router, prefix=settings.api_prefix, tags=["audit"])
    app.include_router(parsers.router, prefix=settings.api_prefix, tags=["parser-registry"])
    app.include_router(skills.router, prefix=settings.api_prefix, tags=["skills-registry"])

    return app


app = create_app()
