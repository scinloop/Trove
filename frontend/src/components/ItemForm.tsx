import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent } from 'react'
import { api } from '../api/client'
import { useMeta } from '../hooks/queries'
import { statusLabel } from '../lib/labels'
import { BGM_CATEGORIES, type BgmSearchHit } from '../types'
import { BgmSearchSheet } from './BgmSearchSheet'
import { IconImage } from './Icons'
import { TagPicker } from './TagPicker'
import { useToast } from './Toast'
import type { AcquireStatus, Category, Item, ItemInput, Status, SubType, WorkStatus } from '../types'

const STATUS_KEYS: Status[] = ['wish', 'doing', 'done']

interface Props {
  item: Item | null
  onClose: () => void
  presetCategory?: Category // 从网站栏等入口新建时预选分类
}

export function ItemForm({ item, onClose, presetCategory }: Props) {
  const meta = useMeta()
  const toast = useToast()
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [bgmOpen, setBgmOpen] = useState(false) // 刮削搜索弹层
  const [bgmPicked, setBgmPicked] = useState<BgmSearchHit | null>(null) // 本次选中的条目

  const [form, setForm] = useState<ItemInput>(() =>
    item
      ? {
          title: item.title,
          category: item.category,
          sub_types: item.sub_types ?? [],
          work_status: item.work_status,
          acquire: item.acquire,
          url: item.url,
          source: item.source ?? '',
          rating: item.rating,
          status: item.status,
          favorite: item.favorite,
          tags: item.tags,
          note: item.note ?? '',
          emoji: item.emoji,
          image_url: item.image_url,
          bgm_id: item.bgm_id,
          bgm_type: item.bgm_type,
        }
      : {
          title: '',
          category: presetCategory ?? 'anime',
          sub_types: [],
          work_status: null,
          acquire: null,
          url: null,
          source: '',
          rating: 3,
          status: 'doing',
          favorite: false,
          tags: [],
          note: '',
          emoji: null,
          image_url: null,
          bgm_id: null,
          bgm_type: null,
        },
  )

  // 当前分类的题材列表（题材库可维护，可多选）；角色/漫画至少选一个
  const subs = meta.genres[form.category] ?? []
  const required = meta.genre_required.includes(form.category)

  const toggleGenre = (key: SubType) =>
    setForm((f) => ({
      ...f,
      sub_types: f.sub_types.includes(key) ? f.sub_types.filter((k) => k !== key) : [...f.sub_types, key],
    }))

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
    const keys = subs.map((g) => g.key)
    const subTypes = form.sub_types.filter((k) => keys.includes(k))
    if (required && subTypes.length === 0) {
      toast(`「${meta.categories.find((c) => c.key === form.category)?.label}」需要至少选择一个题材`)
      return
    }
    if (form.category === 'website' && !form.url?.trim()) {
      toast('请填写网站网址')
      return
    }
    mut.mutate({
      ...form,
      title,
      sub_types: subTypes,
      acquire: form.category === 'character' ? form.acquire : null, // 获取状态仅角色支持
      url: form.category === 'website' ? form.url?.trim() || null : null, // 网址仅网站支持
      source: form.source?.trim() || null,
      note: form.note?.trim() || null,
      emoji: form.emoji,
    })
  }

  const canScrape = (BGM_CATEGORIES as readonly string[]).includes(form.category)

  /** 选中 Bangumi 条目：自动填充表单（已有内容不覆盖），并记住绑定 */
  const pickBgm = (hit: BgmSearchHit) => {
    setBgmPicked(hit)
    setBgmOpen(false)
    setForm((f) => {
      const subs = meta.genres[f.category] ?? []
      // bgm 标签与本地题材同名的自动勾选
      const matched = subs.filter((g) => hit.tags.includes(g.label)).map((g) => g.key)
      const emoji = f.emoji || meta.categories.find((c) => c.key === f.category)?.emoji || null
      // 注意：简介留在快照里由详情页展示，不写进「笔记」（否则详情页两处重复）；
      // 来源也不填 platform（那是 TV/OVA 这类类型词），由后端从 infobox 的「原作/作者」补。
      return {
        ...f,
        title: hit.name_cn || hit.name || f.title,
        bgm_id: hit.bgm_id,
        bgm_type: hit.bgm_type ?? 0,
        tags: f.tags.length > 0 ? f.tags : hit.tags.slice(0, 5),
        emoji,
        sub_types:
          matched.length > 0 ? Array.from(new Set([...f.sub_types, ...matched])) : f.sub_types,
      }
    })
    toast('已绑定 Bangumi 条目，保存后自动刮削档案与封面')
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
    // 表单弹层：点遮罩不关闭（防止误触丢内容），用「关闭」按钮退出
    <div className="overlay show">
      <div className="modal">
        <div className="m-head">
          <div className="m-title">
            <h2>{item ? '编辑收藏' : '添加收藏'}</h2>
            <button className="m-close" onClick={onClose} aria-label="关闭">
              ✕
            </button>
          </div>
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
                    // 切换分类：必选题材的分类默认选第一个，其余清空；获取状态仅角色有；网址仅网站有
                    sub_types: meta.genre_required.includes(c.key)
                      ? [((meta.genres[c.key] ?? [])[0]?.key as SubType | undefined)].filter(
                          (k): k is SubType => !!k,
                        )
                      : [],
                    acquire: c.key === 'character' ? f.acquire : null,
                    url: c.key === 'website' ? f.url : null,
                  }))
                }
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          {form.category === 'website' && (
            <>
              <label>网址 *</label>
              <input
                value={form.url ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="github.com（自动补全 https://）"
              />
            </>
          )}
          {subs.length > 0 && (
            <>
              <label>
                {genreLabel}
                {required ? ' *（至少一个，可多选）' : '（可选，可多选）'}
              </label>
              <div className="seg wrap">
                {subs.map((g) => (
                  <button
                    key={g.key}
                    className={'seg-b sm' + (form.sub_types.includes(g.key) ? ' on' : '')}
                    onClick={() => toggleGenre(g.key)}
                  >
                    {form.sub_types.includes(g.key) ? '✓ ' : ''}
                    {g.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="bgm-label">
            <label htmlFor="item-title">标题 *</label>
            {canScrape && (
              <button type="button" className="bgm-btn" onClick={() => setBgmOpen(true)}>
                🔍 从 Bangumi 刮削
              </button>
            )}
          </div>
          <input
            id="item-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={canScrape ? '输入名称后点「刮削」，自动填充并刮档案' : '如：葬送的芙莉莲 / 雷电将军'}
            autoFocus
          />
          {(bgmPicked || form.bgm_id) && (
            <div className="bgm-picked">
              {bgmPicked?.image ? (
                <img src={bgmPicked.image} alt="" />
              ) : (
                <span className="bgm-picked-ph">🎴</span>
              )}
              <div className="bgm-picked-info">
                <b>
                  {bgmPicked
                    ? bgmPicked.name_cn || bgmPicked.name
                    : `已绑定 Bangumi #${form.bgm_id}`}
                </b>
                {bgmPicked && (
                  <i>
                    {[
                      bgmPicked.date?.slice(0, 10),
                      bgmPicked.platform,
                      bgmPicked.score ? `★${bgmPicked.score}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </i>
                )}
                <span>保存后自动刮削档案与封面（离线可看）</span>
              </div>
              <button
                type="button"
                className="mini-btn"
                onClick={() => {
                  setBgmPicked(null)
                  setForm((f) => ({ ...f, bgm_id: null, bgm_type: null }))
                }}
              >
                解除
              </button>
            </div>
          )}
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
          <label>作品状态（可选）</label>
          <div className="seg">
            <button
              className={'seg-b sm' + (!form.work_status ? ' on' : '')}
              onClick={() => setForm((f) => ({ ...f, work_status: null }))}
            >
              未设置
            </button>
            {meta.work_status.map((w) => (
              <button
                key={w.key}
                className={'seg-b sm' + (form.work_status === w.key ? ' on' : '')}
                onClick={() => setForm((f) => ({ ...f, work_status: w.key as WorkStatus }))}
              >
                {w.label}
              </button>
            ))}
          </div>
          {form.category === 'character' && (
            <>
              <label>获取状态（抽卡游戏适用；单机 / 动漫角色可不设置）</label>
              <div className="seg">
                <button
                  className={'seg-b sm' + (!form.acquire ? ' on' : '')}
                  onClick={() => setForm((f) => ({ ...f, acquire: null }))}
                >
                  未设置
                </button>
                {meta.acquire_status.map((a) => (
                  <button
                    key={a.key}
                    className={'seg-b sm' + (form.acquire === a.key ? ' on' : '')}
                    onClick={() => setForm((f) => ({ ...f, acquire: a.key as AcquireStatus }))}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <label>标签（按分组选择，可新建）</label>
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
      {bgmOpen && (
        <BgmSearchSheet
          category={form.category}
          initialKw={form.title}
          onPick={pickBgm}
          onClose={() => setBgmOpen(false)}
        />
      )}
    </div>
  )
}
