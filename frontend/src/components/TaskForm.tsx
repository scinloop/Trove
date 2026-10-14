import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { useMeta } from '../hooks/queries'
import { useToast } from './Toast'
import type { Task, TaskKind } from '../types'

const MINUTE_PRESETS = [
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '1 小时', value: 60 },
  { label: '2 小时', value: 120 },
]

interface Props {
  task: Task | null
  onClose: () => void
}

export function TaskForm({ task, onClose }: Props) {
  const meta = useMeta()
  const toast = useToast()
  const qc = useQueryClient()

  const [title, setTitle] = useState(task?.title ?? '')
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? 'todo')
  const [minutes, setMinutes] = useState(task?.planned_minutes ? String(task.planned_minutes) : '')
  const [note, setNote] = useState(task?.note ?? '')

  const mut = useMutation({
    mutationFn: () => {
      const num = Number(minutes)
      const input = {
        title: title.trim(),
        kind,
        planned_minutes: kind === 'todo' && minutes && num > 0 ? Math.round(num) : null,
        note: note.trim() || null,
      }
      return task ? api.updateTask(task.id, input) : api.createTask(input)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
      toast(task ? '已保存修改' : '已添加任务')
      onClose()
    },
    onError: (e) => toast('保存失败：' + e.message),
  })

  const save = () => {
    if (!title.trim()) {
      toast('任务内容不能为空哦')
      return
    }
    if (minutes && !(Number(minutes) > 0)) {
      toast('预计时长要大于 0')
      return
    }
    mut.mutate()
  }

  return (
    // 表单弹层：点遮罩不关闭（防止误触丢内容），用「关闭」按钮退出
    <div className="overlay show">
      <div className="modal">
        <div className="m-head">
          <div className="m-title">
            <h2>{task ? '编辑任务' : '添加任务'}</h2>
            <button className="m-close" onClick={onClose} aria-label="关闭">
              ✕
            </button>
          </div>
        </div>
        <div className="form">
          <label>类型</label>
          <div className="seg">
            {(['todo', 'goal'] as TaskKind[]).map((k) => {
              const km = meta.task_kind_meta[k]
              return (
                <button
                  key={k}
                  className={'seg-b' + (kind === k ? ' on' : '')}
                  onClick={() => setKind(k)}
                >
                  {km?.emoji} {km?.label}
                </button>
              )
            })}
          </div>
          <label>要做什么 *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'todo' ? '如：看完《芙莉莲》第 21 集' : '如：一年内收藏满 500 部'}
            autoFocus
          />
          {kind === 'todo' && (
            <>
              <label>预计时长（可选）</label>
              <input
                type="number"
                min={1}
                max={100000}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="单位：分钟，如 45"
              />
              <div className="chips sub">
                {MINUTE_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    className={'chip' + (minutes === String(p.value) ? ' on' : '')}
                    onClick={() => setMinutes(String(p.value))}
                  >
                    {p.label}
                  </button>
                ))}
                {minutes && (
                  <button className="chip" onClick={() => setMinutes('')}>
                    清除
                  </button>
                )}
              </div>
            </>
          )}
          <label>备注</label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="补充说明（可选）"
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
