"""Seed the database with demo items and tasks, ensure genres & tag library."""
import argparse
import asyncio
from datetime import datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import GENRE_PALETTE, GENRE_SEEDS, genre_color
from app.database import SessionLocal, engine
from app.models import Base, Genre, Item, Tag, Task

# (title, category, sub_type, source, rating, status, favorite, tags, note, emoji, days_ago)
SEED_ITEMS: list[tuple] = [
    ("葬送的芙莉莲", "anime", None, "山田钟人 / MADHOUSE", 5, "doing", True, ["奇幻", "治愈"], "第9集的黄昏绝景太美了，慢慢追。", "🪄", 2),
    ("克苏鲁神话", "novel", None, "H.P. Lovecraft", 4, "wish", False, ["恐怖", "怪谈"], "准备开坑。", "🐙", 1),
    ("流萤", "character", "game", "崩坏：星穹铁道", 5, "doing", False, ["格拉默", "萤火"], "等复刻抽卡中…", "🌠", 3),
    ("塞尔达传说：王国之泪", "game", None, "Nintendo", 5, "done", True, ["开放世界", "任天堂"], "140 小时还没玩腻。", "🛡️", 4),
    ("海贼王", "comic", "jp", "尾田荣一郎", 5, "doing", True, ["热血", "长篇"], "追到蛋头岛篇了。", "🏴‍☠️", 5),
    ("【木鱼水心】红楼梦解读", "video", None, "哔哩哔哩", 5, "done", True, ["解说", "文学"], "公认的 B站 神作系列。", "🎞️", 6),
    ("咒术回战", "comic", "jp", "芥见下下", 4, "doing", False, ["黑暗", "战斗"], "漫画党，追连载中。", "👁️", 7),
    ("三体", "novel", None, "刘慈欣", 5, "done", True, ["科幻", "硬核"], "黑暗森林法则太震撼。", "🪐", 9),
    ("五条悟", "character", "anime_manga", "咒术回战", 5, "done", True, ["最强", "摘眼罩名场面"], "", "🌀", 12),
    ("星际穿越", "movie", None, "Christopher Nolan", 5, "done", True, ["太空", "催泪"], "五维空间那段看哭了。", "🌌", 14),
    ("艾尔登法环", "game", None, "FromSoftware", 4, "doing", False, ["魂系", "开放世界"], "卡在女武神……", "⚔️", 11),
    ("雷电将军", "character", "game", "原神", 5, "done", True, ["稻妻", "无想的一刀"], "已经抽到二命！", "⚡", 21),
    ("乔布斯 · 斯坦福毕业演讲", "video", None, "YouTube", 5, "done", False, ["演讲", "励志"], "Stay hungry, stay foolish.", "🎤", 18),
    ("赛博朋克：边缘行者", "anime", None, "TRIGGER", 5, "done", True, ["夜之城", "BE美学"], "David 和 Lucy…意难平。", "🌃", 35),
    ("阿米娅", "character", "game", "明日方舟", 4, "done", False, ["罗德岛", "领袖"], "", "🐰", 40),
    ("活着", "novel", None, "余华", 5, "done", False, ["现实主义", "催泪"], "看一遍哭一遍。", "📖", 50),
    ("祢豆子", "character", "anime_manga", "鬼灭之刃", 4, "done", False, ["竹筒", "愈鬼"], "", "🌸", 60),
    ("你的名字。", "movie", None, "新海诚", 4, "done", False, ["新海诚", "恋爱"], "", "💫", 75),
    ("三笠", "character", "anime_manga", "进击的巨人", 5, "done", False, ["调查兵团", "最强女兵"], "", "🗡️", 90),
    ("千与千寻", "movie", None, "宫崎骏", 5, "done", True, ["吉卜力", "成长"], "永远的经典。", "🏮", 120),
    ("我的青春恋爱物语果然有问题", "novel", None, "渡航", 4, "doing", False, ["青春", "恋爱喜剧"], "大老师的毒舌太对味。", "✏️", 8),
    ("后浪", "shortdrama", None, "哔哩哔哩", 3, "doing", False, ["中医", "燃"], "竖屏短剧初体验。", "📱", 4),
]

