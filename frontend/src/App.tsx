import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BottomBar } from './components/BottomBar'
import { ChapterManager } from './components/ChapterManager'
import { ItemForm } from './components/ItemForm'
import { ItemModal } from './components/ItemModal'
import { ManageModal } from './components/ManageModal'
import { MeSheet } from './components/MeSheet'
import { Sidebar } from './components/Sidebar'
import { TaskForm } from './components/TaskForm'
import { TaskModal } from './components/TaskModal'
import { ToastProvider } from './components/Toast'
import { Topbar } from './components/Topbar'
import { useFilters } from './hooks/useFilters'
import { ReaderPage } from './pages/ReaderPage'
import { SitesPage } from './pages/SitesPage'
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
  const [manageOpen, setManageOpen] = useState(false)
  // 管理弹层打开时预选的分类（网站栏进入 → website，其余默认小说）
  const [manageCat, setManageCat] = useState<string | undefined>(undefined)
  const [chapterManager, setChapterManager] = useState<Item | null>(null)
  const nav = useNavigate()
  const location = useLocation()
  const { cat: wallCat } = useFilters()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('trove_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  // 添加按钮跟随页面：任务页添加任务；其余按页面/筛选上下文预选分类
  // （网站栏 → 网站；收藏墙停在某个分类筛选 → 该分类；否则默认动漫）
  const addPreset =
    location.pathname.startsWith('/sites')
      ? 'website'
      : location.pathname === '/' && wallCat !== 'all'
        ? wallCat
        : undefined
  const onAdd = () => {
    if (location.pathname.startsWith('/tasks')) setFormTask(null)
    else setFormItem(null)
  }

  const read = (it: Item) => {
    setDetail(null)
    nav(`/read/${it.id}`)
  }

  return (
    <ToastProvider>
      <div className="app">
        <div className="app-body">
          <Sidebar />
          <div className="main">
            <Topbar
              theme={theme}
              onToggleTheme={toggleTheme}
              onAdd={onAdd}
              onMe={() => setMeOpen(true)}
            />
            <Routes>
              <Route path="/" element={<WallPage onOpen={setDetail} />} />
              <Route
                path="/sites"
                element={
                  <SitesPage
                    onOpen={setDetail}
                    onManage={() => {
                      setManageCat('website')
                      setManageOpen(true)
                    }}
                  />
                }
              />
              <Route path="/tasks" element={<TasksPage onOpen={setTaskDetail} />} />
              <Route path="/stats" element={<StatsPage onOpen={setDetail} />} />
              <Route path="/read/:id" element={<ReaderPage />} />
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
            onRead={read}
            onManageChapters={(it) => {
              setDetail(null)
              setChapterManager(it)
            }}
          />
        )}
        {formItem !== undefined && (
          <ItemForm
            item={formItem}
            onClose={() => setFormItem(undefined)}
            presetCategory={addPreset}
          />
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
        {chapterManager && (
          <ChapterManager item={chapterManager} onClose={() => setChapterManager(null)} />
        )}
        {meOpen && (
          <MeSheet
            theme={theme}
            onToggleTheme={toggleTheme}
            onManage={() => {
              setMeOpen(false)
              setManageCat(undefined)
              setManageOpen(true)
            }}
            onClose={() => setMeOpen(false)}
          />
        )}
        {manageOpen && <ManageModal onClose={() => setManageOpen(false)} initialCat={manageCat} />}
      </div>
    </ToastProvider>
  )
}
