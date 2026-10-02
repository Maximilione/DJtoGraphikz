#!/usr/bin/env node
/**
 * The Auto VJ's promises, checked without a projector:
 *
 * - every scene names a real effect, real params and real post-FX (a typo
 *   here is a scene that silently applies nothing, in the middle of a set)
 * - every genre has scenes for all three phases
 * - in the groove it switches on downbeats, one phrase apart, never two of a
 *   family back to back
 * - a break fades slow into a break scene and then holds
 * - the drop cuts, on the first kick, to a peak scene, with a new palette
 * - with no beats at all it still moves, at the genre's tempo
 *
 *     node scripts/check-autovj.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const load = async (entry) => {
  const out = await build({ entryPoints: [join(REPO, entry)], bundle: true, format: 'esm', write: false, platform: 'neutral' })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}
const { AutoVJ, GENRE_CONFIGS, FAMILY, BREAK_CUT, DROP_CUT } = await load('src/engine/AutoVJ.ts')
const { EFFECT_PARAMS, COMMON_PARAMS } = await load('src/engine/EffectParams.ts')

const POSTS = new Set(['bloom', 'rgb-split', 'chromatic', 'feedback', 'filmgrain', 'scanlines', 'pixelate', 'mirror', 'invert', 'rgb-delay'])
const COMMON = new Set(COMMON_PARAMS.map(p => p.key))

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

// ---------------------------------------------------------------- tables
check('ogni scena nomina effetto, parametri e post-FX veri', () => {
  for (const [genre, cfg] of Object.entries(GENRE_CONFIGS)) {
    for (const sc of cfg.scenes) {
      const defs = EFFECT_PARAMS[sc.effect]
      assert.ok(defs, `${genre}: effetto sconosciuto '${sc.effect}'`)
      assert.ok(FAMILY[sc.effect], `${genre}: '${sc.effect}' senza famiglia`)
      const keys = new Set(defs.map(d => d.key))
      for (const [key, sp] of Object.entries(sc.params ?? {})) {
        assert.ok(keys.has(key) || COMMON.has(key), `${genre}/${sc.effect}: parametro '${key}' inesistente`)
        const def = defs.find(d => d.key === key)
        if (def && typeof sp.value === 'number') {
          assert.ok(sp.value >= def.min && sp.value <= def.max,
            `${genre}/${sc.effect}.${key}=${sp.value} fuori da [${def.min}, ${def.max}]`)
        }
      }
      for (const post of sc.posts) assert.ok(POSTS.has(post), `${genre}/${sc.effect}: post '${post}'`)
    }
    for (const pal of cfg.palettes) assert.ok(pal.length === 3 && pal.every(c => /^#[0-9a-f]{6}$/i.test(c)), genre)
  }
})

check('ogni genere ha scene per pausa, groove e picco, e piu\' di una famiglia per fase', () => {
  for (const [genre, cfg] of Object.entries(GENRE_CONFIGS)) {
    for (const phase of ['break', 'build', 'groove', 'peak']) {
      const scenes = cfg.scenes.filter(sc => sc.phase === phase)
      assert.ok(scenes.length >= 3, `${genre}: ${scenes.length} scene di ${phase}`)
      const families = new Set(scenes.map(sc => FAMILY[sc.effect]))
      assert.ok(families.size >= 2, `${genre}/${phase}: una sola famiglia`)
    }
    assert.ok(cfg.palettes.length >= 2, genre)
    assert.ok(cfg.phraseBars >= 4, genre)
  }
})

// ---------------------------------------------------------------- simulator
/** Drives an AutoVJ with a synthetic track: 60 fps, beats from the BPM. */
function run(genre, script) {
  const vj = new AutoVJ()
  const bpm = GENRE_CONFIGS[genre].preferredBpm
  const events = []
  vj.onSceneChange = (scene, cut, phase) => events.push({ t: clock, scene, cut, phase, beat: beats })
  vj.onPaletteChange = (p) => events.push({ t: clock, palette: p })
  vj.setGenre(genre)
  vj.setEnabled(true)
  let clock = 0, beats = 0, nextBeat = 0
  const beatMs = 60000 / bpm
  // raw bass: a bassline floor plus, while the kick plays, a sharp spike on
  // every beat that decays over ~120 ms. A break keeps the floor and loses the
  // spikes — that is what the detector has to see.
  for (const step of script) {
    const end = clock + step.ms
    while (clock < end) {
      const beat = step.beats !== false && clock >= nextBeat
      if (beat) { nextBeat += beatMs; beats++ }
      const barPhase = ((clock / beatMs) % 4) / 4
      const sinceBeat = (clock % beatMs)
      const spike = step.beats !== false ? 0.28 * Math.exp(-sinceBeat / 120) : 0
      const bassRaw = step.silent ? 0 : 0.5 + spike
      const energyRaw = step.silent ? 0 : (step.energyRaw ?? 0.2)
      vj.update({ beat, energy: step.energy, bass: step.bass, barPhase, bassRaw, energyRaw }, clock)
      clock += 1000 / 60
    }
  }
  return { events, vj, beatMs }
}
const scenes = (ev) => ev.filter(e => e.scene)

