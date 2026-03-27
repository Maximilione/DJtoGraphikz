import React, { useState, useCallback } from 'react'
import type { Engine, EffectId, PostId } from '@engine/Engine'

interface EffectPanelProps {
  engine: Engine | null
}

// Effects organized by category
const EFFECT_CATEGORIES: { name: string; effects: { id: EffectId; label: string; icon: string }[] }[] = [
  {
    name: 'Geometric',
    effects: [
      { id: 'tunnel', label: 'Tunnel', icon: '◎' },
      { id: 'kaleidoscope', label: 'Kaleido', icon: '✦' },
      { id: 'voronoi', label: 'Voronoi', icon: '⬡' },
      { id: 'sacred', label: 'Sacred', icon: '✡' },
      { id: 'mandala', label: 'Mandala', icon: '❋' },
      { id: 'hexagons', label: 'Hex', icon: '⏣' },
      { id: 'rings', label: 'Rings', icon: '◉' },
    ],
  },
  {
    name: 'Organic',
    effects: [
      { id: 'fluid', label: 'Fluid', icon: '≋' },
      { id: 'plasma', label: 'Plasma', icon: '◈' },
      { id: 'warp', label: 'Warp', icon: '∿' },
      { id: 'metaballs', label: 'Meta', icon: '●' },
      { id: 'fire', label: 'Fire', icon: '△' },
      { id: 'fractal', label: 'Fractal', icon: '✻' },
    ],
  },
  {
    name: 'Motion',
    effects: [
      { id: 'particles', label: 'Particle', icon: '⁂' },
      { id: 'starfield', label: 'Stars', icon: '✧' },
      { id: 'waves', label: 'Waves', icon: '〰' },
      { id: 'lissajous', label: 'Lissaj', icon: '∞' },
      { id: 'dna', label: 'DNA', icon: '⧖' },
    ],
  },
  {
    name: 'Digital',
    effects: [
      { id: 'matrix', label: 'Matrix', icon: '▤' },
      { id: 'grid', label: 'Grid', icon: '⊞' },
      { id: 'glitch', label: 'Glitch', icon: '⚡' },
    ],
  },
]

const POST_CATEGORIES: { name: string; effects: { id: PostId; label: string; icon: string; desc: string }[] }[] = [
  {
    name: 'Glow & Color',
    effects: [
      { id: 'bloom', label: 'Bloom', icon: '✦', desc: 'Bright glow diffusion' },
      { id: 'chromatic', label: 'Chromatic', icon: '◐', desc: 'Lens prism aberration' },
      { id: 'rgb-split', label: 'RGB Split', icon: '▥', desc: 'Channel color offset' },
      { id: 'invert', label: 'Invert', icon: '◑', desc: 'Negative colors' },
    ],
  },
  {
    name: 'Distortion',
    effects: [
      { id: 'feedback', label: 'Feedback', icon: '↻', desc: 'Echo motion trail' },
      { id: 'mirror', label: 'Mirror', icon: '⎸', desc: 'Horizontal symmetry' },
      { id: 'pixelate', label: 'Pixelate', icon: '▦', desc: 'Retro pixel blocks' },
    ],
  },
  {
    name: 'Film & Texture',
    effects: [
      { id: 'filmgrain', label: 'Film Grain', icon: '⁘', desc: 'Analog noise texture' },
      { id: 'scanlines', label: 'Scanlines', icon: '≡', desc: 'CRT monitor lines' },
    ],
  },
]

const COLOR_PRESETS: { label: string; colors: [string, string, string] }[] = [
  { label: 'Acid', colors: ['#00ff88', '#ff00ff', '#4444ff'] },
  { label: 'Fire', colors: ['#ff4400', '#ffaa00', '#ff0066'] },
  { label: 'Ice', colors: ['#00ccff', '#0044ff', '#88ffff'] },
  { label: 'Toxic', colors: ['#00ff00', '#aaff00', '#00ff88'] },
  { label: 'Neon', colors: ['#ff00ff', '#00ffff', '#ffff00'] },
  { label: 'Blood', colors: ['#ff0000', '#880000', '#ff4444'] },
  { label: 'Vapor', colors: ['#ff71ce', '#01cdfe', '#b967ff'] },
  { label: 'Mono', colors: ['#ffffff', '#888888', '#ffffff'] },
  { label: 'Sunset', colors: ['#ff6b35', '#f7c59f', '#1a535c'] },
  { label: 'Ocean', colors: ['#0077b6', '#00b4d8', '#90e0ef'] },
  { label: 'Forest', colors: ['#2d6a4f', '#52b788', '#95d5b2'] },
  { label: 'Cyber', colors: ['#f72585', '#7209b7', '#3a0ca3'] },
  { label: 'Gold', colors: ['#ffd700', '#daa520', '#b8860b'] },
  { label: 'Pastel', colors: ['#ffc8dd', '#bde0fe', '#a2d2ff'] },
  { label: 'Lava', colors: ['#ff4500', '#ff6347', '#2b0000'] },
  { label: 'Aurora', colors: ['#00ff87', '#60efff', '#ff00e5'] },
]

