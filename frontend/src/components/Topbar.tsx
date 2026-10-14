import { useEffect, useRef, useState } from 'react'
import { useFilters } from '../hooks/useFilters'

interface Props {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onAdd: () => void
  onMe: () => void
}

export function Topbar({ theme, onToggleTheme, onAdd, onMe }: Props) {
  const { q, setQ } = useFilters()
  const [text, setText] = useState(q)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    setText(q)
  }, [q])

  const onChange = (value: string) => {
    setText(value)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setQ(value), 300)
  }

  return (
    <header className="topbar">
      <div className="tb-brand">
        <span className="logo sm">C</span>
        <b>Trove</b>
      </div>
      <div className="search">
        <span>🔍</span>
        <input
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="搜索标题 / 作品 / 标签…"
        />
      </div>
      <button className="icon-btn" onClick={onToggleTheme} title="深色 / 浅色">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <button className="icon-btn" onClick={onMe} title="我的（题材与标签管理）">
        👤
      </button>
      <button className="add-btn" onClick={onAdd}>
        ＋ 添加收藏
      </button>
    </header>
  )
}
