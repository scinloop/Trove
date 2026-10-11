import { NavLink } from 'react-router-dom'

interface Props {
  onAdd: () => void
  onMe: () => void
}

export function BottomBar({ onAdd, onMe }: Props) {
  return (
    <nav className="bottombar">
      <NavLink to="/" end className={({ isActive }) => 'bnav' + (isActive ? ' on' : '')}>
        <span>▦</span>收藏墙
      </NavLink>
      <NavLink to="/stats" className={({ isActive }) => 'bnav' + (isActive ? ' on' : '')}>
        <span>▥</span>统计
      </NavLink>
      <div className="fab-space" />
      <button className="bnav" onClick={onMe}>
        <span>○</span>我的
      </button>
      <button className="fab" onClick={onAdd} aria-label="添加收藏">
        ＋
      </button>
    </nav>
  )
}
