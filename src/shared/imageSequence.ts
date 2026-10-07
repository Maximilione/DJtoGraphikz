/**
 * Image sequences (a folder of numbered frames) — the pure part.
 *
 * Natural ordering, which frame to show for a given time or beat, and which
 * frames to keep decoded live here with no DOM, so `scripts/check-sequenza.mjs`
 * can assert on them. The Engine owns the decoding and the texture
 * (src/engine/SequencePlayer.ts); the main process uses the ordering.
 */

/** Hard ceiling of decoded frames kept in RAM; the rest streams via djg-media. */
export const SEQ_MAX_CACHED = 300
/** RAM budget for decoded bitmaps (RGBA): a 4K frame is 33 MB, so 4K keeps ~30. */
export const SEQ_BUDGET_BYTES = 1024 * 1024 * 1024
export const SEQ_DEFAULT_FPS = 30
/** Loop length choices for beat sync (0 = free-running at the chosen fps). */
export const SEQ_BEAT_CHOICES = [0, 1, 2, 4, 8, 16, 32]

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/** frame_2 before frame_10: digit runs compare as numbers. */
export function sortNatural(names: string[]): string[] {
  return [...names].sort((a, b) => collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0))
}

const mod = (n: number, m: number) => ((n % m) + m) % m

/** Free-running: frame at `elapsedMs` from the start, looping. */
export function frameAtTime(elapsedMs: number, fps: number, count: number): number {
  if (count <= 0) return 0
  return mod(Math.floor(Math.max(0, elapsedMs) / 1000 * (fps || SEQ_DEFAULT_FPS)), count)
}

/** One loop = `beatsPerLoop` beats, locked to the absolute beat grid (both windows agree). */
export function frameAtBeat(beatClock: number, beatsPerLoop: number, count: number): number {
  if (count <= 0 || !(beatsPerLoop > 0)) return 0
  return Math.min(count - 1, Math.floor(mod(beatClock / beatsPerLoop, 1) * count))
}

/** Deck B: like a video clip, the native BPM sets the speed (rate = live / native). */
export function frameAtDeck(beatClock: number, clipStartBeat: number, nativeBpm: number, fps: number, count: number): number {
  if (count <= 0) return 0
  const t = Math.max(0, beatClock - clipStartBeat) * 60 / (nativeBpm || 128)
  return mod(Math.floor(t * (fps || SEQ_DEFAULT_FPS)), count)
}

/** How many decoded frames fit: the frame cap, shrunk so w*h*4*n stays in budget (min 8). */
export function cacheCap(w: number, h: number, maxFrames = SEQ_MAX_CACHED, budget = SEQ_BUDGET_BYTES): number {
  const per = Math.max(1, w * h * 4)
  return Math.max(8, Math.min(maxFrames, Math.floor(budget / per)))
}

/**
 * Frames to hold decoded when `idx` is on screen, in load priority: the current
 * one, then the ones coming up (wrapping the loop), with a few kept behind.
 * A sequence that fits in the cap is kept whole.
 */
export function keepWindow(idx: number, count: number, cap: number): number[] {
  if (count <= 0) return []
  const n = Math.min(count, Math.max(1, cap))
  const behind = n >= count ? 0 : Math.min(4, n >> 3)
  const out: number[] = []
  for (let i = 0; i < n - behind; i++) out.push(mod(idx + i, count))
  for (let i = 1; i <= behind; i++) out.push(mod(idx - i, count))
  return out
}
