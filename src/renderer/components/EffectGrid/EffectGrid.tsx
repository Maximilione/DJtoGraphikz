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
export function EffectGrid({ activeId, onPick, size = 'sm', search = '' }: EffectGridProps) {
  const q = search.trim().toLowerCase()

  return (
    <>
      {EFFECT_CATEGORIES.map(cat => {
        const shown = q
          ? cat.effects.filter(fx => fx.label.toLowerCase().includes(q) || fx.id.includes(q))
          : cat.effects
        if (shown.length === 0) return null
        return (
          <div key={cat.name}>
            <div className="cat-label">{cat.name}</div>
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
          </div>
        )
      })}
    </>
  )
}
