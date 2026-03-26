import React, { useState, useCallback } from 'react'
import type { Engine, EffectId, PostId } from '@engine/Engine'

interface EffectPanelProps {
  engine: Engine | null
}

const MAIN_EFFECTS: { id: EffectId; label: string }[] = [
  { id: 'tunnel', label: 'Tunnel' },
  { id: 'kaleidoscope', label: 'Kaleidoscope' },
  { id: 'warp', label: 'Domain Warp' },
  { id: 'plasma', label: 'Plasma' },
  { id: 'matrix', label: 'Matrix Rain' },
  { id: 'voronoi', label: 'Voronoi Cells' },
  { id: 'sacred', label: 'Sacred Geometry' },
  { id: 'fractal', label: 'Fractal' },
  { id: 'particles', label: 'Particles' },
  { id: 'starfield', label: 'Starfield' },
  { id: 'metaballs', label: 'Metaballs' },
  { id: 'mandala', label: 'Mandala' },
  { id: 'grid', label: 'Cyber Grid' },
  { id: 'waves', label: 'Waves' },
  { id: 'lissajous', label: 'Lissajous' },
  { id: 'fluid', label: 'Fluid' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'rings', label: 'Rings' },
  { id: 'fire', label: 'Fire' },
  { id: 'hexagons', label: 'Hexagons' },
  { id: 'dna', label: 'DNA Helix' },
]

const POST_EFFECTS: { id: PostId; label: string }[] = [
  { id: 'bloom', label: 'Bloom' },
  { id: 'rgb-split', label: 'RGB Split' },
  { id: 'chromatic', label: 'Chromatic Aberr.' },
  { id: 'feedback', label: 'Feedback Trail' },
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
]

const CUSTOM_INDEX = COLOR_PRESETS.length

