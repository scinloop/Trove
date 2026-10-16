# Trove · 个人收藏站

统一收藏漫画、小说、动漫、角色（游戏人物为主）、视频、游戏、电影、服装（图片展示）、短剧的个人站点，并内置任务清单（待办任务 + 长期目标）。
前后端分离：**React 19 + Vite + TS**（前端）/ **FastAPI + SQLAlchemy 2.0 async + SQLite**（后端）。

## 目录结构

```
collecthub/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── main.py          # 应用入口（CORS、SPA 回退、lifespan 建表+迁移+种子）
│   │   ├── config.py        # 路径 / CORS / DB 配置
│   │   ├── database.py      # async engine / session（JSON 中文可读序列化）
│   │   ├── models.py        # Item / Task / Genre / Tag / Chapter
│   │   ├── schemas.py       # Pydantic 校验（角色/漫画必须选题材等）
│   │   ├── constants.py     # 分类/题材种子/状态/任务 唯一真源（/api/meta 下发）
│   │   ├── crud.py          # 收藏/题材/标签/章节 的筛选、增删改、分章与书内搜索
│   │   ├── seed.py          # 题材库补齐 + 演示数据（python -m app.seed [--reset]）
│   │   └── routers/         # items / tasks / uploads / meta / stats / genres / tags / chapters / bangumi
│   └── tests/               # test_api.py（25） + test_bangumi.py（14）+ conftest.py，共 39 个用例
└── frontend/                # React 前端（Vite 8 + React 19 + TS 严格模式）
    └── src/
        ├── api/client.ts    # fetch 封装（/api + 图片上传 + .txt 导入）
        ├── components/      # 卡片/弹窗/表单/TagPicker/ManageModal/ChapterManager/Toast/SVG 图标…
        ├── hooks/           # useFilters(URL 驱动) / useMeta / useStats / 乐观更新
        ├── pages/           # 收藏墙 WallPage / 任务 TasksPage / 统计 StatsPage / 阅读器 ReaderPage
        └── index.css        # 简约现代风格（浅/深色 + 阅读器三主题，移动端自适应）
```

## 功能亮点

