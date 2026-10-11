"""Novel chapters: import/split, CRUD, word counts, in-book search."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud
from app.database import get_session
from app.schemas import ChapterCreate, ChapterDetail, ChapterOut, ChapterPaste, ChapterUpdate

router = APIRouter(tags=["chapters"])

MAX_TXT = 20 * 1024 * 1024  # 20 MB


async def _novel_or_404(session: AsyncSession, item_id: int):
    item = await crud.get_item(session, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="item not found")
    if item.category != "novel":
        raise HTTPException(status_code=422, detail="仅小说分类支持正文章节")
    return item


def _dump_list(rows) -> list[dict]:
    return [
        {"id": c.id, "idx": c.idx, "title": c.title, "word_count": c.word_count}
        for c in rows
    ]


def _import_result(rows) -> dict:
    return {
        "count": len(rows),
        "total_words": sum(c.word_count for c in rows),
        "chapters": _dump_list(rows),
    }


@router.post("/items/{item_id}/chapters/import")
async def import_chapters(
    item_id: int,
    file: UploadFile,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """上传 .txt 整本导入（UTF-8 优先，自动回退 GBK），并按章节标题分章。"""
    item = await _novel_or_404(session, item_id)
    name = file.filename or ""
    if not name.lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="仅支持 .txt 文本文件")
    raw = await file.read()
    if len(raw) > MAX_TXT:
        raise HTTPException(status_code=413, detail="文本不能超过 20 MB")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("gbk", errors="replace")
    rows = await crud.import_text(session, item, text)
    return _import_result(rows)


@router.post("/items/{item_id}/chapters/paste")
async def paste_chapters(
    item_id: int,
    data: ChapterPaste,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """粘贴整本文本导入（覆盖已有章节）。"""
    item = await _novel_or_404(session, item_id)
    rows = await crud.import_text(session, item, data.text)
    return _import_result(rows)


@router.get("/items/{item_id}/chapters", response_model=list[ChapterOut])
async def list_chapters(item_id: int, session: AsyncSession = Depends(get_session)) -> list[ChapterOut]:
    if not await crud.get_item(session, item_id):
        raise HTTPException(status_code=404, detail="item not found")
    return [ChapterOut.model_validate(c) for c in await crud.list_chapters(session, item_id)]


@router.post("/items/{item_id}/chapters", response_model=ChapterOut, status_code=201)
async def add_chapter(
    item_id: int,
    data: ChapterCreate,
    session: AsyncSession = Depends(get_session),
) -> ChapterOut:
    await _novel_or_404(session, item_id)
    ch = await crud.create_chapter(session, item_id, data.title, data.content)
    return ChapterOut.model_validate(ch)


@router.post("/items/{item_id}/chapters/resplit")
async def resplit_chapters(
    item_id: int,
    pattern: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """用（可选的自定义正则）重新对全文分章，覆盖现有章节。"""
    item = await _novel_or_404(session, item_id)
    rows = await crud.resplit_chapters(session, item, pattern)
    return _import_result(rows)


@router.get("/items/{item_id}/search")
async def search_in_book(
    item_id: int,
    q: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not await crud.get_item(session, item_id):
        raise HTTPException(status_code=404, detail="item not found")
    if not q.strip():
        raise HTTPException(status_code=422, detail="关键词不能为空")
    return await crud.search_in_book(session, item_id, q.strip())


@router.get("/chapters/{chapter_id}", response_model=ChapterDetail)
async def get_chapter(chapter_id: int, session: AsyncSession = Depends(get_session)) -> ChapterDetail:
    ch = await crud.get_chapter(session, chapter_id)
    if not ch:
        raise HTTPException(status_code=404, detail="chapter not found")
    return ChapterDetail.model_validate(ch)


@router.put("/chapters/{chapter_id}", response_model=ChapterDetail)
async def update_chapter(
    chapter_id: int,
    data: ChapterUpdate,
    session: AsyncSession = Depends(get_session),
) -> ChapterDetail:
    ch = await crud.get_chapter(session, chapter_id)
    if not ch:
        raise HTTPException(status_code=404, detail="chapter not found")
    ch = await crud.update_chapter(session, ch, title=data.title, content=data.content)
    return ChapterDetail.model_validate(ch)


@router.delete("/chapters/{chapter_id}", status_code=204)
async def delete_chapter(chapter_id: int, session: AsyncSession = Depends(get_session)) -> None:
    ch = await crud.get_chapter(session, chapter_id)
    if not ch:
        raise HTTPException(status_code=404, detail="chapter not found")
    await session.delete(ch)
    await session.commit()
