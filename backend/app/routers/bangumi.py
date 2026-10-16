"""Bangumi API 代理（https://bangumi.github.io/api/）。

设计要点：
- UA 严格遵守官方规范：开发者ID/应用名/版本 (项目主页)，见 config.bgm_ua
- 官方建议 ≤1 req/s：所有出站请求串行 + 最小间隔节流（bgm_min_interval）
- PAT 鉴权：带 token 时默认搜索即包含 R18（不传 nsfw 字段）；未授权时该设置被官方忽略
- 错误统一脱敏（绝不回显 token），网络故障降级为 502 而不是拖垮本地收藏功能
"""
import asyncio
import time
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.config import settings

router = APIRouter(tags=["bangumi"])

# 分类 → Bangumi 条目类型（1书籍 2动画 3音乐 4游戏 6三次元，官方无 5）
# 漫画/小说同属 1（靠 platform/标签区分，不做硬过滤）
# 电影只取 6（三次元/真人）——动画电影属 2，因此只归「动漫」
CATEGORY_TYPES: dict[str, list[int]] = {
    "comic": [1],
    "novel": [1],
    "anime": [2],
    "game": [4],
    "movie": [6],
    "character": [],  # 角色走 /v0/search/characters
}
SCRAPE_CATEGORIES: list[str] = list(CATEGORY_TYPES)

_client: httpx.AsyncClient | None = None
_lock = asyncio.Lock()
_last_call = 0.0


def _headers() -> dict[str, str]:
    h = {"User-Agent": settings.bgm_ua, "Accept": "application/json"}
    if settings.bgm_configured:
        h["Authorization"] = f"Bearer {settings.bgm_token}"
    return h


async def _client_get() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=settings.bgm_base, timeout=settings.bgm_timeout, headers=_headers()
        )
    return _client


async def request(method: str, path: str, **kw: Any) -> Any:
    """统一的出站请求：串行节流 + UA/鉴权 + 错误归一。测试中会被 monkeypatch 替换。"""
    global _last_call
    async with _lock:
        gap = settings.bgm_min_interval - (time.monotonic() - _last_call)
        if _last_call and gap > 0:
            await asyncio.sleep(gap)
        client = await _client_get()
        try:
            resp = await client.request(method, path, **kw)
        except httpx.HTTPError as exc:
            raise HTTPException(502, f"Bangumi 请求失败（{type(exc).__name__}）") from exc
        finally:
            _last_call = time.monotonic()
    if resp.status_code == 404:
        raise HTTPException(404, "Bangumi 上找不到该条目")
    if resp.status_code in (401, 403):
        raise HTTPException(401, "Bangumi 未授权：请检查访问令牌")
    if resp.status_code >= 400:
        raise HTTPException(502, f"Bangumi 返回 {resp.status_code}")
    return resp.json()


# ---------------- 归一化（只挑本地要用的字段，控制快照体积） ----------------


def _img(d: dict, *sizes: str) -> str | None:
    images = d.get("images") or {}
    for s in sizes:
        if images.get(s):
            return images[s]
    return d.get("image") or None


def norm_subject(s: dict) -> dict:
    """搜索结果 / 列表用的精简条目。"""
    rating = s.get("rating") or {}
    return {
        "bgm_id": s.get("id"),
        "bgm_type": s.get("type"),
        "name": s.get("name") or "",
        "name_cn": s.get("name_cn") or "",
        "date": s.get("date"),
        "platform": s.get("platform"),
        "summary": s.get("summary") or "",
        "nsfw": bool(s.get("nsfw")),
        "image": _img(s, "common", "medium", "large", "small"),
        "score": rating.get("score"),
        "rank": rating.get("rank"),
        "rating_total": rating.get("total"),
        "tags": [t.get("name") for t in (s.get("tags") or []) if t.get("name")][:10],
    }


def norm_character(c: dict) -> dict:
    return {
        "bgm_id": c.get("id"),
        "name": c.get("name") or "",
        "name_cn": c.get("name_cn") or "",
        "relation": c.get("relation") or "",
        "image": _img(c, "grid", "small", "common"),
        "summary": c.get("summary") or "",
        "nsfw": bool(c.get("nsfw")),
        "actors": [
            {"bgm_id": a.get("id"), "name": a.get("name"), "image": _img(a, "grid", "small")}
            for a in (c.get("actors") or [])
        ],
    }


def norm_episode(e: dict) -> dict:
    return {
        "bgm_id": e.get("id"),
        "sort": e.get("sort"),
        "name": e.get("name") or "",
        "name_cn": e.get("name_cn") or "",
        "airdate": e.get("airdate") or "",
        "type": e.get("type"),
    }


def norm_infobox(infobox: list | None) -> list[dict]:
    """infobox 的 value 可能是字符串或对象数组（别名等多值项），统一成扁平文本。"""
    out: list[dict] = []
    for item in infobox or []:
        key = item.get("key")
        if not key:
            continue
        raw = item.get("value")
        if isinstance(raw, list):
            parts = []
            for v in raw:
                if isinstance(v, dict):
                    parts.append(str(v.get("v") or v.get("name") or ""))
                else:
                    parts.append(str(v))
            value = " / ".join(p for p in parts if p)
        else:
            value = str(raw or "")
        if value:
            out.append({"key": key, "value": value})
    return out


# ---------------- 端点 ----------------


