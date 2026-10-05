#!/usr/bin/env node
/** Impact layer: bounded, decays to rest, silent when off, drop flashes, caps hold. */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({ entryPoints: [join(REPO, 'src/engine/impact.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const M = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const { stepImpact, newImpactRuntime, IMPACT_DEFAULT, IMPACT_LIMITS, impactActive, sanitizeImpact } = M

const quiet = { dt: 1 / 60, beat: false, mid: 0, high: 0, highHit: 0, phase: 'groove' }
const run = (st, frames, f) => {
  const rt = newImpactRuntime()
  const all = []
  for (let i = 0; i < frames; i++) all.push(stepImpact(rt, st, { ...quiet, ...f(i) }))
  return all
}
let n = 0
const check = (name, fn) => { fn(); n++; console.log('  ok', name) }

check('silence is still: pass skipped', () => {
  assert.ok(!impactActive(run(IMPACT_DEFAULT, 30, () => ({}))[29]))
})
check('off / intensity 0 is neutral even on kicks', () => {
  for (const st of [{ ...IMPACT_DEFAULT, on: false }, { ...IMPACT_DEFAULT, intensity: 0 }])
    assert.ok(run(st, 30, () => ({ beat: true, high: 1, highHit: 1 })).every(o => !impactActive(o)))
})
check('kick moves it, then decays back to rest', () => {
  const o = run(IMPACT_DEFAULT, 120, i => ({ beat: i === 0 }))
  assert.ok(o.slice(0, 20).some(x => Math.abs(x.zoom - 1) > 0.002))
  assert.ok(Math.abs(o[119].zoom - 1) < 1e-3 && Math.abs(o[119].shakeX) < 1e-4)
})
check('punch overshoots back (elastic)', () => {
  const o = run({ ...IMPACT_DEFAULT, intensity: 1, punch: 1 }, 60, i => ({ beat: i === 0 }))
  assert.ok(o.some(x => x.zoom < 1))
})
check('caps hold at full sliders under constant hammering', () => {
  const st = { on: true, intensity: 1, shake: 1, punch: 1, flash: 1, warp: 1, spark: 1, follow: true }
  const L = IMPACT_LIMITS
  for (const o of run(st, 600, i => ({ beat: i % 8 === 0, mid: 1, high: 1, highHit: i % 6 < 3 ? 1 : 0, phase: i % 100 < 50 ? 'build' : 'peak' }))) {
    assert.ok(Math.hypot(o.shakeX, o.shakeY) <= L.shake * 1.0001)
    assert.ok(Math.abs(o.zoom - 1) <= L.zoom + 1e-9)
    assert.ok(o.flash <= L.flash && o.warp <= L.warp && o.chroma <= L.chroma)
  }
})
check('drop (build -> peak) flashes, soft', () => {
  const o = run(IMPACT_DEFAULT, 10, i => ({ phase: i < 3 ? 'build' : 'peak' }))
  const mx = Math.max(...o.map(x => x.flash))
  assert.ok(mx > 0.01 && mx <= IMPACT_LIMITS.flash)
})
check('energy chaser: peak hotter than break', () => {
  const amp = ph => Math.max(...run(IMPACT_DEFAULT, 400, i => ({ beat: i % 30 === 0, phase: ph })).slice(300).map(x => Math.abs(x.zoom - 1)))
  assert.ok(amp('peak') > amp('break'))
})
check('sanitize clamps garbage', () => {
  const s = sanitizeImpact({ intensity: 9, shake: NaN, on: undefined })
  assert.equal(s.intensity, 1); assert.equal(s.shake, IMPACT_DEFAULT.shake); assert.equal(s.on, false)
})
console.log(`${n} checks passed`)
