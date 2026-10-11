import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { useMeta } from '../hooks/queries'
import { statusLabel } from '../lib/labels'
import { useToast } from './Toast'
import type { Category, Item, ItemInput, Status, SubType } from '../types'

const STATUS_KEYS: Status[] = ['wish', 'doing', 'done']
const SUB_KEYS: SubType[] = ['game', 'anime_manga']

interface Props {
  item: Item | null
  onClose: () => void
}

export function ItemForm({ item, onClose }: Props) {
  const meta = useMeta()
  const toast = useToast()
  const qc = useQueryClient()

  const [form, setForm] = useState<ItemInput>(() =>
    item
      ? {
          title: item.title,
          category: item.category,
          sub_type: item.sub_type,
          source: item.source ?? '',
          rating: item.rating,
          status: item.status,
          favorite: item.favorite,
          tags: item.tags,
          note: item.note ?? '',
          emoji: item.emoji,
        }
      : {
          title: '',
          category: 'anime',
          sub_type: 'game',
          source: '',
          rating: 3,
          status: 'doing',
          favorite: false,
          tags: [],
          note: '',
          emoji: null,
        },
  )

  const mut = useMutation({
    mutationFn: (input: ItemInput) => (item ? api.update(item.id, input) : api.create(input)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['items'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
      toast(item ? '已保存修改' : '已加入收藏')
      onClose()
    },
    onError: (e) => toast('保存失败：' + e.message),
  })

  const save = () => {
    const title = form.title.trim()
    if (!title) {
      toast('标题不能为空哦')
      return
    }
    mut.mutate({
      ...form,
      title,
      source: form.source?.trim() || null,
      note: form.note?.trim() || null,
      sub_type: form.category === 'character' ? form.sub_type : null,
      emoji: form.emoji,
    })
  }

  return (
    <div
      className="overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal">
        <div className="m-head">
          <h2>{item ? '编辑收藏' : '添加收藏'}</h2>
        </div>
        <div className="form">
          <label>分类</label>
          <div className="seg">
            {meta.categories.map((c) => (
              <button
                key={c.key}
                className={'seg-b' + (form.category === c.key ? ' on' : '')}
                onClick={() => setForm((f) => ({ ...f, category: c.key as Category, emoji: null }))}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          {form.category === 'character' && (
            <>
              <label>角色类型（游戏人物与其他人物区分）</label>
              <div className="seg">
                {SUB_KEYS.map((k) => (
                  <button
                    key={k}
                    className={'seg-b sm' + (form.sub_type === k ? ' on' : '')}
                    onClick={() => setForm((f) => ({ ...f, sub_type: k }))}
                  >
                    {meta.sub_types[k].label}
                  </button>
                ))}
              </div>
            </>
          )}
          <label>标题 *</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="如：葬送的芙莉莲 / 雷电将军"
            autoFocus
          />
          <label>来源作品 / 作者</label>
          <input
            value={form.source ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            placeholder="如：原神 / 山田钟人"
          />
          <label>评分</label>
          <div className="star-in">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={n <= form.rating ? 'on' : ''}
                onClick={() => setForm((f) => ({ ...f, rating: n }))}
              >
                ★
              </span>
            ))}
          </div>
          <label>进度状态</label>
          <div className="seg">
            {STATUS_KEYS.map((k) => (
              <button
                key={k}
                className={'seg-b sm' + (form.status === k ? ' on' : '')}
                onClick={() => setForm((f) => ({ ...f, status: k }))}
              >
                {statusLabel(meta, form.category, k)}
              </button>
            ))}
          </div>
          <label>标签（逗号分隔）</label>
          <input
            value={form.tags.join(', ')}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                tags: e.target.value
                  .split(/[,，、]/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="科幻, 治愈, 热血"
          />
          <label>笔记</label>
          <textarea
            rows={3}
            value={form.note ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="随手记点感想…"
          />
        </div>
        <div className="m-acts">
          <button className="btn ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" onClick={save} disabled={mut.isPending}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
