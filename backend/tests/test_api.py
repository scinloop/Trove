"""API tests: in-memory SQLite, no lifespan (no real DB file touched)."""
import json

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_session
from app.main import app
from app.seed import ensure_genres

CHARACTER_ITEM = {
    "title": "雷电将军",
    "category": "character",
    "sub_types": ["game"],
    "source": "原神",
    "rating": 5,
    "status": "done",
    "favorite": True,
    "tags": ["稻妻"],
}

NOVEL_TEXT = """楔子
天黑得很沉。

第一章 起点
少年推开门，风从山谷吹来。

第二章 转折
雨下了整夜，少年还在赶路。

第三章 归途
天亮时，他回到了起点。"""


@pytest.fixture
async def client():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        json_serializer=lambda o: json.dumps(o, ensure_ascii=False),
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        await ensure_genres(session)  # 题材库默认数据

    async def override():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
    await engine.dispose()


async def test_meta(client):
    r = await client.get("/api/meta")
    assert r.status_code == 200
    meta = r.json()
    assert [c["key"] for c in meta["categories"]] == [
        "comic", "novel", "anime", "character", "video", "game", "movie", "clothing", "shortdrama",
    ]
    assert meta["status_labels"]["game"]["done"] == "通关"
    assert meta["status_labels"]["clothing"]["done"] == "已收"
    assert [g["key"] for g in meta["genres"]["comic"]] == ["jp", "kr", "other"]
    assert len(meta["genres"]["novel"]) == 12
    assert meta["genre_required"] == ["character", "comic"]
    assert [w["key"] for w in meta["work_status"]] == ["upcoming", "ongoing", "finished"]
    assert "角色" in meta["tag_groups"] and "服装" in meta["tag_groups"]


async def test_create_and_get(client):
    r = await client.post("/api/items", json=CHARACTER_ITEM)
    assert r.status_code == 201
    body = r.json()
    assert body["id"] > 0
    assert body["sub_types"] == ["game"]
    assert body["emoji"] == "🎴"  # default emoji applied
    r2 = await client.get(f"/api/items/{body['id']}")
    assert r2.status_code == 200
    assert r2.json()["title"] == "雷电将军"


async def test_character_requires_sub_types(client):
    r = await client.post("/api/items", json={"title": "x", "category": "character"})
    assert r.status_code == 422


async def test_invalid_category(client):
    r = await client.post("/api/items", json={"title": "x", "category": "foo"})
    assert r.status_code == 422


async def test_sub_types_validation(client):
    # 小说可选题材：0 个、1 个或多个都可以
    r = await client.post("/api/items", json={"title": "无题材的书", "category": "novel"})
    assert r.status_code == 201
    assert r.json()["sub_types"] == []

    r = await client.post("/api/items", json={"title": "三体", "category": "novel", "sub_types": ["kehuan"]})
    assert r.status_code == 201
    assert r.json()["sub_types"] == ["kehuan"]

    r = await client.post(
        "/api/items",
        json={"title": "混合题材", "category": "novel", "sub_types": ["xuanhuan", "chuanyue", "xitong"]},
    )
    assert r.status_code == 201
    assert r.json()["sub_types"] == ["xuanhuan", "chuanyue", "xitong"]

    # 角色的题材不能用在小说上
    r = await client.post("/api/items", json={"title": "x", "category": "novel", "sub_types": ["game"]})
    assert r.status_code == 422

    # 重复 key 自动去重
    r = await client.post(
        "/api/items", json={"title": "去重", "category": "novel", "sub_types": ["kehuan", "kehuan"]}
    )
    assert r.status_code == 201
    assert r.json()["sub_types"] == ["kehuan"]


