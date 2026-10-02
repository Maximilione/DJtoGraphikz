#!/usr/bin/env node
/**
 * Phone remote -> sequences: the pure part. A phone (or OSC) can send anything,
 * so an index must be validated before it reaches the player, and the manual
 * step must behave exactly like N / Shift+N.
 *
 *   node scripts/check-phoneseq.mjs
 */
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import assert from 'assert'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = mkdtempSync(join(tmpdir(), 'djg-phoneseq-'))
const bundle = join(out, 'sequences.cjs')
execFileSync('npx', ['esbuild', join(REPO, 'src/renderer/components/PresetPanel/sequences.ts'),
  '--bundle', '--format=cjs', '--platform=node', `--outfile=${bundle}`], { cwd: REPO, stdio: 'pipe' })
const { validSeqIndex, manualStep } = createRequire(import.meta.url)(bundle)

let failed = 0
const check = (name, fn) => {
  try { fn(); console.log(`  ok   ${name}`) } catch (e) { failed++; console.log(`  FAIL ${name}: ${e.message}`) }
}

check('indici validi', () => {
  assert.equal(validSeqIndex(0, 3), 0)
  assert.equal(validSeqIndex(2, 3), 2)
  assert.equal(validSeqIndex('1', 3), 1)   // JSON from a sloppy client
})
check('indici fuori range o non interi rifiutati', () => {
  for (const bad of [-1, 3, 99, 1.5, NaN, Infinity, '', ' ', 'abc', '1x', null, undefined, {}, [], [1], true])
    assert.equal(validSeqIndex(bad, 3), -1, `accettato ${JSON.stringify(bad)}`)
})
check('nessuna scaletta: ogni indice rifiutato', () => assert.equal(validSeqIndex(0, 0), -1))

check('avanti: incrementa, a fine scaletta torna a 0 (come N)', () => {
  assert.equal(manualStep(0, 50, false, 1), 1)
  assert.equal(manualStep(48, 50, false, 1), 49)
  assert.equal(manualStep(49, 50, false, 1), 0)
})
check('indietro: decrementa, sul primo resta (loop off) o va in fondo (loop on)', () => {
  assert.equal(manualStep(5, 50, false, -1), 4)
  assert.equal(manualStep(0, 50, false, -1), 0)
  assert.equal(manualStep(0, 50, true, -1), 49)
})
check('scaletta vuota o passo singolo: indice invariato', () => {
  assert.equal(manualStep(0, 0, false, 1), 0)
  assert.equal(manualStep(0, 0, true, -1), 0)
  assert.equal(manualStep(0, 1, false, 1), 0)
})
check('50 avanti di fila fanno un giro completo', () => {
  let i = 0
  for (let k = 0; k < 50; k++) i = manualStep(i, 50, false, 1)
  assert.equal(i, 0)
})

rmSync(out, { recursive: true, force: true })
if (failed) { console.log(`\n${failed} fallite`); process.exit(1) }
console.log('\ncheck-phoneseq: tutto ok')
