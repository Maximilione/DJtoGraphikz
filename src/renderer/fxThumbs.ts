import React from 'react'
import type { Engine } from '@engine/Engine'

/**
 * Effect thumbnails, captured lazily from the LIVE engine — no offline render
 * pipeline. A snapshot is taken ~1.5s after an effect becomes active (via the
 * useFxThumbs hook), downscaled to 128x72 jpeg and stored in localStorage.
 */

const KEY = 'djtographikz-fx-thumbs'
const W = 128
const H = 72

let thumbs: Record<string, string> = {}
try {
  thumbs = JSON.parse(localStorage.getItem(KEY) || '{}')
} catch {
  thumbs = {} // corrupt store → start over
}

const listeners = new Set<() => void>()
// once per effect per session — the STORED thumb still gets replaced (latest look wins)
const capturedThisSession = new Set<string>()

export function getThumb(id: string): string | undefined {
  return thumbs[id]
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

export async function captureThumb(engine: Engine): Promise<void> {
  if (!frameIsClean(engine)) return
  const id = engine.getCurrentEffect()
  const blob = await engine.screenshot()
  if (!blob) return
  // state may have moved while waiting for the frame — don't save a wrong look
  if (!frameIsClean(engine) || engine.getCurrentEffect() !== id) return
  try {
    const bmp = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(bmp, 0, 0, W, H)
    bmp.close()
    thumbs[id] = canvas.toDataURL('image/jpeg', 0.6)
    capturedThisSession.add(id)
    try { localStorage.setItem(KEY, JSON.stringify(thumbs)) } catch { /* quota — keep in-memory copy */ }
    listeners.forEach(fn => fn())
  } catch { /* decode failed — skip, next effect change retries */ }
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
