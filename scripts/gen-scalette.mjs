// Genera docs/scalette/live-4h.json: tre scalette da ~80 min (importabili da
// Scalette > Importa) con le stesse scene dell'Auto VJ messe in un arco.
// node scripts/gen-scalette.mjs
import { build } from 'esbuild'
import { writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const out = '/tmp/djg-autovj.mjs'
await build({ entryPoints: ['src/engine/AutoVJ.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'error' })
const out2 = '/tmp/djg-liveposts.mjs'
await build({ entryPoints: ['src/engine/livePostSets.ts'], bundle: true, format: 'esm', outfile: out2, logLevel: 'error' })
const { GENRE_CONFIGS, FAMILY } = await import(pathToFileURL(out).href)
const { LIVE_POSTS } = await import(pathToFileURL(out2).href)

// Effetti nuovi: ogni blocco di 10 passi ne riserva 2-3 (slots = posizioni nel blocco).
// Le scene sono prese da TUTTI i genere (stessi parametri dell'Auto VJ); `only` limita effetto -> fasi,
// `cap` il numero massimo di passi. Anyma (android/monolith) pesa su Live 3; imgbeat escluso (serve immagini).
const NEW = new Set(['galaxy', 'cathedral', 'chrome', 'crystals', 'mandelbulb', 'storm', 'ribbons', 'beamfield', 'android', 'monolith', 'mesh'])
const NOT = (...e) => Object.fromEntries(e.map(x => [x, []]))
const LIVES = [
  { name: 'Live 1 — Hard Tekno', genre: 'hard-tekno', slots: [3, 7], only: { ...NOT('android', 'ribbons'), monolith: ['peak'], cathedral: ['break'] }, cap: { monolith: 2 } },
  { name: 'Live 2 — Bounce Techno', genre: 'bounce', slots: [2, 6, 9], only: { ...NOT('android', 'monolith'), cathedral: ['break', 'build'] }, cap: {} },
  { name: 'Live 3 — Techno', genre: 'dark-industrial', slots: [1, 4, 7], only: {}, cap: {} },
]
const MESH = [
  { effect: 'mesh', phase: 'groove', posts: ['bloom'], params: { look: { value: 3 }, spin: { value: 1 }, burst: { value: 0.8, source: 'beat', depth: 0.6 } } },
  { effect: 'mesh', phase: 'peak', posts: ['bloom'], params: { look: { value: 0 }, spin: { value: 1.6 }, burst: { value: 1.2, source: 'beat', depth: 0.6 } } },
]
// effetti dove i post Cinema (godrays/anamorphic/halation) rendono: scene luminose con raggi e metalli
const CINEMA_FX = new Set(['cathedral', 'beamfield', 'monolith', 'android', 'chrome', 'galaxy', 'crystals', 'mandelbulb'])
const CINE_SET = { break: 'C1', groove: 'C2', peak: 'C3' }
const TOTAL = 80 * 60
// arco: [fase, secondi per passo, passi]; si ripete a onde, poi chiusura
const WARM = [['break', 45, 2], ['groove', 60, 3]]
const WAVE = [['build', 30, 2], ['groove', 60, 3], ['peak', 45, 5], ['groove', 60, 1], ['peak', 45, 2], ['break', 40, 1]]
const CLOSE = [['groove', 60, 3], ['break', 60, 3]]
// transizioni ben visibili e varie: crossfade solo nelle pause, mai due uguali di fila
const CUTS = { break: ['crossfade', 'dissolve'], build: ['wipe-down', 'wipe-left'], groove: ['wipe-left', 'radial', 'dissolve', 'wipe-down'], peak: ['dissolve', 'radial', 'wipe-left'] }
const cutFor = (phase, i) => CUTS[phase][i % CUTS[phase].length]

function steps(cfg, live) {
  const pool = { break: [], build: [], groove: [], peak: [] }
  const fresh = { break: [], build: [], groove: [], peak: [] }
  for (const sc of cfg.scenes) if (!NEW.has(sc.effect)) pool[sc.phase].push(sc)
  const seen = new Set()
  for (const c of Object.values(GENRE_CONFIGS)) for (const sc of [...c.scenes, ...MESH]) {
    const ok = NEW.has(sc.effect) && (live.only[sc.effect] ?? [sc.phase]).includes(sc.phase)
    const key = sc.effect + sc.phase + JSON.stringify(sc.params)
    if (ok && !seen.has(key)) { seen.add(key); fresh[sc.phase].push(sc) }
  }
  const fx = {}
  const used = { break: 0, build: 0, groove: 0, peak: 0, sets: 0 }
  const closeSecs = CLOSE.reduce((t, [, h, n]) => t + h * n, 0)
  const plan = []
  const push = (phase, hold) => plan.push([phase, hold])
  for (const [p, h, n] of WARM) for (let i = 0; i < n; i++) push(p, h)
  let secs = plan.reduce((t, [, h]) => t + h, 0)
  const wave = WAVE.flatMap(([p, h, n]) => Array(n).fill([p, h]))
  while (secs + wave.reduce((t, [, h]) => t + h, 0) + closeSecs <= TOTAL) { for (const w of wave) { push(...w); secs += w[1] } }
  // riempimento: grooves finche' manca poco alla chiusura
  while (secs + 60 + closeSecs <= TOTAL) { push('peak', 45); secs += 45 }
  for (const [p, h, n] of CLOSE) for (let i = 0; i < n; i++) push(p, h)

  const res = []
  let prev = null, pal = 0, k = 0
  for (const [phase, hold] of plan) {
    const list = pool[phase]
    const okPrev = x => !prev || (x.effect !== prev.effect && FAMILY[x.effect] !== FAMILY[prev.effect])
    let sc
    // slot dei nuovi: il meno usato fra i compatibili (rispetta i tetti), altrimenti si ricade sul pool base
    if (live.slots.includes(k % 10)) {
      sc = fresh[phase].filter(x => okPrev(x) && (fx[x.effect] ?? 0) < (live.cap[x.effect] ?? 99))
        .sort((p, q) => (fx[p.effect] ?? 0) - (fx[q.effect] ?? 0))[0]
    }
    if (!sc) for (let tries = 0; tries < list.length; tries++) {
      sc = list[used[phase]++ % list.length]
      // niente stesso effetto ne' stessa famiglia due volte di fila
      if (okPrev(sc)) break
    }
    fx[sc.effect] = (fx[sc.effect] ?? 0) + 1
    prev = sc
    if (k % 2 === 0 && k) pal++
    const colors = cfg.palettes[pal % cfg.palettes.length]
    // catene di post pesanti per fase (le stesse misurate da check:sweep); i piu' luminosi non ne accumulano
    const bright = ['flash', 'strobegrid', 'lasers'].includes(sc.effect)
    const sets = bright ? LIVE_POSTS.bright : LIVE_POSTS[phase]
    const cine = !bright && CINEMA_FX.has(sc.effect) && sets.find(x => x.name === CINE_SET[phase])
    const ps = cine || sets[used.sets++ % sets.length]
    const post = Object.keys(ps.amounts)
    const effectParams = {}
    if (sc.params) effectParams[sc.effect] = Object.fromEntries(Object.entries(sc.params).map(([key, p]) =>
      [key, { value: p.value, source: p.source ?? 'none', depth: p.depth ?? 0, ...(p.lfoRate ? { lfoRate: p.lfoRate } : {}) }]))
    // piu' veloce e piu' reattivo dove deve spaccare
    const drive = { break: [0.9, 1], build: [1.1, 1.25], groove: [1.2, 1.15], peak: [1.4, 1.25] }[phase]
    effectParams[sc.effect] = { ...(effectParams[sc.effect] ?? {}),
      speed: { value: drive[0], source: 'none', depth: 0 }, reactivity: { value: drive[1], source: 'none', depth: 0 } }
    res.push({
      name: `${String(k + 1).padStart(2, '0')} ${phase} · ${sc.effect}`,
      preset: { name: `${sc.effect} (${phase})`, effect: sc.effect, post, postAmounts: ps.amounts, colors, effectParams },
      hold,
      transition: cutFor(phase, k),
    })
    k++
  }
  return res
}

const seqs = LIVES.map(l => ({ name: l.name, steps: steps(GENRE_CONFIGS[l.genre], l), loop: false, mode: 'timer', defaultHold: 90 }))
mkdirSync('docs/scalette', { recursive: true })
writeFileSync('docs/scalette/live-4h.json', JSON.stringify(seqs, null, 1))
for (const s of seqs) console.log(s.name, s.steps.length, 'passi', Math.round(s.steps.reduce((t, x) => t + x.hold, 0) / 60), 'min')
