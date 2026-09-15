/**
 * The outputs of the show — one window per wall.
 *
 * Same shape as `OutputCfg` in `src/main/index.ts`: it crosses as plain JSON,
 * like every other contract here. The renderer owns the list and hands it over
 * whole; main makes the windows match it.
 *
 * Free of React and of localStorage, like `venues.ts`, so the rules that
 * protect a projector are testable on their own (`yarn check:outputs`).
 *
 * What an output is *not*: part of the engine state. The state snapshot is the
 * show and reaches every window unchanged — the crop, the screen and the trim
 * are about the room.
 */
export interface OutputCfg {
  displayId: number | null
  width: number
  height: number
  /** x,y,w,h in 0..1 of the composition, y from the bottom (uv) */
  src: [number, number, number, number]
  /** LED walls crush blacks: 1 = untouched */
  gamma: number
  /** ceiling for this wall, 0..1 — a LED panel at full white is unwatchable */
  brightness: number
}

export const OUTPUTS_KEY = 'djtographikz-uscite'

export const DEFAULT_OUTPUT: OutputCfg = {
  displayId: null, width: 1920, height: 1080, src: [0, 0, 1, 1], gamma: 1, brightness: 1,
}

/** Rough pixel budget: every output is a full second render on the same GPU. */
export const PIXEL_BUDGET = 1920 * 1080 * 2.2

export function totalPixels(list: OutputCfg[]): number {
  return list.reduce((n, o) => n + o.width * o.height, 0)
}

const num = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback

/**
 * Anything that reaches here drives a projector, so it is checked before it
 * does: a zero-width crop is a black wall that reads exactly like a dead
 * output, and a 32000-pixel resolution is a renderer that never comes back.
 */
export function sanitizeOutput(raw: any): OutputCfg {
  const src = Array.isArray(raw?.src) && raw.src.length === 4 ? raw.src : DEFAULT_OUTPUT.src
  const x = num(src[0], 0, 1, 0), y = num(src[1], 0, 1, 0)
  return {
    displayId: typeof raw?.displayId === 'number' ? raw.displayId : null,
    width: Math.round(num(raw?.width, 320, 7680, DEFAULT_OUTPUT.width)),
    height: Math.round(num(raw?.height, 240, 4320, DEFAULT_OUTPUT.height)),
    src: [x, y, num(src[2], 0.01, 1 - x, 1 - x), num(src[3], 0.01, 1 - y, 1 - y)],
    gamma: num(raw?.gamma, 0.2, 4, 1),
    brightness: num(raw?.brightness, 0, 1, 1),
  }
}

/** Always at least one: the projector cannot be removed, only reconfigured. */
export function sanitizeOutputs(raw: unknown): OutputCfg[] {
  const list = Array.isArray(raw) ? raw.slice(0, 8).map(sanitizeOutput) : []
  return list.length ? list : [{ ...DEFAULT_OUTPUT }]
}

