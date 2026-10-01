/**
 * Sequences: an ordered list of saved looks, each held for its own time.
 *
 * This replaces the old playlist, which kept one interval for the whole list —
 * you could not say "this one for 16 beats, the next for 64" — and could only
 * ever be built, never reopened. Old playlists still load: migrate() turns them
 * into sequences whose steps all inherit the list-wide interval.
 */
import type { Preset, TransitionType, GifSyncMode } from '@engine/Engine'

/**
 * A graphic that comes up with a step: image, GIF (an image with gifSync) or
 * text. Images point at the media library (`path`) so the sequence stays small
 * in storage; `dataUrl` is honoured too for sequences imported from elsewhere.
 */
export interface StepOverlay {
  kind: 'image' | 'gif' | 'text'
  name: string
  dataUrl?: string
  path?: string
  text?: string
  color?: string
  opacity: number
  scale: number
  offsetX: number
  offsetY: number
  gifSync?: GifSyncMode
}

export interface SequenceStep {
  name: string
  preset: Preset
  thumb?: string
  /** Held for this many seconds (mode 'timer') or beats (mode 'beats') */
  hold: number
  /** Transition INTO this step; undefined = leave whatever is set globally */
  transition?: TransitionType
  /** Graphics shown for this step only; absent = no sequence graphics */
  overlays?: StepOverlay[]
}

/**
 * timer/beats advance on their own; 'track' waits for the next song, 'manual'
 * only moves with Avanti/Indietro. The last two ignore `hold`.
 */
export type SequenceMode = 'timer' | 'beats' | 'track' | 'manual'

export interface Sequence {
  name: string
  steps: SequenceStep[]
  loop: boolean
  mode: SequenceMode
  /** Hold given to newly added steps */
  defaultHold: number
}

/** Anything that has ever been written to storage, old shapes included */
type StoredSequence = Partial<Sequence> & {
  presets?: Preset[]
  advanceMode?: 'timer' | 'beats'
  advanceInterval?: number
}

const TIMER_LIMITS = { min: 1, max: 120, unit: 's' } as const
export const HOLD_LIMITS: Record<SequenceMode, { min: number; max: number; unit: string }> = {
  timer: TIMER_LIMITS,
  beats: { min: 1, max: 128, unit: 'b' },
  // hold is ignored in these modes but is kept (clamped as seconds) so
  // switching back to Secondi does not lose what the user typed
  track: TIMER_LIMITS,
  manual: TIMER_LIMITS,
}

export const MODE_LABELS: Record<SequenceMode, string> = {
  timer: 'Secondi', beats: 'Beat', track: 'Canzone', manual: 'Manuale',
}

const MODES = new Set<string>(Object.keys(MODE_LABELS))

/** Does this mode advance by itself after `hold`? */
export function usesHold(mode: SequenceMode): boolean {
  return mode === 'timer' || mode === 'beats'
}

export function clampHold(hold: number, mode: SequenceMode): number {
  const { min, max } = HOLD_LIMITS[mode]
  if (!Number.isFinite(hold)) return min
  return Math.min(max, Math.max(min, Math.round(hold)))
}

/** One stored entry → a sequence, whatever version wrote it */
export function migrate(raw: StoredSequence): Sequence {
  const stored = raw.mode ?? raw.advanceMode
  const mode: SequenceMode = stored && MODES.has(stored) ? stored : 'timer'
  const defaultHold = clampHold(raw.defaultHold ?? raw.advanceInterval ?? 8, mode)
  const steps: SequenceStep[] = raw.steps?.length
    ? raw.steps.map(s => ({ ...s, hold: clampHold(s.hold ?? defaultHold, mode) }))
    // legacy playlist: every preset held for the one list-wide interval
    : (raw.presets ?? []).map(p => ({ name: p.name, preset: p, hold: defaultHold }))
  return {
    name: raw.name ?? 'Senza nome',
    steps,
    loop: raw.loop ?? true,
    mode,
    defaultHold,
  }
}

export function migrateAll(raw: unknown): Sequence[] {
  return Array.isArray(raw) ? raw.filter(r => r && typeof r === 'object').map(migrate) : []
}

/**
 * Index of the step after `i`. Returns -1 when a non-looping sequence is over,
 * which is what tells the player to stop.
 */
export function nextIndex(i: number, length: number, loop: boolean): number {
  if (length === 0) return -1
  const next = i + 1
  if (next < length) return next
  return loop ? 0 : -1
}

/** Index of the step before `i`; a non-looping sequence stays on the first */
export function prevIndex(i: number, length: number, loop: boolean): number {
  if (length === 0) return -1
  const prev = i - 1
  if (prev >= 0) return prev
  return loop ? length - 1 : 0
}

/** Move a step, returning a new array — used by the drag&drop reorder */
export function moveStep(steps: SequenceStep[], from: number, to: number): SequenceStep[] {
  if (from === to || from < 0 || to < 0 || from >= steps.length || to >= steps.length) return steps
  const next = [...steps]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * Where the sequence being edited ends up after another one is deleted.
 * Deleting an entry BEFORE it shifts every later index down by one: keeping the
 * old index would make the next save overwrite somebody else's sequence.
 * -1 means "the edited one is the one that just went away".
 */
export function indexAfterRemoval(editing: number, removed: number): number {
  if (editing < 0 || editing === removed) return -1
  return editing > removed ? editing - 1 : editing
}

/** Total run time, in seconds for 'timer' or beats for 'beats' */
export function totalHold(seq: Sequence): number {
  return seq.steps.reduce((n, s) => n + s.hold, 0)
}
