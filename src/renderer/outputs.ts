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
  /**
   * Projection mapping of this wall: TL,TR,BR,BL as x,y in 0..1 of the window.
   * Per output since two skewed projectors are skewed differently.
   */
  keystone: number[]
}

export const OUTPUTS_KEY = 'djtographikz-uscite'

/** No warp: the quad is the window. */
export const DEFAULT_KEYSTONE = [0, 0, 1, 0, 1, 1, 0, 1]

export const DEFAULT_OUTPUT: OutputCfg = {
  displayId: null, width: 1920, height: 1080, src: [0, 0, 1, 1], gamma: 1, brightness: 1,
  keystone: DEFAULT_KEYSTONE,
}

export function keystoneActive(k: number[]): boolean {
  return k.some((v, i) => Math.abs(v - DEFAULT_KEYSTONE[i]) > 0.0005)
}

/** Rough pixel budget: every output is a full second render on the same GPU. */
export const PIXEL_BUDGET = 1920 * 1080 * 2.2

export function totalPixels(list: OutputCfg[]): number {
  return list.reduce((n, o) => n + o.width * o.height, 0)
}

const num = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback

/**
 * Eight finite numbers or nothing: a short array used to silently do nothing,
 * a NaN corner is a degenerate homography and a black wall. Corners may sit a
 * little outside the window for pincushion correction, same range as the engine.
 */
export function sanitizeKeystone(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length !== 8 || !raw.every(v => typeof v === 'number' && isFinite(v)))
    return [...DEFAULT_KEYSTONE]
  return raw.map(v => Math.max(-0.5, Math.min(1.5, v)))
}

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
    keystone: sanitizeKeystone(raw?.keystone),
  }
}

/**
 * Before I7 the keystone was one for the whole show and lived in the session
 * snapshot. A list saved by that app has outputs without the field: the old
 * global corners become output 1's, so nobody loses last night's alignment.
 * Once by construction — after the first save every output carries the field,
 * and a list that has it is returned untouched.
 */
export function migrateKeystone(rawOutputs: unknown, legacy: unknown): OutputCfg[] {
  const list = sanitizeOutputs(rawOutputs)
  const first = Array.isArray(rawOutputs) ? rawOutputs[0] : null
  const hasField = !!first && typeof first === 'object' && 'keystone' in first
  if (!hasField && Array.isArray(legacy)) list[0] = { ...list[0], keystone: sanitizeKeystone(legacy) }
  return list
}

/** Always at least one: the projector cannot be removed, only reconfigured. */
export function sanitizeOutputs(raw: unknown): OutputCfg[] {
  const list = Array.isArray(raw) ? raw.slice(0, 8).map(sanitizeOutput) : []
  return list.length ? list : [{ ...DEFAULT_OUTPUT }]
}

