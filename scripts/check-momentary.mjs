#!/usr/bin/env node
/**
 * Tap versus hold is a timing decision, and a timing decision that drifts
 * leaves a strobe on in a dark room. Small enough to assert directly.
 *
 *     node scripts/check-momentary.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({
  entryPoints: [join(REPO, 'src/renderer/momentary.ts')],
  bundle: true, format: 'esm', write: false, platform: 'neutral',
})
const { Momentary, HOLD_MS } =
  await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

let now = 0
globalThis.performance = { now: () => now }

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

check('un tocco breve lascia acceso', () => {
  const m = new Momentary()
  let reverted = false
  now = 1000
  m.press('q', () => { reverted = true })
  now += HOLD_MS - 10
  assert.equal(m.release('q'), false)
  assert.equal(reverted, false)
})

check('una pressione lunga torna indietro al rilascio', () => {
  const m = new Momentary()
  let reverted = false
  now = 1000
  m.press('q', () => { reverted = true })
  now += HOLD_MS + 10
  assert.equal(m.release('q'), true)
  assert.equal(reverted, true)
})

check('il rilascio di un tasto mai premuto non fa niente', () => {
  const m = new Momentary()
  assert.equal(m.release('q'), false)
})

check('due tasti tenuti insieme tornano indietro ognuno per conto suo', () => {
  const m = new Momentary()
  const back = []
  now = 0
  m.press('q', () => back.push('q'))
  now += 50
  m.press('w', () => back.push('w'))
  now += HOLD_MS
  assert.equal(m.release('q'), true)
  assert.deepEqual(back, ['q'])
  now += 10
  assert.equal(m.release('w'), true)
  assert.deepEqual(back, ['q', 'w'])
})

check('la ripetizione automatica non ripreme', () => {
  const m = new Momentary()
  now = 0
  m.press('q', () => {})
  assert.equal(m.isDown('q'), true)
  assert.equal(m.isDown('w'), false)
})

check('rilasciare due volte torna indietro una volta sola', () => {
  const m = new Momentary()
  let n = 0
  now = 0
  m.press('q', () => n++)
  now += HOLD_MS + 1
  m.release('q')
  m.release('q')
  assert.equal(n, 1)
})

check('clear libera i tasti senza annullare niente', () => {
  const m = new Momentary()
  let reverted = false
  now = 0
  m.press('q', () => { reverted = true })
  now += HOLD_MS + 100
  m.clear()
  assert.equal(reverted, false, 'clear non deve annullare')
  assert.equal(m.isDown('q'), false)
  assert.equal(m.release('q'), false)
})

check('ripremere senza rilascio tiene la prima via del ritorno', () => {
  // MIDI note-on doppio, release persa dal telefono: il secondo press era
  // catturato su uno stato gia' cambiato e al rilascio lo strobe restava
  const m = new Momentary()
  const back = []
  now = 0
  m.press('q', () => back.push('prima'))
  now += 20
  m.press('q', () => back.push('seconda'))
  now += HOLD_MS + 1
  assert.equal(m.release('q'), true)
  assert.deepEqual(back, ['prima'])
})

check('un revert che lancia non rompe chi rilascia', () => {
  const m = new Momentary()
  const errors = []
  const orig = console.error
  console.error = (...a) => errors.push(a)
  try {
    now = 0
    m.press('q', () => { throw new Error('boom') })
    now += HOLD_MS + 1
    assert.equal(m.release('q'), false)
    assert.equal(m.isDown('q'), false)
    assert.equal(errors.length, 1)
  } finally { console.error = orig }
})

check('releaseWhere rilascia solo il suo spazio dei nomi', () => {
  const m = new Momentary()
  const back = []
  now = 0
  m.press('pad:btn:1', () => back.push('pad1'))
  m.press('pad:btn:2', () => back.push('pad2'))
  m.press('midi:note:0:36', () => back.push('midi'))
  now += HOLD_MS + 1
  m.releaseWhere('pad:')
  assert.deepEqual(back.sort(), ['pad1', 'pad2'])
  assert.equal(m.isDown('midi:note:0:36'), true)
})

console.log(`\n${checks} controlli passati`)
