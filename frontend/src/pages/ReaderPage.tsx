import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { ChapterManager } from '../components/ChapterManager'
import { fmtWords } from '../lib/labels'
import { useToast } from '../components/Toast'
import type { BookSearch } from '../types'

interface ReaderSettings {
  size: number
  lh: number
  theme: 'light' | 'sepia' | 'dark'
}

const THEMES: [ReaderSettings['theme'], string][] = [
  ['light', '浅色'],
  ['sepia', '护眼'],
  ['dark', '夜间'],
]

function renderBody(content: string, q: string, positions: number[] | undefined): ReactNode {
  if (!q || !positions || positions.length === 0) return content
  const out: ReactNode[] = []
  let last = 0
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]
    if (p < last) continue
    out.push(content.slice(last, p))
    out.push(
      <mark className="hit" key={`${p}-${i}`}>
        {content.slice(p, p + q.length)}
      </mark>,
    )
    last = p + q.length
  }
  out.push(content.slice(last))
  return out
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback
  } catch {
    return fallback
  }
}

/** 全屏小说阅读器：目录(章节+字数) / 排版设置 / 进度记忆 / 书内搜索逐处跳转 */
export function ReaderPage() {
  const { id } = useParams()
  const itemId = Number(id)
  const nav = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()

  const itemQ = useQuery({ queryKey: ['item', itemId], queryFn: () => api.getItem(itemId) })
  const chaptersQ = useQuery({ queryKey: ['chapters', itemId], queryFn: () => api.chapters(itemId) })
  const chapters = chaptersQ.data ?? []
  const item = itemQ.data

  const pKey = `trove_read_${itemId}`
  const [progress, setProgress] = useState<{ idx: number; top: number }>(() =>
    loadJSON(pKey, { idx: 0, top: 0 }),
  )
  const [idx, setIdx] = useState(progress.idx)
  const chooseChapter = (n: number) => {
    setIdx(n)
    try {
      localStorage.setItem(pKey, JSON.stringify({ idx: n, top: progress.top }))
    } catch {
      /* noop */
    }
  }

  const chapter = chapters.find((c) => c.idx === idx) ?? chapters[0]
  const curIdx = chapter?.idx ?? 0
  const contentQ = useQuery({
    queryKey: ['chapter', chapter?.id],
    queryFn: () => api.getChapter(chapter!.id),
    enabled: !!chapter,
  })

  const [settings, setSettings] = useState<ReaderSettings>(() =>
    loadJSON('trove_reader', { size: 17, lh: 1.9, theme: 'light' as const }),
  )
  useEffect(() => {
    try {
      localStorage.setItem('trove_reader', JSON.stringify(settings))
    } catch {
      /* noop */
    }
  }, [settings])

  const [catOpen, setCatOpen] = useState(false)
  const [setOpen, setSetOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)

  // ---- 书内搜索 ----
  const [searchOpen, setSearchOpen] = useState(false)
  const [q, setQ] = useState('')
  const [res, setRes] = useState<BookSearch | null>(null)
  const [hit, setHit] = useState(0)
  const [activePos, setActivePos] = useState<{ idx: number; positions: number[] } | null>(null)
  const [pendingOcc, setPendingOcc] = useState<number | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef<number | null>(null)

  const totalWords = chapters.reduce((s, c) => s + c.word_count, 0)

  const runSearch = async () => {
    const kw = q.trim()
    if (!kw) return
    try {
      const r = await api.searchInBook(itemId, kw)
      setRes(r)
      if (r.total === 0) {
        toast('整本书都没有找到')
        setActivePos(null)
        return
      }
      jumpTo(r, 0)
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const jumpTo = (r: BookSearch, n: number) => {
    // 展开成逐处列表后跳到第 n 处
    let acc = 0
    for (const c of r.chapters) {
      if (n < acc + c.count) {
        const occ = n - acc
        setActivePos({ idx: c.idx, positions: c.positions })
        setPendingOcc(occ)
        chooseChapter(c.idx)
        return
      }
      acc += c.count
    }
  }

  const step = (d: number) => {
    if (!res || res.total === 0) return
    const n = (hit + d + res.total) % res.total
    setHit(n)
    jumpTo(res, n)
  }

  // 章节内容载入后：恢复上次阅读位置 / 滚到搜索命中处
  useEffect(() => {
    const data = contentQ.data
    if (!data || !bodyRef.current) return
    requestAnimationFrame(() => {
      if (pendingOcc !== null && activePos && data.idx === activePos.idx) {
        const marks = bodyRef.current?.querySelectorAll('mark.hit')
        const el = marks && marks[Math.min(pendingOcc, marks.length - 1)]
        el?.scrollIntoView({ block: 'center' })
        setPendingOcc(null)
        return
      }
      if (restoredRef.current !== data.id) {
        restoredRef.current = data.id
        const top = progress.idx === data.idx ? progress.top : 0
        if (bodyRef.current) bodyRef.current.scrollTop = top
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentQ.data, pendingOcc, activePos])

  const saveScroll = () => {
    if (!bodyRef.current) return
    const next = { idx: curIdx, top: bodyRef.current.scrollTop }
    try {
      localStorage.setItem(pKey, JSON.stringify(next))
    } catch {
      /* noop */
    }
    setProgress(next)
  }

  const importMut = useMutation({
    mutationFn: (file: File) => api.importChapters(itemId, file),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['chapters', itemId] })
      toast(`已导入 ${r.count} 章 · ${fmtWords(r.total_words)}`)
    },
    onError: (e) => toast((e as Error).message),
  })
  const fileRef = useRef<HTMLInputElement>(null)

  if (item && item.category !== 'novel') {
    return (
      <div className="reader" data-rt={settings.theme}>
        <header className="r-top">
          <button onClick={() => nav(-1)}>←</button>
          <div className="r-title">{item.title}</div>
          <span style={{ width: 34 }} />
        </header>
        <div className="r-empty">
          <div className="e-art">📖</div>
          <p>只有小说分类支持阅读器</p>
          <button className="btn primary" onClick={() => nav(-1)}>
            返回
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="reader" data-rt={settings.theme}>
      <header className="r-top">
        <button onClick={() => nav(-1)} aria-label="返回">
          ←
        </button>
        <div className="r-title">{item?.title ?? '…'}</div>
        <button
          onClick={() => {
            setSearchOpen((v) => !v)
            setSetOpen(false)
          }}
          aria-label="搜索"
        >
          🔍
        </button>
        <button
          onClick={() => {
            setCatOpen(true)
            setSetOpen(false)
          }}
          aria-label="目录"
        >
          ☰
        </button>
        <button
          onClick={() => {
            setSetOpen((v) => !v)
            setSearchOpen(false)
          }}
          aria-label="排版设置"
        >
          Aa
        </button>
      </header>

      {setOpen && (
        <div className="r-settings">
          <div className="r-set-row">
            <span>字号</span>
            <button onClick={() => setSettings((s) => ({ ...s, size: Math.max(14, s.size - 1) }))}>A-</button>
            <b>{settings.size}</b>
            <button onClick={() => setSettings((s) => ({ ...s, size: Math.min(26, s.size + 1) }))}>A+</button>
          </div>
          <div className="r-set-row">
            <span>行距</span>
            {[1.7, 1.9, 2.1].map((v) => (
              <button
                key={v}
                className={settings.lh === v ? 'on' : ''}
                onClick={() => setSettings((s) => ({ ...s, lh: v }))}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="r-set-row">
            <span>主题</span>
            {THEMES.map(([key, label]) => (
              <button
                key={key}
                className={settings.theme === key ? 'on' : ''}
                onClick={() => setSettings((s) => ({ ...s, theme: key }))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {searchOpen && (
        <div className="r-search">
          <div className="srow">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runSearch()
              }}
              placeholder="搜索正文关键词…"
              autoFocus
            />
            <button className="btn primary sm" onClick={() => void runSearch()}>
              搜索
            </button>
          </div>
          {res && (
            <div className="r-search-res">
              <b>
                {res.total > 0 ? `共 ${res.total} 处 · 分布 ${res.chapters.length} 章` : '没有找到'}
              </b>
              {res.chapters.map((c) => (
                <button
                  key={c.chapter_id}
                  className="r-hit-row"
                  onClick={() => {
                    let acc = 0
                    for (const cc of res.chapters) {
                      if (cc.idx === c.idx) break
                      acc += cc.count
                    }
                    jumpTo(res, acc)
                  }}
                >
                  <span>
                    {c.idx + 1}. {c.title}
                  </span>
                  <em>{c.count} 处</em>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {chapters.length === 0 ? (
        <div className="r-empty">
          <div className="e-art">📖</div>
          <b>{item?.title}</b>
          <p>还没有导入正文</p>
          <div className="r-sec-btns">
            <button className="btn primary" onClick={() => fileRef.current?.click()} disabled={importMut.isPending}>
              {importMut.isPending ? '导入中…' : '📄 选择 .txt 导入'}
            </button>
            <button className="btn ghost" onClick={() => setManagerOpen(true)}>
              ✂️ 章节管理（支持粘贴）
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".txt"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) importMut.mutate(f)
            }}
          />
        </div>
      ) : (
        <>
          <div className="r-body" ref={bodyRef} onScroll={saveScroll}>
            <h2 className="r-ch-title">{chapter?.title}</h2>
            <div className="r-content" style={{ fontSize: settings.size, lineHeight: settings.lh }}>
              {contentQ.isLoading
                ? '加载中…'
                : renderBody(
                    contentQ.data?.content ?? '',
                    q.trim(),
                    activePos && activePos.idx === curIdx ? activePos.positions : undefined,
                  )}
            </div>
          </div>
          <footer className="r-foot">
            <button disabled={curIdx <= 0} onClick={() => chooseChapter(curIdx - 1)}>
              上一章
            </button>
            <span>
              {chapters.length} 章 · {fmtWords(totalWords)}
            </span>
            <button disabled={curIdx >= chapters.length - 1} onClick={() => chooseChapter(curIdx + 1)}>
              下一章
            </button>
          </footer>
          {res && res.total > 0 && (
            <div className="r-nav">
              <span>
                第 {hit + 1}/{res.total} 处
              </span>
              <button onClick={() => step(-1)} aria-label="上一处">
                ‹
              </button>
              <button onClick={() => step(1)} aria-label="下一处">
                ›
              </button>
              <button
                onClick={() => {
                  setRes(null)
                  setActivePos(null)
                }}
                aria-label="退出搜索"
              >
                ×
              </button>
            </div>
          )}
        </>
      )}

      {catOpen && (
        <div className="r-cat-mask" onClick={() => setCatOpen(false)}>
          <div className="r-cat" onClick={(e) => e.stopPropagation()}>
            <div className="r-cat-head">
              目录 · {chapters.length} 章 · {fmtWords(totalWords)}
            </div>
            <div className="r-cat-list">
              {chapters.map((c) => (
                <button
                  key={c.id}
                  className={'r-cat-row' + (c.idx === curIdx ? ' on' : '')}
                  onClick={() => {
                    chooseChapter(c.idx)
                    setCatOpen(false)
                  }}
                >
                  <span>
                    {c.idx + 1}. {c.title}
                  </span>
                  <em>{fmtWords(c.word_count)}</em>
                </button>
              ))}
            </div>
            <button
              className="btn ghost"
              onClick={() => {
                setCatOpen(false)
                setManagerOpen(true)
              }}
            >
              ✂️ 章节管理
            </button>
          </div>
        </div>
      )}

      {managerOpen && item && (
        <ChapterManager
          item={item}
          onClose={() => {
            setManagerOpen(false)
          }}
        />
      )}
    </div>
  )
}
