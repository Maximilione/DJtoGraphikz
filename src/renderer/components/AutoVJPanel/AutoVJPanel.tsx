import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { Engine, EffectId, PostId } from '@engine/Engine'
import { AutoVJ, GENRE_CONFIGS, type Genre } from '@engine/AutoVJ'

interface AutoVJPanelProps {
  engine: Engine | null
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

export function AutoVJPanel({ engine }: AutoVJPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [genre, setGenre] = useState<Genre>('acid-techno')
  const [currentEffect, setCurrentEffect] = useState<string>('')
  const [switchCount, setSwitchCount] = useState(0)
  const autoVJRef = useRef<AutoVJ | null>(null)
  const enabledRef = useRef(false)

  // Initialize AutoVJ
  useEffect(() => {
    const vj = new AutoVJ()
    autoVJRef.current = vj
    return () => { autoVJRef.current = null }
  }, [])

  // Wire callbacks when engine changes
  useEffect(() => {
    const vj = autoVJRef.current
    if (!vj || !engine) return

    vj.onEffectChange = (effect: EffectId) => {
      engine.setEffect(effect)
      setCurrentEffect(effect)
      setSwitchCount(prev => prev + 1)
    }

    vj.onPostChange = (posts: PostId[]) => {
      // Clear current posts and set new ones
      const current = engine.getActivePosts()
      for (const p of current) engine.togglePost(p)
      for (const p of posts) {
        if (!engine.isPostActive(p)) engine.togglePost(p)
      }
    }

    vj.onPaletteChange = (colors: [string, string, string]) => {
      engine.setColors(colors[0], colors[1], colors[2])
    }

    return () => {
      vj.onEffectChange = null
      vj.onPostChange = null
      vj.onPaletteChange = null
    }
  }, [engine])

  // Keep ref in sync
  useEffect(() => { enabledRef.current = enabled }, [enabled])

  // Hook into Engine render loop for accurate beat detection
  useEffect(() => {
    if (!engine) return

    engine.onAudioFrame = (beatDetected: boolean, energy: number, bass: number) => {
      const vj = autoVJRef.current
      if (!vj || !enabledRef.current) return
      vj.update(beatDetected, energy, bass)
    }

    return () => {
      engine.onAudioFrame = null
    }
  }, [engine])

  const toggleEnabled = useCallback(() => {
    const next = !enabled
    setEnabled(next)
    autoVJRef.current?.setEnabled(next)
    if (next) {
      setSwitchCount(0)
    }
  }, [enabled])

  const changeGenre = useCallback((g: Genre) => {
    setGenre(g)
    autoVJRef.current?.setGenre(g)
  }, [])

  const config = GENRE_CONFIGS[genre]

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
            onClick={toggleEnabled}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 8px', borderRadius: '4px', cursor: 'pointer',
              background: enabled ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
              border: enabled ? '1px solid var(--accent)' : '1px solid var(--border)',
            }}
          >
            <div className={`toggle${enabled ? ' active' : ''}`} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '11px', fontWeight: enabled ? 600 : 400,
                color: enabled ? 'var(--accent)' : 'var(--text-secondary)',
              }}>
                {enabled ? 'Auto VJ Active' : 'Enable Auto VJ'}
              </div>
              {enabled && (
                <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {switchCount} switches | current: {currentEffect || '—'}
                </div>
              )}
            </div>
          </div>

          {/* Genre selector */}
          <div>
            <div style={catLabel}>Genre</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {GENRES.map(g => {
                const isActive = genre === g.id
                return (
                  <div
                    key={g.id}
                    onClick={() => changeGenre(g.id)}
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
              {GENRE_CONFIGS[genre].label} config
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
