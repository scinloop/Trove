import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useConfirm } from './Confirm'
import { useMeta } from '../hooks/queries'
import { fmtMinutes, taskStatusLabel } from '../lib/labels'
import { useToast } from './Toast'
import type { Task, TaskInput, TaskStatus } from '../types'

const TASK_STATUS_KEYS: TaskStatus[] = ['pending', 'doing', 'done']

interface Props {
  task: Task
  onClose: () => void
  onEdit: (t: Task) => void
  onChanged: (t: Task) => void
}

export function TaskModal({ task, onClose, onEdit, onChanged }: Props) {
  const meta = useMeta()
  const toast = useToast()
  const confirm = useConfirm()
  const qc = useQueryClient()

  const statusMut = useMutation({
    mutationFn: (status: TaskStatus) => api.updateTask(task.id, { status }),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
      onChanged(updated)
      if (updated.status === 'done') toast('完成！干得漂亮 🎉')
    },
    onError: (e) => toast('操作失败：' + e.message),
  })

  const delMut = useMutation({
    mutationFn: () => api.removeTask(task.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
      onClose()
      const input: TaskInput = {
        title: task.title,
        kind: task.kind,
        planned_minutes: task.planned_minutes,
        note: task.note,
      }
      toast(`已删除「${task.title}」`, {
        label: '撤销',
        run: () => {
          void api
            .createTask(input)
            .then(() => {
              void qc.invalidateQueries({ queryKey: ['tasks'] })
              void qc.invalidateQueries({ queryKey: ['stats'] })
            })
            .catch(() => toast('恢复失败'))
        },
      })
    },
    onError: (e) => toast('删除失败：' + e.message),
  })

  const kindMeta = meta.task_kind_meta[task.kind]

  return (
    <div
      className="overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal">
        <div className="m-head">
          <div className="m-title">
            <h2>{task.title}</h2>
            <button className="m-close" onClick={onClose} aria-label="关闭">
              ✕
            </button>
          </div>
          <div className="m-badges">
            <span className="pill">
              {kindMeta?.emoji} {kindMeta?.label}
            </span>
            <span className="pill">
              <i style={{ background: meta.task_status_colors[task.status] ?? '#a1a1aa' }} />
              {taskStatusLabel(meta, task.status)}
            </span>
          </div>
        </div>
        <div className="m-grid">
          <div className="m-row">
            <i>{task.kind === 'goal' ? '目标性质' : '预计时长'}</i>
            <span>
              {task.kind === 'goal'
                ? '长期目标 · 不设时长'
                : `⏳ ${fmtMinutes(task.planned_minutes)}`}
            </span>
          </div>
          <div className="m-row">
            <i>创建于</i>
            <span>{task.created_at.slice(0, 10)}</span>
          </div>
          {task.done_at && (
            <div className="m-row">
              <i>完成于</i>
              <span>{task.done_at.slice(0, 10)}</span>
            </div>
          )}
        </div>
        <div className="m-note">
          <i>备注</i>
          <p>{task.note || '没有备注…'}</p>
        </div>
        <div className="form tight">
          <label>更新状态</label>
          <div className="seg">
            {TASK_STATUS_KEYS.map((k) => (
              <button
                key={k}
                className={'seg-b sm' + (task.status === k ? ' on' : '')}
                onClick={() => statusMut.mutate(k)}
                disabled={statusMut.isPending}
              >
                {taskStatusLabel(meta, k)}
              </button>
            ))}
          </div>
        </div>
        <div className="m-acts">
          <button className="btn ghost" onClick={onClose}>
            关闭
          </button>
          <button
            className="btn ghost danger"
            onClick={() =>
              confirm(
                { title: `删除任务「${task.title}」？`, desc: '5 秒内可在提示条上撤销；确认后无法找回。' },
                () => delMut.mutate(),
              )
            }
            disabled={delMut.isPending}
          >
            删除
          </button>
          <button className="btn primary" onClick={() => onEdit(task)}>
            编辑
          </button>
        </div>
      </div>
    </div>
  )
}
