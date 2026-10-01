#!/usr/bin/env node
/**
 * Reel automatico: due recorder sfalsati, in ogni istante c'e' uno spezzone
 * autonomo fra 15 e 30 s; il drop salvato con ritardo contiene la salita e il
 * colpo; il ritaglio e' 9:16 centrato.
 *
 *     node scripts/check-reel.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({ entryPoints: [join(REPO, 'src/renderer/reel.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const { ReelBuffer, LAP_MS, STAGGER_MS, CHUNK_MS, DROP_DELAY_MS, cropRect, reelFileName } =
  await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

/** simula l'host: tick a 1 s, un recorder nuovo per giro, un chunk (= il suo istante) al secondo */
function simulate(untilMs, onTick) {
  const buf = new ReelBuffer()
  const live = [null, null]
  for (let t = 0; t <= untilMs; t += CHUNK_MS) {
    for (const slot of buf.due(t)) live[slot] = buf.started(slot, t)
    for (const lap of live) if (lap && t > lap.startedAt) lap.chunks.push(t)
    onTick?.(buf, t)
  }
  return buf
}

check('i due recorder partono a 0 e a mezzo giro, e ripartono ogni giro', () => {
  const starts = [[], []]
  const buf = new ReelBuffer()
  for (let t = 0; t <= 4 * LAP_MS; t += CHUNK_MS) for (const s of buf.due(t)) { buf.started(s, t); starts[s].push(t) }
  assert.deepEqual(starts[0], [0, LAP_MS, 2 * LAP_MS, 3 * LAP_MS, 4 * LAP_MS])
  assert.deepEqual(starts[1], [STAGGER_MS, STAGGER_MS + LAP_MS, STAGGER_MS + 2 * LAP_MS, STAGGER_MS + 3 * LAP_MS])
})

check('a regime il meglio salvabile e\' sempre fra 15 e 30 s, con i chunk giusti', () => {
  let worst = Infinity, bestSeen = 0
  simulate(5 * LAP_MS, (buf, t) => {
    const b = buf.best(t)
    if (t < STAGGER_MS) return // riscaldamento: meno di mezzo giro, va bene cosi'
    assert.ok(b, `niente da salvare a ${t}`)
    assert.ok(b.seconds >= STAGGER_MS / 1000 - 1e-9 && b.seconds <= LAP_MS / 1000, `a ${t} ms salvabili ${b.seconds} s`)
    // i chunk sono quelli dell'ultimo tratto, contigui e che finiscono adesso
    assert.equal(b.chunks[b.chunks.length - 1], t)
    assert.equal(b.chunks.length, Math.round(b.seconds))
    worst = Math.min(worst, b.seconds); bestSeen = Math.max(bestSeen, b.seconds)
  })
  assert.equal(worst, STAGGER_MS / 1000)
  assert.equal(bestSeen, LAP_MS / 1000 - CHUNK_MS / 1000) // al tick del giro riparte prima di salvare: [15, 30)
})

check('prima del primo chunk non c\'e\' nulla, dopo si salva anche a freddo', () => {
  const buf = new ReelBuffer()
  for (const s of buf.due(0)) buf.started(s, 0)
  assert.equal(buf.best(0), null)
  buf.laps[0].chunks.push(1000)
  assert.equal(buf.best(1000).seconds, 1)
})

check('il chunk tardivo del giro vecchio non entra nel giro nuovo', () => {
  const buf = new ReelBuffer()
  const old = buf.started(0, 0)
  const fresh = buf.started(0, LAP_MS)
  old.chunks.push('coda')
  assert.deepEqual(fresh.chunks, [])
})

check('salvato DROP_DELAY dopo il drop, il reel contiene sempre il drop', () => {
  for (let drop = STAGGER_MS; drop <= 3 * LAP_MS; drop += 1000) {
    const t = drop + DROP_DELAY_MS
    const buf = simulate(t)
    const b = buf.best(t)
    assert.ok(b.chunks[0] <= drop, `drop a ${drop}: la clip parte a ${b.chunks[0]}`)
    assert.ok(drop - b.chunks[0] >= STAGGER_MS - DROP_DELAY_MS - CHUNK_MS, `drop a ${drop}: solo ${drop - b.chunks[0]} ms di salita`)
  }
})

check('ritaglio 9:16 centrato su 16:9, 9:16 e 4:3', () => {
  assert.deepEqual(cropRect(1920, 1080), [(1920 - 607.5) / 2, 0, 607.5, 1080])
  assert.deepEqual(cropRect(1080, 1920), [0, 0, 1080, 1920])
  const [sx, sy, sw, sh] = cropRect(1600, 1200)
  assert.equal(sh, 1200); assert.equal(sy, 0)
  assert.ok(Math.abs(sw / sh - 9 / 16) < 1e-9); assert.equal(sx, (1600 - sw) / 2)
  // una sorgente piu' stretta di 9:16 si ritaglia in altezza
  const [, y, w, h] = cropRect(400, 1200)
  assert.equal(w, 400); assert.ok(Math.abs(h - 400 * 16 / 9) < 1e-9); assert.ok(y > 0)
})

check('nome file con data e ora, senza caratteri vietati', () => {
  const name = reelFileName(new Date('2026-10-01T22:15:30.123Z'))
  assert.equal(name, 'djtographikz-reel-2026-10-01T22-15-30-123Z.webm')
  assert.ok(!/[:/\\]/.test(name))
})

console.log(`\n${checks} controlli passati`)
