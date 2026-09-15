#!/usr/bin/env node
/**
 * A venue profile drives the projector: resolution, display, the four mapping
 * corners. A half-written or hand-edited store must never reach that code — a
 * bad resolution moves the show to a buffer nobody asked for, a short keystone
 * array silently does nothing. These are the rules that keep it out.
 *
 *     node scripts/check-venues.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({
  entryPoints: [join(REPO, 'src/renderer/venues.ts')],
  bundle: true, format: 'esm', write: false, platform: 'neutral',
})
const { parseRes, sanitizeVenues, upsertVenue } =
  await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

const venue = (over = {}) => ({
  name: 'Circolo', outputRes: '1920x1080', displayId: 2,
  keystone: [0, 0, 1, 0, 1, 1, 0, 1], brightness: 0.8,
  audio: { deviceId: 'abc' }, dmx: { host: '10.0.0.5' }, ...over,
})

check('la risoluzione si legge solo se e\' una risoluzione', () => {
  assert.deepEqual(parseRes('1920x1080'), [1920, 1080])
  assert.deepEqual(parseRes('3840x2160'), [3840, 2160])
  for (const bad of ['', '1920', '1920X1080', '19200x10800', '10x10', 'ciao', null, 1080, undefined])
    assert.equal(parseRes(bad), null, String(bad))
})

check('un posto valido sopravvive al giro in JSON', () => {
  const v = venue()
  assert.deepEqual(sanitizeVenues(JSON.parse(JSON.stringify([v]))), [v])
})

check('quello che non e\' un posto viene buttato', () => {
  const bad = [
    null, 42, {},
    venue({ name: '  ' }),
    venue({ outputRes: 'grande' }),
    venue({ keystone: [0, 0, 1, 0] }),
    venue({ keystone: [0, 0, 1, 0, 1, 1, 0, NaN] }),
    venue({ brightness: 2 }),
    venue({ displayId: 'principale' }),
  ]
  assert.deepEqual(sanitizeVenues(bad), [])
  assert.deepEqual(sanitizeVenues('non un array'), [])
  assert.deepEqual(sanitizeVenues(undefined), [])
})

check('displayId null e\' legittimo: "dove sta gia\'"', () => {
  assert.equal(sanitizeVenues([venue({ displayId: null })]).length, 1)
})

check('risalvare lo stesso posto lo sostituisce, non lo accoda', () => {
  const list = [venue(), venue({ name: 'Cantiere' })]
  const next = upsertVenue(list, venue({ brightness: 0.5 }))
  assert.equal(next.length, 2)
  assert.equal(next[0].brightness, 0.5)
  assert.equal(next[1].name, 'Cantiere')
  // stesso nome scritto diverso = stesso posto
  assert.equal(upsertVenue(list, venue({ name: 'CIRCOLO' })).length, 2)
  // nome nuovo = in coda, la lista di prima non si tocca
  assert.equal(upsertVenue(list, venue({ name: 'Bunker' })).length, 3)
  assert.equal(list.length, 2)
})

console.log(`\n${checks} controlli passati`)
