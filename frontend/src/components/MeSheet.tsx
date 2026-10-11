interface Props {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onManage: () => void
  onClose: () => void
}

export function MeSheet({ theme, onToggleTheme, onManage, onClose }: Props) {
  return (
    <div
      className="overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal">
        <div className="m-head">
          <h2>我的</h2>
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
