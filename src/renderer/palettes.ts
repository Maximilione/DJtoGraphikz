import { COLOR_PRESETS } from './catalog'
import { readJson, writeJson } from './storage'

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

function sanitize(raw: unknown): UserPalette[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((p): p is UserPalette =>
    !!p && typeof p.label === 'string' && Array.isArray(p.colors) && p.colors.length === 3
    && p.colors.every((c: unknown) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))).slice(0, MAX_USER)
}

export function allPalettes(): { label: string; colors: [string, string, string] }[] {
  return [...COLOR_PRESETS, ...user]
}

export function userPalettes(): UserPalette[] { return user }

export function addUserPalette(p: UserPalette): number {
  user = [...user, p].slice(-MAX_USER)
  writeJson(USER_PALETTES_KEY, user)
  for (const fn of listeners) fn()
  return COLOR_PRESETS.length + user.length - 1
}

export function removeUserPalette(index: number) {
  const i = index - COLOR_PRESETS.length
  if (i < 0 || i >= user.length) return
  user = user.filter((_, j) => j !== i)
  writeJson(USER_PALETTES_KEY, user)
  for (const fn of listeners) fn()
}

export function isUserPalette(index: number): boolean { return index >= COLOR_PRESETS.length }

export function onPalettes(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** A File (drop or picker) → a 64x64 thumbnail's pixels, via the browser. */
export async function pixelsFromImageFile(file: File): Promise<Uint8ClampedArray> {
  const bmp = await createImageBitmap(file)
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, size, size)
  bmp.close()
  return ctx.getImageData(0, 0, size, size).data
}
