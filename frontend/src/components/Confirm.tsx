import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export interface ConfirmOpts {
  title: string
  desc?: string
  yes?: string // 确认按钮文案，默认「确认删除」
}

type ShowFn = (opts: ConfirmOpts, onYes: () => void) => void

const Ctx = createContext<ShowFn>(() => {})

/** useConfirm()(opts, onYes)：弹出二次确认，用户点确认后才执行 onYes */
export function useConfirm(): ShowFn {
  return useContext(Ctx)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOpts; onYes: () => void } | null>(null)
  const show = useCallback<ShowFn>((opts, onYes) => setState({ opts, onYes }), [])
  const close = () => setState(null)

  return (
    <Ctx.Provider value={show}>
      {children}
      {state && (
        <div
          className="overlay show"
          onClick={(e) => {
            if (e.target === e.currentTarget) close()
          }}
        >
          <div className="modal confirm-modal">
            <h3 className="confirm-title">{state.opts.title}</h3>
            {state.opts.desc && <p className="confirm-desc">{state.opts.desc}</p>}
            <div className="m-acts">
              <button className="btn ghost" onClick={close}>
                取消
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  const run = state.onYes
                  close()
                  run()
                }}
              >
                {state.opts.yes ?? '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
