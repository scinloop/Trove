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
from sqlalchemy import text

from app.config import BASE_DIR, settings
from app.database import Base, engine
from app.routers import items, meta, stats, tasks, uploads
from app.seed import seed_if_empty, seed_tasks_if_empty


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # 轻量迁移：create_all 不会改动已存在的表，缺列时补上（幂等）
        cols = {row[1] for row in (await conn.execute(text("PRAGMA table_info(items)"))).fetchall()}
        if cols and "image_url" not in cols:
            await conn.execute(text("ALTER TABLE items ADD COLUMN image_url VARCHAR(500)"))
    await seed_if_empty()
    await seed_tasks_if_empty()
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
app.include_router(tasks.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")

# ---- uploaded images (must be registered before the SPA catch-all) ----
# URL /static/uploads/<file> -> data/uploads/<file>
UPLOADS_DIR = settings.db_path.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="static-uploads")

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
