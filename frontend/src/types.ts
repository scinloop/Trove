export type Category = string // 主分类 key（categories 表，可自主增删）
export type SubType = string // genres 表里的 key（题材库可维护）
export type WorkStatus = 'upcoming' | 'ongoing' | 'finished'
export type AcquireStatus = 'owned' | 'not_owned' | 'skip' | 'teaser'
export type Status = 'wish' | 'doing' | 'done'
export type SortKey = 'recent' | 'rating' | 'title'
export type TaskKind = 'todo' | 'goal'
export type TaskStatus = 'pending' | 'doing' | 'done'

export interface Item {
  id: number
  title: string
  category: Category
  sub_types: SubType[] // 多选题材 key（genres 表）
  work_status: WorkStatus | null // 作品状态：预告/更新中/已完结，null = 未设置
  acquire: AcquireStatus | null // 角色获取状态：已获取/未获取/不获取/预告中，仅 character 分类
  url: string | null // 网址，仅 website 分类
  source: string | null
  rating: number
  status: Status
  favorite: boolean
  tags: string[]
  note: string | null
  emoji: string | null
  image_url: string | null
  // Bangumi 刮削（bgm_type=0 表示角色条目）
  bgm_id: number | null
  bgm_type: number | null
  cover_url: string | null
  ep_progress: number | null
  vol_progress: number | null
  created_at: string
  updated_at: string
}

/** 详情接口额外返回完整刮削快照（列表不返回，避免传输膨胀） */
export interface ItemDetail extends Item {
  bangumi: BangumiSnapshot | null
}

export interface CategoryMeta {
  key: string
  label: string
  emoji: string
  color: string
  note: string | null
}

export interface GenreMeta {
  key: string
  label: string
  color: string
}

export interface Genre extends GenreMeta {
  id: number
  category: string
  sort_order: number
}

export interface WorkStatusMeta {
  key: WorkStatus
  label: string
  color: string
}

export interface AcquireStatusMeta {
  key: AcquireStatus
  label: string
  color: string
}

export interface Tag {
  id: number
  label: string
  group: string | null // 分组名（tag_groups 表可维护），null = 未分组
  color: string
  usage: number
}

export interface CategoryRow {
  key: string
  label: string
  emoji: string
  color: string
  note: string | null
  sort_order: number
}

export interface TagGroupRow {
  id: number
  name: string
  sort_order: number
  tag_count: number
}

export interface ChapterMeta {
  id: number
  idx: number
  title: string
  word_count: number
}

export interface Chapter extends ChapterMeta {
  item_id: number
  content: string
}

export interface ImportResult {
  count: number
  total_words: number
  chapters: ChapterMeta[]
}

export interface BookSearchChapter {
  chapter_id: number
  idx: number
  title: string
  count: number
  positions: number[]
}

export interface BookSearch {
  q: string
  total: number
  chapters: BookSearchChapter[]
}

export interface Meta {
  categories: CategoryMeta[]
  genres: Record<string, GenreMeta[]>
  genre_required: string[]
  work_status: WorkStatusMeta[]
  acquire_status: AcquireStatusMeta[]
  tag_groups: string[]
  status_colors: Record<string, string>
  status_labels: Record<string, Record<string, string>>
  task_kinds: string[]
  task_kind_meta: Record<string, { label: string; emoji: string }>
  task_status_colors: Record<string, string>
  task_status_labels: Record<string, string>
}

export interface TaskStats {
  total: number
  pending: number
  doing: number
  done: number
  goals: number
}

export interface Stats {
  total: number
  recent30: number
  avg_rating: number
  done_rate: number
  by_category: Record<string, number>
  character_split: Record<string, number>
  recent: Item[]
  tasks: TaskStats
}

export interface ItemInput {
  title: string
  category: Category
  sub_types: SubType[]
  work_status: WorkStatus | null
  acquire: AcquireStatus | null
  url: string | null
  source: string | null
  rating: number
  status: Status
  favorite: boolean
  tags: string[]
  note: string | null
  emoji: string | null
  image_url: string | null
  bgm_id?: number | null
  bgm_type?: number | null
}

export interface Task {
  id: number
  title: string
  kind: TaskKind
  planned_minutes: number | null
  status: TaskStatus
  note: string | null
  done_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskInput {
  title: string
  kind: TaskKind
  planned_minutes: number | null
  note: string | null
}

// ---------------- Bangumi 刮削 ----------------

export interface BgmSearchHit {
  bgm_id: number
  bgm_type: number | null
  name: string
  name_cn: string
  date: string | null
  platform: string | null
  summary: string
  nsfw: boolean
  image: string | null
  score: number | null
  rank: number | null
  rating_total: number | null
  tags: string[]
}

export interface BgmInfoBoxItem {
  key: string
  value: string
}

/** 条目完整档案（含评分直方图与收藏分布） */
export interface BgmSubject extends BgmSearchHit {
  eps: number
  volumes: number
  series: boolean
  meta_tags: string[]
  infobox: BgmInfoBoxItem[]
  rating_count: Record<string, number>
  collection: Record<string, number>
  images: Record<string, string>
}

export interface BgmActor {
  bgm_id: number | null
  name: string | null
  image: string | null
}

export interface BgmCharacter {
  bgm_id: number
  bgm_type: number
  name: string
  name_cn: string
  relation: string
  image: string | null
  summary: string
  nsfw: boolean
  actors: BgmActor[]
}

/** 角色档案（角色分类收藏） */
export interface BgmCharacterDetail extends BgmCharacter {
  gender?: string
  birthday?: string
  blood_type?: string
  infobox?: BgmInfoBoxItem[]
  images?: Record<string, string>
  subjects?: (BgmSearchHit & { relation: string; staff?: string })[]
}

export interface BgmEpisode {
  bgm_id: number
  sort: number
  name: string
  name_cn: string
  airdate: string
  type: number | null
}

export interface BgmEpisodeDetail extends BgmEpisode {
  desc: string
  duration: string
}

export type BgmRelated = BgmSearchHit & { relation: string }

/** 本地刮削快照（items.bangumi） */
export interface BangumiSnapshot {
  fetched_at: string
  kind: 'subject' | 'character'
  subject?: BgmSubject
  character?: BgmCharacterDetail
  characters?: BgmCharacter[]
  related?: BgmRelated[]
  episodes?: BgmEpisode[]
  episode_total?: number
}

export interface BgmStatus {
  configured: boolean
  connected: boolean
  user_id?: number
  username?: string
  nickname?: string
  avatar?: string | null
  r18?: boolean
}

export interface BgmSearchResult {
  items: BgmSearchHit[]
  total: number | null
  source: 'subject' | 'character'
}

/** 支持 Bangumi 刮削的分类（与后端 CATEGORY_TYPES 对应） */
export const BGM_CATEGORIES = ['comic', 'anime', 'game', 'character', 'movie', 'novel'] as const
