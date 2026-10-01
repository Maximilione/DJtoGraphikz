import { readJson, writeJson } from './storage'
import type { EffectId } from '@engine/Engine'

/**
 * Idle on silence (S5). The analyser's noise gate already says when there is
 * no music; this is the policy: after `seconds` of nothing, the wall fades to
 * a calm look instead of holding a frozen frame or a pattern gone wild on
 * noise, and comes back on its own when the music does.
 *
 * Pure timing here, so the check can run it with a fake clock. The Auto VJ
 * owns the picture when it is on (silence is a break there), so the caller
 * only applies this with the Auto VJ off.
 */
export interface IdleSettings {
  enabled: boolean
  seconds: number
  effect: EffectId
}

export const IDLE_KEY = 'djtographikz-idle'
export const IDLE_DEFAULTS: IdleSettings = { enabled: true, seconds: 12, effect: 'caustics' }

const listeners = new Set<(s: IdleSettings) => void>()

export function loadIdleSettings(): IdleSettings {
  const raw = readJson<Partial<IdleSettings>>(IDLE_KEY, {})
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : IDLE_DEFAULTS.enabled,
    seconds: typeof raw.seconds === 'number' && raw.seconds >= 3 && raw.seconds <= 120 ? Math.round(raw.seconds) : IDLE_DEFAULTS.seconds,
    effect: typeof raw.effect === 'string' ? raw.effect as EffectId : IDLE_DEFAULTS.effect,
  }
}

export function saveIdleSettings(s: IdleSettings) {
  writeJson(IDLE_KEY, s)
  for (const fn of listeners) fn(s)
}

export function onIdleSettings(fn: (s: IdleSettings) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Sound is anything above the analyser's gate; a few frames of noise do not count as music coming back. */
export const SOUND_HOLD_MS = 600

export class IdleWatch {
  private silentSince = -1
  private soundSince = -1
  private idle = false

  constructor(private seconds: number) {}

  setSeconds(s: number) { this.seconds = s }
  isIdle(): boolean { return this.idle }
  reset() { this.silentSince = -1; this.soundSince = -1; this.idle = false }

  /** `sound` = the analyser heard music this frame. Returns the transition, if any. */
  update(sound: boolean, t: number): 'enter' | 'exit' | null {
    if (sound) {
      this.silentSince = -1
      if (this.soundSince < 0) this.soundSince = t
      if (this.idle && t - this.soundSince >= SOUND_HOLD_MS) { this.idle = false; return 'exit' }
      return null
    }
    this.soundSince = -1
    if (this.silentSince < 0) this.silentSince = t
    if (!this.idle && t - this.silentSince >= this.seconds * 1000) { this.idle = true; return 'enter' }
    return null
  }
}
