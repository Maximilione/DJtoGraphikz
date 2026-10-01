#!/usr/bin/env node
/**
 * Soundcheck (P3): the thresholds behind the green/red list. A black frame is
 * red, three seconds of signal are green, two gigabytes are the line on disk,
 * and the slower window sets the fps colour.
 *
 *     node scripts/check-soundcheck.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({ entryPoints: [join(REPO, 'src/renderer/soundcheck.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const sc = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

const probe = (over = {}) => ({ mean: 0.3, std: 0.2, bright: 0.6, fps: 60, canvas: '1920x1080', ...over })

check('frameStats: nero, uniforme, con contenuto', () => {
  const px = (fill) => Uint8Array.from({ length: 16 * 4 }, (_, i) => (i % 4 === 3 ? 255 : fill(i >> 2)))
  const black = sc.frameStats(px(() => 0))
  assert.equal(black.mean, 0); assert.equal(black.std, 0); assert.equal(black.bright, 0)
  const flat = sc.frameStats(px(() => 128))
  assert.ok(flat.mean > 0.4 && flat.std < 1e-6 && flat.bright === 1)
  const half = sc.frameStats(px(i => (i < 8 ? 255 : 0)))
  assert.ok(Math.abs(half.mean - 0.5) < 1e-6 && Math.abs(half.std - 0.5) < 1e-6 && half.bright === 0.5)
  assert.deepEqual(sc.frameStats([]), { mean: 0, std: 0, bright: 0 })
})

check('ingresso: 3 s di segnale bastano, meno e\' giallo, zero e\' rosso', () => {
  assert.equal(sc.judgeInput(3).status, 'ok')
  assert.equal(sc.judgeInput(1.2).status, 'warn')
  assert.equal(sc.judgeInput(0).status, 'err')
  assert.match(sc.judgeInput(4.26).detail, /4\.3 s/)
})

check('output: chiusa, muta, ferma, nera, uniforme, ok', () => {
  assert.equal(sc.judgeOutput(false, probe()).status, 'err')
  assert.equal(sc.judgeOutput(true, null).status, 'err')
  assert.equal(sc.judgeOutput(true, probe({ fps: 0 })).status, 'err')
  assert.match(sc.judgeOutput(true, probe({ mean: 0.004 })).detail, /nera/)
  assert.match(sc.judgeOutput(true, probe({ std: 0.005 })).detail, /uniforme/)
  const ok = sc.judgeOutput(true, probe())
  assert.equal(ok.status, 'ok')
  assert.match(ok.detail, /1920x1080/)
})

check('fps: comanda la finestra piu\' lenta', () => {
  assert.equal(sc.judgeFps(60, 59, '1920x1080').status, 'ok')
  assert.equal(sc.judgeFps(60, 40, '1920x1080').status, 'warn')
  assert.equal(sc.judgeFps(25, 60, '1920x1080').status, 'err')
  const solo = sc.judgeFps(58.4, null, '1280x720')
  assert.equal(solo.status, 'ok')
  assert.doesNotMatch(solo.detail, /output/)
  assert.match(solo.name, /1280x720/)
})

check('dmx: inviato = verde, fallito = rosso se acceso, giallo se spento', () => {
  assert.equal(sc.judgeDmx(true, '2.0.0.1', { ok: true }).status, 'ok')
  assert.equal(sc.judgeDmx(true, '', { ok: false, error: 'ENETUNREACH' }).status, 'err')
  assert.equal(sc.judgeDmx(false, '', null).status, 'warn')
  assert.match(sc.judgeDmx(true, '', { ok: true }).detail, /broadcast/)
  assert.match(sc.judgeDmx(true, '', { ok: false, error: 'ENETUNREACH' }).detail, /ENETUNREACH/)
})

check('telefono e disco', () => {
  assert.equal(sc.judgeRemote({ url: 'http://10.0.0.2:8080', code: '1234' }).status, 'ok')
  assert.equal(sc.judgeRemote(null).status, 'err')
  assert.equal(sc.judgeDisk(50e9).status, 'ok')
  assert.equal(sc.judgeDisk(sc.DISK_MIN_GB * 1e9).status, 'ok')
  assert.equal(sc.judgeDisk(1.5e9).status, 'err')
  assert.equal(sc.judgeDisk(null).status, 'warn')
})

check('il colore della lista e\' il peggiore', () => {
  const row = status => ({ id: 'x', name: 'x', status, detail: '' })
  assert.equal(sc.worst([row('ok'), row('ok')]), 'ok')
  assert.equal(sc.worst([row('ok'), row('warn')]), 'warn')
  assert.equal(sc.worst([row('warn'), row('err'), row('ok')]), 'err')
})

console.log(`\n${checks} controlli passati`)
