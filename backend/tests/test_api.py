"""API tests: in-memory SQLite, no lifespan (no real DB file touched)."""
import json

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_session
from app.main import app

CHARACTER_ITEM = {
    "title": "雷电将军",
    "category": "character",
    "sub_type": "game",
    "source": "原神",
    "rating": 5,
    "status": "done",
    "favorite": True,
    "tags": ["稻妻"],
}


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
        "comic", "novel", "anime", "character", "video", "game", "movie",
    ]
    assert meta["status_labels"]["game"]["done"] == "通关"


async def test_create_and_get(client):
    r = await client.post("/api/items", json=CHARACTER_ITEM)
    assert r.status_code == 201
    body = r.json()
    assert body["id"] > 0
    assert body["emoji"] == "🎴"  # default emoji applied
    r2 = await client.get(f"/api/items/{body['id']}")
    assert r2.status_code == 200
    assert r2.json()["title"] == "雷电将军"


async def test_character_requires_sub_type(client):
    r = await client.post("/api/items", json={"title": "x", "category": "character"})
    assert r.status_code == 422


async def test_invalid_category(client):
    r = await client.post("/api/items", json={"title": "x", "category": "foo"})
    assert r.status_code == 422


async def test_sub_type_cleared_for_non_character(client):
    r = await client.post("/api/items", json={"title": "三体", "category": "novel", "sub_type": "game"})
    assert r.status_code == 201
    assert r.json()["sub_type"] is None


async def test_list_filter_search_sort(client):
    await client.post("/api/items", json=CHARACTER_ITEM)
    await client.post("/api/items", json={"title": "海贼王", "category": "comic", "rating": 5, "tags": ["热血"]})
    await client.post("/api/items", json={"title": "咒术回战", "category": "comic", "rating": 4})

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

    r = await client.get("/api/items", params={"favorite": True})
    assert len(r.json()) == 1


async def test_patch(client):
    r = await client.post("/api/items", json=CHARACTER_ITEM)
    item_id = r.json()["id"]
    r = await client.patch(f"/api/items/{item_id}", json={"favorite": False, "rating": 4})
    assert r.status_code == 200
    body = r.json()
    assert body["favorite"] is False and body["rating"] == 4
    assert body["sub_type"] == "game"  # untouched fields preserved


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
