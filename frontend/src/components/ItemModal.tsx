import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { useMeta } from '../hooks/queries'
import { filterInfobox, sortInfobox } from '../lib/bangumi'
import {
  catOf,
  fmtWords,
  acquireOf,
  faviconUrl,
  genresOf,
  hostOf,
  statusLabel,
  workStatusOf,
} from '../lib/labels'
import type { BgmCharacter, BgmEpisode, BgmRelated, Item, ItemInput } from '../types'
import { useConfirm } from './Confirm'
import { useToast } from './Toast'

interface Props {
  item: Item
  onClose: () => void
  onEdit: (it: Item) => void
  onRead: (it: Item) => void
  onManageChapters: (it: Item) => void
}

/** 收藏分布五档（Bangumi collection 字段） */
const COLLECTION_LABELS: [string, string, string][] = [
  ['collect', '看过', '#22c55e'],
  ['doing', '在看', '#3b82f6'],
  ['wish', '想看', '#f59e0b'],
  ['on_hold', '搁置', '#a1a1aa'],
  ['dropped', '抛弃', '#ef4444'],
]

/** bgm 收藏类型（1想看 2看过 3在看 4搁置 5抛弃） */
const BGM_COLLECTION_LABEL: Record<number, string> = {
  1: '想看',
  2: '看过',
  3: '在看',
  4: '搁置',
  5: '抛弃',
}

