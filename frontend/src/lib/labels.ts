import type { Meta, Status, TaskStatus } from '../types'

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
    { key: 'clothing', label: '服装', emoji: '👗', color: '#f59e0b', note: null },
    { key: 'shortdrama', label: '短剧', emoji: '📱', color: '#10b981', note: null },
  ],
  sub_types: {
    game: { label: '游戏角色', color: '#eab308' },
    anime_manga: { label: '动漫·漫画角色', color: '#d946ef' },
    jp: { label: '日漫', color: '#ef4444' },
    kr: { label: '韩漫', color: '#3b82f6' },
    other: { label: '其他', color: '#78716c' },
  },
  category_sub_types: {
    character: ['game', 'anime_manga'],
    comic: ['jp', 'kr', 'other'],
  },
  status_colors: { wish: '#f59e0b', doing: '#3b82f6', done: '#22c55e' },
  status_labels: {
    default: { wish: '想看', doing: '在看', done: '看完' },
    game: { wish: '想玩', doing: '在玩', done: '通关' },
  },
  task_kinds: ['todo', 'goal'],
  task_kind_meta: {
    todo: { label: '待办任务', emoji: '⏳' },
    goal: { label: '长期目标', emoji: '🎯' },
  },
  task_status_colors: { pending: '#a1a1aa', doing: '#3b82f6', done: '#22c55e' },
  task_status_labels: { pending: '待开始', doing: '进行中', done: '已完成' },
}

export function statusLabel(meta: Meta, category: string, status: Status): string {
  const labels = category === 'game' ? meta.status_labels.game : meta.status_labels.default
  return labels[status] ?? status
}

export function taskStatusLabel(meta: Meta, status: TaskStatus): string {
  return meta.task_status_labels[status] ?? status
}

export function catOf(meta: Meta, key: string) {
  return meta.categories.find((c) => c.key === key)
}

/** 预计时长格式化：45 -> "45 分钟"，90 -> "1 小时 30 分钟" */
export function fmtMinutes(m: number | null): string {
  if (!m || m <= 0) return '未设定'
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} 小时 ${rest} 分钟` : `${h} 小时`
}
