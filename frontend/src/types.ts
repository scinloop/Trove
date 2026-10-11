export type Category = 'comic' | 'novel' | 'anime' | 'character' | 'video' | 'game' | 'movie'
export type SubType = 'game' | 'anime_manga'
export type Status = 'wish' | 'doing' | 'done'
export type SortKey = 'recent' | 'rating' | 'title'

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
  status_colors: Record<string, string>
  status_labels: Record<string, Record<string, string>>
}

export interface Stats {
  total: number
  recent30: number
  avg_rating: number
  done_rate: number
  by_category: Record<string, number>
  character_split: Record<string, number>
  recent: Item[]
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
}
