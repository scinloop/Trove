"""Bangumi API 代理 + 刮削落库（https://bangumi.github.io/api/）。

设计要点：
- UA 严格遵守官方规范：开发者ID/应用名/版本 (项目主页)，见 config.bgm_ua
- 官方建议 ≤1 req/s：所有出站请求串行 + 最小间隔节流（bgm_min_interval）
- PAT 鉴权：带 token 时默认搜索即包含 R18（不传 nsfw 字段）；未授权时该设置被官方忽略
- 错误统一脱敏（绝不回显 token），网络故障降级为 502 而不是拖垮本地收藏
- 刮削落库：抓到的档案写进 items.bangumi 快照（离线可用），封面下载到本地
"""
import asyncio
import time
from datetime import datetime
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Item

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

# 角色条目在本地用 bgm_type=0 标记（与官方 SubjectType 区分开）
TYPE_CHARACTER = 0

DEFAULT_EMOJI: dict[str, str] = {
    "comic": "📚",
    "anime": "📺",
    "game": "🎮",
    "character": "🎴",
    "movie": "🎬",
    "novel": "📖",
}

MAX_COVER_BYTES = 5 * 1024 * 1024

# 制作班底字段（按需求全部不展示）：职位名变体很多，用关键词匹配。
# 保留：中文名/别名/话数/放送开始/出版社/作者/原作/连载杂志/册数/页数/ISBN/官方网站/Copyright…
STAFF_KEYWORDS: tuple[str, ...] = (
    # 导演 / 演出 / 分镜·脚本
    "导演",
    "副导演",
    "监督",
    "監修",
    "演出",
    "分镜",
    "コンテ",
    "絵",
    "脚本",
    "剧本",
    "构成",
    "構成",
    # 作画 / 设定 / 设计
    "作画",
    "作监",
    "原画",
    "动画",
    "アニメ",
    "设定",
    "設定",
    "设计",
    "デザイン",
    "色彩",
    "摄影",
    "撮影",
    "剪辑",
    "编辑",
    "編集",
    # 音乐 / 音响
    "音乐",
    "音楽",
    "音响",
    "音響",
    "录音",
    "録音",
    "整音",
    "音效",
    "配音",
    "声优",
    "演员",
    "出演",
    "主题歌",
    "插入歌",
    "角色歌",
    # 演出效果 / 美术
    "特效",
    "VFX",
    "CG",
    "美术",
    "美術",
    "背景",
    "道具",
    "机械",
    # 制作 / 企划 / 发行方
    "制作",
    "製作",
    "企划",
    "企画",
    "製片",
    "制片",
    "プロデュース",
    "宣传",
    "发行",
    "协力",
    "協力",
)

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
        "bgm_type": TYPE_CHARACTER,
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


def norm_infobox(infobox: list | None, *, keep_staff: bool = False) -> list[dict]:
    """infobox 的 value 可能是字符串或对象数组（别名等多值项），统一成扁平文本。

    默认过滤掉制作班底字段（导演/音乐/动画制作/制片人…）——只保留作品属性；
    非 ASCII 的职位名很多，因此用关键词匹配而非精确枚举。
    """
    out: list[dict] = []
    for item in infobox or []:
        key = item.get("key")
        if not key:
            continue
        if not keep_staff and any(w in key for w in STAFF_KEYWORDS):
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


# ---------------- 抓取（路由与刮削共用） ----------------


async def get_status() -> dict:
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


async def search_bangumi(kw: str, category: str, limit: int = 12) -> dict:
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


async def get_subject(subject_id: int) -> dict:
    """条目完整档案：含 rating 直方图 / collection 分布 / infobox。"""
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


async def get_characters(subject_id: int) -> dict:
    """角色阵容：全量获取（含 CV）。"""
    data = await request("GET", f"/v0/subjects/{subject_id}/characters")
    chars = [norm_character(c) for c in (data if isinstance(data, list) else [])]
    return {"characters": chars, "total": len(chars)}


async def get_related(subject_id: int) -> dict:
    """关联条目：前作/续作/改编等。"""
    data = await request("GET", f"/v0/subjects/{subject_id}/subjects")
    items = []
    for s in data if isinstance(data, list) else []:
        item = norm_subject(s)
        item["relation"] = s.get("relation") or ""
        items.append(item)
    return {"related": items, "total": len(items)}


async def get_episodes(subject_id: int, offset: int = 0, limit: int = 100) -> dict:
    data = await request(
        "GET", "/v0/episodes", params={"subject_id": subject_id, "offset": offset, "limit": limit}
    )
    return {
        "episodes": [norm_episode(e) for e in data.get("data") or []],
        "total": data.get("total") or 0,
        "offset": offset,
        "limit": limit,
    }


