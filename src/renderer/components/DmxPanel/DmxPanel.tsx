import React, { useEffect, useRef, useState } from 'react'
import type { Engine } from '@engine/Engine'
import { usePanelCollapsed } from '../usePanelCollapsed'

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
}

const STORAGE_KEY = 'djtographikz-dmx'
const DEFAULTS: DmxConfig = {
  enabled: false, host: '', universe: 0,
  fixtures: 4, baseChannel: 1, hasDimmer: true,
  dimmerSource: 'energy', strobeOnBeat: false,
}

function load(): DmxConfig {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } } catch { return { ...DEFAULTS } }
}

/** Audio-reactive ArtNet DMX: palette color on RGB PARs, energy on the dimmer. */
export function DmxPanel({ engine }: DmxPanelProps) {
  const [collapsed, toggleCollapsed] = usePanelCollapsed('dmx', true, 'right')
  const [cfg, setCfg] = useState<DmxConfig>(load)
  const cfgRef = useRef(cfg)
  cfgRef.current = cfg

  const set = (patch: Partial<DmxConfig>) => {
    setCfg(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* quota */ }
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

  // blackout on disable: one zero-frame so the lights don't stay stuck on
  useEffect(() => {
    if (!cfg.enabled) {
      window.api?.sendDmxFrame?.({ host: cfg.host, universe: cfg.universe, values: new Array(64).fill(0) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.enabled])

  if (!engine) return null

  return (
    <div className="panel">
      <div className="panel-header" onClick={toggleCollapsed} title={collapsed ? 'Espandi Luci DMX' : 'Comprimi Luci DMX'}>
        <span>Luci DMX{cfg.enabled ? ' ●' : ''}</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
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
        </div>
      )}
    </div>
  )
}
