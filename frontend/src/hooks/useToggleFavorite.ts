import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Item } from '../types'

/** Toggle favorite with optimistic update across all cached item lists. */
export function useToggleFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, favorite }: { id: number; favorite: boolean }) => api.update(id, { favorite }),
    onMutate: async ({ id, favorite }) => {
      await qc.cancelQueries({ queryKey: ['items'] })
      const snapshots = qc.getQueriesData<Item[]>({ queryKey: ['items'] })
      for (const [key, data] of snapshots) {
        if (data) {
          qc.setQueryData(
            key,
            data.map((it) => (it.id === id ? { ...it, favorite } : it)),
          )
        }
      }
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      for (const [key, data] of ctx?.snapshots ?? []) qc.setQueryData(key, data)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['items'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
