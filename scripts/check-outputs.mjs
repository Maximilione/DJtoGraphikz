#!/usr/bin/env node
/**
 * Every value here ends up driving a real wall: a window on a display, at a
 * resolution, showing a rectangle of the show. A crop of zero width is a black
 * output that reads exactly like a dead projector, and a resolution out of
 * range is a renderer that does not come back — so the list is checked before
 * it reaches main, not after.
 *
 *     node scripts/check-outputs.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({
  entryPoints: [join(REPO, 'src/renderer/outputs.ts')],
  bundle: true, format: 'esm', write: false, platform: 'neutral',
})
const { sanitizeOutput, sanitizeOutputs, totalPixels, DEFAULT_OUTPUT, PIXEL_BUDGET } =
  await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

check('un\'uscita normale passa intatta', () => {
  const o = { displayId: 7, width: 1536, height: 256, src: [0, 0.5, 1, 0.5], gamma: 1.8, brightness: 0.7 }
  assert.deepEqual(sanitizeOutput(o), o)
})

check('la risoluzione resta dentro quello che una GPU disegna', () => {
  assert.equal(sanitizeOutput({ width: 32000 }).width, 7680)
  assert.equal(sanitizeOutput({ width: 4 }).width, 320)
  assert.equal(sanitizeOutput({ height: 0 }).height, 240)
  assert.equal(sanitizeOutput({ width: 'grande' }).width, DEFAULT_OUTPUT.width)
  assert.equal(sanitizeOutput({ width: NaN }).width, DEFAULT_OUTPUT.width)
  assert.equal(sanitizeOutput({ width: 1920.6 }).width, 1921)   // intera, sempre
})

check('il ritaglio non esce dalla scena e non e\' mai vuoto', () => {
  assert.deepEqual(sanitizeOutput({ src: [0, 0, 0, 0] }).src, [0, 0, 0.01, 0.01])
  assert.deepEqual(sanitizeOutput({ src: [0.5, 0, 1, 1] }).src, [0.5, 0, 0.5, 1])
  assert.deepEqual(sanitizeOutput({ src: [-1, 2, 1, 1] }).src, [0, 1, 1, 0.01])
  assert.deepEqual(sanitizeOutput({ src: 'meta\'' }).src, [0, 0, 1, 1])
  assert.deepEqual(sanitizeOutput({ src: [0, 0, 1] }).src, [0, 0, 1, 1])
})

check('gamma e tetto restano in un intervallo che si vede', () => {
  assert.equal(sanitizeOutput({ gamma: 0 }).gamma, 0.2)
  assert.equal(sanitizeOutput({ gamma: 99 }).gamma, 4)
  assert.equal(sanitizeOutput({ brightness: -1 }).brightness, 0)
  assert.equal(sanitizeOutput({ brightness: 5 }).brightness, 1)
  assert.equal(sanitizeOutput({}).gamma, 1)
})

check('lo schermo si dimentica solo se non e\' un numero', () => {
  assert.equal(sanitizeOutput({ displayId: 3 }).displayId, 3)
  assert.equal(sanitizeOutput({ displayId: 'principale' }).displayId, null)
  assert.equal(sanitizeOutput({}).displayId, null)
})

check('la lista ha sempre almeno il proiettore', () => {
  assert.equal(sanitizeOutputs(null).length, 1)
  assert.equal(sanitizeOutputs([]).length, 1)
  assert.equal(sanitizeOutputs('due').length, 1)
  assert.deepEqual(sanitizeOutputs(null)[0], DEFAULT_OUTPUT)
  // e non si aprono finestre all'infinito da un archivio modificato a mano
  assert.equal(sanitizeOutputs(new Array(50).fill({})).length, 8)
})

check('il conto dei pixel e\' quello che decide se la GPU regge', () => {
  const hd = { ...DEFAULT_OUTPUT }
  assert.equal(totalPixels([hd]), 1920 * 1080)
  assert.ok(totalPixels([hd, hd]) < PIXEL_BUDGET, 'due 1080p devono passare')
  assert.ok(totalPixels([hd, { ...hd, width: 3840, height: 2160 }]) > PIXEL_BUDGET,
    '1080p + 4K deve far scattare l\'avviso')
})

console.log(`\n${checks} controlli passati`)
