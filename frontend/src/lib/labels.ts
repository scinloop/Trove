import type { Meta, Status } from '../types'

/** Fallback constants (mirrors backend /api/meta) so the UI renders even before meta loads. */
export const FALLBACK_META: Meta = {
  categories: [
    { key: 'comic', label: '漫画', emoji: '📚', color: '#f97316', note: null },
    { key: 'novel', label: '小说', emoji: '📖', color: '#14b8a6', note: null },
    { key: 'anime', label: '动漫', emoji: '📺', color: '#8b5cf6', note: null },
    { key: 'character', label: '角色', emoji: '🎴', color: '#ec4899', note: '游戏人物为主' },
    { key: 'video', label: '视频', emoji: '🎞️', color: '#0ea5e9', note: null },
    { key: 'game', label: '游戏', emoji: '🎮', color: '#6366f1', note: null },
    { key: 'movie', label: '电影', emoji: '🎬', color: '#f43f5e', note: null },
  ],
  sub_types: {
    game: { label: '游戏角色', color: '#eab308' },
    anime_manga: { label: '动漫·漫画角色', color: '#d946ef' },
  },
  status_colors: { wish: '#f59e0b', doing: '#3b82f6', done: '#22c55e' },
  status_labels: {
    default: { wish: '想看', doing: '在看', done: '看完' },
    game: { wish: '想玩', doing: '在玩', done: '通关' },
  },
}

export function statusLabel(meta: Meta, category: string, status: Status): string {
  const labels = category === 'game' ? meta.status_labels.game : meta.status_labels.default
  return labels[status] ?? status
}

export function catOf(meta: Meta, key: string) {
  return meta.categories.find((c) => c.key === key)
}