export function ItemModal({ item, onClose, onEdit, onRead, onManageChapters }: Props) {
  const meta = useMeta()
  const toast = useToast()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const [fav, setFav] = useState(item.favorite)
  const [favErr, setFavErr] = useState(false)
  const [descOpen, setDescOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  // 详情（含刮削快照）：列表数据里没有快照，进详情时单独取
  const detailQ = useQuery({
    queryKey: ['item', item.id],
    queryFn: () => api.getItem(item.id),
    staleTime: 60_000,
  })
  const cur = detailQ.data ?? item
  const snap = detailQ.data?.bangumi ?? null
  const subject = snap?.subject
  const character = snap?.character
  const cover = cur.cover_url

  const isNovel = cur.category === 'novel'
  const isBook = cur.category === 'comic' || cur.category === 'novel'
  const isWebsite = cur.category === 'website'
  const host = hostOf(cur.url)
  const favSrc = isWebsite ? faviconUrl(cur.url) : null

  // 快照里没有的角色/关联条目 → 打开详情时懒加载（只读展示，不写库）
  const castQ = useQuery({
    queryKey: ['bgm-cast', cur.bgm_id],
    queryFn: () => api.bgmCharacters(cur.bgm_id as number),
    enabled: !!cur.bgm_id && cur.bgm_type !== 0 && !snap?.characters,
    staleTime: 10 * 60_000,
    retry: false,
  })
  const relQ = useQuery({
    queryKey: ['bgm-related', cur.bgm_id],
    queryFn: () => api.bgmRelated(cur.bgm_id as number),
    enabled: !!cur.bgm_id && cur.bgm_type !== 0 && !snap?.related,
    staleTime: 10 * 60_000,
    retry: false,
  })
  const cast: BgmCharacter[] = snap?.characters ?? castQ.data?.characters ?? []
  const related: BgmRelated[] = snap?.related ?? relQ.data?.related ?? []

  const chaptersQ = useQuery({
    queryKey: ['chapters', item.id],
    queryFn: () => api.chapters(item.id),
    enabled: isNovel,
  })
  const chapters = chaptersQ.data ?? []
  const totalWords = chapters.reduce((s, c) => s + c.word_count, 0)

  const favMut = useMutation({
    mutationFn: (favorite: boolean) => api.update(item.id, { favorite }),
    onError: (e) => {
      setFav(item.favorite)
      toast('操作失败：' + e.message)
    },
  })

  const scrapeMut = useMutation({
    mutationFn: () => api.rescrape(item.id, true),
    onSuccess: (d) => {
      qc.setQueryData(['item', item.id], d)
      void qc.invalidateQueries({ queryKey: ['items'] })
      toast('已重新刮削最新档案')
    },
    onError: (e) => toast('刮削失败：' + e.message),
  })

  // ---- 追番进度 / 单集 / 写回 ----
  const [progress, setProgress] = useState<number | null>(null) // null = 未改动
  const [openEp, setOpenEp] = useState<number | null>(null)
  const shownProgress = progress ?? cur.ep_progress ?? 0

  const epsQ = useQuery({
    queryKey: ['bgm-episodes', cur.bgm_id],
    queryFn: () => api.bgmEpisodes(cur.bgm_id as number, 200),
    enabled: !!cur.bgm_id && cur.bgm_type !== 0 && !snap?.episodes,
    staleTime: 10 * 60_000,
    retry: false,
  })
  const eps: BgmEpisode[] = snap?.episodes ?? epsQ.data?.episodes ?? []
  const epTotal = snap?.episode_total ?? epsQ.data?.total ?? subject?.eps ?? 0

  const epDetailQ = useQuery({
    queryKey: ['bgm-episode', openEp],
    queryFn: () => api.bgmEpisode(openEp as number),
    enabled: !!openEp,
    staleTime: 30 * 60_000,
    retry: false,
  })

  // bgm 侧我的收藏状态（对照）
  const myColQ = useQuery({
    queryKey: ['bgm-collection', cur.bgm_id],
    queryFn: () => api.myCollection(cur.bgm_id as number),
    enabled: !!cur.bgm_id,
    staleTime: 60_000,
    retry: false,
  })

  const progressMut = useMutation({
    mutationFn: (n: number) => api.update(item.id, { ep_progress: n }),
    onSuccess: () => {
      setProgress(null)
      void qc.invalidateQueries({ queryKey: ['items'] })
      void qc.invalidateQueries({ queryKey: ['item', item.id] })
      toast('进度已保存（本地）')
    },
    onError: (e) => toast('保存失败：' + e.message),
  })

  const syncMut = useMutation({
    mutationFn: () => api.syncItem(item.id),
    onSuccess: (r) => {
      qc.setQueryData(['item', item.id], r.item)
      void qc.invalidateQueries({ queryKey: ['bgm-collection', cur.bgm_id] })
      const epCount = r.synced.episodes
      toast(
        r.synced.kind === 'character'
          ? '已把角色收藏同步到 Bangumi'
          : `已同步到 Bangumi${epCount ? ` · ${epCount} 集标记为看过` : ''}`,
      )
    },
    onError: (e) => toast('同步失败：' + e.message),
  })

  const delMut = useMutation({
    mutationFn: () => api.remove(item.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['items'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
      onClose()
      const input: ItemInput = {
        title: cur.title,
        category: cur.category,
        sub_types: cur.sub_types,
        work_status: cur.work_status,
        acquire: cur.acquire,
        url: cur.url,
        source: cur.source,
        rating: cur.rating,
        status: cur.status,
        favorite: cur.favorite,
        tags: cur.tags,
        note: cur.note,
        emoji: cur.emoji,
        image_url: cur.image_url,
        bgm_id: cur.bgm_id,
        bgm_type: cur.bgm_type,
      }
      toast(`已删除「${cur.title}」`, {
        label: '撤销',
        run: () => {
          void api
            .create(input)
            .then(() => {
              void qc.invalidateQueries({ queryKey: ['items'] })
              void qc.invalidateQueries({ queryKey: ['stats'] })
            })
            .catch(() => toast('恢复失败'))
        },
      })
    },
    onError: (e) => toast('删除失败：' + e.message),
  })

  const cat = catOf(meta, cur.category)
  const color = cat?.color ?? '#71717a'
  const subMetas = genresOf(meta, cur.category, cur.sub_types)
  const ws = workStatusOf(meta, cur.work_status)
  const ac = cur.category === 'character' ? acquireOf(meta, cur.acquire) : null

  const collection = subject?.collection ?? {}
  const collectionTotal = COLLECTION_LABELS.reduce((s, [k]) => s + (collection[k] ?? 0), 0)
  // 信息表：先剔除制作班底字段，再按常用属性排序，默认只展示前几项
  const infobox = sortInfobox(filterInfobox(subject?.infobox ?? character?.infobox))
  const INFO_LIMIT = 8
  const shownInfo = infoOpen ? infobox : infobox.slice(0, INFO_LIMIT)
  const summary = subject?.summary ?? character?.summary ?? ''
  const titleAlt = subject?.name_cn && subject.name ? subject.name : ''

  return (
    <div
      className="overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal modal-lg">
        {/* 1. Hero：封面 + 标题 + 徽章 */}
        <div className="m-hero">
          <div className="m-hero-cover" style={cover ? undefined : { background: `${color}14` }}>
            {cover ? (
              <img src={cover} alt={cur.title} />
            ) : favSrc && !favErr ? (
              <img src={favSrc} alt={cur.title} onError={() => setFavErr(true)} />
            ) : (
              <span>{cur.emoji ?? cat?.emoji ?? '🎴'}</span>
            )}
          </div>
          <div className="m-hero-info">
            <div className="m-title">
              <h2>{cur.title}</h2>
              <button className="m-close" onClick={onClose} aria-label="关闭">
                ✕
              </button>
            </div>
            {titleAlt && <i className="m-orig">{titleAlt}</i>}
            <div className="m-badges">
              <span className="pill">
                <i style={{ background: color }} />
                {cat?.label ?? cur.category}
              </span>
              {subMetas.map((g) => (
                <span className="pill" key={g.key}>
                  <i style={{ background: g.color }} />
                  {g.label}
                </span>
              ))}
              {ws && (
                <span className="pill">
                  <i style={{ background: ws.color }} />
                  {ws.label}
                </span>
              )}
              {ac && (
                <span className="pill">
                  <i style={{ background: ac.color }} />
                  {ac.label}
                </span>
              )}
              <span className="pill">
                <i style={{ background: meta.status_colors[cur.status] ?? '#71717a' }} />
                {statusLabel(meta, cur.category, cur.status)}
              </span>
              {(subject?.nsfw || character?.nsfw) && <span className="r18">R18</span>}
            </div>
            <p className="stars big">
              {'★'.repeat(cur.rating)}
              {'☆'.repeat(5 - cur.rating)}
              <b>{cur.rating}.0</b>
            </p>
            <button
              className={'fav-btn' + (fav ? ' on' : '')}
              onClick={() => {
                const next = !fav
                setFav(next)
                favMut.mutate(next)
              }}
            >
              {fav ? '♥ 已喜爱' : '♡ 设为喜爱'}
            </button>
          </div>
        </div>

        {/* 2. Bangumi 评分与收藏分布 */}
        {subject && (subject.score || subject.rank) && (
          <div className="bgm-card">
            <div className="bgm-score">
              <b>{subject.score ? subject.score.toFixed(1) : '—'}</b>
              <span>
                Bangumi 评分
                {subject.rank ? (
                  <>
                    <br />#{subject.rank}
                  </>
                ) : null}
                <br />
                {subject.rating_total ?? 0} 人
              </span>
            </div>
            <div className="bgm-bars">
              <div className="bgm-bar">
                {COLLECTION_LABELS.map(([k, , c]) => {
                  const v = collection[k] ?? 0
                  if (!v || !collectionTotal) return null
                  return (
                    <i
                      key={k}
                      style={{ width: `${(v / collectionTotal) * 100}%`, background: c }}
                      title={`${k}: ${v}`}
                    />
                  )
                })}
              </div>
              <div className="bgm-legend">
                {COLLECTION_LABELS.map(([k, label, c]) => (
                  <span key={k}>
                    <i style={{ background: c }} />
                    {label} {collection[k] ?? 0}
                  </span>
                ))}
              </div>
              <div className="bgm-extra">
                {subject.eps ? <span>话数 {subject.eps}</span> : null}
                {subject.volumes ? <span>卷数 {subject.volumes}</span> : null}
                {subject.platform ? <span>{subject.platform}</span> : null}
                {subject.date ? <span>{subject.date}</span> : null}
              </div>
            </div>
          </div>
        )}

        {/* 3. 简介 */}
        {summary && (
          <div className="m-note">
            <i>简介</i>
            <p className={descOpen ? '' : 'clamp3'}>{summary}</p>
            {summary.length > 120 && (
              <button className="mini-btn" onClick={() => setDescOpen((o) => !o)}>
                {descOpen ? '收起' : '展开全文'}
              </button>
            )}
          </div>
        )}

        {/* 4. 作品信息表（infobox，已剔除制作班底） */}
        {infobox.length > 0 && (
          <>
            <div className="m-info">
              {shownInfo.map((x) => (
                <div className="m-info-row" key={x.key}>
                  <i>{x.key}</i>
                  <span>{x.value}</span>
                </div>
              ))}
            </div>
            {infobox.length > INFO_LIMIT && (
              <button className="mini-btn info-more" onClick={() => setInfoOpen((o) => !o)}>
                {infoOpen ? '收起信息表' : `展开全部 ${infobox.length} 项`}
              </button>
            )}
          </>
        )}

        {/* 5. 我的记录 */}
        <div className="m-grid">
          {isWebsite && (
            <div className="m-row">
              <i>网址</i>
              <span className="m-url">
                <a href={cur.url ?? '#'} target="_blank" rel="noreferrer">
                  {host ?? cur.url}
                </a>
              </span>
            </div>
          )}
          <div className="m-row">
            <i>来源</i>
            <span>{cur.source || '—'}</span>
          </div>
          <div className="m-row">
            <i>标签</i>
            <span>
              {cur.tags.length > 0
                ? cur.tags.map((t) => (
                    <em className="tag" key={t}>
                      #{t}
                    </em>
                  ))
                : '—'}
            </span>
          </div>
          {isNovel && (
            <div className="m-row">
              <i>正文</i>
              <span>
                {chapters.length > 0 ? `${chapters.length} 章 · ${fmtWords(totalWords)}` : '未导入'}
              </span>
            </div>
          )}
          {cur.ep_progress != null && (
            <div className="m-row">
              <i>追番进度</i>
              <span>
                第 {cur.ep_progress}
                {subject?.eps ? ` / ${subject.eps}` : ''} 集
              </span>
            </div>
          )}
          <div className="m-row">
            <i>收藏于</i>
            <span>{cur.created_at.slice(0, 10)}</span>
          </div>
        </div>

        {/* 5b. 追番进度 + 剧集列表（Bangumi 同步） */}
        {cur.bgm_id && cur.bgm_type !== 0 && (epTotal > 0 || cur.ep_progress != null) && (
          <>
            <h3 className="m-sub">
              追番进度
              {myColQ.data ? (
                <em className={'bgm-side' + (myColQ.data.found ? ' on' : '')}>
                  Bangumi 侧：
                  {myColQ.data.found
                    ? BGM_COLLECTION_LABEL[myColQ.data.collection?.type ?? 0] ?? '已收藏'
                    : '未收藏'}
                </em>
              ) : null}
            </h3>
            <div className="ep-progress">
              <button
                className="mini-btn"
                onClick={() => setProgress(Math.max(0, shownProgress - 1))}
                aria-label="减一"
              >
                −
              </button>
              <b>{shownProgress}</b>
              <span>
                / {epTotal || '?'} {isBook ? '话' : '集'}
              </span>
              <button className="mini-btn" onClick={() => setProgress(shownProgress + 1)} aria-label="加一">
                ＋
              </button>
              <span className="grow" />
              <button
                className="mini-btn primary"
                onClick={() => progressMut.mutate(shownProgress)}
                disabled={progressMut.isPending}
              >
                保存进度
              </button>
            </div>
            {eps.length > 0 && (
              <div className="ep-list">
                {eps.map((e) => {
                  const watched = (e.sort ?? 0) <= shownProgress
                  return (
                    <div className={'ep-item' + (watched ? ' on' : '')} key={e.bgm_id}>
                      <button
                        className="ep-no"
                        onClick={() => setProgress(e.sort ?? 0)}
                        title="标记看到这一集"
                      >
                        {watched ? '✓' : e.sort}
                      </button>
                      <button
                        className="ep-name"
                        onClick={() => setOpenEp(openEp === e.bgm_id ? null : e.bgm_id)}
                      >
                        {e.name_cn || e.name || `第 ${e.sort} 集`}
                      </button>
                      <i>{e.airdate}</i>
                    </div>
                  )
                })}
                {epsQ.data && epsQ.data.total > eps.length && (
                  <p className="count">
                    仅载入前 {eps.length} 集（共 {epsQ.data.total} 集）
                  </p>
                )}
              </div>
            )}
            {openEp && (
              <div className="ep-detail">
                {epDetailQ.isPending ? (
                  <p className="count">加载单集详情…</p>
                ) : epDetailQ.data ? (
                  <>
                    <b>{epDetailQ.data.name_cn || epDetailQ.data.name}</b>
                    <i>{[epDetailQ.data.airdate, epDetailQ.data.duration].filter(Boolean).join(' · ')}</i>
                    <p>{epDetailQ.data.desc || '暂无简介'}</p>
                  </>
                ) : (
                  <p className="count">单集详情加载失败</p>
                )}
              </div>
            )}
          </>
        )}

        {/* 6. 角色阵容 */}
        {cast.length > 0 && (
          <>
            <h3 className="m-sub">
              角色阵容 · {cast.length}
              {!snap?.characters && castQ.isFetching ? ' （加载中…）' : ''}
            </h3>
            <div className="cast-row">
              {cast.map((c) => (
                <div className="cast" key={c.bgm_id}>
                  <span className="cast-img">
                    {c.image ? <img src={c.image} alt="" loading="lazy" /> : '🎴'}
                  </span>
                  <b title={c.name}>{c.name_cn || c.name}</b>
                  <i>
                    {c.relation}
                    {c.actors[0]?.name ? ` · ${c.actors[0].name}` : ''}
                  </i>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 6b. 角色条目：该角色出自哪些作品 */}
        {character?.subjects && character.subjects.length > 0 && (
          <>
            <h3 className="m-sub">出演作品 · {character.subjects.length}</h3>
            <div className="rel-list">
              {character.subjects.map((s) => (
                <a
                  className="rel"
                  key={s.bgm_id}
                  href={`https://bgm.tv/subject/${s.bgm_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <b>{s.name_cn || s.name}</b>
                  <i>{s.relation}</i>
                </a>
              ))}
            </div>
          </>
        )}

        {/* 7. 关联条目 */}
        {related.length > 0 && (
          <>
            <h3 className="m-sub">
              关联条目 · {related.length}
              {!snap?.related && relQ.isFetching ? ' （加载中…）' : ''}
            </h3>
            <div className="rel-list">
              {related.map((r) => (
                <a
                  className="rel"
                  key={r.bgm_id}
                  href={`https://bgm.tv/subject/${r.bgm_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <b>{r.name_cn || r.name}</b>
                  <i>{r.relation}</i>
                </a>
              ))}
            </div>
          </>
        )}

        {/* 8. 笔记 */}
        <div className="m-note">
          <i>笔记</i>
          <p>{cur.note || '还没有写笔记…'}</p>
        </div>

        {/* 9. 操作栏 */}
        <div className="m-acts">
          <button className="btn ghost" onClick={onClose}>
            关闭
          </button>
          <button className="btn ghost" onClick={() => onEdit(cur)}>
            编辑
          </button>
          {isNovel && (
            <>
              <button className="btn ghost" onClick={() => onRead(cur)}>
                阅读
              </button>
              <button className="btn ghost" onClick={() => onManageChapters(cur)}>
                章节管理
              </button>
            </>
          )}
          {cur.bgm_id && (
            <button
              className="btn ghost"
              onClick={() => scrapeMut.mutate()}
              disabled={scrapeMut.isPending}
            >
              {scrapeMut.isPending ? '刮削中…' : '🔄 重新刮削'}
            </button>
          )}
          {cur.bgm_id && (
            <button className="btn ghost" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
              {syncMut.isPending ? '同步中…' : '⬆ 同步到 Bangumi'}
            </button>
          )}
          <button
            className="btn ghost danger"
            onClick={() =>
              confirm(
                {
                  title: `删除「${cur.title}」？`,
                  desc: '收藏将进入回收流程：5 秒内可撤销；确认后无法找回。',
                },
                () => delMut.mutate(),
              )
            }
            disabled={delMut.isPending}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  )
}
