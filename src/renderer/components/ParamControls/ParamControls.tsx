import React, { useEffect, useReducer, useRef } from 'react'
import type { Engine } from '@engine/Engine'
import { AUDIO_SOURCES, type AudioSource } from '@engine/EffectParams'
import { NumberInput } from '../NumberInput/NumberInput'

interface ParamControlsProps {
  engine: Engine | null
}

/**
 * Sliders for the active effect's params, each mappable to an audio band.
 * Reads straight from the engine — parents just need to re-render on effect change.
 */
export function ParamControls({ engine }: ParamControlsProps) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  // While a pointer is down on this panel a slider may be mid-drag — skip
  // re-renders from engine emits so the drag isn't clobbered, catch up on release
  const draggingRef = useRef(false)

  useEffect(() => {
    if (!engine) return
    return engine.onState(() => { if (!draggingRef.current) force() })
  }, [engine])

  if (!engine) return null

  const defs = engine.getParamDefs()
  if (defs.length === 0) return null

  const onPointerDown = () => {
    draggingRef.current = true
    window.addEventListener('pointerup', () => { draggingRef.current = false; force() }, { once: true })
  }

  return (
    <div onPointerDown={onPointerDown} className="sub-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div className="cat-label">Parametri</div>
      {defs.map(def => {
        const st = engine.getParamState(def.key)
        const step = (def.max - def.min) / 100
        return (
          <div key={def.key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div className="slider-row">
              <span className="label" title={def.key}>{def.label}</span>
              <input
                type="range" min={def.min} max={def.max} step={step}
                value={st.value}
                onChange={e => { engine.setParamValue(def.key, parseFloat(e.target.value)); force() }}
              />
              <NumberInput
                value={st.value}
                min={def.min} max={def.max} step={step}
                onChange={v => { engine.setParamValue(def.key, v); force() }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '54px' }}>
              <select
                value={st.source}
                onChange={e => { engine.setParamMapping(def.key, e.target.value as AudioSource, st.depth); force() }}
                title="Sorgente audio che modula questo parametro"
                style={{ fontSize: 'var(--fs-xs)', padding: '1px 3px' }}
              >
                {AUDIO_SOURCES.map(s => <option key={s} value={s}>{s === 'none' ? '— audio' : s}</option>)}
              </select>
              {st.source !== 'none' && (
                <>
                  <input
                    type="range" min={-1} max={1} step={0.05}
                    value={st.depth}
                    onChange={e => { engine.setParamMapping(def.key, st.source, parseFloat(e.target.value)); force() }}
                    style={{ flex: 1 }}
                    title="Profondità di modulazione (negativa = inverte)"
                  />
                  <span className="u-value" style={{ width: '40px', flexShrink: 0 }}>
                    {st.depth > 0 ? '+' : ''}{Math.round(st.depth * 100)}%
                  </span>
                </>
              )}
              {st.source.startsWith('lfo-') && (
                <select
                  value={st.lfoRate || 4}
                  onChange={e => { engine.setParamMapping(def.key, st.source, st.depth, parseFloat(e.target.value)); force() }}
                  title="Velocità LFO in battute per ciclo"
                  style={{ fontSize: 'var(--fs-xs)', padding: '1px 3px' }}
                >
                  {[0.25, 0.5, 1, 2, 4, 8, 16, 32].map(r => (
                    <option key={r} value={r}>{r < 1 ? `1/${1 / r}` : r} beat</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
