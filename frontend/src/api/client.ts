import type { Item, ItemInput, Meta, Stats } from '../types'

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

export interface ListParams {
  category?: string
  sub?: string
  q?: string
  sort?: string
  favorite?: boolean
}

function toQuery(p: ListParams): string {
  const sp = new URLSearchParams()
  if (p.category) sp.set('category', p.category)
  if (p.sub) sp.set('sub', p.sub)
  if (p.q) sp.set('q', p.q)
  if (p.sort) sp.set('sort', p.sort)
  if (p.favorite !== undefined) sp.set('favorite', String(p.favorite))
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const api = {
  meta: () => http<Meta>('/meta'),
  stats: () => http<Stats>('/stats'),
  list: (p: ListParams = {}) => http<Item[]>(`/items${toQuery(p)}`),
  create: (data: ItemInput) => http<Item>('/items', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<ItemInput>) =>
    http<Item>(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) => http<void>(`/items/${id}`, { method: 'DELETE' }),
}
