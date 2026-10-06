/** GIF89a encoder in plain TypeScript: global 256-colour palette (median cut), optional ordered dither,
 *  LZW, infinite loop (NETSCAPE2.0). No dependencies. */

export interface GifFrameIn { data: Uint8ClampedArray | Uint8Array } // RGBA, width*height*4
export interface GifOptions {
  width: number
  height: number
  /** per-frame delay in 1/100 s */
  delayCs: number
  dither?: boolean
  onProgress?: (done: number, total: number) => void
}

const SAMPLE_PIXELS = 60000 // palette is built from this many pixels at most, spread over all frames

/** 5 bits per channel key */
const key5 = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)

/** Median cut over the 15-bit colour histogram. Returns up to `max` RGB triples (flat). */
export function buildPalette(frames: GifFrameIn[], max = 256): Uint8Array {
  const hist = new Uint32Array(32768)
  const total = frames.reduce((n, f) => n + f.data.length / 4, 0)
  const step = Math.max(1, Math.floor(total / SAMPLE_PIXELS))
  let k = 0
  for (const f of frames) {
    const d = f.data
    for (let i = (step - (k % step)) % step; i < d.length / 4; i += step) hist[key5(d[i * 4], d[i * 4 + 1], d[i * 4 + 2])]++
    k += d.length / 4
  }
  const colors: number[] = []
  for (let c = 0; c < 32768; c++) if (hist[c]) colors.push(c)
  type Box = { c: number[]; n: number }
  const ch = (c: number, s: number) => (c >> s) & 31
  const range = (b: Box, s: number) => { let lo = 31, hi = 0; for (const c of b.c) { const v = ch(c, s); if (v < lo) lo = v; if (v > hi) hi = v } return hi - lo }
  const boxes: Box[] = [{ c: colors, n: colors.reduce((n, c) => n + hist[c], 0) }]
  while (boxes.length < max) {
    let bi = -1, best = 0
    boxes.forEach((b, i) => { if (b.c.length > 1 && b.n > best) { best = b.n; bi = i } })
    if (bi < 0) break
    const b = boxes[bi]
    const shifts = [10, 5, 0]
    const s = shifts.reduce((a, x) => (range(b, x) > range(b, a) ? x : a), 10)
    b.c.sort((x, y) => ch(x, s) - ch(y, s))
    let acc = 0, cut = 1
    for (let i = 0; i < b.c.length - 1; i++) { acc += hist[b.c[i]]; cut = i + 1; if (acc * 2 >= b.n) break }
    const a = b.c.slice(0, cut), z = b.c.slice(cut)
    const na = a.reduce((n, c) => n + hist[c], 0)
    boxes[bi] = { c: a, n: na }
    boxes.push({ c: z, n: b.n - na })
  }
  const pal = new Uint8Array(boxes.length * 3)
  boxes.forEach((b, i) => {
    let r = 0, g = 0, bl = 0
    for (const c of b.c) { const w = hist[c]; r += ch(c, 10) * w; g += ch(c, 5) * w; bl += ch(c, 0) * w }
    const n = b.n || 1
    // 5-bit centre back to 8 bit
    pal[i * 3] = Math.min(255, Math.round(r / n) * 8 + 4)
    pal[i * 3 + 1] = Math.min(255, Math.round(g / n) * 8 + 4)
    pal[i * 3 + 2] = Math.min(255, Math.round(bl / n) * 8 + 4)
  })
  return pal
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** Map RGBA pixels to palette indices (nearest colour, cached per 15-bit key). */
export function indexFrame(rgba: ArrayLike<number>, w: number, h: number, pal: Uint8Array, cache: Int16Array, dither = false): Uint8Array {
  const n = pal.length / 3
  const out = new Uint8Array(w * h)
  const nearest = (r: number, g: number, b: number) => {
    const key = key5(r, g, b)
    let v = cache[key]
    if (v >= 0) return v
    let bd = Infinity
    for (let i = 0; i < n; i++) {
      const dr = r - pal[i * 3], dg = g - pal[i * 3 + 1], db = b - pal[i * 3 + 2]
      const d = dr * dr + dg * dg + db * db
      if (d < bd) { bd = d; v = i }
    }
    cache[key] = v
    return v
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4
      let r = rgba[p], g = rgba[p + 1], b = rgba[p + 2]
      if (dither) {
        const t = (BAYER[(y & 3) * 4 + (x & 3)] - 7.5) * 1.5 // +-11 levels
        r = Math.max(0, Math.min(255, r + t)); g = Math.max(0, Math.min(255, g + t)); b = Math.max(0, Math.min(255, b + t))
      }
      out[y * w + x] = nearest(r, g, b)
    }
  }
  return out
}

