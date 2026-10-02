#!/usr/bin/env node
/**
 * Il mapping consigliato e' un preset per ogni effetto, scritto a mano: una
 * chiave sbagliata o un effetto dimenticato non rompono niente a runtime,
 * semplicemente il pulsante Auto non fa nulla e nessuno se ne accorge. Qui si
 * accorge il check.
 *
 *     node scripts/check-mappings.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const load = async (file) => {
  const out = await build({
    entryPoints: [join(REPO, file)], bundle: true, format: 'esm', write: false, platform: 'neutral',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}
const { EFFECT_PARAMS, COMMON_PARAMS, AUDIO_SOURCES } = await load('src/engine/EffectParams.ts')
const { RECOMMENDED, recommendedFor } = await load('src/engine/recommendedMappings.ts')

const LFO_RATES = new Set([1, 2, 4, 8, 16, 32, 64])
const VALID = new Set(AUDIO_SOURCES.filter(s => s !== 'none'))
let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

check('ogni effetto di EFFECT_PARAMS ha una voce con almeno un parametro', () => {
  for (const id of Object.keys(EFFECT_PARAMS)) {
    assert.ok(RECOMMENDED[id], `${id}: manca il mapping consigliato`)
    assert.ok(Object.keys(RECOMMENDED[id]).length > 0, `${id}: voce vuota`)
  }
})

check('ogni chiave esiste fra i parametri dell\'effetto, value nel range', () => {
  for (const [id, recs] of Object.entries(RECOMMENDED)) {
    if (!EFFECT_PARAMS[id]) {
      // non ancora su questo branch (spaceghost): si valida solo la forma
      console.log(`     (${id} non e' in EFFECT_PARAMS: chiavi e range non verificati)`)
      continue
    }
    const defs = [...COMMON_PARAMS, ...EFFECT_PARAMS[id]]
    for (const [key, rec] of Object.entries(recs)) {
      const def = defs.find(d => d.key === key)
      assert.ok(def, `${id}.${key}: parametro inesistente`)
      if (rec.value !== undefined) {
        assert.ok(rec.value >= def.min && rec.value <= def.max, `${id}.${key}: value ${rec.value} fuori da [${def.min}, ${def.max}]`)
      }
    }
  }
})

check('sorgenti valide, depth in -1..1, lfoRate solo con LFO e fra i valori ammessi', () => {
  for (const [id, recs] of Object.entries(RECOMMENDED)) {
    for (const [key, rec] of Object.entries(recs)) {
      const at = `${id}.${key}`
      assert.ok(VALID.has(rec.source), `${at}: sorgente ${rec.source} non valida`)
      assert.ok(typeof rec.depth === 'number' && rec.depth >= -1 && rec.depth <= 1 && rec.depth !== 0, `${at}: depth ${rec.depth}`)
      if (rec.source.startsWith('lfo-')) {
        assert.ok(LFO_RATES.has(rec.lfoRate), `${at}: lfoRate ${rec.lfoRate} non ammesso`)
      } else {
        assert.equal(rec.lfoRate, undefined, `${at}: lfoRate su una sorgente audio`)
      }
    }
  }
})

check('per effetto non piu\' di 2 parametri sulla stessa sorgente, e mai una sola banda', () => {
  for (const [id, recs] of Object.entries(RECOMMENDED)) {
    const count = {}
    for (const rec of Object.values(recs)) count[rec.source] = (count[rec.source] || 0) + 1
    for (const [src, n] of Object.entries(count)) assert.ok(n <= 2, `${id}: ${n} parametri su ${src}`)
    if (Object.keys(recs).length > 1) assert.ok(Object.keys(count).length > 1, `${id}: tutto sulla stessa sorgente`)
  }
})

check('recommendedFor di un effetto ignoto e\' vuoto, non un errore', () => {
  assert.deepEqual(recommendedFor('nonesiste'), {})
})

console.log(`\n${checks} controlli, ${Object.keys(RECOMMENDED).length} effetti con mapping consigliato`)
