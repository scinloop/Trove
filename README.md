# Trove · 个人收藏站

统一收藏漫画（日漫/韩漫/其他）、小说、动漫、角色（游戏人物为主）、视频、游戏、电影、服装（图片展示）、短剧的个人站点，并内置任务清单（待办任务 + 长期目标）。
前后端分离：**React 19 + Vite + TS**（前端）/ **FastAPI + SQLAlchemy 2.0 async + SQLite**（后端）。

## 目录结构

```
collecthub/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── main.py          # 应用入口（CORS、SPA 回退、lifespan 建表+种子）
│   │   ├── config.py        # 路径 / CORS / DB 配置
│   │   ├── database.py      # async engine / session（JSON 中文可读序列化）
│   │   ├── models.py        # Item / Task 模型（Item 支持图片 image_url）
│   │   ├── schemas.py       # Pydantic 校验（角色/漫画必须带 sub_type 等）
│   │   ├── constants.py     # 分类/子类/状态/任务 唯一真源（/api/meta 下发）
│   │   ├── crud.py          # 列表筛选/搜索/排序 + 增删改（收藏与任务）
│   │   ├── seed.py          # 演示数据：22 条收藏 + 6 条任务（python -m app.seed [--reset]）
│   │   └── routers/         # items / tasks / uploads / meta / stats
│   └── tests/test_api.py    # 14 个接口测试（内存 SQLite）
└── frontend/                # React 前端（Vite 8 + React 19 + TS 严格模式）
    └── src/
        ├── api/client.ts    # fetch 封装（/api + 图片上传）
        ├── components/      # 卡片/弹窗/表单/侧栏/底栏/任务/Toast/SVG 图标…
        ├── hooks/           # useFilters(URL 驱动) / useMeta / useStats / 乐观更新
        ├── pages/           # 收藏墙 WallPage / 任务 TasksPage / 统计 StatsPage
        └── index.css        # 简约现代风格（浅/深色，移动端自适应）
```

## 本地运行（两个终端）

```bash
# 终端 1 —— 后端（http://127.0.0.1:8000，接口文档 /docs）
cd collecthub/backend
.venv\Scripts\python -m uvicorn app.main:app --reload

# 终端 2 —— 前端（http://localhost:5173，已代理 /api → 8000）
cd collecthub/frontend
pnpm dev
```

首次启动自动建表并写入 20 条演示数据；如需重置：`cd backend && .venv\Scripts\python -m app.seed --reset`。

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
| GET | `/api/meta` | 分类/子类/状态/任务 的标签、颜色、顺序 |
| GET | `/api/items` | 列表：`category` `sub` `q` `sort=recent\|rating\|title` `favorite` |
| POST | `/api/items` | 新增（201） |
| GET/PATCH/DELETE | `/api/items/{id}` | 详情 / 部分更新 / 删除（204） |
| POST | `/api/upload` | 图片上传（multipart，≤5MB，jpg/png/webp/gif） |
| GET | `/api/tasks` | 任务/长期目标列表：`kind=todo\|goal` `status` |
| POST/PATCH/DELETE | `/api/tasks[/{id}]` | 任务增改删（完成时自动记录 done_at） |
| GET | `/api/stats` | 总数、近 30 天、均分、完成率、分类分布、角色构成、任务进度、最近 6 条 |

图片经 `/static/uploads/...` 托管（开发模式由 Vite 代理）。

## 测试

```bash
cd backend && .venv\Scripts\python -m pytest -v   # 14 passed
cd frontend && pnpm build                          # tsc -b 严格模式 + vite build
```

## 二期规划

- 登录鉴权（PyJWT + bcrypt 已在依赖中）
- Docker / Caddy 一键部署
- PWA（离线访问、添加到主屏幕）
