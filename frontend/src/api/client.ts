import type { Item, ItemInput, Meta, Stats, Task, TaskInput } from '../types'

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
}

export const api = {
  meta: () => http<Meta>('/meta'),
  stats: () => http<Stats>('/stats'),

  list: (p: ListParams = {}) => http<Item[]>(`/items${toQuery(p)}`),
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
