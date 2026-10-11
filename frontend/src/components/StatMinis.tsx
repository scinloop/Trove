import { useCountUp } from '../hooks/useCountUp'

export interface MiniDef {
  icon: string
  label: string
  value: number
  decimals?: number
}

function Mini({ def }: { def: MiniDef }) {
  const v = useCountUp(def.value, def.decimals ?? 0)
  return (
    <div className="mini">
      <span className="mi">{def.icon}</span>
      <b>{def.decimals ? v.toFixed(def.decimals) : Math.round(v)}</b>
      <i>{def.label}</i>
    </div>
  )
}

export function StatMinis({ items }: { items: MiniDef[] }) {
  return (
    <div className="stats-row">
      {items.map((d) => (
        <Mini key={d.label} def={d} />
      ))}
    </div>
  )
}
