"""FastAPI application entry point.

Dev:  .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
Docs: http://127.0.0.1:8000/docs
Prod: if frontend/dist exists, static files + SPA fallback are served from here.
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import BASE_DIR, settings
from app.database import Base, engine
from app.routers import items, meta, stats
from app.seed import seed_if_empty


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_if_empty()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meta.router, prefix="/api")
app.include_router(items.router, prefix="/api")
app.include_router(stats.router, prefix="/api")

# ---- Production mode: serve the built frontend (frontend/dist) ----
DIST_DIR = BASE_DIR.parent / "frontend" / "dist"

if DIST_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        candidate = DIST_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(DIST_DIR / "index.html")
