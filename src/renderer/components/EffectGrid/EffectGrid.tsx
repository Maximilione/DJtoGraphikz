import { memo, useEffect, useMemo, useState } from 'react'
import type { EffectId } from '@engine/Engine'
import { EFFECT_CATEGORIES, EFFECT_PALETTE_USE } from '../../catalog'
import { getThumb, onThumbs, thumbBackground } from '../../fxThumbs'

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
 *
 * Memoised: the parent re-renders on every engine emit, and 46 buttons with
 * thumbnails are the most expensive thing in the sidebar. Being memoised, it
 * no longer re-renders with the parent when a thumbnail lands: it listens for
 * them itself.
 */
// Folded categories survive a tab switch (the panel unmounts the grid).
const folded = new Set<string>()

const matches = (fx: { label: string; id: string }, q: string) => fx.label.toLowerCase().includes(q) || fx.id.includes(q)

export const EffectGrid = memo(function EffectGrid({ activeId, onPick, size = 'sm', search = '' }: EffectGridProps) {
  const [, force] = useState(0)
  useEffect(() => onThumbs(() => force(n => n + 1)), [])
  const q = search.trim().toLowerCase()
  // the filter was computed twice per render (once for "no results", once per category)
  const shownByCat = useMemo(
    () => EFFECT_CATEGORIES.map(cat => (q ? cat.effects.filter(fx => matches(fx, q)) : cat.effects)),
    [q],
  )

  if (q && shownByCat.every(list => list.length === 0)) {
    return <div className="u-hint">Nessun effetto per «{search.trim()}»</div>
  }

  return (
    <>
      {EFFECT_CATEGORIES.map((cat, ci) => {
        const shown = shownByCat[ci]
        if (shown.length === 0) return null
        const grid = (
          <div className={`fx-grid${size === 'lg' ? ' fx-grid-lg' : ''}`}>
              {shown.map(fx => {
                const isActive = activeId === fx.id
                const thumb = getThumb(fx.id)
                const pal = EFFECT_PALETTE_USE[fx.id]
                return (
                  <button
                    key={fx.id}
                    onClick={() => onPick(fx.id)}
                    className={`fx-btn${size === 'lg' ? ' fx-btn-lg' : ''}${isActive ? ' active' : ''}${thumb ? ' fx-thumb' : ''}`}
                    title={pal ? `Effetto ${fx.label} — usa ${pal === 1 ? 'un solo colore' : 'due colori'} della palette` : `Effetto ${fx.label}`}
                    style={thumb ? { background: thumbBackground(thumb, isActive) } : undefined}
                   >
                    <span className="fx-ico">{fx.icon}</span>
                    <span className="fx-name">{fx.label}</span>
                    {pal && <span className="fx-pal" aria-label={`${pal} ${pal === 1 ? 'colore' : 'colori'}`}>{'●'.repeat(pal)}</span>}
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
})
