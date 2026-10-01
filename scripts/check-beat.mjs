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

const BINS = 512                     // 43 Hz per bin: the kick spans a few bins, as in the app (1024)
const BIN_HZ = 22050 / BINS
const FPS = 100                      // the app feeds the tracker on a 100Hz grid

/** Deterministic noise: a seeded run makes this a regression guard, not a dice roll */
function rng(seed) {
  let x = seed
  return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
}

/** Synthetic kick train: a bass-heavy burst every beat, decaying over ~80ms */
function run(bpm, seconds, stab = false) {
  const rand = rng(12345)
  const tracker = new BeatTracker()
  tracker.tempoPrior = bpm   // the app centres the prior on the genre's tempo
  const spec = new Float32Array(BINS)
  const period = 60 / bpm
  const frames = Math.round(seconds * FPS)
  let beats = 0
  const beatTimes = []

  for (let f = 0; f < frames; f++) {
    const t = f / FPS
    const since = t % period
    const kick = Math.exp(-since / 0.08)
    // a louder broadband stab on a dotted-eighth delay: the classic house
    // pattern that made the hard resync fire on every hit
    const sinceStab = t % (period * 0.75)
    const hit = stab ? 0.8 * Math.exp(-sinceStab / 0.05) : 0
    for (let i = 0; i < BINS; i++) {
      const hz = i * BIN_HZ
      const bass = hz < 150 ? kick : 0
      // magnitudes 0..1 as the app feeds them (byte/255). The old 0..40 scale
      // put the noise floor in the steep part of log1p and the threshold
      // tracked the noise, not the kicks.
      // the stab is a chord/clap: everything above 300 Hz, nothing in the kick band
      spec[i] = 0.7 * bass + (hz > 300 ? 0.5 * hit : 0) + 0.05 + 0.03 * rand()   // noise floor so flux is never flat
    }
    if (tracker.update(spec, BIN_HZ, t * 1000).beat) { beats++; beatTimes.push(t) }
  }
  lastAccepted = { ...tracker.accepted, acfBpm: Math.round(tracker.acfBpm) }
  lastBeatTimes = beatTimes
  return beatTimes.filter(t => t > 8).length
}
let lastBeatTimes = []
let lastAccepted = null

let failures = 0
for (const bpm of [120, 128, 140, 174]) {
  const seconds = 28
  const beats = run(bpm, seconds)
  const expected = (bpm / 60) * (seconds - 8)   // counted after the 8 s lock-in
  const ratio = beats / expected
  const ok = ratio > 0.85 && ratio < 1.15
  console.log(`${bpm} BPM: ${beats} beat rilevati su ~${expected.toFixed(0)} attesi (${(ratio * 100).toFixed(0)}%) ${ok ? 'ok' : 'FALLITO'}`)
  if (!ok) failures++
}

// syncopation: with a stab every 3/16 the grid must stay on the kick, not
// re-anchor on every stab (that ran the beat count at 4/3 of the tempo).
// Measured after the tempo locks (first 8 s skipped): how many kicks got a
// beat within 60 ms, and how many beats fell nowhere near a kick.
{
  const seconds = 40, bpm = 128, period = 60 / bpm
  run(bpm, seconds, true)
  const beats = lastBeatTimes.filter(t => t > 8)
  const kicks = []
  for (let t = Math.ceil(8 / period) * period; t < seconds; t += period) kicks.push(t)
  const near = (t, arr) => arr.some(k => Math.abs(k - t) < 0.06)
  const hit = kicks.filter(k => near(k, beats)).length / kicks.length
  const stray = beats.filter(b => !near(b, kicks)).length / beats.length
  const ok = hit > 0.85 && stray < 0.15
  console.log(`128 BPM con stab in sincope: ${(hit * 100).toFixed(0)}% dei kick hanno un beat, ${(stray * 100).toFixed(0)}% dei beat sono fuori dal kick ${ok ? 'ok' : 'FALLITO'}`)
  console.log('   accettati per: ' + JSON.stringify(lastAccepted))
  if (!ok) failures++
}

// the threshold needs 16 frames of history before it may fire at all
const early = (run(128, 0.15), lastBeatTimes.length)
assert.equal(early, 0, 'nessun beat prima che la storia del flusso sia piena')

rmSync(out, { recursive: true, force: true })
if (failures) {
  console.error(`FALLITO: ${failures} tempi fuori tolleranza`)
  process.exit(1)
}
console.log('OK: il rilevamento dei beat segue il tempo')
