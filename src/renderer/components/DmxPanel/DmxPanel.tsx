import React, { useRef, useState } from 'react'
import type { Engine } from '@engine/Engine'
import { Panel } from '../Panel/Panel'
import { universesFor, type PixelMapConfig } from '../../pixelmap'
import { loadDmxConfig, saveDmxConfig, type DmxConfig } from '../../useDmxOutput'

/**
 * A field applied on blur or Invio, never per keystroke: typing "12" sent the
 * lights to universe 1, and a cleared Canale snapped to 1 before the 5 landed.
 * Same schema as OutputsPanel's resolution fields. The value is rewritten after
 * the clamp, because a clamp back to the saved value does not change the key.
 */
function CommitInput({ value, onCommit, min, max, ...rest }: {
  value: number | string
  onCommit: (raw: string) => void
  min?: number
  max?: number
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'defaultValue'>) {
  const commit = (e: React.FocusEvent<HTMLInputElement>) => {
    onCommit(e.currentTarget.value)
    e.currentTarget.value = String(value)   // overwritten by the remount when the value did change
  }
  return <input key={String(value)} defaultValue={value} min={min} max={max} {...rest}
    onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
}

/** clamp a typed integer, falling back to `cur` on nonsense */
const int = (raw: string, cur: number, lo: number, hi: number) => {
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : cur
}

interface DmxPanelProps {
  engine: Engine | null
}

/**
 * Audio-reactive ArtNet DMX: palette color on RGB PARs, energy on the dimmer.
 * The sender itself is `useDmxOutput`, mounted in App with the engine — this
 * panel is Pro-only, and sending from here froze the lights in Simple and Live.
 */
export function DmxPanel({ engine }: DmxPanelProps) {
  const [cfg, setCfg] = useState<DmxConfig>(loadDmxConfig)
  const cfgRef = useRef(cfg)
  cfgRef.current = cfg

  // the write stays out of the updater: StrictMode ran it twice, and a
  // synchronous setItem per keystroke in the IP field was not a render concern
  const set = (patch: Partial<DmxConfig>) => {
    const next = { ...cfgRef.current, ...patch }
    cfgRef.current = next
    setCfg(next)
    saveDmxConfig(next)
  }

  const pm = cfg.pixelMap
  const setPm = (patch: Partial<PixelMapConfig>) => set({ pixelMap: { ...pm, ...patch } })
  // fixtures past channel 512 stay dark in silence (useDmxOutput breaks the loop there)
  const chPerFixture = cfg.hasDimmer ? 4 : 3
  const fit = Math.floor((513 - cfg.baseChannel) / chPerFixture)
  const uni = universesFor(pm.cols, pm.rows)

  if (!engine) return null

  return (
    <Panel id="dmx" title="Luci DMX" defaultCollapsed group="right" active={cfg.enabled || pm.enabled}>
      <div className="u-col" style={{ gap: 8 }}>
        <div className="u-hint">
          ArtNet via rete (UDP :6454): PAR RGB che seguono palette ed energia. Nodo/interfaccia ArtNet richiesta.
        </div>
        <label className="slider-row" style={{ cursor: 'pointer' }}>
          <span className="label">PAR attivi</span>
          <input type="checkbox" checked={cfg.enabled} onChange={e => set({ enabled: e.target.checked })} />
        </label>
        <div className="slider-row">
          <span className="label">Nodo IP</span>
          <CommitInput type="text" placeholder="broadcast" value={cfg.host} aria-label="IP del nodo ArtNet"
            onCommit={v => set({ host: v.trim() })}
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' }} />
        </div>
        <div className="slider-row">
          <span className="label">Universo</span>
          <CommitInput type="number" min={0} max={32767} value={cfg.universe} aria-label="Universo PAR"
            onCommit={v => set({ universe: int(v, cfg.universe, 0, 32767) })} style={{ width: 64 }} />
          <span className="label" style={{ marginLeft: 8 }}>Canale</span>
          <CommitInput type="number" min={1} max={509} value={cfg.baseChannel} aria-label="Canale iniziale"
            onCommit={v => set({ baseChannel: int(v, cfg.baseChannel, 1, 509) })} style={{ width: 64 }} />
        </div>
        <div className="slider-row">
          <span className="label">Fixture</span>
          <CommitInput type="number" min={1} max={128} value={cfg.fixtures} aria-label="Numero di fixture"
            onCommit={v => set({ fixtures: int(v, cfg.fixtures, 1, 128) })} style={{ width: 64 }} />
          <label style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={cfg.hasDimmer} onChange={e => set({ hasDimmer: e.target.checked })} />
            <span className="label">Dimmer+RGB</span>
          </label>
        </div>
        {cfg.fixtures > fit && (
          <div className="u-hint" style={{ color: 'var(--warning)' }}>Solo {fit} fixture entrano nell'universo: le altre restano spente</div>
        )}
        <div className="slider-row">
          <span className="label">Dimmer da</span>
          <select value={cfg.dimmerSource} onChange={e => set({ dimmerSource: e.target.value as DmxConfig['dimmerSource'] })}>
            <option value="energy">Energia</option>
            <option value="bass">Bass</option>
            <option value="beat">Beat</option>
            <option value="full">Fisso al massimo</option>
          </select>
          <label style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={cfg.strobeOnBeat} onChange={e => set({ strobeOnBeat: e.target.checked })} />
            <span className="label">Flash sul beat</span>
          </label>
        </div>

        <div className="u-hint" style={{ marginTop: 8 }}>
          <b>Pixel map</b> — il frame campionato sul pannello LED, {uni} {uni === 1 ? 'universo' : 'universi'} da 170 pixel.
        </div>
        {pm.protocol === 'artnet' && !pm.host.trim() && uni > 4 && (
          <div className="u-hint" style={{ color: 'var(--warning)' }}>ArtNet in broadcast allaga la rete oltre 4 universi: usa sACN o un IP</div>
        )}
        <label className="slider-row" style={{ cursor: 'pointer' }}>
          <span className="label">Pixel map</span>
          <input type="checkbox" checked={pm.enabled} onChange={e => setPm({ enabled: e.target.checked })} />
          <select value={pm.protocol} onChange={e => setPm({ protocol: e.target.value as PixelMapConfig['protocol'] })} style={{ marginLeft: 8 }}>
            <option value="sacn">sACN</option>
            <option value="artnet">ArtNet</option>
          </select>
        </label>
        <div className="slider-row">
          <span className="label">Pixel</span>
          <CommitInput type="number" min={1} max={1024} value={pm.cols} onCommit={v => setPm({ cols: int(v, pm.cols, 1, 1024) })} style={{ width: 56 }} aria-label="Colonne" />
          <span>×</span>
          <CommitInput type="number" min={1} max={1024} value={pm.rows} onCommit={v => setPm({ rows: int(v, pm.rows, 1, 1024) })} style={{ width: 56 }} aria-label="Righe" />
          <label style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={pm.snake} onChange={e => setPm({ snake: e.target.checked })} />
            <span className="label">Serpentina</span>
          </label>
        </div>
        <div className="slider-row">
          <span className="label">Universo</span>
          <CommitInput type="number" min={0} max={63999} value={pm.universe} onCommit={v => setPm({ universe: int(v, pm.universe, 0, 63999) })} style={{ width: 64 }} aria-label="Universo pixel map" />
          <span className="label" style={{ marginLeft: 8 }}>fps</span>
          <CommitInput type="number" min={1} max={60} value={pm.fps} onCommit={v => setPm({ fps: int(v, pm.fps, 1, 60) })} style={{ width: 48 }} aria-label="fps pixel map" />
        </div>
        <div className="slider-row">
          <span className="label">Destinazione</span>
          <CommitInput type="text" placeholder={pm.protocol === 'sacn' ? 'multicast' : 'broadcast'} value={pm.host} aria-label="Destinazione pixel map"
            onCommit={v => setPm({ host: v.trim() })}
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' }} />
        </div>
      </div>
    </Panel>
  )
}
