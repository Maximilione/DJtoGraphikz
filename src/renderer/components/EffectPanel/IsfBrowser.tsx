import React, { useEffect, useMemo, useState } from 'react'

interface IsfEntry { id: string; title: string; user: string; thumb: string; stars: number }

interface IsfBrowserProps {
  onClose: () => void
  /** Called with the saved file's name+source after a successful download */
  onImported: (name: string, source: string) => void
}

const THUMB_BASE = 'https://res.cloudinary.com/hrlz5rsqo/image/upload/w_200,h_112,c_fill'
const PAGE = 60

/** Browse editor.isf.video generators and import them into ~/.djtographikz/isf */
export function IsfBrowser({ onClose, onImported }: IsfBrowserProps) {
  const [index, setIndex] = useState<IsfEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    window.api.browseIsf()
      .then(setIndex)
      .catch(e => setError(e?.message || 'rete non disponibile'))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const matches = useMemo(() => {
    if (!index) return []
    const q = query.trim().toLowerCase()
    if (!q) return index
    return index.filter(s => s.title.toLowerCase().includes(q) || s.user.toLowerCase().includes(q))
  }, [index, query])

  const doImport = async (s: IsfEntry) => {
    if (busy) return
    setBusy(s.id)
    try {
      const r = await window.api.importIsfOnline(s.id, s.title)
      onImported(r.name, r.source)
    } catch (e: any) {
      setError(e?.message || 'download fallito')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="onboarding-backdrop" onClick={onClose}>
      <div
        className="onboarding-card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 720, width: '90vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}
      >
        <h2 style={{ marginBottom: 4 }}>Libreria ISF online</h2>
        <div className="u-hint" style={{ marginBottom: 10 }}>
          Generator pubblici da editor.isf.video — click per scaricare in ~/.djtographikz/isf
        </div>
        <input
          type="text"
          placeholder="Cerca per nome o autore…"
          value={query}
          autoFocus
          onChange={e => { setQuery(e.target.value); setShown(PAGE) }}
          style={{ marginBottom: 10 }}
        />
        {error && (
          <div className="u-hint" style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div>
        )}
        {!index && !error && <div className="u-hint">Carico l'indice (la prima volta può volerci qualche secondo)…</div>}
        {index && (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div className="isfb-grid">
              {matches.slice(0, shown).map(s => (
                <button
                  key={s.id}
                  className="isfb-card"
                  disabled={busy !== null}
                  onClick={() => doImport(s)}
                  title={`${s.title} — ${s.user} (★${s.stars})`}
                >
                  {s.thumb
                    ? <img src={`${THUMB_BASE}/${s.thumb}`} loading="lazy" alt="" />
                    : <div className="isfb-noimg">ƒ</div>}
                  <span className="isfb-title">{busy === s.id ? 'Scarico…' : s.title}</span>
                  <span className="isfb-user">{s.user}</span>
                </button>
              ))}
            </div>
            {matches.length > shown && (
              <button className="isfb-more" onClick={() => setShown(n => n + PAGE)}>
                Mostra altri ({matches.length - shown})
              </button>
            )}
            {matches.length === 0 && <div className="u-hint">Nessun risultato per "{query}"</div>}
          </div>
        )}
      </div>
    </div>
  )
}
