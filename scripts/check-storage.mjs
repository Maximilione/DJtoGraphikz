#!/usr/bin/env node
/**
 * Persistence is the only part of the app that can lose a night's work, and it
 * fails where nobody looks: a corrupt value that the next save overwrites, a
 * quota error swallowed by `catch {}`, an array read back shorter than it was
 * written. This runs the real storage module against a fake localStorage
 * seeded with a v0.35 dump and asserts on what survives.
 *
 *     node scripts/check-storage.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))

// The toast surface is React; the storage module only needs somewhere to shout.
const stubToasts = {
  name: 'stub-toasts',
  setup(b) {
    b.onResolve({ filter: /Toasts$/ }, () => ({ path: 'toasts-stub', namespace: 'stub' }))
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: 'export const toasts = []\nexport function pushToast(msg, key, action, level) { toasts.push({ msg, level }) }',
      loader: 'js',
    }))
  },
}

async function load(file) {
  const out = await build({
    entryPoints: [join(REPO, 'src/renderer', file)],
    bundle: true, format: 'esm', write: false, platform: 'neutral',
    plugins: [stubToasts],
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

/** localStorage, minus the browser. `full` makes every write throw like a real quota. */
function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed))
  return {
    full: false,
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem(k, v) {
      if (this.full) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e }
      map.set(k, String(v))
    },
    removeItem: k => map.delete(k),
    get length() { return map.size },
    key: i => [...map.keys()][i],
    _map: map,
  }
}

/** A look as v0.35 wrote it: name, preset, thumb. The shape did not change. */
const look = n => ({ name: `Look ${n}`, preset: { effect: 'plasma', speed: 1 }, thumb: 'data:image/jpeg;base64,AA' })
const V035_DUMP = {
  'djtographikz-looks': JSON.stringify([look(1), null, look(3), ...Array(13).fill(null)]),
  'djtographikz-preview-compact': '1',
}

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

globalThis.localStorage = fakeStorage()
const storage = await load('storage.ts')
const looksMod = await load('looks.ts')

// ---- reading a real v0.35 dump ----
check('a v0.35 looks dump loads unchanged', () => {
  globalThis.localStorage = fakeStorage(V035_DUMP)
  const looks = looksMod.loadLooks()
  assert.equal(looks.length, 16)
  assert.equal(looks[0].name, 'Look 1')
  assert.equal(looks[1], null)
  assert.equal(looks[2].name, 'Look 3')
})

check('v0.35 string preferences read back', () => {
  globalThis.localStorage = fakeStorage(V035_DUMP)
  assert.equal(storage.readString('djtographikz-preview-compact'), '1')
  assert.equal(storage.readString('mai-scritta'), null)
})

check('a saved dump round-trips through the new writer', () => {
  globalThis.localStorage = fakeStorage(V035_DUMP)
  const looks = looksMod.loadLooks()
  assert.equal(looksMod.persistLooks(looks), true)
  assert.deepEqual(looksMod.loadLooks(), looks)
})

// ---- the failures that used to be silent ----
check('a corrupt value is moved aside, not overwritten', () => {
  const ls = fakeStorage({ 'djtographikz-looks': '{not json' })
  globalThis.localStorage = ls
  assert.deepEqual(storage.readJson('djtographikz-looks', []), [])
  assert.equal(ls.getItem('djtographikz-looks.rotto'), '{not json')
})

check('a failed write says so instead of pretending', () => {
  const ls = fakeStorage()
  ls.full = true
  globalThis.localStorage = ls
  assert.equal(storage.writeJson('djtographikz-looks', [1]), false)
  assert.equal(storage.writeString('djtographikz-preview-compact', '1'), false)
  assert.equal(looksMod.persistLooks([]), false)
})

check('a corrupt cache is thrown away, not parked forever', () => {
  const ls = fakeStorage({ 'djtographikz-fx-thumbs': '{not json' })
  globalThis.localStorage = ls
  assert.deepEqual(storage.readJson('djtographikz-fx-thumbs', {}, false), {})
  assert.equal(ls.getItem('djtographikz-fx-thumbs.rotto'), null)
  assert.equal(ls.getItem('djtographikz-fx-thumbs'), null)
})

// ---- slots ----
check('more slots than SLOTS are padded, never truncated', () => {
  const twenty = Array.from({ length: 20 }, (_, i) => look(i))
  globalThis.localStorage = fakeStorage({ 'djtographikz-looks': JSON.stringify(twenty) })
  const looks = looksMod.loadLooks()
  assert.equal(looks.length, 20)
  assert.equal(looks[19].name, 'Look 19')
})

check('an empty store gives exactly SLOTS empty slots', () => {
  globalThis.localStorage = fakeStorage()
  const looks = looksMod.loadLooks()
  assert.equal(looks.length, looksMod.SLOTS)
  assert.ok(looks.every(l => l === null))
})

// ---- schema version ----
check('the schema version is stamped once', () => {
  const ls = fakeStorage()
  globalThis.localStorage = ls
  storage.stampSchemaVersion()
  assert.equal(ls.getItem('djtographikz-schema'), String(storage.SCHEMA_VERSION))
})

check('data from a newer build is left alone', () => {
  const ls = fakeStorage({ 'djtographikz-schema': '99' })
  globalThis.localStorage = ls
  storage.stampSchemaVersion()
  assert.equal(ls.getItem('djtographikz-schema'), '99')
})

console.log(`\n${checks} controlli passati`)