async def get_episode(episode_id: int) -> dict:
    e = await request("GET", f"/v0/episodes/{episode_id}")
    item = norm_episode(e)
    item.update(
        {
            "desc": e.get("desc") or "",
            "duration": e.get("duration") or "",
            "comment": e.get("comment") or {},
        }
    )
    return item


async def get_character(character_id: int) -> dict:
    """角色档案 + 该角色出自哪些作品。"""
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


# ---------------- 刮削落库 ----------------


def cover_dir():
    d = settings.db_path.parent / "uploads" / "covers"
    d.mkdir(parents=True, exist_ok=True)
    return d


async def download_cover(bgm_id: int, url: str | None) -> str | None:
    """封面本地化：下载到 data/uploads/covers/{bgm_id}.jpg，返回可访问路径。

    失败返回 None（调用方保留远程 URL 作为回退，不影响功能）。
    """
    if not url:
        return None
    dest = cover_dir() / f"{bgm_id}.jpg"
    rel = f"/static/uploads/covers/{bgm_id}.jpg"
    if dest.exists() and dest.stat().st_size > 0:
        return rel
    try:
        async with httpx.AsyncClient(
            timeout=settings.bgm_timeout, headers={"User-Agent": settings.bgm_ua}
        ) as c:
            r = await c.get(url)
            if r.status_code != 200 or not r.content or len(r.content) > MAX_COVER_BYTES:
                return None
            dest.write_bytes(r.content)
    except (httpx.HTTPError, OSError):
        return None
    return rel


async def fetch_snapshot(
    bgm_id: int, bgm_type: int | None = None, *, with_extras: bool = False
) -> dict:
    """抓取条目快照。with_extras=True 时额外抓角色阵容/关联条目/剧集列表。"""
    fetched_at = datetime.now().isoformat(timespec="seconds")
    if bgm_type == TYPE_CHARACTER:
        return {
            "fetched_at": fetched_at,
            "kind": "character",
            "character": await get_character(bgm_id),
        }
    subject = await get_subject(bgm_id)
    snap: dict[str, Any] = {"fetched_at": fetched_at, "kind": "subject", "subject": subject}
    if with_extras:
        snap["characters"] = (await get_characters(bgm_id))["characters"]
        snap["related"] = (await get_related(bgm_id))["related"]
        if subject.get("bgm_type") == 2:  # 动画才有剧集
            eps = await get_episodes(bgm_id, limit=200)
            snap["episodes"] = eps["episodes"]
            snap["episode_total"] = eps["total"]
    return snap


# 自动填充「来源」时优先取用的 infobox 字段（作者 / 原作方，而不是 TV 这类类型词）
SOURCE_INFOBOX_KEYS: tuple[str, ...] = ("原作", "作者", "出版社", "开发", "厂牌", "制作公司")


def source_from_infobox(infobox: list[dict] | None) -> str | None:
    for key in SOURCE_INFOBOX_KEYS:
        for item in infobox or []:
            if item.get("key") == key and item.get("value"):
                return str(item["value"])[:200]
    return None


async def apply_scrape(
    session: AsyncSession, item: Item, *, with_extras: bool = False
) -> bool:
    """把刮削结果写进条目：快照 + 本地封面 + emoji/来源兜底。

    任何失败都降级（返回 False），绝不影响本地收藏的保存。
    """
    if not item.bgm_id:
        return False
    try:
        snapshot = await fetch_snapshot(item.bgm_id, item.bgm_type, with_extras=with_extras)
    except HTTPException:
        return False
    except Exception:  # noqa: BLE001 - 刮削是增强功能，任何异常都不该阻断保存
        return False

    main = snapshot.get("subject") or snapshot.get("character") or {}
    item.bangumi = snapshot
    if not item.bgm_type:
        item.bgm_type = main.get("bgm_type")
    cover = await download_cover(
        item.bgm_id, main.get("image") or (main.get("images") or {}).get("common")
    )
    if cover:
        item.cover_url = cover
    if not item.emoji:
        item.emoji = DEFAULT_EMOJI.get(item.category, "🎴")
    if not (item.source or "").strip():
        item.source = source_from_infobox(main.get("infobox"))
    await session.commit()
    await session.refresh(item)
    return True


# ---------------- 写回（需要 PAT 的写权限） ----------------