/** LZW, min code size 8; returns the sub-block-framed image data (without min code size byte). */
export function lzwEncode(idx: Uint8Array): number[] {
  const bytes: number[] = []
  let cur = 0, nbits = 0
  const CLEAR = 256, EOI = 257
  let size = 9, next = 258
  const put = (code: number) => {
    cur |= code << nbits; nbits += size
    while (nbits >= 8) { bytes.push(cur & 255); cur >>>= 8; nbits -= 8 }
  }
  let dict = new Map<number, number>()
  put(CLEAR)
  let prefix = idx[0]
  for (let i = 1; i < idx.length; i++) {
    const c = idx[i], k = prefix * 256 + c
    const hit = dict.get(k)
    if (hit !== undefined) { prefix = hit; continue }
    put(prefix)
    dict.set(k, next++)
    if (next > (1 << size) && size < 12) size++
    if (next >= 4096) { put(CLEAR); dict = new Map(); size = 9; next = 258 }
    prefix = c
  }
  put(prefix)
  // the decoder adds one entry for this last code too; keep its width in step
  if (next + 1 > (1 << size) && size < 12) size++
  put(EOI)
  if (nbits > 0) bytes.push(cur & 255)
  const out: number[] = []
  for (let i = 0; i < bytes.length; i += 255) {
    const len = Math.min(255, bytes.length - i)
    out.push(len)
    for (let j = 0; j < len; j++) out.push(bytes[i + j])
  }
  out.push(0)
  return out
}

const u16 = (v: number) => [v & 255, (v >> 8) & 255]

/** Encodes frames (all width x height RGBA) to a looping GIF. Yields to the event loop between frames. */
export async function encodeGif(frames: GifFrameIn[], o: GifOptions): Promise<Uint8Array> {
  const { width: w, height: h } = o
  if (!frames.length) throw new Error('gif: no frames')
  const pal = buildPalette(frames)
  let bits = 1
  while ((1 << bits) < pal.length / 3) bits++
  const tableSize = 1 << bits
  const out: number[] = [
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
    ...u16(w), ...u16(h), 0x80 | 0x70 | (bits - 1), 0, 0,
  ]
  for (let i = 0; i < tableSize * 3; i++) out.push(pal[i] ?? 0)
  // NETSCAPE2.0: loop forever
  out.push(0x21, 0xff, 11, ...'NETSCAPE2.0'.split('').map(c => c.charCodeAt(0)), 3, 1, 0, 0, 0)
  const cache = new Int16Array(32768).fill(-1)
  for (let f = 0; f < frames.length; f++) {
    const idx = indexFrame(frames[f].data, w, h, pal, cache, o.dither)
    // graphic control: disposal 1 (leave), no transparency
    out.push(0x21, 0xf9, 4, 0x04, ...u16(Math.max(2, o.delayCs)), 0, 0)
    out.push(0x2c, 0, 0, 0, 0, ...u16(w), ...u16(h), 0, 8) // LZW min code size 8, whatever the table size
    const lz = lzwEncode(idx)
    for (let i = 0; i < lz.length; i++) out.push(lz[i])
    o.onProgress?.(f + 1, frames.length)
    await new Promise(r => setTimeout(r, 0))
  }
  out.push(0x3b)
  return Uint8Array.from(out)
}

/** Frame count and per-frame delay (cs) for a capture of `seconds` at `fps`. */
export function gifTiming(seconds: number, fps: number): { frames: number; delayCs: number } {
  const frames = Math.max(1, Math.round(seconds * fps))
  return { frames, delayCs: Math.max(2, Math.round((seconds * 100) / frames)) }
}

/** Seconds for N bars of 4 beats at `bpm`. */
export const barsSeconds = (bars: number, bpm: number) => (bars * 4 * 60) / bpm
