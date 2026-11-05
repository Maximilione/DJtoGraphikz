import type { EffectId } from '@engine/Engine'
import { GENRE_CONFIGS, type Genre, type Phase } from '@engine/AutoVJ'
import { ALL_EFFECTS } from './catalog'
import { readJson, writeJson } from './storage'

/**
 * The three rows above the effect grid: "Adatti ora" (what the Auto VJ scenes
 * of the current genre use in the current phase), favourites and recents.
 * Module state with listeners, like fxThumbs: App feeds the context, any grid
 * subscribes, nothing is threaded through the panels.
 */

const FAVS_KEY = 'djtographikz-fx-favs'
const RECENT_KEY = 'djtographikz-fx-recent'
export const RECENT_MAX = 8

const KNOWN = new Set<string>(ALL_EFFECTS.map(fx => fx.id))
/** Stored lists are user data: unknown ids (an effect since removed), duplicates and junk drop out. */
export function cleanIds(raw: unknown, max = Infinity): EffectId[] {
  if (!Array.isArray(raw)) return []
  const out: EffectId[] = []
  for (const id of raw) if (typeof id === 'string' && KNOWN.has(id) && !out.includes(id as EffectId)) out.push(id as EffectId)
  return out.slice(0, max)
}

let favs = cleanIds(readJson<unknown>(FAVS_KEY, []))
let recent = cleanIds(readJson<unknown>(RECENT_KEY, []), RECENT_MAX)
let genre: Genre | null = null
let phase: Phase = 'groove'

const listeners = new Set<() => void>()
const notify = () => listeners.forEach(fn => fn())
export function onPicks(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export const getFavs = (): EffectId[] => favs
export const isFav = (id: string): boolean => favs.includes(id as EffectId)
export const getRecent = (): EffectId[] => recent

export function toggleFav(id: EffectId) {
  if (!KNOWN.has(id)) return
  favs = isFav(id) ? favs.filter(f => f !== id) : [...favs, id]
  writeJson(FAVS_KEY, favs)
  notify()
}

/** A manual pick (grid, 1-0, phone): newest first, no repeats. */
export function noteRecent(id: EffectId) {
  if (!KNOWN.has(id) || recent[0] === id) return
  recent = [id, ...recent.filter(r => r !== id)].slice(0, RECENT_MAX)
  writeJson(RECENT_KEY, recent)
  notify()
}

export function setPickContext(g: Genre, p: Phase) {
  if (g === genre && p === phase) return
  genre = g; phase = p
  notify()
}

export const getPhase = (): Phase => phase

/** Effects the genre's built-in scenes put on screen in the current phase, scene order. */
export function suggestedNow(): EffectId[] {
  const cfg = genre ? GENRE_CONFIGS[genre] : null
  return cleanIds(cfg ? cfg.scenes.filter(s => s.phase === phase).map(s => s.effect) : [])
}
