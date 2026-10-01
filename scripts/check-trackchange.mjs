#!/usr/bin/env node
/**
 * The track-change detector's promises, on synthetic frames:
 *
 * - a settled tempo (30 s) that moves > 1.5 % and holds 8 s is a change; a
 *   3 s blip is not, nor an octave flip of the tracker, nor an estimator
 *   hunting between two neighbouring tempi
 * - a confident key that changes and holds 10 s is a change; a weak one is not
 * - a break of >= 20 s ending in a drop is a change; a short break, or a
 *   break that fades into the groove, is not
 * - two audio detections never come closer than 60 s
 * - after a Pro DJ Link track the audio side is quiet for 30 s
 * - Pro DJ Link: id 0 and a repeated id are ignored, a new id fires
 *
 *     node scripts/check-trackchange.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const load = async (entry) => {
  const out = await build({ entryPoints: [join(REPO, entry)], bundle: true, format: 'esm', write: false, platform: 'neutral' })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}
const { TrackChangeDetector, TRACK_CHANGE } = await load('src/engine/audio/TrackChange.ts')

// The shipped hold times are 20 s (tuned on a tekno mix: 8 s let the tempo
// estimator's hunting through as "changes"). The mechanism is checked here at
// the shorter timings the scenarios were written for; the table is mutable
// for exactly this (check-phases sweeps it the same way).
assert.ok(TRACK_CHANGE.bpmHoldMs >= 20000 && TRACK_CHANGE.keyHoldMs >= 20000, 'le soglie di tenuta spedite sono 20 s')
TRACK_CHANGE.bpmHoldMs = 8000
TRACK_CHANGE.keyHoldMs = 10000

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

const Am = { tonic: 9, mode: 'minor', confidence: 0.8 }
const Fsm = { tonic: 6, mode: 'minor', confidence: 0.8 }
const Cmaj = { tonic: 0, mode: 'major', confidence: 0.8 }
const BASE = { bpm: 128, bpmConfidence: 1, key: Am, phase: 'groove' }

/** Feed `seconds` of frames (10 per second) from `t0`, returning the events. */
function run(det, t0, seconds, frame) {
  const events = []
  for (let t = t0; t < t0 + seconds * 1000; t += 100) {
    const ev = det.update({ ...BASE, ...frame, t })
    if (ev) events.push(ev)
  }
  return events
}
/** 40 s of steady 128 BPM in A minor: a settled reference, no event. */
const settle = (det) => { assert.equal(run(det, 0, 40, {}).length, 0, 'il primo aggancio non e\' un cambio'); return 40000 }

check('BPM: +3 % tenuto 8 s su un tempo assestato e\' un cambio, con il motivo', () => {
  const det = new TrackChangeDetector()
  const t0 = settle(det)
  assert.equal(run(det, t0, 7, { bpm: 132 }).length, 0, 'prima di 8 s nulla')
  const ev = run(det, t0 + 7000, 3, { bpm: 132 })
  assert.equal(ev.length, 1)
  assert.equal(ev[0].source, 'audio')
  assert.equal(ev[0].reason, 'BPM 128 → 132')
  assert.ok(ev[0].at >= t0 + 8000 && ev[0].at < t0 + 8200, `scatta a 8 s: ${ev[0].at}`)
})

check('BPM: un blip di 3 s, +1 %, letture senza confidenza e salti di ottava non sono cambi', () => {
  const det = new TrackChangeDetector()
  const t0 = settle(det)
  let ev = run(det, t0, 3, { bpm: 132 })
  ev = ev.concat(run(det, t0 + 3000, 30, { bpm: 128 }))
  assert.equal(ev.length, 0, 'blip')
  assert.equal(run(det, t0 + 33000, 30, { bpm: 129 }).length, 0, '+0.8 %')
  assert.equal(run(det, t0 + 63000, 30, { bpm: 140, bpmConfidence: 0.3 }).length, 0, 'confidenza bassa')
  assert.equal(run(det, t0 + 93000, 30, { bpm: 64 }).length, 0, 'ottava')
})

check('BPM: uno stimatore che oscilla fra 134.5 e 138.2 ogni 12 s non e\' mai un cambio', () => {
  const det = new TrackChangeDetector()
  let t = 0, events = 0
  for (let i = 0; i < 30; i++, t += 12000) events += run(det, t, 12, { bpm: i % 2 ? 138.2 : 134.5 }).length
  assert.equal(events, 0)
  // ...and a tempo that first settles for a minute, then is left for good, is
  assert.equal(run(det, t, 60, { bpm: 134.5 }).length, 0)
  assert.equal(run(det, t + 60000, 10, { bpm: 140 }).length, 1)
})

