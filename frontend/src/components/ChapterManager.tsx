import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ChangeEvent } from 'react'
import { api } from '../api/client'
import { fmtWords } from '../lib/labels'
import { useToast } from './Toast'
import type { Item } from '../types'

interface Props {
  item: Item
  onClose: () => void
}

/** 章节管理：导入 .txt / 整本粘贴 / 重新分章 / 增删改章节 */
export function ChapterManager({ item, onClose }: Props) {
  const toast = useToast()
  const qc = useQueryClient()
  const chaptersQ = useQuery({ queryKey: ['chapters', item.id], queryFn: () => api.chapters(item.id) })
  const chapters = chaptersQ.data ?? []
  const fileRef = useRef<HTMLInputElement>(null)

  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [nTitle, setNTitle] = useState('')
  const [nContent, setNContent] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [eTitle, setETitle] = useState('')
  const [eContent, setEContent] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = () => void qc.invalidateQueries({ queryKey: ['chapters', item.id] })

  const runImport = async (fn: () => Promise<{ count: number; total_words: number }>) => {
    setBusy(true)
    try {
      const r = await fn()
      refresh()
      toast(`已导入 ${r.count} 章 · ${fmtWords(r.total_words)}`)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const confirmOverwrite = () =>
    chapters.length === 0 || window.confirm(`已有 ${chapters.length} 章，导入会覆盖全部章节，继续？`)

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !confirmOverwrite()) return
    await runImport(() => api.importChapters(item.id, f))
  }

  const doPaste = async () => {
    if (!pasteText.trim()) {
      toast('先粘贴正文内容')
      return
    }
    if (!confirmOverwrite()) return
    await runImport(() => api.pasteChapters(item.id, pasteText))
    setPasteOpen(false)
    setPasteText('')
  }

  const doResplit = async () => {
    if (chapters.length === 0) return
    if (!window.confirm('按章节标题对全文重新分章，将覆盖现有章节，继续？')) return
    await runImport(() => api.resplitChapters(item.id))
  }

  const saveAdd = async () => {
    if (!nTitle.trim()) {
      toast('章节标题不能为空')
      return
    }
    try {
      await api.addChapter(item.id, { title: nTitle.trim(), content: nContent })
      refresh()
      setAddOpen(false)
      setNTitle('')
      setNContent('')
      toast('已添加章节')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const startEdit = async (c: { id: number; title: string }) => {
    try {
      const d = await api.getChapter(c.id)
      setEditId(c.id)
      setETitle(d.title)
      setEContent(d.content)
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const saveEdit = async () => {
    if (!editId) return
    try {
      await api.updateChapter(editId, { title: eTitle.trim(), content: eContent })
      refresh()
      setEditId(null)
      toast('已保存')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const delCh = async (c: { id: number; title: string }) => {
    if (!window.confirm(`删除「${c.title}」？`)) return
    try {
      await api.deleteChapter(c.id)
      refresh()
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <div
      className="overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal modal-lg">
        <div className="m-head">
          <h2>章节管理 · {item.title}</h2>
        </div>
        <div className="chips sub">
          <button className="chip sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            📄 导入 .txt
          </button>
          <button className="chip sm" onClick={() => setPasteOpen(true)} disabled={busy}>
            📋 整本粘贴
          </button>
          <button className="chip sm" onClick={doResplit} disabled={busy || chapters.length === 0}>
            ✂️ 重新分章
          </button>
          <button className="chip sm" onClick={() => setAddOpen((v) => !v)}>
            ➕ 添加章节
          </button>
          <input ref={fileRef} type="file" accept=".txt" hidden onChange={onFile} />
        </div>

        <div className="chap-list">
          {chaptersQ.isLoading ? (
            <p className="none">加载中…</p>
          ) : chapters.length === 0 ? (
            <p className="none">还没有正文 —— 导入 .txt 或整本粘贴，会按「第X章」等标题自动分章</p>
          ) : (
            chapters.map((c) =>
              editId === c.id ? (
                <div className="chap-edit" key={c.id}>
                  <input value={eTitle} onChange={(e) => setETitle(e.target.value)} placeholder="章节标题" />
                  <textarea rows={8} value={eContent} onChange={(e) => setEContent(e.target.value)} />
                  <div className="chap-edit-acts">
                    <button className="mini-btn primary" onClick={saveEdit}>
                      保存
                    </button>
                    <button className="mini-btn" onClick={() => setEditId(null)}>
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="chap-row" key={c.id}>
                  <b className="chap-idx">{c.idx + 1}</b>
                  <span className="chap-title">{c.title}</span>
                  <span className="chap-wc">{fmtWords(c.word_count)}</span>
                  <span className="grow" />
                  <button className="mini-btn" onClick={() => startEdit(c)}>
                    编辑
                  </button>
                  <button className="mini-btn danger" onClick={() => delCh(c)}>
                    删除
                  </button>
                </div>
              ),
            )
          )}
        </div>

        {addOpen && (
          <div className="chap-edit">
            <input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="新章节标题" />
            <textarea rows={6} value={nContent} onChange={(e) => setNContent(e.target.value)} placeholder="正文…" />
            <div className="chap-edit-acts">
              <button className="mini-btn primary" onClick={saveAdd}>
                添加
              </button>
              <button className="mini-btn" onClick={() => setAddOpen(false)}>
                取消
              </button>
            </div>
          </div>
        )}

        {pasteOpen && (
          <div className="chap-edit">
            <textarea
              rows={10}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="粘贴整本文本，将按「第X章 / 卷 / Chapter N」等标题自动分章，并覆盖现有章节…"
            />
            <div className="chap-edit-acts">
              <button className="mini-btn primary" onClick={doPaste} disabled={busy}>
                导入
              </button>
              <button className="mini-btn" onClick={() => setPasteOpen(false)}>
                取消
              </button>
            </div>
          </div>
        )}

        <div className="m-acts">
          <button className="btn primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
