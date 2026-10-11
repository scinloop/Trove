import { NavLink } from 'react-router-dom'
import { IconStats, IconTasks, IconWall } from './Icons'

interface Props {
  onAdd: () => void
  onMe: () => void
}

export function BottomBar({ onAdd, onMe }: Props) {
  return (
    <nav className="bottombar">
      <NavLink to="/" end className={({ isActive }) => 'bnav' + (isActive ? ' on' : '')}>
        <IconWall size={20} />
        收藏墙
      </NavLink>
      <NavLink to="/tasks" className={({ isActive }) => 'bnav' + (isActive ? ' on' : '')}>
        <IconTasks size={20} />
        任务
      </NavLink>
      <div className="fab-space" />
      <NavLink to="/stats" className={({ isActive }) => 'bnav' + (isActive ? ' on' : '')}>
        <IconStats size={20} />
        统计
      </NavLink>
      <button className="bnav" onClick={onMe}>
        <span>○</span>我的
      </button>
      <button className="fab" onClick={onAdd} aria-label="添加">
        ＋
      </button>
    </nav>
  )
}