check('tonalita\': cambio con confidenza >= 0.5 tenuto 10 s', () => {
  const det = new TrackChangeDetector()
  const t0 = settle(det)
  assert.equal(run(det, t0, 9, { key: Fsm }).length, 0, 'prima di 10 s nulla')
  const ev = run(det, t0 + 9000, 3, { key: Fsm })
  assert.equal(ev.length, 1)
  assert.equal(ev[0].reason, 'tonalità Am → F#m')
})

check('tonalita\': confidenza sotto 0.5 ignorata, null ignorato', () => {
  const det = new TrackChangeDetector()
  const t0 = settle(det)
  assert.equal(run(det, t0, 30, { key: { ...Fsm, confidence: 0.3 } }).length, 0)
  assert.equal(run(det, t0 + 30000, 30, { key: null }).length, 0)
})

check('drop: pausa >= 20 s poi peak e\' un cambio', () => {
  const det = new TrackChangeDetector()
  const t0 = settle(det)
  assert.equal(run(det, t0, 24, { phase: 'break' }).length, 0, 'nella pausa nulla')
  const ev = run(det, t0 + 24000, 1, { phase: 'peak' })
  assert.equal(ev.length, 1)
  assert.equal(ev[0].reason, 'drop dopo 24 s di pausa')
})

check('drop: break → build → peak conta come una pausa sola', () => {
  const det = new TrackChangeDetector()
  const t0 = settle(det)
  run(det, t0, 15, { phase: 'break' })
  run(det, t0 + 15000, 10, { phase: 'build' })
  const ev = run(det, t0 + 25000, 1, { phase: 'peak' })
  assert.equal(ev.length, 1)
  assert.equal(ev[0].reason, 'drop dopo 25 s di pausa')
})

check('drop: pausa corta, o pausa che sfuma nel groove, non e\' un cambio', () => {
  const det = new TrackChangeDetector()
  const t0 = settle(det)
  run(det, t0, 10, { phase: 'break' })
  assert.equal(run(det, t0 + 10000, 10, { phase: 'peak' }).length, 0, 'pausa di 10 s')
  run(det, t0 + 20000, 30, { phase: 'break' })
  assert.equal(run(det, t0 + 50000, 10, { phase: 'groove' }).length, 0, 'uscita in groove')
  assert.equal(run(det, t0 + 60000, 10, { phase: 'peak' }).length, 0, 'peak dal groove')
})

check('cooldown: due rilevamenti audio mai a meno di 60 s', () => {
  const det = new TrackChangeDetector()
  const t0 = settle(det)
  const first = run(det, t0, 12, { key: Fsm })
  assert.equal(first.length, 1, 'scatta a 10 s')
  // a second key change maturing inside the minute: swallowed, but the reference moves to C
  const second = run(det, t0 + 12000, 40, { key: Cmaj })
  assert.equal(second.length, 0, 'dentro il minuto')
  run(det, t0 + 52000, 13, { key: Cmaj })
  // back to F#m, maturing after the minute: a change again, from C
  const third = run(det, t0 + 65000, 20, { key: Fsm })
  assert.equal(third.length, 1)
  assert.equal(third[0].reason, 'tonalità C → F#m')
  assert.ok(third[0].at - first[0].at >= 60000)
})

check('Pro DJ Link: id 0 e id ripetuto ignorati, id nuovo scatta', () => {
  const det = new TrackChangeDetector()
  assert.equal(det.feedProLink(0, 1000), null)
  const ev = det.feedProLink(42, 2000)
  assert.ok(ev)
  assert.equal(ev.source, 'prolink')
  assert.equal(ev.trackId, 42)
  assert.equal(ev.reason, 'Pro DJ Link')
  assert.equal(det.feedProLink(42, 3000), null)
  assert.equal(det.feedProLink(0, 4000), null)
  assert.equal(det.feedProLink(43, 5000).trackId, 43)
  assert.equal(det.last.trackId, 43)
})

check('dopo Pro DJ Link l\'euristica audio tace 30 s, poi riparte', () => {
  const det = new TrackChangeDetector()
  const t0 = settle(det)
  det.feedProLink(7, t0)
  // the tempo moves with the new track: matures 8 s in, inside the quiet window — absorbed
  assert.equal(run(det, t0, 35, { bpm: 132 }).length, 0, 'tace')
  // the quiet is over, 132 has settled: a new tempo is a change, from 132
  const ev = run(det, t0 + 35000, 12, { bpm: 136 })
  assert.equal(ev.length, 1)
  assert.equal(ev[0].reason, 'BPM 132 → 136', 'il riferimento si e\' mosso in silenzio')
})

console.log(`\n${checks} controlli ok`)
