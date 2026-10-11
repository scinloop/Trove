"""Async SQLAlchemy engine / session setup (SQLite via aiosqlite)."""
import json
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

settings.db_path.parent.mkdir(parents=True, exist_ok=True)

# ensure_ascii=False keeps CJK tags readable in the DB, so LIKE '%标签%' works
engine = create_async_engine(
    settings.db_url,
    echo=False,
    json_serializer=lambda o: json.dumps(o, ensure_ascii=False),
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
