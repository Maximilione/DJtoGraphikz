/**
 * The saved looks — one store, used by both the Look Bank (16 trigger slots)
 * and the sequences that play them back in order. They used to be two parallel
 * ideas: the Look Bank had names and thumbnails, playlists kept their own
 * copies of presets with neither.
 */
import type { Engine, Preset } from '@engine/Engine'

export interface SavedLook {
  name: string
  preset: Preset
  thumb: string // small JPEG dataURL, '' if capture failed
}

const STORAGE_KEY = 'djtographikz-looks'
export const SLOTS = 16

export function loadLooks(): (SavedLook | null)[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const arr: (SavedLook | null)[] = raw ? JSON.parse(raw) : []
    return Array.from({ length: SLOTS }, (_, i) => arr[i] ?? null)
  } catch {
    return Array(SLOTS).fill(null)
  }
}

export function persistLooks(looks: (SavedLook | null)[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(looks)) } catch {}
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
