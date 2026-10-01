#!/usr/bin/env node
/**
 * Sequences: does a playlist saved by an older version still load, and does
 * playback walk it correctly?
 *
 * The migration runs on data the user already has on disk. Getting it wrong
 * silently empties somebody's setlist the night they need it, and nothing in
 * the app would report an error.
 *
 *   node scripts/check-sequences.mjs
 */
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = mkdtempSync(join(tmpdir(), 'djg-seq-'))
const bundle = join(out, 'sequences.cjs')
const playerBundle = join(out, 'player.cjs')

for (const [src, dst] of [['sequences.ts', bundle], ['sequencePlayer.ts', playerBundle]]) {
  execFileSync('npx', ['esbuild', join(REPO, 'src/renderer/components/PresetPanel', src),
    '--bundle', '--format=cjs', '--platform=node', `--outfile=${dst}`],
    { cwd: REPO, stdio: 'pipe' })
}

const { migrate, migrateAll, clampHold, nextIndex, prevIndex, moveStep, totalHold, indexAfterRemoval, usesHold } =
  await import('file://' + bundle)
const { enterStep, clearStepOverlays, paramsFromScreen, SEQ_PREFIX } = await import('file://' + playerBundle)

const look = name => ({ name, effect: 'tunnel', post: [], colors: ['#000', '#111', '#222'] })

// --- a playlist written by v0.27 and earlier ---
const legacy = {
  name: 'Serata vecchia',
  presets: [look('uno'), look('due'), look('tre')],
  loop: false,
  autoAdvance: true,
  advanceMode: 'beats',
  advanceInterval: 16,
}
const m = migrate(legacy)
assert.equal(m.name, 'Serata vecchia')
assert.equal(m.mode, 'beats')
assert.equal(m.loop, false)
assert.deepEqual(m.steps.map(s => s.name), ['uno', 'due', 'tre'], 'ordine dei passi conservato')
assert.ok(m.steps.every(s => s.hold === 16), 'ogni passo eredita l’intervallo unico della vecchia playlist')
assert.equal(m.steps[0].preset.effect, 'tunnel', 'il look arriva intero')
console.log('vecchia playlist migrata:', m.steps.length, 'passi da', m.steps[0].hold, 'beat')

// --- a sequence already in the new shape must survive untouched ---
const modern = {
  name: 'Nuova', mode: 'timer', loop: true, defaultHold: 8,
  steps: [{ name: 'a', preset: look('a'), hold: 4 }, { name: 'b', preset: look('b'), hold: 30 }],
}
const m2 = migrate(modern)
assert.deepEqual(m2.steps.map(s => s.hold), [4, 30], 'le durate per passo restano quelle')
assert.equal(totalHold(m2), 34)

// --- junk must not throw ---
assert.equal(migrate({}).steps.length, 0)
assert.equal(migrateAll(null).length, 0)
assert.equal(migrateAll([null, undefined, { name: 'ok' }]).length, 1)

// --- holds stay inside the unit's range ---
assert.equal(clampHold(999, 'beats'), 128)
assert.equal(clampHold(0, 'timer'), 1)
assert.equal(clampHold(NaN, 'timer'), 1)

// --- walking the sequence ---
assert.equal(nextIndex(0, 3, false), 1)
assert.equal(nextIndex(2, 3, true), 0, 'in loop torna al primo')
assert.equal(nextIndex(2, 3, false), -1, 'senza loop finisce')
assert.equal(nextIndex(0, 0, true), -1, 'scaletta vuota')
assert.equal(prevIndex(0, 3, true), 2)
assert.equal(prevIndex(0, 3, false), 0)

