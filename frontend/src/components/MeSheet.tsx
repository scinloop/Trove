import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

interface Props {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onManage: () => void
  onClose: () => void
}

export function MeSheet({ theme, onToggleTheme, onManage, onClose }: Props) {
  const bgm = useQuery({
    queryKey: ['bgm-status'],
    queryFn: () => api.bgmStatus(),
    staleTime: 5 * 60_000,
    retry: false,
  })
  const st = bgm.data

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
            <h2>我的</h2>
            <button className="m-close" onClick={onClose} aria-label="关闭">
              ✕
            </button>
          </div>
        </div>
        <div className="me-list">
          <div className="me-row">
            <span>深色模式</span>
            <button
              className={'switch' + (theme === 'dark' ? ' on' : '')}
              onClick={onToggleTheme}
              aria-label="深色模式"
            >
              <i />
            </button>
          </div>
          <div className="me-row">
            <button className="me-link" onClick={onManage}>
              🎨 题材与标签管理
            </button>
          </div>
          <div className="me-row">
            <span>Bangumi 刮削</span>
            {bgm.isPending ? (
              <em className="me-note">检查中…</em>
            ) : st?.connected ? (
              <em className="me-note ok">
                {st.avatar ? <img className="me-avatar" src={st.avatar} alt="" /> : null}
                已连接 {st.nickname || st.username}
                {st.r18 ? ' · R18 已开启' : ''}
              </em>
            ) : st?.configured ? (
              <em className="me-note warn">令牌无效，请更新 BGM_TOKEN</em>
            ) : (
              <em className="me-note">未配置令牌（backend/.env 的 BGM_TOKEN）</em>
            )}
          </div>
        </div>
        <p className="about">
          Trove v0.3 · React + FastAPI + SQLite
          <br />
          数据保存在本地 collecthub.db
        </p>
        <div className="m-acts">
          <button className="btn primary" onClick={onClose}>
            好
          </button>
        </div>
      </div>
    </div>
  )
}
