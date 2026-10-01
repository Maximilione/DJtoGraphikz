#!/usr/bin/env node
/**
 * Replay a recording through the Auto VJ's phase detector, at a desk, in
 * silence. The phase thresholds were tuned on a synthetic track; this feeds
 * the real thing — a recording of the rig, a DJ mix, a demo track — through
 * the same band math as AudioAnalyzer, the real BeatTracker and the real
 * AutoVJ, and prints where it heard breaks, drops and peaks.
 *
 *     node scripts/check-phases.mjs mix.mp3
 *     node scripts/check-phases.mjs mix.wav --genre hard-tekno --from 120 --to 600
 *     node scripts/check-phases.mjs mix.mp3 --cues mix.cues     # "3:12 drop" per line
 *     node scripts/check-phases.mjs mix.mp3 --breakBass 0.2 --dropBass 0.5
 *     node scripts/check-phases.mjs mix.mp3 --csv /tmp/phases.csv
 *
 * Needs ffmpeg on the PATH. The analyser is reproduced, not reused: it lives
 * on a Web Audio AnalyserNode (Blackman window, 2048-point FFT, 0.4 smoothing,
 * -90..-10 dB bytes) and those numbers are copied here so the bands match.
 */
import { build } from 'esbuild'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFileSync } from 'node:fs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const load = async (entry) => {
  const out = await build({ entryPoints: [join(REPO, entry)], bundle: true, format: 'esm', write: false, platform: 'neutral' })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}
const { AutoVJ, PHASE, GENRE_CONFIGS } = await load('src/engine/AutoVJ.ts')
const { BeatTracker } = await load('src/engine/audio/BeatTracker.ts')
const { BandHits } = await load('src/engine/audio/BandHits.ts')

// ---------------------------------------------------------------- args
const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--'))
if (!file) { console.error('uso: node scripts/check-phases.mjs <audio> [--genre g] [--from s] [--to s] [--cues f] [--csv f] [--breakBass x] ...'); process.exit(2) }
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def }
const genre = opt('genre', 'hard-tekno')
if (!GENRE_CONFIGS[genre]) { console.error(`genere sconosciuto: ${genre}`); process.exit(2) }
const from = Number(opt('from', 0))
const to = Number(opt('to', 0))
for (const k of Object.keys(PHASE)) { const v = opt(k); if (v !== undefined) PHASE[k] = Number(v) }

// ---------------------------------------------------------------- decode
const SR = 44100
const FFT = 2048
const FPS = 60
const ff = spawnSync('ffmpeg', ['-v', 'error', '-i', file, ...(from ? ['-ss', String(from)] : []), ...(to ? ['-to', String(to)] : []),
  '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 2 ** 31 })
if (ff.status !== 0) { console.error('ffmpeg:', ff.stderr.toString()); process.exit(1) }
const pcm = new Float32Array(ff.stdout.buffer, ff.stdout.byteOffset, ff.stdout.byteLength / 4)
const seconds = pcm.length / SR
console.log(`${file}: ${seconds.toFixed(0)} s, genere ${GENRE_CONFIGS[genre].label}, soglie ${JSON.stringify(PHASE)}`)

// ---------------------------------------------------------------- analyser clone
const N = FFT, HALF = FFT / 2
const window_ = new Float32Array(N)
for (let i = 0; i < N; i++) {
  // Blackman, as the Web Audio spec prescribes for AnalyserNode
  const a0 = 0.42, a1 = 0.5, a2 = 0.08
  window_[i] = a0 - a1 * Math.cos(2 * Math.PI * i / N) + a2 * Math.cos(4 * Math.PI * i / N)
}
const re = new Float32Array(N), im = new Float32Array(N)
const rev = new Uint32Array(N)
for (let i = 0, bits = Math.log2(N); i < N; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r }
function fft() {
  for (let i = 0; i < N; i++) if (i < rev[i]) { let t = re[i]; re[i] = re[rev[i]]; re[rev[i]] = t; t = im[i]; im[i] = im[rev[i]]; im[rev[i]] = t }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, step = -2 * Math.PI / size
    for (let start = 0; start < N; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = Math.cos(step * k), wi = Math.sin(step * k)
        const i = start + k, j = i + half
        const tr = re[j] * wr - im[j] * wi, ti = re[j] * wi + im[j] * wr
        re[j] = re[i] - tr; im[j] = im[i] - ti; re[i] += tr; im[i] += ti
      }
    }
  }
}
const smooth = new Float32Array(HALF)     // smoothed magnitudes (0.4 time constant)
const bytes = new Float32Array(HALF)      // 0..255 like getByteFrequencyData
const spec = new Float32Array(HALF)       // bytes / 255 for the tracker
const binHz = (SR / 2) / HALF
const MIN_DB = -90, MAX_DB = -10, SMOOTH = 0.4
function analyse(end) {
  const start = end - N
  for (let i = 0; i < N; i++) { re[i] = (start + i >= 0 ? pcm[start + i] : 0) * window_[i]; im[i] = 0 }
  fft()
  for (let k = 0; k < HALF; k++) {
    const mag = Math.hypot(re[k], im[k]) / N
    smooth[k] = SMOOTH * smooth[k] + (1 - SMOOTH) * mag
    const db = 20 * Math.log10(smooth[k] + 1e-12)
    bytes[k] = Math.max(0, Math.min(255, Math.round(255 * (db - MIN_DB) / (MAX_DB - MIN_DB))))
    spec[k] = bytes[k] / 255
  }
}
function bandAvg(lowHz, highHz) {
  const lo = Math.max(0, Math.floor(lowHz / binHz))
  const hi = Math.min(Math.ceil(highHz / binHz), HALF - 1)
  let sum = 0
  for (let i = lo; i <= hi; i++) sum += bytes[i]
  return sum / ((hi - lo + 1) * 255)
}

