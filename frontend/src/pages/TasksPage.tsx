import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { useMeta, useStats } from '../hooks/queries'
import { StatMinis } from '../components/StatMinis'
import { fmtMinutes, taskStatusLabel } from '../lib/labels'
import type { Task, TaskKind, TaskStatus } from '../types'

const STATUS_FILTERS: (TaskStatus | 'all')[] = ['all', 'pending', 'doing', 'done']

interface Props {
  onOpen: (t: Task) => void
}

export function TasksPage({ onOpen }: Props) {
  const meta = useMeta()
  const stats = useStats()
  const qc = useQueryClient()
  const [kind, setKind] = useState<TaskKind>('todo')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')

  const tasksQ = useQuery({ queryKey: ['tasks'], queryFn: () => api.tasks() })
  const tasks = tasksQ.data ?? []
  const kindTasks = tasks.filter((t) => t.kind === kind)
  const filtered = statusFilter === 'all' ? kindTasks : kindTasks.filter((t) => t.status === statusFilter)
  const countOf = (k: TaskKind) => tasks.filter((t) => t.kind === k).length
  const tk = stats.data?.tasks

  const toggle = useMutation({
    mutationFn: (t: Task) => api.updateTask(t.id, { status: t.status === 'done' ? 'doing' : 'done' }),
    onMutate: async (t) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const prev = qc.getQueriesData({ queryKey: ['tasks'] })
      const nextStatus: TaskStatus = t.status === 'done' ? 'doing' : 'done'
      qc.setQueriesData({ queryKey: ['tasks'] }, (old: Task[] | undefined) =>
        old?.map((x) =>
          x.id === t.id
            ? { ...x, status: nextStatus, done_at: nextStatus === 'done' ? new Date().toISOString() : null }
            : x,
        ),
      )
      return { prev }
    },
    onError: (_e, _t, ctx) => {
      ctx?.prev.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>任务</h1>
          <p>待办事项与长期目标，勾一下就完成。</p>
        </div>
      </header>

      <StatMinis
        items={[
          { icon: '🗂️', label: '总任务', value: tk?.total ?? 0 },
          { icon: '🚀', label: '进行中', value: tk?.doing ?? 0 },
          { icon: '✅', label: '已完成', value: tk?.done ?? 0 },
          { icon: '🎯', label: '长期目标', value: tk?.goals ?? 0 },
        ]}
      />

      <div className="chips">
        {(['todo', 'goal'] as TaskKind[]).map((k) => {
          const km = meta.task_kind_meta[k]
          return (
            <button
              key={k}
              className={'chip' + (kind === k ? ' on' : '')}
              onClick={() => {
                setKind(k)
                setStatusFilter('all')
              }}
            >
              {km?.emoji} {km?.label} <span className="cnt">{countOf(k)}</span>
            </button>
          )
        })}
      </div>

      <div className="chips sub">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={'chip' + (statusFilter === s ? ' on' : '')}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? '全部状态' : taskStatusLabel(meta, s as TaskStatus)}
          </button>
        ))}
      </div>

      <p className="count">
        {filtered.length} 项{kind === 'goal' ? ' · 长期目标慢慢来' : ''}
      </p>

      {tasksQ.isLoading ? (
        <div className="empty">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          {kind === 'todo' ? '还没有待办任务，点右下角 ＋ 添加一个吧' : '还没有长期目标，点右下角 ＋ 立一个 Flag'}
        </div>
      ) : (
        <div className="task-list">
          {filtered.map((t, i) => (
            <div
              key={t.id}
              className="task-row"
              style={{ animationDelay: `${Math.min(i * 40, 560)}ms` }}
              onClick={() => onOpen(t)}
            >
              <button
                className={'task-check' + (t.status === 'done' ? ' on' : '')}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!toggle.isPending) toggle.mutate(t)
                }}
                aria-label="切换完成状态"
              >
                ✓
              </button>
              <div className="task-main">
                <h3 className={t.status === 'done' ? 'done' : ''}>{t.title}</h3>
                <p className="task-meta">
                  <span className="dot" style={{ background: meta.task_status_colors[t.status] ?? '#a1a1aa' }} />
                  {taskStatusLabel(meta, t.status)}
                  {t.kind === 'goal' ? (
                    <span className="task-dur">🎯 长期目标</span>
                  ) : (
                    <span className="task-dur">⏳ 预计 {fmtMinutes(t.planned_minutes)}</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
