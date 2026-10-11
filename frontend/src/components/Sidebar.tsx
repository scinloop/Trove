import { NavLink } from 'react-router-dom'
import { useFilters } from '../hooks/useFilters'
import { useMeta, useStats } from '../hooks/queries'
import { IconStats, IconTasks, IconWall } from './Icons'
import type { Category } from '../types'

export function Sidebar() {
  const meta = useMeta()
  const stats = useStats()
  const { cat, setCat } = useFilters()
  const byCat = stats.data?.by_category as Record<string, number> | undefined
  const total = stats.data?.total ?? 0

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="logo">T</span>
        <div>
          <b>Trove</b>
          <i>个人收藏站</i>
        </div>
      </div>
      <nav className="side-nav">
        <NavLink to="/" end className={({ isActive }) => 'snav' + (isActive ? ' on' : '')}>
          <IconWall size={16} />收藏墙
        </NavLink>
        <NavLink to="/tasks" className={({ isActive }) => 'snav' + (isActive ? ' on' : '')}>
          <IconTasks size={16} />任务
        </NavLink>
        <NavLink to="/stats" className={({ isActive }) => 'snav' + (isActive ? ' on' : '')}>
          <IconStats size={16} />统计
        </NavLink>
      </nav>
      <div className="side-sec">分类</div>
      <nav className="cats">
        <button className={'cat' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>
          <span className="cat-l">
            <span>✨ 全部</span>
          </span>
          <b>{total}</b>
        </button>
        {meta.categories.map((c) => (
          <button
            key={c.key}
            className={'cat' + (cat === c.key ? ' on' : '')}
            onClick={() => setCat(c.key as Category)}
          >
            <span className="cat-l">
              <span>
                {c.emoji} {c.label}
              </span>
              {c.note && <small>{c.note}</small>}
            </span>
            <b>{byCat?.[c.key] ?? 0}</b>
          </button>
        ))}
      </nav>
      <div className="side-foot">
        <span>Trove v0.2 · React + FastAPI + SQLite</span>
      </div>
    </aside>
  )
}
