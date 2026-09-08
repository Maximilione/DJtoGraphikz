#!/usr/bin/env node
/**
 * Beat detection still works?
 *
 * The adaptive threshold is the heart of beat detection, and it rests on a
 * median over the flux history. That median is written for speed (a shared
 * scratch buffer, sorted in place) so it is exactly the kind of code that
 * breaks quietly: the app keeps running and just stops finding beats.
 *
 *   node scripts/check-beat.mjs      # exit 0 = beats detected at the right rate
 */
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = mkdtempSync(join(tmpdir(), 'djg-beat-'))
const bundle = join(out, 'beat.cjs')

execFileSync('npx', ['esbuild', join(REPO, 'src/engine/audio/BeatTracker.ts'),
  '--bundle', '--format=cjs', '--platform=node', `--outfile=${bundle}`],
  { cwd: REPO, stdio: 'pipe' })

const { BeatTracker } = await import('file://' + bundle)

const BINS = 128
const BIN_HZ = 22050 / BINS
const FPS = 100                      // the app feeds the tracker on a 100Hz grid

/** Deterministic noise: a seeded run makes this a regression guard, not a dice roll */
function rng(seed) {
  let x = seed
  return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
}

/** Synthetic kick train: a bass-heavy burst every beat, decaying over ~80ms */
function run(bpm, seconds) {
  const rand = rng(12345)
  const tracker = new BeatTracker()
  const spec = new Float32Array(BINS)
  const period = 60 / bpm
  const frames = Math.round(seconds * FPS)
  let beats = 0

  for (let f = 0; f < frames; f++) {
    const t = f / FPS
    const since = t % period
    const kick = Math.exp(-since / 0.08)
    for (let i = 0; i < BINS; i++) {
      const hz = i * BIN_HZ
      const bass = hz < 150 ? kick : 0
      spec[i] = 40 * bass + 6 * rand()   // noise floor so flux is never flat
    }
    if (tracker.update(spec, BIN_HZ, t * 1000).beat) beats++
  }
  return beats
}

let failures = 0
for (const bpm of [120, 128, 140, 174]) {
  const seconds = 20
  const beats = run(bpm, seconds)
  const expected = (bpm / 60) * seconds
  const ratio = beats / expected
  const ok = ratio > 0.7 && ratio < 1.4
  console.log(`${bpm} BPM: ${beats} beat rilevati su ~${expected.toFixed(0)} attesi (${(ratio * 100).toFixed(0)}%) ${ok ? 'ok' : 'FALLITO'}`)
  if (!ok) failures++
}

// the threshold needs 16 frames of history before it may fire at all
const early = run(128, 0.15)
assert.equal(early, 0, 'nessun beat prima che la storia del flusso sia piena')

rmSync(out, { recursive: true, force: true })
if (failures) {
  console.error(`FALLITO: ${failures} tempi fuori tolleranza`)
  process.exit(1)
}
console.log('OK: il rilevamento dei beat segue il tempo')
