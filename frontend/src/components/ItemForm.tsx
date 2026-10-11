import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent } from 'react'
import { api } from '../api/client'
import { useMeta } from '../hooks/queries'
import { statusLabel } from '../lib/labels'
import { IconImage } from './Icons'
import { TagPicker } from './TagPicker'
import { useToast } from './Toast'
import type { Category, Item, ItemInput, Status, SubType } from '../types'

const STATUS_KEYS: Status[] = ['wish', 'doing', 'done']

interface Props {
  item: Item | null
  onClose: () => void
}

export function ItemForm({ item, onClose }: Props) {
  const meta = useMeta()
  const toast = useToast()
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)

  const [form, setForm] = useState<ItemInput>(() =>
    item
      ? {
          title: item.title,
          category: item.category,
          sub_type: item.sub_type,
          source: item.source ?? '',
          rating: item.rating,
          status: item.status,
          favorite: item.favorite,
          tags: item.tags,
          note: item.note ?? '',
          emoji: item.emoji,
          image_url: item.image_url,
        }
      : {
          title: '',
          category: 'anime',
          sub_type: null,
          source: '',
          rating: 3,
          status: 'doing',
          favorite: false,
          tags: [],
          note: '',
          emoji: null,
          image_url: null,
        },
  )

  // 当前分类的题材列表（题材库可维护）；角色/漫画必选
  const subs = meta.genres[form.category] ?? []
  const required = meta.genre_required.includes(form.category)

  const mut = useMutation({
    mutationFn: (input: ItemInput) => (item ? api.update(item.id, input) : api.create(input)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['items'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
      toast(item ? '已保存修改' : '已加入收藏')
      onClose()
    },
    onError: (e) => toast('保存失败：' + e.message),
  })

  const save = () => {
    const title = form.title.trim()
    if (!title) {
      toast('标题不能为空哦')
      return
    }
    if (required && !subs.some((g) => g.key === form.sub_type)) {
      toast(`「${meta.categories.find((c) => c.key === form.category)?.label}」需要选择题材`)
      return
    }
    mut.mutate({
      ...form,
      title,
      source: form.source?.trim() || null,
      note: form.note?.trim() || null,
      sub_type: form.sub_type && subs.some((g) => g.key === form.sub_type) ? form.sub_type : null,
      emoji: form.emoji,
    })
  }

  const pickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选择同一文件
    if (!file) return
    setUploading(true)
    try {
      const url = await api.uploadImage(file)
      setForm((f) => ({ ...f, image_url: url }))
    } catch (err) {
      toast('上传失败：' + (err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const genreLabel = form.category === 'character' ? '角色类型' : form.category === 'comic' ? '漫画类型' : '题材'

  return (
    <div
      className="overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal">
        <div className="m-head">
          <h2>{item ? '编辑收藏' : '添加收藏'}</h2>
        </div>
        <div className="form">
          <label>分类</label>
          <div className="seg">
            {meta.categories.map((c) => (
              <button
                key={c.key}
                className={'seg-b' + (form.category === c.key ? ' on' : '')}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    category: c.key as Category,
                    emoji: null,
                    sub_type: meta.genre_required.includes(c.key)
                      ? ((meta.genres[c.key] ?? [])[0]?.key as SubType | undefined) ?? null
                      : null,
                  }))
                }
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          {subs.length > 0 && (
            <>
              <label>{genreLabel}{required ? ' *' : '（可选）'}</label>
              <div className="seg wrap">
                {!required && (
                  <button
                    className={'seg-b sm' + (!form.sub_type ? ' on' : '')}
                    onClick={() => setForm((f) => ({ ...f, sub_type: null }))}
                  >
                    不设置
                  </button>
                )}
                {subs.map((g) => (
                  <button
                    key={g.key}
                    className={'seg-b sm' + (form.sub_type === g.key ? ' on' : '')}
                    onClick={() => setForm((f) => ({ ...f, sub_type: g.key }))}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <label>标题 *</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="如：葬送的芙莉莲 / 雷电将军"
            autoFocus
          />
          <label>来源作品 / 作者</label>
          <input
            value={form.source ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            placeholder="如：原神 / 山田钟人"
          />
          <label>评分</label>
          <div className="star-in">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={n <= form.rating ? 'on' : ''}
                onClick={() => setForm((f) => ({ ...f, rating: n }))}
              >
                ★
              </span>
            ))}
          </div>
          <label>进度状态</label>
          <div className="seg">
            {STATUS_KEYS.map((k) => (
              <button
                key={k}
                className={'seg-b sm' + (form.status === k ? ' on' : '')}
                onClick={() => setForm((f) => ({ ...f, status: k }))}
              >
                {statusLabel(meta, form.category, k)}
              </button>
            ))}
          </div>
          <label>标签（从标签库选择，可新建）</label>
          <TagPicker value={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
          <label>图片（服装展示 / 封面，可选）</label>
          {form.image_url ? (
            <div className="upload-box has-img">
              <img src={form.image_url} alt="图片预览" />
              <button
                className="upload-remove"
                onClick={() => setForm((f) => ({ ...f, image_url: null }))}
              >
                移除图片
              </button>
            </div>
          ) : (
            <label className={'upload-box' + (uploading ? ' busy' : '')}>
              <input type="file" accept="image/*" hidden onChange={pickImage} disabled={uploading} />
              <IconImage size={22} />
              <span>{uploading ? '上传中…' : '点击上传图片（≤5MB）'}</span>
            </label>
          )}
          <label>笔记</label>
          <textarea
            rows={3}
            value={form.note ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="随手记点感想…"
          />
        </div>
        <div className="m-acts">
          <button className="btn ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" onClick={save} disabled={mut.isPending}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
