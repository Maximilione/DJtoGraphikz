#!/usr/bin/env node
/** Plugin dichiarativi: manifest, path traversal, symlink, id, dimensioni, estensioni.  node scripts/check-plugins.mjs */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, isAbsolute } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readdirSync, lstatSync, realpathSync, readFileSync, rmSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({ entryPoints: [join(REPO, 'src/shared/plugins.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const { loadAllPlugins, sanitizePluginPath, LIMITS } =
  await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const loaderOut = await build({ entryPoints: [join(REPO, 'src/engine/IsfLoader.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const { loadISF } = await import('data:text/javascript;base64,' + Buffer.from(loaderOut.outputFiles[0].text).toString('base64'))

const fs = {
  readdir: d => readdirSync(d),
  lstat: p => { const s = lstatSync(p); return { isFile: s.isFile(), isDirectory: s.isDirectory(), isSymlink: s.isSymbolicLink(), size: s.size } },
  realpath: p => realpathSync(p), readFile: p => readFileSync(p, 'utf-8'), join,
  isInside: (r, p) => { const x = relative(r, p); return !!x && !x.startsWith('..') && !isAbsolute(x) },
}
const check = (name, fn) => { fn(); console.log('  ok', name) }
const tmp = mkdtempSync(join(tmpdir(), 'djg-plugins-'))
let n = 0
/** crea tmp/<n>/<id> con i file dati e ritorna il risultato del caricamento della cartella intera */
function make(files, manifest) {
  const root = join(tmp, String(n++)); const dir = join(root, 'p')
  mkdirSync(dir, { recursive: true })
  for (const [f, c] of Object.entries(files)) { mkdirSync(dirname(join(dir, f)), { recursive: true }); writeFileSync(join(dir, f), c) }
  if (manifest) writeFileSync(join(dir, 'plugin.json'), typeof manifest === 'string' ? manifest : JSON.stringify(manifest))
  return { root, dir }
}
const base = (over = {}) => ({ id: 'demo', name: 'Demo', version: '1.0.0', author: 'me', ...over })
const SHADER = '/*{"INPUTS":[{"NAME":"k","TYPE":"float","MIN":0,"MAX":1,"DEFAULT":0.5}]}*/\nvoid main(){ gl_FragColor = vec4(k); }'
const load = (x) => loadAllPlugins(fs, x.root)

try {
  check('esempio docs/plugin-example/neon-pack valido, shader caricabile da IsfLoader', () => {
    const root = join(tmp, 'ex'); mkdirSync(root)
    cpSync(join(REPO, 'docs/plugin-example/neon-pack'), join(root, 'neon-pack'), { recursive: true })
    const [p] = loadAllPlugins(fs, root)
    assert.deepEqual(p.errors, [])
    assert.equal(p.status, 'ok')
    assert.equal(p.effects[0].id, 'plugin:neon-pack/neon-rings')
    assert.equal(p.palettes.length, 2); assert.equal(p.presets.length, 1); assert.equal(p.sequences.length, 1); assert.equal(p.mappings.length, 1)
    const r = loadISF(p.effects[0].source, 'neon-rings')
    assert.ok(!('error' in r), r.error)
    for (const k of Object.keys(p.mappings[0].params)) assert.ok(r.params.some(d => d.key === k), `param ${k}`)
  })

  check('manifest valido: id con prefisso plugin:<id>/', () => {
    const x = make({ 'a.fs': SHADER }, base({ effects: [{ id: 'fx', name: 'Fx', file: 'a.fs' }], palettes: [{ id: 'pal', name: 'P', colors: ['#fff000', '#000fff', '#00ff00'] }] }))
    const [p] = load(x)
    assert.equal(p.status, 'ok'); assert.deepEqual(p.errors, [])
    assert.equal(p.effects[0].id, 'plugin:demo/fx'); assert.equal(p.palettes[0].id, 'plugin:demo/pal')
  })
  check('manifest: campi sbagliati, JSON rotto, id con maiuscole', () => {
    assert.equal(load(make({}, '{nope'))[0].status, 'error')
    assert.ok(load(make({}, base({ id: 'Bad Id' })))[0].errors[0].startsWith('id'))
    assert.ok(load(make({}, base({ version: 'uno' })))[0].errors.some(e => e.startsWith('version')))
    assert.ok(load(make({}, base({ author: 5 })))[0].errors.some(e => e.startsWith('author')))
    assert.equal(load(make({}, base()))[0].status, 'error')   // nessun contributo
  })
  check('path traversal ../ e percorsi assoluti rifiutati', () => {
    for (const bad of ['../x.fs', 'a/../../x.fs', '/etc/passwd.fs', 'C:/x.fs', 'a\\b.fs', './a.fs', 'a//b.fs'])
      assert.ok('error' in sanitizePluginPath(bad, ['.fs']), bad)
    assert.deepEqual(sanitizePluginPath('sub/a.FS', ['.fs']), { path: 'sub/a.FS' })
    const x = make({ 'ok.fs': SHADER }, base({ effects: [{ id: 'a', name: 'A', file: '../outside.fs' }, { id: 'b', name: 'B', file: 'ok.fs' }] }))
    writeFileSync(join(x.root, 'outside.fs'), SHADER)
    const [p] = load(x)
    assert.equal(p.effects.length, 1)              // quello buono sopravvive
    assert.ok(p.errors.some(e => e.includes('plugin:demo/a') && e.includes('../')))
  })
  check('symlink (file e cartella) rifiutati', () => {
    const x = make({}, base({ effects: [{ id: 'a', name: 'A', file: 'link.fs' }] }))
    writeFileSync(join(x.root, 'target.fs'), SHADER)
    symlinkSync(join(x.root, 'target.fs'), join(x.dir, 'link.fs'))
    const [p] = load(x)
    assert.equal(p.status, 'error'); assert.ok(p.errors.some(e => e.includes('symlink')))
    // sottocartella symlink verso fuori: il file e' raggiungibile ma fuori dalla cartella
    const y = make({}, base({ effects: [{ id: 'a', name: 'A', file: 'sub/target.fs' }] }))
    writeFileSync(join(y.root, 'target.fs'), SHADER)
    symlinkSync(y.root, join(y.dir, 'sub'))
    const [q] = load(y)
    assert.equal(q.status, 'error'); assert.ok(q.errors.some(e => e.includes('fuori')))
    // cartella plugin che e' un symlink
    const z = make({ 'a.fs': SHADER }, base({ effects: [{ id: 'a', name: 'A', file: 'a.fs' }] }))
    symlinkSync(z.dir, join(z.root, 'alias'))
    const res = load(z)
    assert.equal(res.find(r => r.dir.endsWith('alias')).status, 'error')
  })
  check('id duplicato: fra plugin e dentro lo stesso plugin', () => {
    const x = make({ 'a.fs': SHADER }, base({ effects: [{ id: 'a', name: 'A', file: 'a.fs' }, { id: 'a', name: 'A2', file: 'a.fs' }] }))
    const [p] = load(x)
    assert.equal(p.effects.length, 1); assert.ok(p.errors.some(e => e.includes('duplicato')))
    const root = join(tmp, 'dup'); mkdirSync(join(root, 'one'), { recursive: true }); mkdirSync(join(root, 'two'))
    for (const d of ['one', 'two']) writeFileSync(join(root, d, 'plugin.json'), JSON.stringify(base({ palettes: [{ id: 'p', name: 'P', colors: ['#000000', '#111111', '#222222'] }] })))
    const [a, b] = loadAllPlugins(fs, root)
    assert.equal(a.status, 'ok'); assert.equal(b.status, 'error'); assert.ok(b.errors[0].includes('duplicato'))
  })
  check('file troppo grande rifiutato', () => {
    const x = make({ 'big.fs': 'x'.repeat(LIMITS.shader + 1) }, base({ effects: [{ id: 'a', name: 'A', file: 'big.fs' }] }))
    const [p] = load(x)
    assert.equal(p.status, 'error'); assert.ok(p.errors.some(e => e.includes('troppo grande')))
    const y = make({}, JSON.stringify(base({ description: 'x'.repeat(LIMITS.manifest) })))
    assert.ok(load(y)[0].errors[0].includes('troppo grande'))
  })
  check('estensione vietata (.js, .html, senza estensione)', () => {
    const x = make({ 'a.js': 'alert(1)', 'b': SHADER }, base({ effects: [{ id: 'a', name: 'A', file: 'a.js' }, { id: 'b', name: 'B', file: 'b' }] }))
    const [p] = load(x)
    assert.equal(p.status, 'error'); assert.equal(p.errors.filter(e => e.includes('estensione')).length, 2)
    const y = make({ 'p.json': '{}' }, base({ presets: [{ id: 'a', file: 'p.js' }] }))
    assert.ok(load(y)[0].errors.some(e => e.includes('estensione')))
  })
  check('prefisso/formato id: locale con ":" o "/" rifiutato', () => {
    const x = make({ 'a.fs': SHADER }, base({ effects: [{ id: 'plugin:demo/a', name: 'A', file: 'a.fs' }, { id: 'ok', name: 'A', file: 'a.fs' }] }))
    const [p] = load(x)
    assert.equal(p.effects.length, 1); assert.equal(p.effects[0].id, 'plugin:demo/ok')
  })
  check('preset/scaletta/mapping malformati: ignorati, mai eccezioni', () => {
    const x = make({ 'p.json': '{"name":"x"}', 's.json': '[{"name":"s","steps":[]}]', 'a.fs': SHADER },
      base({ effects: [{ id: 'a', name: 'A', file: 'a.fs' }], presets: [{ id: 'p', file: 'p.json' }], sequences: [{ id: 's', file: 's.json' }],
        mappings: [{ effect: 'zzz', params: {} }, { effect: 'a', params: { k: { source: 'boh', depth: 2 } } }, 5, null] }))
    const [p] = load(x)
    assert.equal(p.status, 'ok'); assert.equal(p.presets.length, 0); assert.equal(p.sequences.length, 0)
    assert.equal(p.errors.length >= 4, true)
  })
  check('cartella plugins inesistente: lista vuota', () => {
    assert.deepEqual(loadAllPlugins(fs, join(tmp, 'non-esiste')), [])
  })
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
