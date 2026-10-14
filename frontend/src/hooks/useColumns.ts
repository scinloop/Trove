import { useEffect, useState, type RefObject } from 'react'

interface Opts {
  mobile: number // 手机端 CSS 固定列数
  min: number // 桌面 auto-fill 的最小卡片宽
  gap: number // 桌面网格间距
}

/**
 * 测量容器能容纳多少列（与 CSS auto-fill 公式一致），用于"每页 = 列数 × 行数"的整页显示。
 * 手机端（≤760px，与 CSS 断点一致）列数固定，返回 opts.mobile。
 */
export function useColumns(ref: RefObject<HTMLElement | null>, { mobile, min, gap }: Opts): number {
  const wide = () => window.matchMedia('(min-width: 761px)').matches
  const [cols, setCols] = useState(() => (wide() ? Math.max(1, Math.floor((window.innerWidth - 300 + gap) / (min + gap))) : mobile))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      if (!wide()) {
        setCols(mobile)
        return
      }
      const w = el.clientWidth
      if (w > 0) setCols(Math.max(1, Math.floor((w + gap) / (min + gap))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, mobile, min, gap])

  return cols
}
