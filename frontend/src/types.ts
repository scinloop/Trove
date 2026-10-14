export type Category =
  | 'comic'
  | 'novel'
  | 'anime'
  | 'character'
  | 'video'
  | 'game'
  | 'movie'
  | 'website'
  | 'clothing'
  | 'shortdrama'
export type SubType = string // genres 表里的 key（题材库可维护，不再收窄为固定联合）
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
  created_at: string
  updated_at: string
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
  group: string | null // 分组：服装/体型/玩法/行为/角色…，null = 未分组
  color: string
  usage: number
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
