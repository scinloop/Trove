import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type KeyboardEvent } from 'react'
import { api } from '../api/client'
import { useMeta } from '../hooks/queries'
import { useToast } from './Toast'

interface Props {
  onClose: () => void
}

/** 题材库 + 标签库 管理弹层（入口：我的 → 题材与标签管理） */
export function ManageModal({ onClose }: Props) {
  const meta = useMeta()
  const toast = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'genres' | 'tags'>('genres')
  const [cat, setCat] = useState('novel')
  const [newLabel, setNewLabel] = useState('')
  const [gEdit, setGEdit] = useState<number | null>(null)
  const [gLabel, setGLabel] = useState('')
  const [tEdit, setTEdit] = useState<number | null>(null)
  const [tLabel, setTLabel] = useState('')
  const [tagSearch, setTagSearch] = useState('')

  const genresQ = useQuery({ queryKey: ['genres'], queryFn: api.genres })
  const tagsQ = useQuery({ queryKey: ['tags'], queryFn: api.tags })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['genres'] })
    void qc.invalidateQueries({ queryKey: ['tags'] })
    void qc.invalidateQueries({ queryKey: ['meta'] })
  }

  const addMut = useMutation({
    mutationFn: async () => {
      if (tab === 'genres') await api.createGenre(cat, newLabel.trim())
      else await api.createTag(newLabel.trim())
    },
    onSuccess: () => {
      setNewLabel('')
      invalidate()
      toast(tab === 'genres' ? '题材已添加' : '标签已入库')
    },
    onError: (e) => toast((e as Error).message),
  })

  const gRename = useMutation({
    mutationFn: (p: { id: number; label: string }) => api.updateGenre(p.id, { label: p.label }),
    onSuccess: () => {
      setGEdit(null)
      invalidate()
    },
    onError: (e) => toast((e as Error).message),
  })
  const gMove = useMutation({
    mutationFn: (p: { id: number; dir: 'up' | 'down' }) => api.moveGenre(p.id, p.dir),
    onSuccess: invalidate,
    onError: (e) => toast((e as Error).message),
  })
  const gDel = useMutation({
    mutationFn: (id: number) => api.deleteGenre(id),
    onSuccess: () => {
      invalidate()
      toast('已删除')
    },
    onError: (e) => toast((e as Error).message),
  })

  const tRename = useMutation({
    mutationFn: (p: { id: number; label: string }) => api.renameTag(p.id, p.label),
    onSuccess: () => {
      setTEdit(null)
      invalidate()
      toast('已重命名，条目同步更新')
    },
    onError: (e) => toast((e as Error).message),
  })
  const tDel = useMutation({
    mutationFn: (id: number) => api.deleteTag(id),
    onSuccess: () => {
      invalidate()
      toast('已从标签库移除（条目上的标签保留）')
    },
    onError: (e) => toast((e as Error).message),
  })

  const submitAdd = () => {
    if (newLabel.trim()) addMut.mutate()
  }
  const onAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submitAdd()
    }
  }

  const genres = (genresQ.data ?? []).filter((g) => g.category === cat)
  const tags = (tagsQ.data ?? []).filter((t) => !tagSearch.trim() || t.label.includes(tagSearch.trim()))
  const catLabel = meta.categories.find((c) => c.key === cat)?.label ?? cat

  return (
    <div
      className="overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal modal-lg">
        <div className="m-head">
          <h2>题材与标签管理</h2>
        </div>
        <div className="chips">
          <button className={'chip' + (tab === 'genres' ? ' on' : '')} onClick={() => setTab('genres')}>
            🎨 题材库
          </button>
          <button className={'chip' + (tab === 'tags' ? ' on' : '')} onClick={() => setTab('tags')}>
            🏷️ 标签库
          </button>
        </div>

        {tab === 'genres' && (
          <>
            <div className="chips sub">
              {meta.categories.map((c) => (
                <button
                  key={c.key}
                  className={'chip sm' + (cat === c.key ? ' on' : '')}
                  onClick={() => setCat(c.key)}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            <div className="manage-list">
              {genres.map((g, i) => (
                <div className="manage-row" key={g.id}>
                  <i className="tdot" style={{ background: g.color }} />
                  {gEdit === g.id ? (
                    <input
                      className="mi-edit"
                      value={gLabel}
                      onChange={(e) => setGLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') gRename.mutate({ id: g.id, label: gLabel })
                        if (e.key === 'Escape') setGEdit(null)
                      }}
                      autoFocus
                    />
                  ) : (
                    <b className="mi-label">{g.label}</b>
                  )}
                  <span className="grow" />
                  {gEdit === g.id ? (
                    <>
                      <button className="mini-btn primary" onClick={() => gRename.mutate({ id: g.id, label: gLabel })}>
                        保存
                      </button>
                      <button className="mini-btn" onClick={() => setGEdit(null)}>
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="mini-btn" disabled={i === 0} onClick={() => gMove.mutate({ id: g.id, dir: 'up' })}>
                        ↑
                      </button>
                      <button
                        className="mini-btn"
                        disabled={i === genres.length - 1}
                        onClick={() => gMove.mutate({ id: g.id, dir: 'down' })}
                      >
                        ↓
                      </button>
                      <button
                        className="mini-btn"
                        onClick={() => {
                          setGEdit(g.id)
                          setGLabel(g.label)
                        }}
                      >
                        改名
                      </button>
                      <button className="mini-btn danger" onClick={() => gDel.mutate(g.id)}>
                        删除
                      </button>
                    </>
                  )}
                </div>
              ))}
              {genres.length === 0 && <p className="none">该分类还没有题材，在下方添加一个吧</p>}
            </div>
          </>
        )}

        {tab === 'tags' && (
          <>
            <input
              className="m-search"
              placeholder="搜索标签…"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
            />
            <div className="manage-list">
              {tags.map((t) => (
                <div className="manage-row" key={t.id}>
                  <i className="tdot" style={{ background: t.color }} />
                  {tEdit === t.id ? (
                    <input
                      className="mi-edit"
                      value={tLabel}
                      onChange={(e) => setTLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') tRename.mutate({ id: t.id, label: tLabel })
                        if (e.key === 'Escape') setTEdit(null)
                      }}
                      autoFocus
                    />
                  ) : (
                    <b className="mi-label">{t.label}</b>
                  )}
                  <span className="mi-usage">{t.usage} 处</span>
                  <span className="grow" />
                  {tEdit === t.id ? (
                    <>
                      <button className="mini-btn primary" onClick={() => tRename.mutate({ id: t.id, label: tLabel })}>
                        保存
                      </button>
                      <button className="mini-btn" onClick={() => setTEdit(null)}>
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="mini-btn"
                        onClick={() => {
                          setTEdit(t.id)
                          setTLabel(t.label)
                        }}
                      >
                        改名
                      </button>
                      <button className="mini-btn danger" onClick={() => tDel.mutate(t.id)}>
                        删除
                      </button>
                    </>
                  )}
                </div>
              ))}
              {tags.length === 0 && <p className="none">没有匹配的标签</p>}
            </div>
          </>
        )}

        <div className="form tight">
          <label>{tab === 'genres' ? `给「${catLabel}」添加题材` : '添加新标签'}</label>
          <div className="add-row">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={onAddKey}
              placeholder={tab === 'genres' ? '如：无限流' : '如：泪目'}
              autoFocus
            />
            <button className="btn primary sm" onClick={submitAdd} disabled={!newLabel.trim() || addMut.isPending}>
              添加
            </button>
          </div>
        </div>

        <div className="m-acts">
          <button className="btn primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
