"""Bangumi 代理测试：httpx.MockTransport 拦截全部出站请求，测试不联网。

覆盖：官方 UA 规范、PAT 鉴权头、分类→类型映射、R18 默认包含语义、
归一化（infobox 多值扁平化 / 评分直方图 / 收藏分布）、角色全量、错误码映射。
"""
import json

import httpx
import pytest

from app.config import settings
from app.routers import bangumi as bgm

SUBJECT_12 = {
    "id": 12,
    "type": 2,
    "name": "ちょびっツ",
    "name_cn": "人形电脑天使心",
    "summary": "在不久的将来，电子技术飞速发展……",
    "date": "2002-04-02",
    "platform": "TV",
    "eps": 27,
    "volumes": 0,
    "series": False,
    "nsfw": False,
    "images": {
        "large": "https://lain.bgm.tv/l.jpg",
        "common": "https://lain.bgm.tv/c.jpg",
        "grid": "https://lain.bgm.tv/g.jpg",
    },
    "meta_tags": ["科幻", "TV", "恋爱"],
    "rating": {"rank": 945, "total": 5541, "score": 7.5, "count": {"1": 10, "10": 500}},
    "collection": {"wish": 4279, "collect": 8945, "doing": 933, "on_hold": 1065, "dropped": 286},
    "tags": [{"name": "CLAMP", "count": 1344}, {"name": "TV", "count": 662}],
    "infobox": [
        {"key": "中文名", "value": "人形电脑天使心"},
        {"key": "别名", "value": [{"v": "Chobits"}, {"v": "电脑天使"}]},
        {"key": "话数", "value": "27"},
        {"key": "空值项", "value": ""},
    ],
}

# 25 个角色：用于验证「全量获取、不截断」
CHARACTERS_12 = [
    {
        "id": i,
        "name": f"角色{i}",
        "relation": "主角" if i == 1 else "配角",
        "images": {"grid": f"https://lain.bgm.tv/crt{i}.jpg"},
        "actors": [{"id": 100 + i, "name": f"声优{i}", "images": {"grid": "https://lain.bgm.tv/a.jpg"}}],
    }
    for i in range(1, 26)
]

RELATED = [
    {
        "id": 497,
        "type": 1,
        "name": "ちょびっツ",
        "name_cn": "人形电脑天使心",
        "relation": "漫画",
        "images": {"common": "https://lain.bgm.tv/r.jpg"},
    }
]

EPISODES = {
    "data": [
        {"id": 1, "sort": 1, "name": "ep1", "name_cn": "第一话", "airdate": "2002-04-03", "type": 0}
    ],
    "total": 27,
}

ME = {"id": 1247155, "username": "1247155", "nickname": "sciJ", "avatar": {"large": "https://lain.bgm.tv/av.jpg"}}

ROUTES: dict[str, object] = {
    "/v0/me": ME,
    "/v0/subjects/12": SUBJECT_12,
    "/v0/subjects/12/characters": CHARACTERS_12,
    "/v0/subjects/12/subjects": RELATED,
    "/v0/episodes": EPISODES,
    "/v0/episodes/555": {**EPISODES["data"][0], "desc": "单集简介", "duration": "24m"},
    "/v0/characters/179271": {
        "id": 179271,
        "name": "セイバー",
        "gender": "女",
        "birthday": "1月1日",
        "images": {"grid": "https://lain.bgm.tv/saber.jpg"},
        "infobox": [{"key": "身高", "value": "154cm"}],
    },
    "/v0/characters/179271/subjects": RELATED,
    "/v0/search/subjects": {"data": [SUBJECT_12], "total": 474},
    "/v0/search/characters": {
        "data": [{"id": 179271, "name": "セイバー", "type": 1, "images": {"grid": "https://lain.bgm.tv/saber.jpg"}}],
        "total": 10,
    },
    # 写回相关（POST/PATCH/DELETE 共用同一响应）
    "/v0/users/-/collections/12": {"subject_id": 12, "type": 3},
    "/v0/users/-/collections/12/episodes": {},
    "/v0/users/1247155/collections/12": {"subject_id": 12, "type": 3, "rate": 6},
    "/v0/characters/179271/collect": {},
}


