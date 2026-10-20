import { COLOR_PRESETS } from './catalog'
import { readJson, writeJson } from './storage'
import { activePluginPalettes, onPlugins } from './plugins'

/**
 * The palettes the user can pick: the factory sixteen, then the ones they
 * made from a picture (Q2). One list, one index space, so the grid, the
 * cycle and the phone all agree on what "palette 18" is.
 */
export interface UserPalette { label: string; colors: [string, string, string] }

export const USER_PALETTES_KEY = 'djtographikz-user-palettes'
const MAX_USER = 16

let user: UserPalette[] = sanitize(readJson<unknown>(USER_PALETTES_KEY, []))
const listeners = new Set<() => void>()
// allPalettes() runs on every render of every grid: a fresh array each time
// was garbage plus an unstable identity for anything comparing it
let cache: ReturnType<typeof allPalettes> | null = null
const notify = () => { cache = null; for (const fn of listeners) fn() }

function sanitize(raw: unknown): UserPalette[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((p): p is UserPalette =>
    !!p && typeof p.label === 'string' && Array.isArray(p.colors) && p.colors.length === 3
    && p.colors.every((c: unknown) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))).slice(0, MAX_USER)
}

/** Le palette di fabbrica, le tue, poi quelle dei plugin attivi (`plugin: true`, sola lettura). */
export function allPalettes(): { label: string; colors: [string, string, string]; plugin?: true }[] {
  return cache ??= [...COLOR_PRESETS, ...user, ...activePluginPalettes()]
}

export function userPalettes(): UserPalette[] { return user }

export function addUserPalette(p: UserPalette): number {
  user = [...user, p].slice(-MAX_USER)
  writeJson(USER_PALETTES_KEY, user)
  notify()
  return COLOR_PRESETS.length + user.length - 1
}

export function removeUserPalette(index: number) {
  const i = index - COLOR_PRESETS.length
  if (i < 0 || i >= user.length) return
  user = user.filter((_, j) => j !== i)
  writeJson(USER_PALETTES_KEY, user)
  notify()
}

export function isUserPalette(index: number): boolean { return index >= COLOR_PRESETS.length && index < COLOR_PRESETS.length + user.length }

export function onPalettes(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

onPlugins(notify)

/** A File (drop or picker) → a 64x64 thumbnail's pixels, via the browser. */
export async function pixelsFromImageFile(file: File): Promise<Uint8ClampedArray> {
  const size = 64
  // decode straight to 64x64: a 6000x6000 flyer at full size is ~144 MB of
  // RGBA for a palette that only ever looks at the thumbnail. The aspect is
  // stretched exactly as the old drawImage(…, 64, 64) did.
  const bmp = await createImageBitmap(file, { resizeWidth: size, resizeHeight: size, resizeQuality: 'medium' })
  try {
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('canvas 2d non disponibile')
    ctx.drawImage(bmp, 0, 0, size, size)
    return ctx.getImageData(0, 0, size, size).data
  } finally {
    bmp.close()
  }
}
