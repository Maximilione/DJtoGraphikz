import React, { useEffect } from 'react'

interface CheatSheetProps {
  onClose: () => void
}

const KEYBOARD: [string, string][] = [
  ['B', 'blackout'],
  ['F', 'freeze'],
  ['P', 'panic'],
  ['[ ]', 'master'],
  ['Space', 'tap BPM'],
  ['1-0', 'effetti'],
  ['Q/W/E/R', 'post'],
  ['Shift+1-0', 'look'],
  ['?', 'aiuto'],
]

const MOUSE: [string, string][] = [
  ['Shift+click slot', 'sovrascrivi look'],
  ['Doppio click nome', 'rinomina'],
  ['Rotella su un valore', 'regola (dopo click)'],
]

const PHONE: [string, string][] = [
  ['📱 in alto', 'QR + codice per il telefono'],
]

function Section({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <h3 style={{ color: 'var(--accent)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>
        {title}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', alignItems: 'baseline' }}>
        {rows.map(([key, desc]) => (
          <React.Fragment key={key}>
            <b style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{key}</b>
            <span style={{ color: 'var(--text-secondary)' }}>{desc}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

/** Full-screen hotkey cheat sheet. Closes on click, Escape or `?`. */
export function CheatSheet({ onClose }: CheatSheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="onboarding-backdrop" onClick={onClose}>
      <div className="onboarding-card" style={{ maxWidth: 640 }}>
        <h2>Scorciatoie</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 16 }}>
          <Section title="Tastiera" rows={KEYBOARD} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Section title="Mouse" rows={MOUSE} />
            <Section title="Telefono" rows={PHONE} />
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 20, marginBottom: 0 }}>
          Click, Esc o ? per chiudere
        </p>
      </div>
    </div>
  )
}
