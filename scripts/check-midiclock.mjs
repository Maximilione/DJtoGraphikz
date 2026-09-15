#!/usr/bin/env node
/**
 * The MIDI clock is a parser, and a parser that is quietly half a beat off
 * puts every visual on the offbeat for a whole set — which looks like the
 * beat detection is broken, not like the clock is. So it gets fed a
 * synthetic transport and asserted on.
 *
 *     node scripts/check-midiclock.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))

const out = await build({
  entryPoints: [join(REPO, 'src/engine/audio/MidiClock.ts')],
  bundle: true, format: 'esm', write: false, platform: 'neutral',
})
const { MidiClock, MIDI_CLOCK, MIDI_START, MIDI_STOP, MIDI_CONTINUE, MIDI_SONG_POSITION } =
  await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

/** Tick a clock at `bpm` for `beats` beats, starting at t0. Returns the end time. */
function run(clock, bpm, beats, t0 = 1000, jitterMs = 0) {
  const tick = 60000 / (bpm * 24)
  let t = t0
  for (let i = 0; i < beats * 24; i++) {
    t += tick
    const j = jitterMs ? (Math.sin(i * 12.9898) * jitterMs) : 0
    clock.onByte(MIDI_CLOCK, t + j)
  }
  return t
}

check('un clock a 128 BPM legge 128 BPM', () => {
  const c = new MidiClock()
  c.onByte(MIDI_START, 1000)
  const t = run(c, 128, 4)
  const s = c.read(t)
  assert.equal(s.running, true)
  assert.ok(Math.abs(s.bpm - 128) < 0.5, `bpm=${s.bpm}`)
})

check('174 BPM drum & bass, e 92 a mezza velocita', () => {
  for (const bpm of [92, 128, 174]) {
    const c = new MidiClock()
    c.onByte(MIDI_START, 0)
    const t = run(c, bpm, 4, 0)
    assert.ok(Math.abs(c.read(t).bpm - bpm) < 0.5, `${bpm} -> ${c.read(t).bpm}`)
  }
})

check('la fase sta a 0 sul battito e a mezzo a meta battito', () => {
  const c = new MidiClock()
  c.onByte(MIDI_START, 1000)
  const t = run(c, 120, 2)           // 2 beats = 48 ticks, we are ON a beat
  const onBeat = c.read(t)
  assert.ok(onBeat.beatPhase < 0.02, `fase sul battito = ${onBeat.beatPhase}`)
  const t2 = run(c, 120, 0.5, t)     // +12 ticks = half a beat
  const half = c.read(t2)
  assert.ok(Math.abs(half.beatPhase - 0.5) < 0.02, `mezza fase = ${half.beatPhase}`)
})

check('la fase scorre fra un tick e l\'altro', () => {
  const c = new MidiClock()
  c.onByte(MIDI_START, 1000)
  const t = run(c, 120, 1)
  const a = c.read(t).beatPhase
  const b = c.read(t + 5).beatPhase   // 5ms later, no tick arrived
  assert.ok(b > a, `la fase non si muove fra i tick: ${a} -> ${b}`)
})

check('Start e un downbeat: la fase di battuta riparte da zero', () => {
  const c = new MidiClock()
  c.onByte(MIDI_START, 0)
  let t = run(c, 120, 3, 0)           // three beats in
  assert.ok(c.read(t).barPhase > 0.7, 'dovremmo essere sul quarto movimento')
  c.onByte(MIDI_START, t)
  t = run(c, 120, 0.25, t)
  assert.ok(c.read(t).barPhase < 0.1, `Start non ha riportato alla battuta: ${c.read(t).barPhase}`)
})

check('il battito viene segnalato una volta sola', () => {
  const c = new MidiClock()
  c.onByte(MIDI_START, 1000)
  const t = run(c, 120, 1)
  assert.equal(c.read(t).beatDetected, true)
  assert.equal(c.read(t).beatDetected, true, 'leggere non deve consumare')
  c.clearBeat()
  assert.equal(c.read(t + 1).beatDetected, false, 'segnalato due volte')
})

check('quattro movimenti fanno una battuta', () => {
  const c = new MidiClock()
  c.onByte(MIDI_START, 0)
  let t = 0
  const bars = []
  for (let b = 0; b < 4; b++) {
    t = run(c, 120, 1, t)
    bars.push(Math.round(c.read(t).barPhase * 4) % 4)
  }
  assert.deepEqual(bars, [1, 2, 3, 0])
})

check('il puntatore di posizione mette il clock nella battuta giusta', () => {
  const c = new MidiClock()
  c.onByte(MIDI_START, 0)
  run(c, 120, 2, 0)
  // 4 sedicesimi = un movimento: siamo sul secondo movimento della battuta
  c.onByte(MIDI_SONG_POSITION, 5000, 4, 0)
  const t = run(c, 120, 1 / 24, 5000)   // un tick solo, per riavviare l'orologio
  assert.ok(Math.abs(c.read(t).barPhase - 0.25) < 0.03, `barPhase = ${c.read(t).barPhase}`)
})

check('Stop spegne il clock, Continue lo riaccende', () => {
  const c = new MidiClock()
  c.onByte(MIDI_START, 0)
  let t = run(c, 120, 2, 0)
  assert.equal(c.read(t).running, true)
  c.onByte(MIDI_STOP, t)
  assert.equal(c.read(t).running, false)
  c.onByte(MIDI_CONTINUE, t)
  t = run(c, 120, 1, t)
  assert.equal(c.read(t).running, true)
})

check('un transport che sparisce non resta "in corso" per sempre', () => {
  const c = new MidiClock()
  c.onByte(MIDI_START, 0)
  const t = run(c, 120, 2, 0)
  assert.equal(c.read(t).running, true)
  assert.equal(c.read(t + 3000).running, false, 'clock morto ancora dichiarato vivo')
})

check('un messaggio in ritardo non sposta il tempo', () => {
  const c = new MidiClock()
  c.onByte(MIDI_START, 1000)
  let t = run(c, 128, 2)
  const tick = 60000 / (128 * 24)
  // un tick arriva con 8ms di ritardo, il successivo recupera
  t += tick + 8; c.onByte(MIDI_CLOCK, t)
  t += tick - 8; c.onByte(MIDI_CLOCK, t)
  t = run(c, 128, 1, t)
  assert.ok(Math.abs(c.read(t).bpm - 128) < 1, `bpm dopo il ritardo = ${c.read(t).bpm}`)
})

check('un buco nel clock non produce un tempo assurdo', () => {
  const c = new MidiClock()
  c.onByte(MIDI_START, 0)
  let t = run(c, 128, 2, 0)
  t += 900                            // il cavo si stacca per quasi un secondo
  c.onByte(MIDI_CLOCK, t)
  const s = c.read(t)
  assert.ok(s.bpm === 0 || Math.abs(s.bpm - 128) < 5, `bpm = ${s.bpm}`)
})

check('senza abbastanza tick non dichiara un tempo', () => {
  const c = new MidiClock()
  c.onByte(MIDI_START, 0)
  run(c, 128, 0.1, 0)                 // ~2 tick
  assert.equal(c.read(100).running, false)
})

check('reset dimentica tutto', () => {
  const c = new MidiClock()
  c.onByte(MIDI_START, 0)
  const t = run(c, 128, 2, 0)
  assert.equal(c.seen, true)
  c.reset()
  assert.equal(c.seen, false)
  assert.equal(c.read(t).running, false)
})

console.log(`\n${checks} controlli passati`)
