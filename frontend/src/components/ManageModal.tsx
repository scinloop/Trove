import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { api } from '../api/client'
import { useMeta } from '../hooks/queries'
import { useToast } from './Toast'

interface Props {
  onClose: () => void
  initialCat?: string // 打开时预选的分类（如从网站栏进入 → website）
}

/** 题材库 + 标签库 + 主分类 + 标签分组 管理弹层（入口：我的 → 题材与标签管理 / 网站栏 → 管理分类） */
export function ManageModal({ onClose, initialCat }: Props) {
  const meta = useMeta()
  const toast = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'cats' | 'genres' | 'tags'>('genres')
  const [cat, setCat] = useState(initialCat ?? 'novel')
  const [newLabel, setNewLabel] = useState('')
  const [newTagGroup, setNewTagGroup] = useState('') // '' = 未分组
  const [gEdit, setGEdit] = useState<number | null>(null)
  const [gLabel, setGLabel] = useState('')
  const [tEdit, setTEdit] = useState<number | null>(null)
  const [tLabel, setTLabel] = useState('')
  const [tGroup, setTGroup] = useState('') // 编辑标签时的分组
  const [tagSearch, setTagSearch] = useState('')
  const [groupsOpen, setGroupsOpen] = useState(false) // 标签分组管理折叠区

  // 主分类编辑状态
  const [cEdit, setCEdit] = useState<string | null>(null) // 编辑中的分类 key
  const [cLabel, setCLabel] = useState('')
  const [cEmoji, setCEmoji] = useState('')
  const [cColor, setCColor] = useState('')
  const [newCat, setNewCat] = useState({ label: '', emoji: '', color: '' })

  // 标签分组编辑状态
  const [tgEdit, setTgEdit] = useState<number | null>(null)
  const [tgName, setTgName] = useState('')
  const [newGroupName, setNewGroupName] = useState('')

  const genresQ = useQuery({ queryKey: ['genres'], queryFn: api.genres })
  const tagsQ = useQuery({ queryKey: ['tags'], queryFn: api.tags })
  const catsQ = useQuery({ queryKey: ['categories'], queryFn: api.categories })
  const tagGroupsQ = useQuery({ queryKey: ['tag-groups'], queryFn: api.tagGroups })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['genres'] })
    void qc.invalidateQueries({ queryKey: ['tags'] })
    void qc.invalidateQueries({ queryKey: ['meta'] })
    void qc.invalidateQueries({ queryKey: ['categories'] })
    void qc.invalidateQueries({ queryKey: ['tag-groups'] })
    void qc.invalidateQueries({ queryKey: ['items'] })
    void qc.invalidateQueries({ queryKey: ['stats'] })
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

  // ---- 主分类 ----
  const catCreate = useMutation({
    mutationFn: () =>
      api.createCategory({
        label: newCat.label.trim(),
        emoji: newCat.emoji.trim() || undefined,
        color: newCat.color.trim() || undefined,
      }),
    onSuccess: (c) => {
      setNewCat({ label: '', emoji: '', color: '' })
      invalidate()
      toast(`已添加分类「${c.label}」，现在可以往里加题材了`)
    },
    onError: (e) => toast((e as Error).message),
  })
  const catUpdate = useMutation({
    mutationFn: (p: { key: string }) =>
      api.updateCategory(p.key, {
        label: cLabel.trim() || undefined,
        emoji: cEmoji.trim() || undefined,
        color: cColor.trim() || undefined,
      }),
    onSuccess: () => {
      setCEdit(null)
      invalidate()
      toast('已保存')
    },
    onError: (e) => toast((e as Error).message),
  })
  const catMove = useMutation({
    mutationFn: (p: { key: string; dir: 'up' | 'down' }) => api.moveCategory(p.key, p.dir),
    onSuccess: invalidate,
    onError: (e) => toast((e as Error).message),
  })
  const catDel = useMutation({
    mutationFn: (key: string) => api.deleteCategory(key),
    onSuccess: () => {
      invalidate()
      toast('已删除分类')
    },
    onError: (e) => toast((e as Error).message),
  })

  // ---- 标签分组 ----
  const tgCreate = useMutation({
    mutationFn: () => api.createTagGroup(newGroupName.trim()),
    onSuccess: (g) => {
      setNewGroupName('')
      invalidate()
      toast(`已添加分组「${g.name}」`)
    },
    onError: (e) => toast((e as Error).message),
  })
  const tgRename = useMutation({
    mutationFn: (p: { id: number; name: string }) => api.renameTagGroup(p.id, p.name),
    onSuccess: () => {
      setTgEdit(null)
      invalidate()
      toast('分组已改名，标签同步更新')
    },
    onError: (e) => toast((e as Error).message),
  })
  const tgDel = useMutation({
    mutationFn: (id: number) => api.deleteTagGroup(id),
    onSuccess: (r) => {
      invalidate()
      toast(`已删除分组（${r.moved_to_ungrouped} 个标签移入未分组）`)
    },
    onError: (e) => toast((e as Error).message),
  })
  const tgMove = useMutation({
    mutationFn: (p: { id: number; dir: 'up' | 'down' }) => api.moveTagGroup(p.id, p.dir),
    onSuccess: invalidate,
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
  const catsList = catsQ.data ?? []
  const groupsList = tagGroupsQ.data ?? []

  // 标签分组：分组表 → 库中其他组 → 未分组
  const library = tagsQ.data ?? []
  const tagGroupNames = useMemo(() => {
    const known = groupsList.map((g) => g.name)
    const extras = [
      ...new Set(library.map((t) => t.group).filter((g): g is string => !!g && !known.includes(g))),
    ]
    const hasUngrouped = library.some((t) => !t.group)
    return [...known, ...extras, ...(hasUngrouped ? ['未分组'] : [])]
  }, [groupsList, library])
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
          <button className={'chip' + (tab === 'cats' ? ' on' : '')} onClick={() => setTab('cats')}>
            🗂️ 主分类
          </button>
          <button className={'chip' + (tab === 'genres' ? ' on' : '')} onClick={() => setTab('genres')}>
            🎨 题材库
          </button>
          <button className={'chip' + (tab === 'tags' ? ' on' : '')} onClick={() => setTab('tags')}>
            🏷️ 标签库
          </button>
        </div>

        {tab === 'cats' && (
          <>
            <p className="none">左侧收藏墙的主分类，可以自由增删改和排序；删除前需清空该分类下的收藏与题材。</p>
            <div className="manage-list">
              {catsList.map((c, i) => (
                <div className="manage-row" key={c.key}>
                  <i className="tdot" style={{ background: c.color }} />
                  {cEdit === c.key ? (
                    <>
                      <input
                        className="mi-edit"
                        style={{ width: '5em', textAlign: 'center' }}
                        value={cEmoji}
                        onChange={(e) => setCEmoji(e.target.value)}
                        placeholder="emoji"
                        autoFocus
                      />
                      <input
                        className="mi-edit"
                        value={cLabel}
                        onChange={(e) => setCLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') catUpdate.mutate({ key: c.key })
                          if (e.key === 'Escape') setCEdit(null)
                        }}
                        placeholder="名称"
                      />
                      <input
                        className="mi-edit"
                        style={{ width: '6em' }}
                        value={cColor}
                        onChange={(e) => setCColor(e.target.value)}
                        placeholder="#颜色"
                      />
                    </>
                  ) : (
                    <b className="mi-label">
                      {c.emoji} {c.label}
                      {c.note && <small className="mi-note">{c.note}</small>}
                    </b>
                  )}
                  <span className="grow" />
                  {cEdit === c.key ? (
                    <>
                      <button className="mini-btn primary" onClick={() => catUpdate.mutate({ key: c.key })}>
                        保存
                      </button>
                      <button className="mini-btn" onClick={() => setCEdit(null)}>
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="mini-btn"
                        disabled={i === 0}
                        onClick={() => catMove.mutate({ key: c.key, dir: 'up' })}
                      >
                        ↑
                      </button>
                      <button
                        className="mini-btn"
                        disabled={i === catsList.length - 1}
                        onClick={() => catMove.mutate({ key: c.key, dir: 'down' })}
                      >
                        ↓
                      </button>
                      <button
                        className="mini-btn"
                        onClick={() => {
                          setCEdit(c.key)
                          setCLabel(c.label)
                          setCEmoji(c.emoji)
                          setCColor(c.color)
                        }}
                      >
                        编辑
                      </button>
                      <button className="mini-btn danger" onClick={() => catDel.mutate(c.key)}>
                        删除
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'genres' && (
          <>
            <div className="chips sub wrap">
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
            <button className="tg-toggle" onClick={() => setGroupsOpen((v) => !v)}>
              {groupsOpen ? '▾' : '▸'} 分组管理（{groupsList.length} 组）
            </button>
            {groupsOpen && (
              <div className="manage-list tg-box">
                {groupsList.map((g, i) => (
                  <div className="manage-row" key={g.id}>
                    {tgEdit === g.id ? (
                      <input
                        className="mi-edit"
                        value={tgName}
                        onChange={(e) => setTgName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') tgRename.mutate({ id: g.id, name: tgName })
                          if (e.key === 'Escape') setTgEdit(null)
                        }}
                        autoFocus
                      />
                    ) : (
                      <b className="mi-label">{g.name}</b>
                    )}
                    <span className="mi-usage">{g.tag_count} 标签</span>
                    <span className="grow" />
                    {tgEdit === g.id ? (
                      <>
                        <button className="mini-btn primary" onClick={() => tgRename.mutate({ id: g.id, name: tgName })}>
                          保存
                        </button>
                        <button className="mini-btn" onClick={() => setTgEdit(null)}>
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="mini-btn"
                          disabled={i === 0}
                          onClick={() => tgMove.mutate({ id: g.id, dir: 'up' })}
                        >
                          ↑
                        </button>
                        <button
                          className="mini-btn"
                          disabled={i === groupsList.length - 1}
                          onClick={() => tgMove.mutate({ id: g.id, dir: 'down' })}
                        >
                          ↓
                        </button>
                        <button
                          className="mini-btn"
                          onClick={() => {
                            setTgEdit(g.id)
                            setTgName(g.name)
                          }}
                        >
                          改名
                        </button>
                        <button className="mini-btn danger" onClick={() => tgDel.mutate(g.id)}>
                          删除
                        </button>
                      </>
                    )}
                  </div>
                ))}
                <div className="manage-row">
                  <input
                    className="mi-edit"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newGroupName.trim()) tgCreate.mutate()
                    }}
                    placeholder="新分组名，如：口味"
                  />
                  <span className="grow" />
                  <button
                    className="mini-btn primary"
                    disabled={!newGroupName.trim() || tgCreate.isPending}
                    onClick={() => tgCreate.mutate()}
                  >
                    添加分组
                  </button>
                </div>
                <p className="none">删除分组会把组内标签移到「未分组」，不会删标签本身。</p>
              </div>
            )}
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
                            {groupsList.map((g) => (
                              <option key={g.id} value={g.name}>
                                {g.name}
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

        {tab === 'cats' ? (
          <div className="form tight">
            <label>添加主分类</label>
            <div className="add-row">
              <input
                className="mi-edit"
                style={{ width: '4.5em', textAlign: 'center' }}
                value={newCat.emoji}
                onChange={(e) => setNewCat((f) => ({ ...f, emoji: e.target.value }))}
                placeholder="emoji"
              />
              <input
                value={newCat.label}
                onChange={(e) => setNewCat((f) => ({ ...f, label: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCat.label.trim()) catCreate.mutate()
                }}
                placeholder="名称，如：播客"
                autoFocus
              />
              <input
                className="mi-edit"
                style={{ width: '6em' }}
                value={newCat.color}
                onChange={(e) => setNewCat((f) => ({ ...f, color: e.target.value }))}
                placeholder="#颜色"
              />
              <button
                className="btn primary sm"
                onClick={() => catCreate.mutate()}
                disabled={!newCat.label.trim() || catCreate.isPending}
              >
                添加
              </button>
            </div>
          </div>
        ) : (
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
                  {groupsList.map((g) => (
                    <option key={g.id} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
              <button className="btn primary sm" onClick={submitAdd} disabled={!newLabel.trim() || addMut.isPending}>
                添加
              </button>
            </div>
          </div>
        )}

        <div className="m-acts">
          <button className="btn primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
