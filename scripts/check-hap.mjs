#!/usr/bin/env node
/**
 * HAP frame decoder (src/engine/hap.ts): does it actually decode a frame, or
 * does an HAP clip just turn into a silently black/corrupt texture?
 *
 * Builds valid HAP section buffers BY HAND (no encoder/ffmpeg needed — not
 * guaranteed installed) and asserts the pure decoder in hap.ts returns the
 * exact raw DXT1 bytes back out: a bare section, a Snappy-compressed one, a
 * Decode Instructions (multi-chunk) one, an out-of-scope fourcc/type byte
 * (must error, not crash or go quiet), and the block-count rounding for
 * non-multiple-of-4 frame sizes.
 *
 *   node scripts/check-hap.mjs      # exit 0 = all green
 */
import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import * as SnappyJS from 'snappyjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))

async function load(file) {
  const out = await build({
    entryPoints: [join(REPO, 'src/engine', file)],
    bundle: true, format: 'esm', write: false, platform: 'node',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

const { decodeHapFrame, dxtBufferSize } = await load('hap.ts')

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

// ---- fixtures: one hand-built 4x4 DXT1 block, solid red ----
// color0 = 0xF800 (RGB565 red), color1 = 0x0000, all 16 indices = 0 (index 0
// is always color0, in both DXT1 modes) — 8 bytes, exactly one block.
const redBlock = Uint8Array.from([0x00, 0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

/** Short-form section header (4 byte: 24-bit LE size + type byte) + payload. */
function section(type, payload) {
  assert.ok(payload.length > 0 && payload.length < 0x1000000, 'fixture payload fits a short header')
  const out = new Uint8Array(4 + payload.length)
  out[0] = payload.length & 0xff
  out[1] = (payload.length >> 8) & 0xff
  out[2] = (payload.length >> 16) & 0xff
  out[3] = type
  out.set(payload, 4)
  return out
}

// ---- 1: raw DXT1 section (type 0xAB), no second-stage compression ----
check('Hap1 raw section: round-trips the exact 8 bytes', () => {
  const frame = section(0xab, redBlock)
  const out = decodeHapFrame(frame, 'Hap1', 4, 4)
  assert.deepEqual(Buffer.from(out), Buffer.from(redBlock))
})

// ---- 2: Snappy-compressed DXT1 section (type 0xBB) ----
check('Hap1 Snappy section: decompresses to the same 8 bytes', () => {
  const compressed = SnappyJS.compress(redBlock)
  const frame = section(0xbb, compressed)
  const out = decodeHapFrame(frame, 'Hap1', 4, 4)
  assert.deepEqual(Buffer.from(out), Buffer.from(redBlock))
})

// ---- 3: Decode Instructions (type 0xCB), 2 chunks: plain + Snappy ----
check('Hap1 Decode Instructions: 2 chunks (plain, Snappy) concatenate to the expected buffer', () => {
  // Two 4x4 blocks side by side = an 8x4 frame = ceil(8/4)*ceil(4/4) = 2 blocks.
  const blockA = redBlock
  const blockB = Uint8Array.from([0x1f, 0x00, 0x00, 0xf8, 0x00, 0x00, 0x00, 0x00]) // arbitrary, just distinct
  const chunk0 = blockA                      // compressor 0x0A: none
  const chunk1 = SnappyJS.compress(blockB)   // compressor 0x0B: Snappy

  const compressorTable = section(0x02, Uint8Array.from([0x0a, 0x0b]))
  const sizeTable = section(0x03, (() => {
    const b = new Uint8Array(8)
    const v = new DataView(b.buffer)
    v.setUint32(0, chunk0.length, true)
    v.setUint32(4, chunk1.length, true)
    return b
  })())
  const container = section(0x01, new Uint8Array([...compressorTable, ...sizeTable]))
  const payload = new Uint8Array([...container, ...chunk0, ...chunk1])
  const frame = section(0xcb, payload)

  const out = decodeHapFrame(frame, 'Hap1', 8, 4)
  const expected = new Uint8Array([...blockA, ...blockB])
  assert.deepEqual(Buffer.from(out), Buffer.from(expected))
})

// ---- 4: out-of-scope variant (table says HapY = type 0xAF) must error, not crash/go quiet ----
check('out-of-scope section type (0xAF, HapY) throws a clear error', () => {
  const frame = section(0xaf, Uint8Array.from([0, 0, 0, 0]))
  assert.throws(() => decodeHapFrame(frame, 'Hap1', 4, 4), /fuori scope/)
})

check('unknown/corrupt section type throws, does not return a buffer', () => {
  const frame = section(0x42, Uint8Array.from([0, 0, 0, 0]))
  assert.throws(() => decodeHapFrame(frame, 'Hap1', 4, 4))
})

// ---- 5: block-count rounding for non-multiple-of-4 dimensions ----
check('dxtBufferSize rounds block counts up (10x6, 5x5)', () => {
  assert.equal(dxtBufferSize('dxt1', 10, 6), Math.ceil(10 / 4) * Math.ceil(6 / 4) * 8)
  assert.equal(dxtBufferSize('dxt1', 10, 6), 3 * 2 * 8)
  assert.equal(dxtBufferSize('dxt5', 10, 6), 3 * 2 * 16)
  assert.equal(dxtBufferSize('dxt1', 5, 5), 2 * 2 * 8)
  assert.equal(dxtBufferSize('dxt5', 5, 5), 2 * 2 * 16)
})

// ---- fourcc/type-byte mismatch guard (declared Hap1 but a DXT5 section arrives) ----
check('type byte for the other format throws instead of mis-decoding', () => {
  const frame = section(0xae, redBlock) // DXT5 raw, declared as Hap1
  assert.throws(() => decodeHapFrame(frame, 'Hap1', 4, 4), /non combacia/)
})

console.log(`[check-hap] ${checks} check passati`)
