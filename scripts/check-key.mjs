#!/usr/bin/env node
/**
 * Does the key detector name the key? Synthetic spectra with the partials of
 * a chord or a scale, in the byte scale the analyser gives it.
 *
 *     node scripts/check-key.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({ entryPoints: [join(REPO, 'src/engine/audio/KeyDetector.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const { KeyDetector, keyName, NOTE_NAMES } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const { paletteForKey, paletteHue, keyHue } = await (async () => {
  const o = await build({ entryPoints: [join(REPO, 'src/engine/AutoVJ.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
  return import('data:text/javascript;base64,' + Buffer.from(o.outputFiles[0].text).toString('base64'))
})()

const BINS = 1024, BIN_HZ = 22050 / BINS
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12)
const db2byte = (db) => Math.round(255 * (db + 90) / 80)

/** a spectrum with the partials of the given midi notes, -20 dB fundamentals, harmonics falling 6 dB each */
function spectrum(notes, floorDb = -75) {
  const spec = new Uint8Array(BINS).fill(db2byte(floorDb))
  for (const m of notes) for (let h = 1; h <= 4; h++) {
    const hz = midiHz(m) * h
    const bin = Math.round(hz / BIN_HZ)
    if (bin >= BINS) continue
    const db = -20 - 6 * (h - 1)
    spec[bin] = Math.max(spec[bin], db2byte(db))
    if (bin + 1 < BINS) spec[bin + 1] = Math.max(spec[bin + 1], db2byte(db - 8))
    if (bin > 0) spec[bin - 1] = Math.max(spec[bin - 1], db2byte(db - 8))
  }
  return spec
}

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

function detect(frames) {
  const det = new KeyDetector()
  for (const spec of frames) for (let i = 0; i < 120; i++) det.update(spec, BIN_HZ, 1000 / 60)
  return det.estimate()
}

check('scala di Do maggiore → C', () => {
  const k = detect([spectrum([60, 62, 64, 65, 67, 69, 71, 72])])
  assert.equal(keyName(k), 'C', JSON.stringify(k))
  assert.ok(k.confidence > 0.3, `confidenza ${k.confidence}`)
})

check('scala di La minore armonica → Am', () => {
  // the G# is what separates A minor from C major and E minor
  const k = detect([spectrum([57, 59, 60, 62, 64, 65, 68, 69]), spectrum([57, 60, 64, 69])])
  assert.equal(keyName(k), 'Am', JSON.stringify(k))
})

check('un pezzo in Fa diesis minore resta Fa diesis minore attraverso i suoi gradi', () => {
  // i, iv, VI, v in F# minor: F#m, Bm, D, C#m
  const k = detect([spectrum([54, 57, 61, 66]), spectrum([59, 62, 66, 71]), spectrum([50, 54, 57, 62]), spectrum([49, 52, 56, 61])])
  assert.equal(keyName(k), 'F#m', JSON.stringify(k))
})

check('il silenzio non ha tonalita\'', () => {
  const det = new KeyDetector()
  det.update(new Uint8Array(BINS), BIN_HZ, 16)
  assert.equal(det.estimate(), null)
})

check('la tonalita\' sceglie la palette piu\' vicina sul cerchio, mai quella corrente', () => {
  const pals = [['#ff0000', '#880000', '#ff4444'], ['#00ccff', '#0044ff', '#88ffff'], ['#ffd700', '#daa520', '#b8860b'], ['#ffffff', '#888888', '#ffffff']]
  assert.equal(keyHue({ tonic: 0, mode: 'major' }), 0)            // C = red
  assert.equal(keyHue({ tonic: 9, mode: 'minor' }), 0)            // A minor = relative of C
  assert.equal(paletteHue(pals[3]), -1)                           // grey has no hue
  assert.equal(paletteForKey(pals, { tonic: 0, mode: 'major', confidence: 1 }, 1), 0)   // C major → red
  assert.equal(paletteForKey(pals, { tonic: 0, mode: 'major', confidence: 1 }, 0), 2)   // red already up → gold
  assert.equal(paletteForKey(pals, { tonic: 4, mode: 'minor', confidence: 1 }, 0), 2)   // E minor = G, 30°: gold is 15° away, the cool bias (45) does not beat 170° of distance
  assert.equal(paletteForKey(pals, { tonic: 1, mode: 'minor', confidence: 1 }, 0), 1)   // C# minor = E, 120°: ice (200°, cool) beats gold (45°, warm + 45)
  assert.equal(paletteForKey(pals, { tonic: 2, mode: 'major', confidence: 1 }, 0), 2)   // D major = yellow → gold
})

console.log(`\n${checks} controlli passati`)
