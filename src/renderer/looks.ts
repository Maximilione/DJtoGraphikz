/**
 * The saved looks — one store, used by both the Look Bank (16 trigger slots)
 * and the sequences that play them back in order. They used to be two parallel
 * ideas: the Look Bank had names and thumbnails, playlists kept their own
 * copies of presets with neither.
 */
import type { Engine, Preset } from '@engine/Engine'
import { readJson, writeJson } from './storage'

export interface SavedLook {
  name: string
  preset: Preset
  thumb: string // small JPEG dataURL, '' if capture failed
}

const STORAGE_KEY = 'djtographikz-looks'
export const SLOTS = 16

export function loadLooks(): (SavedLook | null)[] {
  const arr = readJson<(SavedLook | null)[]>(STORAGE_KEY, [])
  // Pad to SLOTS, never truncate: reading with a smaller SLOTS and saving used
  // to erase every slot beyond it, permanently.
  const n = Math.max(SLOTS, arr.length)
  return Array.from({ length: n }, (_, i) => arr[i] ?? null)
}

/** Returns false when the write did not happen — see storage.ts. */
export function persistLooks(looks: (SavedLook | null)[]): boolean {
  return writeJson(STORAGE_KEY, looks)
}

/** Grab the next rendered frame and downscale it to a 160x90 JPEG dataURL */
export async function makeThumb(engine: Engine): Promise<string> {
  try {
    const blob = await engine.screenshot()
    if (!blob) return ''
    const bmp = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 90
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, 160, 90)
    bmp.close()
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    return ''
  }
}
