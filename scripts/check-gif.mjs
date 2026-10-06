#!/usr/bin/env node
/** GIF export: struttura del file + round-trip con il decoder (gifuct-js, lo stesso di GifDecoder).  node scripts/check-gif.mjs */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'
import { parseGIF, decompressFrames } from 'gifuct-js'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({ entryPoints: [join(REPO, 'src/renderer/gifEncoder.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const { encodeGif, buildPalette, gifTiming, barsSeconds } =
  await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

const check = async (name, fn) => { await fn(); console.log('  ok', name) }
const W = 48, H = 32
// synthetic frames: moving coloured bar over a gradient; noise forces LZW table resets
const mk = (t, noise = 0) => {
  const d = new Uint8ClampedArray(W * H * 4)
  let s = 12345 + t
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 4
    const bar = Math.abs(x - t * 6) < 4
    d[p] = bar ? 255 : x * 5; d[p + 1] = bar ? 40 : y * 7; d[p + 2] = bar ? 0 : 128
    if (noise) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[p] ^= s & 255; d[p + 1] ^= (s >> 8) & 255; d[p + 2] ^= (s >> 16) & 255 }
    d[p + 3] = 255
  }
  return { data: d }
}

await check('struttura: GIF89a, NETSCAPE2.0, trailer, dimensioni, frame', async () => {
  const g = await encodeGif([0, 1, 2, 3].map(t => mk(t)), { width: W, height: H, delayCs: 7 })
  assert.equal(Buffer.from(g.subarray(0, 6)).toString(), 'GIF89a')
  assert.equal(g.at(-1), 0x3b)
  assert.ok(Buffer.from(g).includes('NETSCAPE2.0'))
  assert.equal(g[6] | (g[7] << 8), W)
  assert.equal(g[8] | (g[9] << 8), H)
  assert.ok(g[10] & 0x80, 'global colour table presente')
  assert.equal(parseGIF(g.buffer).frames.filter(f => f.image).length, 4)
})

await check('round-trip: frame, dimensioni, ritardo e colori ritrovati', async () => {
  const g = await encodeGif([0, 1, 2, 3, 4].map(t => mk(t)), { width: W, height: H, delayCs: 7 })
  const gif = parseGIF(g.buffer)
  assert.equal(gif.lsd.width, W)
  assert.equal(gif.lsd.height, H)
  const dec = decompressFrames(gif, true)
  assert.equal(dec.length, 5)
  for (const f of dec) assert.equal(f.delay, 70)
  const px = (f, x, y) => { const i = (y * W + x) * 4; return [...f.patch.slice(i, i + 3)] }
  const [r, gg, b] = px(dec[0], 1, 5)
  assert.ok(r > 200 && gg < 90 && b < 40, `barra rossa, trovato ${[r, gg, b]}`)
  const e = px(dec[0], 40, 10)
  const ex = [200, 70, 128]
  assert.ok(e.every((v, i) => Math.abs(v - ex[i]) < 24), `gradiente, trovato ${e}`)
})

await check('LZW: rumore (tabella piena, piu clear) e lunghezze limite decodificano', async () => {
  const g = await encodeGif([mk(0, 1), mk(1, 1)], { width: W, height: H, delayCs: 5, dither: true })
  const dec = decompressFrames(parseGIF(g.buffer), true)
  assert.equal(dec.length, 2)
  assert.equal(dec[0].patch.length, W * H * 4)
  for (const n of [1, 2, 3, 255, 256, 257, 258, 500, 4000, 9000, 20000]) {
    const one = { data: new Uint8ClampedArray(n * 4) }
    for (let i = 0; i < n; i++) one.data.set([((i * 7 + (i >> 3)) & 255) & 0xf8, 0, 0, 255], i * 4)
    const gg = await encodeGif([one], { width: n, height: 1, delayCs: 5 })
    const d = decompressFrames(parseGIF(gg.buffer), false)
    assert.equal(d[0].pixels.length, n, `n=${n}`)
    // stessi indici a ogni pixel: il pixel i e il pixel j con lo stesso colore devono avere lo stesso indice
    const seen = new Map()
    for (let i = 0; i < n; i++) {
      const c = one.data[i * 4]
      if (seen.has(c)) assert.equal(d[0].pixels[i], seen.get(c), `n=${n} i=${i}`)
      else seen.set(c, d[0].pixels[i])
    }
  }
})

await check('palette: al massimo 256 colori, un solo colore resta uno', () => {
  assert.ok(buildPalette([mk(0, 1)]).length / 3 <= 256)
  assert.equal(buildPalette([{ data: new Uint8ClampedArray(16 * 4).fill(255) }]).length / 3, 1)
})

await check('tempi: fps, ritardo, battute', () => {
  assert.deepEqual(gifTiming(5, 15), { frames: 75, delayCs: 7 })
  assert.equal(barsSeconds(2, 120), 4)
  assert.equal(barsSeconds(1, 128), 1.875)
})
