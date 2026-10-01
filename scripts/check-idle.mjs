#!/usr/bin/env node
/**
 * Idle on silence: enters after N seconds of nothing, not on a gap between
 * tracks; leaves when the music is really back, not on one frame of noise.
 *
 *     node scripts/check-idle.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({ entryPoints: [join(REPO, 'src/renderer/idle.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const { IdleWatch, SOUND_HOLD_MS } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

function run(script, seconds = 10) {
  const w = new IdleWatch(seconds)
  const events = []
  let t = 0
  for (const [ms, sound] of script) {
    const end = t + ms
    while (t < end) { const e = w.update(sound, t); if (e) events.push([Math.round(t / 100) / 10, e]); t += 1000 / 60 }
  }
  return { events, w }
}

check('dieci secondi di silenzio entrano in idle, otto no', () => {
  assert.deepEqual(run([[30000, true], [8000, false], [5000, true]]).events, [])
  const { events } = run([[30000, true], [10500, false]])
  assert.equal(events.length, 1)
  assert.equal(events[0][1], 'enter')
  assert.ok(events[0][0] >= 40 && events[0][0] < 40.2, `entrato a ${events[0][0]} s`)
})

check('un frame di rumore non fa uscire, la musica si\'', () => {
  const { events, w } = run([[30000, true], [12000, false], [100, true], [3000, false], [2000, true]])
  assert.deepEqual(events.map(e => e[1]), ['enter', 'exit'])
  assert.ok(events[1][0] * 1000 >= 45100 + SOUND_HOLD_MS - 20, `uscito a ${events[1][0]} s`)
  assert.equal(w.isIdle(), false)
})

check('il silenzio dall\'avvio conta', () => {
  const { events } = run([[11000, false]])
  assert.deepEqual(events.map(e => e[1]), ['enter'])
})

console.log(`\n${checks} controlli passati`)
