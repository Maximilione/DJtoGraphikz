// Genera docs/scalette/live-4h.json: tre scalette da ~80 min (importabili da
// Scalette > Importa) con le stesse scene dell'Auto VJ messe in un arco.
// node scripts/gen-scalette.mjs
import { build } from 'esbuild'
import { writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const out = '/tmp/djg-autovj.mjs'
await build({ entryPoints: ['src/engine/AutoVJ.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'error' })
const { GENRE_CONFIGS, FAMILY } = await import(pathToFileURL(out).href)

const LIVES = [
  { name: 'Live 1 — Hard Tekno', genre: 'hard-tekno' },
  { name: 'Live 2 — Bounce Techno', genre: 'bounce' },
  { name: 'Live 3 — Techno', genre: 'dark-industrial' },
]
const TOTAL = 80 * 60
// arco: [fase, secondi per passo, passi]; si ripete a onde, poi chiusura
const WARM = [['break', 100, 3], ['groove', 100, 3]]
const WAVE = [['build', 60, 1], ['groove', 100, 4], ['peak', 90, 3], ['groove', 100, 2], ['break', 90, 1]]
const CLOSE = [['groove', 100, 2], ['break', 120, 3]]
const cutFor = (phase, i) => phase === 'peak' ? ['dissolve', 'radial', 'wipe-left'][i % 3] : phase === 'build' ? 'wipe-down' : 'crossfade'

function steps(cfg) {
  const pool = { break: [], build: [], groove: [], peak: [] }
  for (const sc of cfg.scenes) pool[sc.phase].push(sc)
  const used = { break: 0, build: 0, groove: 0, peak: 0 }
  const closeSecs = CLOSE.reduce((t, [, h, n]) => t + h * n, 0)
  const plan = []
  const push = (phase, hold) => plan.push([phase, hold])
  for (const [p, h, n] of WARM) for (let i = 0; i < n; i++) push(p, h)
  let secs = plan.reduce((t, [, h]) => t + h, 0)
  const wave = WAVE.flatMap(([p, h, n]) => Array(n).fill([p, h]))
  while (secs + wave.reduce((t, [, h]) => t + h, 0) + closeSecs <= TOTAL) { for (const w of wave) { push(...w); secs += w[1] } }
  // riempimento: grooves finche' manca poco alla chiusura
  while (secs + 100 + closeSecs <= TOTAL) { push('groove', 100); secs += 100 }
  for (const [p, h, n] of CLOSE) for (let i = 0; i < n; i++) push(p, h)

  const res = []
  let prev = null, pal = 0, k = 0
  for (const [phase, hold] of plan) {
    const list = pool[phase]
    let sc
    for (let tries = 0; tries < list.length; tries++) {
      sc = list[used[phase]++ % list.length]
      // niente stesso effetto ne' stessa famiglia due volte di fila
      if (!prev || (sc.effect !== prev.effect && FAMILY[sc.effect] !== FAMILY[prev.effect])) break
    }
    prev = sc
    if (k % 4 === 0 && k) pal++
    const colors = cfg.palettes[pal % cfg.palettes.length]
    const effectParams = {}
    if (sc.params) effectParams[sc.effect] = Object.fromEntries(Object.entries(sc.params).map(([key, p]) =>
      [key, { value: p.value, source: p.source ?? 'none', depth: p.depth ?? 0, ...(p.lfoRate ? { lfoRate: p.lfoRate } : {}) }]))
    res.push({
      name: `${String(k + 1).padStart(2, '0')} ${phase} · ${sc.effect}`,
      preset: { name: `${sc.effect} (${phase})`, effect: sc.effect, post: sc.posts, colors, effectParams },
      hold,
      transition: cutFor(phase, k),
    })
    k++
  }
  return res
}

const seqs = LIVES.map(l => ({ name: l.name, steps: steps(GENRE_CONFIGS[l.genre]), loop: false, mode: 'timer', defaultHold: 90 }))
mkdirSync('docs/scalette', { recursive: true })
writeFileSync('docs/scalette/live-4h.json', JSON.stringify(seqs, null, 1))
for (const s of seqs) console.log(s.name, s.steps.length, 'passi', Math.round(s.steps.reduce((t, x) => t + x.hold, 0) / 60), 'min')