COLLECTION_TYPE: dict[str, int] = {"wish": 1, "doing": 3, "done": 2}  # Trove 进度 → bgm 收藏类型
EPISODE_TYPE: dict[str, int] = {"none": 0, "wish": 1, "watched": 2, "dropped": 3}
BOOK_CATEGORIES = ("comic", "novel")  # ep_status/vol_status 仅书籍条目可用（官方限制）


async def get_my_collection(subject_id: int) -> dict | None:
    """读取自己在 bgm 上的单条收藏（未收藏返回 None）。"""
    status = await get_status()
    uid = status.get("username")
    if not uid:
        return None
    try:
        return await request("GET", f"/v0/users/{uid}/collections/{subject_id}")
    except HTTPException:
        return None


def collection_payload(item: Item) -> dict:
    """Trove 收藏 → bgm 收藏负载。

    注意 tags：不传 = 忽略，传 [] = 清空 bgm 上的标签，因此仅在有标签时下发。
    """
    payload: dict[str, Any] = {"type": COLLECTION_TYPE.get(item.status, 3)}
    if item.rating:
        payload["rate"] = item.rating * 2  # 5 星 → 10 分制
    if item.note:
        payload["comment"] = item.note[:500]
    if item.tags:
        payload["tags"] = item.tags[:10]
    if item.category in BOOK_CATEGORIES:
        if item.ep_progress is not None:
            payload["ep_status"] = item.ep_progress
        if item.vol_progress is not None:
            payload["vol_status"] = item.vol_progress
    return payload


async def sync_collection(item: Item) -> dict:
    """把本地收藏写回 bgm：作品写收藏状态，角色写角色收藏标记。"""
    if item.bgm_type == TYPE_CHARACTER:
        await request("POST", f"/v0/characters/{item.bgm_id}/collect")
        return {"kind": "character", "action": "collect"}
    payload = collection_payload(item)
    await request("POST", f"/v0/users/-/collections/{item.bgm_id}", json=payload)
    return {"kind": "subject", "payload": payload}


async def sync_episode_progress(item: Item, up_to: int) -> int:
    """把「看到第 N 集」写回 bgm：批量把本篇前 N 集标记为看过。"""
    data = await get_episodes(item.bgm_id or 0, limit=200)
    ids = [
        e["bgm_id"]
        for e in data["episodes"]
        if e.get("type") in (0, None) and (e.get("sort") or 0) <= up_to
    ]
    if not ids:
        return 0
    await request(
        "PATCH",
        f"/v0/users/-/collections/{item.bgm_id}/episodes",
        json={"episode_id": ids, "type": EPISODE_TYPE["watched"]},
    )
    return len(ids)


async def set_character_collected(character_id: int, on: bool = True) -> None:
    await request("DELETE" if not on else "POST", f"/v0/characters/{character_id}/collect")


# ---------------- HTTP 端点 ----------------


@router.get("/bangumi/status")
async def bangumi_status() -> dict:
    """连接状态：是否配置 token、token 是否有效、账号信息。"""
    return await get_status()


@router.get("/bangumi/search")
async def bangumi_search(
    kw: str = Query(min_length=1, max_length=100),
    category: str = Query(min_length=2, max_length=20),
    limit: int = Query(default=12, ge=1, le=30),
) -> dict:
    """按分类搜索：作品走 /v0/search/subjects，角色走 /v0/search/characters。"""
    return await search_bangumi(kw, category, limit)


@router.get("/bangumi/subject/{subject_id}")
async def bangumi_subject(subject_id: int) -> dict:
    return await get_subject(subject_id)


@router.get("/bangumi/subject/{subject_id}/characters")
async def bangumi_characters(subject_id: int) -> dict:
    return await get_characters(subject_id)


@router.get("/bangumi/subject/{subject_id}/related")
async def bangumi_related(subject_id: int) -> dict:
    return await get_related(subject_id)


@router.get("/bangumi/subject/{subject_id}/episodes")
async def bangumi_episodes(
    subject_id: int,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
) -> dict:
    return await get_episodes(subject_id, offset, limit)


@router.get("/bangumi/episode/{episode_id}")
async def bangumi_episode(episode_id: int) -> dict:
    return await get_episode(episode_id)


@router.get("/bangumi/character/{character_id}")
async def bangumi_character(character_id: int) -> dict:
    return await get_character(character_id)


@router.get("/bangumi/my-collection/{subject_id}")
async def bangumi_my_collection(subject_id: int) -> dict:
    """读取自己在 bgm 上的收藏状态（详情页对照显示）。"""
    got = await get_my_collection(subject_id)
    return {"found": got is not None, "collection": got}
