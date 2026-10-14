import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { api } from '../api/client'
import { Pager } from '../components/Pager'
import { useColumns } from '../hooks/useColumns'
import { useMeta } from '../hooks/queries'
import { faviconUrl, hostOf } from '../lib/labels'
import type { Item } from '../types'

const ROWS = 6 // 每页行数：手机 1 列 × 6 = 6 个/页；桌面 4-5 列 × 6 ≈ 24-30 个/页

/** 网站栏：网址收藏专用页（favicon 自动解析 + 自定义分类筛选） */
export function SitesPage({ onOpen, onManage }: { onOpen: (it: Item) => void; onManage: () => void }) {
  const meta = useMeta()
  const [sub, setSub] = useState('all')
  const [page, setPage] = useState(1)
  const viewRef = useRef<HTMLDivElement>(null)
  // 列数与 CSS auto-fill 网格一致 → 每页铺满整行
  const cols = useColumns(viewRef, { mobile: 1, min: 240, gap: 12 })
  const PAGE_SIZE = cols * ROWS

  const list = useQuery({
    queryKey: ['items', 'website', sub, page, PAGE_SIZE],
    queryFn: () =>
      api.list({
        category: 'website',
        sub: sub === 'all' ? undefined : sub,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    gcTime: 60_000,
  })
  const sites = list.data?.items ?? []
  const total = list.data?.total ?? 0
  const genres = meta.genres.website ?? []
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="view" ref={viewRef}>
      <h2 className="v-title">🌐 网站栏</h2>
      <div className="chips sub wrap">
        <button className={'chip' + (sub === 'all' ? ' on' : '')} onClick={() => { setSub('all'); setPage(1) }}>
          ✨ 全部
        </button>
        {genres.map((g) => (
          <button key={g.key} className={'chip' + (sub === g.key ? ' on' : '')} onClick={() => { setSub(g.key); setPage(1) }}>
            {g.label}
          </button>
        ))}
        <button className="chip sm" onClick={onManage} title="添加 / 编辑分类">
          ⚙️ 管理分类
        </button>
      </div>
      <p className="count">
        共 {total} 个网站{totalPages > 1 && ` · 第 ${page}/${totalPages} 页`}
      </p>
      {list.isError ? (
        <p className="count">加载失败：{list.error.message}</p>
      ) : list.isPending ? (
        <p className="count">加载中…</p>
      ) : sites.length === 0 ? (
        <div className="grid">
          <div className="empty">
            <div className="e-art">🌐</div>
            <p>还没有收藏网站</p>
            <span>点 ＋ 添加，填上网址即可自动抓取站点图标</span>
          </div>
        </div>
      ) : (
        <>
          <div className="site-grid" key={`${sub}-${page}`}>
            {sites.map((s) => (
              <SiteCard key={s.id} item={s} onOpen={onOpen} />
            ))}
          </div>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}

function SiteCard({ item, onOpen }: { item: Item; onOpen: (it: Item) => void }) {
  const [err, setErr] = useState(false)
  const host = hostOf(item.url)
  const src = faviconUrl(item.url)

  return (
    <article className="site-card" onClick={() => onOpen(item)}>
      <span className="site-ico">
        {src && !err ? (
          <img src={src} alt="" loading="lazy" onError={() => setErr(true)} />
        ) : (
          <span>🌐</span>
        )}
      </span>
      <div className="site-info">
        <b>{item.title}</b>
        <i>{host ?? ''}</i>
      </div>
      <a
        className="site-go"
        href={item.url ?? '#'}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label="打开网站"
      >
        ↗
      </a>
    </article>
  )
}
