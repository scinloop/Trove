import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { Pager } from '../components/Pager'
import { useMeta } from '../hooks/queries'
import { faviconUrl, hostOf } from '../lib/labels'
import type { Item } from '../types'

const PAGE_SIZE = 60

/** 网站栏：网址收藏专用页（favicon 自动解析 + 自定义分类筛选） */
export function SitesPage({ onOpen, onManage }: { onOpen: (it: Item) => void; onManage: () => void }) {
  const meta = useMeta()
  const [sub, setSub] = useState('all')
  const [page, setPage] = useState(1)

  const list = useQuery({
    queryKey: ['items', 'website', sub],
    queryFn: () => api.list({ category: 'website', sub: sub === 'all' ? undefined : sub }),
  })
  const sites = list.data ?? []
  const genres = meta.genres.website ?? []
  const totalPages = Math.max(1, Math.ceil(sites.length / PAGE_SIZE))
  const curPage = Math.min(page, totalPages)
  const shown = sites.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  return (
    <div className="view">
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
        共 {sites.length} 个网站{totalPages > 1 && ` · 第 ${curPage}/${totalPages} 页`}
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
          <div className="site-grid">
            {shown.map((s) => (
              <SiteCard key={s.id} item={s} onOpen={onOpen} />
            ))}
          </div>
          <Pager page={curPage} totalPages={totalPages} onChange={setPage} />
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
