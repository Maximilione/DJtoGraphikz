#!/usr/bin/env node
/**
 * How many of the palette's three colours does each effect really show?
 *
 * Renders every effect with the real Engine in hidden Electron windows (not
 * the app: no Dock icon, no focus, no audio device) with the palette set to
 * pure red / green / blue, so each channel of the frame IS one palette colour.
 * Grey and white are stripped (each pixel minus its smallest channel), audio is
 * a synthetic 128 BPM, 8 frames over ~20 s per effect.
 *
 * It fails when an effect shows fewer colours than EFFECT_PALETTE_USE in the
 * catalog says (an effect gone monochrome), and when a flagged one now shows
 * all three (the flag is stale). Frames that are almost all black cannot be
 * judged and are only listed. ~10 min with 4 windows in parallel.
 *
 *     yarn check:palette-use                 # all effects
 *     ONLY=waves,storm yarn check:palette-use
 */
import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const SHARDS = 4
const T = mkdtempSync(join(tmpdir(), 'djg-paluse-'))

writeFileSync(join(T, 'harness.ts'), `
import { Engine } from ${JSON.stringify(join(REPO, 'src/engine/Engine'))}
import { ALL_EFFECTS, EFFECT_PALETTE_USE } from ${JSON.stringify(join(REPO, 'src/renderer/catalog'))}

const canvas = document.createElement('canvas')
canvas.width = 320; canvas.height = 180
canvas.style.width = '320px'; canvas.style.height = '180px'
document.body.appendChild(canvas)
const eng: any = new Engine(canvas)
const t0 = performance.now(), beatMs = 60000 / 128
let lastBeat = -1
const d = eng.audioAnalyzer.update()
eng.audioAnalyzer.update = () => {
  const t = performance.now() - t0, b = Math.floor(t / beatMs), ph = (t % beatMs) / beatMs
  const kick = Math.exp(-ph * 6)
  Object.assign(d, { sub: 0.5 * kick, bass: 0.3 + 0.6 * kick, mid: 0.5, high: 0.4 + 0.2 * Math.sin(t / 300), presence: 0.4,
    energy: 0.55 + 0.3 * kick, bassRaw: 0.5, energyRaw: 0.5, bassHit: kick, midHit: 0.3 * kick, highHit: 0.2, bpm: 128,
    beatDetected: b !== lastBeat, beatPhase: ph, barPhase: ((b % 4) + ph) / 4 })
  lastBeat = b
  return d
}
eng.setTransitionDuration(0)
eng.setColorTransitionSpeed(0)
eng.setGrade({ contrast: 1, saturation: 1, vignette: 0, lift: 0 })
eng.setColors('#ff0000', '#00ff00', '#0000ff')
eng.start()

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
async function grab() {
  const bmp = await createImageBitmap(await eng.screenshot())
  const c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext('2d')!
  x.drawImage(bmp, 0, 0)
  const px = x.getImageData(0, 0, bmp.width, bmp.height).data
  const e = [0, 0, 0]; let lit = 0
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2], m = Math.min(r, g, b)
    e[0] += r - m; e[1] += g - m; e[2] += b - m
    if (Math.max(r, g, b) - m > 40) lit++
  }
  const n = px.length / 4
  return { e: e.map(v => v / n), lit: lit / n }
}
;(async () => {
  const only = location.hash.length > 1 ? location.hash.slice(1).split(',') : []
  const out: any[] = []
  for (const fx of ALL_EFFECTS) {
    if (!only.includes(fx.id)) continue
    eng.setEffect(fx.id)
    await sleep(1500)
    const samples = []
    for (let k = 0; k < 8; k++) { samples.push(await grab()); await sleep(2500) }
    out.push({ id: fx.id, label: fx.label, declared: (EFFECT_PALETTE_USE as any)[fx.id] ?? 3, samples })
  }
  ;(window as any).__done = out
  console.log('PROBE_DONE')
})()
`)
writeFileSync(join(T, 'index.html'), '<!doctype html><html><body style="margin:0;background:#000"><script src="bundle.js"></script></body></html>')
writeFileSync(join(T, 'main.cjs'), `
const { app, BrowserWindow } = require('electron')
const fs = require('fs'), path = require('path')
app.dock?.hide()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 340, height: 220, show: false, paintWhenInitiallyHidden: true,
    webPreferences: { backgroundThrottling: false } })
  win.webContents.on('console-message', (_e, _l, msg) => {
    if (msg === 'PROBE_DONE') win.webContents.executeJavaScript('JSON.stringify(window.__done)').then(j => {
      fs.writeFileSync(process.env.OUT, j); app.quit() })
  })
  await win.loadFile(path.join(__dirname, 'index.html'), { hash: process.env.ONLY })
})
`)

