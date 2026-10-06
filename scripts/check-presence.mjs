#!/usr/bin/env node
/** uPresence: sanitize 0..1, default 0 per preset vecchi / valori sporchi.  node scripts/check-presence.mjs */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({ entryPoints: [join(REPO, 'src/engine/presence.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const { sanitizePresence, PRESENCE_DEFAULT } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

assert.equal(PRESENCE_DEFAULT, 0)
for (const bad of [undefined, null, NaN, Infinity, '0.8', {}]) assert.equal(sanitizePresence(bad), 0, String(bad))
assert.equal(sanitizePresence(-1), 0)
assert.equal(sanitizePresence(7), 1)
assert.equal(sanitizePresence(0.3), 0.3)
console.log('check-presence: ok')
