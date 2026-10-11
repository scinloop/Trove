import { useFilters } from '../hooks/useFilters'
import type { Category, Meta, SortKey, SubType } from '../types'

export function CategoryChips({ meta }: { meta: Meta }) {
  const { cat, sub, sort, setCat, setSub, setSort } = useFilters()

  // 子类型筛选只在选中了「声明了子类型」的分类时出现（角色 / 漫画）
  const activeCat = cat === 'all' ? null : cat
  const subs = activeCat ? (meta.category_sub_types[activeCat] ?? []) : []

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
          {subs.map((key) => {
            const st = meta.sub_types[key]
            if (!st) return null
            return (
              <button
                key={key}
                className={'chip' + (sub === key ? ' on' : '')}
                onClick={() => setSub(key as SubType)}
              >
                {st.label}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
