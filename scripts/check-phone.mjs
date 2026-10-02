#!/usr/bin/env node
/**
 * Phone / OSC / MIDI commands: the pure part. Hostile input must never reach
 * the engine (NaN master = black projector, unknown id in the post chain).
 *
 *   node scripts/check-phone.mjs
 */
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import assert from 'assert'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = mkdtempSync(join(tmpdir(), 'djg-phone-'))
const bundle = join(out, 'phoneCmd.cjs')
execFileSync('npx', ['esbuild', join(REPO, 'src/renderer/phoneCmd.ts'),
  '--bundle', '--format=cjs', '--platform=node', `--outfile=${bundle}`], { cwd: REPO, stdio: 'pipe' })
const { sanitizeCmd, stepPalette } = createRequire(import.meta.url)(bundle)

const K = {
  effects: new Set(['plasma', 'tunnel']), posts: new Set(['bloom', 'feedback']),
  transitions: new Set(['crossfade', 'radial']), blendModes: new Set(['add', 'mix']),
  genres: new Set(['techno', 'house']), sources: new Set(['none', 'bass', 'beat']),
}
const S = (type, value, extra) => sanitizeCmd({ type, value, ...extra }, K)
const val = (type, value) => S(type, value)?.value

let failed = 0
const check = (name, fn) => {
  try { fn(); console.log(`  ok   ${name}`) } catch (e) { failed++; console.log(`  FAIL ${name}: ${e.message}`) }
}