- **主分类自定义**：「我的 → 题材与标签管理 → 主分类」可自由**添加/改名/换 emoji·配色/排序/删除**主分类（漫画、小说…不再是写死的），新分类即刻出现在收藏墙与表单中；有收藏或题材的分类删除会被拦截。
- **题材库**：各分类的子分类统一进 `genres` 表维护（「我的 → 题材与标签管理」），可加题材、改名、排序；有收藏引用的题材删除会被拦截。**每条收藏可挂 0 个、1 个或多个题材**；角色/漫画至少选一个。
- **标签库**：标签按分组归类，**分组本身也可增删改排序**（标签库 tab → 分组管理；改组名级联标签，删组只把标签移入未分组）；标签重命名/换分组级联更新所有条目，删除仅移出库不影响条目。
- **作品状态**：预告 / 更新中 / 已完结 三态（与收藏进度 wish/doing/done 相互独立，可空 = 未设置），卡片与详情均有标识。
- **网站栏**：网址收藏专用页（侧栏「网站栏」/ 手机底栏「网站」），网站条目填网址（自动补全 https://）即可挂多个自定义分类与标签；**站点图标（favicon）由后端自动解析并缓存**到本地，卡片与详情直接展示，点击 ↗ 直达网站。
- **小说阅读器**：小说条目支持导入正文（.txt 上传 / 整本粘贴，UTF-8 优先自动回退 GBK），按「第X章 / 卷 / Chapter N」自动分章（可自定义正则重新分章）；全屏阅读器带目录抽屉（每章字数）、字号/行距/浅色·护眼·夜间三主题、阅读进度记忆。
- **书内搜索**：全书关键词命中计数 + 逐处跳转（悬浮条 ‹ › 或章节结果直达），命中高亮居中显示。
- 其余：评分 / 状态 / 喜爱 / 标签筛选与搜索、图片上传、统计看板、任务清单（待办 + 长期目标）。
- **Bangumi 刮削（进行中）**：漫画 / 动漫 / 游戏 / 角色 / 电影 / 小说 六类可接入 [Bangumi API](https://bangumi.github.io/api/) 自动刮削作品档案（评分与排名、收藏五档分布、infobox、全量角色阵容与 CV、关联条目、剧集列表）；电影只取三次元（动画电影归动漫）。已用 Personal Access Token 授权后默认包含 R18 内容。出站请求统一使用符合官方规范的 User-Agent 并串行节流 ≤1 req/s。

## 本地运行（两个终端）

```bash
# 终端 1 —— 后端（http://127.0.0.1:8000，接口文档 /docs）
cd collecthub/backend
.venv\Scripts\python -m uvicorn app.main:app --reload

# 终端 2 —— 前端（http://localhost:5173，已代理 /api → 8000）
cd collecthub/frontend
pnpm dev
```

首次启动自动建表、补齐题材库种子并写入演示数据；如需重置：`cd backend && .venv\Scripts\python -m app.seed --reset`。

## 生产部署（单进程）

```bash
cd frontend && pnpm build        # 产出 dist/
cd ../backend
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
# 检测到 frontend/dist 时，后端直接托管前端静态文件，访问 http://<host>:8000 即可
```

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/meta` | 分类/题材/作品状态/标签分组/状态/任务 的标签、颜色、顺序（含 `genre_required`） |
| GET | `/api/items` | 分页列表：`category` `sub` `q` `sort` `favorite` `page` `page_size`（≤200），返回 `{total, items}` |
| POST | `/api/items` | 新增（201，题材按分类校验；website 需带 `url`） |
| GET | `/api/favicon?host=` | 解析并缓存网站图标（`refresh=1` 强制重新抓取） |
| GET/PATCH/DELETE | `/api/items/{id}` | 详情 / 部分更新 / 删除（204） |
| GET/POST | `/api/categories` | 主分类库（动态）/ 新增（label+emoji+color） |
| PATCH/DELETE | `/api/categories/{key}` | 改名·emoji·配色 / 删除（有收藏或题材时 409，`POST /{key}/move` 排序） |
| GET/POST | `/api/tag-groups` | 标签分组列表（带组内标签数）/ 新增 |
| PATCH/DELETE | `/api/tag-groups/{id}` | 改名（级联标签）/ 删除（组内标签移入未分组，`POST /{id}/move` 排序） |
| GET/POST | `/api/genres` | 题材库列表 / 新增（POST `/{id}/move?dir=up\|down` 排序，PATCH 改名，DELETE 引用>0 时 409） |
| GET/POST | `/api/tags` | 标签库（带 usage 计数与分组 group）/ 新增（幂等，存在返回 200） |
| PATCH/DELETE | `/api/tags/{id}` | 重命名 / 换分组（级联条目）/ 移出标签库 |
| POST | `/api/items/{id}/chapters/import` | 上传 .txt 整本导入（≤20MB，UTF-8/GBK） |
| POST | `/api/items/{id}/chapters/paste` | 粘贴文本导入（覆盖现有章节） |
| POST | `/api/items/{id}/chapters/resplit` | 按章节标题重新分章（可带自定义正则 `pattern`） |
| GET/POST | `/api/items/{id}/chapters` | 章节列表（不含正文）/ 追加单章 |
| GET/PUT/DELETE | `/api/chapters/{id}` | 章节详情（含正文）/ 编辑（重算字数）/ 删除 |
| GET | `/api/items/{id}/search?q=` | 书内搜索：总次数 + 每章次数与位置偏移 |
| POST | `/api/upload` | 图片上传（multipart，≤5MB，jpg/png/webp/gif） |
| GET | `/api/tasks` | 任务/长期目标列表：`kind=todo\|goal` `status` |
| POST/PATCH/DELETE | `/api/tasks[/{id}]` | 任务增改删（完成时自动记录 done_at） |
| GET | `/api/stats` | 总数、近 30 天、均分、完成率、分类分布、角色构成、任务进度、最近 6 条 |

图片经 `/static/uploads/...` 托管（开发模式由 Vite 代理）。

## 测试

```bash
cd backend && .venv\Scripts\python -m pytest -v   # 25 passed
cd frontend && pnpm build                          # tsc -b 严格模式 + vite build
```

## 二期规划

- 阅读器左右翻页模式（评估引入 foliate-js paginator）
- 登录鉴权（PyJWT + bcrypt 已在依赖中）
- Docker / Caddy 一键部署
- PWA（离线访问、添加到主屏幕）
