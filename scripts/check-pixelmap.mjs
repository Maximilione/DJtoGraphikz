#!/usr/bin/env node
/**
 * Pixel map (I6) without a panel: the cut into universes and the sACN bytes.
 * A pixel split across two universes, or a wrong length field, is a LED wall
 * that shows garbage with every counter in the app looking fine.
 *
 *     node scripts/check-pixelmap.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const load = async (entry, platform = 'neutral') => {
  const out = await build({ entryPoints: [join(REPO, entry)], bundle: true, format: 'esm', write: false, platform })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}
const { packUniverses, universesFor, sanitizePixelMap, PIXELS_PER_UNIVERSE } = await load('src/renderer/pixelmap.ts')
const { sacnPacket, sacnMulticast, CID } = await load('src/main/sacn.ts', 'node')

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

/** a readback where pixel (x, y from the top) is r = x, g = y, b = 7 */
function frame(cols, rows) {
  const rgba = new Uint8Array(cols * rows * 4)
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const glRow = rows - 1 - y
    const o = (glRow * cols + x) * 4
    rgba[o] = x; rgba[o + 1] = y; rgba[o + 2] = 7; rgba[o + 3] = 255
  }
  return rgba
}

check('un pannello piccolo sta in un universo, in alto a sinistra per primo', () => {
  const out = packUniverses(frame(10, 2), { cols: 10, rows: 2, universe: 3, snake: false })
  assert.equal(out.length, 1)
  assert.equal(out[0].universe, 3)
  assert.equal(out[0].values.length, 60)
  assert.deepEqual(out[0].values.slice(0, 3), [0, 0, 7])        // (0,0)
  assert.deepEqual(out[0].values.slice(27, 30), [9, 0, 7])      // (9,0): end of the first row
  assert.deepEqual(out[0].values.slice(30, 33), [0, 1, 7])      // (0,1): the second row starts at the left
})

check('170 pixel per universo, il 171esimo apre il successivo', () => {
  const cols = 200, rows = 1
  assert.equal(universesFor(cols, rows), 2)
  const out = packUniverses(frame(cols, rows), { cols, rows, universe: 1, snake: false })
  assert.equal(out.length, 2)
  assert.equal(out[0].values.length, PIXELS_PER_UNIVERSE * 3)
  assert.equal(out[1].universe, 2)
  assert.equal(out[1].values.length, 30 * 3)
  assert.equal(out[1].values[0], 170)                            // first pixel of universe 2 is x = 170
})

check('la serpentina inverte le righe dispari', () => {
  const out = packUniverses(frame(4, 2), { cols: 4, rows: 2, universe: 0, snake: true })
  const v = out[0].values
  assert.deepEqual([v[0], v[3], v[6], v[9]], [0, 1, 2, 3])        // row 0 left to right
  assert.deepEqual([v[12], v[15], v[18], v[21]], [3, 2, 1, 0])    // row 1 right to left
})

check('il pacchetto sACN ha le lunghezze, il vettore, il CID e lo start code al posto giusto', () => {
  const data = new Uint8Array(510).fill(0).map((_, i) => i & 255)
  const pkt = sacnPacket(5, data, 9)
  assert.equal(pkt.length, 636)
  assert.equal(pkt.readUInt16BE(0), 0x10)
  assert.equal(pkt.toString('ascii', 4, 13), 'ASC-E1.17')
  assert.equal(pkt.readUInt16BE(16), 0x7000 | (636 - 16))
  assert.equal(pkt.readUInt32BE(18), 4)
  assert.ok(CID.equals(pkt.subarray(22, 38)))
  assert.equal(pkt.readUInt16BE(38), 0x7000 | (636 - 38))
  assert.equal(pkt.readUInt32BE(40), 2)
  assert.equal(pkt.toString('utf8', 44, 44 + 12), 'DJtoGraphikz')
  assert.equal(pkt[108], 100)                                   // priority
  assert.equal(pkt[111], 9)                                     // sequence
  assert.equal(pkt.readUInt16BE(113), 5)                        // universe
  assert.equal(pkt.readUInt16BE(115), 0x7000 | (636 - 115))
  assert.equal(pkt[117], 2); assert.equal(pkt[118], 0xa1)
  assert.equal(pkt.readUInt16BE(123), 511)                      // start code + 510 slots
  assert.equal(pkt[125], 0)                                     // DMX start code
  assert.equal(pkt[126 + 200], 200)
  assert.equal(sacnMulticast(5), '239.255.0.5')
  assert.equal(sacnMulticast(300), '239.255.1.44')
})

check('una configurazione sporca torna sana', () => {
  const c = sanitizePixelMap({ cols: 0, rows: 99999, fps: 'x', protocol: 'nope', universe: -3 })
  assert.deepEqual([c.cols, c.rows, c.fps, c.protocol, c.universe], [1, 1024, 30, 'sacn', 0])
})

console.log(`\n${checks} controlli passati`)
