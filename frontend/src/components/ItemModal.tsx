import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { useMeta } from '../hooks/queries'
import { catOf, statusLabel } from '../lib/labels'
import { useToast } from './Toast'
import type { Item, ItemInput } from '../types'

interface Props {
  item: Item
  onClose: () => void
  onEdit: (it: Item) => void
}

export function ItemModal({ item, onClose, onEdit }: Props) {
  const meta = useMeta()
  const toast = useToast()
  const qc = useQueryClient()
  const [fav, setFav] = useState(item.favorite)

  const cat = catOf(meta, item.category)
  const color = cat?.color ?? '#71717a'
  const subMeta = item.category === 'character' && item.sub_type ? meta.sub_types[item.sub_type] : null

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
        sub_type: item.sub_type,
        source: item.source,
        rating: item.rating,
        status: item.status,
        favorite: item.favorite,
        tags: item.tags,
        note: item.note,
        emoji: item.emoji,
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
        <div className="m-cover" style={{ background: `${color}14` }}>
          <span>{item.emoji ?? cat?.emoji ?? '🎴'}</span>
        </div>
        <div className="m-head">
          <h2>{item.title}</h2>
          <div className="m-badges">
            <span className="pill">
              <i style={{ background: color }} />
              {cat?.label ?? item.category}
            </span>
            {subMeta && (
              <span className="pill">
                <i style={{ background: subMeta.color }} />
                {subMeta.label}
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
          <button className="btn ghost danger" onClick={() => delMut.mutate()} disabled={delMut.isPending}>
            删除
          </button>
          <button className="btn primary" onClick={() => onEdit(item)}>
            编辑
          </button>
        </div>
      </div>
    </div>
  )
}
