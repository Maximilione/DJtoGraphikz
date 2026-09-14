import type { Genre } from '@engine/AutoVJ'
import { GENRES } from '../../catalog'

interface AutoVJControlProps {
  enabled: boolean
  genre: Genre
  status: { current: string; count: number }
  onToggle: (on: boolean) => void
  onGenre: (g: Genre) => void
  /** 'lg' is Simple mode: the same row and the same select, with more air. */
  size?: 'sm' | 'lg'
}

/**
 * The one Auto VJ control.
 *
 * There were two: Simple mode drew a big `.simple-autovj` button and a bare
 * `<select>` of genre names, while the Auto VJ panel drew a `.row-item` toggle
 * and ten `.row-item` buttons carrying the descriptions. Same two decisions —
 * on or off, which genre — in two markups, with the descriptions in only one
 * of them. The list of ten became a select that carries the descriptions, so
 * both modes say the same thing and Pro spends one control where it spent ten.
 */
export function AutoVJControl({ enabled, genre, status, onToggle, onGenre, size = 'sm' }: AutoVJControlProps) {
  const lg = size === 'lg'
  return (
    <>
      <button type="button" aria-pressed={enabled}
        className={`row-item${lg ? ' lg' : ''}${enabled ? ' active' : ''}`}
        onClick={() => onToggle(!enabled)}
        title="Cambia effetti, post-FX e colori da solo, a tempo di musica"
      >
        <div className={`toggle${enabled ? ' active' : ''}`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row-title">{enabled ? 'Auto VJ attivo' : 'Auto VJ'}</div>
          <div className="row-sub">
            {enabled
              ? `${status.count} cambi · ora: ${status.current || '—'}`
              : 'Fa tutto da solo, a tempo di musica'}
          </div>
        </div>
      </button>
      <select
        className={`vj-genre${lg ? ' lg' : ''}`}
        value={genre}
        onChange={e => onGenre(e.target.value as Genre)}
        title="Genere musicale — imposta effetti, colori e velocità"
      >
        {GENRES.map(g => (
          <option key={g.id} value={g.id}>{g.label} — {g.desc.toLowerCase()}</option>
        ))}
      </select>
    </>
  )
}
