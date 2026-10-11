import { useFilters } from '../hooks/useFilters'
import type { Category, Meta, SortKey } from '../types'

export function CategoryChips({ meta }: { meta: Meta }) {
  const { cat, sub, sort, setCat, setSub, setSort } = useFilters()

  // 题材筛选只在选中了「有题材」的分类时出现（小说 / 角色 / 漫画，可在管理里扩展）
  const activeCat = cat === 'all' ? null : cat
  const subs = activeCat ? (meta.genres[activeCat] ?? []) : []

  return (
    <>
      <div className="chips">
        <button className={'chip' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>
          ✨ 全部
        </button>
        {meta.categories.map((c) => (
          <button
            key={c.key}
            className={'chip' + (cat === c.key ? ' on' : '')}
            onClick={() => setCat(c.key as Category)}
          >
            {c.emoji} {c.label}
          </button>
        ))}
        <span className="grow" />
        <select
          className="sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="排序"
        >
          <option value="recent">最近添加</option>
          <option value="rating">评分最高</option>
          <option value="title">标题 A-Z</option>
        </select>
      </div>
      {activeCat && subs.length > 0 && (
        <div className="chips sub">
          <button className={'chip' + (sub === 'all' ? ' on' : '')} onClick={() => setSub('all')}>
            全部{meta.categories.find((c) => c.key === activeCat)?.label ?? ''}
          </button>
          {subs.map((g) => (
            <button
              key={g.key}
              className={'chip' + (sub === g.key ? ' on' : '')}
              onClick={() => setSub(g.key)}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
