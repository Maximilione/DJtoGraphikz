/**
 * The saved looks — one store, used by both the Look Bank (16 trigger slots)
 * and the sequences that play them back in order. They used to be two parallel
 * ideas: the Look Bank had names and thumbnails, playlists kept their own
 * copies of presets with neither.
 */
import type { Engine, Preset } from '@engine/Engine'
import { readJson, readString, writeJson, writeString } from './storage'

export interface SavedLook {
  name: string
  preset: Preset
  thumb: string // small JPEG dataURL, '' if capture failed
}

const STORAGE_KEY = 'djtographikz-looks'
export const SLOTS = 16

// The parsed bank, keyed on the raw string it came from. A look trigger from
// MIDI or the phone used to JSON.parse the whole bank — sixteen base64 thumbs,
// 100-200 KB — on the thread that drives the frame, right at the change of
// look. Keying on the raw string (one getItem + compare, no parse) keeps the
// cache honest if anything else ever writes the key.
let cacheRaw: string | null | undefined
let cache: (SavedLook | null)[] = []

/** A slot as this app writes it; anything else becomes an empty slot instead of a crash in applyPreset. */
function isLook(x: unknown): x is SavedLook {
  const l = x as SavedLook
  return !!l && typeof l === 'object' && typeof l.name === 'string'
    && !!l.preset && typeof l.preset === 'object' && !Array.isArray(l.preset)
}

function readBank(): (SavedLook | null)[] {
  const raw = readJson<unknown>(STORAGE_KEY, [])
  if (Array.isArray(raw)) return raw.map(l => (isLook(l) ? l : null))
  // valid JSON, wrong shape ('null', an object): with `null` the old code
  // threw in the panel initializer, with an object it read an empty bank and
  // the next save erased the user's data. Park it like a parse error.
  if (raw !== null && raw !== undefined) {
    writeString(`${STORAGE_KEY}.rotto`, JSON.stringify(raw))
    console.error(`[looks] ${STORAGE_KEY} non e' una lista — spostato in ${STORAGE_KEY}.rotto`)
  }
  return []
}

export function loadLooks(): (SavedLook | null)[] {
  const raw = readString(STORAGE_KEY)
  if (raw !== cacheRaw) {
    const arr = readBank()
    // Pad to SLOTS, never truncate: reading with a smaller SLOTS and saving used
    // to erase every slot beyond it, permanently.
    const n = Math.max(SLOTS, arr.length)
    cache = Array.from({ length: n }, (_, i) => arr[i] ?? null)
    cacheRaw = raw
  }
  // callers mutate what they get (LookBank, factoryLooks): hand out a copy
  return cache.slice()
}

/** One slot without copying the bank — for the triggers (MIDI, pad, phone, keys). */
export function getLook(i: number): SavedLook | null {
  loadLooks()
  return cache[i] ?? null
}

/** Returns false when the write did not happen — see storage.ts. */
export function persistLooks(looks: (SavedLook | null)[]): boolean {
  if (!writeJson(STORAGE_KEY, looks)) return false
  cache = looks.slice()
  cacheRaw = JSON.stringify(looks)   // a save is not hot: the trigger path is
  return true
}

/** Grab the next rendered frame and downscale it to a 160x90 JPEG dataURL */
export async function makeThumb(engine: Engine): Promise<string> {
  try {
    const blob = await engine.screenshot()
    if (!blob) return ''
    // decode already downscaled: the screenshot is at output resolution
    // (~33 MB RGBA at 4K) and only ever gets drawn at 160x90
    const bmp = await createImageBitmap(blob, { resizeWidth: 160, resizeHeight: 90, resizeQuality: 'medium' })
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 160
      canvas.height = 90
      const ctx = canvas.getContext('2d')
      if (!ctx) return ''
      ctx.drawImage(bmp, 0, 0, 160, 90)
      return canvas.toDataURL('image/jpeg', 0.7)
    } finally {
      bmp.close()
    }
  } catch {
    return ''
  }
}
