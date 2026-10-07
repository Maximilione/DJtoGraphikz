import { useEffect, useRef, useState } from 'react'
import { addUserPalette, allPalettes, isUserPalette, onPalettes, pixelsFromImageFile, removeUserPalette } from '../../palettes'
import { paletteFromImage } from '../../paletteFromImageBrowser'

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
 *
 * The last slot takes a picture (Q2): drop the club's flyer or logo on it, or
 * click it to choose a file, and its colours become a palette of yours.
 */
export function PaletteGrid({ isActive, onPick, title, size = 'md' }: PaletteGridProps) {
  const [, bump] = useState(0)
  useEffect(() => onPalettes(() => bump(n => n + 1)), [])
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const palettes = allPalettes()

  const fromFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    const colors = paletteFromImage(await pixelsFromImageFile(file))
    if (!colors) return
    const idx = addUserPalette({ label: file.name.replace(/\.[^.]+$/, '').slice(0, 14) || 'Mia', colors })
    onPick(idx)
  }

  return (
    <div className={`pal-grid pal-grid-${size}`}>
      {palettes.map((preset, i) => {
        const active = isActive(i)
        const mine = isUserPalette(i)
        return (
          <button
            key={`${i}-${preset.label}`}
            type="button"
            aria-pressed={active}
            className={`btn pal-btn${active ? ' active' : ''}`}
            onClick={() => onPick(i)}
            onContextMenu={mine ? (e => { e.preventDefault(); removeUserPalette(i) }) : undefined}
            title={title ? title(i, preset.label) : preset.plugin ? `Palette ${preset.label} (plugin)` : mine ? `Palette ${preset.label} (tua — tasto destro per rimuoverla)` : `Palette ${preset.label}`}
          >
            <span className="pal-swatches">
              {preset.colors.map((c, j) => <span key={j} className="pal-sw" style={{ background: c }} />)}
            </span>
            {size === 'md' && <span className="pal-name">{preset.label}</span>}
          </button>
        )
      })}
      {size !== 'sm' && (
        <button
          type="button"
          className={`btn pal-btn pal-drop${over ? ' drag-over' : ''}`}
          title="Trascina qui il flyer o il logo del locale, o clicca per scegliere un'immagine: i suoi colori diventano una palette"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); void fromFile(e.dataTransfer.files[0]) }}
        >
          <span className="pal-swatches" aria-hidden="true"><span className="pal-sw" style={{ background: 'transparent', border: '1px dashed currentColor' }} /></span>
          {size === 'md' && <span className="pal-name">+ immagine</span>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { void fromFile(e.target.files?.[0]); e.target.value = '' }} />
        </button>
      )}
    </div>
  )
}
