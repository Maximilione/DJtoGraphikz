import React, { useState, useCallback } from 'react'
import type { Engine, EffectId } from '@engine/Engine'
import { GENRE_CONFIGS, type Genre } from '@engine/AutoVJ'
import { EFFECT_CATEGORIES, COLOR_PRESETS } from '../EffectPanel/EffectPanel'
import { getThumb, useFxThumbs, thumbBackground } from '../../fxThumbs'

interface SimplePanelProps {
  engine: Engine | null
  vjEnabled: boolean
  vjGenre: Genre
  vjStatus: { current: string; count: number }
  onVJToggle: (on: boolean) => void
  onVJGenre: (g: Genre) => void
}

/** Simple mode: the few controls a first-time VJ actually needs, big enough to hit in the dark. */
export function SimplePanel({ engine, vjEnabled, vjGenre, vjStatus, onVJToggle, onVJGenre }: SimplePanelProps) {
  const [activeEffect, setActiveEffect] = useState<EffectId>('tunnel')
  const [activePalette, setActivePalette] = useState(0)

  // Sync from engine on mount (boot restore may not emit), then subscribe:
  // state changes come from ANY surface (phone remote, AutoVJ, hotkeys, presets)
  React.useEffect(() => {
    if (!engine) return
    const sync = (effect: EffectId, colors: [string, string, string]) => {
      setActiveEffect(effect)
      const idx = COLOR_PRESETS.findIndex(p => p.colors.every((c, i) => c === colors[i]))
      if (idx >= 0) setActivePalette(idx)
    }
    sync(engine.getCurrentEffect(), engine.getCurrentColors())
    return engine.onState(state => sync(state.activeEffect, state.colors))
  }, [engine])

  // Thumbnails: capture from the live engine ~1.5s after each effect change
  useFxThumbs(engine, activeEffect)

  const selectEffect = useCallback((id: EffectId) => {
    if (!engine) return
    engine.setEffect(id)
    setActiveEffect(id)
    onVJToggle(false) // manual pick takes over from Auto VJ
  }, [engine, onVJToggle])

  const selectPalette = useCallback((i: number) => {
    if (!engine) return
    engine.setColors(...COLOR_PRESETS[i].colors)
    setActivePalette(i)
  }, [engine])

  return (
    <div className="panel simple-panel">
      {/* Auto VJ — the one-button mode */}
      <div
        className={`simple-autovj${vjEnabled ? ' active' : ''}`}
        onClick={() => onVJToggle(!vjEnabled)}
        title="Cambia effetti, post-FX e colori da solo, a tempo di musica"
      >
        <div className={`toggle${vjEnabled ? ' active' : ''}`} />
        <div style={{ flex: 1 }}>
          <div className="simple-autovj-title">
            {vjEnabled ? 'AUTO VJ ATTIVO' : 'AUTO VJ'}
          </div>
          <div className="simple-autovj-sub">
            {vjEnabled
              ? `${vjStatus.count} cambi · ora: ${vjStatus.current || '—'}`
              : 'Fa tutto da solo, a tempo di musica'}
          </div>
        </div>
      </div>
      <select
        className="simple-genre"
        value={vjGenre}
        onChange={e => onVJGenre(e.target.value as Genre)}
        title="Genere musicale — imposta effetti, colori e velocità"
      >
        {(Object.entries(GENRE_CONFIGS) as [Genre, typeof GENRE_CONFIGS[Genre]][]).map(([id, cfg]) => (
          <option key={id} value={id}>{cfg.label}</option>
        ))}
      </select>

      {/* Effects — big grid, no tabs, no search */}
      <div className="simple-section">EFFETTI</div>
      {EFFECT_CATEGORIES.map(cat => (
        <div key={cat.name}>
          <div className="simple-cat">{cat.name}</div>
          <div className="simple-grid">
            {cat.effects.map(fx => {
              const isActive = activeEffect === fx.id && !vjEnabled
              const thumb = getThumb(fx.id)
              return (
                <button
                  key={fx.id}
                  className={`simple-fx${isActive ? ' active' : ''}${thumb ? ' fx-thumb' : ''}`}
                  onClick={() => selectEffect(fx.id)}
                  style={thumb ? { background: thumbBackground(thumb, isActive) } : undefined}
                >
                  <span className="fx-icon">{fx.icon}</span>
                  {fx.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Palettes — swatch row */}
      <div className="simple-section">COLORI</div>
      <div className="simple-palettes">
        {COLOR_PRESETS.map((p, i) => (
          <button
            key={p.label}
            className={`simple-palette${activePalette === i ? ' active' : ''}`}
            onClick={() => selectPalette(i)}
            title={p.label}
          >
            {p.colors.map((c, j) => <span key={j} style={{ background: c }} />)}
          </button>
        ))}
      </div>
    </div>
  )
}
