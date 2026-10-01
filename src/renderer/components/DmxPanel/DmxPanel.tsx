import React, { useEffect, useRef, useState } from 'react'
import { readJson, writeJson } from '../../storage'
import type { Engine } from '@engine/Engine'
import { Panel } from '../Panel/Panel'
import { DMX_STORE_KEY as STORAGE_KEY } from '../../venues'
import { PIXEL_MAP_DEFAULTS, packUniverses, sanitizePixelMap, universesFor, type PixelMapConfig } from '../../pixelmap'

interface DmxPanelProps {
  engine: Engine | null
}

// One simple fixture model covers the common club rig: RGB PAR with optional
// master dimmer channel before the RGB. More exotic rigs can offset with
// the base channel. ponytail: no fixture library — add if someone asks.
interface DmxConfig {
  enabled: boolean
  host: string        // '' = broadcast
  universe: number
  fixtures: number    // how many identical fixtures in a row
  baseChannel: number // 1-based DMX address of the first fixture
  hasDimmer: boolean  // ch layout: [dimmer,] R, G, B
  dimmerSource: 'energy' | 'bass' | 'beat' | 'full'
  strobeOnBeat: boolean
  /** I6: the frame on a LED panel, stored with the DMX config so a venue profile carries it */
  pixelMap: PixelMapConfig
}

const DEFAULTS: DmxConfig = {
  enabled: false, host: '', universe: 0,
  fixtures: 4, baseChannel: 1, hasDimmer: true,
  dimmerSource: 'energy', strobeOnBeat: false,
  pixelMap: PIXEL_MAP_DEFAULTS,
}

function load(): DmxConfig {
  const raw = readJson<Partial<DmxConfig>>(STORAGE_KEY, {})
  return { ...DEFAULTS, ...raw, pixelMap: sanitizePixelMap(raw.pixelMap) }
}

/** Audio-reactive ArtNet DMX: palette color on RGB PARs, energy on the dimmer. */
export function DmxPanel({ engine }: DmxPanelProps) {
  const [cfg, setCfg] = useState<DmxConfig>(load)
  const cfgRef = useRef(cfg)
  cfgRef.current = cfg

  const set = (patch: Partial<DmxConfig>) => {
    setCfg(prev => {
      const next = { ...prev, ...patch }
      writeJson(STORAGE_KEY, next)
      return next
    })
  }

  // 30Hz sender driven by the engine's audio frame (already ticking at 60)
  useEffect(() => {
    if (!engine) return
    let last = 0
    return engine.onAudioFrame((beat) => {
      const c = cfgRef.current
      if (!c.enabled) return
      const now = performance.now()
      if (now - last < 33 && !beat) return
      last = now

      // only palette colour 1 drives the fixtures
      const n = parseInt(engine.getCurrentColors()[0].slice(1), 16)
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255

      const audio = engine.getAudioLevels()
      const dim = c.dimmerSource === 'full' ? 1
        : c.dimmerSource === 'bass' ? audio.bass
        : c.dimmerSource === 'beat' ? audio.beatPulse
        : audio.energy
      const strobe = c.strobeOnBeat && beat ? 1 : 0
      const level = Math.min(1, Math.max(strobe, dim))

      const chPerFixture = c.hasDimmer ? 4 : 3
      const size = c.baseChannel - 1 + c.fixtures * chPerFixture
      const values = new Array(Math.min(512, Math.max(2, size))).fill(0)
      for (let f = 0; f < c.fixtures; f++) {
        let ch = c.baseChannel - 1 + f * chPerFixture
        if (ch + chPerFixture > 512) break
        if (c.hasDimmer) {
          values[ch++] = Math.round(level * 255)
          values[ch++] = r; values[ch++] = g; values[ch++] = b
        } else {
          // no dimmer channel: bake the level into the color
          values[ch++] = Math.round(r * level)
          values[ch++] = Math.round(g * level)
          values[ch++] = Math.round(b * level)
        }
      }
      window.api?.sendDmxFrame?.({ host: c.host, universe: c.universe, values })
    })
  }, [engine])

  // pixel map: the engine samples the master frame, this packs and sends it
  const pm = cfg.pixelMap
  useEffect(() => {
    if (!engine) return
    if (!pm.enabled) { engine.setPixelMap(null); engine.onPixelFrame = null; return }
    engine.setPixelMap({ cols: pm.cols, rows: pm.rows, fps: pm.fps })
    engine.onPixelFrame = (rgba) => {
      window.api?.sendPixelMap?.({ host: pm.host, protocol: pm.protocol, frames: packUniverses(rgba, pm) })
    }
    return () => { engine.onPixelFrame = null }
  }, [engine, pm.enabled, pm.cols, pm.rows, pm.fps, pm.host, pm.protocol, pm.snake, pm.universe])
  const setPm = (patch: Partial<PixelMapConfig>) => set({ pixelMap: { ...pm, ...patch } })

  // blackout on disable: one zero-frame so the lights don't stay stuck on
  useEffect(() => {
    if (!cfg.enabled) {
      window.api?.sendDmxFrame?.({ host: cfg.host, universe: cfg.universe, values: new Array(64).fill(0) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.enabled])

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