export function EffectPanel({ engine }: EffectPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [activeEffect, setActiveEffect] = useState<EffectId>('tunnel')
  const [activePosts, setActivePosts] = useState<Set<PostId>>(new Set(['bloom']))
  const [activeColorPreset, setActiveColorPreset] = useState(0)
  const [customColors, setCustomColors] = useState<[string, string, string]>(['#ff0000', '#00ff00', '#0000ff'])
  const [transitionSpeed, setTransitionSpeed] = useState(0.5)

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
      // Build palette list from selected presets
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
      // Update engine if cycling is active
      if (engine && cycleEnabled) {
        const palettes = COLOR_PRESETS
          .filter((_, i) => next.has(i))
          .map(p => p.colors)
        if (palettes.length >= 2) {
          engine.setCyclePalettes(palettes)
        }
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

  return (
    <div className="panel">
      <div className="panel-header" onClick={() => setCollapsed(!collapsed)}>
        <span>Effects</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Main effects */}
          <div>
            <div style={catLabel}>Visual Effect</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              {MAIN_EFFECTS.map(fx => (
                <button
                  key={fx.id}
                  onClick={() => selectEffect(fx.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: activeEffect === fx.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: activeEffect === fx.id ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                    color: activeEffect === fx.id ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: activeEffect === fx.id ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'left',
                  }}
                >
                  {fx.label}
                </button>
              ))}
            </div>
          </div>

          {/* Post processing */}
          <div>
            <div style={catLabel}>Post-Processing</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {POST_EFFECTS.map(fx => (
                <div
                  key={fx.id}
                  onClick={() => togglePost(fx.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '5px 8px', borderRadius: '4px', cursor: 'pointer',
                    background: activePosts.has(fx.id) ? 'var(--accent-glow)' : 'transparent',
                  }}
                >
                  <Toggle active={activePosts.has(fx.id)} />
                  <span style={{
                    fontSize: '12px',
                    color: activePosts.has(fx.id) ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}>
                    {fx.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Color presets + custom */}
          <div>
            <div style={catLabel}>Color Palette</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
              {COLOR_PRESETS.map((preset, i) => (
                <button
                  key={preset.label}
                  onClick={() => selectColorPreset(i)}
                  title={preset.label}
                  style={{
                    padding: '4px',
                    borderRadius: '4px',
                    border: activeColorPreset === i ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: 'var(--bg-tertiary)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {preset.colors.map((c, j) => (
                      <div key={j} style={{
                        width: '14px', height: '14px', borderRadius: '3px',
                        background: c,
                        boxShadow: `0 0 4px ${c}40`,
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{preset.label}</span>
                </button>
              ))}
            </div>

            {/* Custom palette */}
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={() => selectColorPreset(CUSTOM_INDEX)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: activeColorPreset === CUSTOM_INDEX ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: activeColorPreset === CUSTOM_INDEX ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                  color: activeColorPreset === CUSTOM_INDEX ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: activeColorPreset === CUSTOM_INDEX ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', gap: '3px' }}>
                  {customColors.map((c, j) => (
                    <div key={j} style={{
                      width: '14px', height: '14px', borderRadius: '3px',
                      background: c,
                      boxShadow: `0 0 4px ${c}40`,
                    }} />
                  ))}
                </div>
                Custom
              </button>

              {activeColorPreset === CUSTOM_INDEX && (
                <div style={{
                  display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center',
                }}>
                  {(['Primary', 'Secondary', 'Tertiary'] as const).map((label, i) => (
                    <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                      <input
                        type="color"
                        value={customColors[i]}
                        onChange={e => updateCustomColor(i as 0 | 1 | 2, e.target.value)}
                        style={{
                          width: '100%', height: '28px', padding: '0',
                          border: '1px solid var(--border)', borderRadius: '4px',
                          background: 'var(--bg-tertiary)', cursor: 'pointer',
                        }}
                      />
                      <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transition speed */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '52px', flexShrink: 0 }}>
                  Transition
                </span>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={transitionSpeed}
                  onChange={e => handleTransitionSpeed(parseFloat(e.target.value))}
                  style={{ flex: 1, height: '14px' }}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', width: '38px', textAlign: 'right' }}>
                  {transitionSpeed <= 0 ? 'Snap' : `${(transitionSpeed * 3).toFixed(1)}s`}
                </span>
              </div>
            </div>
          </div>

          {/* Palette Cycling */}
          <div>
            <div style={catLabel}>
              <span>Palette Cycling</span>
            </div>

            {/* Enable toggle */}
            <div
              onClick={toggleCycle}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '5px 8px', borderRadius: '4px', cursor: 'pointer',
                background: cycleEnabled ? 'var(--accent-glow)' : 'transparent',
                marginBottom: '6px',
              }}
            >
              <Toggle active={cycleEnabled} />
              <span style={{
                fontSize: '12px',
                color: cycleEnabled ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}>
                {cycleEnabled ? 'Cycling active' : 'Enable cycling'}
              </span>
            </div>

            {/* Timing mode */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              <button
                onClick={() => handleCycleBeatSync(false)}
                style={pillStyle(!cycleBeatSync)}
              >
                Timer
              </button>
              <button
                onClick={() => handleCycleBeatSync(true)}
                style={pillStyle(cycleBeatSync)}
              >
                Beat Sync
              </button>
            </div>

            {/* Timer interval or beat count */}
            {!cycleBeatSync ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '52px', flexShrink: 0 }}>
                  Interval
                </span>
                <input
                  type="range" min={2} max={30} step={1}
                  value={cycleInterval}
                  onChange={e => handleCycleInterval(parseInt(e.target.value))}
                  style={{ flex: 1, height: '14px' }}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', width: '28px', textAlign: 'right' }}>
                  {cycleInterval}s
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '52px', flexShrink: 0 }}>
                  Beats
                </span>
                <input
                  type="range" min={1} max={64} step={1}
                  value={cycleBeats}
                  onChange={e => handleCycleBeats(parseInt(e.target.value))}
                  style={{ flex: 1, height: '14px' }}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', width: '28px', textAlign: 'right' }}>
                  {cycleBeats}
                </span>
              </div>
            )}

            {/* Palette selection for cycling */}
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Palettes in rotation ({cycleSelection.size} selected)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
              {COLOR_PRESETS.map((preset, i) => (
                <button
                  key={preset.label}
                  onClick={() => toggleCyclePreset(i)}
                  title={preset.label}
                  style={{
                    padding: '3px',
                    borderRadius: '4px',
                    border: cycleSelection.has(i) ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: cycleSelection.has(i) ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                    cursor: 'pointer',
                    opacity: cycleSelection.has(i) ? 1 : 0.5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '1px' }}>
                    {preset.colors.map((c, j) => (
                      <div key={j} style={{
                        width: '10px', height: '10px', borderRadius: '2px',
                        background: c,
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle({ active }: { active: boolean }) {
  return (
    <div style={{
      width: '28px', height: '14px', borderRadius: '7px',
      background: active ? 'var(--accent)' : 'var(--border)',
      position: 'relative', transition: 'background 0.2s',
    }}>
      <div style={{
        width: '10px', height: '10px', borderRadius: '50%',
        background: '#fff',
        position: 'absolute', top: '2px',
        left: active ? '16px' : '2px',
        transition: 'left 0.2s',
      }} />
    </div>
  )
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '5px 6px',
    borderRadius: '4px',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontSize: '11px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
  }
}

const catLabel: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  color: 'var(--accent)',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  marginBottom: '6px',
}
