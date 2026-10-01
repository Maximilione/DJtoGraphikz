/**
 * Deck B as a playlist of video clips (Q4) — the pure part.
 *
 * Which clip plays, when it changes and how fast it runs are decided here
 * with no DOM and no three.js, so `scripts/check-videodeck.mjs` can assert on
 * them. The Engine owns the <video>, the VideoTexture and the blit into the
 * deck B target; the output window mirrors `clip` + `clipStartBeat` from the
 * state snapshot and seeks its own <video> to `clipTime()`.
 *
 * Honest limit: Chromium decodes H.264 mp4, webm (VP8/VP9/AV1) and mov only
 * when it carries H.264 — not HAP, not ProRes, i.e. not the formats commercial
 * VJ packs ship in. Those need a conversion upstream (ffmpeg -c:v libx264).
 */

export interface VideoClip {
  path: string
  name: string
  /** BPM the clip was cut at: playbackRate = live BPM / this. */
  bpm: number
}

export interface VideoDeck {
  /** false = deck B is the GLSL effect, as before */
  enabled: boolean
  clips: VideoClip[]
  /** change clip every N bars (barPhase wraps 1 → 0) */
  barsPerClip: number
  /** index into clips */
  clip: number
  /** beatClock when the current clip started — the output seeks from this */
  clipStartBeat: number
  /** bars elapsed on the current clip (control window only; harmless in the snapshot) */
  bars: number
}

export const VIDEO_DECK_DEFAULT: VideoDeck = { enabled: false, clips: [], barsPerClip: 4, clip: 0, clipStartBeat: 0, bars: 0 }
export const BARS_PER_CLIP_CHOICES = [1, 2, 4, 8, 16]

/** What the <video> can realistically decode — see the header. */
export function acceptsVideo(name: string): boolean {
  return /\.(mp4|m4v|webm|mov)$/i.test(name)
}

/** Chromium throws outside 0.0625..16; a silent clip at 128 over a 64 BPM edit is 2x. */
export function playbackRate(bpm: number, nativeBpm: number): number {
  const r = (bpm || 128) / (nativeBpm || 128)
  return Math.min(16, Math.max(0.0625, r))
}

/** barPhase is a sawtooth 0..1: a drop of more than half a bar is the wrap. */
export function barWrapped(prevPhase: number, phase: number): boolean {
  return prevPhase - phase > 0.5
}

/**
 * One bar has just closed. Advances to the next clip (wrapping to 0) on the
 * Nth bar, otherwise just counts. Pure: returns the new deck, never mutates.
 */
export function onBar(deck: VideoDeck, beatClock: number): VideoDeck {
  if (!deck.enabled || deck.clips.length === 0) return deck
  const bars = deck.bars + 1
  if (bars < Math.max(1, deck.barsPerClip)) return { ...deck, bars }
  return { ...deck, bars: 0, clip: (deck.clip + 1) % deck.clips.length, clipStartBeat: beatClock }
}

/**
 * Where the clip should be, in media seconds, given the beat grid.
 * elapsedBeats × 60/bpm wall seconds × (bpm/nativeBpm) rate = elapsedBeats × 60/nativeBpm:
 * the live BPM cancels out, so both windows agree even if they read it a frame apart.
 */
export function clipTime(beatClock: number, clipStartBeat: number, nativeBpm: number, duration: number): number {
  if (!(duration > 0)) return 0
  const t = Math.max(0, beatClock - clipStartBeat) * 60 / (nativeBpm || 128)
  return t % duration
}

/** Distance between two positions on a looping clip (the wrap is not a drift). */
export function loopDrift(current: number, want: number, duration: number): number {
  const d = Math.abs(current - want)
  return duration > 0 ? Math.min(d, duration - d) : d
}

/** Keep `clip` meaningful after the list changes (removals, clears). */
export function clampClip(deck: VideoDeck): VideoDeck {
  const clip = deck.clips.length === 0 ? 0 : Math.min(deck.clip, deck.clips.length - 1)
  return clip === deck.clip ? deck : { ...deck, clip }
}