@pytest.fixture(autouse=True)
def bgm_calls(monkeypatch):
    """拦截所有 httpx 出站请求并记录调用细节。

    autouse：确保任何测试都不会真的联网（忘写 fixture 参数也会被拦截）。
    """
    calls: list[dict] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(
            {
                "method": req.method,
                "path": req.url.path,
                "query": dict(req.url.params),
                "ua": req.headers.get("user-agent"),
                "auth": req.headers.get("authorization"),
                "body": json.loads(req.content) if req.content else None,
            }
        )
        if req.url.path == "/v0/boom":
            return httpx.Response(500, json={"error": "boom"})
        if req.url.path in ROUTES:
            return httpx.Response(200, json=ROUTES[req.url.path])
        return httpx.Response(404, json={"error": "not found"})

    monkeypatch.setattr(settings, "bgm_min_interval", 0.0)
    monkeypatch.setattr(settings, "bgm_token", "test-token")
    # 与真实实现一致：client 带官方 UA + Bearer（顺序在 monkeypatch 之后）
    client = httpx.AsyncClient(
        base_url="https://api.bgm.tv",
        transport=httpx.MockTransport(handler),
        headers=bgm._headers(),
    )

    async def fake_client() -> httpx.AsyncClient:
        return client

    monkeypatch.setattr(bgm, "_client_get", fake_client)

    async def fake_cover(bgm_id: int, url: str | None) -> str | None:
        """封面本地化在此替换：测试不下载真实图片。"""
        return f"/static/uploads/covers/{bgm_id}.jpg" if url else None

    monkeypatch.setattr(bgm, "download_cover", fake_cover)
    return calls


# ---------------- 搜索与类型映射 ----------------


async def test_search_anime_type_and_r18_default(client, bgm_calls):
    r = await client.get("/api/bangumi/search", params={"kw": "魔法", "category": "anime"})
    assert r.status_code == 200
    assert bgm_calls[0]["path"] == "/v0/search/subjects"
    body = bgm_calls[0]["body"]
    assert body["filter"]["type"] == [2]
    # 不传 nsfw => 已授权时返回含 R18 的全部结果（官方语义）
    assert "nsfw" not in body["filter"]
    item = r.json()["items"][0]
    assert item["bgm_id"] == 12 and item["name_cn"] == "人形电脑天使心"
    assert item["score"] == 7.5 and item["rank"] == 945
    assert item["image"] == "https://lain.bgm.tv/c.jpg"


async def test_search_movie_only_live_action(client, bgm_calls):
    """动画电影属动画(type 2)：电影分类只搜三次元(type 6)。"""
    await client.get("/api/bangumi/search", params={"kw": "星际", "category": "movie"})
    assert bgm_calls[0]["body"]["filter"]["type"] == [6]


async def test_search_comic_and_novel_are_books(client, bgm_calls):
    for cat in ("comic", "novel"):
        await client.get("/api/bangumi/search", params={"kw": "测试", "category": cat})
    assert [c["body"]["filter"]["type"] for c in bgm_calls] == [[1], [1]]


async def test_search_character_uses_character_api(client, bgm_calls):
    r = await client.get("/api/bangumi/search", params={"kw": "saber", "category": "character"})
    assert bgm_calls[0]["path"] == "/v0/search/characters"
    assert bgm_calls[0]["body"]["filter"]["nsfw"] == "include"
    assert r.json()["source"] == "character"
    assert r.json()["items"][0]["bgm_id"] == 179271


async def test_search_rejects_unsupported_category(client, bgm_calls):
    r = await client.get("/api/bangumi/search", params={"kw": "x", "category": "website"})
    assert r.status_code == 422
    assert bgm_calls == []  # 不发无谓请求