async def test_work_status(client):
    r = await client.post(
        "/api/items",
        json={"title": "连载中的漫画", "category": "comic", "sub_types": ["kr"], "work_status": "ongoing"},
    )
    assert r.status_code == 201
    assert r.json()["work_status"] == "ongoing"

    r = await client.post(
        "/api/items",
        json={"title": "完结的漫画", "category": "comic", "sub_types": ["jp"], "work_status": "finished"},
    )
    assert r.status_code == 201

    r = await client.post(
        "/api/items", json={"title": "x", "category": "comic", "sub_types": ["jp"], "work_status": "foo"}
    )
    assert r.status_code == 422

    # 不设置 work_status = None（未设置）
    r = await client.post("/api/items", json={"title": "x", "category": "comic", "sub_types": ["jp"]})
    assert r.status_code == 201 and r.json()["work_status"] is None


async def test_list_filter_search_sort(client):
    await client.post("/api/items", json=CHARACTER_ITEM)
    await client.post("/api/items", json={"title": "海贼王", "category": "comic", "sub_types": ["jp"], "rating": 5, "tags": ["热血"]})
    await client.post("/api/items", json={"title": "咒术回战", "category": "comic", "sub_types": ["kr"], "rating": 4})

    r = await client.get("/api/items", params={"category": "comic"})
    assert [i["title"] for i in r.json()] == ["咒术回战", "海贼王"]  # recent sort: newest first

    r = await client.get("/api/items", params={"q": "海贼"})
    assert [i["title"] for i in r.json()] == ["海贼王"]

    r = await client.get("/api/items", params={"q": "热血"})  # tag search
    assert [i["title"] for i in r.json()] == ["海贼王"]

    r = await client.get("/api/items", params={"sort": "rating"})
    assert r.json()[0]["rating"] == 5

    r = await client.get("/api/items", params={"category": "character", "sub": "game"})
    assert [i["title"] for i in r.json()] == ["雷电将军"]

    r = await client.get("/api/items", params={"category": "comic", "sub": "kr"})
    assert [i["title"] for i in r.json()] == ["咒术回战"]

    r = await client.get("/api/items", params={"favorite": True})
    assert len(r.json()) == 1


async def test_patch(client):
    r = await client.post("/api/items", json=CHARACTER_ITEM)
    item_id = r.json()["id"]
    r = await client.patch(f"/api/items/{item_id}", json={"favorite": False, "rating": 4})
    assert r.status_code == 200
    body = r.json()
    assert body["favorite"] is False and body["rating"] == 4
    assert body["sub_types"] == ["game"]  # untouched fields preserved

    # 多选题材可以直接改
    r = await client.patch(f"/api/items/{item_id}", json={"sub_types": ["game", "anime_manga"]})
    assert r.json()["sub_types"] == ["game", "anime_manga"]


async def test_patch_to_character_without_sub_rejected(client):
    r = await client.post("/api/items", json={"title": "三体", "category": "novel"})
    item_id = r.json()["id"]
    r = await client.patch(f"/api/items/{item_id}", json={"category": "character"})
    assert r.status_code == 422


async def test_delete(client):
    r = await client.post("/api/items", json=CHARACTER_ITEM)
    item_id = r.json()["id"]
    r = await client.delete(f"/api/items/{item_id}")
    assert r.status_code == 204
    r = await client.get(f"/api/items/{item_id}")
    assert r.status_code == 404


async def test_stats(client):
    await client.post("/api/items", json=CHARACTER_ITEM)
    await client.post("/api/items", json={"title": "三体", "category": "novel", "status": "done", "rating": 5})
    r = await client.get("/api/stats")
    assert r.status_code == 200
    stats = r.json()
    assert stats["total"] == 2
    assert stats["by_category"]["novel"] == 1
    assert stats["character_split"] == {"game": 1, "anime_manga": 0}
    assert stats["avg_rating"] == 5.0
    assert stats["done_rate"] == 100
    assert len(stats["recent"]) == 2


async def test_stats_character_split_multi(client):
    # 同时挂两个角色题材：两边都计数
    await client.post(
        "/api/items", json={"title": "两栖角色", "category": "character", "sub_types": ["game", "anime_manga"]}
    )
    stats = (await client.get("/api/stats")).json()
    assert stats["character_split"] == {"game": 1, "anime_manga": 1}


