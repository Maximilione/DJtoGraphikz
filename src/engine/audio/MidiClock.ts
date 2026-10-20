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
  /**
   * Ticks received since the last Start, or since the position the pointer
   * gave us — so the next tick to arrive has index `ticks`, and the first one
   * after Start is index 0, the downbeat itself.
   */
  private ticks = 0
  private lastTickAt = 0
  private intervals: number[] = []
  /** Tempo from the intervals, recomputed only when they change: read() is called several times a frame. */
  private bpmCache = 0
  /** Consecutive implausible intervals: one is a burst or a GC pause, a run is a real stall. */
  private badRun = 0
  private transportRunning = false
  /**
   * The transport said Stop. CDJs, mixers and Traktor keep ticking through a
   * stop, and a tick alone must not turn it back on — only Start or Continue.
   */
  private stopped = false
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
        if (!this.transportRunning && !this.stopped) {
          // Many devices tick continuously and only send Start when the deck
          // rolls. A tick is enough to know the tempo, so take it.
          this.transportRunning = true
          this.everStarted = true
        }
        if (this.lastTickAt > 0) {
          const dt = nowMs - this.lastTickAt
          // A plausible tick sits between 300 and 40 BPM; anything else is a
          // dropped message or a stall, and averaging it in would poison the
          // tempo for a whole beat. One outlier is skipped (the median would
          // not have moved anyway); a run of them means the clock really
          // stopped, and the window starts over.
          if (dt > 8 && dt < 62) {
            this.intervals.push(dt)
            if (this.intervals.length > WINDOW) this.intervals.shift()
            this.badRun = 0
            this.bpmCache = this.computeTempo()
          } else if (++this.badRun > 3) {
            this.intervals.length = 0
            this.badRun = 0
            this.bpmCache = 0
          }
        }
        this.lastTickAt = nowMs
        // This tick is index `ticks`: the 25th one (index 24) opens beat 2.
        // Index 0 is the beat Start already announced.
        if (this.ticks > 0 && this.ticks % TICKS_PER_BEAT === 0) this.pendingBeat = true
        this.ticks++
        break

      case MIDI_START:
        this.ticks = 0
        this.pendingBeat = true      // Start *is* a downbeat
        this.transportRunning = true
        this.stopped = false
        this.everStarted = true
        this.lastTickAt = 0
        this.badRun = 0
        break

      case MIDI_CONTINUE:
        this.transportRunning = true
        this.stopped = false
        this.everStarted = true
        this.lastTickAt = 0
        this.badRun = 0
        break

      case MIDI_STOP:
        this.transportRunning = false
        this.stopped = true
        // a beat crossed just before Stop must not fire on Continue
        this.pendingBeat = false
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
    this.bpmCache = 0
    this.badRun = 0
    this.transportRunning = false
    this.stopped = false
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
    const bpm = this.bpmCache
    const alive = this.transportRunning
      && bpm > 0
      && this.lastTickAt > 0
      && nowMs - this.lastTickAt < SILENCE_MS

    if (!alive) {
      return { running: false, bpm, beatPhase: 0, barPhase: 0, beatDetected: false }
    }

    const tickMs = 60000 / (bpm * TICKS_PER_BEAT)
    // Interpolate inside the tick we are in, so phase moves every frame at
    // 60 fps instead of stepping 24 times a beat. The tick we are in is the
    // last one received, index ticks - 1.
    const within = Math.min(1, Math.max(0, (nowMs - this.lastTickAt) / tickMs))
    const idx = Math.max(0, this.ticks - 1)
    const tickPos = (idx % TICKS_PER_BEAT) + within
    const beatPhase = (tickPos / TICKS_PER_BEAT) % 1
    const beatInBar = Math.floor(idx / TICKS_PER_BEAT) % BEATS_PER_BAR

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
  private computeTempo(): number {
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
