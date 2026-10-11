import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type KeyboardEvent } from 'react'
import { api } from '../api/client'

interface Props {
  value: string[]
  onChange: (tags: string[]) => void
}

/** 标签选择器：从标签库点选 + 输入新词回车入库 */
export function TagPicker({ value, onChange }: Props) {
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const tagsQ = useQuery({ queryKey: ['tags'], queryFn: api.tags })
  const library = tagsQ.data ?? []

  const addMut = useMutation({
    mutationFn: (label: string) => api.createTag(label),
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
      addMut.mutate(label)
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

  const suggestions = library
    .filter((t) => !value.includes(t.label) && (!input || t.label.includes(input.trim())))
    .slice(0, 10)

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
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        placeholder={value.length ? '继续添加…' : '搜索或输入新标签，回车创建'}
      />
      {suggestions.length > 0 && (
        <div className="tagpick-sug">
          {suggestions.map((t) => (
            <button key={t.id} className="chip sm" onClick={() => add(t.label)}>
              <i className="tdot" style={{ background: t.color }} />
              {t.label}
              <em>{t.usage}</em>
            </button>
          ))}
        </div>
      )}
      {addMut.isError && <span className="tp-err">标签创建失败</span>}
    </div>
  )
}
