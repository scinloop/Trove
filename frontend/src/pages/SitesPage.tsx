import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { useMeta } from '../hooks/queries'
import { faviconUrl, hostOf } from '../lib/labels'
import type { Item } from '../types'

/** 网站栏：网址收藏专用页（favicon 自动解析 + 自定义分类筛选） */
export function SitesPage({ onOpen }: { onOpen: (it: Item) => void }) {
  const meta = useMeta()
  const [sub, setSub] = useState('all')

  const list = useQuery({
    queryKey: ['items', 'website', sub],
    queryFn: () => api.list({ category: 'website', sub: sub === 'all' ? undefined : sub }),
  })
  const sites = list.data ?? []
  const genres = meta.genres.website ?? []

  return (
    <div className="view">
      <h2 className="v-title">🌐 网站栏</h2>
      <div className="chips sub">
        <button className={'chip' + (sub === 'all' ? ' on' : '')} onClick={() => setSub('all')}>
          ✨ 全部
        </button>
        {genres.map((g) => (
          <button key={g.key} className={'chip' + (sub === g.key ? ' on' : '')} onClick={() => setSub(g.key)}>
            {g.label}
          </button>
        ))}
      </div>
      <p className="count">共 {sites.length} 个网站</p>
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
        <div className="site-grid">
          {sites.map((s) => (
            <SiteCard key={s.id} item={s} onOpen={onOpen} />
          ))}
        </div>
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