# ---------------- 官方 UA 规范与鉴权 ----------------


async def test_official_user_agent_and_bearer(client, bgm_calls):
    await client.get("/api/bangumi/search", params={"kw": "魔法", "category": "anime"})
    ua = bgm_calls[0]["ua"]
    assert ua == settings.bgm_ua
    # 开发者ID/应用名/版本 (项目主页)
    assert ua.startswith("scinloop/Trove/")
    assert "github.com/scinloop/Trove" in ua
    assert bgm_calls[0]["auth"] == "Bearer test-token"


# ---------------- 详情归一化 ----------------


async def test_subject_detail_normalization(client):
    r = await client.get("/api/bangumi/subject/12")
    assert r.status_code == 200
    d = r.json()
    assert d["eps"] == 27 and d["platform"] == "TV"
    assert d["rating_count"] == {"1": 10, "10": 500}
    assert d["collection"]["collect"] == 8945
    assert d["meta_tags"] == ["科幻", "TV", "恋爱"]
    info = {i["key"]: i["value"] for i in d["infobox"]}
    assert info["别名"] == "Chobits / 电脑天使"  # 多值项扁平化
    assert "空值项" not in info  # 空值不下发
    assert d["tags"][0] == {"name": "CLAMP", "count": 1344}


async def test_characters_are_full_not_truncated(client):
    r = await client.get("/api/bangumi/subject/12/characters")
    body = r.json()
    assert body["total"] == 25
    assert len(body["characters"]) == 25
    first = body["characters"][0]
    assert first["relation"] == "主角"
    assert first["actors"][0]["name"] == "声优1"


async def test_related_and_episodes(client, bgm_calls):
    rel = await client.get("/api/bangumi/subject/12/related")
    assert rel.json()["related"][0]["relation"] == "漫画"

    eps = await client.get("/api/bangumi/subject/12/episodes")
    body = eps.json()
    assert body["total"] == 27
    assert body["episodes"][0]["name_cn"] == "第一话"
    assert "desc" not in body["episodes"][0]  # 列表精简，简介走单集接口
    assert bgm_calls[-1]["query"]["subject_id"] == "12"


async def test_episode_and_character_detail(client):
    ep = await client.get("/api/bangumi/episode/555")
    assert ep.json()["desc"] == "单集简介" and ep.json()["duration"] == "24m"

    ch = await client.get("/api/bangumi/character/179271")
    body = ch.json()
    assert body["gender"] == "女" and body["birthday"] == "1月1日"
    assert body["subjects"][0]["relation"] == "漫画"  # 该角色出自哪些作品


# ---------------- 错误处理与状态 ----------------


async def test_status_when_token_missing(client, bgm_calls, monkeypatch):
    monkeypatch.setattr(settings, "bgm_token", "")
    r = await client.get("/api/bangumi/status")
    assert r.json() == {"configured": False, "connected": False, "r18": False}
    assert bgm_calls == []


async def test_status_when_connected(client):
    r = await client.get("/api/bangumi/status")
    body = r.json()
    assert body["connected"] is True
    assert body["nickname"] == "sciJ"
    assert body["user_id"] == 1247155
    assert body["r18"] is True


async def test_upstream_404_maps_to_404(client):
    r = await client.get("/api/bangumi/subject/999")
    assert r.status_code == 404


async def test_upstream_5xx_maps_to_502(bgm_calls):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        await bgm.request("GET", "/v0/boom")
    assert exc.value.status_code == 502


# ---------------- 刮削落库（保存即刮削） ----------------


