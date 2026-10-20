/**
 * Per-band hit pulses: for each of three bands (bass, mid, high) a flux value
 * per frame goes into a short history, and a frame whose flux stands above
 * mean + k·std fires a pulse of 1 that decays by 0.85 a frame.
 *
 * It used to live inline in AudioAnalyzer. It is its own class because the
 * phase replay tool (`scripts/check-phases.mjs`) must detect kicks exactly the
 * way the app does — a second copy of this arithmetic would drift.
 *
 * The histories are ring buffers and the result is one reused array: this
 * runs every frame all night, and three shift()s plus a fresh tuple a frame
 * is garbage for nothing. The sums run in arrival order, so the numbers are
 * the ones the array version produced.
 */
export class BandHits {
  /** ~1.3s at 60fps */
  readonly historySize = 80
  private buf = [new Float64Array(this.historySize), new Float64Array(this.historySize), new Float64Array(this.historySize)]
  /** values held per band, and the slot the next one goes in */
  private n = [0, 0, 0]
  private head = [0, 0, 0]
  private pulse = [0, 0, 0]
  private out: [number, number, number] = [0, 0, 0]
  sensitivity = 1.4

  reset() {
    this.n[0] = this.n[1] = this.n[2] = 0
    this.head[0] = this.head[1] = this.head[2] = 0
    this.pulse[0] = this.pulse[1] = this.pulse[2] = 0
  }

  /** `flux` per band, already divided by the bin count. Returns the three pulses (one array, reused). */
  update(flux: ArrayLike<number>, gated: number): [number, number, number] {
    const size = this.historySize
    for (let b = 0; b < 3; b++) {
      const f = flux[b]
      const hist = this.buf[b]
      hist[this.head[b]] = f
      this.head[b] = (this.head[b] + 1) % size
      if (this.n[b] < size) this.n[b]++
      const n = this.n[b]
      if (n >= 10) {
        // oldest first: index 0 until the ring fills, then the slot after the newest
        const start = n < size ? 0 : this.head[b]
        let sum = 0
        for (let k = 0; k < n; k++) sum += hist[(start + k) % size]
        const mean = sum / n
        let sq = 0
        for (let k = 0; k < n; k++) sq += (hist[(start + k) % size] - mean) ** 2
        const std = Math.sqrt(sq / n)
        if (f > mean + std * this.sensitivity && f > 0.0008) this.pulse[b] = 1
      }
      this.pulse[b] *= 0.85
    }
    const out = this.out
    out[0] = gated * this.pulse[0]; out[1] = gated * this.pulse[1]; out[2] = gated * this.pulse[2]
    return out
  }
}
