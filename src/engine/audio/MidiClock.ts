/**
 * MIDI clock: the tempo the mixer already knows.
 *
 * Everything else in this app guesses the tempo from the air — spectral flux,
 * autocorrelation, a PLL that nudges itself onto onsets. It works, and it is
 * still a guess. A CDJ, a mixer or Traktor sends the real thing down a cable
 * that has been open since v0.11: **24 ticks per quarter note**, plus start,
 * stop and a song-position pointer that says where in the bar we are.
 *
 * This is a pure parser — bytes and timestamps in, tempo and phase out, no
 * Web MIDI, no AudioContext, no DOM — so `scripts/check-midiclock.mjs` can
 * feed it a synthetic 128 BPM clock and assert on what comes back.
 *
 * It deliberately does **not** feed the PLL in `BeatTracker`. A clock that is
 * exact must not be pulled 35% towards whatever the hats did; when the clock
 * is running it owns phase outright and the tracker keeps doing the job only
 * it can do — per-band onsets.
 */

/** MIDI System Realtime status bytes. */
export const MIDI_CLOCK = 0xf8
export const MIDI_START = 0xfa
export const MIDI_CONTINUE = 0xfb
export const MIDI_STOP = 0xfc
/** System Common: song position pointer, 14 bits in units of a sixteenth note. */
export const MIDI_SONG_POSITION = 0xf2

const TICKS_PER_BEAT = 24
const TICKS_PER_SIXTEENTH = 6
const BEATS_PER_BAR = 4

/** No tick for this long and the transport is gone, whatever it last said. */
const SILENCE_MS = 1500

/** One beat of intervals: long enough to be steady, short enough to follow a nudge. */
const WINDOW = TICKS_PER_BEAT

export interface ClockState {
  /** The clock is ticking and its tempo is usable. */
  running: boolean
  bpm: number
  /** 0..1 inside the current beat, interpolated between ticks. */
  beatPhase: number
  /** 0..1 inside the current 4-beat bar. */
  barPhase: number
  /** True on the first read after a beat boundary went past. */
  beatDetected: boolean
}

export class MidiClock {
  /** Ticks since the last Start, or since the position the pointer gave us. */
  private ticks = 0
  private lastTickAt = 0
  private intervals: number[] = []
  private transportRunning = false
  private everStarted = false
  /** Beat boundaries crossed but not yet reported to a caller. */
  private pendingBeat = false

  /**
   * One MIDI status byte. `data1`/`data2` only matter for the song-position
   * pointer. `nowMs` is the event timestamp — pass the MIDI event's own
   * timestamp where the port provides one, since it is measured closer to the
   * wire than the moment JavaScript got round to the callback.
   */
  onByte(status: number, nowMs: number, data1 = 0, data2 = 0): void {
    switch (status) {
      case MIDI_CLOCK:
        if (!this.transportRunning) {
          // Many devices tick continuously and only send Start when the deck
          // rolls. A tick is enough to know the tempo, so take it.
          this.transportRunning = true
          this.everStarted = true
        }
        if (this.lastTickAt > 0) {
          const dt = nowMs - this.lastTickAt
          // A plausible tick sits between 300 and 40 BPM; anything else is a
          // dropped message or a stall, and averaging it in would poison the
          // tempo for a whole beat.
          if (dt > 8 && dt < 62) {
            this.intervals.push(dt)
            if (this.intervals.length > WINDOW) this.intervals.shift()
          } else {
            this.intervals = []
          }
        }
        this.lastTickAt = nowMs
        this.ticks++
        if (this.ticks % TICKS_PER_BEAT === 0) this.pendingBeat = true
        break

      case MIDI_START:
        this.ticks = 0
        this.pendingBeat = true      // Start *is* a downbeat
        this.transportRunning = true
        this.everStarted = true
        this.lastTickAt = 0
        break

      case MIDI_CONTINUE:
        this.transportRunning = true
        this.everStarted = true
        this.lastTickAt = 0
        break

      case MIDI_STOP:
        this.transportRunning = false
        break

      case MIDI_SONG_POSITION: {
        // 14-bit little-endian, in sixteenth notes from the top of the song.
        const sixteenths = (data2 << 7) | data1
        this.ticks = sixteenths * TICKS_PER_SIXTEENTH
        this.lastTickAt = 0
        break
      }
    }
  }

  /** Forget everything — a port closed, or the user switched away from MIDI. */
  reset(): void {
    this.ticks = 0
    this.lastTickAt = 0
    this.intervals = []
    this.transportRunning = false
    this.everStarted = false
    this.pendingBeat = false
  }

  /** Has this clock ever seen a tick? Used to offer the mode, not to trust it. */
  get seen(): boolean { return this.everStarted }

  /**
   * Pure: reading never changes the clock, so the tempo can be asked for from
   * anywhere. `beatDetected` stays true until someone calls `clearBeat()` —
   * exactly one caller per frame should, and that caller is the one driving
   * the visuals.
   */
  read(nowMs: number): ClockState {
    const bpm = this.tempo()
    const alive = this.transportRunning
      && bpm > 0
      && this.lastTickAt > 0
      && nowMs - this.lastTickAt < SILENCE_MS

    if (!alive) {
      return { running: false, bpm, beatPhase: 0, barPhase: 0, beatDetected: false }
    }

    const tickMs = 60000 / (bpm * TICKS_PER_BEAT)
    // Interpolate inside the tick we are in, so phase moves every frame at
    // 60 fps instead of stepping 24 times a beat.
    const within = Math.min(1, Math.max(0, (nowMs - this.lastTickAt) / tickMs))
    const tickPos = (this.ticks % TICKS_PER_BEAT) + within
    const beatPhase = (tickPos / TICKS_PER_BEAT) % 1
    const beatInBar = Math.floor(this.ticks / TICKS_PER_BEAT) % BEATS_PER_BAR

    return {
      running: true,
      bpm,
      beatPhase,
      barPhase: (beatInBar + beatPhase) / BEATS_PER_BAR,
      beatDetected: this.pendingBeat,
    }
  }

  /** Mark the reported beat as consumed, so it fires once and not every frame. */
  clearBeat(): void { this.pendingBeat = false }

  /** Median of the recent tick intervals — one late message must not move it. */
  private tempo(): number {
    if (this.intervals.length < 6) return 0
    const sorted = [...this.intervals].sort((a, b) => a - b)
    const mid = sorted.length >> 1
    const median = sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
    const bpm = 60000 / (median * TICKS_PER_BEAT)
    return bpm >= 40 && bpm <= 300 ? bpm : 0
  }
}
