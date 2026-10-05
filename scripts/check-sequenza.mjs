#!/usr/bin/env node
/**
 * Image sequences: natural ordering, frame from time/beat, RAM window.
 * The pure part lives in src/shared/imageSequence.ts (no DOM), bundled here.
 *
 *   node scripts/check-sequenza.mjs      # exit 0 = all green
 */
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = mkdtempSync(join(tmpdir(), 'djg-sequenza-'))
const bundle = join(out, 'seq.cjs')
const bundleFmt = join(out, 'fmt.cjs')
for (const [src, dst] of [['imageSequence', bundle], ['mediaFormats', bundleFmt]]) {
  execFileSync('npx', ['esbuild', join(REPO, `src/shared/${src}.ts`),
    '--bundle', '--format=cjs', '--platform=node', `--outfile=${dst}`], { cwd: REPO, stdio: 'pipe' })
}
const s = await import('file://' + bundle)
const f = await import('file://' + bundleFmt)
const { sortNatural, frameAtTime, frameAtBeat, frameAtDeck, cacheCap, keepWindow, SEQ_MAX_CACHED } = s.default ?? s

// natural order: numbers compare as numbers, padding or not
assert.deepStrictEqual(
  sortNatural(['frame_10.png', 'frame_2.png', 'frame_001.png', 'frame_1.png']),
  ['frame_001.png', 'frame_1.png', 'frame_2.png', 'frame_10.png'])
assert.deepStrictEqual(sortNatural(['b2.png', 'a10.png', 'a9.png']), ['a9.png', 'a10.png', 'b2.png'])
assert.deepStrictEqual(sortNatural(['F_2.png', 'f_1.png']), ['f_1.png', 'F_2.png'])

// free-running: fps over wall time, looping
assert.strictEqual(frameAtTime(0, 30, 100), 0)
assert.strictEqual(frameAtTime(1000, 30, 100), 30)
assert.strictEqual(frameAtTime(1000, 30, 25), 5)       // 30 mod 25
assert.strictEqual(frameAtTime(-500, 30, 25), 0)
assert.strictEqual(frameAtTime(500, 0, 100), 15)       // fps 0 falls back to 30
assert.strictEqual(frameAtTime(500, 30, 0), 0)

// beat-locked: 1 loop = N beats, on the absolute beat grid
assert.strictEqual(frameAtBeat(0, 4, 100), 0)
assert.strictEqual(frameAtBeat(2, 4, 100), 50)
assert.strictEqual(frameAtBeat(4, 4, 100), 0)          // wraps on the loop boundary
assert.strictEqual(frameAtBeat(3.999, 4, 100), 99)
assert.strictEqual(frameAtBeat(-1, 4, 100), 75)
assert.strictEqual(frameAtBeat(1, 0, 100), 0)

// deck: native bpm sets the speed like a video clip (1 beat @120 = 0.5 s)
assert.strictEqual(frameAtDeck(10, 8, 120, 30, 1000), 30)   // 2 beats = 1 s = 30 frames
assert.strictEqual(frameAtDeck(8, 8, 120, 30, 1000), 0)
assert.strictEqual(frameAtDeck(5, 8, 120, 30, 1000), 0)     // before the start clamps
assert.strictEqual(frameAtDeck(10, 8, 120, 30, 20), 10)     // loops

// RAM: 4K frames shrink the window, small ones hit the frame cap, never below 8
assert.strictEqual(cacheCap(640, 360), SEQ_MAX_CACHED)
assert.ok(cacheCap(3840, 2160) < 40 && cacheCap(3840, 2160) >= 8)
assert.strictEqual(cacheCap(16000, 16000), 8)

// window: current first, upcoming next (wrapping), a few behind; whole loop if it fits
assert.deepStrictEqual(keepWindow(3, 5, 300), [3, 4, 0, 1, 2])
const w = keepWindow(98, 1000, 40)
assert.strictEqual(w.length, 40)
assert.strictEqual(w[0], 98)
assert.strictEqual(w[1], 99)
assert.ok(w.includes(97) && w.includes(94) && !w.includes(93))
assert.strictEqual(new Set(w).size, 40)
assert.deepStrictEqual(keepWindow(998, 1000, 40).slice(0, 4), [998, 999, 0, 1])   // wrap
assert.deepStrictEqual(keepWindow(0, 0, 40), [])

// formats: frames Chromium decodes vs the ones that need a conversion
assert.ok(f.SEQ_RE.test('frame_0001.PNG') && f.SEQ_RE.test('a.webp') && f.SEQ_RE.test('a.avif'))
assert.ok(!f.SEQ_RE.test('a.exr') && !f.SEQ_RE.test('a.dpx'))
assert.ok(f.SEQ_CONVERT_RE.test('a.exr') && f.SEQ_CONVERT_RE.test('a.DPX') && f.SEQ_CONVERT_RE.test('a.tif'))

rmSync(out, { recursive: true, force: true })
console.log('check-sequenza: OK')