await build({
  entryPoints: [join(T, 'harness.ts')], bundle: true, format: 'iife', outfile: join(T, 'bundle.js'),
  loader: { '.frag': 'text', '.vert': 'text' }, logLevel: 'warning',
})

const cat = readFileSync(join(REPO, 'src/renderer/catalog.ts'), 'utf8')
const all = [...cat.slice(0, cat.indexOf('POST_CATEGORIES')).matchAll(/\{ id: '([\w-]+)'/g)].map(m => m[1])
const ids = process.env.ONLY ? process.env.ONLY.split(',') : all
const electron = join(REPO, 'node_modules/.bin/electron')
// NODE_OPTIONS from the shell (e.g. --openssl-legacy-provider) makes Electron refuse to start
const env = { ...process.env, NODE_OPTIONS: '' }
const children = new Set()
// one window per shard, each with its own profile: four Electrons on one
// user-data dir can lose one at startup. A window that exits without a result
// (a GPU process lost under load) gets one more try.
function shard(list, s, attempt = 0) {
  return new Promise((resolve, reject) => {
    const out = join(T, `r${s}-${attempt}.json`)
    const p = spawn(electron, [join(T, 'main.cjs'), `--user-data-dir=${join(T, `profile${s}-${attempt}`)}`],
      { env: { ...env, ONLY: list.join(','), OUT: out }, stdio: process.env.DEBUG ? 'inherit' : 'ignore' })
    children.add(p)
    p.on('exit', () => {
      children.delete(p)
      try { resolve(JSON.parse(readFileSync(out, 'utf8'))) } catch {
        if (attempt < 1) shard(list, s, attempt + 1).then(resolve, reject)
        else reject(new Error(`finestra ${s}: nessun risultato`))
      }
    })
  })
}
const shards = Array.from({ length: SHARDS }, (_, s) => ids.filter((_, j) => j % SHARDS === s)).filter(l => l.length)
let results
try {
  results = (await Promise.all(shards.map((l, s) => shard(l, s)))).flat()
} finally {
  for (const p of children) p.kill()
  rmSync(T, { recursive: true, force: true })
}

/** 1 = one colour carries ≥ 75% of the chroma, 2 = one is under 10%, else 3 */
function classify(share) {
  const s = [...share].sort((a, b) => b - a)
  return s[0] >= 0.75 ? 1 : s[2] < 0.10 ? 2 : 3
}

let fails = 0
const dark = []
for (const fx of results) {
  const E = [0, 0, 0]; let lit = 0
  for (const s of fx.samples) { s.e.forEach((v, i) => (E[i] += v)); lit += s.lit / fx.samples.length }
  const tot = E[0] + E[1] + E[2]
  const share = E.map(v => v / (tot || 1))
  const pct = share.map(v => String(Math.round(v * 100)).padStart(3)).join(' ')
  if (lit < 0.05) { dark.push(fx.id); continue }
  const got = classify(share)
  const bad = got < fx.declared || (fx.declared < 3 && got === 3)
  if (bad) fails++
  console.log(`  ${bad ? 'FAIL' : 'ok  '} ${fx.id.padEnd(14)} ${got} colori (catalogo ${fx.declared})  [${pct} ]`)
}
if (dark.length) console.log(`\n  non misurabili (frame quasi neri): ${dark.join(', ')}`)
console.log(fails ? `\n${fails} effetti non corrispondono a EFFECT_PALETTE_USE` : `\n${results.length - dark.length} effetti misurati, tutti come da catalogo`)
process.exit(fails ? 1 : 0)
