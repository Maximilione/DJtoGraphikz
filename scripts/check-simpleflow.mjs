#!/usr/bin/env node
// The 'ti sento' state of Simple mode, on a fake clock.
//     node scripts/check-simpleflow.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
// the module is TS with no imports: strip the types and evaluate it
const src = readFileSync(join(REPO, 'src/renderer/simpleFlow.ts'), 'utf8')
  .replace(/^export type .*$/m, '')
  .replace(/running: boolean, msSinceSound: number\): SimpleFlow/, 'running, msSinceSound)')
  .replace(/export /g, '')
const { flowState, HEARD_MS, SILENCE_MS } = new Function(`${src}; return { flowState, HEARD_MS, SILENCE_MS }`)()

assert.equal(flowState(false, 0), 'fermo')
assert.equal(flowState(false, 99999), 'fermo')
assert.equal(flowState(true, 0), 'sento')
assert.equal(flowState(true, HEARD_MS - 1), 'sento')
assert.equal(flowState(true, HEARD_MS), 'attesa')
assert.equal(flowState(true, SILENCE_MS - 1), 'attesa')
assert.equal(flowState(true, SILENCE_MS), 'silenzio')
assert.equal(flowState(true, Infinity), 'silenzio')   // never heard anything
console.log('OK: fermo / attesa / silenzio / sento')
