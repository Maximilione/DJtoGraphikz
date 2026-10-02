#!/usr/bin/env node
/**
 * Colour sync control -> output: the snapshot sent to the output window must
 * carry the TARGET palette (event-driven emit happens before the lerp runs, so
 * current colours are the old palette and the projector never gets the new one).
 *
 *     node scripts/check-colorsync.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const src = readFileSync(join(dirname(dirname(fileURLToPath(import.meta.url))), 'src/engine/Engine.ts'), 'utf8')
const snap = src.slice(src.indexOf('private stateSnapshot()'), src.indexOf('Run several setters as a single'))
assert.match(snap, /colors:\s*this\.targetColors\b/, 'stateSnapshot.colors must come from targetColors')
assert.doesNotMatch(snap, /colors:\s*this\.getCurrentColors\(\)/, 'stateSnapshot must not send mid-lerp colours')
assert.match(snap, /colorSpeed:/, 'colorSpeed must travel so both windows lerp alike')
console.log('  ok snapshot carries target palette + colorSpeed')
