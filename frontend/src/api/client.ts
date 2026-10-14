import type { BookSearch, CategoryRow, Chapter, ChapterMeta, ImportResult, Genre, Item, ItemInput, Meta, Stats, Tag, TagGroupRow, Task, TaskInput } from '../types'

const BASE = '/api'

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { detail?: unknown }
      if (body.detail) detail = String(body.detail)
    } catch {
      /* keep statusText */
    }
    throw new Error(detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function toQuery<T extends object>(p: T): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export interface ListParams {
  category?: string
  sub?: string
  q?: string
  sort?: string
  favorite?: boolean
  page?: number
  page_size?: number
}

export interface ListResult {
  total: number
  items: Item[]
}

export const api = {
  meta: () => http<Meta>('/meta'),
  stats: () => http<Stats>('/stats'),

  list: (p: ListParams = {}) => http<ListResult>(`/items${toQuery(p)}`),
  getItem: (id: number) => http<Item>(`/items/${id}`),
  create: (data: ItemInput) => http<Item>('/items', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<ItemInput>) =>
    http<Item>(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) => http<void>(`/items/${id}`, { method: 'DELETE' }),

  tasks: (p: { kind?: string; status?: string } = {}) => http<Task[]>(`/tasks${toQuery(p)}`),
  createTask: (data: TaskInput) =>
    http<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: number, data: Partial<TaskInput> & { status?: string }) =>
    http<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeTask: (id: number) => http<void>(`/tasks/${id}`, { method: 'DELETE' }),

  // ---- genres（题材库） ----
  genres: () => http<Genre[]>('/genres'),
  createGenre: (category: string, label: string) =>
    http<Genre>('/genres', { method: 'POST', body: JSON.stringify({ category, label }) }),
  updateGenre: (id: number, data: { label?: string; color?: string }) =>
    http<Genre>(`/genres/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  moveGenre: (id: number, dir: 'up' | 'down') =>
    http<{ ok: boolean }>(`/genres/${id}/move?dir=${dir}`, { method: 'POST' }),
  deleteGenre: (id: number) => http<void>(`/genres/${id}`, { method: 'DELETE' }),

  // ---- tags（标签库，带分组） ----
  tags: () => http<Tag[]>('/tags'),
  createTag: (label: string, group: string | null = null) =>
    http<Tag>('/tags', { method: 'POST', body: JSON.stringify({ label, group }) }),
  renameTag: (id: number, label: string, group: string | null = null) =>
    http<Tag>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify({ label, group }) }),
  deleteTag: (id: number) => http<void>(`/tags/${id}`, { method: 'DELETE' }),

  // ---- categories（主分类库） ----
  categories: () => http<CategoryRow[]>('/categories'),
  createCategory: (data: { label: string; emoji?: string; color?: string; note?: string }) =>
    http<CategoryRow>('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (key: string, data: { label?: string; emoji?: string; color?: string; note?: string }) =>
    http<CategoryRow>(`/categories/${key}`, { method: 'PATCH', body: JSON.stringify(data) }),
  moveCategory: (key: string, dir: 'up' | 'down') =>
    http<{ ok: boolean }>(`/categories/${key}/move?dir=${dir}`, { method: 'POST' }),
  deleteCategory: (key: string) => http<void>(`/categories/${key}`, { method: 'DELETE' }),

  // ---- tag-groups（标签大分组） ----
  tagGroups: () => http<TagGroupRow[]>('/tag-groups'),
  createTagGroup: (name: string) =>
    http<TagGroupRow>('/tag-groups', { method: 'POST', body: JSON.stringify({ name }) }),
  renameTagGroup: (id: number, name: string) =>
    http<TagGroupRow>(`/tag-groups/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteTagGroup: (id: number) =>
    http<{ ok: boolean; moved_to_ungrouped: number }>(`/tag-groups/${id}`, { method: 'DELETE' }),
  moveTagGroup: (id: number, dir: 'up' | 'down') =>
    http<{ ok: boolean }>(`/tag-groups/${id}/move?dir=${dir}`, { method: 'POST' }),

  // ---- chapters（小说章节） ----
  chapters: (itemId: number) => http<ChapterMeta[]>(`/items/${itemId}/chapters`),
  getChapter: (id: number) => http<Chapter>(`/chapters/${id}`),
  updateChapter: (id: number, data: { title?: string; content?: string }) =>
    http<Chapter>(`/chapters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  addChapter: (itemId: number, data: { title: string; content: string }) =>
    http<ChapterMeta>(`/items/${itemId}/chapters`, { method: 'POST', body: JSON.stringify(data) }),
  deleteChapter: (id: number) => http<void>(`/chapters/${id}`, { method: 'DELETE' }),
  pasteChapters: (itemId: number, text: string) =>
    http<ImportResult>(`/items/${itemId}/chapters/paste`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  resplitChapters: (itemId: number) =>
    http<ImportResult>(`/items/${itemId}/chapters/resplit`, { method: 'POST' }),

  async importChapters(itemId: number, file: File): Promise<ImportResult> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${BASE}/items/${itemId}/chapters/import`, { method: 'POST', body: fd })
    if (!res.ok) {
      let detail = res.statusText
      try {
        const body = (await res.json()) as { detail?: unknown }
        if (body.detail) detail = String(body.detail)
      } catch {
        /* keep statusText */
      }
      throw new Error(detail)
    }
    return (await res.json()) as ImportResult
  },

  searchInBook: (itemId: number, q: string) =>
    http<BookSearch>(`/items/${itemId}/search${toQuery({ q })}`),

  async uploadImage(file: File): Promise<string> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${BASE}/upload`, { method: 'POST', body: fd })
    if (!res.ok) {
      let detail = res.statusText
      try {
        const body = (await res.json()) as { detail?: unknown }
        if (body.detail) detail = String(body.detail)
      } catch {
        /* keep statusText */
      }
      throw new Error(detail)
    }
    const data = (await res.json()) as { url: string }
    return data.url
  },
}
