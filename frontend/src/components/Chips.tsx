import { useFilters } from '../hooks/useFilters'
import type { Category, Meta, SortKey, SubType } from '../types'

export function CategoryChips({ meta }: { meta: Meta }) {
  const { cat, sub, sort, setCat, setSub, setSort } = useFilters()

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
      {(cat === 'all' || cat === 'character') && (
        <div className="chips sub">
          <button className={'chip' + (sub === 'all' ? ' on' : '')} onClick={() => setSub('all')}>
            全部角色
          </button>
          {Object.entries(meta.sub_types).map(([key, v]) => (
            <button
              key={key}
              className={'chip' + (sub === key ? ' on' : '')}
              onClick={() => setSub(key as SubType)}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
