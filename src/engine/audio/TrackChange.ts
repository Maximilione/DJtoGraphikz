/**
 * Track change: when did the DJ move to the next song?
 *
 * Two sources, one event stream, so the playlist can turn the page on it:
 *
 * - **Pro DJ Link** (`feedProLink`): the rekordbox id of the track on the
 *   master deck, from the status packets. Exact; a new id is a new track.
 * - **Audio heuristics** (`update`), for rooms with no CDJ on the network.
 *   Three signals, each a thing a mix does and a track does not:
 *   (a) a settled tempo that moves by more than 1.5 % and stays there 8 s;
 *   (b) a confident key that changes and holds 10 s;
 *   (c) a break of 20 s or more ending in a drop — the classic blend.
 *   One audio detection per minute at most: a mix changes track every 2–6
 *   minutes, and a second hit inside the minute is the same change heard
 *   twice. While Pro DJ Link is talking the audio side stays quiet for 30 s:
 *   it would only echo what the deck already said.
 *
 * Pure, clock in milliseconds (`performance.now()` in the app, the frame
 * clock in `scripts/check-phases.mjs`), so `scripts/check-trackchange.mjs`
 * can drive it with synthetic frames. The phase comes from the Auto VJ,
 * which tracks it with the Auto VJ on or off (`src/renderer/App.tsx` passes
 * it to the Engine every frame).
 */
import { keyName, type Key } from './KeyDetector'
import type { Phase } from '../AutoVJ'

export interface TrackChangeEvent {
  /** ms on the same clock as the frames fed in */
  at: number
  source: 'prolink' | 'audio'
  /** 'Pro DJ Link' | 'BPM 128 → 132' | 'tonalità Am → F#m' | 'drop dopo 24 s di pausa' */
  reason: string
  trackId?: number
}

export interface TrackChangeFrame {
  t: number
  bpm: number
  /** 0..1 — frames under 0.5 do not count for the tempo signal */
  bpmConfidence: number
  key: Key | null
  phase: Phase
}

// The thresholds, in one table so `scripts/check-phases.mjs --keyHoldMs 20000
// mix.mp3` can replay a recording with other values. On a hard tekno mix at a
// steady 136 the tempo and key estimates wobble by about these amounts (the
// ACF hunts between two neighbouring lags, the key between F and C), so the
// break → drop signal is the one to trust there; see the replay's output.
export const TRACK_CHANGE = {
  /** tempo must move by this fraction of the old one */
  bpmShift: 0.015,
  // 20 s, not 8: on a 15-minute hard tekno mix 8 s gave three tempo events
  // that were the estimator hunting, 20 s gave none and kept every drop
  bpmHoldMs: 20000,
  /** ...and the old one must have held this long first: an estimator hunting between two peaks is not news */
  bpmStableMs: 30000,
  /** the key analyser must stand this far above the runner-up; the tempo estimate too */
  keyConfidence: 0.5,
  keyHoldMs: 20000,
  /** a break shorter than this followed by a drop is the same track's drop */
  breakMinMs: 20000,
  audioCooldownMs: 60000,
  prolinkQuietMs: 30000,
}

const near = (a: number, b: number) => Math.abs(a - b) <= b * TRACK_CHANGE.bpmShift
const sameKey = (a: Key | null, b: Key | null) => !!a && !!b && a.tonic === b.tonic && a.mode === b.mode

export class TrackChangeDetector {
  private refBpm = 0
  private refBpmSince = 0
  private candBpm = 0
  private candBpmSince = 0
  private refKey: Key | null = null
  private candKey: Key | null = null
  private candKeySince = 0
  private lastPhase: Phase = 'groove'
  private pauseSince = -1
  private quietUntil = -Infinity
  private lastTrackId = 0
  /** the most recent event, for the panel */
  last: TrackChangeEvent | null = null

  /** Call every frame. Returns the event the frame produced, or null. */
  update(f: TrackChangeFrame): TrackChangeEvent | null {
    // all three run every frame: each keeps its own reference up to date
    const bpm = this.trackBpm(f)
    const key = this.trackKey(f)
    const drop = this.trackDrop(f)
    const reason = drop ?? bpm ?? key
    // a change that matured while quiet is absorbed: the reference moved, nobody is told
    if (!reason || f.t < this.quietUntil) return null
    this.quietUntil = f.t + TRACK_CHANGE.audioCooldownMs
    return (this.last = { at: f.t, source: 'audio', reason })
  }

  /** A status packet named this rekordbox id on the followed deck. 0 = nothing loaded. */
  feedProLink(trackId: number, t: number): TrackChangeEvent | null {
    if (!trackId || trackId === this.lastTrackId) return null
    this.lastTrackId = trackId
    this.quietUntil = Math.max(this.quietUntil, t + TRACK_CHANGE.prolinkQuietMs)
    return (this.last = { at: t, source: 'prolink', reason: 'Pro DJ Link', trackId })
  }

  private trackBpm(f: TrackChangeFrame): string | null {
    if (!(f.bpm > 0) || f.bpmConfidence < TRACK_CHANGE.keyConfidence) return null
    if (!this.refBpm) { this.refBpm = f.bpm; this.refBpmSince = f.t; return null }
    if (near(f.bpm, this.refBpm)) { this.candBpm = 0; return null }
    // ponytail: an octave flip (128 → 64) is the tracker misreading the same
    // tempo, not a new track; a real halftime switch is lost with it
    if (near(f.bpm, this.refBpm * 2) || near(f.bpm, this.refBpm / 2)) return null
    if (!this.candBpm || !near(f.bpm, this.candBpm)) { this.candBpm = f.bpm; this.candBpmSince = f.t; return null }
    if (f.t - this.candBpmSince < TRACK_CHANGE.bpmHoldMs) return null
    // the new tempo has held: it is the reference now. It is a track change
    // only if the old one had settled; an estimator still hunting is not news.
    const settled = this.candBpmSince - this.refBpmSince >= TRACK_CHANGE.bpmStableMs
    const reason = settled ? `BPM ${Math.round(this.refBpm)} → ${Math.round(f.bpm)}` : null
    this.refBpm = f.bpm
    this.refBpmSince = this.candBpmSince
    this.candBpm = 0
    return reason
  }

  private trackKey(f: TrackChangeFrame): string | null {
    const k = f.key && f.key.confidence >= TRACK_CHANGE.keyConfidence ? f.key : null
    if (!k) return null
    if (!this.refKey) { this.refKey = k; return null }
    if (sameKey(k, this.refKey)) { this.candKey = null; return null }
    if (!sameKey(k, this.candKey)) { this.candKey = k; this.candKeySince = f.t; return null }
    if (f.t - this.candKeySince < TRACK_CHANGE.keyHoldMs) return null
    const reason = `tonalità ${keyName(this.refKey)} → ${keyName(k)}`
    this.refKey = k
    this.candKey = null
    return reason
  }

  private trackDrop(f: TrackChangeFrame): string | null {
    const paused = f.phase === 'break' || f.phase === 'build'
    const wasPaused = this.lastPhase === 'break' || this.lastPhase === 'build'
    this.lastPhase = f.phase
    if (paused && !wasPaused) { this.pauseSince = f.t; return null }
    if (paused || !wasPaused) return null
    const held = this.pauseSince >= 0 ? f.t - this.pauseSince : 0
    this.pauseSince = -1
    return f.phase === 'peak' && held >= TRACK_CHANGE.breakMinMs ? `drop dopo ${Math.round(held / 1000)} s di pausa` : null
  }
}