async def test_comic_sub_types(client):
    r = await client.post("/api/items", json={"title": "我独自升级", "category": "comic", "sub_types": ["kr"]})
    assert r.status_code == 201
    assert r.json()["sub_types"] == ["kr"]

    r = await client.post("/api/items", json={"title": "x", "category": "comic"})
    assert r.status_code == 422  # 漫画必须至少选一个题材

    r = await client.post("/api/items", json={"title": "x", "category": "comic", "sub_types": ["game"]})
    assert r.status_code == 422  # 不能借用角色分类的题材

    r = await client.post("/api/items", json={"title": "x", "category": "character", "sub_types": ["jp"]})
    assert r.status_code == 422


async def test_tasks_crud(client):
    r = await client.post("/api/tasks", json={"title": "看完第 21 集", "kind": "todo", "planned_minutes": 25})
    assert r.status_code == 201
    task = r.json()
    assert task["status"] == "pending" and task["planned_minutes"] == 25

    r = await client.post("/api/tasks", json={"title": "收藏满 500 部", "kind": "goal", "planned_minutes": 100})
    goal = r.json()
    assert goal["planned_minutes"] is None  # 长期目标不设时长

    r = await client.patch(f"/api/tasks/{task['id']}", json={"status": "done"})
    body = r.json()
    assert body["status"] == "done" and body["done_at"] is not None

    r = await client.patch(f"/api/tasks/{task['id']}", json={"status": "doing"})
    assert r.json()["done_at"] is None  # 退回进行中，清除完成时间

    r = await client.get("/api/tasks", params={"kind": "goal"})
    assert [t["id"] for t in r.json()] == [goal["id"]]

    r = await client.delete(f"/api/tasks/{task['id']}")
    assert r.status_code == 204
    r = await client.get(f"/api/tasks/{task['id']}")
    assert r.status_code == 404


async def test_stats_includes_tasks(client):
    await client.post("/api/tasks", json={"title": "任务A", "kind": "todo"})
    await client.post("/api/tasks", json={"title": "目标B", "kind": "goal"})
    r = await client.get("/api/stats")
    assert r.json()["tasks"] == {"total": 2, "pending": 2, "doing": 0, "done": 0, "goals": 1}


async def test_upload_image(client, tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "db_path", tmp_path / "bench.db")
    content = b"\x89PNG\r\n\x1a\n" + b"0" * 64
    r = await client.post("/api/upload", files={"file": ("a.png", content, "image/png")})
    assert r.status_code == 200
    url = r.json()["url"]
    assert url.startswith("/static/uploads/") and url.endswith(".png")
    saved = tmp_path / "uploads" / url.rsplit("/", 1)[1]
    assert saved.is_file() and saved.read_bytes() == content

    r = await client.post("/api/upload", files={"file": ("a.txt", b"x", "text/plain")})
    assert r.status_code == 400  # 非图片格式拒绝


async def test_genres_manage(client):
    r = await client.post("/api/genres", json={"category": "novel", "label": "无限流"})
    assert r.status_code == 201
    genre = r.json()
    assert genre["key"].startswith("g_") and genre["color"].startswith("#")

    r = await client.patch(f"/api/genres/{genre['id']}", json={"label": "无限流小说"})
    assert r.json()["label"] == "无限流小说"

    r = await client.post("/api/items", json={"title": "书", "category": "novel", "sub_types": [genre["key"]]})
    assert r.status_code == 201
    item_id = r.json()["id"]

    r = await client.delete(f"/api/genres/{genre['id']}")
    assert r.status_code == 409  # 有条目引用，禁止删除

    await client.delete(f"/api/items/{item_id}")
    r = await client.delete(f"/api/genres/{genre['id']}")
    assert r.status_code == 204


