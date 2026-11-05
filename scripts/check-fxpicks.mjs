#!/usr/bin/env node
/** Griglia effetti: preferiti, recenti (max 8, niente doppioni, id sconosciuti scartati), "adatti ora" per fase.  node scripts/check-fxpicks.mjs */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const stub = {
  name: 'stub',
  setup(b) {
    b.onResolve({ filter: /Toasts$/ }, () => ({ path: 't', namespace: 'stub' }))
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export function pushToast() {}', loader: 'js' }))
    b.onResolve({ filter: /^@engine\// }, a => ({ path: join(REPO, 'src/engine', a.path.slice(8) + '.ts') }))
    b.onResolve({ filter: /\.(frag|vert)\?raw$/ }, () => ({ path: 'glsl', namespace: 'stub' }))
  },
}
const mem = { 'djtographikz-fx-recent': JSON.stringify(['tunnel', 'nope', 'tunnel', 42, 'pipes']) }
globalThis.localStorage = {
  getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v) }, removeItem: k => { delete mem[k] },
}
const out = await build({ entryPoints: [join(REPO, 'src/renderer/fxPicks.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral', plugins: [stub] })
const P = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

assert.deepEqual(P.getRecent(), ['tunnel', 'pipes'], 'salvati puliti')
for (const id of ['plasma', 'fire', 'smoke', 'glitch', 'matrix', 'ascii', 'flash', 'lasers', 'pipes']) P.noteRecent(id)
assert.equal(P.getRecent().length, P.RECENT_MAX)
assert.equal(P.getRecent()[0], 'pipes', 'il piu recente in testa, senza doppione')
assert.equal(P.getRecent().filter(i => i === 'pipes').length, 1)
P.noteRecent('nope'); assert.equal(P.getRecent()[0], 'pipes', 'id sconosciuto ignorato')

P.toggleFav('fire'); P.toggleFav('nope'); assert.deepEqual(P.getFavs(), ['fire'])
assert.deepEqual(JSON.parse(mem['djtographikz-fx-favs']), ['fire'])
P.toggleFav('fire'); assert.deepEqual(P.getFavs(), [])

assert.deepEqual(P.suggestedNow(), [], 'senza genere nessun suggerimento')
P.setPickContext('acid-techno', 'peak')
const peak = P.suggestedNow()
assert.ok(peak.length > 0 && new Set(peak).size === peak.length, 'peak: effetti senza doppioni')
P.setPickContext('acid-techno', 'break')
assert.notDeepEqual(P.suggestedNow(), peak, 'la fase cambia i suggerimenti')
console.log('check-fxpicks: ok')
