// Pure-DSP beat tracking: onset detection, tempo estimation, phase locking.
// No Web Audio here — it eats spectrum frames, so it can be unit-tested with
// synthetic patterns. AudioAnalyzer owns the plumbing and delegates to this.

export interface BeatFrame {
  /** onset strength this frame (already log-compressed spectral flux) */
  flux: number
  /** true on the frame a beat is confirmed (one frame after its peak) */
  beat: boolean
  /** 0..1 position in the current beat (phase-locked, never hard-snapped when locked) */
  beatPhase: number
  /** 0..1 position in the current 4-beat bar (downbeat auto-estimated) */
  barPhase: number
  /** own tempo estimate from autocorrelation, 0 until confident */
  acfBpm: number
  /** 0..1 confidence of acfBpm */
  acfConfidence: number
}

const HISTORY = 80              // ~1.3s of flux history for the threshold
const ENV_SIZE = 512            // ~8.5s onset envelope for tempo autocorrelation
const BPM_MIN = 70
const BPM_MAX = 190

/** median of a small array (copies + sorts — fine at 60Hz sizes) */
function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export class BeatTracker {
  private fluxHistory: number[] = []
  private f1 = 0                       // flux one frame ago (peak-picking)
  private f2 = 0                       // flux two frames ago
  private prevLogSpec: Float32Array = new Float32Array(0)

  // Onset envelope ring for tempo autocorrelation
  private env = new Float32Array(ENV_SIZE)
  private envPos = 0
  private envFrames = 0
  private frameDtMs = 16.7             // measured average frame interval
  private acfCountdown = 30

  acfBpm = 0
  acfConfidence = 0

  // Phase-locked loop
  private phase = 0
  private beatIndex = 0
  private lastBeatAt = 0
  private lastTime = 0

  // Downbeat: onset strength accumulated per beat slot; strongest slot = 1
  private slotStrength = [0, 0, 0, 0]
  private beatsSinceRotate = 0

  // Anti-phase evidence: if the strong onsets keep landing at phase 0.5 the
  // PLL locked on the offbeat (hats) — flip half a period
  private gridEvidence = 0
  private antiEvidence = 0

  /** external tempo (library/manual) the PLL free-runs on; 0 = unknown */
  externalBpm = 0
  sensitivity = 1.4

  reset() {
    this.fluxHistory = []
    this.f1 = this.f2 = 0
    this.prevLogSpec = new Float32Array(0)
    this.env.fill(0)
    this.envPos = 0
    this.envFrames = 0
    this.acfBpm = 0
    this.acfConfidence = 0
    this.phase = 0
    this.beatIndex = 0
    this.lastBeatAt = 0
    this.slotStrength = [0, 0, 0, 0]
  }

  /** Best tempo this tracker knows: caller's external BPM wins when the ACF agrees or is unsure */
  bpm(): number {
    if (this.externalBpm > 0) return this.externalBpm
    return this.acfConfidence > 0.5 ? this.acfBpm : 0
  }

  /**
   * Feed one spectrum frame (0..1 magnitudes). Returns the beat state.
   * `nowMs` is the caller's clock; frames are assumed roughly regular.
   */
  update(spectrum: ArrayLike<number>, binHz: number, nowMs: number, bandFluxOut?: number[], active = true): BeatFrame {
    const n = spectrum.length
    if (this.prevLogSpec.length !== n) this.prevLogSpec = new Float32Array(n)

    // --- onset strength: positive log-magnitude flux, kick-weighted ---
    // log compression makes the flux level-independent: a quiet club feed and
    // a hot line-in produce comparable onset curves
    let flux = 0
    let lowFlux = 0
    for (let i = 0; i < n; i++) {
      const curr = Math.log1p((spectrum[i] as number) * 8)
      const diff = curr - this.prevLogSpec[i]
      if (diff > 0) {
        const w = i < n / 8 ? 3.0 : i < n / 4 ? 2.0 : i < n / 2 ? 1.0 : 0.5
        flux += diff * w
        const hz = i * binHz
        if (hz < 250) lowFlux += diff
        if (bandFluxOut) {
          if (hz >= 500 && hz < 2000) bandFluxOut[1] += diff
          else if (hz >= 4000 && hz < 12000) bandFluxOut[2] += diff
          else if (hz < 250) bandFluxOut[0] += diff
        }
      }
      this.prevLogSpec[i] = curr
    }
    flux /= n
    lowFlux /= n

    // --- timing ---
    const dt = this.lastTime ? Math.min(nowMs - this.lastTime, 500) : 16.7
    this.lastTime = nowMs
    this.frameDtMs = this.frameDtMs * 0.98 + dt * 0.02

    // silence: keep the spectra fresh but detect nothing and learn no tempo
    if (!active) {
      this.f2 = this.f1
      this.f1 = flux
      return { flux, beat: false, beatPhase: this.phase, barPhase: (this.beatIndex + this.phase) / 4, acfBpm: this.acfBpm, acfConfidence: this.acfConfidence }
    }

    // --- onset envelope for tempo ---
    // tempo from the kick band only — hats at half-period create 3:2 aliases
    this.env[this.envPos] = lowFlux
    this.envPos = (this.envPos + 1) % ENV_SIZE
    this.envFrames++
    if (--this.acfCountdown <= 0) {
      this.acfCountdown = 30
      this.estimateTempo()
    }

    // --- adaptive threshold: median + MAD (robust to build-ups and outliers) ---
    this.fluxHistory.push(flux)
    if (this.fluxHistory.length > HISTORY) this.fluxHistory.shift()
    let beat = false
    if (this.fluxHistory.length >= 16) {
      const med = median(this.fluxHistory)
      const mad = median(this.fluxHistory.map(v => Math.abs(v - med)))
      const threshold = med + (mad * 1.4826) * (1.5 * this.sensitivity)

      // peak picking one frame late: f1 must be a local max above threshold
      const isPeak = this.f1 > threshold && this.f1 >= this.f2 && this.f1 >= flux && this.f1 > 0.002

      if (isPeak) {
        const bpm = this.bpm()
        const period = bpm > 0 ? 60000 / bpm : 0
        const since = nowMs - this.lastBeatAt
        if (period > 0) {
          // first-ever onset anchors the grid — with an external BPM the PLL
          // otherwise free-runs from an arbitrary phase and never locks
          if (this.lastBeatAt === 0) {
            this.phase = 0
            beat = true
          }
          // acceptance is anchored to the PLL phase, not to the last accepted
          // beat — a wrong anchor would lock the grid onto the hats forever
          const d = Math.min(this.phase, 1 - this.phase)
          const refractoryOk = since > period * 0.4
          if (beat) { /* anchored above */ }
          else if (refractoryOk && d < 0.15) {
            beat = true
            this.gridEvidence = this.gridEvidence * 0.9 + this.f1
          } else if (refractoryOk && d > 0.35) {
            // strong onsets consistently on the offbeat → we are anti-phase
            this.antiEvidence = this.antiEvidence * 0.9 + this.f1
            if (this.antiEvidence > this.gridEvidence * 1.3) {
              this.phase = (this.phase + 0.5) % 1
              const t = this.gridEvidence
              this.gridEvidence = this.antiEvidence
              this.antiEvidence = t
              beat = true
            }
          } else if (refractoryOk && this.f1 > threshold * 3) {
            // a drop/track change: huge onset off the old grid — hard resync
            this.phase = 0
            beat = true
          }
        } else if (since > 200 || this.lastBeatAt === 0) {
          beat = true // no tempo yet — free detection with a hard 200ms floor
        }
      }
    }
    this.f2 = this.f1
    this.f1 = flux

    // --- phase: free-runs on tempo, gently pulled onto detected beats (PLL) ---
    const bpm = this.bpm()
    if (bpm > 0) this.phase += (dt / 1000) * (bpm / 60)
    while (this.phase >= 1) {
      this.phase -= 1
      this.beatIndex = (this.beatIndex + 1) % 4
      this.beatsSinceRotate++
    }
    if (beat) {
      this.lastBeatAt = nowMs
      if (bpm > 0) {
        // soft correction: pull 35% of the phase error, never a hard snap
        const err = this.phase < 0.5 ? -this.phase : 1 - this.phase
        this.phase = (this.phase + err * 0.35 + 1) % 1
      } else {
        this.phase = 0
        this.beatIndex = (this.beatIndex + 1) % 4
      }
      // downbeat histogram: the strongest recurring slot is beat 1
      this.slotStrength[this.beatIndex] = this.slotStrength[this.beatIndex] * 0.9 + this.f1
      for (let i = 0; i < 4; i++) if (i !== this.beatIndex) this.slotStrength[i] *= 0.98
      this.maybeRotateDownbeat()
    }

    return {
      flux,
      beat,
      beatPhase: this.phase,
      barPhase: (this.beatIndex + this.phase) / 4,
      acfBpm: this.acfBpm,
      acfConfidence: this.acfConfidence,
    }
  }

  /** rotate beatIndex so the strongest slot becomes the downbeat — only on clear evidence */
  private maybeRotateDownbeat() {
    if (this.beatsSinceRotate < 16) return
    let best = 0
    for (let i = 1; i < 4; i++) if (this.slotStrength[i] > this.slotStrength[best]) best = i
    if (best !== 0 && this.slotStrength[best] > this.slotStrength[0] * 1.3) {
      this.beatIndex = (this.beatIndex - best + 4) % 4
      const rotated = [...this.slotStrength]
      for (let i = 0; i < 4; i++) this.slotStrength[i] = rotated[(i + best) % 4]
    }
    this.beatsSinceRotate = 0
  }

  /** autocorrelation of the onset envelope with harmonic weighting + club prior */
  private estimateTempo() {
    const N = Math.min(this.envFrames, ENV_SIZE)
    if (N < 180) return // need ~3s before guessing

    // unroll the ring into chronological order
    const e = new Float32Array(N)
    for (let i = 0; i < N; i++) e[i] = this.env[(this.envPos - N + i + ENV_SIZE) % ENV_SIZE]
    // remove mean so silence doesn't correlate
    let mean = 0
    for (let i = 0; i < N; i++) mean += e[i]
    mean /= N
    let norm = 0
    for (let i = 0; i < N; i++) { e[i] -= mean; norm += e[i] * e[i] }
    if (norm < 1e-9) return

    const msPerFrame = this.frameDtMs
    const lagMin = Math.max(2, Math.floor(60000 / BPM_MAX / msPerFrame))
    const lagMax = Math.min(N - 1, Math.ceil(60000 / BPM_MIN / msPerFrame))
    const acf = new Float32Array(lagMax + 1)
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let s = 0
      for (let i = lag; i < N; i++) s += e[i] * e[i - lag]
      acf[lag] = s / norm
    }

    let bestLag = 0, bestScore = 0
    for (let lag = lagMin; lag <= lagMax; lag++) {
      // reward the harmonic (half tempo) so 130 beats its 260 alias
      let score = acf[lag] + 0.5 * (2 * lag <= lagMax ? acf[2 * lag] : 0)
      const bpm = 60000 / (lag * msPerFrame)
      if (bpm >= 118 && bpm <= 152) score *= 1.1 // club prior
      if (score > bestScore) { bestScore = score; bestLag = lag }
    }
    if (!bestLag) return

    const bpm = 60000 / (bestLag * msPerFrame)
    const conf = Math.max(0, Math.min(1, bestScore * 2))
    // smooth: jumpy estimates lower confidence instead of yanking the tempo
    if (this.acfBpm > 0 && Math.abs(bpm - this.acfBpm) < 3) {
      this.acfBpm = this.acfBpm * 0.8 + bpm * 0.2
      this.acfConfidence = Math.min(1, this.acfConfidence + 0.15)
    } else {
      this.acfBpm = bpm
      this.acfConfidence = conf * 0.5
    }
  }
}
