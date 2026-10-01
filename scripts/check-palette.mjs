#!/usr/bin/env node
/**
 * Palette from a picture: a flyer that is mostly black still gives three
 * colours with hue, and the dominant one comes first.
 *
 *     node scripts/check-palette.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({ entryPoints: [join(REPO, 'src/renderer/paletteFromImage.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const { kmeans, paletteFromPixels } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

/** an image of solid blocks: [[r,g,b], share] */
function image(blocks, n = 4096) {
  const px = new Uint8Array(n * 4)
  let i = 0
  for (const [c, share] of blocks) for (let k = 0; k < Math.round(n * share) && i < n; k++, i++) {
    // a little grain, so the clusters are clusters and not single points
    px[i * 4] = c[0] + (i % 7) - 3; px[i * 4 + 1] = c[1] + (i % 5) - 2; px[i * 4 + 2] = c[2] + (i % 3) - 1; px[i * 4 + 3] = 255
  }
  return px
}
const hexToRgb = (h) => [1, 3, 5].map(o => parseInt(h.slice(o, o + 2), 16))
const near = (h, c, tol = 12) => hexToRgb(h).every((v, i) => Math.abs(v - c[i]) <= tol)

check('k-means trova i blocchi e li ordina per copertura', () => {
  const cl = kmeans(image([[[200, 30, 30], 0.6], [[30, 30, 200], 0.3], [[30, 200, 30], 0.1]]), 3)
  assert.equal(cl.length, 3)
  assert.ok(near('#' + cl[0].color.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''), [200, 30, 30]))
  assert.ok(cl[0].share > 0.55 && cl[2].share < 0.15)
})

check('un flyer quasi tutto nero da\' tre colori con tinta, il dominante per primo', () => {
  const pal = paletteFromPixels(image([[[8, 8, 8], 0.8], [[230, 40, 20], 0.12], [[250, 200, 30], 0.05], [[20, 160, 230], 0.03]]))
  assert.ok(pal && pal.length === 3)
  assert.ok(near(pal[0], [230, 40, 20]), `dominante ${pal[0]}`)
  const rest = pal.slice(1)
  assert.ok(rest.some(h => near(h, [250, 200, 30])) && rest.some(h => near(h, [20, 160, 230])), rest.join(' '))
  assert.ok(!pal.some(h => near(h, [8, 8, 8])), 'il nero e\' finito in palette')
})

check('un\'immagine vuota non da\' palette, una monocroma la ripete', () => {
  assert.equal(paletteFromPixels(new Uint8Array(0)), null)
  const pal = paletteFromPixels(image([[[120, 120, 120], 1]]))
  assert.ok(pal && pal.length === 3)
})

console.log(`\n${checks} controlli passati`)
