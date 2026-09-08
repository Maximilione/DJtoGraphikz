#!/usr/bin/env node
/**
 * Sequences: does a playlist saved by an older version still load, and does
 * playback walk it correctly?
 *
 * The migration runs on data the user already has on disk. Getting it wrong
 * silently empties somebody's setlist the night they need it, and nothing in
 * the app would report an error.
 *
 *   node scripts/check-sequences.mjs
 */
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = mkdtempSync(join(tmpdir(), 'djg-seq-'))
const bundle = join(out, 'sequences.cjs')

execFileSync('npx', ['esbuild', join(REPO, 'src/renderer/components/PresetPanel/sequences.ts'),
  '--bundle', '--format=cjs', '--platform=node', `--outfile=${bundle}`],
  { cwd: REPO, stdio: 'pipe' })

const { migrate, migrateAll, clampHold, nextIndex, prevIndex, moveStep, totalHold, indexAfterRemoval } =
  await import('file://' + bundle)

const look = name => ({ name, effect: 'tunnel', post: [], colors: ['#000', '#111', '#222'] })

// --- a playlist written by v0.27 and earlier ---
const legacy = {
  name: 'Serata vecchia',
  presets: [look('uno'), look('due'), look('tre')],
  loop: false,
  autoAdvance: true,
  advanceMode: 'beats',
  advanceInterval: 16,
}
const m = migrate(legacy)
assert.equal(m.name, 'Serata vecchia')
assert.equal(m.mode, 'beats')
assert.equal(m.loop, false)
assert.deepEqual(m.steps.map(s => s.name), ['uno', 'due', 'tre'], 'ordine dei passi conservato')
assert.ok(m.steps.every(s => s.hold === 16), 'ogni passo eredita l’intervallo unico della vecchia playlist')
assert.equal(m.steps[0].preset.effect, 'tunnel', 'il look arriva intero')
console.log('vecchia playlist migrata:', m.steps.length, 'passi da', m.steps[0].hold, 'beat')

// --- a sequence already in the new shape must survive untouched ---
const modern = {
  name: 'Nuova', mode: 'timer', loop: true, defaultHold: 8,
  steps: [{ name: 'a', preset: look('a'), hold: 4 }, { name: 'b', preset: look('b'), hold: 30 }],
}
const m2 = migrate(modern)
assert.deepEqual(m2.steps.map(s => s.hold), [4, 30], 'le durate per passo restano quelle')
assert.equal(totalHold(m2), 34)

// --- junk must not throw ---
assert.equal(migrate({}).steps.length, 0)
assert.equal(migrateAll(null).length, 0)
assert.equal(migrateAll([null, undefined, { name: 'ok' }]).length, 1)

// --- holds stay inside the unit's range ---
assert.equal(clampHold(999, 'beats'), 128)
assert.equal(clampHold(0, 'timer'), 1)
assert.equal(clampHold(NaN, 'timer'), 1)

// --- walking the sequence ---
assert.equal(nextIndex(0, 3, false), 1)
assert.equal(nextIndex(2, 3, true), 0, 'in loop torna al primo')
assert.equal(nextIndex(2, 3, false), -1, 'senza loop finisce')
assert.equal(nextIndex(0, 0, true), -1, 'scaletta vuota')
assert.equal(prevIndex(0, 3, true), 2)
assert.equal(prevIndex(0, 3, false), 0)

// --- reorder ---
const steps = ['a', 'b', 'c', 'd'].map(n => ({ name: n, preset: look(n), hold: 1 }))
assert.deepEqual(moveStep(steps, 0, 2).map(s => s.name), ['b', 'c', 'a', 'd'])
assert.deepEqual(moveStep(steps, 3, 0).map(s => s.name), ['d', 'a', 'b', 'c'])
assert.deepEqual(moveStep(steps, 1, 1).map(s => s.name), ['a', 'b', 'c', 'd'])
assert.deepEqual(moveStep(steps, -1, 9).map(s => s.name), ['a', 'b', 'c', 'd'], 'indici fuori range non rompono nulla')

// --- deleting a sequence must not make the editor save over another one ---
assert.equal(indexAfterRemoval(3, 1), 2, 'cancellandone una prima, quella aperta scala di uno')
assert.equal(indexAfterRemoval(1, 3), 1, 'cancellandone una dopo, l’indice non cambia')
assert.equal(indexAfterRemoval(2, 2), -1, 'cancellata proprio quella aperta')
assert.equal(indexAfterRemoval(-1, 0), -1, 'nessuna scaletta aperta')

rmSync(out, { recursive: true, force: true })
console.log('OK: migrazione, durate per passo e scorrimento della scaletta')
