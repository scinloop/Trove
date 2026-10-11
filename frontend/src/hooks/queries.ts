import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { FALLBACK_META } from '../lib/labels'
import type { Meta } from '../types'

export function useMeta(): Meta {
  const q = useQuery({ queryKey: ['meta'], queryFn: api.meta, staleTime: Infinity })
  return q.data ?? FALLBACK_META
}

export function useStats() {
  return useQuery({ queryKey: ['stats'], queryFn: api.stats })
}
