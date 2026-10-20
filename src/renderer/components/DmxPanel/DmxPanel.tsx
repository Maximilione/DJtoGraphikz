import React, { useRef, useState } from 'react'
import type { Engine } from '@engine/Engine'
import { Panel } from '../Panel/Panel'
import { universesFor, type PixelMapConfig } from '../../pixelmap'
import { loadDmxConfig, saveDmxConfig, type DmxConfig } from '../../useDmxOutput'

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

  if (!engine) return null

  return (
    <Panel id="dmx" title="Luci DMX" defaultCollapsed group="right" active={cfg.enabled}>
      <div className="u-col" style={{ gap: 8 }}>
        <div className="u-hint">
          ArtNet via rete (UDP :6454): PAR RGB che seguono palette ed energia. Nodo/interfaccia ArtNet richiesta.
        </div>
        <label className="slider-row" style={{ cursor: 'pointer' }}>
          <span className="label">Attivo</span>
          <input type="checkbox" checked={cfg.enabled} onChange={e => set({ enabled: e.target.checked })} />
        </label>
        <div className="slider-row">
          <span className="label">Nodo IP</span>
          <input type="text" placeholder="broadcast" value={cfg.host}
            onChange={e => set({ host: e.target.value })}
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' }} />
        </div>
        <div className="slider-row">
          <span className="label">Universo</span>
          <input type="number" min={0} max={32767} value={cfg.universe}
            onChange={e => set({ universe: Math.max(0, +e.target.value | 0) })} style={{ width: 64 }} />
          <span className="label" style={{ marginLeft: 8 }}>Canale</span>
          <input type="number" min={1} max={509} value={cfg.baseChannel}
            onChange={e => set({ baseChannel: Math.max(1, Math.min(509, +e.target.value | 0)) })} style={{ width: 64 }} />
        </div>
        <div className="slider-row">
          <span className="label">Fixture</span>
          <input type="number" min={1} max={128} value={cfg.fixtures}
            onChange={e => set({ fixtures: Math.max(1, Math.min(128, +e.target.value | 0)) })} style={{ width: 64 }} />
          <label style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={cfg.hasDimmer} onChange={e => set({ hasDimmer: e.target.checked })} />
            <span className="label">Dimmer+RGB</span>
          </label>
        </div>
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
          <b>Pixel map</b> — il frame campionato alla risoluzione del pannello LED, {universesFor(pm.cols, pm.rows)} universi da 170 pixel.
          sACN multicast (239.255.x.y:5568) regge decine di universi; ArtNet in broadcast allaga la rete oltre quattro.
        </div>
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
          <input type="number" min={1} max={1024} value={pm.cols} onChange={e => setPm({ cols: Math.max(1, Math.min(1024, +e.target.value | 0)) })} style={{ width: 56 }} aria-label="Colonne" />
          <span>×</span>
          <input type="number" min={1} max={1024} value={pm.rows} onChange={e => setPm({ rows: Math.max(1, Math.min(1024, +e.target.value | 0)) })} style={{ width: 56 }} aria-label="Righe" />
          <label style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={pm.snake} onChange={e => setPm({ snake: e.target.checked })} />
            <span className="label">Serpentina</span>
          </label>
        </div>
        <div className="slider-row">
          <span className="label">Universo</span>
          <input type="number" min={0} max={63999} value={pm.universe} onChange={e => setPm({ universe: Math.max(0, +e.target.value | 0) })} style={{ width: 64 }} />
          <span className="label" style={{ marginLeft: 8 }}>fps</span>
          <input type="number" min={1} max={60} value={pm.fps} onChange={e => setPm({ fps: Math.max(1, Math.min(60, +e.target.value | 0)) })} style={{ width: 48 }} />
        </div>
        <div className="slider-row">
          <span className="label">Destinazione</span>
          <input type="text" placeholder={pm.protocol === 'sacn' ? 'multicast' : 'broadcast'} value={pm.host}
            onChange={e => setPm({ host: e.target.value })}
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' }} />
        </div>
      </div>
    </Panel>
  )
}