const CUSTOM_INDEX = COLOR_PRESETS.length

// Sub-sections as tabs
type Section = 'fx' | 'post' | 'color'

export function EffectPanel({ engine }: EffectPanelProps) {
  const [section, setSection] = useState<Section>('fx')
  const [activeEffect, setActiveEffect] = useState<EffectId>('tunnel')
  const [activePosts, setActivePosts] = useState<Set<PostId>>(new Set(['bloom']))
  const [activeColorPreset, setActiveColorPreset] = useState(0)
  const [customColors, setCustomColors] = useState<[string, string, string]>(['#ff0000', '#00ff00', '#0000ff'])
  const [transitionSpeed, setTransitionSpeed] = useState(0.5)
  const [search, setSearch] = useState('')

  // Cycling state
  const [cycleEnabled, setCycleEnabled] = useState(false)
  const [cycleBeatSync, setCycleBeatSync] = useState(false)
  const [cycleInterval, setCycleInterval] = useState(8)
  const [cycleBeats, setCycleBeats] = useState(16)
  const [cycleSelection, setCycleSelection] = useState<Set<number>>(() => new Set(COLOR_PRESETS.map((_, i) => i)))

  const selectEffect = useCallback((id: EffectId) => {
    if (!engine) return
    engine.setEffect(id)
    setActiveEffect(id)
  }, [engine])

  const togglePost = useCallback((id: PostId) => {
    if (!engine) return
    engine.togglePost(id)
    setActivePosts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [engine])

  const selectColorPreset = useCallback((idx: number) => {
    if (!engine) return
    if (idx === CUSTOM_INDEX) {
      engine.setColors(...customColors)
    } else {
      engine.setColors(...COLOR_PRESETS[idx].colors)
    }
    setActiveColorPreset(idx)
  }, [engine, customColors])

  const updateCustomColor = useCallback((index: 0 | 1 | 2, color: string) => {
    if (!engine) return
    const next: [string, string, string] = [...customColors]
    next[index] = color
    setCustomColors(next)
    if (activeColorPreset === CUSTOM_INDEX) {
      engine.setColors(...next)
    }
  }, [engine, customColors, activeColorPreset])

  const handleTransitionSpeed = useCallback((val: number) => {
    if (!engine) return
    engine.setColorTransitionSpeed(val)
    setTransitionSpeed(val)
  }, [engine])

  // Cycling handlers
  const toggleCycle = useCallback(() => {
    if (!engine) return
    const next = !cycleEnabled
    setCycleEnabled(next)
    if (next) {
      const palettes = COLOR_PRESETS
        .filter((_, i) => cycleSelection.has(i))
        .map(p => p.colors)
      if (palettes.length < 2) {
        setCycleEnabled(false)
        engine.setCycleEnabled(false)
        return
      }
      engine.setCyclePalettes(palettes)
      engine.setCycleEnabled(true)
    } else {
      engine.setCycleEnabled(false)
    }
  }, [engine, cycleEnabled, cycleSelection])

  const toggleCyclePreset = useCallback((idx: number) => {
    setCycleSelection(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      if (engine && cycleEnabled) {
        const palettes = COLOR_PRESETS
          .filter((_, i) => next.has(i))
          .map(p => p.colors)
        if (palettes.length >= 2) engine.setCyclePalettes(palettes)
      }
      return next
    })
  }, [engine, cycleEnabled])

  const handleCycleBeatSync = useCallback((val: boolean) => {
    if (!engine) return
    setCycleBeatSync(val)
    engine.setCycleBeatSync(val)
  }, [engine])

  const handleCycleInterval = useCallback((val: number) => {
    if (!engine) return
    setCycleInterval(val)
    engine.setCycleInterval(val * 1000)
  }, [engine])

  const handleCycleBeats = useCallback((val: number) => {
    if (!engine) return
    setCycleBeats(val)
    engine.setCycleBeatsPerSwitch(val)
  }, [engine])

  // Filter effects by search
  const searchLower = search.toLowerCase()

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Section tabs — always visible */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-tertiary)',
      }}>
        {[
          { id: 'fx' as Section, label: 'Effects', count: 21 },
          { id: 'post' as Section, label: `Post FX`, count: activePosts.size },
          { id: 'color' as Section, label: 'Colors', count: null },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSection(tab.id)}
            style={{
              flex: 1, padding: '7px 4px',
              background: section === tab.id ? 'var(--bg-secondary)' : 'transparent',
              color: section === tab.id ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px',
              textTransform: 'uppercase',
              borderBottom: section === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all 0.12s',
            }}
          >
            {tab.label}
            {tab.count !== null && (
              <span style={{
                marginLeft: '3px', fontSize: '8px',
                color: section === tab.id ? 'var(--accent-dim)' : 'var(--text-muted)',
                opacity: 0.7,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: '8px', maxHeight: '60vh', overflowY: 'auto' }}>
        {/* ====== EFFECTS TAB ====== */}
        {section === 'fx' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search effects..."
              style={{
                width: '100%', padding: '5px 8px',
                borderRadius: '4px', border: '1px solid var(--border)',
                background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                fontSize: '10px',
              }}
            />

            {/* Active effect indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 8px', borderRadius: '4px',
              background: 'var(--accent-glow)', border: '1px solid var(--accent)',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 4px var(--accent)' }} />
              <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {activeEffect}
              </span>
            </div>

            {/* Categories */}
            {EFFECT_CATEGORIES.map(cat => {
              const filtered = cat.effects.filter(fx =>
                !search || fx.label.toLowerCase().includes(searchLower) || fx.id.includes(searchLower)
              )
              if (filtered.length === 0) return null
              return (
                <div key={cat.name}>
                  <div style={{
                    fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '1.2px',
                    marginBottom: '3px', paddingLeft: '2px',
                  }}>
                    {cat.name}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2px' }}>
                    {filtered.map(fx => {
                      const isActive = activeEffect === fx.id
                      return (
                        <button
                          key={fx.id}
                          onClick={() => selectEffect(fx.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '5px 6px', borderRadius: '4px',
                            border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                            background: isActive ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                            fontSize: '9px', fontWeight: isActive ? 600 : 400,
                            cursor: 'pointer', transition: 'all 0.1s',
                            textAlign: 'left', overflow: 'hidden',
                          }}
                        >
                          <span style={{ fontSize: '11px', lineHeight: 1, flexShrink: 0, opacity: isActive ? 1 : 0.5 }}>
                            {fx.icon}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fx.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ====== POST FX TAB ====== */}
        {section === 'post' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Active indicator */}
            {activePosts.size > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '3px',
                padding: '4px 6px', borderRadius: '4px',
                background: 'var(--accent-glow)', border: '1px solid var(--accent)',
              }}>
                {Array.from(activePosts).map(id => (
                  <span key={id} style={{
                    fontSize: '8px', fontWeight: 600, color: 'var(--accent)',
                    padding: '1px 4px', borderRadius: '2px',
                    background: 'rgba(0,255,136,0.1)',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    {id}
                  </span>
                ))}
              </div>
            )}

            {POST_CATEGORIES.map(cat => (
              <div key={cat.name}>
                <div style={{
                  fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '1.2px',
                  marginBottom: '3px', paddingLeft: '2px',
                }}>
                  {cat.name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {cat.effects.map(fx => {
                    const isActive = activePosts.has(fx.id)
                    return (
                      <div
                        key={fx.id}
                        onClick={() => togglePost(fx.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '5px 6px', borderRadius: '4px', cursor: 'pointer',
                          background: isActive ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                          border: isActive ? '1px solid rgba(0,255,136,0.2)' : '1px solid var(--border)',
                          transition: 'all 0.1s',
                        }}
                      >
                        <span style={{
                          fontSize: '13px', lineHeight: 1, flexShrink: 0,
                          opacity: isActive ? 1 : 0.4,
                        }}>
                          {fx.icon}
                        </span>
                        <div className={`toggle${isActive ? ' active' : ''}`} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '10px', fontWeight: isActive ? 600 : 400,
                            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          }}>
                            {fx.label}
                          </div>
                          <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '1px' }}>
                            {fx.desc}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ====== COLORS TAB ====== */}
        {section === 'color' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Palette grid */}
            <div>
              <div style={catLabel}>Palette</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
                {COLOR_PRESETS.map((preset, i) => {
                  const isActive = activeColorPreset === i
                  return (
                    <button
                      key={preset.label}
                      onClick={() => selectColorPreset(i)}
                      title={preset.label}
                      style={{
                        padding: '4px 2px 3px',
                        borderRadius: '4px',
                        border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: isActive ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                        cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                        transition: 'all 0.1s',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '1px' }}>
                        {preset.colors.map((c, j) => (
                          <div key={j} style={{
                            width: '12px', height: '12px', borderRadius: '2px',
                            background: c,
                          }} />
                        ))}
                      </div>
                      <span style={{
                        fontSize: '8px',
                        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                        fontWeight: isActive ? 600 : 400,
                      }}>
                        {preset.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom palette */}
            <div>
              <button
                onClick={() => selectColorPreset(CUSTOM_INDEX)}
                style={{
                  width: '100%', padding: '5px 8px',
                  borderRadius: '4px',
                  border: activeColorPreset === CUSTOM_INDEX ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: activeColorPreset === CUSTOM_INDEX ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                  color: activeColorPreset === CUSTOM_INDEX ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: '10px',
                  fontWeight: activeColorPreset === CUSTOM_INDEX ? 600 : 400,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                <div style={{ display: 'flex', gap: '2px' }}>
                  {customColors.map((c, j) => (
                    <div key={j} style={{ width: '12px', height: '12px', borderRadius: '2px', background: c }} />
                  ))}
                </div>
                Custom
              </button>
              {activeColorPreset === CUSTOM_INDEX && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  {(['C1', 'C2', 'C3'] as const).map((label, i) => (
                    <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <input
                        type="color"
                        value={customColors[i]}
                        onChange={e => updateCustomColor(i as 0 | 1 | 2, e.target.value)}
                      />
                      <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transition speed */}
            <div className="slider-row">
              <span className="label">Trans.</span>
              <input
                type="range" min={0} max={1} step={0.05}
                value={transitionSpeed}
                onChange={e => handleTransitionSpeed(parseFloat(e.target.value))}
              />
              <span className="value">
                {transitionSpeed <= 0 ? '0' : `${(transitionSpeed * 3).toFixed(1)}s`}
              </span>
            </div>

            {/* Palette Cycling */}
            <div>
              <div style={catLabel}>Cycling</div>
              <div
                onClick={toggleCycle}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '4px 6px', borderRadius: '4px', cursor: 'pointer',
                  background: cycleEnabled ? 'var(--accent-glow)' : 'transparent',
                  marginBottom: '4px',
                }}
              >
                <div className={`toggle${cycleEnabled ? ' active' : ''}`} />
                <span style={{
                  fontSize: '10px',
                  color: cycleEnabled ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}>
                  {cycleEnabled ? 'Active' : 'Enable'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                <button onClick={() => handleCycleBeatSync(false)} style={pillStyle(!cycleBeatSync)}>Timer</button>
                <button onClick={() => handleCycleBeatSync(true)} style={pillStyle(cycleBeatSync)}>Beat</button>
              </div>

              <div className="slider-row" style={{ marginBottom: '4px' }}>
                <span className="label">{cycleBeatSync ? 'Beats' : 'Intrvl'}</span>
                <input
                  type="range"
                  min={cycleBeatSync ? 1 : 2}
                  max={cycleBeatSync ? 64 : 30}
                  step={1}
                  value={cycleBeatSync ? cycleBeats : cycleInterval}
                  onChange={e => cycleBeatSync
                    ? handleCycleBeats(parseInt(e.target.value))
                    : handleCycleInterval(parseInt(e.target.value))
                  }
                />
                <span className="value">
                  {cycleBeatSync ? cycleBeats : `${cycleInterval}s`}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px' }}>
                {COLOR_PRESETS.map((preset, i) => (
                  <button
                    key={preset.label}
                    onClick={() => toggleCyclePreset(i)}
                    title={preset.label}
                    style={{
                      padding: '2px', borderRadius: '3px',
                      border: cycleSelection.has(i) ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: cycleSelection.has(i) ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                      cursor: 'pointer', opacity: cycleSelection.has(i) ? 1 : 0.4,
                      display: 'flex', justifyContent: 'center', gap: '1px',
                    }}
                  >
                    {preset.colors.map((c, j) => (
                      <div key={j} style={{ width: '8px', height: '8px', borderRadius: '1px', background: c }} />
                    ))}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '4px 6px', borderRadius: '3px',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontSize: '9px', fontWeight: active ? 600 : 400, cursor: 'pointer',
  }
}

const catLabel: React.CSSProperties = {
  fontSize: '8px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '1.2px',
  marginBottom: '3px',
}
