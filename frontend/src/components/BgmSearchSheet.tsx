import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { BgmSearchHit } from '../types'

interface Props {
  category: string // 决定搜索哪类条目（anime/game/character…）
  initialKw: string // 用表单里已填的标题预填
  onPick: (hit: BgmSearchHit) => void
  onClose: () => void
}

/** Bangumi 刮削：搜索并选择条目（默认包含 R18，需已配置访问令牌） */
export function BgmSearchSheet({ category, initialKw, onPick, onClose }: Props) {
  const [kw, setKw] = useState(initialKw)
  const [query, setQuery] = useState(initialKw.trim())

  const q = useQuery({
    queryKey: ['bgm-search', category, query],
    queryFn: () => api.bgmSearch(query, category),
    enabled: query.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const submit = () => setQuery(kw.trim())
  const items = q.data?.items ?? []

  return (
    <div
      className="overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal bgm-sheet">
        <div className="m-head">
          <div className="m-title">
            <h2>🔍 从 Bangumi 刮削</h2>
            <button className="m-close" onClick={onClose} aria-label="关闭">
              ✕
            </button>
          </div>
        </div>

        <div className="add-row">
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder="输入作品/角色名，回车搜索"
            autoFocus
          />
          <button className="btn primary sm" onClick={submit} disabled={!kw.trim() || q.isFetching}>
            {q.isFetching ? '搜索中…' : '搜索'}
          </button>
        </div>

        {q.isError ? (
          <p className="none">搜索失败：{q.error.message}</p>
        ) : !query ? (
          <p className="none">输入名称后点「搜索」，选中结果即可自动填充并刮削档案。</p>
        ) : q.isPending ? (
          <p className="none">正在搜索「{query}」…</p>
        ) : items.length === 0 ? (
          <p className="none">没有找到「{query}」，换个关键词试试。</p>
        ) : (
          <>
            <div className="bgm-list">
              {items.map((hit) => (
                <button key={hit.bgm_id} className="bgm-hit" onClick={() => onPick(hit)}>
                  <span className="bgm-hit-img">
                    {hit.image ? <img src={hit.image} alt="" loading="lazy" /> : '🎴'}
                  </span>
                  <span className="bgm-hit-info">
                    <b>
                      {hit.name_cn || hit.name}
                      {hit.nsfw && <em className="r18">R18</em>}
                    </b>
                    {hit.name_cn && hit.name && <i>{hit.name}</i>}
                    <i>{[hit.date?.slice(0, 10), hit.platform].filter(Boolean).join(' · ') || '—'}</i>
                    {hit.tags.length > 0 && <i className="bgm-tags">{hit.tags.slice(0, 6).join(' / ')}</i>}
                  </span>
                  <span className="bgm-hit-score">
                    {hit.score ? <b>★{hit.score}</b> : null}
                    {hit.rank ? <em>#{hit.rank}</em> : null}
                  </span>
                </button>
              ))}
            </div>
            <p className="count">
              共 {q.data?.total ?? items.length} 条结果 · 已授权时默认包含 R18
            </p>
          </>
        )}
      </div>
    </div>
  )
}
