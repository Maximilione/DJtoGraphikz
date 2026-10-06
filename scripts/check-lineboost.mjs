#!/usr/bin/env node
/** uLineBoost: sanitize 0..1, default 0.5 per preset vecchi / valori sporchi.  node scripts/check-lineboost.mjs */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({ entryPoints: [join(REPO, 'src/engine/lineBoost.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const { sanitizeLineBoost, LINE_BOOST_DEFAULT } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

assert.equal(LINE_BOOST_DEFAULT, 0.5)
for (const bad of [undefined, null, NaN, Infinity, '0.8', {}]) assert.equal(sanitizeLineBoost(bad), 0.5, String(bad))
assert.equal(sanitizeLineBoost(-1), 0)
assert.equal(sanitizeLineBoost(7), 1)
assert.equal(sanitizeLineBoost(0.3), 0.3)
console.log('check-lineboost: ok')
