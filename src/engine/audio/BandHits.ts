/**
 * Per-band hit pulses: for each of three bands (bass, mid, high) a flux value
 * per frame goes into a short history, and a frame whose flux stands above
 * mean + k·std fires a pulse of 1 that decays by 0.85 a frame.
 *
 * It used to live inline in AudioAnalyzer. It is its own class because the
 * phase replay tool (`scripts/check-phases.mjs`) must detect kicks exactly the
 * way the app does — a second copy of this arithmetic would drift.
 */
export class BandHits {
  private history: [number[], number[], number[]] = [[], [], []]
  private pulse = [0, 0, 0]
  sensitivity = 1.4
  /** ~1.3s at 60fps */
  readonly historySize = 80

  reset() {
    this.history = [[], [], []]
    this.pulse = [0, 0, 0]
  }

  /** `flux` per band, already divided by the bin count. Returns the three pulses. */
  update(flux: ArrayLike<number>, gated: number): [number, number, number] {
    for (let b = 0; b < 3; b++) {
      const f = flux[b]
      const hist = this.history[b]
      hist.push(f)
      if (hist.length > this.historySize) hist.shift()
      if (hist.length >= 10) {
        const mean = hist.reduce((a, v) => a + v, 0) / hist.length
        let sq = 0
        for (const v of hist) sq += (v - mean) ** 2
        const std = Math.sqrt(sq / hist.length)
        if (f > mean + std * this.sensitivity && f > 0.0008) this.pulse[b] = 1
      }
      this.pulse[b] *= 0.85
    }
    return [gated * this.pulse[0], gated * this.pulse[1], gated * this.pulse[2]]
  }
}
