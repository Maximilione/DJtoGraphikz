#!/usr/bin/env node
/**
 * Deck B video playlist (Q4): does the pure part still decide right?
 *
 * Which clip plays, when it changes and how fast it runs live in
 * src/engine/videoDeck.ts with no DOM, so this bundles that file and asserts:
 * playbackRate follows the BPM ratio inside Chromium's 0.0625..16 window, the
 * bar wrap is detected on the 1 → 0 drop only, clips advance on the Nth bar
 * and wrap to the first, and clipTime puts both windows on the same media
 * second from beatClock alone (the live BPM cancels out).
 *
 *   node scripts/check-videodeck.mjs      # exit 0 = all green
 */
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = mkdtempSync(join(tmpdir(), 'djg-videodeck-'))
const bundle = join(out, 'videodeck.cjs')

execFileSync('npx', ['esbuild', join(REPO, 'src/engine/videoDeck.ts'),
  '--bundle', '--format=cjs', '--platform=node', `--outfile=${bundle}`],
  { cwd: REPO, stdio: 'pipe' })

const vd = await import('file://' + bundle)
const { playbackRate, barWrapped, onBar, clipTime, loopDrift, clampClip, acceptsVideo, VIDEO_DECK_DEFAULT } = vd

try {
  // playbackRate: BPM ratio, clamped to what Chromium accepts
  assert.strictEqual(playbackRate(128, 128), 1)
  assert.strictEqual(playbackRate(140, 70), 2)
  assert.ok(Math.abs(playbackRate(96, 128) - 0.75) < 1e-9)
  assert.strictEqual(playbackRate(300, 10), 16, 'clamped high')
  assert.strictEqual(playbackRate(10, 300), 0.0625, 'clamped low')
  assert.strictEqual(playbackRate(0, 0), 1, 'no BPM yet → rate 1')

  // bar wrap: only the sawtooth drop counts
  assert.ok(barWrapped(0.97, 0.02))
  assert.ok(!barWrapped(0.30, 0.45))
  assert.ok(!barWrapped(0.52, 0.48), 'jitter is not a wrap')
  assert.ok(!barWrapped(0, 0), 'no audio, no wraps')

  // onBar: N bars per clip, wrap to the first, pure
  const clips = [{ path: 'a.mp4', name: 'a', bpm: 128 }, { path: 'b.mp4', name: 'b', bpm: 100 }, { path: 'c.webm', name: 'c', bpm: 128 }]
  let d = { ...VIDEO_DECK_DEFAULT, enabled: true, clips, barsPerClip: 2 }
  const d0 = d
  d = onBar(d, 4);  assert.strictEqual(d.clip, 0, 'bar 1 of 2: hold'); assert.strictEqual(d.bars, 1)
  d = onBar(d, 8);  assert.strictEqual(d.clip, 1, 'bar 2 of 2: advance'); assert.strictEqual(d.bars, 0); assert.strictEqual(d.clipStartBeat, 8)
  d = onBar(d, 12); d = onBar(d, 16); assert.strictEqual(d.clip, 2)
  d = onBar(d, 20); d = onBar(d, 24); assert.strictEqual(d.clip, 0, 'wraps to the first clip'); assert.strictEqual(d.clipStartBeat, 24)
  assert.strictEqual(d0.clip, 0, 'input not mutated'); assert.strictEqual(d0.bars, 0)
  // every bar with N=1; a single clip restarts itself on the bar
  let one = { ...VIDEO_DECK_DEFAULT, enabled: true, clips: clips.slice(0, 1), barsPerClip: 1 }
  one = onBar(one, 4); assert.strictEqual(one.clip, 0); assert.strictEqual(one.clipStartBeat, 4, 'single clip re-seeks on the bar')
  // disabled or empty: untouched
  const off = { ...VIDEO_DECK_DEFAULT, clips }
  assert.strictEqual(onBar(off, 4), off)
  const empty = { ...VIDEO_DECK_DEFAULT, enabled: true }
  assert.strictEqual(onBar(empty, 4), empty)

  // clipTime: 8 beats into a 120 BPM clip = 4 s, whatever the live BPM; loops on duration
  assert.ok(Math.abs(clipTime(108, 100, 120, 30) - 4) < 1e-9)
  assert.strictEqual(clipTime(100, 100, 120, 30), 0, 'starts at 0')
  assert.ok(Math.abs(clipTime(100 + 64, 100, 120, 30) - 2) < 1e-9, '32 s on a 30 s clip → 2 s')
  assert.strictEqual(clipTime(90, 100, 120, 30), 0, 'before the start (stale snapshot) clamps to 0')
  assert.strictEqual(clipTime(108, 100, 120, NaN), 0, 'no metadata yet')

  // loopDrift: the wrap is not a drift
  assert.ok(Math.abs(loopDrift(29.9, 0.1, 30) - 0.2) < 1e-9)
  assert.ok(Math.abs(loopDrift(5, 6, 30) - 1) < 1e-9)

  // clampClip after removals
  assert.strictEqual(clampClip({ ...VIDEO_DECK_DEFAULT, clips: clips.slice(0, 2), clip: 5 }).clip, 1)
  assert.strictEqual(clampClip({ ...VIDEO_DECK_DEFAULT, clips: [], clip: 2 }).clip, 0)

  // what the <video> can decode
  assert.ok(acceptsVideo('loop.MP4') && acceptsVideo('x.webm') && acceptsVideo('y.mov') && acceptsVideo('z.m4v'))
  assert.ok(!acceptsVideo('pack.mkv') && !acceptsVideo('hap.avi') && !acceptsVideo('still.png'))

  console.log('check:videodeck OK — rate, bar wrap, N-bar advance, clipTime, drift, extensions')
} finally {
  rmSync(out, { recursive: true, force: true })
}
