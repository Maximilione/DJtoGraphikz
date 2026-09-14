import React, { useState, useCallback } from 'react'
import type { Engine, EffectId } from '@engine/Engine'
import type { Genre } from '@engine/AutoVJ'
import { COLOR_PRESETS } from '../../catalog'
import { EffectGrid } from '../EffectGrid/EffectGrid'
import { AutoVJControl } from '../AutoVJ/AutoVJControl'
import { PaletteGrid } from '../PaletteGrid/PaletteGrid'
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
      <AutoVJControl
        size="lg"
        enabled={vjEnabled} genre={vjGenre} status={vjStatus}
        onToggle={onVJToggle} onGenre={onVJGenre}
      />

      {/* Effects — big grid, no tabs, no search */}
      <div className="simple-section">EFFETTI</div>
      <EffectGrid activeId={vjEnabled ? null : activeEffect} onPick={selectEffect} size="lg" />

      {/* Palettes — swatch row */}
      <div className="simple-section">COLORI</div>
      <PaletteGrid size="lg" isActive={i => activePalette === i} onPick={selectPalette} />
    </div>
  )
}
