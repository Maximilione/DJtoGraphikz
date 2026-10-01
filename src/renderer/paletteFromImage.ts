/**
 * A palette from a picture (Q2): k-means on a small thumbnail, the three
 * most distinct of the clusters, ordered by how much of the image they
 * cover. Pure, so the check can feed it pixels.
 */
export type Rgb = [number, number, number]

const hex = (c: Rgb) => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
const dist2 = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

function saturation(c: Rgb): number {
  const max = Math.max(...c), min = Math.min(...c)
  return max === 0 ? 0 : (max - min) / max
}

/**
 * `rgba` = pixels of a thumbnail (any size; 64x64 is plenty). `k` clusters,
 * seeded far apart (k-means++), a dozen iterations. Returns the clusters
 * with their share of the pixels, largest first.
 */
export function kmeans(rgba: Uint8Array | Uint8ClampedArray, k = 5, iterations = 12): { color: Rgb; share: number }[] {
  const px: Rgb[] = []
  for (let i = 0; i + 3 < rgba.length; i += 4) if (rgba[i + 3] > 32) px.push([rgba[i], rgba[i + 1], rgba[i + 2]])
  if (!px.length) return []
  k = Math.min(k, px.length)
  // k-means++ seeding, deterministic: first seed = the most saturated pixel
  const centers: Rgb[] = [px.reduce((a, b) => saturation(b) > saturation(a) ? b : a)]
  while (centers.length < k) {
    let best = px[0], bestD = -1
    for (const p of px) {
      let d = Infinity
      for (const c of centers) d = Math.min(d, dist2(p, c))
      if (d > bestD) { bestD = d; best = p }
    }
    centers.push([...best])
  }
  const assign = new Int32Array(px.length)
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < px.length; i++) {
      let bi = 0, bd = Infinity
      for (let c = 0; c < centers.length; c++) { const d = dist2(px[i], centers[c]); if (d < bd) { bd = d; bi = c } }
      assign[i] = bi
    }
    const sum = centers.map(() => [0, 0, 0, 0])
    for (let i = 0; i < px.length; i++) { const s = sum[assign[i]]; s[0] += px[i][0]; s[1] += px[i][1]; s[2] += px[i][2]; s[3]++ }
    for (let c = 0; c < centers.length; c++) if (sum[c][3]) centers[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]]
  }
  const counts = centers.map(() => 0)
  for (let i = 0; i < px.length; i++) counts[assign[i]]++
  return centers.map((color, i) => ({ color, share: counts[i] / px.length }))
    .filter(c => c.share > 0)
    .sort((a, b) => b.share - a.share)
}

/**
 * Three colours for the engine: the dominant cluster, then the two that are
 * farthest from what is already picked (so a flyer that is 80% black does
 * not give three blacks). Near-black and near-white clusters go last; a
 * palette needs hue.
 */
export function paletteFromPixels(rgba: Uint8Array | Uint8ClampedArray): [string, string, string] | null {
  const clusters = kmeans(rgba, 6)
  if (!clusters.length) return null
  const lum = (c: Rgb) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  const vivid = clusters.filter(c => saturation(c.color) > 0.15 && lum(c.color) > 20 && lum(c.color) < 240)
  const pool = vivid.length >= 2 ? vivid : clusters
  const picked: Rgb[] = [pool[0].color]
  while (picked.length < 3 && picked.length < pool.length) {
    let best = pool[0].color, bestD = -1
    for (const c of pool) {
      let d = Infinity
      for (const p of picked) d = Math.min(d, dist2(c.color, p))
      if (d > bestD) { bestD = d; best = c.color }
    }
    picked.push(best)
  }
  while (picked.length < 3) picked.push(picked[picked.length - 1])
  return [hex(picked[0]), hex(picked[1]), hex(picked[2])]
}
