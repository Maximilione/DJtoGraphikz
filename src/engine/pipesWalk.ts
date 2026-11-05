/**
 * Pipes: the random walk behind shaders/pipes.frag, computed once a frame on
 * the CPU instead of once per pixel on the GPU.
 *
 * The walk is a pure function of the effect clock — hashed from (epoch, pipe,
 * run) — so both windows build the same pipework from `effectTime` alone,
 * exactly like the per-pixel version did, with nothing extra to sync. The
 * result goes to the shader as a 1-row float texture (see `PIPES_TEX_WIDTH`):
 * per pipe, `PIPES_NCHUNK` chunk headers (bounding box of 4 runs, so a ray
 * that misses the box skips their capsules) followed by `PIPES_NRUN` runs.
 *
 * Texel layout, per pipe (base = pipe * PIPES_PIPE_TEXELS):
 *   [base + 2c]     chunk c: bmin.xyz, runs in the chunk (0 = none, stop)
 *   [base + 2c + 1] chunk c: bmax.xyz, 0
 *   [base + 2*NCHUNK + k] run k: start.xyz, w = code * 8 + drawn length
 *                   code = axis * 2 + (dir > 0) + 6 * finished (joint at the end)
 * Pure maths, no THREE: unit-testable offline.
 */

export const PIPES_NPIPE = 7
export const PIPES_NCHUNK = 6
export const PIPES_CHUNK = 4
export const PIPES_NRUN = PIPES_NCHUNK * PIPES_CHUNK
export const PIPES_PIPE_TEXELS = 2 * PIPES_NCHUNK + PIPES_NRUN
export const PIPES_TEX_WIDTH = PIPES_NPIPE * PIPES_PIPE_TEXELS

// mirrored in pipes.frag
const R = 0.2
const JR = R * 1.32
const BOX = [7, 4, 4]
const GROW = 4.5
const STAGGER = 1.4
export const PIPES_EPOCH = 26
const EPOCH = PIPES_EPOCH

/** integer hash of three small integers, 0..1 */
function hash(a: number, b: number, c: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77) ^ Math.imul(c | 0, 0xc2b2ae3d)) >>> 0
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

/**
 * Pipes on screen `ep` for a `density` of 0.3..2 (2..7 pipes). The caller reads
 * it once per screen: counted every frame, a density moving mid-screen (an old
 * LFO mapping, an audio band) popped already-grown pipes in and out.
 */
export function pipesCount(density: number, ep: number): number {
  const d = Math.max(0.3, Math.min(2, Number.isFinite(density) ? density : 1))
  return Math.max(2, Math.min(PIPES_NPIPE, Math.floor(2 + 2.6 * d + hash(ep, 1, 1))))
}

/** Fill `out` (PIPES_TEX_WIDTH * 4 floats) with the first `count` pipes at effect time `time` */
export function pipesWalk(time: number, out: Float32Array, count = PIPES_NPIPE): void {
  out.fill(0)
  const ep = Math.floor(time / EPOCH)
  const local = time - ep * EPOCH
  for (let i = 0; i < Math.min(count, PIPES_NPIPE); i++) {
    const grown = (local - i * STAGGER) * GROW
    if (grown <= 0) break
    const base = i * PIPES_PIPE_TEXELS
    const p = [0, 0, 0]
    for (let a = 0; a < 3; a++) p[a] = Math.floor(hash(ep, i, 1 + a) * (2 * BOX[a] - 1)) - BOX[a] + 1
    let axis = Math.floor(hash(ep, i, 4) * 3)
    let acc = 0
    const pj = JR * (1 + 0.04 * i)
    let done = false
    for (let c = 0; c < PIPES_NCHUNK && !done; c++) {
      const bmin = [p[0], p[1], p[2]], bmax = [p[0], p[1], p[2]]
      let n = 0
      for (let k = 0; k < PIPES_CHUNK; k++) {
        const run = c * PIPES_CHUNK + k
        // one dice roll per run: turn (2) x direction (2) x length (5)
        const roll = Math.floor(hash(ep * 7 + i, run, 5) * 20)
        if (run > 0) axis = (axis + 1 + (roll % 2)) % 3
        let sgn = Math.floor(roll / 2) % 2 === 0 ? -1 : 1
        let room = BOX[axis] - p[axis] * sgn
        if (room < 1) { sgn = -sgn; room = BOX[axis] - p[axis] * sgn }
        const len = Math.min(1 + Math.floor(roll / 4), room)
        const seg = Math.min(len, grown - acc)
        if (seg <= 0) { done = true; break }
        const code = axis * 2 + (sgn > 0 ? 1 : 0) + (seg >= len ? 6 : 0)
        const o = (base + 2 * PIPES_NCHUNK + run) * 4
        out[o] = p[0]; out[o + 1] = p[1]; out[o + 2] = p[2]; out[o + 3] = code * 8 + seg
        const q = [p[0], p[1], p[2]]
        q[axis] += sgn * seg
        for (let a = 0; a < 3; a++) { bmin[a] = Math.min(bmin[a], q[a]); bmax[a] = Math.max(bmax[a], q[a]) }
        n = k + 1
        acc += len
        p[axis] += sgn * len
      }
      const o = (base + 2 * c) * 4
      out[o] = bmin[0] - pj; out[o + 1] = bmin[1] - pj; out[o + 2] = bmin[2] - pj; out[o + 3] = n
      out[o + 4] = bmax[0] + pj; out[o + 5] = bmax[1] + pj; out[o + 6] = bmax[2] + pj; out[o + 7] = 0
    }
  }
}
