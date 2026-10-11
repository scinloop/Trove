import { useEffect, useState } from 'react'

/** Animated number count-up (ease-out cubic), used by stat minis. */
export function useCountUp(target: number, decimals = 0): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 700)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Number((target * eased).toFixed(decimals)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, decimals])

  return value
}
