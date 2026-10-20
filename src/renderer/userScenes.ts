import type { Engine } from '@engine/Engine'
import { GENRE_CONFIGS, type Genre, type Phase, type Scene, type SceneParam } from '@engine/AutoVJ'
import { COMMON_PARAMS, EFFECT_PARAMS } from '@engine/EffectParams'
import { readJson, writeJson } from './storage'

/**
 * The user's own Auto VJ scenes (P4): a look captured from the engine with
 * the genre and the phase it belongs to. They join the factory rotation, or
 * replace it for the phases where the user has some ("solo le mie").
 */
export interface UserScene extends Scene {
  id: string
  genre: Genre
  name: string
  /** ISO date, when it was captured */
  savedAt: string
}

export const USER_SCENES_KEY = 'djtographikz-user-scenes'
export const ONLY_MINE_KEY = 'djtographikz-user-scenes-only'
/** Fired when something other than the Auto VJ panel (the phone) changed the scenes or the flag */
export const USER_SCENES_EVENT = 'djg:user-scenes'

// Both read once and kept: the phone's 1 s tick and every command used to
// parse the whole list (params included) just to count the scenes. The only
// writers are below, so the cache cannot go stale.
let cache: UserScene[] | null = null
let onlyMine: boolean | null = null

export function loadUserScenes(): UserScene[] {
  if (!cache) {
    const raw = readJson<unknown>(USER_SCENES_KEY, [])
    cache = Array.isArray(raw) ? raw.filter(isUserScene) : []
  }
  return cache
}

/** false = not written (quota): the caller must not hand the list to the Auto VJ as if it were saved. */
export function saveUserScenes(list: UserScene[]): boolean {
  if (!writeJson(USER_SCENES_KEY, list)) return false
  cache = list
  return true
}

/** "Solo le mie": the flag the Auto VJ panel and the phone share. */
export function getOnlyMine(): boolean {
  if (onlyMine === null) onlyMine = readJson<unknown>(ONLY_MINE_KEY, false) === true
  return onlyMine
}

export function setOnlyMine(on: boolean): boolean {
  onlyMine = on
  return writeJson(ONLY_MINE_KEY, on)
}

const PHASES = new Set<string>(['break', 'build', 'groove', 'peak'])

/**
 * A scene as this app writes it. A hand-edited or half-written one used to
 * reach setEffect on the wall; now it is dropped on load. The effect id is not
 * checked against the catalog on purpose: plugin effects register at runtime.
 */
function isUserScene(x: unknown): x is UserScene {
  const s = x as UserScene
  return !!s && typeof s === 'object'
    && typeof s.id === 'string' && typeof s.effect === 'string'
    && typeof s.genre === 'string' && s.genre in GENRE_CONFIGS
    && typeof s.phase === 'string' && PHASES.has(s.phase)
    && Array.isArray(s.posts) && s.posts.every(p => typeof p === 'string')
    && (s.params === undefined || (!!s.params && typeof s.params === 'object' && !Array.isArray(s.params)))
}

/** The current look as a scene: effect, every curated param with its mapping, the post chain. */
export function sceneFromLook(engine: Engine, genre: Genre, phase: Phase, name?: string): UserScene {
  const effect = engine.getCurrentEffect()
  const params: Record<string, SceneParam> = {}
  for (const def of [...COMMON_PARAMS, ...(EFFECT_PARAMS[effect] ?? [])]) {
    const st = engine.getParamState(def.key)
    params[def.key] = st.source && st.source !== 'none'
      ? { value: st.value, source: st.source, depth: st.depth, lfoRate: st.lfoRate }
      : { value: st.value }
  }
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    genre, phase, effect, params,
    posts: engine.getActivePosts(),
    name: name?.trim() || effect,
    savedAt: new Date().toISOString(),
  }
}

/** Grouped the way the Auto VJ wants them */
export function userScenesByGenre(list: UserScene[]): Partial<Record<Genre, Scene[]>> {
  const out: Partial<Record<Genre, Scene[]>> = {}
  for (const s of list) (out[s.genre] ??= []).push({ effect: s.effect, phase: s.phase, posts: s.posts, params: s.params })
  return out
}
