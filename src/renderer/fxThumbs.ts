import React from 'react'
import type { Engine } from '@engine/Engine'
import { readJson, writeString } from './storage'

/**
 * Effect thumbnails, captured lazily from the LIVE engine — no offline render
 * pipeline. A snapshot is taken ~1.5s after an effect becomes active (via the
 * useFxThumbs hook), downscaled to 128x72 jpeg and stored in localStorage.
 */

const KEY = 'djtographikz-fx-thumbs'
const W = 128
const H = 72

// A cache, so it writes with the quiet writer: a thumbnail that does not fit
// is not worth a toast about work not being saved, and these are the fattest
// values in the store.
let thumbs: Record<string, string> = readJson<Record<string, string>>(KEY, {}, false)

const listeners = new Set<() => void>()
// once per effect per session — the STORED thumb still gets replaced (latest look wins)
const capturedThisSession = new Set<string>()

export function getThumb(id: string): string | undefined {
  return thumbs[id]
}

export function allThumbs(): Record<string, string> {
  return thumbs
}

export function onThumbs(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** True only when the live frame actually shows the current effect, clean. */
function frameIsClean(engine: Engine): boolean {
  return !engine.isUsingCustomShader()
    && engine.getCrossfade() < 0.05 // deck B would pollute the shot
    && !engine.isBlackout()
    && !engine.isFrozen()
}

// One 128x72 canvas reused for every capture
let thumbCanvas: HTMLCanvasElement | null = null

/**
 * Downscale the next live frame straight off the WebGL canvas, inside the
 * frame callback while its pixels are still readable. The old route went
 * through engine.screenshot(): a full-res PNG encode plus a decode to an
 * ImageBitmap, 20-80 ms of main thread and a few MB, just to shrink it.
 */
function grabFrame(engine: Engine): Promise<string | null> {
  return new Promise(resolve => {
    let off = () => {}
    const timer = setTimeout(() => { off(); resolve(null) }, 2000) // renderer idle: give up, next effect change retries
    off = engine.onFrameRendered(src => {
      off(); clearTimeout(timer)
      try {
        const c = thumbCanvas ??= Object.assign(document.createElement('canvas'), { width: W, height: H })
        const ctx = c.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(src, 0, 0, W, H)
        resolve(c.toDataURL('image/jpeg', 0.6))
      } catch { resolve(null) }
    })
  })
}

export async function captureThumb(engine: Engine): Promise<void> {
  if (!frameIsClean(engine)) return
  const id = engine.getCurrentEffect()
  const url = await grabFrame(engine)
  if (!url) return
  // state may have moved while waiting for the frame — don't save a wrong look
  if (!frameIsClean(engine) || engine.getCurrentEffect() !== id) return
  thumbs[id] = url
  capturedThisSession.add(id)
  writeString(KEY, JSON.stringify(thumbs)) // false = quota; the in-memory copy still works
  listeners.forEach(fn => fn())
}

/**
 * Shared by EffectPanel and SimplePanel: re-renders the grid when a thumb is
 * saved, and schedules one capture ~1.5s after each effect change (transition
 * settled), once per effect per session.
 */
export function useFxThumbs(engine: Engine | null, activeEffect: string): void {
  const [, force] = React.useState(0)
  React.useEffect(() => onThumbs(() => force(n => n + 1)), [])
  React.useEffect(() => {
    if (!engine || capturedThisSession.has(activeEffect)) return
    const t = setTimeout(() => { void captureThumb(engine) }, 1500)
    return () => clearTimeout(t)
  }, [engine, activeEffect])
}

/** Inline background for an effect button that has a thumb (dark overlay keeps the label readable). */
export function thumbBackground(thumb: string, active: boolean): string {
  const dim = active ? 0.35 : 0.55
  return `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), url("${thumb}") center / cover`
}