// --- reorder ---
const steps = ['a', 'b', 'c', 'd'].map(n => ({ name: n, preset: look(n), hold: 1 }))
assert.deepEqual(moveStep(steps, 0, 2).map(s => s.name), ['b', 'c', 'a', 'd'])
assert.deepEqual(moveStep(steps, 3, 0).map(s => s.name), ['d', 'a', 'b', 'c'])
assert.deepEqual(moveStep(steps, 1, 1).map(s => s.name), ['a', 'b', 'c', 'd'])
assert.deepEqual(moveStep(steps, -1, 9).map(s => s.name), ['a', 'b', 'c', 'd'], 'indici fuori range non rompono nulla')

// --- deleting a sequence must not make the editor save over another one ---
assert.equal(indexAfterRemoval(3, 1), 2, 'cancellandone una prima, quella aperta scala di uno')
assert.equal(indexAfterRemoval(1, 3), 1, 'cancellandone una dopo, l’indice non cambia')
assert.equal(indexAfterRemoval(2, 2), -1, 'cancellata proprio quella aperta')
assert.equal(indexAfterRemoval(-1, 0), -1, 'nessuna scaletta aperta')

// --- sequences saved before step graphics existed: no `overlays`, still load ---
assert.equal(m2.steps[0].overlays, undefined, 'niente grafica inventata su un passo vecchio')
const withGfx = migrate({
  name: 'Con grafica', mode: 'track', loop: true, defaultHold: 8,
  steps: [{ name: 'a', preset: look('a'), hold: 4, overlays: [
    { kind: 'image', name: 'logo.png', path: '/lib/logo.png', opacity: 0.8, scale: 0.5, offsetX: 0.1, offsetY: -0.2 },
  ] }],
})
assert.equal(withGfx.mode, 'track')
assert.equal(withGfx.steps[0].overlays.length, 1, 'la grafica del passo sopravvive alla migrazione')
assert.equal(migrate({ mode: 'manual' }).mode, 'manual')
assert.equal(migrate({ mode: 'bogus' }).mode, 'timer', 'un modo sconosciuto torna a timer')

// --- hold is ignored in track/manual, but must not break ---
assert.equal(usesHold('timer'), true)
assert.equal(usesHold('beats'), true)
assert.equal(usesHold('track'), false)
assert.equal(usesHold('manual'), false)
assert.equal(clampHold(5000, 'track'), 120, 'hold clampato come secondi anche dove non conta')
assert.equal(clampHold(NaN, 'manual'), 1)
console.log('modi track/manual: hold ignorato, migrazione senza overlays ok')

// --- player: a step's graphics come up on enter and go down on leave,
//     the user's own overlays are never touched ---
function fakeHost() {
  const items = [{ id: 'overlay_user', name: 'mio.png', opacity: 1, scale: 0.3, offsetX: 0, offsetY: 0, gifSync: 'beat' }]
  const log = []
  return {
    items, log,
    getOverlays: () => items,
    removeOverlay(id) { const i = items.findIndex(o => o.id === id); if (i >= 0) items.splice(i, 1); log.push('rm ' + id) },
    async addOverlay(name, dataUrl, id) { items.push({ id, name, dataUrl }); log.push('add ' + id) },
    addTextOverlay(text, opts, id) { items.push({ id, name: text, color: opts?.color }); log.push('text ' + id) },
    updateOverlay(id, u) { Object.assign(items.find(o => o.id === id), u); log.push('upd ' + id) },
  }
}
const seqIds = host => host.items.map(o => o.id).filter(id => id.startsWith(SEQ_PREFIX))
const readPath = async (path) => 'data:image/png;base64,' + path

