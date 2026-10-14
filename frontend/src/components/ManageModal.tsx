import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type KeyboardEvent } from 'react'
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
  const [newTagGroup, setNewTagGroup] = useState('') // '' = 未分组
  const [gEdit, setGEdit] = useState<number | null>(null)
  const [gLabel, setGLabel] = useState('')
  const [tEdit, setTEdit] = useState<number | null>(null)
  const [tLabel, setTLabel] = useState('')
  const [tGroup, setTGroup] = useState('') // 编辑标签时的分组
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
      else await api.createTag(newLabel.trim(), newTagGroup || null)
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
    mutationFn: (p: { id: number; label: string; group: string | null }) =>
      api.renameTag(p.id, p.label, p.group),
    onSuccess: () => {
      setTEdit(null)
      invalidate()
      toast('已保存，条目同步更新')
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
  const catLabel = meta.categories.find((c) => c.key === cat)?.label ?? cat

  // 标签分组：meta 定义 → 库中其他组 → 未分组
  const library = tagsQ.data ?? []
  const tagGroupNames = useMemo(() => {
    const known = [...meta.tag_groups]
    const extras = [
      ...new Set(library.map((t) => t.group).filter((g): g is string => !!g && !known.includes(g))),
    ]
    const hasUngrouped = library.some((t) => !t.group)
    return [...known, ...extras, ...(hasUngrouped ? ['未分组'] : [])]
  }, [meta.tag_groups, library])
  const kw = tagSearch.trim()
  const groupsWithData = tagGroupNames
    .map((name) => ({
      name,
      tags: library.filter(
        (t) =>
          (name === '未分组' ? !t.group : t.group === name) && (!kw || t.label.includes(kw)),
      ),
    }))
    .filter((g) => g.tags.length > 0)

  return (
    // 管理弹层：点遮罩不关闭（含增删改操作，防止误触中断），用「关闭」按钮退出
    <div className="overlay show">
      <div className="modal modal-lg">
        <div className="m-head">
          <div className="m-title">
            <h2>题材与标签管理</h2>
            <button className="m-close" onClick={onClose} aria-label="关闭">
              ✕
            </button>
          </div>
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
              {groupsWithData.map((group) => (
                <div className="mi-group" key={group.name}>
                  <b className="mi-group-label">{group.name}</b>
                  {group.tags.map((t) => (
                    <div className="manage-row" key={t.id}>
                      <i className="tdot" style={{ background: t.color }} />
                      {tEdit === t.id ? (
                        <>
                          <input
                            className="mi-edit"
                            value={tLabel}
                            onChange={(e) => setTLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter')
                                tRename.mutate({ id: t.id, label: tLabel, group: tGroup || null })
                              if (e.key === 'Escape') setTEdit(null)
                            }}
                            autoFocus
                          />
                          <select
                            className="mi-select"
                            value={tGroup}
                            onChange={(e) => setTGroup(e.target.value)}
                            title="分组"
                          >
                            <option value="">未分组</option>
                            {meta.tag_groups.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <b className="mi-label">{t.label}</b>
                      )}
                      <span className="mi-usage">{t.usage} 处</span>
                      <span className="grow" />
                      {tEdit === t.id ? (
                        <>
                          <button
                            className="mini-btn primary"
                            onClick={() => tRename.mutate({ id: t.id, label: tLabel, group: tGroup || null })}
                          >
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
                              setTGroup(t.group ?? '')
                            }}
                          >
                            编辑
                          </button>
                          <button className="mini-btn danger" onClick={() => tDel.mutate(t.id)}>
                            删除
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              {groupsWithData.length === 0 && <p className="none">没有匹配的标签</p>}
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
            {tab === 'tags' && (
              <select
                className="mi-select"
                value={newTagGroup}
                onChange={(e) => setNewTagGroup(e.target.value)}
                title="新标签的分组"
              >
                <option value="">未分组</option>
                {meta.tag_groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
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