// ---------------------------------------------------------------- replay
const tracker = new BeatTracker()
// --bpm N plays the role of the BPM library / manual tempo the app feeds the PLL
tracker.externalBpm = Number(opt('bpm', 0))
tracker.tempoPrior = GENRE_CONFIGS[genre].preferredBpm
const tempoLog = []
let lockedAt = -1
const bandHits = new BandHits()
let kicks = 0, kickWindow = 0, prevHit = 0
const beatTimes = []
const kickTimes = []
const beatPhases = []
const mmss = (ms) => { const s = Math.round(ms / 1000) + from; return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
// kick periodicity: autocorrelation of the raw bass envelope at the beat lag,
// over the last 4 s. A kick is periodic; a bassline or a pad in a break is not.
const RING = 4 * FPS
const ring = new Float32Array(RING)
let ringPos = 0
function periodicity(bpm) {
  const lag = Math.round(FPS * 60 / Math.max(60, bpm))
  let mean = 0
  for (let i = 0; i < RING; i++) mean += ring[i]
  mean /= RING
  let num = 0, den = 0
  for (let i = 0; i < RING - lag; i++) {
    const a = ring[(ringPos + i) % RING] - mean, b = ring[(ringPos + i + lag) % RING] - mean
    num += a * b
  }
  for (let i = 0; i < RING; i++) { const a = ring[i] - mean; den += a * a }
  return den > 1e-9 ? Math.max(0, num / den * RING / (RING - lag)) : 0
}
const trace = []
let lastPer = 0
const vj = new AutoVJ()
const changes = []
vj.onSceneChange = (scene, cut, phase) => changes.push({ t: tNow, kind: 'scene', phase, effect: scene.effect, seconds: cut.seconds })
vj.setGenre(genre)
vj.setEnabled(true)

let peakEnergy = 0.05
const NOISE_GATE = 0.015
let tNow = 0
let lastPhase = vj.getPhase()
const segments = [{ t: 0, phase: lastPhase }]
const rows = []
const hop = SR / FPS
const bandFlux = [0, 0, 0]
let beats = 0
for (let f = 0; f * hop + N <= pcm.length; f++) {
  const end = Math.floor(f * hop) + N
  tNow = (end / SR) * 1000
  analyse(end)
  let bass = bandAvg(60, 250)
  const rawBass = bass
  let sum = 0, count = 0
  for (let i = 0; i < HALF; i++) { const w = i < HALF / 4 ? 2 : 1; sum += spec[i] * w; count += w }
  const rawEnergy = sum / count
  peakEnergy = Math.max(rawEnergy, peakEnergy * 0.998, 0.05)
  const gated = rawEnergy < NOISE_GATE ? 0 : 1
  const norm = (v) => gated * Math.min(1, v / peakEnergy)
  bass = norm(bass)
  const energy = norm(rawEnergy)
  bandFlux[0] = bandFlux[1] = bandFlux[2] = 0
  const bt = tracker.update(spec, binHz, tNow, bandFlux, gated === 1)
  if (bt.beat) { beats++; beatTimes.push(tNow) }
  if (f % (FPS * 10) === 0) tempoLog.push(`${mmss(tNow)} ${bt.acfBpm.toFixed(1)}@${bt.acfConfidence.toFixed(2)}`)
  if (lockedAt < 0 && tracker.bpm() > 0) lockedAt = tNow
  const hits = bandHits.update([bandFlux[0] / HALF, bandFlux[1] / HALF, bandFlux[2] / HALF], gated)
  // the pulse is set to 1 and decayed to 0.85 in the same frame: an onset is the frame it jumps
  const kick = hits[0] > 0.84 && prevHit <= 0.84
  prevHit = hits[0]
  if (kick) { kicks++; kickWindow++; kickTimes.push(tNow) }
  if (bt.beat) beatPhases.push(bt.beatPhase)
  ring[ringPos] = rawBass; ringPos = (ringPos + 1) % RING
  const per = f % 15 === 0 ? periodicity(tracker.bpm() || 130) : lastPer
  lastPer = per
  trace.push(rawBass, hits[0], per)
  vj.update({ beat: bt.beat, energy, bass, barPhase: bt.barPhase, bassRaw: rawBass, energyRaw: rawEnergy }, tNow)
  const phase = vj.getPhase()
  if (phase !== lastPhase) { segments.push({ t: tNow, phase }); lastPhase = phase }
  if (f % Math.round(FPS / 4) === 0) {
    const env = vj.getEnvelopes()
    rows.push({ t: tNow / 1000, bass, energy, rawBass, rawEnergy, per, kicks: kickWindow, kick: env.kick, above: env.loud - env.loudMean, phase })
    kickWindow = 0
  }
}

// ---------------------------------------------------------------- report
const GLYPH = { break: '_', build: '^', groove: '-', peak: '#' }
console.log(`\nkick (onset banda bassa): ${kicks}; beat rilevati: ${beats} (${(beats / seconds * 60).toFixed(0)} al minuto), tempo stimato ${tracker.bpm().toFixed(0)} BPM`)
{
  // inter-beat intervals in units of the tracker's own period: 1.0 = on the
  // grid, 0.5 = double triggers, 2.0 = missed beats
  const period = 60000 / (tracker.bpm() || 128)
  const bins = new Map()
  console.log(`tempo ACF ogni 10 s (bpm@confidenza): ${tempoLog.join('  ')}`)
  console.log(`tempo agganciato (bpm() > 0) a: ${lockedAt < 0 ? 'mai' : mmss(lockedAt)}`)
  console.log(`beat accettati per: ${Object.entries(tracker.accepted).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  for (let i = 1; i < beatTimes.length; i++) {
    if (beatTimes[i - 1] < lockedAt) continue
    const r = (beatTimes[i] - beatTimes[i - 1]) / period
    const key = r < 0.35 ? '<0.35' : r < 0.65 ? '0.5' : r < 0.85 ? '0.75' : r < 1.15 ? '1.0' : r < 1.6 ? '1.25-1.5' : r < 2.4 ? '2.0' : '>2.4'
    bins.set(key, (bins.get(key) ?? 0) + 1)
  }
  const n = beatTimes.filter(t => t >= lockedAt).length - 1
  console.log('intervalli fra beat (dopo l\'aggancio), in periodi del tempo stimato: ' +
    ['<0.35', '0.5', '0.75', '1.0', '1.25-1.5', '2.0', '>2.4'].map(k => `${k}: ${((bins.get(k) ?? 0) / n * 100).toFixed(0)}%`).join('  '))
}
if (opt('debug')) {
  const d0 = Number(opt('debug')) * 1000
  const fmt = (arr) => arr.filter(t => t >= d0 && t < d0 + 8000).map(t => ((t - d0) / 1000).toFixed(3)).join(' ')
  console.log('\nDEBUG 8 s da ' + mmss(d0))
  console.log('  kick:  ' + fmt(kickTimes))
  console.log('  beat:  ' + fmt(beatTimes))
  const ph = beatTimes.map((t, i) => [t, beatPhases[i]]).filter(([t]) => t >= d0 && t < d0 + 8000).map(([, p]) => p.toFixed(2)).join(' ')
  console.log('  fase al beat: ' + ph)
}
console.log('\nfasi (una riga ogni 2 minuti, un carattere ogni 2 s: _ pausa  ^ salita  - groove  # picco):')
const perChar = 2
let strip = ''
for (let s = 0; s < seconds; s += perChar) {
  const row = rows.find(r => r.t >= s) ?? rows[rows.length - 1]
  strip += GLYPH[row.phase]
}
for (let i = 0; i < strip.length; i += 60) console.log(`  ${mmss(i * perChar * 1000).padStart(6)}  ${strip.slice(i, i + 60)}`)
function stripOf(label, fn) {
  console.log(`\n${label}:`)
  let out = ''
  for (let s = 0; s < seconds; s += perChar) {
    const win = rows.filter(r => r.t >= s && r.t < s + perChar)
    out += fn(win.length ? win : [rows[rows.length - 1]])
  }
  for (let i = 0; i < out.length; i += 60) console.log(`  ${mmss(i * perChar * 1000).padStart(6)}  ${out.slice(i, i + 60)}`)
}
const digit = (v) => String(Math.max(0, Math.min(9, Math.floor(v * 10))))
const mean = (win, k) => win.reduce((a, r) => a + r[k], 0) / win.length
stripOf('escursione del basso lisciato in 0.5 s, 0.05 per cifra (kick = 4-7, tenuto = 0-1)', win => String(Math.max(0, Math.min(9, Math.floor(mean(win, 'kick') * 20)))))
stripOf('energia sopra la media lunga, +0.01 per cifra (0 = sotto)', win => String(Math.max(0, Math.min(9, Math.floor(mean(win, 'above') * 100)))))
stripOf('basso grezzo, byte/255 (0-9)', win => digit(mean(win, 'rawBass')))
stripOf('energia grezza, byte/255 (0-9)', win => digit(mean(win, 'rawEnergy')))
stripOf('kick rilevati ogni 2 s (0-9)', win => String(Math.min(9, win.reduce((a, r) => a + r.kicks, 0))))
stripOf('periodicita\' del basso al beat (0-9)', win => digit(mean(win, 'per')))

console.log('\ncambi di fase:')
for (let i = 1; i < segments.length; i++) {
  const seg = segments[i], prev = segments[i - 1]
  const held = ((seg.t - prev.t) / 1000).toFixed(0)
  console.log(`  ${mmss(seg.t)}  ${prev.phase} → ${seg.phase}   (${prev.phase} tenuto ${held} s)`)
}
const drops = changes.filter(c => c.seconds === 0)
const breaks = changes.filter(c => c.phase === 'break' && c.seconds > 1)
console.log(`\n${changes.length} cambi scena: ${drops.length} drop (taglio secco), ${breaks.length} entrate in pausa, ${changes.length - drops.length - breaks.length} a frase`)

const cuesFile = opt('cues')
if (cuesFile) {
  const { readFileSync } = await import('node:fs')
  const cues = readFileSync(cuesFile, 'utf8').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [time, kind] = l.split(/\s+/)
    const [m, s] = time.split(':').map(Number)
    return { t: (m * 60 + s - from) * 1000, kind }
  })
  console.log('\ncue a mano:')
  let hit = 0
  for (const c of cues) {
    if (c.t < 0) continue
    const want = c.kind === 'drop' ? drops : breaks
    // a drop is heard within a beat or two; a break is declared only after breakHoldMs
    const late = c.kind === 'drop' ? 4000 : PHASE.breakHoldMs + 6000
    const near = want.map(d => d.t - c.t).filter(d => d > -1500 && d < late).sort((a, b) => Math.abs(a) - Math.abs(b))[0]
    if (near !== undefined) hit++
    console.log(`  ${mmss(c.t).padStart(6)} ${c.kind.padEnd(6)} ${near !== undefined ? `trovato, ${near >= 0 ? '+' : ''}${(near / 1000).toFixed(1)} s` : 'MANCATO'}`)
  }
  console.log(`  ${hit}/${cues.length} cue colti`)
}

const traceFile = opt('trace')
if (traceFile) {
  writeFileSync(traceFile, Buffer.from(new Float32Array(trace).buffer))
  console.log(`\ntrace: ${traceFile} (float32 x3 per frame: rawBass, bassHit, periodicity; ${FPS} fps)`)
}
const csv = opt('csv')
if (csv) {
  writeFileSync(csv, 't,bass,energy,rawBass,rawEnergy,kicks,kick,above,phase\n' + rows.map(r =>
    `${r.t.toFixed(2)},${r.bass.toFixed(3)},${r.energy.toFixed(3)},${r.rawBass.toFixed(3)},${r.rawEnergy.toFixed(3)},${r.kicks},${r.kick.toFixed(3)},${r.above.toFixed(3)},${r.phase}`).join('\n'))
  console.log(`\ncsv: ${csv}`)
}
