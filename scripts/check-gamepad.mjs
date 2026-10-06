#!/usr/bin/env node
/** Gamepad: edge detection, dead zone, axis normalisation, learn.  node scripts/check-gamepad.mjs */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({ entryPoints: [join(REPO, 'src/renderer/gamepadLogic.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const { GamepadTracker, normalizeAxis, DEAD_ZONE, bindingKey } =
  await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

const check = (name, fn) => { fn(); console.log('  ok', name) }
const fr = (buttons, axes = []) => ({ buttons, axes })

check('dead zone: centro = 0.5, estremi 0 e 1', () => {
  assert.equal(normalizeAxis(0), 0.5)
  assert.equal(normalizeAxis(DEAD_ZONE - 0.01), 0.5)
  assert.equal(normalizeAxis(-DEAD_ZONE + 0.01), 0.5)
  assert.equal(normalizeAxis(1), 1)
  assert.equal(normalizeAxis(-1), 0)
  assert.ok(normalizeAxis(DEAD_ZONE + 0.01) > 0.5)
  assert.equal(normalizeAxis(NaN), 0.5)
  assert.equal(normalizeAxis(5), 1)
})
check("il primo frame e' solo baseline (tasto gia' giu' non preme)", () => {
  const t = new GamepadTracker()
  assert.deepEqual(t.poll(0, fr([1, 0])), [])
})
check('pressed / released sulle soglie, una volta sola', () => {
  const t = new GamepadTracker()
  t.poll(0, fr([0]))
  const d = t.poll(0, fr([1]))
  assert.equal(d.length, 1); assert.ok(d[0].pressed && !d[0].released)
  assert.deepEqual(t.poll(0, fr([1])), [])
  const u = t.poll(0, fr([0]))
  assert.ok(u[0].released && !u[0].pressed)
})
check('grilletto analogico: valori intermedi passano, edge a 0.5', () => {
  const t = new GamepadTracker()
  t.poll(0, fr([0]))
  assert.ok(!t.poll(0, fr([0.3]))[0].pressed)
  assert.ok(t.poll(0, fr([0.6]))[0].pressed)
})
check('asse: debounce e dead zone silenziosa', () => {
  const t = new GamepadTracker()
  t.poll(0, fr([], [0]))
  assert.deepEqual(t.poll(0, fr([], [0.05])), [])
  const e = t.poll(0, fr([], [1]))
  assert.equal(e[0].value, 1)
  assert.deepEqual(t.poll(0, fr([], [1])), [])
})
check('pad indipendenti e drop riparte da baseline', () => {
  const t = new GamepadTracker()
  t.poll(0, fr([0])); t.poll(1, fr([0]))
  assert.equal(t.poll(1, fr([1])).length, 1)
  assert.equal(t.poll(0, fr([0])).length, 0)
  t.drop(1)
  assert.deepEqual(t.poll(1, fr([1])), [])
})
check('learn: pulsante, asse lontano dalla base, non il rumore', () => {
  const t = new GamepadTracker()
  t.poll(0, fr([0], [-1, 0]))           // grilletto a riposo su -1
  let f = fr([0], [-0.9, 0]), e = t.poll(0, f)
  assert.equal(t.learnCandidate(0, f, e), null)
  f = fr([0], [1, 0]); e = t.poll(0, f)
  assert.deepEqual(t.learnCandidate(0, f, e), { kind: 'axis', num: 0 })
  f = fr([1], [1, 0]); e = t.poll(0, f)
  assert.deepEqual(t.learnCandidate(0, f, e), { kind: 'btn', num: 0 })
  assert.equal(bindingKey({ kind: 'btn', num: 3 }), 'btn:3')
})
