import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { useMeta } from '../hooks/queries'
import { catOf, fmtWords, acquireOf, faviconUrl, genresOf, hostOf, statusLabel, workStatusOf } from '../lib/labels'
import { useToast } from './Toast'
import type { Item, ItemInput } from '../types'

interface Props {
  item: Item
  onClose: () => void
  onEdit: (it: Item) => void
  onRead: (it: Item) => void
  onManageChapters: (it: Item) => void
}

export function ItemModal({ item, onClose, onEdit, onRead, onManageChapters }: Props) {
  const meta = useMeta()
  const toast = useToast()
  const qc = useQueryClient()
  const [fav, setFav] = useState(item.favorite)
  const [favErr, setFavErr] = useState(false)

  const cat = catOf(meta, item.category)
  const color = cat?.color ?? '#71717a'
  const subMetas = genresOf(meta, item.category, item.sub_types)
  const ws = workStatusOf(meta, item.work_status)
  const ac = item.category === 'character' ? acquireOf(meta, item.acquire) : null

  const isNovel = item.category === 'novel'
  const isWebsite = item.category === 'website'
  const host = hostOf(item.url)
  const favSrc = isWebsite ? faviconUrl(item.url) : null
  const chaptersQ = useQuery({
    queryKey: ['chapters', item.id],
    queryFn: () => api.chapters(item.id),
    enabled: isNovel,
  })
  const chapters = chaptersQ.data ?? []
  const totalWords = chapters.reduce((s, c) => s + c.word_count, 0)

  const favMut = useMutation({
    mutationFn: (favorite: boolean) => api.update(item.id, { favorite }),
    onError: (e) => {
      setFav(item.favorite)
      toast('操作失败：' + e.message)
    },
  })

  const delMut = useMutation({
    mutationFn: () => api.remove(item.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['items'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
      onClose()
      const input: ItemInput = {
        title: item.title,
        category: item.category,
        sub_types: item.sub_types,
        work_status: item.work_status,
        acquire: item.acquire,
        url: item.url,
        source: item.source,
        rating: item.rating,
        status: item.status,
        favorite: item.favorite,
        tags: item.tags,
        note: item.note,
        emoji: item.emoji,
        image_url: item.image_url,
      }
      toast(`已删除「${item.title}」`, {
        label: '撤销',
        run: () => {
          void api
            .create(input)
            .then(() => {
              void qc.invalidateQueries({ queryKey: ['items'] })
              void qc.invalidateQueries({ queryKey: ['stats'] })
            })
            .catch(() => toast('恢复失败'))
        },
      })
    },
    onError: (e) => toast('删除失败：' + e.message),
  })

  return (
    <div
      className="overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal">
        <div className="m-cover" style={item.image_url ? undefined : { background: `${color}14` }}>
          {item.image_url ? (
            <img className="m-cover-img" src={item.image_url} alt={item.title} />
          ) : favSrc && !favErr ? (
            <img
              className="m-cover-fav"
              src={favSrc}
              alt={item.title}
              onError={() => setFavErr(true)}
            />
          ) : (
            <span>{item.emoji ?? cat?.emoji ?? '🎴'}</span>
          )}
        </div>
        <div className="m-head">
          <h2>{item.title}</h2>
          <div className="m-badges">
            <span className="pill">
              <i style={{ background: color }} />
              {cat?.label ?? item.category}
            </span>
            {subMetas.map((g) => (
              <span className="pill" key={g.key}>
                <i style={{ background: g.color }} />
                {g.label}
              </span>
            ))}
            {ws && (
              <span className="pill">
                <i style={{ background: ws.color }} />
                {ws.label}
              </span>
            )}
            {ac && (
              <span className="pill">
                <i style={{ background: ac.color }} />
                {ac.label}
              </span>
            )}
            <span className="pill">
              <i style={{ background: meta.status_colors[item.status] ?? '#71717a' }} />
              {statusLabel(meta, item.category, item.status)}
            </span>
            <button
              className={'fav-btn' + (fav ? ' on' : '')}
              onClick={() => {
                const next = !fav
                setFav(next)
                favMut.mutate(next)
              }}
            >
              {fav ? '♥ 已喜爱' : '♡ 设为喜爱'}
            </button>
          </div>
          <p className="stars big">
            {'★'.repeat(item.rating)}
            {'☆'.repeat(5 - item.rating)}
            <b>{item.rating}.0</b>
          </p>
        </div>
        <div className="m-grid">
          {isWebsite && (
            <div className="m-row">
              <i>网址</i>
              <span className="m-url">
                <a href={item.url ?? '#'} target="_blank" rel="noreferrer">
                  {host ?? item.url}
                </a>
              </span>
            </div>
          )}
          <div className="m-row">
            <i>来源</i>
            <span>{item.source || '—'}</span>
          </div>
          <div className="m-row">
            <i>标签</i>
            <span>
              {item.tags.length > 0
                ? item.tags.map((t) => (
                    <em className="tag" key={t}>
                      #{t}
                    </em>
                  ))
                : '—'}
            </span>
          </div>
          {isNovel && (
            <div className="m-row">
              <i>正文</i>
              <span>
                {chapters.length > 0 ? `${chapters.length} 章 · ${fmtWords(totalWords)}` : '未导入'}
              </span>
            </div>
          )}
          <div className="m-row">
            <i>收藏于</i>
            <span>{item.created_at.slice(0, 10)}</span>
          </div>
        </div>
        <div className="m-note">
          <i>笔记</i>
          <p>{item.note || '还没有写笔记…'}</p>
        </div>
        <div className="m-acts">
          <button className="btn ghost" onClick={onClose}>
            关闭
          </button>
          <button className="btn ghost" onClick={() => onEdit(item)}>
            编辑
          </button>
          {isNovel && (
            <button className="btn ghost" onClick={() => onManageChapters(item)}>
              章节管理
            </button>
          )}
          <button className="btn ghost danger" onClick={() => delMut.mutate()} disabled={delMut.isPending}>
            删除
          </button>
          {isNovel && (
            <button className="btn primary" onClick={() => onRead(item)}>
              {chapters.length > 0 ? '📖 阅读' : '📄 导入正文'}
            </button>
          )}
          {isWebsite && (
            <a className="btn primary" href={item.url ?? '#'} target="_blank" rel="noreferrer">
              打开网站 ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
