/**
 * DMX and pixel-map output, mounted once with the engine.
 *
 * The sender used to live in DmxPanel's effects, and DmxPanel is mounted in
 * Pro mode only: switching to Simple or Live froze the PARs on their last
 * colour, and the pixel map's cleanup left the GPU sampling for nobody. The
 * panel is now a view on the config; the config reaches the sender through
 * one window event, and a venue profile that rewrites the store rings the
 * same bell.
 */
import { useEffect } from 'react'
import type { Engine } from '@engine/Engine'
import { readJson, writeJson } from './storage'
import { DMX_STORE_KEY } from './venues'
import { PIXEL_MAP_DEFAULTS, packUniverses, sanitizePixelMap, type PixelMapConfig } from './pixelmap'
import { guardListener } from './safeListener'

// One simple fixture model covers the common club rig: RGB PAR with optional
// master dimmer channel before the RGB. More exotic rigs can offset with
// the base channel. ponytail: no fixture library — add if someone asks.
export interface DmxConfig {
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

export const DMX_DEFAULTS: DmxConfig = {
  enabled: false, host: '', universe: 0,
  fixtures: 4, baseChannel: 1, hasDimmer: true,
  dimmerSource: 'energy', strobeOnBeat: false,
  pixelMap: PIXEL_MAP_DEFAULTS,
}

/** Fired with the new config in `detail`, or without one when the store was rewritten from outside. */
export const DMX_CONFIG_EVENT = 'djg:dmx-config'

export function loadDmxConfig(): DmxConfig {
  const raw = readJson<Partial<DmxConfig>>(DMX_STORE_KEY, {})
  return { ...DMX_DEFAULTS, ...raw, pixelMap: sanitizePixelMap(raw.pixelMap) }
}

/**
 * Persists and hands the config to the sender in the same move, so the lights
 * follow the panel even when the quota refuses the write (the toast says so).
 */
export function saveDmxConfig(cfg: DmxConfig): boolean {
  const ok = writeJson(DMX_STORE_KEY, cfg)
  window.dispatchEvent(new CustomEvent<DmxConfig>(DMX_CONFIG_EVENT, { detail: cfg }))
  return ok
}

/** Something else rewrote the store (a venue profile): the sender re-reads it. */
export function notifyDmxConfigChanged(): void {
  window.dispatchEvent(new Event(DMX_CONFIG_EVENT))
}

const ZERO_FRAME = new Uint8Array(64)

/** Audio-reactive ArtNet DMX: palette colour on RGB PARs, energy on the dimmer. */
export function useDmxOutput(engine: Engine | null): void {
  useEffect(() => {
    if (!engine) return
    let cfg = loadDmxConfig()
    let last = 0
    // one buffer, resized only when the rig changes: a fresh number[] a frame
    // was a clone per element over IPC and garbage at 30 Hz
    let values = new Uint8Array(0)

    // 30Hz sender driven by the engine's audio frame (already ticking at 60)
    const unFrame = engine.onAudioFrame(guardListener('dmx', (beat) => {
      const c = cfg
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
      const size = Math.min(512, Math.max(2, c.baseChannel - 1 + c.fixtures * chPerFixture))
      if (values.length !== size) values = new Uint8Array(size)
      else values.fill(0)
      for (let f = 0; f < c.fixtures; f++) {
        let ch = c.baseChannel - 1 + f * chPerFixture
        if (ch + chPerFixture > 512) break
        if (c.hasDimmer) {
          values[ch++] = Math.round(level * 255)
          values[ch++] = r; values[ch++] = g; values[ch++] = b
        } else {
          // no dimmer channel: bake the level into the colour
          values[ch++] = Math.round(r * level)
          values[ch++] = Math.round(g * level)
          values[ch++] = Math.round(b * level)
        }
      }
      // send() serializes synchronously: the buffer can be reused next frame
      window.api?.sendDmxFrame?.({ host: c.host, universe: c.universe, values })
    }))

    // pixel map: the engine samples the master frame, this packs and sends it
    let pmKey = ''
    const applyPixelMap = () => {
      const pm = cfg.pixelMap
      const key = pm.enabled ? JSON.stringify(pm) : ''
      if (key === pmKey) return
      pmKey = key
      if (!pm.enabled) { engine.setPixelMap(null); engine.onPixelFrame = null; return }
      engine.setPixelMap({ cols: pm.cols, rows: pm.rows, fps: pm.fps })
      engine.onPixelFrame = (rgba) => {
        window.api?.sendPixelMap?.({ host: pm.host, protocol: pm.protocol, frames: packUniverses(rgba, pm) })
      }
    }
    applyPixelMap()

    const onConfig = (e: Event) => {
      const next = (e as CustomEvent<DmxConfig | undefined>).detail ?? loadDmxConfig()
      // blackout on the on→off transition only: one zero frame so the lights
      // don't stay stuck on. It used to go out at every mount too — with DMX
      // off, opening the app or loading a venue blacked out whatever console
      // shared the universe.
      if (cfg.enabled && !next.enabled) {
        window.api?.sendDmxFrame?.({ host: cfg.host, universe: cfg.universe, values: ZERO_FRAME })
      }
      cfg = next
      applyPixelMap()
    }
    window.addEventListener(DMX_CONFIG_EVENT, onConfig)
    return () => {
      window.removeEventListener(DMX_CONFIG_EVENT, onConfig)
      unFrame()
      // the cleanup used to leave the engine sampling for a receiver that was gone
      engine.onPixelFrame = null
      engine.setPixelMap(null)
    }
  }, [engine])
}
