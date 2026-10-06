import type { EffectId } from '@engine/Engine'
import { EFFECT_CATEGORIES } from '../../catalog'
import { getThumb, thumbBackground } from '../../fxThumbs'

interface EffectGridProps {
  activeId: EffectId | null
  onPick: (id: EffectId) => void
  /** 'lg' is the Simple-mode grid: taller rows, bigger icon, no ellipsis games */
  size?: 'sm' | 'lg'
  /** substring filter on label or id; empty shows everything */
  search?: string
}

/**
 * The one grid of effects.
 *
 * There used to be two: the Pro panel drew 46 buttons with `.fx-btn`/`.fx-ico`
 * and the Simple panel drew the same 46 with `.simple-fx`/`.fx-icon` — two
 * markup trees, two class families, and two class names one letter apart. They
 * had already drifted (only one of them had live thumbnails on the buttons),
 * which is what a second copy always does.
 */
// Folded categories survive a tab switch (the panel unmounts the grid).
const folded = new Set<string>()

export function EffectGrid({ activeId, onPick, size = 'sm', search = '' }: EffectGridProps) {
  const q = search.trim().toLowerCase()

  if (q && !EFFECT_CATEGORIES.some(c => c.effects.some(fx => fx.label.toLowerCase().includes(q) || fx.id.includes(q)))) {
    return <div className="u-hint">Nessun effetto per «{search.trim()}»</div>
  }

  return (
    <>
      {EFFECT_CATEGORIES.map(cat => {
        const shown = q
          ? cat.effects.filter(fx => fx.label.toLowerCase().includes(q) || fx.id.includes(q))
          : cat.effects
        if (shown.length === 0) return null
        const grid = (
          <div className={`fx-grid${size === 'lg' ? ' fx-grid-lg' : ''}`}>
              {shown.map(fx => {
                const isActive = activeId === fx.id
                const thumb = getThumb(fx.id)
                return (
                  <button
                    key={fx.id}
                    onClick={() => onPick(fx.id)}
                    className={`fx-btn${size === 'lg' ? ' fx-btn-lg' : ''}${isActive ? ' active' : ''}${thumb ? ' fx-thumb' : ''}`}
                    title={`Effetto ${fx.label}`}
                    style={thumb ? { background: thumbBackground(thumb, isActive) } : undefined}
                   >
                    <span className="fx-ico">{fx.icon}</span>
                    <span className="fx-name">{fx.label}</span>
                  </button>
                )
              })}
          </div>
        )
        // Simple mode: always open, no folding to get lost in
        if (size === 'lg') return <div key={cat.name}><div className="cat-label">{cat.name}</div>{grid}</div>
        const activeHere = cat.effects.find(fx => fx.id === activeId)
        return (
          <details
            key={cat.name} className="fx-cat"
            open={!!q || !folded.has(cat.name)}
            onToggle={e => {
              if (q) return // a search forces every match open: not the user's choice
              if ((e.currentTarget as HTMLDetailsElement).open) folded.delete(cat.name); else folded.add(cat.name)
            }}
          >
            <summary>
              {cat.name} <span className="fx-cat-n">{shown.length}</span>
              {activeHere && <span className="fx-cat-on">● {activeHere.label}</span>}
            </summary>
            {grid}
          </details>
        )
      })}
    </>
  )
}