check('nel groove cambia sulla battuta, una frase alla volta, mai due della stessa famiglia', () => {
  const cfg = GENRE_CONFIGS['hard-tekno']
  const { events, beatMs } = run('hard-tekno', [{ ms: 120000, energy: 0.5, bass: 0.6 }])
  const sc = scenes(events)
  assert.ok(sc.length >= 5, `solo ${sc.length} cambi in due minuti`)
  for (const e of sc) {
    assert.equal(e.phase, 'groove')
    assert.equal(e.scene.phase, 'groove', e.scene.effect)
    assert.deepEqual(e.cut, cfg.cut)
    // on a downbeat: the beat count at the switch is a multiple of four (+/- the frame)
    assert.ok(e.beat % 4 === 0 || e.beat % 4 === 1, `cambio fuori battuta al beat ${e.beat}`)
  }
  for (let i = 1; i < sc.length; i++) {
    const beatsApart = Math.round((sc[i].t - sc[i - 1].t) / beatMs)
    assert.ok(Math.abs(beatsApart - cfg.phraseBars * 4) <= 4, `${beatsApart} beat fra due scene, attesi ${cfg.phraseBars * 4}`)
    assert.notEqual(FAMILY[sc[i].scene.effect], FAMILY[sc[i - 1].scene.effect], `${sc[i - 1].scene.effect} -> ${sc[i].scene.effect}`)
    assert.notEqual(sc[i].scene.effect, sc[i - 1].scene.effect)
  }
})

check('la pausa entra piano su una scena di pausa e poi tiene', () => {
  const { events, vj } = run('hard-tekno', [
    { ms: 20000, energy: 0.5, bass: 0.6 },
    { ms: 30000, energy: 0.3, bass: 0.08, beats: false },
  ])
  const sc = scenes(events).filter(e => e.t > 20000)
  assert.ok(sc.length >= 1, 'nessun cambio nella pausa')
  assert.ok(sc[0].t - 20000 < 6000, `la pausa e\' arrivata dopo ${(sc[0].t - 20000) | 0} ms`)
  assert.equal(sc[0].phase, 'break')
  assert.equal(sc[0].scene.phase, 'break')
  assert.deepEqual(sc[0].cut, BREAK_CUT)
  // hold: at most one more change in the following 30 s (the slow break rotation)
  assert.ok(sc.length <= 2, `${sc.length} cambi in 30 s di pausa`)
  assert.equal(vj.getPhase(), 'break')
})

check('il drop taglia sul primo kick, su una scena di picco, con palette nuova', () => {
  const { events } = run('hard-tekno', [
    { ms: 20000, energy: 0.5, bass: 0.6 },
    { ms: 12000, energy: 0.3, bass: 0.08, beats: false },
    { ms: 8000, energy: 0.9, bass: 0.95 },
  ])
  const drop = scenes(events).find(e => e.t >= 32000)
  assert.ok(drop, 'nessun cambio al drop')
  assert.ok(drop.t - 32000 < 250, `il drop e\' arrivato dopo ${(drop.t - 32000) | 0} ms`)
  assert.equal(drop.phase, 'peak')
  assert.equal(drop.scene.phase, 'peak')
  assert.deepEqual(drop.cut, DROP_CUT)
  const pal = events.find(e => e.palette && e.t >= 32000 && e.t <= drop.t)
  assert.ok(pal, 'nessuna palette nuova sul drop')
})

check('la salita: pausa che si alza senza kick, poi il drop la chiude', () => {
  const { events, vj } = run('hard-tekno', [
    { ms: 20000, energy: 0.5, bass: 0.6, energyRaw: 0.2 },
    { ms: 12000, energy: 0.3, bass: 0.08, beats: false, energyRaw: 0.12 },
    { ms: 12000, energy: 0.5, bass: 0.08, beats: false, energyRaw: 0.2 },
    { ms: 6000, energy: 0.9, bass: 0.95, energyRaw: 0.3 },
  ])
  const build = scenes(events).find(e => e.phase === 'build')
  assert.ok(build, 'nessuna scena di salita')
  assert.ok(build.t > 32000 && build.t < 40000, `salita a ${(build.t / 1000) | 0} s`)
  assert.equal(build.scene.phase, 'build')
  const drop = scenes(events).find(e => e.t >= 44000)
  assert.ok(drop && drop.cut.seconds === 0 && drop.phase === 'peak', 'il drop dopo la salita non taglia')
  assert.equal(vj.getPhase(), 'peak')
})

