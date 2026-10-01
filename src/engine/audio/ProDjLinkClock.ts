/**
 * Pro DJ Link clock: the tempo the CDJs agree on.
 *
 * The main process listens on the booth LAN (`src/main/prodjlink.ts`) and
 * forwards one compact message per beat packet. This class turns that stream
 * into the same `ClockState` the MIDI clock produces, so `AudioAnalyzer`
 * treats both the same way: an exact grid that owns tempo and phase outright.
 *
 * Pure — messages and timestamps in, tempo and phase out — so
 * `scripts/check-prodjlink.mjs` can drive it with a synthetic deck.
 *
 * Which deck to follow: the one flagged **master** by its status packets.
 * Without that flag (status needs our announcement to get through; a switch
 * may filter it) we lock onto the first deck we hear and stay with it until
 * it falls silent — two decks beating at once must not make the visuals
 * flip-flop between them.
 */
import type { ClockState } from './MidiClock'

/** What main sends on 'prolink:beat' — see `LinkBeat` in src/main/prodjlink-packets.ts. */
export interface LinkBeatMsg {
  device: number
  name: string
  /** Effective BPM: track grid × pitch. */
  bpm: number
  pitch: number
  beatInBar: number
  /** Undefined until a status packet from this deck has been seen. */
  master?: boolean
}

export interface LinkDeviceMsg { device: number; name: string }

/** Two beats at 60 BPM with none heard: the deck stopped, or the cable did. */
const SILENCE_MS = 2500
const BEATS_PER_BAR = 4

export class ProDjLinkClock {
  /** Device number we follow; 0 until the first beat. */
  private source = 0
  private sourceName = ''
  private sourceMaster = false
  private lastBeatAt = 0
  private bpm = 0
  private beatInBar = 1
  private pendingBeat = false
  private everSeen = false
  /** Decks announced on the network, number → name. Fed by main's announcements and by beats. */
  readonly devices = new Map<number, string>()

  onBeat(b: LinkBeatMsg, nowMs: number): void {
    this.everSeen = true
    this.devices.set(b.device, b.name)
    const sourceAlive = this.source > 0 && nowMs - this.lastBeatAt < SILENCE_MS
    const follow = b.device === this.source || b.master === true || !sourceAlive
    if (!follow) return
    // A deck being scratched or nudged to a stop reports absurd tempi; a grid
    // outside 40..300 is not a tempo anyone dances to.
    if (!(b.bpm >= 40 && b.bpm <= 300)) return
    this.source = b.device
    this.sourceName = b.name
    this.sourceMaster = b.master === true
    this.lastBeatAt = nowMs
    this.bpm = b.bpm
    this.beatInBar = b.beatInBar
    this.pendingBeat = true
  }

  setDevices(list: LinkDeviceMsg[]): void {
    this.devices.clear()
    for (const d of list) this.devices.set(d.device, d.name)
  }

  /** Forget everything — the user switched the mode off. */
  reset(): void {
    this.source = 0
    this.sourceName = ''
    this.sourceMaster = false
    this.lastBeatAt = 0
    this.bpm = 0
    this.beatInBar = 1
    this.pendingBeat = false
    this.everSeen = false
    this.devices.clear()
  }

  /** Has a beat ever arrived this session? Used to offer the mode, not to trust it. */
  get seen(): boolean { return this.everSeen }

  /** "CDJ-2000NXS2 #1" — the deck the visuals follow, '' when none. */
  get sourceLabel(): string {
    return this.source ? `${this.sourceName || 'lettore'} #${this.source}${this.sourceMaster ? ' (master)' : ''}` : ''
  }

  /** Pure: reading never changes the clock. `beatDetected` holds until `clearBeat()`. */
  read(nowMs: number): ClockState {
    const since = nowMs - this.lastBeatAt
    const alive = this.bpm > 0 && this.lastBeatAt > 0 && since < SILENCE_MS
    if (!alive) return { running: false, bpm: this.bpm, beatPhase: 0, barPhase: 0, beatDetected: false }
    // Interpolate from the last beat; a late packet parks the phase just short
    // of the boundary rather than wrapping and faking a beat.
    const beatPhase = Math.min(0.999, Math.max(0, since / (60000 / this.bpm)))
    return {
      running: true,
      bpm: this.bpm,
      beatPhase,
      barPhase: ((this.beatInBar - 1) + beatPhase) / BEATS_PER_BAR,
      beatDetected: this.pendingBeat,
    }
  }

  /** Mark the reported beat as consumed, so it fires once and not every frame. */
  clearBeat(): void { this.pendingBeat = false }
}
