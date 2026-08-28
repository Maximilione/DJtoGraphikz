import React, { useState } from 'react'
import { GENRE_CONFIGS, type Genre } from '@engine/AutoVJ'

// The AutoVJ instance lives in App (shared with Simple mode); this panel is just its Pro-view controls.
interface AutoVJPanelProps {
  vjEnabled: boolean
  vjGenre: Genre
  vjStatus: { current: string; count: number }
  onToggle: (on: boolean) => void
  onGenre: (g: Genre) => void
}

const GENRES: { id: Genre; label: string; desc: string }[] = [
  { id: 'acid-techno', label: 'Acid Techno', desc: 'Veloce, psichedelico, neon' },
  { id: 'hard-tekno', label: 'Hard Tekno', desc: 'Aggressivo, intenso, cambi rapidi' },
  { id: 'dark-industrial', label: 'Dark Industrial', desc: 'Glitch, monocromo, digitale' },
  { id: 'minimal-hypnotic', label: 'Minimal', desc: 'Lento, fluido, ipnotico' },
  { id: 'trance', label: 'Trance', desc: 'Colorato, morbido, sognante' },
  { id: 'drum-n-bass', label: 'Drum & Bass', desc: 'Rapido, energico, particelle' },
  { id: 'ambient', label: 'Ambient', desc: 'Calmo, fluido, colori tenui' },
  { id: 'gabber', label: 'Gabber', desc: 'Caos totale, glitch, velocissimo' },
]

export function AutoVJPanel({ vjEnabled, vjGenre, vjStatus, onToggle, onGenre }: AutoVJPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const config = GENRE_CONFIGS[vjGenre]

  return (
    <div className="panel">
      <div
        className="panel-header"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Espandi Auto VJ' : 'Comprimi Auto VJ'}
      >
        <span>Auto VJ</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div className="u-col">
          {/* Enable toggle */}
          <div
            className={`row-item${vjEnabled ? ' active' : ''}`}
            onClick={() => onToggle(!vjEnabled)}
            title="Cambia effetti, post-FX e colori da solo, a tempo di musica"
          >
            <div className={`toggle${vjEnabled ? ' active' : ''}`} />
            <div style={{ flex: 1 }}>
              <div className="row-title" style={vjEnabled ? { color: 'var(--accent)' } : undefined}>
                {vjEnabled ? 'Auto VJ attivo' : 'Attiva Auto VJ'}
              </div>
              {vjEnabled && (
                <div className="row-sub">
                  {vjStatus.count} cambi · ora: {vjStatus.current || '—'}
                </div>
              )}
            </div>
          </div>

          {/* Genre selector */}
          <div>
            <div className="cat-label">Genere</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {GENRES.map(g => {
                const isActive = vjGenre === g.id
                return (
                  <div
                    key={g.id}
                    className={`row-item${isActive ? ' active' : ''}`}
                    onClick={() => onGenre(g.id)}
                    title={`Stile ${g.label}: ${g.desc.toLowerCase()}`}
                  >
                    <div className={`status-dot ${isActive ? 'on' : 'off'}`} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row-title">{g.label}</div>
                      <div className="row-sub">{g.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Genre info */}
          <details className="u-hint">
            <summary style={{ cursor: 'pointer', marginBottom: '4px' }} title="Dettagli della configurazione del genere">
              Configurazione {config.label}
            </summary>
            <div style={{ paddingLeft: '6px', lineHeight: '1.6' }}>
              <div>
                <span style={{ color: 'var(--accent)' }}>Effetti:</span>{' '}
                {config.effects.join(', ')}
              </div>
              <div>
                <span style={{ color: 'var(--accent)' }}>Cambio:</span>{' '}
                ogni {config.switchBeats} beat ({config.transitionStyle})
              </div>
              <div>
                <span style={{ color: 'var(--accent)' }}>Soglia energia:</span>{' '}
                {(config.energyThreshold * 100).toFixed(0)}%
              </div>
              <div>
                <span style={{ color: 'var(--accent)' }}>Combo post-FX:</span>{' '}
                {config.postSets.length}
              </div>
              <div>
                <span style={{ color: 'var(--accent)' }}>Palette:</span>{' '}
                {config.palettes.length}
              </div>
              {/* Palette swatches */}
              <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                {config.palettes.map((pal, i) => (
                  <div key={i} style={{ display: 'flex', gap: '1px' }}>
                    {pal.map((c, j) => (
                      <div key={j} style={{ width: '8px', height: '8px', borderRadius: '1px', background: c }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
