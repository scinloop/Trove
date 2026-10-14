import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Category, SortKey, SubType } from '../types'

export type CatFilter = 'all' | Category
export type SubFilter = 'all' | SubType

/**
 * Wall filters live in the URL (shareable, survives refresh).
 * Any change also navigates back to the wall view.
 */
export function useFilters() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const cat = (params.get('cat') as CatFilter) || 'all'
  const sub = (params.get('sub') as SubFilter) || 'all'
  const q = params.get('q') ?? ''
  const sort = (params.get('sort') as SortKey) || 'recent'
  const page = Math.max(1, Number(params.get('page')) || 1)

  const apply = (next: URLSearchParams) => {
    const s = next.toString()
    navigate(s ? `/?${s}` : '/')
  }

  const setCat = (value: CatFilter) => {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('cat')
    else next.set('cat', value)
    next.delete('sub') // 切换分类时重置子类型筛选
    next.delete('page') // 筛选变化回到第一页
    apply(next)
  }

  const setSub = (value: SubFilter) => {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('sub')
    else next.set('sub', value)
    next.delete('page')
    apply(next)
  }

  const setSort = (value: SortKey) => {
    const next = new URLSearchParams(params)
    if (value === 'recent') next.delete('sort')
    else next.set('sort', value)
    next.delete('page')
    apply(next)
  }

  const setQ = (value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('q', value)
    else next.delete('q')
    next.delete('page')
    apply(next)
  }

  const setPage = (value: number) => {
    const next = new URLSearchParams(params)
    if (value <= 1) next.delete('page')
    else next.set('page', String(value))
    apply(next)
  }

  return { cat, sub, q, sort, page, setCat, setSub, setSort, setQ, setPage }
}
