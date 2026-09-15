#!/usr/bin/env node
/**
 * The Intensity macro's one promise is that zero gives back exactly the scene
 * that was set by hand. A macro that quietly leaves a param a few percent off
 * every time it is used is worse than no macro: it rewrites a set of values
 * the VJ spent a night tuning, one pass at a time.
 *
 *     node scripts/check-intensity.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({
  entryPoints: [join(REPO, 'src/engine/EffectParams.ts')],
  bundle: true, format: 'esm', write: false, platform: 'neutral',
})
const {
  intensityValue, intensityWet, INTENSITY_WEIGHTS, INTENSITY_WET_WEIGHT,
  COMMON_PARAMS, EFFECT_PARAMS,
} = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

const speed = COMMON_PARAMS.find(p => p.key === 'speed')
const react = COMMON_PARAMS.find(p => p.key === 'reactivity')

check('a zero non tocca niente', () => {
  for (const def of [speed, react, { key: 'sides', min: 3, max: 16, default: 6, label: '' }]) {
    for (const base of [def.min, def.default, def.max, (def.min + def.max) / 2]) {
      assert.equal(intensityValue(def, base, 0), base, def.key)
    }
  }
  assert.equal(intensityWet(0.37, 0), 0.37)
})

check('un parametro senza peso non si muove mai', () => {
  const def = { key: 'flip', label: '', min: 0, max: 1, default: 0 }
  assert.equal(INTENSITY_WEIGHTS[def.key], undefined)
  assert.equal(intensityValue(def, 0.2, 1), 0.2)
})

check('peso positivo va verso il massimo, mai oltre', () => {
  const v = intensityValue(speed, speed.default, 1)
  assert.ok(v > speed.default, `${v} non e' salito`)
  assert.ok(v <= speed.max, `${v} ha superato il massimo`)
  assert.equal(v, speed.default + INTENSITY_WEIGHTS.speed * (speed.max - speed.default))
})

check('peso negativo va verso il minimo', () => {
  const def = { key: 'threshold', label: '', min: 0, max: 1, default: 0.5 }
  assert.ok(INTENSITY_WEIGHTS.threshold < 0)
  const v = intensityValue(def, 0.5, 1)
  assert.ok(v < 0.5, `${v} non e' sceso`)
  assert.ok(v >= def.min)
})

check('un parametro gia al massimo resta al massimo', () => {
  assert.equal(intensityValue(speed, speed.max, 1), speed.max)
})

check('e monotona: piu alzi, piu spinge', () => {
  let prev = -Infinity
  for (const i of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
    const v = intensityValue(react, react.default, i)
    assert.ok(v >= prev, `${i} ha abbassato il valore`)
    prev = v
  }
})

check('oltre 1 non spinge oltre 1', () => {
  assert.equal(intensityValue(speed, 1, 2), intensityValue(speed, 1, 1))
  assert.equal(intensityWet(0.2, 5), intensityWet(0.2, 1))
})

check('il wet sale verso 1 senza superarlo', () => {
  assert.equal(intensityWet(0, 1), INTENSITY_WET_WEIGHT)
  assert.equal(intensityWet(1, 1), 1)
  assert.ok(intensityWet(0.5, 1) < 1)
})

check('ogni peso nominato esiste davvero come parametro', () => {
  const known = new Set(COMMON_PARAMS.map(p => p.key))
  for (const list of Object.values(EFFECT_PARAMS)) for (const p of list) known.add(p.key)
  const orfani = Object.keys(INTENSITY_WEIGHTS).filter(k => !known.has(k))
  assert.deepEqual(orfani, [], `pesi che non corrispondono a nessun parametro: ${orfani}`)
})

check('i pesi stanno fra -1 e 1', () => {
  for (const [k, w] of Object.entries(INTENSITY_WEIGHTS)) {
    assert.ok(Math.abs(w) > 0 && Math.abs(w) <= 1, `${k} = ${w}`)
  }
})

console.log(`\n${checks} controlli passati`)
