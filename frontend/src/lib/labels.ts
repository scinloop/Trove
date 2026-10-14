import type { AcquireStatus, GenreMeta, Meta, Status, TaskStatus, WorkStatus } from '../types'

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
  genres: {
    novel: [
      { key: 'dushi', label: '都市', color: '#f97316' },
      { key: 'xiaoyuan', label: '校园', color: '#14b8a6' },
      { key: 'xuanhuan', label: '玄幻', color: '#8b5cf6' },
      { key: 'wuxia', label: '武侠', color: '#ec4899' },
      { key: 'xitong', label: '系统', color: '#0ea5e9' },
      { key: 'chuanyue', label: '穿越', color: '#6366f1' },
      { key: 'chongsheng', label: '重生', color: '#f43f5e' },
      { key: 'qihuan', label: '奇幻', color: '#f59e0b' },
      { key: 'lishi', label: '历史', color: '#10b981' },
      { key: 'yule', label: '娱乐明星', color: '#ef4444' },
      { key: 'kehuan', label: '科幻', color: '#84cc16' },
      { key: 'tongren', label: '同人', color: '#06b6d4' },
    ],
    character: [
      { key: 'game', label: '游戏角色', color: '#eab308' },
      { key: 'anime_manga', label: '动漫·漫画角色', color: '#d946ef' },
    ],
    comic: [
      { key: 'jp', label: '日漫', color: '#ef4444' },
      { key: 'kr', label: '韩漫', color: '#3b82f6' },
      { key: 'other', label: '其他', color: '#78716c' },
    ],
  },
  genre_required: ['character', 'comic'],
  work_status: [
    { key: 'upcoming', label: '预告', color: '#f59e0b' },
    { key: 'ongoing', label: '更新中', color: '#3b82f6' },
    { key: 'finished', label: '已完结', color: '#22c55e' },
  ],
  acquire_status: [
    { key: 'owned', label: '已获取', color: '#22c55e' },
    { key: 'not_owned', label: '未获取', color: '#f59e0b' },
    { key: 'skip', label: '不获取', color: '#78716c' },
    { key: 'teaser', label: '预告中', color: '#a855f7' },
  ],
  tag_groups: ['服装', '体型', '玩法', '行为', '角色', '风格', '场景', '情感'],
  status_colors: { wish: '#f59e0b', doing: '#3b82f6', done: '#22c55e' },
  status_labels: {
    default: { wish: '想看', doing: '在看', done: '看完' },
    novel: { wish: '想读', doing: '在读', done: '读完' },
    anime: { wish: '想看', doing: '在追', done: '追完' },
    shortdrama: { wish: '想看', doing: '在追', done: '追完' },
    character: { wish: '想要', doing: '在推', done: '已拥有' },
    game: { wish: '想玩', doing: '在玩', done: '通关' },
    clothing: { wish: '想收', doing: '在收', done: '已收' },
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
  const labels = meta.status_labels[category] ?? meta.status_labels.default
  return labels[status] ?? status
}

export function taskStatusLabel(meta: Meta, status: TaskStatus): string {
  return meta.task_status_labels[status] ?? status
}

export function catOf(meta: Meta, key: string) {
  return meta.categories.find((c) => c.key === key)
}

export function genreOf(meta: Meta, category: string, key: string | null): GenreMeta | null {
  if (!key) return null
  return (meta.genres[category] ?? []).find((g) => g.key === key) ?? null
}

/** 条目的多选题材 → 按题材库顺序取元信息（未知 key 忽略） */
export function genresOf(meta: Meta, category: string, keys: string[] | null | undefined): GenreMeta[] {
  const list = meta.genres[category] ?? []
  const order = new Map(list.map((g) => [g.key, g]))
  return (keys ?? [])
    .map((k) => order.get(k))
    .filter((g): g is GenreMeta => !!g)
}

export function workStatusOf(meta: Meta, key: WorkStatus | null) {
  if (!key) return null
  return meta.work_status.find((w) => w.key === key) ?? null
}

export function acquireOf(meta: Meta, key: AcquireStatus | null) {
  if (!key) return null
  return meta.acquire_status.find((a) => a.key === key) ?? null
}

/** 预计时长格式化：45 -> "45 分钟"，90 -> "1 小时 30 分钟" */
export function fmtMinutes(m: number | null): string {
  if (!m || m <= 0) return '未设定'
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} 小时 ${rest} 分钟` : `${h} 小时`
}

/** 字数格式化：9500 -> "9,500 字"，123456 -> "12.3 万字" */
export function fmtWords(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万字`
  return `${n.toLocaleString()} 字`
}
