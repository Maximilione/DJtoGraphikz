import React, { useState } from 'react'
import { Panel } from '../Panel/Panel'
import { pushToast } from '../Toasts/Toasts'
import { readJson, writeJson, writeString } from '../../storage'
import { VENUES_KEY, sanitizeVenues, upsertVenue, type Venue } from '../../venues'

interface VenuePanelProps {
  /** null when the engine is not up yet — nothing to snapshot. */
  capture: (name: string) => Venue | null
  apply: (v: Venue) => void
}

/** P2 — named room setups: display, resolution, mapping, audio, ArtNet, master. */
export function VenuePanel({ capture, apply }: VenuePanelProps) {
  const [venues, setVenues] = useState<Venue[]>(() => {
    const raw = readJson<unknown>(VENUES_KEY, [])
    const good = sanitizeVenues(raw)
    // a profile with one field out of range is dropped here and the next
    // store() rewrites the list without it: keep the bytes, like storage.ts
    // does for a parse error, instead of losing the room for good
    if (Array.isArray(raw) && good.length < raw.length) writeString(`${VENUES_KEY}.scartati`, JSON.stringify(raw))
    return good
  })
  const [name, setName] = useState('')

  const store = (next: Venue[]) => {
    // writeJson already toasts a full store — showing "salvato" after a failed
    // write is exactly the kind of lie the storage layer exists to prevent.
    if (!writeJson(VENUES_KEY, next)) return false
    setVenues(next)
    return true
  }

  const save = () => {
    const n = name.trim()
    if (!n) return
    const v = capture(n)
    if (!v) { pushToast('Motore non pronto — riprova fra un istante', 'venue-capture', undefined, 'err'); return }
    // upsert replaces a same-named profile (case-insensitive) with no word of it
    const prev = venues
    const existed = venues.some(x => x.name.toLowerCase() === n.toLowerCase())
    if (!store(upsertVenue(venues, v))) return
    setName('')
    if (existed) pushToast(`Posto "${n}" aggiornato`, 'venue-save', { label: 'Annulla', fn: () => store(prev) })
    else pushToast(`Posto "${n}" salvato`)
  }

  return (
    <Panel id="venues" title="Posti" defaultCollapsed group="right">
      <div className="u-col" style={{ gap: 8 }}>
        <div className="u-hint">
          Salva il locale: display e risoluzione di uscita, i 4 angoli del mapping,
          scheda audio e gain, nodo ArtNet e master. La seconda serata nello stesso
          posto torna a un click.
        </div>
        {venues.length === 0 && <div className="u-hint">Nessun posto salvato.</div>}
        {venues.map(v => (
          <div key={v.name} className="slider-row">
            <button className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: 'left' }}
              onClick={() => {
                // a click rewrites the whole room with the projector on: keep the way back
                const before = capture('stato precedente')
                apply(v)
                if (before) pushToast('Configurazione precedente conservata', 'venue-undo', { label: 'Annulla', fn: () => apply(before) })
              }}
              title={`Carica ${v.name} — ${v.outputRes}`}>
              {v.name}
            </button>
            <span className="label" style={{ fontFamily: 'var(--font-mono)' }}>{v.outputRes}</span>
            <button className="btn btn-secondary btn-sm"
              onClick={() => {
                const prev = venues
                if (store(venues.filter(x => x.name !== v.name))) pushToast(`Posto "${v.name}" eliminato`, `venue-del-${v.name}`, { label: 'Annulla', fn: () => store(prev) })
              }}
              title={`Elimina ${v.name}`} aria-label={`Elimina ${v.name}`}>×</button>
          </div>
        ))}
        <div className="slider-row">
          <input type="text" value={name} placeholder="Nome del posto"
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { save(); e.currentTarget.blur() } }}
            style={{ flex: 1, fontSize: 'var(--fs-xs)' }} />
          <button className="btn btn-secondary btn-sm" onClick={save} disabled={!name.trim()}
            title="Salva la configurazione attuale con questo nome">Salva</button>
        </div>
      </div>
    </Panel>
  )
}
