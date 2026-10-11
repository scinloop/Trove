import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export interface ToastAction {
  label: string
  run: () => void
}

type ShowFn = (text: string, action?: ToastAction) => void

const Ctx = createContext<ShowFn>(() => {})

/** toast('已保存') or toast('已删除', { label: '撤销', run: () => ... }) */
export function useToast(): ShowFn {
  return useContext(Ctx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ text: string; action?: ToastAction } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback<ShowFn>((text, action) => {
    setToast({ text, action })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), action ? 5000 : 2600)
  }, [])

  return (
    <Ctx.Provider value={show}>
      {children}
      <div className={'toast' + (toast ? ' show' : '')} role="status">
        <span>{toast?.text}</span>
        {toast?.action && (
          <button
            onClick={() => {
              toast.action?.run()
              setToast(null)
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </Ctx.Provider>
  )
}
