"""Shared constants: categories, genres, statuses, tasks, palettes.

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
CATEGORY_LABEL: dict[str, str] = {c["key"]: c["label"] for c in CATEGORIES}

# 题材（子分类）种子：key 稳定不变，label/color 可在管理界面维护
# (key, label, color)  color=None 时按调色板自动取色
GENRE_SEEDS: dict[str, list[tuple[str, str, str | None]]] = {
    "novel": [
        ("dushi", "都市", None),
        ("xiaoyuan", "校园", None),
        ("xuanhuan", "玄幻", None),
        ("wuxia", "武侠", None),
        ("xitong", "系统", None),
        ("chuanyue", "穿越", None),
        ("chongsheng", "重生", None),
        ("qihuan", "奇幻", None),
        ("lishi", "历史", None),
        ("yule", "娱乐明星", None),
        ("kehuan", "科幻", None),
        ("tongren", "同人", None),
    ],
    "character": [
        ("game", "游戏角色", "#eab308"),
        ("anime_manga", "动漫·漫画角色", "#d946ef"),
    ],
    "comic": [
        ("jp", "日漫", "#ef4444"),
        ("kr", "韩漫", "#3b82f6"),
        ("other", "其他", "#78716c"),
    ],
}

# 这些分类必须选择题材（存量规则：角色/漫画）
REQUIRED_GENRE_CATEGORIES: list[str] = ["character", "comic"]

# 作品状态（连载进度，与收藏进度 wish/doing/done 相互独立；可空 = 未设置）
WORK_STATUS: dict[str, dict] = {
    "upcoming": {"label": "预告", "color": "#f59e0b"},
    "ongoing": {"label": "更新中", "color": "#3b82f6"},
    "finished": {"label": "已完结", "color": "#22c55e"},
}
WORK_STATUS_KEYS: list[str] = list(WORK_STATUS)

# 角色获取状态（仅角色分类；抽卡游戏适用，单机/动漫角色可留空）
ACQUIRE_STATUS: dict[str, dict] = {
    "owned": {"label": "已获取", "color": "#22c55e"},
    "not_owned": {"label": "未获取", "color": "#f59e0b"},
    "skip": {"label": "不获取", "color": "#78716c"},
    "teaser": {"label": "预告中", "color": "#a855f7"},
}
ACQUIRE_STATUS_KEYS: list[str] = list(ACQUIRE_STATUS)

# 标签分组（标签库按组归类，如：服装/体型/玩法/行为/角色…）
TAG_GROUPS: list[str] = ["服装", "体型", "玩法", "行为", "角色", "风格", "场景", "情感"]

GENRE_PALETTE: list[str] = [
    "#f97316", "#14b8a6", "#8b5cf6", "#ec4899", "#0ea5e9", "#6366f1",
    "#f43f5e", "#f59e0b", "#10b981", "#ef4444", "#84cc16", "#06b6d4",
    "#a855f7", "#0284c7",
]
TAG_PALETTE: list[str] = GENRE_PALETTE


def genre_color(label: str, index: int) -> str:
    """新题材/标签的自动取色：优先按名称哈希，保证同名同色。"""
    return TAG_PALETTE[(sum(ord(c) for c in label) + index) % len(TAG_PALETTE)]


STATUS_COLORS: dict[str, str] = {"wish": "#f59e0b", "doing": "#3b82f6", "done": "#22c55e"}
STATUS_KEYS: list[str] = list(STATUS_COLORS)

# Progress labels adapt per category: game -> 想玩/在玩/通关, clothing -> 想收/在收/已收,
# novel -> 想读/在读/读完, anime/shortdrama -> 想看/在追/追完, character -> 想要/在推/已拥有
STATUS_LABELS: dict[str, dict[str, str]] = {
    "default": {"wish": "想看", "doing": "在看", "done": "看完"},
    "novel": {"wish": "想读", "doing": "在读", "done": "读完"},
    "anime": {"wish": "想看", "doing": "在追", "done": "追完"},
    "shortdrama": {"wish": "想看", "doing": "在追", "done": "追完"},
    "character": {"wish": "想要", "doing": "在推", "done": "已拥有"},
    "game": {"wish": "想玩", "doing": "在玩", "done": "通关"},
    "clothing": {"wish": "想收", "doing": "在收", "done": "已收"},
}


def status_label(category: str, status: str) -> str:
    labels = STATUS_LABELS.get(category) or STATUS_LABELS["default"]
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
