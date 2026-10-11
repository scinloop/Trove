"""Seed the database with demo items.

Usage:
    python -m app.seed            # seed only when table is empty
    python -m app.seed --reset    # wipe items, then seed
"""
import argparse
import asyncio
from datetime import datetime, timedelta

from sqlalchemy import delete, func, select

from app.database import SessionLocal, engine
from app.models import Base, Item

# (title, category, sub_type, source, rating, status, favorite, tags, note, emoji, days_ago)
SEED_ITEMS: list[tuple] = [
    ("葬送的芙莉莲", "anime", None, "山田钟人 / MADHOUSE", 5, "doing", True, ["奇幻", "治愈"], "第9集的黄昏绝景太美了，慢慢追。", "🪄", 2),
    ("克苏鲁神话", "novel", None, "H.P. Lovecraft", 4, "wish", False, ["恐怖", "怪谈"], "准备开坑。", "🐙", 1),
    ("流萤", "character", "game", "崩坏：星穹铁道", 5, "doing", False, ["格拉默", "萤火"], "等复刻抽卡中…", "🌠", 3),
    ("塞尔达传说：王国之泪", "game", None, "Nintendo", 5, "done", True, ["开放世界", "任天堂"], "140 小时还没玩腻。", "🛡️", 4),
    ("海贼王", "comic", None, "尾田荣一郎", 5, "doing", True, ["热血", "长篇"], "追到蛋头岛篇了。", "🏴‍☠️", 5),
    ("【木鱼水心】红楼梦解读", "video", None, "哔哩哔哩", 5, "done", True, ["解说", "文学"], "公认的 B站 神作系列。", "🎞️", 6),
    ("咒术回战", "comic", None, "芥见下下", 4, "doing", False, ["黑暗", "战斗"], "漫画党，追连载中。", "👁️", 7),
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
]


async def create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


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
                sub_type=sub_type,
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


async def reset_and_seed() -> int:
    async with SessionLocal() as session:
        await session.execute(delete(Item))
        await session.commit()
    return await seed_if_empty()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the Trove database")
    parser.add_argument("--reset", action="store_true", help="wipe existing items first")
    args = parser.parse_args()

    async def run() -> None:
        await create_tables()
        if args.reset:
            n = await reset_and_seed()
            print(f"reset done, seeded {n} items")
        else:
            n = await seed_if_empty()
            print(f"seeded {n} items" if n else "database not empty, skipped")

    asyncio.run(run())


if __name__ == "__main__":
    main()
