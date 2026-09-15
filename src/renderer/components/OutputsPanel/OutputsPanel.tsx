import React, { useState } from 'react'
import { Panel } from '../Panel/Panel'
import { pushToast } from '../Toasts/Toasts'
import { readJson, writeJson } from '../../storage'
import {
  DEFAULT_OUTPUT, OUTPUTS_KEY, PIXEL_BUDGET, sanitizeOutputs, totalPixels, type OutputCfg,
} from '../../outputs'

function loadOutputs(): OutputCfg[] {
  return sanitizeOutputs(readJson<unknown>(OUTPUTS_KEY, null))
}

/** Saves and tells main in one move — the two must never disagree. */
function saveOutputs(list: OutputCfg[]): OutputCfg[] {
  const clean = sanitizeOutputs(list)
  writeJson(OUTPUTS_KEY, clean)
  try { window.api?.setOutputs?.(clean) } catch { /* no api under a test page */ }
  return clean
}

interface OutputsPanelProps {
  displays: { id: number; label: string; primary: boolean }[]
  /** so the toolbar and this panel never show two different truths */
  outputs: OutputCfg[]
  onChange: (list: OutputCfg[]) => void
}

const PRESETS: [string, number, number][] = [
  ['720p', 1280, 720], ['1080p', 1920, 1080], ['1440p', 2560, 1440], ['4K', 3840, 2160],
]

/** Common LED-wall crops, expressed as a slice of the composition. */
const CROPS: [string, [number, number, number, number]][] = [
  ['Tutto', [0, 0, 1, 1]],
  ['Metà sx', [0, 0, 0.5, 1]],
  ['Metà dx', [0.5, 0, 0.5, 1]],
  ['Striscia alta', [0, 0.66, 1, 0.34]],
  ['Striscia bassa', [0, 0, 1, 0.34]],
]

const sameCrop = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 0.005)

/** Multi-output: one window per wall, each with its own crop, screen and trim. */
export function OutputsPanel({ displays, outputs, onChange }: OutputsPanelProps) {
  const [open, setOpen] = useState(0)

  const set = (i: number, patch: Partial<OutputCfg>) =>
    onChange(outputs.map((o, k) => (k === i ? { ...o, ...patch } : o)))

  const add = () => {
    if (outputs.length >= 8) return
    onChange([...outputs, { ...DEFAULT_OUTPUT }])
    setOpen(outputs.length)
  }

  const remove = (i: number) => {
    // Output 1 is the projector every other feature means — it cannot go.
    if (i === 0) return
    onChange(outputs.filter((_, k) => k !== i))
    setOpen(0)
  }

  const heavy = totalPixels(outputs) > PIXEL_BUDGET

  return (
    <Panel id="outputs" title="Uscite" defaultCollapsed group="right" active={outputs.length > 1}>
      <div className="u-col" style={{ gap: 8 }}>
        <div className="u-hint">
          Una finestra per muro. Un muro LED col suo processore è un display come gli altri:
          scegli lo schermo, la risoluzione vera del pannello e che pezzo della scena mostra.
        </div>
        {heavy && (
          <div className="u-hint" style={{ color: 'var(--warn, #e0a030)' }}>
            Attenzione: ogni uscita è un render completo. Con questi pixel totali una GPU da
            portatile non regge 60 fps — abbassa la risoluzione di un'uscita.
          </div>
        )}

        <div className="u-row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {outputs.map((o, i) => (
            <button key={i} className={`btn btn-sm ${i === open ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setOpen(i)}
              title={`Uscita ${i + 1} — ${o.width}×${o.height}`}>
              {i === 0 ? 'Proiettore' : `Uscita ${i + 1}`}
            </button>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={add} disabled={outputs.length >= 8}
            title="Aggiungi un'uscita">+</button>
        </div>

        {outputs[open] && (() => {
          const o = outputs[open]
          return (
            <div className="u-col" style={{ gap: 8 }}>
              <div className="slider-row">
                <span className="label">Schermo</span>
                <select value={o.displayId ?? ''} style={{ flex: 1 }}
                  onChange={e => {
                    const id = parseInt(e.target.value)
                    set(open, { displayId: isNaN(id) ? null : id })
                  }}>
                  <option value="">Automatico</option>
                  {displays.map(d => (
                    <option key={d.id} value={d.id}>{d.label}{d.primary ? ' (primario)' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="slider-row">
                <span className="label">Risoluzione</span>
                <input type="number" min={320} max={7680} step={2} value={o.width}
                  onChange={e => set(open, { width: +e.target.value | 0 })} style={{ width: 72 }} />
                <span className="label">×</span>
                <input type="number" min={240} max={4320} step={2} value={o.height}
                  onChange={e => set(open, { height: +e.target.value | 0 })} style={{ width: 72 }} />
              </div>
              <div className="u-row" style={{ gap: 4, flexWrap: 'wrap' }}>
                {PRESETS.map(([label, w, h]) => (
                  <button key={label} className="btn btn-secondary btn-sm"
                    onClick={() => set(open, { width: w, height: h })}
                    title={`${w}×${h}`}>{label}</button>
                ))}
              </div>

              <div className="slider-row">
                <span className="label">Mostra</span>
                <select style={{ flex: 1 }}
                  value={CROPS.findIndex(([, c]) => sameCrop(c, o.src))}
                  onChange={e => {
                    const c = CROPS[+e.target.value]
                    if (c) set(open, { src: [...c[1]] as OutputCfg['src'] })
                  }}>
                  {CROPS.map(([label], i) => <option key={label} value={i}>{label}</option>)}
                  {!CROPS.some(([, c]) => sameCrop(c, o.src)) && <option value={-1}>Personalizzato</option>}
                </select>
              </div>

              <div className="slider-row">
                <span className="label">Gamma</span>
                <input type="range" min={0.4} max={2.4} step={0.05} value={o.gamma}
                  onChange={e => set(open, { gamma: +e.target.value })} style={{ flex: 1 }} />
                <span className="label" style={{ fontFamily: 'var(--font-mono)' }}>{o.gamma.toFixed(2)}</span>
              </div>
              <div className="slider-row">
                <span className="label">Tetto</span>
                <input type="range" min={0} max={1} step={0.01} value={o.brightness}
                  onChange={e => set(open, { brightness: +e.target.value })} style={{ flex: 1 }} />
                <span className="label" style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(o.brightness * 100)}%</span>
              </div>

              <div className="u-row" style={{ gap: 4 }}>
                <button className="btn btn-secondary btn-sm"
                  onClick={() => window.api?.toggleOutputFullscreen?.(open + 1)}
                  title="Proiezione a tutto schermo di questa uscita">Tutto schermo</button>
                {open > 0 && (
                  <button className="btn btn-secondary btn-sm" onClick={() => remove(open)}
                    title="Chiudi questa uscita">Rimuovi</button>
                )}
              </div>
            </div>
          )
        })()}
      </div>
    </Panel>
  )
}

/** Reads the saved list once, and keeps main in step with every change. */
export function useOutputs(): [OutputCfg[], (list: OutputCfg[]) => void] {
  const [outputs, setOutputs] = useState<OutputCfg[]>(loadOutputs)
  const change = (list: OutputCfg[]) => {
    const clean = saveOutputs(list)
    setOutputs(clean)
    if (clean.length > 1) pushToast(`${clean.length} uscite attive`, 'outputs-count')
  }
  return [outputs, change]
}