# (title, kind, planned_minutes, status, note, days_ago)
SEED_TASKS: list[tuple] = [
    ("看完《葬送的芙莉莲》第 21 集", "todo", 25, "doing", "上周更到 20 了。", 3),
    ("整理收藏夹的标签体系", "todo", 30, "pending", "把热血/战斗/治愈统一命名。", 2),
    ("给服装板块拍三张展示图", "todo", 45, "pending", "自然光下拍最好看。", 1),
    ("补完《海贼王》和之国篇", "todo", 600, "done", "十集马拉松完成！", 9),
    ("一年内收藏满 500 部作品", "goal", None, "doing", "目前进度 20/500。", 30),
    ("把服装板块整理成穿搭手册", "goal", None, "pending", "按季节分类。", 15),
]


async def create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def ensure_genres(session: AsyncSession) -> int:
    """题材库为空时写入默认题材（幂等）；非空即交给用户自主管理，不补不覆盖。"""
    count = (await session.execute(select(func.count()).select_from(Genre))).scalar_one()
    if count:
        return 0
    for category, genres in GENRE_SEEDS.items():
        for i, (key, label, color) in enumerate(genres):
            session.add(
                Genre(
                    category=category,
                    key=key,
                    label=label,
                    color=color or GENRE_PALETTE[i % len(GENRE_PALETTE)],
                    sort_order=i,
                )
            )
    await session.commit()
    total = sum(len(g) for g in GENRE_SEEDS.values())
    return total


async def ensure_tags_from_items(session: AsyncSession) -> int:
    """把存量条目的标签补进标签库（幂等）。"""
    have = {t.label for t in (await session.execute(select(Tag))).scalars().all()}
    items = (await session.execute(select(Item))).scalars().all()
    new = sorted({t for it in items for t in (it.tags or [])} - have)
    for i, label in enumerate(new):
        session.add(Tag(label=label, color=genre_color(label, i)))
    if new:
        await session.commit()
    return len(new)


async def seed_if_empty() -> int:
    async with SessionLocal() as session:
        count = (await session.execute(select(func.count()).select_from(Item))).scalar_one()
        if count:
            return 0
        now = datetime.now()
        rows = [
            Item(
                title=title,
                category=category,
                sub_types=[sub_type] if sub_type else [],
                source=source,
                rating=rating,
                status=status,
                favorite=favorite,
                tags=list(tags),
                note=note or None,
                emoji=emoji,
                created_at=now - timedelta(days=days),
                updated_at=now - timedelta(days=days),
            )
            for (title, category, sub_type, source, rating, status, favorite, tags, note, emoji, days) in SEED_ITEMS
        ]
        session.add_all(rows)
        await session.commit()
        return len(rows)


async def seed_tasks_if_empty() -> int:
    async with SessionLocal() as session:
        count = (await session.execute(select(func.count()).select_from(Task))).scalar_one()
        if count:
            return 0
        now = datetime.now()
        rows = []
        for (title, kind, minutes, status, note, days) in SEED_TASKS:
            rows.append(
                Task(
                    title=title,
                    kind=kind,
                    planned_minutes=minutes,
                    status=status,
                    note=note or None,
                    done_at=now - timedelta(days=days) if status == "done" else None,
                    created_at=now - timedelta(days=days),
                    updated_at=now - timedelta(days=days),
                )
            )
        session.add_all(rows)
        await session.commit()
        return len(rows)


async def reset_and_seed() -> tuple[int, int]:
    async with SessionLocal() as session:
        await session.execute(delete(Item))
        await session.execute(delete(Task))
        await session.commit()
    n_items = await seed_if_empty()
    n_tasks = await seed_tasks_if_empty()
    return n_items, n_tasks


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the Trove database")
    parser.add_argument("--reset", action="store_true", help="wipe existing items & tasks first")
    args = parser.parse_args()

    async def run() -> None:
        await create_tables()
        if args.reset:
            n_items, n_tasks = await reset_and_seed()
            print(f"reset done, seeded {n_items} items / {n_tasks} tasks")
        else:
            n_items = await seed_if_empty()
            n_tasks = await seed_tasks_if_empty()
            msg = []
            if n_items:
                msg.append(f"seeded {n_items} items")
            if n_tasks:
                msg.append(f"seeded {n_tasks} tasks")
            print("; ".join(msg) if msg else "database not empty, skipped")

    asyncio.run(run())


if __name__ == "__main__":
    main()
