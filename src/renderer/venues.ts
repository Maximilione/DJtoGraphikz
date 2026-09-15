/**
 * "Posti": the room, not the show.
 *
 * Output display, resolution, the four mapping corners, audio device and gain,
 * ArtNet node and master — everything that is about *where* you are playing and
 * has to be found again the second night in the same club. The look is already
 * restored from the session snapshot; this is the other half.
 *
 * Kept free of React and of localStorage so the rules below are testable on
 * their own (`yarn check:venues`). The panel does the reading and writing.
 */

export interface Venue {
  name: string
  /** "1920x1080" — the same string the toolbar select carries */
  outputRes: string
  /** Electron display id, or null for "wherever the output already is" */
  displayId: number | null
  /** 8 values: TL,TR,BR,BL as x,y */
  keystone: number[]
  brightness: number
  /** Raw blobs of the two panel stores, replayed as-is on load */
  audio: unknown
  dmx: unknown
}

export const VENUES_KEY = 'djtographikz-posti'
export const AUDIO_STORE_KEY = 'djtographikz-audio'
export const DMX_STORE_KEY = 'djtographikz-dmx'

const RES_RE = /^(\d{3,5})x(\d{3,5})$/

/** null when the string is not a resolution this app could have written. */
export function parseRes(res: unknown): [number, number] | null {
  const m = typeof res === 'string' ? RES_RE.exec(res) : null
  if (!m) return null
  const w = Number(m[1]), h = Number(m[2])
  if (w < 320 || h < 240 || w > 7680 || h > 4320) return null
  return [w, h]
}

function isVenue(v: any): v is Venue {
  return !!v && typeof v.name === 'string' && v.name.trim() !== ''
    && parseRes(v.outputRes) !== null
    && (v.displayId === null || typeof v.displayId === 'number')
    && Array.isArray(v.keystone) && v.keystone.length === 8
    && v.keystone.every((n: unknown) => typeof n === 'number' && isFinite(n))
    && typeof v.brightness === 'number' && v.brightness >= 0 && v.brightness <= 1
}

/**
 * A half-written or hand-edited store must not take the panel down, and a
 * profile missing its resolution would move the projector to garbage.
 */
export function sanitizeVenues(raw: unknown): Venue[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isVenue)
}

/** Same name = same room: overwrite in place, so re-saving does not pile up. */
export function upsertVenue(list: Venue[], v: Venue): Venue[] {
  const i = list.findIndex(x => x.name.toLowerCase() === v.name.toLowerCase())
  if (i < 0) return [...list, v]
  const next = [...list]
  next[i] = v
  return next
}