check('onPhaseChange suona a ogni cambio di fase, scena o no', () => {
  const vj = new AutoVJ()
  const seen = []
  vj.onPhaseChange = (p) => seen.push(p)
  vj.setGenre('hard-tekno'); vj.setEnabled(true)
  let clock = 0
  const step = (ms, f) => { const end = clock + ms; while (clock < end) { vj.update(f(clock), clock); clock += 1000 / 60 } }
  const beatMs = 60000 / 155
  step(20000, t => ({ beat: t % beatMs < 17, energy: 0.5, bass: 0.6, barPhase: ((t / beatMs) % 4) / 4, bassRaw: 0.5 + 0.28 * Math.exp(-(t % beatMs) / 120), energyRaw: 0.2 }))
  step(12000, t => ({ beat: false, energy: 0.3, bass: 0.1, barPhase: 0, bassRaw: 0.5, energyRaw: 0.12 }))
  assert.deepEqual(seen, ['break'])
})

check('le scene mie entrano in rotazione, e con "solo le mie" sono la rotazione', () => {
  const mineScene = { effect: 'glitch', phase: 'groove', posts: ['scanlines'], params: { blocks: { value: 10 } } }
  const mk = (onlyMine) => {
    const vj = new AutoVJ()
    const seen = []
    vj.onSceneChange = (sc) => seen.push(sc.effect)
    vj.setGenre('hard-tekno'); vj.setEnabled(true)
    vj.setUserScenes({ 'hard-tekno': [mineScene] }, onlyMine)
    const beatMs = 60000 / 155
    // the pick is random among ~14 groove scenes: run until it shows, up to
    // twenty minutes, instead of betting on four (that flaked one run in four)
    for (let t = 0; t < 1200000; t += 1000 / 60) {
      vj.update({ beat: t % beatMs < 17, energy: 0.5, bass: 0.6, barPhase: ((t / beatMs) % 4) / 4, bassRaw: 0.5 + 0.28 * Math.exp(-(t % beatMs) / 120), energyRaw: 0.2 }, t)
      if (!onlyMine && seen.includes('glitch') && seen.length > 3) break
      if (onlyMine && seen.length >= 6) break
    }
    return seen
  }
  const mixed = mk(false)
  assert.ok(mixed.includes('glitch'), 'la scena mia non e\' mai uscita in venti minuti')
  assert.ok(mixed.some(e => e !== 'glitch'), 'con "tutte" uscivano solo le mie')
  const only = mk(true)
  assert.ok(only.length >= 5 && only.every(e => e === 'glitch'), `con "solo le mie": ${only.join(',')}`)
})

check('al picco le scene durano mezza frase', () => {
  const cfg = GENRE_CONFIGS['hard-tekno']
  const { events, beatMs } = run('hard-tekno', [{ ms: 60000, energy: 0.5, bass: 0.6, energyRaw: 0.2 }, { ms: 90000, energy: 0.9, bass: 0.8, energyRaw: 0.26 }])
  const sc = scenes(events).filter(e => e.t > 70000 && e.t < 140000)
  assert.ok(sc.length >= 6, `solo ${sc.length} cambi al picco`)
  for (const e of sc) assert.equal(e.scene.phase, 'peak', e.scene.effect)
  for (let i = 1; i < sc.length; i++) {
    const beatsApart = Math.round((sc[i].t - sc[i - 1].t) / beatMs)
    assert.ok(Math.abs(beatsApart - cfg.phraseBars * 2) <= 4, `${beatsApart} beat al picco, attesi ${cfg.phraseBars * 2}`)
  }
})

check('la palette cambia a blocchi di quattro scene, non a caso', () => {
  const { events } = run('acid-techno', [{ ms: 300000, energy: 0.5, bass: 0.6 }])
  let since = 0
  for (const e of events) {
    if (e.scene) since++
    if (e.palette) { assert.equal(since, 4, `palette dopo ${since} scene`); since = 0 }
  }
})

check('senza beat il tempo del genere manda avanti la frase', () => {
  const cfg = GENRE_CONFIGS['hard-tekno']
  const { events } = run('hard-tekno', [{ ms: 60000, energy: 0.5, bass: 0.6, beats: false }])
  const sc = scenes(events)
  const phraseMs = cfg.phraseBars * 4 * 60000 / cfg.preferredBpm
  assert.ok(sc.length >= Math.floor(60000 / phraseMs) - 1, `solo ${sc.length} cambi senza beat`)
  assert.ok(sc.length <= Math.ceil(60000 / phraseMs) + 1, `${sc.length} cambi senza beat: troppi`)
})

check('il silenzio e\' una pausa: nessun cambio ogni cinque secondi', () => {
  const { events, vj } = run('dark-industrial', [{ ms: 60000, energy: 0, bass: 0, beats: false, silent: true }])
  const sc = scenes(events)
  assert.ok(sc.length <= 3, `${sc.length} cambi in un minuto di silenzio`)
  assert.equal(vj.getPhase(), 'break')
  for (const e of sc) assert.equal(e.scene.phase, 'break')
})

console.log(`\n${checks} controlli passati`)
