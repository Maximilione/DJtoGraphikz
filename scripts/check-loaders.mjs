#!/usr/bin/env node
/**
 * The shader importers are parsers, and a parser that quietly produces almost
 * right GLSL fails as a black projector ten minutes later. This runs both of
 * them plus the pass splitter over small inputs and asserts on the output.
 *
 *     node scripts/check-loaders.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))

async function load(file) {
  const out = await build({
    entryPoints: [join(REPO, 'src/engine', file)],
    bundle: true, format: 'esm', write: false, platform: 'neutral',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

const { loadISF } = await load('IsfLoader.ts')
const { loadShadertoy } = await load('ShadertoyLoader.ts')
const { splitCustomPasses } = await load('customPasses.ts')

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

// ---- pass splitter ----
check('no marker = one pass', () => {
  const p = splitCustomPasses('void main(){}')
  assert.equal(p.length, 1)
  assert.equal(p[0].buffer, '')
})

check('code above the first marker is shared by every pass', () => {
  const p = splitCustomPasses('float helper();\n//!DJG_BUFFER A\nA\n//!DJG_MAIN\nM\n')
  assert.equal(p.length, 2)
  assert.equal(p[0].buffer, 'A')
  assert.equal(p[1].buffer, '')
  assert.ok(p[0].frag.includes('float helper();'))
  assert.ok(p[1].frag.includes('float helper();'))
  assert.ok(p[1].frag.includes('M'))
})

check('buffers only get a blit so something reaches the screen', () => {
  const p = splitCustomPasses('//!DJG_BUFFER A\nA\n')
  assert.equal(p.length, 2)
  assert.equal(p[1].buffer, '')
  assert.ok(p[1].frag.includes('texture2D(tBufferA, vUv)'))
})

// ---- ISF ----
const isfHeader = (extra) => `/*{
  "DESCRIPTION": "t", "ISFVSN": "2",
  "INPUTS": [{"NAME":"amt","TYPE":"float","MIN":0,"MAX":1,"DEFAULT":0.5}]${extra}
}*/
void main() { gl_FragColor = vec4(amt, PASSINDEX, 0.0, 1.0); }`

check('ISF single pass keeps its INPUTS as params', () => {
  const r = loadISF(isfHeader(''))
  assert.ok(!('error' in r))
  assert.equal(r.params.length, 1)
  assert.equal(r.params[0].key, 'amt')
  assert.ok(r.fragment.includes('uniform float amt;'))
  assert.ok(!r.fragment.includes('//!DJG_BUFFER'))
})

check('ISF multi-pass emits one section per PASS with its own PASSINDEX', () => {
  const r = loadISF(isfHeader(', "PASSES": [{"TARGET":"bufA","PERSISTENT":true},{}]'))
  assert.ok(!('error' in r))
  const sections = r.fragment.split('//!DJG_BUFFER').length - 1
  assert.equal(sections, 2)
  assert.ok(r.fragment.includes('#define PASSINDEX 0'))
  assert.ok(r.fragment.includes('#define PASSINDEX 1'))
  // the body reads a target by name; it must land on the engine's uniform
  assert.ok(r.fragment.includes('#define bufA tBufferbufA'))
})

check('ISF filters are still refused, with a reason', () => {
  const r = loadISF('/*{"INPUTS":[]}*/\nvoid main(){ gl_FragColor = IMG_THIS_PIXEL(inputImage); }')
  assert.ok('error' in r)
  assert.match(r.error, /filtro/)
})

// ---- Shadertoy ----
const TOY = 'void mainImage(out vec4 o, in vec2 f) { o = vec4(f / iResolution.xy, iTime, 1.0); }'

check('Shadertoy paste becomes one pass with the built-ins defined', () => {
  const r = loadShadertoy(TOY)
  assert.ok(!('error' in r))
  assert.ok(r.fragment.includes('#define iTime uTime'))
  assert.ok(r.fragment.includes('#define iResolution vec3(uResolution, 1.0)'))
  assert.ok(r.fragment.includes('mainImage(djgOut'))
  assert.ok(!r.fragment.includes('//!DJG_BUFFER'))
})

check('Shadertoy without mainImage is refused', () => {
  const r = loadShadertoy('void main(){}')
  assert.ok('error' in r)
})

check('Shadertoy JSON wires Buffer A into the image pass channel', () => {
  const json = JSON.stringify({ Shader: { info: { name: 'x' }, renderpass: [
    { type: 'common', code: 'float k(){return 1.0;}' },
    { type: 'buffer', outputs: [{ id: '4dX3Rr' }], inputs: [], code: TOY },
    { type: 'image', outputs: [{ id: '4dfGRr' }], inputs: [{ channel: 0, id: '4dX3Rr', ctype: 'buffer' }], code: TOY },
  ] } })
  const r = loadShadertoy(json)
  assert.ok(!('error' in r))
  const parts = splitCustomPasses(r.fragment)
  assert.equal(parts.length, 2)
  assert.equal(parts[0].buffer, 'A')
  assert.equal(parts[1].buffer, '')
  assert.ok(parts[1].frag.includes('#define iChannel0 tBufferA'))
  // common code must reach both passes
  assert.ok(parts[0].frag.includes('float k()'))
  assert.ok(parts[1].frag.includes('float k()'))
})

check('Shadertoy texture channels become image inputs', () => {
  const json = JSON.stringify({ Shader: { renderpass: [
    { type: 'image', outputs: [{ id: 'a' }], inputs: [{ channel: 1, id: 'z', ctype: 'texture' }], code: TOY },
  ] } })
  const r = loadShadertoy(json)
  assert.ok(!('error' in r))
  assert.deepEqual(r.imageInputs, ['iChannel1'])
  assert.ok(r.fragment.includes('uniform sampler2D iChannel1;'))
})

check('more buffers than the engine has is refused, not truncated', () => {
  const pass = (id) => ({ type: 'buffer', outputs: [{ id }], inputs: [], code: TOY })
  const json = JSON.stringify({ Shader: { renderpass: [
    pass('1'), pass('2'), pass('3'), pass('4'), pass('5'),
    { type: 'image', outputs: [{ id: 'i' }], inputs: [], code: TOY },
  ] } })
  const r = loadShadertoy(json)
  assert.ok('error' in r)
})

console.log(`\n${checks} controlli ok`)
