import React, { useState, useCallback } from 'react'
import type { Engine, EffectId, BlendMode } from '@engine/Engine'
import { BLEND_MODES } from '@engine/Engine'
import { NumberInput } from '../NumberInput/NumberInput'

interface DeckPanelProps {
  engine: Engine | null
}

const EFFECTS: EffectId[] = [
  'tunnel', 'kaleidoscope', 'warp', 'plasma', 'matrix', 'voronoi', 'sacred',
  'fractal', 'particles', 'starfield', 'metaballs', 'mandala', 'grid', 'waves',
  'lissajous', 'fluid', 'glitch', 'rings', 'fire', 'hexagons', 'dna',
]

export function DeckPanel({ engine }: DeckPanelProps) {
  const [deckB, setDeckB] = useState<EffectId>('plasma')
  const [crossfade, setCrossfade] = useState(0)
  const [blend, setBlend] = useState<BlendMode>('mix')
  const [motionBlur, setMotionBlur] = useState(0)

  // Sync from engine — settings may have been restored before mount
  React.useEffect(() => {
    if (!engine) return
    setDeckB(engine.getDeckBEffect())
    setCrossfade(engine.getCrossfade())
    setBlend(engine.getBlendMode())
    setMotionBlur(engine.getMotionBlur())
  }, [engine])

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
        title="Crossfader between deck A and deck B"
      />
      <span className="deck-label">B</span>

      <select value={deckB} onChange={e => changeDeckB(e.target.value as EffectId)} title="Deck B effect">
        {EFFECTS.map(id => <option key={id} value={id}>{id}</option>)}
      </select>

      <select
        value={blend}
        onChange={e => {
          setBlend(e.target.value as BlendMode)
          engine?.setBlendMode(e.target.value as BlendMode)
        }}
        title="Blend mode"
      >
        {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
      </select>

      <span className="deck-label" title="Temporal motion blur">BLUR</span>
      <input
        type="range" min={0} max={0.95} step={0.05}
        value={motionBlur}
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
