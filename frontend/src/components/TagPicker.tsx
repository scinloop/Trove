import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { api } from '../api/client'
import { useMeta } from '../hooks/queries'

interface Props {
  value: string[]
  onChange: (tags: string[]) => void
}

/** 标签选择器：按分组展示标签库，点选挂标签；输入新词回车入库（可先选分组） */
export function TagPicker({ value, onChange }: Props) {
  const meta = useMeta()
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [newGroup, setNewGroup] = useState('') // '' = 未分组
  const tagsQ = useQuery({ queryKey: ['tags'], queryFn: api.tags })
  const library = tagsQ.data ?? []

  const addMut = useMutation({
    mutationFn: (p: { label: string; group: string | null }) => api.createTag(p.label, p.group),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tags'] }),
  })

  const add = (raw: string) => {
    const label = raw.trim()
    if (!label) return
    if (value.includes(label)) {
      setInput('')
      return
    }
    if (!library.some((t) => t.label === label)) {
      addMut.mutate({ label, group: newGroup || null })
    }
    onChange([...value, label])
    setInput('')
  }

  const remove = (label: string) => onChange(value.filter((t) => t !== label))

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      add(input)
    }
  }

  // 分组顺序：meta 定义在前 → 库里出现过的其他组 → 未分组
  const groups = useMemo(() => {
    const known = [...meta.tag_groups]
    const extras = [...new Set(library.map((t) => t.group).filter((g): g is string => !!g && !known.includes(g)))]
    const hasUngrouped = library.some((t) => !t.group)
    return [...known, ...extras, ...(hasUngrouped ? ['未分组'] : [])]
  }, [meta.tag_groups, library])

  const kw = input.trim()
  const colorOf = (label: string) => library.find((t) => t.label === label)?.color ?? '#71717a'

  return (
    <div className="tagpick">
      {value.length > 0 && (
        <div className="tagpick-sel">
          {value.map((t) => (
            <button key={t} className="tagchip" onClick={() => remove(t)} title="移除">
              <i style={{ background: colorOf(t) }} />#{t} ×
            </button>
          ))}
        </div>
      )}
      <div className="tp-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={value.length ? '继续添加…' : '搜索或输入新标签，回车创建'}
        />
        <select value={newGroup} onChange={(e) => setNewGroup(e.target.value)} title="新标签的分组">
          <option value="">未分组</option>
          {meta.tag_groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      {kw && (
        <div className="tp-hint">
          回车创建「{kw}」{newGroup ? `（分组：${newGroup}）` : '（未分组）'}
        </div>
      )}
      {groups.map((group) => {
        const inGroup = library.filter(
          (t) => (group === '未分组' ? !t.group : t.group === group) && !value.includes(t.label),
        )
        if (inGroup.length === 0) return null
        return (
          <div className="tp-group" key={group}>
            <b className="tp-group-label">{group}</b>
            <div className="tagpick-sug">
              {inGroup.map((t) => (
                <button key={t.id} className="chip sm" onClick={() => add(t.label)}>
                  <i className="tdot" style={{ background: t.color }} />
                  {t.label}
                  <em>{t.usage}</em>
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {addMut.isError && <span className="tp-err">标签创建失败</span>}
    </div>
  )
}