check('numeri fuori range clampati', () => {
  assert.equal(val('brightness', 7), 1)
  assert.equal(val('brightness', -3), 0)
  assert.equal(val('motionBlur', 5), 0.95)
  assert.equal(val('bpmSet', 10), 60)
  assert.equal(val('bpmSet', 999), 300)
  assert.equal(val('transitionDuration', 1e9), 10)
})
check('NaN, Infinity, stringhe, null: scartati', () => {
  for (const bad of [NaN, Infinity, -Infinity, '0.5', null, undefined, {}, [], true])
    for (const t of ['brightness', 'crossfade', 'intensity', 'maskSoft', 'motionBlur', 'bpmSet', 'transitionDuration'])
      assert.equal(S(t, bad), null, `${t} accettato ${JSON.stringify(bad)}`)
})
check('comando senza tipo o non oggetto: scartato', () => {
  for (const bad of [null, undefined, 5, 'x', [], {}, { type: 3 }]) assert.equal(sanitizeCmd(bad, K), null)
})
check('tipo sconosciuto scartato', () => assert.equal(S('rm-rf', 1), null))
check('id sconosciuti (effetto, post, deck B, genere, blend, transizione) scartati', () => {
  assert.equal(S('effect', 'nope'), null)
  assert.equal(S('deckB', '__proto__'), null)
  assert.equal(S('post', 'nope'), null)
  assert.equal(S('genre', 'polka'), null)
  assert.equal(S('blendMode', 'nope'), null)
  assert.equal(S('transitionType', 'nope'), null)
  assert.equal(S('postAmount', { id: 'nope', value: 0.5 }), null)
  assert.equal(S('postMove', { id: 'nope', delta: 1 }), null)
  assert.equal(val('effect', 'plasma'), 'plasma')
})
check('post: amount clampato, delta ridotto a +-1', () => {
  assert.deepEqual(val('postAmount', { id: 'bloom', value: 9 }), { id: 'bloom', value: 1 })
  assert.equal(val('postMove', { id: 'bloom', delta: -40 }).delta, -1)
  assert.equal(val('postMove', { id: 'bloom', delta: 7 }).delta, 1)
})
check('palette: tre colori esadecimali, altro scartato', () => {
  assert.deepEqual(val('palette', ['#fff', '#00ff88', '#FF00AA']), ['#fff', '#00ff88', '#FF00AA'])
  for (const bad of [['#fff'], ['red', 'green', 'blue'], [1, 2, 3], 'x', ['#fff', '#fff', '#fff', '#fff'], [null, null, null]])
    assert.equal(S('palette', bad), null)
})
check('grade: chiave ignota scartata, valore clampato', () => {
  assert.equal(S('grade', { key: 'evil', value: 1 }), null)
  assert.equal(S('grade', { key: 'exposure', value: NaN }), null)
  assert.equal(val('grade', { key: 'exposure', value: 99 }).value, 2)
  assert.equal(val('grade', { key: 'lift', value: -9 }).value, -0.5)
})
check('camera: chiavi note clampate, il resto ignorato, vuota scartata', () => {
  assert.deepEqual(val('camera', { zoom: 99, rotation: 900, tile: 3.4, evil: 1, push: NaN }), { zoom: 4, rotation: 180, tile: 3.4 })
  assert.equal(S('camera', { evil: 1 }), null)
  assert.equal(S('camera', 5), null)
})
check('mapping audio: sorgente ignota scartata, profondita clampata', () => {
  assert.equal(S('paramMap', { key: 'a', source: 'evil', depth: 0 }), null)
  assert.equal(val('paramMap', { key: 'a', source: 'bass', depth: 9 }).depth, 1)
  assert.equal(S('param', { key: '', value: 1 }), null)
  assert.equal(S('param', { key: 'x'.repeat(200), value: 1 }), null)
})
check('look: solo interi 0..15', () => {
  assert.equal(val('look', 0), 0)
  assert.equal(val('look', 15), 15)
  for (const bad of [-1, 16, 1.5, '3', NaN]) assert.equal(S('look', bad), null)
})
check('booleani: true/false/1/0, altro scartato; autovj accetta __toggle__', () => {
  assert.equal(val('blackout', true), true)
  assert.equal(val('freeze', 0), false)
  assert.equal(S('blackout', 'yes'), null)
  assert.equal(val('autovj', '__toggle__'), '__toggle__')
  assert.equal(S('autovj', 'maybe'), null)
})
check('BPM: modi noti, scala solo 1/2 e 2, set clampato', () => {
  assert.equal(val('bpmMode', 'manual'), 'manual')
  assert.equal(S('bpmMode', 'midi'), null)
  assert.equal(val('bpmScale', 0.5), 0.5)
  assert.equal(val('bpmScale', 2), 2)
  assert.equal(S('bpmScale', 3), null)
})
check('palette successiva: gira, rientra, parte dal bordo se sconosciuta', () => {
  const L = [{ colors: ['#a', '#b', '#c'] }, { colors: ['#d', '#e', '#f'] }, { colors: ['#g', '#h', '#i'] }]
  assert.equal(stepPalette(L, ['#a', '#b', '#c'], 1), L[1])
  assert.equal(stepPalette(L, ['#g', '#h', '#i'], 1), L[0])
  assert.equal(stepPalette(L, ['#a', '#b', '#c'], -1), L[2])
  assert.equal(stepPalette(L, ['#X', '#Y', '#Z'], 1), L[0])
  assert.equal(stepPalette(L, undefined, -1), L[2])
  assert.equal(stepPalette([], ['#a'], 1), null)
  assert.equal(val('paletteStep', 1), 1)
  assert.equal(S('paletteStep', 2), null)
})
check('video deck: barre solo tra le scelte, clip intero, vuoto scartato', () => {
  assert.deepEqual(val('videoDeck', { enabled: true, clip: 2, barsPerClip: 8, evil: 1 }), { enabled: true, clip: 2, barsPerClip: 8 })
  assert.equal(S('videoDeck', { barsPerClip: 3 }), null)
  assert.equal(S('videoDeck', { clip: -1 }), null)
  assert.equal(S('videoDeck', {}), null)
})
check('cicla palette: intervallo e battiti clampati', () => {
  assert.deepEqual(val('cycle', { intervalMs: 5, beatsPerSwitch: 9999, enabled: true }), { enabled: true, intervalMs: 1000, beatsPerSwitch: 64 })
  assert.equal(S('cycle', { intervalMs: NaN }), null)
})
check('overlay: id obbligatorio, opacita clampata, nessun campo scartato', () => {
  assert.deepEqual(val('overlay', { id: 'a', opacity: 3, visible: false }), { id: 'a', visible: false, opacity: 1 })
  assert.equal(S('overlay', { opacity: 0.5 }), null)
  assert.equal(S('overlay', { id: 'a' }), null)
})
check('source e hold conservati solo se sensati', () => {
  const c = S('post', 'bloom', { source: 'telefono', hold: 'post:bloom' })
  assert.equal(c.source, 'telefono'); assert.equal(c.hold, 'post:bloom')
  const d = S('post', 'bloom', { source: 5, hold: 'x'.repeat(500) })
  assert.equal(d.source, undefined); assert.equal(d.hold, undefined)
})

rmSync(out, { recursive: true, force: true })
if (failed) { console.log(`\n${failed} fallite`); process.exit(1) }
console.log('\ncheck-phone: tutto ok')
