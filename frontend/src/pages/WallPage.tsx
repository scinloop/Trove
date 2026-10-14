import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { CategoryChips } from '../components/Chips'
import { ItemCard } from '../components/ItemCard'
import { Pager } from '../components/Pager'
import { StatMinis } from '../components/StatMinis'
import { useFilters } from '../hooks/useFilters'
import { useMeta, useStats } from '../hooks/queries'
import type { Item } from '../types'

const PAGE_SIZE = 60

export function WallPage({ onOpen }: { onOpen: (it: Item) => void }) {
  const meta = useMeta()
  const { cat, sub, q, sort, page, setPage } = useFilters()
  const stats = useStats()

  const list = useQuery({
    queryKey: ['items', cat, sub, q, sort],
    queryFn: () =>
      api.list({
        category: cat === 'all' ? undefined : cat,
        sub: sub === 'all' ? undefined : sub,
        q: q || undefined,
        sort,
      }),
  })

  const s = stats.data
  const items = list.data ?? []
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const curPage = Math.min(page, totalPages)
  const shown = items.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  return (
    <div className="view">
      <StatMinis
        items={[
          { icon: '🗂️', label: '收藏总数', value: s?.total ?? 0 },
          { icon: '🆕', label: '近 30 天新增', value: s?.recent30 ?? 0 },
          { icon: '★', label: '平均评分', value: s?.avg_rating ?? 0, decimals: 1 },
          { icon: '✓', label: '完成率 %', value: s?.done_rate ?? 0 },
        ]}
      />
      <CategoryChips meta={meta} />
      <p className="count">
        共 {items.length} 件收藏{q ? ` · 关键词「${q}」` : ''}
        {totalPages > 1 && ` · 第 ${curPage}/${totalPages} 页`}
      </p>
      {list.isError ? (
        <p className="count">加载失败：{list.error.message}</p>
      ) : list.isPending ? (
        <p className="count">加载中…</p>
      ) : items.length === 0 ? (
        <div className="grid">
          <div className="empty">
            <div className="e-art">▢</div>
            <p>这里还空空的</p>
            <span>点右下角 ＋ 或右上角「添加收藏」，开始攒你的宝藏</span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid">
            {shown.map((it, i) => (
              <ItemCard key={it.id} item={it} index={i} onOpen={onOpen} />
            ))}
          </div>
          <Pager page={curPage} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
