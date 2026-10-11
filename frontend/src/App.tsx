import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { BottomBar } from './components/BottomBar'
import { ItemForm } from './components/ItemForm'
import { ItemModal } from './components/ItemModal'
import { MeSheet } from './components/MeSheet'
import { Sidebar } from './components/Sidebar'
import { ToastProvider } from './components/Toast'
import { Topbar } from './components/Topbar'
import { StatsPage } from './pages/StatsPage'
import { WallPage } from './pages/WallPage'
import type { Item } from './types'

type Theme = 'light' | 'dark'

export default function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem('trove_theme') === 'dark' ? 'dark' : 'light',
  )
  const [detail, setDetail] = useState<Item | null>(null)
  // undefined = closed; null = create; Item = edit
  const [formItem, setFormItem] = useState<Item | null | undefined>(undefined)
  const [meOpen, setMeOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('trove_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return (
    <ToastProvider>
      <div className="app">
        <div className="app-body">
          <Sidebar />
          <div className="main">
            <Topbar theme={theme} onToggleTheme={toggleTheme} onAdd={() => setFormItem(null)} />
            <Routes>
              <Route path="/" element={<WallPage onOpen={setDetail} />} />
              <Route path="/stats" element={<StatsPage onOpen={setDetail} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
        <BottomBar onAdd={() => setFormItem(null)} onMe={() => setMeOpen(true)} />
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
        {meOpen && <MeSheet theme={theme} onToggleTheme={toggleTheme} onClose={() => setMeOpen(false)} />}
      </div>
    </ToastProvider>
  )
}
