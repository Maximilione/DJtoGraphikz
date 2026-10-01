import React, { useState, useCallback } from 'react'
import type { Engine, EffectId, BlendMode } from '@engine/Engine'
import { BLEND_MODES } from '@engine/Engine'
import { NumberInput } from '../NumberInput/NumberInput'
import { ALL_EFFECTS } from '../../catalog'

const MASK_FIRST = BLEND_MODES.indexOf('split-v')
const MASK_LABELS: Partial<Record<BlendMode, string>> = {
  'split-v': 'split verticale', 'split-h': 'split orizzontale', radial: 'radiale', luma: 'luma-key', audio: 'audio (basso/beat)',
}

interface DeckPanelProps {
  engine: Engine | null
}

export function DeckPanel({ engine }: DeckPanelProps) {
  const [deckB, setDeckB] = useState<EffectId>('plasma')
  const [crossfade, setCrossfade] = useState(0)
  const [blend, setBlend] = useState<BlendMode>('mix')
  const [maskSoft, setMaskSoft] = useState(0.25)
  const [motionBlur, setMotionBlur] = useState(0)

  // Sync from engine on mount (boot restore may not emit), then subscribe:
  // state changes come from ANY surface (phone remote, AutoVJ, hotkeys, presets)
  React.useEffect(() => {
    if (!engine) return
    setDeckB(engine.getDeckBEffect())
    setCrossfade(engine.getCrossfade())
    setBlend(engine.getBlendMode())
    setMaskSoft(engine.getMaskSoft())
    setMotionBlur(engine.getMotionBlur())
    return engine.onState(state => {
      if (state.deckBEffect) setDeckB(state.deckBEffect)
      if (state.crossfade !== undefined) setCrossfade(state.crossfade)
      if (state.blendMode) setBlend(state.blendMode)
      if (state.maskSoft !== undefined) setMaskSoft(state.maskSoft)
      if (state.motionBlur !== undefined) setMotionBlur(state.motionBlur)
    })
  }, [engine])

  const isMask = BLEND_MODES.indexOf(blend) >= MASK_FIRST

  const changeDeckB = useCallback((id: EffectId) => {
    setDeckB(id)
    engine?.setDeckBEffect(id)
  }, [engine])

  const changeCrossfade = useCallback((v: number) => {
    setCrossfade(v)
    engine?.setCrossfade(v)
  }, [engine])

  return (
    <div className="deck-bar">
      <span className="deck-label">A</span>
      <input
        type="range" min={0} max={1} step={0.01}
        value={crossfade}
        onChange={e => changeCrossfade(parseFloat(e.target.value))}
        style={{ flex: 1 }}
        title="Crossfader tra deck A e deck B"
      />
      <span className="deck-label">B</span>

      <select value={deckB} onChange={e => changeDeckB(e.target.value as EffectId)} title="Effetto sul deck B">
        {ALL_EFFECTS.map(fx => <option key={fx.id} value={fx.id}>{fx.label}</option>)}
      </select>

      <select
        value={blend}
        onChange={e => {
          setBlend(e.target.value as BlendMode)
          engine?.setBlendMode(e.target.value as BlendMode)
        }}
        title="Blend o maschera tra i due deck: con una maschera il crossfader è la posizione del bordo"
      >
        <optgroup label="Blend">
          {BLEND_MODES.slice(0, MASK_FIRST).map(m => <option key={m} value={m}>{m}</option>)}
        </optgroup>
        <optgroup label="Maschera">
          {BLEND_MODES.slice(MASK_FIRST).map(m => <option key={m} value={m}>{MASK_LABELS[m] ?? m}</option>)}
        </optgroup>
      </select>
      {isMask && <>
        <span className="deck-label" title="Morbidezza del bordo della maschera">SOFT</span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={maskSoft}
          title="Morbidezza del bordo (0 netto, 1 sfumato)"
          onChange={e => { const v = parseFloat(e.target.value); setMaskSoft(v); engine?.setMaskSoft(v) }}
          style={{ width: '70px' }}
        />
      </>}

      <span className="deck-label" title="Motion blur temporale">BLUR</span>
      <input
        type="range" min={0} max={0.95} step={0.05}
        value={motionBlur}
        title="Intensità del motion blur"
        onChange={e => {
          const v = parseFloat(e.target.value)
          setMotionBlur(v)
          engine?.setMotionBlur(v)
        }}
        style={{ width: '70px' }}
      />
      <NumberInput
        value={motionBlur}
        min={0} max={0.95} step={0.05}
        onChange={v => { setMotionBlur(v); engine?.setMotionBlur(v) }}
      />
    </div>
  )
}
