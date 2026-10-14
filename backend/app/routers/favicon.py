"""Website favicon proxy: resolves a site's icon and caches it under data/uploads/favicons.

GET /api/favicon?host=github.com         -> cached / freshly resolved icon (FileResponse)
GET /api/favicon?host=github.com&refresh=1 -> bypass cache and re-resolve
"""
import hashlib
import re
import urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.config import settings

router = APIRouter(tags=["favicon"])

UA = {"User-Agent": "Mozilla/5.0 (compatible; TroveFavicon/1.0)"}
MAX_SIZE = 1024 * 1024  # 1 MB
HOST_RE = re.compile(r"^[a-z0-9-]+(\.[a-z0-9-]+)+$")

ICON_LINK_RE = re.compile(r"<link\b[^>]*rel=[\"'][^\"']*icon[^\"']*[\"'][^>]*>", re.I)
HREF_RE = re.compile(r"href=[\"']([^\"']+)[\"']", re.I)


def _cache_dir() -> Path:
    d = settings.db_path.parent / "uploads" / "favicons"
    d.mkdir(parents=True, exist_ok=True)
    return d


def detect_mime(data: bytes) -> str:
    head = data[:512].lstrip().lower()
    if data.startswith(b"\x89PNG"):
        return "image/png"
    if data.startswith(b"\xff\xd8"):
        return "image/jpeg"
    if data.startswith(b"GIF8"):
        return "image/gif"
    if b"<svg" in head:
        return "image/svg+xml"
    return "image/x-icon"  # .ico / 未知二进制都按 ico 处理，浏览器能识别


def _fetch(url: str, timeout: int = 6) -> tuple[bytes, str] | None:
    """Fetch a URL, returning (bytes, content-type); only keep image payloads."""
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            data = resp.read(MAX_SIZE + 1)
        if not data or len(data) > MAX_SIZE:
            return None
        looks_image = ctype.startswith("image/") or detect_mime(data) != "image/x-icon"
        if not looks_image and not url.lower().split("?")[0].endswith(".ico"):
            return None
        return data, ctype
    except Exception:
        return None


def _fetch_html(url: str, timeout: int = 6) -> str | None:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read(512 * 1024).decode("utf-8", errors="ignore")
    except Exception:
        return None


def _icon_candidates(html: str, base: str) -> list[str]:
    """Extract icon hrefs from homepage HTML; apple-touch icons first (bigger)."""
    hrefs: list[str] = []
    apple: list[str] = []
    for tag in ICON_LINK_RE.findall(html):
        m = HREF_RE.search(tag)
        if not m:
            continue
        (apple if "apple-touch" in tag.lower() else hrefs).append(m.group(1))
    seen: list[str] = []
    for h in apple + hrefs:
        abs_url = urljoin(base, h)
        if abs_url not in seen:
            seen.append(abs_url)
    return seen[:4]


def _resolve(host: str) -> bytes | None:
    """Try /favicon.ico on both schemes, then parse homepage <link rel=icon>."""
    for scheme in ("https", "http"):
        got = _fetch(f"{scheme}://{host}/favicon.ico")
        if got:
            return got[0]
    html = _fetch_html(f"https://{host}/") or _fetch_html(f"http://{host}/")
    if html:
        for candidate in _icon_candidates(html, f"https://{host}/"):
            got = _fetch(candidate)
            if got:
                return got[0]
    return None


@router.get("/favicon")
def favicon(host: str = Query(min_length=4, max_length=200), refresh: bool = False) -> FileResponse:
    # 兼容直接粘贴完整 URL 的情况：提取 host
    parsed = urlparse(host if "://" in host else f"https://{host}")
    host = (parsed.netloc or parsed.path).strip().strip("/").lower()
    if not HOST_RE.match(host):
        raise HTTPException(status_code=422, detail="无效的域名")

    cache = _cache_dir() / (hashlib.md5(host.encode()).hexdigest() + ".img")
    if refresh and cache.exists():
        cache.unlink()
    if not cache.exists():
        data = _resolve(host)
        if not data:
            raise HTTPException(status_code=404, detail="未找到该网站的图标")
        cache.write_bytes(data)
    return FileResponse(cache, media_type=detect_mime(cache.read_bytes()))