async def test_create_item_scrapes_snapshot_and_cover(client, bgm_calls):
    r = await client.post(
        "/api/items",
        json={"title": "人形电脑天使心", "category": "anime", "bgm_id": 12, "bgm_type": 2},
    )
    assert r.status_code == 201
    created = r.json()
    assert created["bgm_id"] == 12
    assert created["cover_url"] == "/static/uploads/covers/12.jpg"
    assert created["emoji"] == "📺"  # 未填 emoji 时按分类兜底
    assert bgm_calls[0]["path"] == "/v0/subjects/12"

    # 列表不含完整快照，详情接口才返回
    lst = (await client.get("/api/items")).json()
    assert not any("bangumi" in i for i in lst["items"])
    detail = (await client.get(f"/api/items/{created['id']}")).json()
    snap = detail["bangumi"]
    assert snap["kind"] == "subject"
    assert snap["subject"]["name_cn"] == "人形电脑天使心"
    assert snap["subject"]["collection"]["collect"] == 8945


async def test_scrape_failure_never_blocks_save(client, bgm_calls):
    """Bangumi 不可达（404/5xx）时收藏照样保存，只是没有快照。"""
    r = await client.post(
        "/api/items",
        json={"title": "库里没有的条目", "category": "anime", "bgm_id": 99999, "bgm_type": 2},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["cover_url"] is None
    assert (await client.get(f"/api/items/{body['id']}")).json()["bangumi"] is None


async def test_update_does_not_rescrape_unchanged_bgm(client, bgm_calls):
    created = (
        await client.post(
            "/api/items",
            json={"title": "人形电脑天使心", "category": "anime", "bgm_id": 12, "bgm_type": 2},
        )
    ).json()
    before = len(bgm_calls)
    r = await client.patch(f"/api/items/{created['id']}", json={"title": "改个名字"})
    assert r.status_code == 200
    assert r.json()["title"] == "改个名字"
    assert len(bgm_calls) == before  # 未换绑 → 不再请求 Bangumi


async def test_rescrape_endpoint_pulls_extras(client, bgm_calls):
    created = (
        await client.post(
            "/api/items",
            json={"title": "人形电脑天使心", "category": "anime", "bgm_id": 12, "bgm_type": 2},
        )
    ).json()
    r = await client.post(f"/api/items/{created['id']}/scrape")
    assert r.status_code == 200
    snap = r.json()["bangumi"]
    assert snap["kind"] == "subject"
    assert len(snap["characters"]) == 25  # 角色阵容全量
    assert snap["related"][0]["relation"] == "漫画"
    assert snap["episode_total"] == 27
    assert snap["subject"]["name_cn"] == "人形电脑天使心"


async def test_rescrape_unbound_item_is_422(client, bgm_calls):
    created = (await client.post("/api/items", json={"title": "手动条目", "category": "anime"})).json()
    r = await client.post(f"/api/items/{created['id']}/scrape")
    assert r.status_code == 422


async def test_character_item_scrapes_character_profile(client, bgm_calls):
    r = await client.post(
        "/api/items",
        json={
            "title": "セイバー",
            "category": "character",
            "sub_types": ["anime_manga"],
            "bgm_id": 179271,
            "bgm_type": 0,
        },
    )
    assert r.status_code == 201
    snap = (await client.get(f"/api/items/{r.json()['id']}")).json()["bangumi"]
    assert snap["kind"] == "character"
    assert snap["character"]["gender"] == "女"
    assert snap["character"]["subjects"][0]["relation"] == "漫画"  # 出自哪些作品
    assert bgm_calls[0]["path"] == "/v0/characters/179271"


# ---------------- 写回 Bangumi（P4） ----------------


async def test_sync_writes_collection_payload(client, bgm_calls):
    created = (
        await client.post(
            "/api/items",
            json={
                "title": "人形电脑天使心",
                "category": "anime",
                "bgm_id": 12,
                "bgm_type": 2,
                "status": "doing",
                "rating": 3,
                "tags": ["治愈"],
                "note": "很好看",
            },
        )
    ).json()
    bgm_calls.clear()

    r = await client.post(f"/api/items/{created['id']}/sync")
    assert r.status_code == 200
    assert r.json()["synced"]["kind"] == "subject"

    call = next(c for c in bgm_calls if c["path"] == "/v0/users/-/collections/12")
    assert call["method"] == "POST"
    assert call["body"]["type"] == 3  # doing → 在看
    assert call["body"]["rate"] == 6  # 3 星 → 6 分
    assert call["body"]["comment"] == "很好看"
    assert call["body"]["tags"] == ["治愈"]
    assert "ep_status" not in call["body"]  # 动画不能写书籍进度字段


async def test_sync_book_includes_ep_and_vol_status(client, bgm_calls):
    created = (
        await client.post(
            "/api/items",
            json={
                "title": "三体",
                "category": "novel",
                "bgm_id": 12,
                "bgm_type": 1,
                "ep_progress": 5,
                "vol_progress": 2,
            },
        )
    ).json()
    bgm_calls.clear()

    r = await client.post(f"/api/items/{created['id']}/sync")
    assert r.status_code == 200
    call = next(c for c in bgm_calls if c["path"] == "/v0/users/-/collections/12")
    assert call["body"]["ep_status"] == 5 and call["body"]["vol_status"] == 2


async def test_sync_anime_writes_episode_progress(client, bgm_calls):
    created = (
        await client.post(
            "/api/items",
            json={
                "title": "人形电脑天使心",
                "category": "anime",
                "bgm_id": 12,
                "bgm_type": 2,
                "ep_progress": 3,
            },
        )
    ).json()
    bgm_calls.clear()

    r = await client.post(f"/api/items/{created['id']}/sync")
    assert r.status_code == 200
    assert r.json()["synced"]["episodes"] == 1  # mock 仅 1 集且 sort=1 ≤ 3

    call = next(c for c in bgm_calls if c["path"].endswith("/12/episodes"))
    assert call["method"] == "PATCH"
    assert call["body"] == {"episode_id": [1], "type": 2}


async def test_sync_without_episode_progress_skips_episode_call(client, bgm_calls):
    created = (
        await client.post(
            "/api/items",
            json={"title": "x", "category": "anime", "bgm_id": 12, "bgm_type": 2},
        )
    ).json()
    bgm_calls.clear()
    await client.post(f"/api/items/{created['id']}/sync")
    assert not any("/episodes" in c["path"] for c in bgm_calls)


async def test_sync_character_marks_collect(client, bgm_calls):
    created = (
        await client.post(
            "/api/items",
            json={
                "title": "セイバー",
                "category": "character",
                "sub_types": ["anime_manga"],
                "bgm_id": 179271,
                "bgm_type": 0,
            },
        )
    ).json()
    bgm_calls.clear()

    r = await client.post(f"/api/items/{created['id']}/sync")
    assert r.status_code == 200
    assert r.json()["synced"] == {"kind": "character", "action": "collect"}
    assert bgm_calls[0]["path"] == "/v0/characters/179271/collect"
    assert bgm_calls[0]["method"] == "POST"


async def test_sync_requires_binding_and_token(client, bgm_calls, monkeypatch):
    plain = (await client.post("/api/items", json={"title": "手动", "category": "anime"})).json()
    assert (await client.post(f"/api/items/{plain['id']}/sync")).status_code == 422  # 未绑定

    bound = (
        await client.post(
            "/api/items",
            json={"title": "x", "category": "anime", "bgm_id": 12, "bgm_type": 2},
        )
    ).json()
    monkeypatch.setattr(settings, "bgm_token", "")
    assert (await client.post(f"/api/items/{bound['id']}/sync")).status_code == 401  # 无令牌


async def test_my_collection_lookup(client, bgm_calls):
    r = await client.get("/api/bangumi/my-collection/12")
    assert r.status_code == 200
    body = r.json()
    assert body["found"] is True
    assert body["collection"]["type"] == 3
    # 先取账号信息（/v0/me）再读收藏
    assert any(c["path"] == "/v0/users/1247155/collections/12" for c in bgm_calls)
