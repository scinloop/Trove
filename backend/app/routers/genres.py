"""Genre (题材/子分类) management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud
from app.database import get_session
from app.models import Genre
from app.schemas import GenreCreate, GenreUpdate

router = APIRouter(prefix="/genres", tags=["genres"])


def _dump(g: Genre) -> dict:
    return {
        "id": g.id,
        "category": g.category,
        "key": g.key,
        "label": g.label,
        "color": g.color,
        "sort_order": g.sort_order,
    }


async def _get_or_404(session: AsyncSession, genre_id: int) -> Genre:
    genre = await session.get(Genre, genre_id)
    if not genre:
        raise HTTPException(status_code=404, detail="genre not found")
    return genre


@router.get("")
async def list_genres(session: AsyncSession = Depends(get_session)) -> list[dict]:
    return [_dump(g) for g in await crud.list_genres(session)]


@router.post("", status_code=201)
async def create_genre(data: GenreCreate, session: AsyncSession = Depends(get_session)) -> dict:
    return _dump(await crud.create_genre(session, data.category, data.label))


@router.patch("/{genre_id}")
async def update_genre(
    genre_id: int,
    data: GenreUpdate,
    session: AsyncSession = Depends(get_session),
) -> dict:
    genre = await _get_or_404(session, genre_id)
    return _dump(await crud.update_genre(session, genre, label=data.label, color=data.color))


@router.post("/{genre_id}/move")
async def move_genre(
    genre_id: int,
    dir: str = Query(..., pattern="^(up|down)$"),
    session: AsyncSession = Depends(get_session),
) -> dict:
    genre = await _get_or_404(session, genre_id)
    await crud.move_genre(session, genre, dir)
    return {"ok": True}


@router.delete("/{genre_id}", status_code=204)
async def delete_genre(genre_id: int, session: AsyncSession = Depends(get_session)) -> None:
    genre = await _get_or_404(session, genre_id)
    await crud.delete_genre(session, genre)
