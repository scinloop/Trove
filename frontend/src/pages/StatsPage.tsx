import { useEffect, useState } from 'react'
import { StatMinis } from '../components/StatMinis'
import { useMeta, useStats } from '../hooks/queries'
import type { Item } from '../types'

export function StatsPage({ onOpen }: { onOpen: (it: Item) => void }) {
  const meta = useMeta()
  const stats = useStats()
  const [go, setGo] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setGo(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const s = stats.data
  const byCat = (s?.by_category ?? {}) as Record<string, number>
  const max = Math.max(1, ...Object.values(byCat))
  const split = s?.character_split
  const splitSum = split ? (split.game ?? 0) + (split.anime_manga ?? 0) : 0
  const gp = splitSum ? Math.round(((split?.game ?? 0) / splitSum) * 100) : 0
  const charGenres = meta.genres.character ?? []
  const gameColor = charGenres.find((g) => g.key === 'game')?.color ?? '#eab308'
  const amColor = charGenres.find((g) => g.key === 'anime_manga')?.color ?? '#d946ef'
  const tk = s?.tasks

  return (
    <div className="view">
      <h2 className="v-title">统计</h2>
      <StatMinis
        items={[
          { icon: '🗂️', label: '收藏总数', value: s?.total ?? 0 },
          { icon: '🆕', label: '近 30 天新增', value: s?.recent30 ?? 0 },
          { icon: '★', label: '平均评分', value: s?.avg_rating ?? 0, decimals: 1 },
          { icon: '✓', label: '完成率 %', value: s?.done_rate ?? 0 },
        ]}
      />
      <div className="panels">
        <div className="panel">
          <h3>分类分布</h3>
          {meta.categories.map((c) => {
            const n = byCat[c.key] ?? 0
            const w = Math.round((n / max) * 100)
            return (
              <div className="bar-row" key={c.key}>
                <span className="bl">
                  {c.emoji} {c.label}
                </span>
                <div className="bar">
                  <i style={{ width: go ? `${w}%` : '0%', background: c.color }} />
                </div>
                <b>{n}</b>
              </div>
            )
          })}
        </div>
        <div className="panel">
          <h3>二次元角色构成</h3>
          {splitSum > 0 && split ? (
            <div className="donut-wrap">
              <div
                className="donut"
                style={{
                  background: `conic-gradient(${gameColor} 0 ${gp}%, ${amColor} ${gp}% 100%)`,
                }}
              >
                <b>{splitSum}</b>
              </div>
              <div className="legend">
                <span>
                  <i style={{ background: gameColor }} />
                  游戏角色<em>{split.game ?? 0}</em>
                </span>
                <span>
                  <i style={{ background: amColor }} />
                  动漫·漫画角色<em>{split.anime_manga ?? 0}</em>
                </span>
              </div>
            </div>
          ) : (
            <p className="none">还没有收录角色～</p>
          )}
        </div>
        <div className="panel">
          <h3>任务进度</h3>
          {tk && tk.total > 0 ? (
            <>
              {(['pending', 'doing', 'done'] as const).map((k) => {
                const n = tk[k]
                const w = Math.round((n / Math.max(1, tk.total)) * 100)
                return (
                  <div className="bar-row" key={k}>
                    <span className="bl">{meta.task_status_labels[k] ?? k}</span>
                    <div className="bar">
                      <i
                        style={{
                          width: go ? `${w}%` : '0%',
                          background: meta.task_status_colors[k] ?? '#a1a1aa',
                        }}
                      />
                    </div>
                    <b>{n}</b>
                  </div>
                )
              })}
              <p className="panel-note">
                长期目标 {tk.goals} 个 · 共 {tk.total} 项任务
              </p>
            </>
          ) : (
            <p className="none">还没有任务，去「任务」页添加～</p>
          )}
        </div>
        <div className="panel">
          <h3>最近添加</h3>
          <div className="recent">
            {!s || s.recent.length === 0 ? (
              <p className="none">暂无记录</p>
            ) : (
              s.recent.map((it) => {
                const c = meta.categories.find((x) => x.key === it.category)
                return (
                  <div className="r-row" key={it.id} onClick={() => onOpen(it)}>
                    <span className="r-emoji" style={{ background: `${c?.color ?? '#71717a'}14` }}>
                      {it.emoji ?? c?.emoji ?? '🎴'}
                    </span>
                    <div className="r-info">
                      <b>{it.title}</b>
                      <i>
                        {c?.label ?? it.category} · {it.created_at.slice(0, 10)}
                      </i>
                    </div>
                    <span className="stars">★ {it.rating}.0</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
