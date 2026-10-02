import type { Engine } from '@engine/Engine'
import type { Genre, Phase, Scene, SceneParam } from '@engine/AutoVJ'
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

export function loadUserScenes(): UserScene[] {
  const raw = readJson<unknown>(USER_SCENES_KEY, [])
  return Array.isArray(raw) ? raw.filter(isUserScene) : []
}

export function saveUserScenes(list: UserScene[]) {
  writeJson(USER_SCENES_KEY, list)
}

function isUserScene(x: unknown): x is UserScene {
  const s = x as UserScene
  return !!s && typeof s.id === 'string' && typeof s.effect === 'string'
    && typeof s.genre === 'string' && typeof s.phase === 'string' && Array.isArray(s.posts)
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
