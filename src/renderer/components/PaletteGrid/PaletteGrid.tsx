import { COLOR_PRESETS } from '../../catalog'

interface PaletteGridProps {
  isActive: (i: number) => boolean
  onPick: (i: number) => void
  /** Tooltip for slot `i`; defaults to the palette's name. */
  title?: (i: number, label: string) => string
  /** sm = the cycle chooser, md = the Effetti panel, lg = Simple mode. */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * The one grid of palettes.
 *
 * There were three: the Effetti panel drew sixteen buttons with names under
 * the swatches, the palette-cycle chooser drew the same sixteen smaller and
 * faded, and Simple mode drew them again with its own `.simple-palette` class
 * — three grid templates written inline, three swatch sizes, one list.
 */
export function PaletteGrid({ isActive, onPick, title, size = 'md' }: PaletteGridProps) {
  return (
    <div className={`pal-grid pal-grid-${size}`}>
      {COLOR_PRESETS.map((preset, i) => {
        const active = isActive(i)
        return (
          <button
            key={preset.label}
            type="button"
            aria-pressed={active}
            className={`btn pal-btn${active ? ' active' : ''}`}
            onClick={() => onPick(i)}
            title={title ? title(i, preset.label) : `Palette ${preset.label}`}
          >
            <span className="pal-swatches">
              {preset.colors.map((c, j) => <span key={j} className="pal-sw" style={{ background: c }} />)}
            </span>
            {size === 'md' && <span className="pal-name">{preset.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
