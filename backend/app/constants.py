"""Shared constants: categories, sub types, statuses, tasks.

Single source of truth - exposed to the frontend via GET /api/meta.
Order of CATEGORIES is the sidebar / chips / charts order.
"""
CATEGORIES: list[dict] = [
    {"key": "comic", "label": "漫画", "emoji": "📚", "color": "#f97316", "note": None},
    {"key": "novel", "label": "小说", "emoji": "📖", "color": "#14b8a6", "note": None},
    {"key": "anime", "label": "动漫", "emoji": "📺", "color": "#8b5cf6", "note": None},
    {"key": "character", "label": "角色", "emoji": "🎴", "color": "#ec4899", "note": "游戏人物为主"},
    {"key": "video", "label": "视频", "emoji": "🎞️", "color": "#0ea5e9", "note": None},
    {"key": "game", "label": "游戏", "emoji": "🎮", "color": "#6366f1", "note": None},
    {"key": "movie", "label": "电影", "emoji": "🎬", "color": "#f43f5e", "note": None},
    {"key": "clothing", "label": "服装", "emoji": "👗", "color": "#f59e0b", "note": None},
    {"key": "shortdrama", "label": "短剧", "emoji": "📱", "color": "#10b981", "note": None},
]
CATEGORY_KEYS: list[str] = [c["key"] for c in CATEGORIES]
CATEGORY_EMOJI: dict[str, str] = {c["key"]: c["emoji"] for c in CATEGORIES}

# sub_type only applies to categories that declare it (currently character / comic)
SUB_TYPES: dict[str, dict] = {
    "game": {"label": "游戏角色", "color": "#eab308"},
    "anime_manga": {"label": "动漫·漫画角色", "color": "#d946ef"},
    "jp": {"label": "日漫", "color": "#ef4444"},
    "kr": {"label": "韩漫", "color": "#3b82f6"},
    "other": {"label": "其他", "color": "#78716c"},
}
CATEGORY_SUB_TYPES: dict[str, list[str]] = {
    "character": ["game", "anime_manga"],
    "comic": ["jp", "kr", "other"],
}

STATUS_COLORS: dict[str, str] = {"wish": "#f59e0b", "doing": "#3b82f6", "done": "#22c55e"}
STATUS_KEYS: list[str] = list(STATUS_COLORS)

# Progress labels adapt per category: game -> 想玩/在玩/通关, others -> 想看/在看/看完
STATUS_LABELS: dict[str, dict[str, str]] = {
    "default": {"wish": "想看", "doing": "在看", "done": "看完"},
    "game": {"wish": "想玩", "doing": "在玩", "done": "通关"},
}


def status_label(category: str, status: str) -> str:
    labels = STATUS_LABELS["game"] if category == "game" else STATUS_LABELS["default"]
    return labels.get(status, status)


# ---- tasks / long-term goals ----
TASK_KINDS: list[str] = ["todo", "goal"]
TASK_KIND_META: dict[str, dict] = {
    "todo": {"label": "待办任务", "emoji": "⏳"},
    "goal": {"label": "长期目标", "emoji": "🎯"},
}
TASK_STATUS_COLORS: dict[str, str] = {"pending": "#a1a1aa", "doing": "#3b82f6", "done": "#22c55e"}
TASK_STATUS_KEYS: list[str] = list(TASK_STATUS_COLORS)
TASK_STATUS_LABELS: dict[str, str] = {"pending": "待开始", "doing": "进行中", "done": "已完成"}
