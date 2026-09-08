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
const GRID_MS = 10              // onset envelope on a FIXED 100Hz grid: frame
                                // jitter and dynamic-res rate changes stop
                                // biasing the lag→BPM conversion
const ENV_SIZE = 1024           // ~10.2s of envelope
const BPM_MIN = 70
const BPM_MAX = 190

function acfAt(acf: Float32Array, i: number, max: number): number {
  return i >= 0 && i <= max ? acf[i] : 0
}

/**
 * Median of a small array, into a caller-owned scratch buffer. Called twice per
 * frame: allocating a copy each time (plus the map() feeding the second call)
 * meant three arrays and two sorts every frame, forever.
 */
function medianInto(scratch: Float32Array, n: number): number {
  const s = scratch.subarray(0, n)
  s.sort()
  const m = n >> 1
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export class BeatTracker {
  private fluxHistory: number[] = []
  private medianScratch = new Float32Array(HISTORY)
  private f1 = 0                       // flux one frame ago (peak-picking)
  private f2 = 0                       // flux two frames ago
  private prevLogSpec: Float32Array = new Float32Array(0)
  private currLogSpec: Float32Array = new Float32Array(0)

  // Onset envelopes on the 100Hz grid: kick band (tempo anchor) + full band
  // (voting — covers breakdowns where the kick disappears)
  private env = new Float32Array(ENV_SIZE)
  private envFull = new Float32Array(ENV_SIZE)
  private gridPos = 0
  private gridStartMs = 0
  private acfCountdown = 30

  private lastLowFlux = 0
  private lastFullFlux = 0

  /** genre hint: Rayleigh prior center for the tempo search (AutoVJ sets it) */
  tempoPrior = 126

  acfBpm = 0
  acfConfidence = 0
  private tempoCandidates: number[] = []

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
    this.currLogSpec = new Float32Array(0)
    this.env.fill(0)
    this.envFull.fill(0)
    this.gridPos = 0
    this.gridStartMs = 0
    this.acfBpm = 0
    this.acfConfidence = 0
    this.tempoCandidates = []
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
    if (this.prevLogSpec.length !== n) {
      this.prevLogSpec = new Float32Array(n)
      this.currLogSpec = new Float32Array(n)
    }

    // --- onset strength: positive log-magnitude flux, kick-weighted ---
    // log compression makes the flux level-independent: a quiet club feed and
    // a hot line-in produce comparable onset curves
    let flux = 0
    let lowFlux = 0
    for (let i = 0; i < n; i++) {
      const curr = Math.log1p((spectrum[i] as number) * 8)
      // SuperFlux: compare against the MAX of the previous frame's neighborhood
      // (±2 bins) — vibrato and tonal movement stop counting as onsets
      let prevMax = this.prevLogSpec[i]
      if (i > 1 && this.prevLogSpec[i - 2] > prevMax) prevMax = this.prevLogSpec[i - 2]
      if (i > 0 && this.prevLogSpec[i - 1] > prevMax) prevMax = this.prevLogSpec[i - 1]
      if (i < n - 1 && this.prevLogSpec[i + 1] > prevMax) prevMax = this.prevLogSpec[i + 1]
      if (i < n - 2 && this.prevLogSpec[i + 2] > prevMax) prevMax = this.prevLogSpec[i + 2]
      const diff = curr - prevMax
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
      this.currLogSpec[i] = curr
    }
    // swap buffers: neighbors of the PREVIOUS frame must stay intact all loop
    const swap = this.prevLogSpec
    this.prevLogSpec = this.currLogSpec
    this.currLogSpec = swap
    flux /= n
    lowFlux /= n

    // --- timing ---
    const dt = this.lastTime ? Math.min(nowMs - this.lastTime, 500) : 16.7
    this.lastTime = nowMs

    // silence: keep the spectra fresh but detect nothing and learn no tempo
    if (!active) {
      this.f2 = this.f1
      this.f1 = flux
      return { flux, beat: false, beatPhase: this.phase, barPhase: (this.beatIndex + this.phase) / 4, acfBpm: this.acfBpm, acfConfidence: this.acfConfidence }
    }

    // --- onset envelopes on the fixed grid (timestamp-accurate) ---
    if (!this.gridStartMs) this.gridStartMs = nowMs
    const slot = Math.floor((nowMs - this.gridStartMs) / GRID_MS)
    // sample-and-hold across the slots this frame spans: zeros between frames
    // would put a comb artifact in the ACF and bias the tempo peak
    while (this.gridPos < slot) {
      this.gridPos++
      const zi = this.gridPos % ENV_SIZE
      this.env[zi] = this.lastLowFlux
      this.envFull[zi] = this.lastFullFlux
    }
    const gi = this.gridPos % ENV_SIZE
    this.env[gi] = Math.max(this.env[gi], lowFlux)
    this.envFull[gi] = Math.max(this.envFull[gi], flux)
    this.lastLowFlux = lowFlux
    this.lastFullFlux = flux
    if (--this.acfCountdown <= 0) {
      this.acfCountdown = 30
      this.estimateTempo()
    }

    // --- adaptive threshold: median + MAD (robust to build-ups and outliers) ---
    this.fluxHistory.push(flux)
    if (this.fluxHistory.length > HISTORY) this.fluxHistory.shift()
    let beat = false
    if (this.fluxHistory.length >= 16) {
      const n = this.fluxHistory.length
      for (let i = 0; i < n; i++) this.medianScratch[i] = this.fluxHistory[i]
      const med = medianInto(this.medianScratch, n)
      for (let i = 0; i < n; i++) this.medianScratch[i] = Math.abs(this.fluxHistory[i] - med)
      const mad = medianInto(this.medianScratch, n)
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

  /** autocorrelation on the fixed 100Hz grid, kick + full band voting,
      comb filterbank with a genre-tunable Rayleigh prior */
  private estimateTempo() {
    const N = Math.min(this.gridPos + 1, ENV_SIZE)
    if (N < 380) return // ~3.8s before guessing

    // unroll both rings chronologically, mean-removed
    const eK = new Float32Array(N)
    const eF = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const src = (this.gridPos - N + 1 + i + ENV_SIZE * 4) % ENV_SIZE
      eK[i] = this.env[src]
      eF[i] = this.envFull[src]
    }
    let mK = 0, mF = 0
    for (let i = 0; i < N; i++) { mK += eK[i]; mF += eF[i] }
    mK /= N; mF /= N
    let nK = 0, nF = 0
    for (let i = 0; i < N; i++) {
      eK[i] -= mK; nK += eK[i] * eK[i]
      eF[i] -= mF; nF += eF[i] * eF[i]
    }
    if (nK < 1e-9) return

    const lagMin = Math.max(2, Math.floor(60000 / BPM_MAX / GRID_MS))
    const lagMax = Math.min(N - 1, Math.ceil(60000 / BPM_MIN / GRID_MS))
    const lagTop = Math.min(N - 1, lagMax * 4 + 1)
    const acfK = new Float32Array(lagTop + 1)
    const acfF = new Float32Array(lagTop + 1)
    for (let lag = lagMin; lag <= lagTop; lag++) {
      let sK = 0, sF = 0
      for (let i = lag; i < N; i++) { sK += eK[i] * eK[i - lag]; sF += eF[i] * eF[i - lag] }
      acfK[lag] = sK / nK
      acfF[lag] = nF > 1e-9 ? sF / nF : 0
    }

    const comb = (acf: Float32Array, lag: number) => {
      let score = 0
      for (let k = 1; k <= 4; k++) {
        const kl = k * lag
        if (kl >= N) break
        const a = Math.max(acfAt(acf, kl - 1, lagTop), acfAt(acf, kl, lagTop), acfAt(acf, kl + 1, lagTop))
        score += a / k
      }
      return score
    }

    // Rayleigh prior centered on the genre hint (AutoVJ) — octave errors
    // resolve toward what is actually playing tonight
    const rp = 60000 / Math.max(this.tempoPrior, 60) / GRID_MS
    let bestLag = 0, bestScore = 0
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let score = comb(acfK, lag) + 0.45 * comb(acfF, lag)
      const r = lag / (rp * rp) * Math.exp(-(lag * lag) / (2.0 * rp * rp))
      score *= r * rp * 1.65
      if (score > bestScore) { bestScore = score; bestLag = lag }
    }
    if (!bestLag) return

    // parabolic interpolation → sub-slot BPM precision
    let lagF = bestLag
    if (bestLag > lagMin && bestLag < lagMax) {
      const y0 = acfK[bestLag - 1], y1 = acfK[bestLag], y2 = acfK[bestLag + 1]
      const denom = y0 - 2 * y1 + y2
      if (Math.abs(denom) > 1e-9) {
        const off = 0.5 * (y0 - y2) / denom
        lagF = bestLag + Math.max(-0.6, Math.min(0.6, off))
      }
    }
    const bpm = 60000 / (lagF * GRID_MS)

    // median of the recent raw candidates: one bad window can't yank the tempo
    this.tempoCandidates.push(bpm)
    if (this.tempoCandidates.length > 5) this.tempoCandidates.shift()
    if (this.tempoCandidates.length < 3) return
    const sorted = [...this.tempoCandidates].sort((a, b) => a - b)
    const medBpm = sorted[sorted.length >> 1]
    const spread = sorted[sorted.length - 1] - sorted[0]

    if (this.acfBpm > 0 && Math.abs(medBpm - this.acfBpm) < 3) {
      this.acfBpm = this.acfBpm * 0.8 + medBpm * 0.2
      this.acfConfidence = Math.min(1, this.acfConfidence + (spread < 2 ? 0.2 : 0.05))
    } else {
      this.acfBpm = medBpm
      this.acfConfidence = spread < 2 ? 0.4 : 0.2
    }
  }

}
