import React, { useEffect, useReducer, useRef, useState } from 'react'
import type { Engine } from '@engine/Engine'
import { AUDIO_SOURCES, type AudioSource } from '@engine/EffectParams'
import { SliderRow } from '../SliderRow/SliderRow'
import { autoMappingEnabled, setAutoMappingEnabled, magicMap } from '../../autoMapping'
import { pushToast } from '../Toasts/Toasts'

interface ParamControlsProps {
  engine: Engine | null
}

// Short labels + a color class per source: the chip reads at a glance
const SOURCE_META: Record<AudioSource, { label: string; cls: string }> = {
  'none': { label: '—', cls: 'none' },
  'bass': { label: 'BASSI', cls: 'bass' },
  'mid': { label: 'MEDI', cls: 'mid' },
  'high': { label: 'ALTI', cls: 'high' },
  'energy': { label: 'VOLUME', cls: 'energy' },
  'beat': { label: 'BATTITO', cls: 'beat' },
  'lfo-sine': { label: '∿ MORBIDA', cls: 'lfo' },
  'lfo-saw': { label: '⋀ RAMPA', cls: 'lfo' },
  'lfo-square': { label: '⊓ SCATTO', cls: 'lfo' },
}

const LFO_RATES = [0.25, 0.5, 1, 2, 4, 8, 16, 32]

/**
 * Sliders for the active effect's params, each mappable to an audio band.
 * The mapping lives behind a colored chip: tap it to open a big-target editor.
 */
export function ParamControls({ engine }: ParamControlsProps) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [autoOnPick, setAutoOnPick] = useState(autoMappingEnabled)
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
        <div className="cat-label" style={{ margin: 0 }}>Parametri</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <label className="micro" style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            title="Quando scegli un effetto a mano (griglia, tasti 1-0, telefono) arriva gia' col suo mapping consigliato. Non tocca i parametri che hai gia' mappato tu, ne' le scene dell'Auto VJ, le scalette e i look">
            <input type="checkbox" checked={autoOnPick}
              onChange={e => { setAutoMappingEnabled(e.target.checked); setAutoOnPick(e.target.checked) }} />
            al cambio
          </label>
          <button
            className="btn btn-sm"
            title="Mappa tutti i parametri all'audio: preset dedicato dove esiste, euristica per gli altri — Annulla dal toast"
            onClick={() => {
              const r = magicMap(engine)
              force()
              const detail = r.curated ? `, ${r.curated} con preset dedicato` : ''
              pushToast(`Magic Mapping: ${r.count} parametri${detail}`, 'magicmap', { label: 'Annulla', fn: () => { r.undo(); force() } })
            }}
          >
            ✨ Magic Mapping
          </button>
        </div>
      </div>
      {engine.getCurrentEffect() === 'mesh' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button className="btn btn-sm"
            title="GLB, GLTF, OBJ, STL, PLY, FBX — il modello viene copiato nella libreria e va anche sull'uscita"
            onClick={async () => {
              const f = (await window.api?.pickModels())?.[0]
              if (!f) return
              try {
                const saved = await window.api.librarySaveCopy(f.name, f.path)
                engine.setMeshModelFile({ name: saved.name, path: saved.path })
                force()
              } catch (err) {
                console.error('[Mesh] import fallito:', err)
                pushToast(`Non riesco a caricare ${f.name}`, undefined, undefined, 'err')
              }
            }}>
            Carica modello 3D…
          </button>
          <span className="micro">{engine.getMeshModel()?.name ?? 'modello di default'}</span>
          {engine.getMeshModel() && (
            <button className="btn btn-sm"
              onClick={() => { engine.setMeshModelFile(null); force() }}>Default</button>
          )}
        </div>
      )}
      {engine.getCurrentEffect() === 'imgbeat' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button className="btn" style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px' }}
            title="PNG, JPG, WebP, SVG, GIF (primo fotogramma) — fino a 8, copiate nella libreria e anche sull'uscita"
            onClick={async () => {
              const picked = (await window.api?.pickImages()) ?? []
              if (!picked.length) return
              try {
                const saved = await Promise.all(picked.map(f => window.api.librarySaveCopy(f.name, f.path)))
                engine.setImgbeatImages([...engine.getImgbeatImages(), ...saved.map(s => ({ name: s.name, path: s.path }))].slice(0, 8))
                force()
              } catch (err) {
                console.error('[Imgbeat] import fallito:', err)
                pushToast('Non riesco a caricare le immagini', undefined, undefined, 'err')
              }
            }}>
            Carica immagini…
          </button>
          <span className="micro">
            {engine.getImgbeatImages().length ? engine.getImgbeatImages().map(i => i.name).join(', ') : 'immagine di default'}
          </span>
          {engine.getImgbeatImages().length > 0 && (
            <button className="btn" style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px' }}
              onClick={() => { engine.setImgbeatImages([]); force() }}>Default</button>
          )}
        </div>
      )}
      {defs.map(def => {
        const st = engine.getParamState(def.key)
        const step = (def.max - def.min) / 100
        const meta = SOURCE_META[st.source] ?? SOURCE_META.none
        const open = openKey === def.key
        const mapped = st.source !== 'none'
        return (
          <div key={def.key} className="pm-row">
            <SliderRow
              label={def.label} labelTitle={`${def.label} · ${def.key}`}
              value={st.value} min={def.min} max={def.max} step={step}
              onChange={v => { engine.setParamValue(def.key, v); force() }}
            >
              <button
                className={`btn pm-chip ${meta.cls}${open ? ' open' : ''}`}
                onClick={() => setOpenKey(open ? null : def.key)}
                title={mapped ? `Modulato da ${st.source} (${Math.round(st.depth * 100)}%) — tocca per modificare` : 'Non mappato — tocca per mappare all\'audio'}
              >
                {meta.label}{mapped ? ` ${st.depth > 0 ? '+' : ''}${Math.round(st.depth * 100)}` : ''}
              </button>
            </SliderRow>
            {open && (
              <div className="pm-pop">
                <div className="pm-srcgrid">
                  {AUDIO_SOURCES.map(src => {
                    const m = SOURCE_META[src]
                    return (
                      <button
                        key={src}
                        className={`btn pm-src ${m.cls}${st.source === src ? ' on' : ''}`}
                        onClick={() => { engine.setParamMapping(def.key, src, st.depth || 0.5, st.lfoRate); force() }}
                      >
                        {m.label}
                      </button>
                    )
                  })}
                </div>
                {mapped && (
                  <>
                    <SliderRow
                      label="Profondità" percent
                      labelTitle="Quanto la sorgente muove il parametro (negativa = inverte)"
                      value={st.depth} min={-1} max={1} step={0.05}
                      onChange={v => { engine.setParamMapping(def.key, st.source, v); force() }}
                    />
                    {st.source.startsWith('lfo-') && (
                      <div className="pm-depth col">
                        <span className="micro" title="Quante battute dura un giro completo">
                          Giro ogni · battute
                        </span>
                        <div className="pm-rates">
                          {LFO_RATES.map(r => (
                            <button
                              key={r}
                              className={`btn pm-rate${(st.lfoRate || 4) === r ? ' on' : ''}`}
                              title={r < 1 ? `Un giro ogni ${1 / r}° di battuta` : `Un giro ogni ${r} battute`}
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
