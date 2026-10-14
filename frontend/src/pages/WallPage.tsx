import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { api } from '../api/client'
import { CategoryChips } from '../components/Chips'
import { ItemCard } from '../components/ItemCard'
import { Pager } from '../components/Pager'
import { StatMinis } from '../components/StatMinis'
import { useColumns } from '../hooks/useColumns'
import { useFilters } from '../hooks/useFilters'
import { useMeta, useStats } from '../hooks/queries'
import type { Item } from '../types'

const ROWS = 4 // 每页行数：桌面 5-6 列 × 4 行 ≈ 20-24 个/页；手机 2 列 × 4 行 = 8 个/页

export function WallPage({ onOpen }: { onOpen: (it: Item) => void }) {
  const meta = useMeta()
  const { cat, sub, q, sort, page, setPage } = useFilters()
  const stats = useStats()
  const viewRef = useRef<HTMLDivElement>(null)
  // 列数与 CSS auto-fill 网格保持一致 → 每页正好铺满整行，末行不缺格
  const cols = useColumns(viewRef, { mobile: 2, min: 178, gap: 14 })
  const PAGE_SIZE = cols * ROWS

  const list = useQuery({
    queryKey: ['items', cat, sub, q, sort, page, PAGE_SIZE],
    queryFn: () =>
      api.list({
        category: cat === 'all' ? undefined : cat,
        sub: sub === 'all' ? undefined : sub,
        q: q || undefined,
        sort,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData, // 筛选/翻页时保留旧列表，不闪「加载中」
    gcTime: 60_000, // 搜索词组合多，缓存别囤太久
  })

  const s = stats.data
  const total = list.data?.total ?? 0
  const items = list.data?.items ?? []
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const viewing = page <= totalPages // URL 页码越界时仍按 URL 显示计数

  return (
    <div className="view" ref={viewRef}>
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
        共 {total} 件收藏{q ? ` · 关键词「${q}」` : ''}
        {totalPages > 1 && ` · 第 ${viewing ? page : totalPages}/${totalPages} 页`}
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
          <div className="grid" key={`${cat}-${sub}-${q}-${sort}-${page}-${PAGE_SIZE}`}>
            {items.map((it, i) => (
              <ItemCard key={it.id} item={it} index={i} onOpen={onOpen} />
            ))}
          </div>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
