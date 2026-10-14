interface Props {
  page: number
  totalPages: number
  onChange: (p: number) => void
}

/** 页码按钮序列：总页数 ≤7 全显；否则首末页 + 当前±1 窗口 + 省略号 */
function pageSeq(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const set = new Set<number>([1, totalPages, page - 1, page, page + 1])
  const nums = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const n of nums) {
    if (n - prev > 1) out.push('…')
    out.push(n)
    prev = n
  }
  return out
}

/** 通用分页条 */
export function Pager({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null
  return (
    <div className="pager">
      <button className="pg-b" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="上一页">
        ‹
      </button>
      {pageSeq(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span className="pg-gap" key={`gap${i}`}>
            …
          </span>
        ) : (
          <button
            key={p}
            className={'pg-b' + (p === page ? ' on' : '')}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ),
      )}
      <button
        className="pg-b"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="下一页"
      >
        ›
      </button>
    </div>
  )
}
