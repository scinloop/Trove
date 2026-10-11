import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BottomBar } from './components/BottomBar'
import { ItemForm } from './components/ItemForm'
import { ItemModal } from './components/ItemModal'
import { MeSheet } from './components/MeSheet'
import { Sidebar } from './components/Sidebar'
import { TaskForm } from './components/TaskForm'
import { TaskModal } from './components/TaskModal'
import { ToastProvider } from './components/Toast'
import { Topbar } from './components/Topbar'
import { StatsPage } from './pages/StatsPage'
import { TasksPage } from './pages/TasksPage'
import { WallPage } from './pages/WallPage'
import type { Item, Task } from './types'

type Theme = 'light' | 'dark'

export default function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem('trove_theme') === 'dark' ? 'dark' : 'light',
  )
  const [detail, setDetail] = useState<Item | null>(null)
  // undefined = closed; null = create; 实体 = edit
  const [formItem, setFormItem] = useState<Item | null | undefined>(undefined)
  const [taskDetail, setTaskDetail] = useState<Task | null>(null)
  const [formTask, setFormTask] = useState<Task | null | undefined>(undefined)
  const [meOpen, setMeOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('trove_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  // 添加按钮跟随页面：任务页添加任务，收藏墙添加收藏
  const onAdd = () => {
    if (location.pathname.startsWith('/tasks')) setFormTask(null)
    else setFormItem(null)
  }

  return (
    <ToastProvider>
      <div className="app">
        <div className="app-body">
          <Sidebar />
          <div className="main">
            <Topbar theme={theme} onToggleTheme={toggleTheme} onAdd={onAdd} />
            <Routes>
              <Route path="/" element={<WallPage onOpen={setDetail} />} />
              <Route path="/tasks" element={<TasksPage onOpen={setTaskDetail} />} />
              <Route path="/stats" element={<StatsPage onOpen={setDetail} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
        <BottomBar onAdd={onAdd} onMe={() => setMeOpen(true)} />
        {detail && (
          <ItemModal
            item={detail}
            onClose={() => setDetail(null)}
            onEdit={(it) => {
              setDetail(null)
              setFormItem(it)
            }}
          />
        )}
        {formItem !== undefined && (
          <ItemForm item={formItem} onClose={() => setFormItem(undefined)} />
        )}
        {taskDetail && (
          <TaskModal
            task={taskDetail}
            onClose={() => setTaskDetail(null)}
            onEdit={(t) => {
              setTaskDetail(null)
              setFormTask(t)
            }}
            onChanged={setTaskDetail}
          />
        )}
        {formTask !== undefined && (
          <TaskForm task={formTask} onClose={() => setFormTask(undefined)} />
        )}
        {meOpen && <MeSheet theme={theme} onToggleTheme={toggleTheme} onClose={() => setMeOpen(false)} />}
      </div>
    </ToastProvider>
  )
}
