export type Category =
  | 'comic'
  | 'novel'
  | 'anime'
  | 'character'
  | 'video'
  | 'game'
  | 'movie'
  | 'clothing'
  | 'shortdrama'
export type SubType = 'game' | 'anime_manga' | 'jp' | 'kr' | 'other'
export type Status = 'wish' | 'doing' | 'done'
export type SortKey = 'recent' | 'rating' | 'title'
export type TaskKind = 'todo' | 'goal'
export type TaskStatus = 'pending' | 'doing' | 'done'

export interface Item {
  id: number
  title: string
  category: Category
  sub_type: SubType | null
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

export interface Meta {
  categories: CategoryMeta[]
  sub_types: Record<string, { label: string; color: string }>
  category_sub_types: Record<string, string[]>
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
  sub_type: SubType | null
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
