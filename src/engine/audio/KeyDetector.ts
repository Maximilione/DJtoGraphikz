/**
 * Musical key from the byte spectrum, no Web Audio: a chroma vector (12 pitch
 * classes) accumulated over a few seconds, correlated with the
 * Krumhansl-Schmuckler major and minor profiles in all 24 rotations.
 *
 * The Auto VJ uses it to pick a palette for the track rather than for the
 * block: a key is a colour in most VJs' heads, and the same track should get
 * the same colours every time it is played.
 */
export type Mode = 'major' | 'minor'

export interface Key {
  /** 0 = C … 11 = B */
  tonic: number
  mode: Mode
  /** 0..1, how far the best key stands above the runner-up */
  confidence: number
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function keyName(k: Key | null): string {
  return k ? `${NOTE_NAMES[k.tonic]}${k.mode === 'minor' ? 'm' : ''}` : '—'
}

// Krumhansl & Kessler (1982) probe-tone profiles
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

const LOW_HZ = 55        // A1: below this the bins are too coarse to name a pitch
const HIGH_HZ = 4200     // above this it is hats and air, not harmony

function pearson(a: ArrayLike<number>, b: ArrayLike<number>, shift: number): number {
  let ma = 0, mb = 0
  for (let i = 0; i < 12; i++) { ma += a[i]; mb += b[i] }
  ma /= 12; mb /= 12
  let num = 0, da = 0, db = 0
  for (let i = 0; i < 12; i++) {
    const x = a[i] - ma, y = b[(i - shift + 12) % 12] - mb
    num += x * y; da += x * x; db += y * y
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0
}

export class KeyDetector {
  private chroma = new Float32Array(12)
  private binClass: Int8Array = new Int8Array(0)
  private binWeight: Float32Array = new Float32Array(0)
  private binHz = 0
  private key: Key | null = null
  /** seconds of music the chroma remembers */
  readonly windowSec = 8

  reset() {
    this.chroma.fill(0)
    this.key = null
  }

  private prepare(bins: number, binHz: number) {
    this.binHz = binHz
    this.binClass = new Int8Array(bins)
    this.binWeight = new Float32Array(bins)
    for (let i = 0; i < bins; i++) {
      const hz = i * binHz
      if (hz < LOW_HZ || hz > HIGH_HZ) { this.binClass[i] = -1; continue }
      const midi = 69 + 12 * Math.log2(hz / 440)
      const nearest = Math.round(midi)
      // a bin that sits between two semitones is half noise: weigh it by how
      // close it lands to a pitch, and discount the low octaves where one
      // bin spans several semitones
      const closeness = 1 - Math.min(1, Math.abs(midi - nearest) * 2)
      const semitonesPerBin = 12 * Math.log2((hz + binHz) / hz)
      this.binClass[i] = ((nearest % 12) + 12) % 12
      this.binWeight[i] = closeness * Math.min(1, 1 / Math.max(semitonesPerBin, 1))
    }
  }

  /**
   * One spectrum frame: bytes 0..255 (dB-scaled, as getByteFrequencyData
   * gives them), `dtMs` since the last frame.
   */
  update(spectrum: Uint8Array, binHz: number, dtMs: number) {
    if (this.binHz !== binHz || this.binClass.length !== spectrum.length) this.prepare(spectrum.length, binHz)
    const frame = new Float32Array(12)
    for (let i = 0; i < spectrum.length; i++) {
      const c = this.binClass[i]
      if (c < 0 || spectrum[i] === 0) continue
      // back to linear magnitude: loud partials count, the floor does not
      const db = -90 + 80 * spectrum[i] / 255
      frame[c] += Math.pow(10, db / 20) * this.binWeight[i]
    }
    let sum = 0
    for (let i = 0; i < 12; i++) sum += frame[i]
    if (sum <= 0) return
    const k = 1 - Math.exp(-dtMs / (this.windowSec * 1000))
    for (let i = 0; i < 12; i++) this.chroma[i] += (frame[i] / sum - this.chroma[i]) * k
  }

  /** The best of 24 keys against the accumulated chroma. Cheap, but not per frame: call a few times a second. */
  estimate(): Key | null {
    let total = 0
    for (let i = 0; i < 12; i++) total += this.chroma[i]
    if (total <= 0) return this.key
    let best = -2, second = -2, bestTonic = 0, bestMode: Mode = 'major'
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const [profile, mode] of [[MAJOR, 'major'], [MINOR, 'minor']] as [number[], Mode][]) {
        const r = pearson(this.chroma, profile, tonic)
        if (r > best) { second = best; best = r; bestTonic = tonic; bestMode = mode }
        else if (r > second) second = r
      }
    }
    const confidence = Math.max(0, Math.min(1, (best - second) * 6)) * Math.max(0, Math.min(1, best))
    this.key = { tonic: bestTonic, mode: bestMode, confidence }
    return this.key
  }

  current(): Key | null { return this.key }
  getChroma(): Float32Array { return this.chroma }
}
