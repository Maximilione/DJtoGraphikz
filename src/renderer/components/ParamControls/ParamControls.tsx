import React, { useEffect, useReducer, useRef, useState } from 'react'
import type { Engine } from '@engine/Engine'
import { AUDIO_SOURCES, type AudioSource } from '@engine/EffectParams'
import { NumberInput } from '../NumberInput/NumberInput'
import { smartMap } from '../../smartMap'
import { pushToast } from '../Toasts/Toasts'

interface ParamControlsProps {
  engine: Engine | null
}

// Short labels + a color class per source: the chip reads at a glance
const SOURCE_META: Record<AudioSource, { label: string; cls: string }> = {
  'none': { label: '—', cls: 'none' },
  'bass': { label: 'BASS', cls: 'bass' },
  'mid': { label: 'MID', cls: 'mid' },
  'high': { label: 'HIGH', cls: 'high' },
  'energy': { label: 'ENERGY', cls: 'energy' },
  'beat': { label: 'BEAT', cls: 'beat' },
  'lfo-sine': { label: '∿ SINE', cls: 'lfo' },
  'lfo-saw': { label: '⋀ SAW', cls: 'lfo' },
  'lfo-square': { label: '⊓ SQR', cls: 'lfo' },
}

const LFO_RATES = [0.25, 0.5, 1, 2, 4, 8, 16, 32]

/**
 * Sliders for the active effect's params, each mappable to an audio band.
 * The mapping lives behind a colored chip: tap it to open a big-target editor.
 */
export function ParamControls({ engine }: ParamControlsProps) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  const [openKey, setOpenKey] = useState<string | null>(null)
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="cat-label" style={{ margin: 0 }}>Parametri</div>
        <button
          className="btn"
          style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px' }}
          title="Mappa automaticamente i parametri all'audio in base a nome e uso nello shader — Annulla dal toast"
          onClick={() => {
            const r = smartMap(engine)
            force()
            pushToast(`Smart map: ${r.count} parametri mappati`, 'smartmap', { label: 'Annulla', fn: () => { r.undo(); force() } })
          }}
        >
          ⚡ Smart map
        </button>
      </div>
      {defs.map(def => {
        const st = engine.getParamState(def.key)
        const step = (def.max - def.min) / 100
        const meta = SOURCE_META[st.source] ?? SOURCE_META.none
        const open = openKey === def.key
        const mapped = st.source !== 'none'
        return (
          <div key={def.key} className="pm-row">
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
              <button
                className={`pm-chip ${meta.cls}${open ? ' open' : ''}`}
                onClick={() => setOpenKey(open ? null : def.key)}
                title={mapped ? `Modulato da ${st.source} (${Math.round(st.depth * 100)}%) — tocca per modificare` : 'Non mappato — tocca per mappare all\'audio'}
              >
                {meta.label}{mapped ? ` ${st.depth > 0 ? '+' : ''}${Math.round(st.depth * 100)}` : ''}
              </button>
            </div>
            {open && (
              <div className="pm-pop">
                <div className="pm-srcgrid">
                  {AUDIO_SOURCES.map(src => {
                    const m = SOURCE_META[src]
                    return (
                      <button
                        key={src}
                        className={`pm-src ${m.cls}${st.source === src ? ' on' : ''}`}
                        onClick={() => { engine.setParamMapping(def.key, src, st.depth || 0.5, st.lfoRate); force() }}
                      >
                        {m.label}
                      </button>
                    )
                  })}
                </div>
                {mapped && (
                  <>
                    <div className="pm-depth">
                      <span className="micro">Profondità</span>
                      <input
                        type="range" min={-1} max={1} step={0.05}
                        value={st.depth}
                        onChange={e => { engine.setParamMapping(def.key, st.source, parseFloat(e.target.value)); force() }}
                        title="Quanto la sorgente muove il parametro (negativa = inverte)"
                      />
                      <span className="u-value" style={{ width: 44, flexShrink: 0 }}>
                        {st.depth > 0 ? '+' : ''}{Math.round(st.depth * 100)}%
                      </span>
                    </div>
                    {st.source.startsWith('lfo-') && (
                      <div className="pm-depth">
                        <span className="micro">Velocità</span>
                        <div className="pm-rates">
                          {LFO_RATES.map(r => (
                            <button
                              key={r}
                              className={`pm-rate${(st.lfoRate || 4) === r ? ' on' : ''}`}
                              onClick={() => { engine.setParamMapping(def.key, st.source, st.depth, r); force() }}
                            >
                              {r < 1 ? `1/${1 / r}` : r}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
