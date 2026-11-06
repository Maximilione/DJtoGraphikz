import React, { useState, useCallback } from 'react'
import type { Engine, EffectId } from '@engine/Engine'
import { allPalettes } from '../../palettes'
import { EffectGrid } from '../EffectGrid/EffectGrid'
import { PaletteGrid } from '../PaletteGrid/PaletteGrid'
import { useFxThumbs } from '../../fxThumbs'
import { pickEffect } from '../../autoMapping'

export type SimpleTab = 'look' | 'fx' | 'color'

interface SimpleDeckProps {
  engine: Engine | null
  vjEnabled: boolean
  onVJToggle: (on: boolean) => void
  tab: SimpleTab
  onTab: (t: SimpleTab) => void
}

/**
 * Simple mode, under the preview: Look / Effetti / Colori as wide tabs. The
 * grids used to sit at the bottom of a 360px column, under the audio setup
 * and the Auto VJ, where a scroll hid them. The Look Bank itself stays where
 * App mounts it (it keeps the Shift+1-0 listener); this draws the tab bar and
 * the two other bodies.
 */
export function SimpleDeck({ engine, vjEnabled, onVJToggle, tab, onTab }: SimpleDeckProps) {
  const [activeEffect, setActiveEffect] = useState<EffectId>('tunnel')
  const [activePalette, setActivePalette] = useState(0)

  // Sync from engine on mount (boot restore may not emit), then subscribe:
  // state changes come from ANY surface (phone remote, AutoVJ, hotkeys, presets)
  React.useEffect(() => {
    if (!engine) return
    const sync = (effect: EffectId, colors: [string, string, string]) => {
      setActiveEffect(effect)
      // -1 lights nothing: the Auto VJ's own palettes are not in the grid, and
      // the previous tile stayed lit on colours that were not on the wall
      setActivePalette(allPalettes().findIndex(p => p.colors.every((c, i) => c.toLowerCase() === colors[i])))
    }
    sync(engine.getCurrentEffect(), engine.getCurrentColors())
    return engine.onState(state => sync(state.activeEffect, state.colors))
  }, [engine])

  // Thumbnails: capture from the live engine ~1.5s after each effect change
  useFxThumbs(engine, activeEffect)

  const selectEffect = useCallback((id: EffectId) => {
    if (!engine) return
    pickEffect(engine, id)
    setActiveEffect(id)
    onVJToggle(false) // manual pick takes over from Auto VJ
  }, [engine, onVJToggle])

  const selectPalette = useCallback((i: number) => {
    if (!engine) return
    engine.setColors(...allPalettes()[i].colors)
    setActivePalette(i)
  }, [engine])

  const tabs: [SimpleTab, string, string][] = [
    ['look', 'Look', 'I look salvati: un clic li richiama'],
    ['fx', 'Effetti', 'Scegli un effetto a mano (spegne l\'Auto VJ)'],
    ['color', 'Colori', 'Scegli i colori a mano'],
  ]
  return (
    <>
      <div className="tab-bar simple-tabs">
        {tabs.map(([id, label, hint]) => (
          <button key={id} className={`tab${tab === id ? ' active' : ''}`} onClick={() => onTab(id)} title={hint}>
            {label}
          </button>
        ))}
        <span className="u-hint simple-tabs-hint">
          {tab === 'look' ? 'Un look e\' un\'istantanea: clic per richiamarla, clic su un pad vuoto per salvarne una'
            : tab === 'fx' ? 'Un clic cambia l\'effetto sul muro e prende il comando dall\'Auto VJ'
            : 'I colori di tutti gli effetti'}
        </span>
      </div>
      {tab === 'fx' && (
        <div className="simple-deck-body">
          <EffectGrid activeId={vjEnabled ? null : activeEffect} onPick={selectEffect} size="lg" />
        </div>
      )}
      {tab === 'color' && (
        <div className="simple-deck-body">
          <PaletteGrid size="lg" isActive={i => activePalette === i} onPick={selectPalette} />
        </div>
      )}
    </>
  )
}