@router.get("/bangumi/status")
async def bangumi_status() -> dict:
    """连接状态：是否配置 token、token 是否有效、账号信息。"""
    if not settings.bgm_configured:
        return {"configured": False, "connected": False, "r18": False}
    me = await request("GET", "/v0/me")
    avatar = me.get("avatar") or {}
    return {
        "configured": True,
        "connected": True,
        "user_id": me.get("id"),
        "username": me.get("username"),
        "nickname": me.get("nickname"),
        "avatar": avatar.get("large") or avatar.get("medium"),
        "r18": True,  # 已授权 => 默认搜索包含 R18
    }


@router.get("/bangumi/search")
async def bangumi_search(
    kw: str = Query(min_length=1, max_length=100),
    category: str = Query(min_length=2, max_length=20),
    limit: int = Query(default=12, ge=1, le=30),
) -> dict:
    """按分类搜索：作品走 /v0/search/subjects，角色走 /v0/search/characters。"""
    if category == "character":
        data = await request(
            "POST",
            "/v0/search/characters",
            params={"limit": limit, "offset": 0},
            json={"keyword": kw, "filter": {"nsfw": "include"}},
        )
        return {
            "items": [norm_character(c) for c in data.get("data") or []],
            "total": data.get("total"),
            "source": "character",
        }
    types = CATEGORY_TYPES.get(category)
    if not types:
        raise HTTPException(422, f"该分类不支持 Bangumi 刮削：{category}")
    # 不传 nsfw：已授权时返回含 R18 的全部结果（官方语义）
    data = await request(
        "POST",
        "/v0/search/subjects",
        params={"limit": limit, "offset": 0},
        json={"keyword": kw, "filter": {"type": types}},
    )
    return {
        "items": [norm_subject(s) for s in data.get("data") or []],
        "total": data.get("total"),
        "source": "subject",
    }


@router.get("/bangumi/subject/{subject_id}")
async def bangumi_subject(subject_id: int) -> dict:
    """条目完整档案（刮削主体）：含 rating 直方图 / collection 分布 / infobox。"""
    s = await request("GET", f"/v0/subjects/{subject_id}")
    base = norm_subject(s)
    rating = s.get("rating") or {}
    base.update(
        {
            "eps": s.get("eps") or 0,
            "volumes": s.get("volumes") or 0,
            "series": bool(s.get("series")),
            "meta_tags": s.get("meta_tags") or [],
            "infobox": norm_infobox(s.get("infobox")),
            "score": rating.get("score"),
            "rank": rating.get("rank"),
            "rating_total": rating.get("total"),
            "rating_count": rating.get("count") or {},
            "collection": s.get("collection") or {},
            "tags": [
                {"name": t.get("name"), "count": t.get("count")}
                for t in (s.get("tags") or [])
                if t.get("name")
            ][:30],
            "images": s.get("images") or {},
        }
    )
    return base


@router.get("/bangumi/subject/{subject_id}/characters")
async def bangumi_characters(subject_id: int) -> dict:
    """角色阵容：全量获取（含 CV）。"""
    data = await request("GET", f"/v0/subjects/{subject_id}/characters")
    chars = [norm_character(c) for c in (data if isinstance(data, list) else [])]
    return {"characters": chars, "total": len(chars)}


@router.get("/bangumi/subject/{subject_id}/related")
async def bangumi_related(subject_id: int) -> dict:
    """关联条目：前作/续作/改编等。"""
    data = await request("GET", f"/v0/subjects/{subject_id}/subjects")
    items = []
    for s in data if isinstance(data, list) else []:
        item = norm_subject(s)
        item["relation"] = s.get("relation") or ""
        items.append(item)
    return {"related": items, "total": len(items)}


@router.get("/bangumi/subject/{subject_id}/episodes")
async def bangumi_episodes(
    subject_id: int,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
) -> dict:
    """剧集列表（精简字段，支持翻页）。"""
    data = await request(
        "GET", "/v0/episodes", params={"subject_id": subject_id, "offset": offset, "limit": limit}
    )
    return {
        "episodes": [norm_episode(e) for e in data.get("data") or []],
        "total": data.get("total") or 0,
        "offset": offset,
        "limit": limit,
    }


@router.get("/bangumi/episode/{episode_id}")
async def bangumi_episode(episode_id: int) -> dict:
    """单集详情（简介/时长）。"""
    e = await request("GET", f"/v0/episodes/{episode_id}")
    item = norm_episode(e)
    item.update({"desc": e.get("desc") or "", "duration": e.get("duration") or "", "comment": e.get("comment") or {}})
    return item


@router.get("/bangumi/character/{character_id}")
async def bangumi_character(character_id: int) -> dict:
    """角色档案 + 该角色出自哪些作品（角色收藏页用）。"""
    c = await request("GET", f"/v0/characters/{character_id}")
    subjects = await request("GET", f"/v0/characters/{character_id}/subjects")
    base = norm_character(c)
    base.update(
        {
            "gender": c.get("gender") or "",
            "birthday": c.get("birthday") or "",
            "blood_type": c.get("blood_type") or "",
            "infobox": norm_infobox(c.get("infobox")),
            "images": c.get("images") or {},
            "subjects": [
                {**norm_subject(s), "relation": s.get("relation") or "", "staff": s.get("staff") or ""}
                for s in (subjects if isinstance(subjects, list) else [])
            ],
        }
    )
    return base