async def test_tags_manage(client):
    r = await client.post("/api/tags", json={"label": "爽文"})
    assert r.status_code == 201
    tag = r.json()
    assert tag["color"].startswith("#")

    r = await client.post("/api/tags", json={"label": "爽文"})
    assert r.status_code == 200 and r.json()["id"] == tag["id"]  # 幂等

    r = await client.post("/api/items", json={"title": "书A", "category": "novel", "sub_types": ["xuanhuan"], "tags": ["爽文"]})
    item_id = r.json()["id"]

    tags = (await client.get("/api/tags")).json()
    mine = next(t for t in tags if t["label"] == "爽文")
    assert mine["usage"] == 1

    r = await client.patch(f"/api/tags/{tag['id']}", json={"label": "爽文小说"})
    assert r.json()["label"] == "爽文小说"
    item = (await client.get(f"/api/items/{item_id}")).json()
    assert item["tags"] == ["爽文小说"]  # 重命名级联到条目

    r = await client.delete(f"/api/tags/{tag['id']}")
    assert r.status_code == 204
    item = (await client.get(f"/api/items/{item_id}")).json()
    assert item["tags"] == ["爽文小说"]  # 删字典不影响已挂条目


async def test_tag_groups(client):
    # 建标签时带分组
    r = await client.post("/api/tags", json={"label": "JK 制服", "group": "服装"})
    assert r.status_code == 201 and r.json()["group"] == "服装"

    r = await client.post("/api/tags", json={"label": "美少女", "group": "角色"})
    tag = r.json()

    # 改分组
    r = await client.patch(f"/api/tags/{tag['id']}", json={"label": "美少女", "group": "体型"})
    assert r.json()["group"] == "体型"

    tags = (await client.get("/api/tags")).json()
    assert any(t["label"] == "JK 制服" and t["group"] == "服装" for t in tags)


async def test_chapters_import_and_search(client):
    r = await client.post("/api/items", json={"title": "少年行", "category": "novel", "sub_types": ["wuxia"]})
    item_id = r.json()["id"]

    r = await client.post(f"/api/items/{item_id}/chapters/paste", json={"text": NOVEL_TEXT})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 4  # 楔子 + 3 章
    assert body["chapters"][0]["title"] == "楔子"
    assert body["chapters"][1]["title"].startswith("第一章")
    assert all(c["word_count"] > 0 for c in body["chapters"])

    # 列表不含正文
    r = await client.get(f"/api/items/{item_id}/chapters")
    lst = r.json()
    assert len(lst) == 4 and "content" not in lst[0]

    # 单章详情
    first = lst[1]
    r = await client.get(f"/api/chapters/{first['id']}")
    assert "少年推开门" in r.json()["content"]

    # 书内搜索：总次数 + 每章次数 + 位置可回溯
    r = await client.get(f"/api/items/{item_id}/search", params={"q": "少年"})
    body = r.json()
    assert body["total"] == 2
    assert [c["count"] for c in body["chapters"]] == [1, 1]
    pos = body["chapters"][0]["positions"][0]
    detail = (await client.get(f"/api/chapters/{body['chapters'][0]['chapter_id']}")).json()
    assert detail["content"][pos:pos + 2] == "少年"

    # 编辑章节 → 字数重算
    r = await client.put(f"/api/chapters/{first['id']}", json={"content": "短内容"})
    assert r.json()["word_count"] == 3

    # 删除章节
    r = await client.delete(f"/api/chapters/{first['id']}")
    assert r.status_code == 204
    assert len((await client.get(f"/api/items/{item_id}/chapters")).json()) == 3


async def test_chapters_txt_upload_gbk(client):
    r = await client.post("/api/items", json={"title": "旧书", "category": "novel"})
    item_id = r.json()["id"]

    raw = "第一章 起点\n内容你好".encode("gbk")
    r = await client.post(f"/api/items/{item_id}/chapters/import", files={"file": ("book.txt", raw, "text/plain")})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 1  # 无分章标题 → 整本一章
    detail = (await client.get(f"/api/chapters/{body['chapters'][0]['id']}")).json()
    assert "内容你好" in detail["content"]  # GBK 正确解码

    r = await client.post(f"/api/items/{item_id}/chapters/import", files={"file": ("a.png", b"x", "image/png")})
    assert r.status_code == 400  # 非 txt 拒绝
