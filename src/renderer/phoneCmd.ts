// Validation of remote commands (phone, OSC, MIDI). A phone can send anything:
// NaN would reach the engine as a master of NaN (black projector), an unknown id
// would land in the post chain. Pure — no engine, no DOM — so check-phone.mjs
// can walk it with hostile input.

export interface Known {
  effects: ReadonlySet<string>
  posts: ReadonlySet<string>
  transitions: ReadonlySet<string>
  blendModes: ReadonlySet<string>
  genres: ReadonlySet<string>
  sources: ReadonlySet<string>
}

export interface RemoteCmd { type: string; value?: unknown; source?: string; hold?: string }

const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const str = (x: unknown, max = 64): x is string => typeof x === 'string' && x.length > 0 && x.length <= max
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** [min, max] of the single-number commands */
const RANGES: Record<string, [number, number]> = {
  crossfade: [0, 1], brightness: [0, 1], intensity: [0, 1], maskSoft: [0, 1],
  motionBlur: [0, 0.95], transitionDuration: [0, 10], bpmSet: [60, 300],
}
const GRADE: Record<string, [number, number]> = {
  exposure: [0, 2], contrast: [0, 2], saturation: [0, 2], lift: [-0.5, 0.5], vignette: [0, 1.5],
}
const CAMERA: Record<string, [number, number]> = {
  zoom: [0.2, 4], rotation: [-180, 180], panX: [-1, 1], panY: [-1, 1], tile: [1, 8], push: [0, 1],
}
export const BARS_CHOICES = [1, 2, 4, 8, 16]
const BPM_MODES = ['auto', 'tap', 'manual']

/** Booleans arrive as true/false, 1/0 (OSC floats are already thresholded upstream) */
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : x === 1 ? true : x === 0 ? false : null)

/** The command with a safe value, or null when it must be dropped. */
export function sanitizeCmd(cmd: unknown, k: Known): RemoteCmd | null {
  if (!isObj(cmd) || typeof cmd.type !== 'string') return null
  const t = cmd.type
  const v = cmd.value
  const ok = (value?: unknown): RemoteCmd => {
    const out: RemoteCmd = { type: t }
    if (value !== undefined) out.value = value
    if (typeof cmd.source === 'string') out.source = cmd.source.slice(0, 32)
    if (str(cmd.hold)) out.hold = cmd.hold
    return out
  }

  if (t in RANGES) return fin(v) ? ok(clamp(v, ...RANGES[t])) : null

  switch (t) {
    case 'panic': case 'tap': case 'cameraReset': case 'saveScene': return ok()
    case 'seqNext': case 'seqPrev': case 'seqStop': return ok()
    case 'seqStart': return ok(v)                           // validSeqIndex in the player
    case 'release': return str(v) ? ok(v) : null
    case 'effect': case 'deckB': return str(v) && k.effects.has(v) ? ok(v) : null
    case 'post': return str(v) && k.posts.has(v) ? ok(v) : null
    case 'postAmount':
      return isObj(v) && str(v.id) && k.posts.has(v.id) && fin(v.value) ? ok({ id: v.id, value: clamp(v.value, 0, 1) }) : null
    case 'postMove':
      return isObj(v) && str(v.id) && k.posts.has(v.id) && fin(v.delta) ? ok({ id: v.id, delta: v.delta < 0 ? -1 : 1 }) : null
    case 'palette':
      return Array.isArray(v) && v.length === 3 && v.every(c => typeof c === 'string' && HEX.test(c)) ? ok([v[0], v[1], v[2]]) : null
    case 'blackout': case 'freeze': case 'onlyMine': { const b = bool(v); return b === null ? null : ok(b) }
    case 'autovj': { if (v === '__toggle__') return ok(v); const b = bool(v); return b === null ? null : ok(b) }
    case 'genre': return str(v) && k.genres.has(v) ? ok(v) : null
    case 'blendMode': return str(v) && k.blendModes.has(v) ? ok(v) : null
    case 'transitionType': return str(v) && k.transitions.has(v) ? ok(v) : null
    case 'grade':
      return isObj(v) && str(v.key) && v.key in GRADE && fin(v.value) ? ok({ key: v.key, value: clamp(v.value, ...GRADE[v.key]) }) : null
    case 'camera': {
      if (!isObj(v)) return null
      const out: Record<string, number> = {}
      for (const key in CAMERA) if (fin(v[key])) out[key] = clamp(v[key] as number, ...CAMERA[key])
      return Object.keys(out).length ? ok(out) : null
    }
    case 'param': return isObj(v) && str(v.key) && fin(v.value) ? ok({ key: v.key, value: v.value }) : null  // the engine clamps to the def
    case 'paramMap':
      return isObj(v) && str(v.key) && str(v.source) && k.sources.has(v.source) && fin(v.depth)
        ? ok({ key: v.key, source: v.source, depth: clamp(v.depth, -1, 1) }) : null
    case 'look': return fin(v) && Number.isInteger(v) && v >= 0 && v < 16 ? ok(v) : null
    case 'bpmMode': return typeof v === 'string' && BPM_MODES.includes(v) ? ok(v) : null
    case 'paletteStep': return v === 1 || v === -1 ? ok(v) : null
    case 'bpmScale': return v === 0.5 || v === 2 ? ok(v) : null
    case 'videoDeck': {
      if (!isObj(v)) return null
      const out: Record<string, unknown> = {}
      const en = bool(v.enabled)
      if (en !== null) out.enabled = en
      if (fin(v.clip) && Number.isInteger(v.clip) && v.clip >= 0) out.clip = v.clip   // range vs the clip count: App
      if (fin(v.barsPerClip) && BARS_CHOICES.includes(v.barsPerClip)) out.barsPerClip = v.barsPerClip
      return Object.keys(out).length ? ok(out) : null
    }
    case 'cycle': {
      if (!isObj(v)) return null
      const out: Record<string, unknown> = {}
      const en = bool(v.enabled), bs = bool(v.beatSync)
      if (en !== null) out.enabled = en
      if (bs !== null) out.beatSync = bs
      if (fin(v.intervalMs)) out.intervalMs = clamp(Math.round(v.intervalMs), 1000, 120000)
      if (fin(v.beatsPerSwitch)) out.beatsPerSwitch = clamp(Math.round(v.beatsPerSwitch), 1, 64)
      return Object.keys(out).length ? ok(out) : null
    }
    case 'overlay': {
      if (!isObj(v) || !str(v.id, 128)) return null
      const out: Record<string, unknown> = { id: v.id }
      const vis = bool(v.visible)
      if (vis !== null) out.visible = vis
      if (fin(v.opacity)) out.opacity = clamp(v.opacity, 0, 1)
      return Object.keys(out).length > 1 ? ok(out) : null
    }
  }
  return null   // unknown type: nothing to do
}

/** Next/previous palette from the one on screen; an unknown current starts at the edge. */
export function stepPalette<T extends { colors: string[] }>(list: T[], colors: string[] | undefined, delta: number): T | null {
  if (!list.length) return null
  const cur = (colors ?? []).join(',').toLowerCase()
  const i = list.findIndex(p => p.colors.join(',').toLowerCase() === cur)
  const n = i < 0 ? (delta < 0 ? list.length - 1 : 0) : (i + (delta < 0 ? -1 : 1) + list.length) % list.length
  return list[n]
}
