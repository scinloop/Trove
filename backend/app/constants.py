"""Shared constants: categories, character sub types, statuses.

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
]
CATEGORY_KEYS: list[str] = [c["key"] for c in CATEGORIES]
CATEGORY_EMOJI: dict[str, str] = {c["key"]: c["emoji"] for c in CATEGORIES}

# sub_type only applies to category == "character"
SUB_TYPES: dict[str, dict] = {
    "game": {"label": "游戏角色", "color": "#eab308"},
    "anime_manga": {"label": "动漫·漫画角色", "color": "#d946ef"},
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
