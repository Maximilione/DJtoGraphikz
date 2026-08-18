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
  { id: 'acid-techno', label: 'Acid Techno', desc: 'Fast, psychedelic, neon' },
  { id: 'hard-tekno', label: 'Hard Tekno', desc: 'Aggressive, intense, fast switches' },
  { id: 'dark-industrial', label: 'Dark Industrial', desc: 'Glitchy, monochrome, digital' },
  { id: 'minimal-hypnotic', label: 'Minimal', desc: 'Slow, flowing, hypnotic' },
  { id: 'trance', label: 'Trance', desc: 'Colorful, smooth, dreamy' },
  { id: 'drum-n-bass', label: 'Drum & Bass', desc: 'Rapid, energetic, particles' },
  { id: 'ambient', label: 'Ambient', desc: 'Calm, fluid, soft colors' },
  { id: 'gabber', label: 'Gabber', desc: 'Maximum chaos, glitch, fast' },
]

export function AutoVJPanel({ vjEnabled, vjGenre, vjStatus, onToggle, onGenre }: AutoVJPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const config = GENRE_CONFIGS[vjGenre]

  return (
    <div className="panel">
      <div className="panel-header" onClick={() => setCollapsed(!collapsed)}>
        <span>Auto VJ</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Enable toggle */}
          <div
            onClick={() => onToggle(!vjEnabled)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 8px', borderRadius: '4px', cursor: 'pointer',
              background: vjEnabled ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
              border: vjEnabled ? '1px solid var(--accent)' : '1px solid var(--border)',
            }}
          >
            <div className={`toggle${vjEnabled ? ' active' : ''}`} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '11px', fontWeight: vjEnabled ? 600 : 400,
                color: vjEnabled ? 'var(--accent)' : 'var(--text-secondary)',
              }}>
                {vjEnabled ? 'Auto VJ Active' : 'Enable Auto VJ'}
              </div>
              {vjEnabled && (
                <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {vjStatus.count} switches | current: {vjStatus.current || '—'}
                </div>
              )}
            </div>
          </div>

          {/* Genre selector */}
          <div>
            <div style={catLabel}>Genre</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {GENRES.map(g => {
                const isActive = vjGenre === g.id
                return (
                  <div
                    key={g.id}
                    onClick={() => onGenre(g.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '5px 6px', borderRadius: '4px', cursor: 'pointer',
                      background: isActive ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                      border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                      transition: 'all 0.1s',
                    }}
                  >
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                      background: isActive ? 'var(--accent)' : 'var(--text-muted)',
                      boxShadow: isActive ? '0 0 4px var(--accent)' : 'none',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '10px', fontWeight: isActive ? 600 : 400,
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}>
                        {g.label}
                      </div>
                      <div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>
                        {g.desc}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Genre info */}
          <details style={{ fontSize: '8px', color: 'var(--text-muted)' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '4px' }}>
              {config.label} config
            </summary>
            <div style={{ paddingLeft: '6px', lineHeight: '1.6' }}>
              <div>
                <span style={{ color: 'var(--accent)' }}>Effects:</span>{' '}
                {config.effects.join(', ')}
              </div>
              <div>
                <span style={{ color: 'var(--accent)' }}>Switch:</span>{' '}
                every {config.switchBeats} beats ({config.transitionStyle})
              </div>
              <div>
                <span style={{ color: 'var(--accent)' }}>Energy threshold:</span>{' '}
                {(config.energyThreshold * 100).toFixed(0)}%
              </div>
              <div>
                <span style={{ color: 'var(--accent)' }}>Post combos:</span>{' '}
                {config.postSets.length}
              </div>
              <div>
                <span style={{ color: 'var(--accent)' }}>Palettes:</span>{' '}
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

const catLabel: React.CSSProperties = {
  fontSize: '8px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '1.2px',
  marginBottom: '3px',
}