const host = fakeHost()
const stepA = { overlays: [
  { kind: 'image', name: 'logo.png', path: '/lib/logo.png', opacity: 0.8, scale: 0.5, offsetX: 0.1, offsetY: -0.2 },
  { kind: 'gif', name: 'loop.gif', path: '/lib/loop.gif', opacity: 1, scale: 0.3, offsetX: 0, offsetY: 0, gifSync: 'bpm' },
  { kind: 'text', name: 'DROP', text: 'DROP', color: '#ff0000', opacity: 1, scale: 0.4, offsetX: 0, offsetY: 0.3 },
] }
await enterStep(host, stepA, readPath)
assert.equal(seqIds(host).length, 3, 'tre grafiche del passo a schermo')
assert.ok(host.items.some(o => o.id === 'overlay_user'), 'l’overlay dell’utente resta')
const logo = host.items.find(o => o.name === 'logo.png')
assert.deepEqual([logo.opacity, logo.scale, logo.offsetX, logo.offsetY], [0.8, 0.5, 0.1, -0.2], 'parametri del passo applicati')
assert.equal(logo.dataUrl, 'data:image/png;base64,/lib/logo.png', 'l’immagine viene letta dal percorso in libreria')
assert.equal(host.items.find(o => o.name === 'loop.gif').gifSync, 'bpm', 'gifSync del passo applicato')
assert.equal(host.items.find(o => o.name === 'DROP').color, '#ff0000', 'testo col suo colore')
assert.equal(host.log.filter(l => l.startsWith('rm')).length, 0, 'primo ingresso: niente da togliere')

// next step with no graphics: clean screen from sequence overlays, user's untouched
await enterStep(host, { overlays: undefined }, readPath)
assert.equal(seqIds(host).length, 0, 'passo senza grafica = schermo pulito dalle grafiche di scaletta')
assert.ok(host.items.some(o => o.id === 'overlay_user'), 'l’overlay dell’utente resta anche dopo')
assert.ok(!host.log.includes('rm overlay_user'), 'mai rimosso l’overlay dell’utente')

// enter → leave order: the new step removes the old step's ids BEFORE adding its own
const host2 = fakeHost()
await enterStep(host2, stepA, readPath)
host2.log.length = 0
await enterStep(host2, { overlays: [stepA.overlays[2]] }, readPath)
const firstAdd = host2.log.findIndex(l => l.startsWith('text') || l.startsWith('add'))
const lastRm = host2.log.map((l, i) => (l.startsWith('rm') ? i : -1)).filter(i => i >= 0).pop()
assert.ok(lastRm < firstAdd, 'prima si tolgono le vecchie, poi si aggiungono le nuove')
assert.equal(seqIds(host2).length, 1)

// a step left while its image was still loading must not land on the next one
const host3 = fakeHost()
let alive = true
const slow = enterStep(host3, { overlays: [stepA.overlays[0]] }, p => new Promise(r => setTimeout(() => r('data:' + p), 10)), () => alive)
alive = false
await slow
assert.equal(seqIds(host3).length, 0, 'immagine arrivata in ritardo: tolta subito')

// a missing file skips that graphic, the rest of the step still comes up
const host4 = fakeHost()
await enterStep(host4, { overlays: [stepA.overlays[0], stepA.overlays[2]] }, async () => { throw new Error('ENOENT') })
assert.equal(seqIds(host4).length, 1, 'file mancante: le altre grafiche del passo escono lo stesso')

// stop = clear
clearStepOverlays(host2)
assert.equal(seqIds(host2).length, 0, 'stop toglie le grafiche di scaletta')
assert.ok(host2.items.some(o => o.id === 'overlay_user'))

// "as it is now": on-screen params win over the defaults
assert.deepEqual(paramsFromScreen([{ name: 'logo.png', opacity: 0.4, scale: 1.2, offsetX: 0.2, offsetY: 0.1, gifSync: 'free' }], 'logo.png'),
  { opacity: 0.4, scale: 1.2, offsetX: 0.2, offsetY: 0.1, gifSync: 'free' })
assert.deepEqual(paramsFromScreen([], 'logo.png'), { opacity: 1, scale: 0.3, offsetX: 0, offsetY: 0 }, 'non a schermo: default centrati')
console.log('player: grafiche del passo con prefisso', SEQ_PREFIX, 'entrano/escono, overlay utente intatti')

rmSync(out, { recursive: true, force: true })
console.log('OK: migrazione, durate per passo, scorrimento della scaletta, modi track/manual, grafica di passo')
