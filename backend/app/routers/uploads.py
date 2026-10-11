"""Image upload: saves under data/uploads, served at /static/uploads/..."""
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile

from app.config import settings

router = APIRouter(prefix="/upload", tags=["upload"])

ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB


def _uploads_dir() -> Path:
    d = settings.db_path.parent / "uploads"
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("")
async def upload_image(file: UploadFile) -> dict:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail="仅支持图片格式: " + ", ".join(sorted(ALLOWED_EXTS)))
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="图片不能超过 5 MB")
    name = f"{uuid.uuid4().hex}{ext}"
    (_uploads_dir() / name).write_bytes(content)
    return {"url": f"/static/uploads/{name}"}
