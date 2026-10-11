import { useState } from 'react'
import { useMeta } from '../hooks/queries'
import { useToggleFavorite } from '../hooks/useToggleFavorite'
import { catOf, genreOf, statusLabel } from '../lib/labels'
import type { Item } from '../types'

interface Props {
  item: Item
  index: number
  onOpen: (it: Item) => void
}

export function ItemCard({ item, index, onOpen }: Props) {
  const meta = useMeta()
  const fav = useToggleFavorite()
  const [pop, setPop] = useState(false)

  const cat = catOf(meta, item.category)
  const color = cat?.color ?? '#71717a'
  const subMeta = genreOf(meta, item.category, item.sub_type)

  return (
    <article
      className="card"
      style={{ animationDelay: `${Math.min(index * 40, 560)}ms` }}
      onClick={() => onOpen(item)}
    >
      <div className="cover" style={{ background: `${color}14` }}>
        {item.image_url ? (
          <img className="cover-img" src={item.image_url} alt={item.title} loading="lazy" />
        ) : (
          <span className="emoji">{item.emoji ?? cat?.emoji ?? '🎴'}</span>
        )}
        <div className="cov-badges">
          <span className="pill">
            <i style={{ background: color }} />
            {cat?.label ?? item.category}
          </span>
          {subMeta && (
            <span className="pill">
              <i style={{ background: subMeta.color }} />
              {subMeta.label}
            </span>
          )}
        </div>
        <button
          className={'fav' + (item.favorite ? ' on' : '') + (pop ? ' pop' : '')}
          onClick={(e) => {
            e.stopPropagation()
            setPop(true)
            fav.mutate({ id: item.id, favorite: !item.favorite })
          }}
          onAnimationEnd={() => setPop(false)}
          aria-label="设为喜爱"
        >
          {item.favorite ? '♥' : '♡'}
        </button>
      </div>
      <div className="cbody">
        <h3>{item.title}</h3>
        <p className="meta">
          <span className="stars">
            {'★'.repeat(item.rating)}
            {'☆'.repeat(5 - item.rating)}
          </span>
          <span className="dot" style={{ background: meta.status_colors[item.status] ?? '#71717a' }} />
          {statusLabel(meta, item.category, item.status)}
        </p>
      </div>
    </article>
  )
}
