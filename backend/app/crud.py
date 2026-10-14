"""CRUD helpers: items, genres, tags, chapters, tasks."""
import re
import uuid
from collections import Counter
from datetime import datetime

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import String, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import (
    CATEGORY_EMOJI,
    CATEGORY_LABEL,
    GENRE_PALETTE,
    REQUIRED_GENRE_CATEGORIES,
    genre_color,
)
from app.models import Chapter, Genre, Item, Tag, Task
from app.schemas import ItemBase, ItemCreate, ItemUpdate, TaskBase, TaskCreate, TaskUpdate


# ---------------- items ----------------

async def list_items(
    session: AsyncSession,
    *,
    category: str | None = None,
    sub: str | None = None,
    q: str | None = None,
    sort: str = "recent",
    favorite: bool | None = None,
) -> list[Item]:
    stmt = select(Item)
    if category:
        stmt = stmt.where(Item.category == category)
    if sub:
        # 多选题材：JSON 文本包含即命中
        stmt = stmt.where(Item.sub_types.cast(String).like(f'%"{sub}"%'))
    if favorite is not None:
        stmt = stmt.where(Item.favorite == favorite)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Item.title.ilike(like),
                Item.source.ilike(like),
                Item.note.ilike(like),
                Item.tags.cast(String).ilike(like),  # tags stored as JSON text
            )
        )
    if sort == "rating":
        stmt = stmt.order_by(Item.rating.desc(), Item.created_at.desc(), Item.id.desc())
    elif sort == "title":
        stmt = stmt.order_by(Item.title, Item.id)
    else:  # recent
        stmt = stmt.order_by(Item.created_at.desc(), Item.id.desc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_item(session: AsyncSession, item_id: int) -> Item | None:
    return await session.get(Item, item_id)


async def _genres_of(session: AsyncSession, category: str) -> list[Genre]:
    rows = await session.execute(
        select(Genre).where(Genre.category == category).order_by(Genre.sort_order, Genre.id)
    )
    return list(rows.scalars().all())


async def create_item(session: AsyncSession, data: ItemCreate) -> Item:
    item = Item(**data.model_dump())
    genres = await _genres_of(session, item.category)
    keys = {g.key for g in genres}
    if item.sub_types:
        unknown = [s for s in item.sub_types if s not in keys]
        if unknown:
            raise HTTPException(status_code=422, detail=f"未知题材: {', '.join(unknown)}")
    elif item.category in REQUIRED_GENRE_CATEGORIES:
        raise HTTPException(
            status_code=422, detail=f"「{CATEGORY_LABEL.get(item.category, item.category)}」需要至少选择一个题材"
        )
    if not item.emoji:
        item.emoji = CATEGORY_EMOJI.get(item.category)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


async def update_item(session: AsyncSession, item: Item, data: ItemUpdate) -> Item:
    changes = data.model_dump(exclude_unset=True)
    merged = {name: getattr(item, name) for name in ItemBase.model_fields}
    merged.update(changes)
    new_category = merged["category"]
    genres = await _genres_of(session, new_category)
    keys = {g.key for g in genres}
    # 过滤掉不属于该分类的题材 key（失效/拼错的直接丢弃）
    subs = [s for s in (merged.get("sub_types") or []) if s in keys]
    if "category" in changes:
        # 切换分类：严格校验（表单总是随分类提交题材）
        if not subs and new_category in REQUIRED_GENRE_CATEGORIES and keys:
            raise HTTPException(
                status_code=422,
                detail=f"「{CATEGORY_LABEL.get(new_category, new_category)}」需要至少选择一个题材",
            )
    elif keys:
        if not subs and new_category in REQUIRED_GENRE_CATEGORIES:
            # 兼容存量数据（如未填写题材的旧漫画）：自动归入第一个题材
            subs = [genres[0].key]
    else:
        subs = []
    merged["sub_types"] = subs
    try:
        merged_item = ItemBase(**merged)  # category/status/work_status/acquire/url 校验与规范化
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    for field, value in changes.items():
        setattr(item, field, value)
    item.sub_types = subs
    item.url = merged_item.url  # 应用 url 规范化（补全协议 / 非网站分类清空）
    if not item.emoji:
        item.emoji = CATEGORY_EMOJI.get(item.category)
    await session.commit()
    await session.refresh(item)
    return item


async def delete_item(session: AsyncSession, item: Item) -> None:
    await session.execute(delete(Chapter).where(Chapter.item_id == item.id))
    await session.delete(item)
    await session.commit()


# ---------------- genres（题材库） ----------------

async def list_genres(session: AsyncSession) -> list[Genre]:
    rows = await session.execute(select(Genre).order_by(Genre.category, Genre.sort_order, Genre.id))
    return list(rows.scalars().all())


async def create_genre(session: AsyncSession, category: str, label: str) -> Genre:
    siblings = await _genres_of(session, category)
    genre = Genre(
        category=category,
        key="g_" + uuid.uuid4().hex[:8],
        label=label.strip(),
        color=genre_color(label, len(siblings)),
        sort_order=len(siblings),
    )
    session.add(genre)
    await session.commit()
    await session.refresh(genre)
    return genre


async def update_genre(session: AsyncSession, genre: Genre, *, label: str | None, color: str | None) -> Genre:
    if label is not None:
        genre.label = label.strip()
    if color:
        genre.color = color
    await session.commit()
    await session.refresh(genre)
    return genre


async def move_genre(session: AsyncSession, genre: Genre, direction: str) -> None:
    siblings = await _genres_of(session, genre.category)
    idx = siblings.index(genre)
    other = idx - 1 if direction == "up" else idx + 1
    if other < 0 or other >= len(siblings):
        return
    genre.sort_order, siblings[other].sort_order = siblings[other].sort_order, genre.sort_order
    await session.commit()


async def delete_genre(session: AsyncSession, genre: Genre) -> None:
    used = await session.scalar(
        select(func.count()).select_from(Item).where(
            Item.category == genre.category,
            Item.sub_types.cast(String).like(f'%"{genre.key}"%'),
        )
    )
    if used:
        raise HTTPException(status_code=409, detail=f"「{genre.label}」下还有 {used} 条收藏，先移走再删除")
    await session.delete(genre)
    await session.commit()


# ---------------- tags（标签库） ----------------

async def list_tags(session: AsyncSession) -> list[dict]:
    tags = (await session.execute(select(Tag).order_by(Tag.label))).scalars().all()
    rows = (await session.execute(select(Item.tags))).scalars().all()
    counter: Counter = Counter(t for lst in rows if lst for t in lst)
    return [
        {"id": t.id, "label": t.label, "group": t.group, "color": t.color, "usage": counter.get(t.label, 0)}
        for t in tags
    ]


async def create_tag(session: AsyncSession, label: str, group: str | None = None) -> tuple[Tag, bool]:
    """返回 (标签, 是否新建)；已存在时幂等返回（不覆盖已有分组）。"""
    label = label.strip()
    existing = await session.scalar(select(Tag).where(Tag.label == label))
    if existing:
        return existing, False
    count = (await session.execute(select(func.count()).select_from(Tag))).scalar_one()
    tag = Tag(label=label, group=group, color=genre_color(label, count))
    session.add(tag)
    await session.commit()
    await session.refresh(tag)
    return tag, True


async def rename_tag(session: AsyncSession, tag: Tag, new_label: str, group: str | None = None) -> Tag:
    old = tag.label
    tag.label = new_label.strip()
    tag.group = group  # None = 未分组
    rows = await session.execute(select(Item).where(Item.tags.cast(String).like(f'%"{old}"%')))
    for it in rows.scalars():
        it.tags = [new_label.strip() if t == old else t for t in (it.tags or [])]
    await session.commit()
    await session.refresh(tag)
    return tag


async def delete_tag(session: AsyncSession, tag: Tag) -> None:
    await session.delete(tag)
    await session.commit()


# ---------------- chapters（小说章节） ----------------

CHAPTER_RE = re.compile(
    r"^(第\s*[0-9０-９一二三四五六七八九十百千万零两]+\s*[章节卷部回集].{0,30}|[Cc]hapter\s+\d+.{0,30})$"
)


def word_count(text: str) -> int:
    return sum(1 for c in text if not c.isspace())


def split_text(text: str, fallback_title: str, heading_re: re.Pattern | None = None) -> list[tuple[str, str]]:
    """按章节标题行切分；找不到任何标题时整本归为一张。"""
    rx = heading_re or CHAPTER_RE
    segs: list[tuple[str | None, str]] = []
    cur: list[str] = []
    state = {"title": None, "found": False}

    def flush() -> None:
        segs.append((state["title"], "\n".join(cur).strip()))
        cur.clear()

    for raw in text.splitlines():
        line = raw.strip()
        if line and len(line) <= 50 and rx.match(line):
            flush()
            state["title"] = line
            state["found"] = True
        else:
            cur.append(raw)
    flush()

    if segs and segs[0][0] is None:
        head = segs.pop(0)[1]
        if head and state["found"]:
            segs.insert(0, ("楔子", head))
    if not state["found"] or not segs:
        return [(fallback_title, text.strip())]
    return [(t, c) for t, c in segs if t is not None]


async def list_chapters(session: AsyncSession, item_id: int) -> list[Chapter]:
    rows = await session.execute(select(Chapter).where(Chapter.item_id == item_id).order_by(Chapter.idx))
    return list(rows.scalars().all())


async def get_chapter(session: AsyncSession, chapter_id: int) -> Chapter | None:
    return await session.get(Chapter, chapter_id)


async def _replace_chapters(session: AsyncSession, item: Item, parts: list[tuple[str, str]]) -> list[Chapter]:
    await session.execute(delete(Chapter).where(Chapter.item_id == item.id))
    rows = [
        Chapter(item_id=item.id, idx=i, title=t[:200], content=c, word_count=word_count(c))
        for i, (t, c) in enumerate(parts)
    ]
    session.add_all(rows)
    await session.commit()
    return rows


async def import_text(session: AsyncSession, item: Item, text: str) -> list[Chapter]:
    return await _replace_chapters(session, item, split_text(text.strip().lstrip("\ufeff"), item.title))


async def resplit_chapters(session: AsyncSession, item: Item, pattern: str | None = None) -> list[Chapter]:
    chapters = await list_chapters(session, item.id)
    text = "\n\n".join(f"{ch.title}\n{ch.content}".strip() for ch in chapters)
    heading_re = None
    if pattern:
        try:
            heading_re = re.compile(pattern)
        except re.error as e:
            raise HTTPException(status_code=422, detail=f"无效的分章正则: {e}") from e
    return await _replace_chapters(session, item, split_text(text, item.title, heading_re))


async def create_chapter(session: AsyncSession, item_id: int, title: str, content: str) -> Chapter:
    idx = len(await list_chapters(session, item_id))
    ch = Chapter(item_id=item_id, idx=idx, title=title.strip(), content=content, word_count=word_count(content))
    session.add(ch)
    await session.commit()
    await session.refresh(ch)
    return ch


async def update_chapter(session: AsyncSession, ch: Chapter, *, title: str | None, content: str | None) -> Chapter:
    if title is not None:
        ch.title = title.strip()
    if content is not None:
        ch.content = content
        ch.word_count = word_count(content)
    await session.commit()
    await session.refresh(ch)
    return ch


async def search_in_book(session: AsyncSession, item_id: int, q: str) -> dict:
    chapters = await list_chapters(session, item_id)
    ql = q.lower()
    total = 0
    hits: list[dict] = []
    for ch in chapters:
        content = ch.content or ""
        hay = content.lower()
        positions: list[int] = []
        start = 0
        while True:
            i = hay.find(ql, start)
            if i < 0:
                break
            positions.append(i)
            start = i + len(q)
        if positions:
            total += len(positions)
            hits.append(
                {"chapter_id": ch.id, "idx": ch.idx, "title": ch.title, "count": len(positions), "positions": positions}
            )
    return {"q": q, "total": total, "chapters": hits}


# ---------------- tasks / goals ----------------

async def list_tasks(
    session: AsyncSession,
    *,
    kind: str | None = None,
    status: str | None = None,
) -> list:
    stmt = select(Task)
    if kind:
        stmt = stmt.where(Task.kind == kind)
    if status:
        stmt = stmt.where(Task.status == status)
    # 未完成的排前，完成的垫底；各自按创建时间倒序
    stmt = stmt.order_by((Task.status == "done").asc(), Task.created_at.desc(), Task.id.desc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_task(session: AsyncSession, task_id: int):
    return await session.get(Task, task_id)


async def create_task(session: AsyncSession, data: TaskCreate):
    task = Task(**data.model_dump())
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task


async def update_task(session: AsyncSession, task, data: TaskUpdate):
    changes = data.model_dump(exclude_unset=True)
    merged = {name: getattr(task, name) for name in TaskBase.model_fields}
    merged.update(changes)
    try:
        TaskBase(**merged)  # full-object validation (goal 不设时长等规则)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    was_done = task.status == "done"
    for field, value in changes.items():
        setattr(task, field, value)
    if task.kind == "goal":
        task.planned_minutes = None
    if task.status == "done" and not was_done:
        task.done_at = datetime.now()
    elif task.status != "done":
        task.done_at = None
    await session.commit()
    await session.refresh(task)
    return task


async def delete_task(session: AsyncSession, task) -> None:
    await session.delete(task)
    await session.commit()
