#!/usr/bin/env node
/**
 * OBS / browser output feed (I2): what leaves main over SSE must come back in
 * the browser as the very same IPC arguments — the spectrum included, byte for
 * byte, or the projector in OBS shows a frozen analyser — and the token must
 * be read exactly where the page and its scripts can put it.
 *
 *     node scripts/check-obs.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({ entryPoints: [join(REPO, 'src/shared/obsWire.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const { encodeEvent, decodeEvent, tokenFromRequest } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

/** what a browser's EventSource makes of a frame */
function parseFrame(frame) {
  assert.ok(frame.endsWith('\n\n'), 'frame ends with a blank line')
  const lines = frame.slice(0, -2).split('\n')
  const event = lines.find(l => l.startsWith('event: ')).slice(7)
  const data = lines.filter(l => l.startsWith('data: ')).map(l => l.slice(6)).join('\n')
  assert.equal(lines.length, 2, 'one event line, one data line — no stray newlines in the payload')
  return { event, data }
}

console.log('check-obs')

check('audio: 2048 spectrum bytes round-trip, numbers untouched', () => {
  const spectrum = new Uint8Array(512 * 4).map((_, i) => (i * 37) & 255)
  const audio = { bass: 0.42, mid: 0.1, high: 0.9, energy: 0.5, beatPulse: 1, bpm: 136.5, beatDetected: true, beatClock: 1234.5, spectrum }
  const frame = encodeEvent('audio:data', [audio])
  const { event, data } = parseFrame(frame)
  assert.equal(event, 'audio:data')
  const [back] = decodeEvent(data)
  assert.ok(back.spectrum instanceof Uint8Array, 'spectrum is a Uint8Array again, so Engine.setAudioData accepts it')
  assert.deepEqual([...back.spectrum], [...spectrum])
  assert.deepEqual({ ...back, spectrum: undefined }, { ...audio, spectrum: undefined })
  assert.ok(frame.length < 4096, `a frame stays small at 30/s (${frame.length} B)`)
})

check('state: a snapshot with nested objects and strings with newlines survives', () => {
  const state = { effect: 'tunnel', effectParams: { a: 1, b: [1, 2, 3] }, customShader: 'void main() {\n  gl_FragColor = vec4(1.0);\n}', keystone: null }
  const { event, data } = parseFrame(encodeEvent('engine:state-update', [state]))
  assert.equal(event, 'engine:state-update')
  assert.deepEqual(decodeEvent(data), [state])
})

check('multi-arg channels keep their arity (overlay:update id, updates / resolution w, h)', () => {
  assert.deepEqual(decodeEvent(parseFrame(encodeEvent('overlay:update', ['ov_1', { opacity: 0.5 }])).data), ['ov_1', { opacity: 0.5 }])
  assert.deepEqual(decodeEvent(parseFrame(encodeEvent('output:set-resolution', [1920, 1080])).data), [1920, 1080])
})

check('a channel name cannot break the framing', () => {
  assert.throws(() => encodeEvent('x\ndata: evil', []))
})

check('garbage data decodes to no args, not to a throw in the render loop listener', () => {
  assert.deepEqual(decodeEvent('{"not":"an array"}'), [])
})

check('token: query string wins, cookie is the fallback for /assets, nothing else counts', () => {
  assert.equal(tokenFromRequest('/output?token=abc123'), 'abc123')
  assert.equal(tokenFromRequest('/events?feed=x&token=abc123', 'djg-out=zzz'), 'abc123')
  assert.equal(tokenFromRequest('/assets/output-x.js', 'other=1; djg-out=abc123; more=2'), 'abc123')
  assert.equal(tokenFromRequest('/assets/output-x.js', 'notdjg-out=abc123'), '')
  assert.equal(tokenFromRequest('/assets/output-x.js'), '')
  assert.equal(tokenFromRequest('/output?token='), '')
})

console.log(`check-obs: ${checks} controlli ok`)
