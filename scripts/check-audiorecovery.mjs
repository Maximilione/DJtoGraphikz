// AudioAnalyzer recovery with stubbed browser APIs: Stop is final, no concurrent-start leaks,
// permission denied is not retried, devicechange does not storm (src/engine/audio/AudioAnalyzer.ts)
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
await build({ entryPoints: ['src/engine/audio/AudioAnalyzer.ts'], bundle: true, format: 'esm', outfile: '/tmp/djg-aa.mjs', logLevel: 'error',
  alias: { 'realtime-bpm-analyzer': new URL('./stub-bpm.mjs', import.meta.url).pathname } })
const realST = globalThis.setTimeout
const tick = (ms = 0) => new Promise(r => realST(r, ms))
let ctxs = [], streams = [], gum = [], devices = [], gumImpl
const listeners = {}
const timers = []   // fake restart timers: run on demand
const mkNode = () => ({ connect() {}, disconnect() {}, gain: {} })
class AC {
  constructor() { this.state = 'running'; this.sampleRate = 48000; ctxs.push(this) }
  resume() { return Promise.resolve() }
  close() { this.state = 'closed'; return Promise.resolve() }
  createAnalyser() { return { ...mkNode(), frequencyBinCount: 1024, fftSize: 2048 } }
  createGain() { return mkNode() }
  createMediaStreamSource() { return mkNode() }
}
globalThis.AudioContext = AC
globalThis.window = globalThis
globalThis.window.setTimeout = fn => { timers.push(fn); return timers.length }
const mkStream = label => {
  const t = { label, readyState: 'live', stopped: false, stop() { this.stopped = true } }
  const s = { getAudioTracks: () => [t], getTracks: () => [t], t }
  streams.push(s); return s
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
  addEventListener: (n, f) => { (listeners[n] ??= []).push(f) },
  removeEventListener() {},
  enumerateDevices: async () => devices,
  getUserMedia: c => { gum.push(c); return gumImpl(c) },
} } })
const { AudioAnalyzer } = await import(pathToFileURL('/tmp/djg-aa.mjs').href)
const reset = () => { listeners.devicechange = []; ctxs = []; streams = []; gum = []; timers.length = 0; devices = []; gumImpl = async () => mkStream('USB Audio CODEC') }
const err = name => Object.assign(new Error(name), { name })
const open = () => ctxs.filter(c => c.state !== 'closed').length
const live = () => streams.filter(s => !s.t.stopped).length
const devchange = async () => { for (const f of listeners.devicechange ?? []) await f(); await tick() }

// 1. two overlapping starts: one graph, one live stream, old context closed
reset(); let a = new AudioAnalyzer(); let release
gumImpl = () => new Promise(r => { release = () => r(mkStream('A')) })
const p1 = a.start('x'); await tick()
const first = release
gumImpl = async () => mkStream('B')
await a.start('y'); first(); await p1; await tick()
assert.equal(open(), 1, 'overlapping starts: one open context')
assert.equal(live(), 1, 'overlapping starts: one live stream')
assert.equal(a.currentLabel, 'B')

// 2. Stop while a start is in flight: stays stopped, nothing leaks
reset(); a = new AudioAnalyzer(); let rel2
gumImpl = () => new Promise(r => { rel2 = () => r(mkStream('A')) })
const p3 = a.start('x'); await tick(); a.stop(); rel2(); await p3; await tick()
assert.equal(a.isRunning, false); assert.equal(open(), 0); assert.equal(live(), 0)

// 3. permission denied: error to the caller, no fallback to the default, no leaked context, no timer
reset(); a = new AudioAnalyzer(); gumImpl = async () => { throw err('NotAllowedError') }
await assert.rejects(a.start('x'), { name: 'NotAllowedError' })
assert.equal(gum.length, 1, 'no fallback to the default on a denied permission')
assert.equal(open(), 0, 'failed start closes its context'); assert.equal(timers.length, 0)

// 4. stale id falls back to the default (not a permission problem)
reset(); a = new AudioAnalyzer(); let n = 0
gumImpl = async () => { if (n++ === 0) throw err('OverconstrainedError'); return mkStream('Default') }
await a.start('gone'); assert.equal(a.isRunning, true); assert.equal(a.currentDeviceId, undefined)

// 5. track ended -> restart scheduled; denial during recovery gives up for good
reset(); a = new AudioAnalyzer(); await a.start('x')
streams[0].t.onended(); assert.equal(timers.length, 1); assert.equal(a.getStatus(), 'reconnecting')
gumImpl = async () => { throw err('NotAllowedError') }
await timers.shift()(); await tick()
assert.equal(timers.length, 0, 'denied: no retry'); assert.ok(a.lastError.startsWith('NotAllowedError'))

// 6. a failing recovery backs off and retries, but not once the user pressed Stop
reset(); a = new AudioAnalyzer(); await a.start('x'); gumImpl = async () => { throw err('NotReadableError') }
streams[0].t.onended(); await timers.shift()(); await tick()
assert.equal(timers.length, 1, 'retry scheduled'); assert.equal(open(), 0, 'failed attempts leave no context')
a.stop(); assert.equal(a.getStatus(), 'stopped'); timers.length = 0
a.scheduleRestart('t'); assert.equal(timers.length, 0, 'user stopped: no restart')

// 7. Stop while the restart lists the cards: nothing is opened
reset(); a = new AudioAnalyzer(); await a.start(undefined); const g0 = gum.length
a.scheduleRestart('t'); const run = timers.shift(); a.stop(); await run(); await tick()
assert.equal(gum.length, g0, 'restart after Stop must not open the input')

// 8. devicechange: ignored after Stop; room mic -> card once; on the card nothing; enumerate throwing is harmless
reset(); a = new AudioAnalyzer(); devices = [{ kind: 'audioinput', deviceId: 'u', label: 'Focusrite USB Audio' }]
gumImpl = async () => mkStream('MacBook Pro Microphone'); await a.start(undefined)
a.stop(); const g1 = gum.length; await devchange(); assert.equal(gum.length, g1, 'stopped: devicechange ignored')
await a.start(undefined); const g2 = gum.length; gumImpl = async () => mkStream('Focusrite USB Audio')
await devchange(); assert.equal(gum.length, g2 + 1); assert.equal(a.currentLabel, 'Focusrite USB Audio')
await devchange(); assert.equal(gum.length, g2 + 1, 'on the card: no restart storm')
assert.equal(open(), 1); assert.equal(live(), 1)
navigator.mediaDevices.enumerateDevices = async () => { throw err('x') }
await devchange()
// bluetooth headset is not "the room mic": no forced switch away from it
reset(); a = new AudioAnalyzer(); devices = [{ kind: 'audioinput', deviceId: 'u', label: 'Focusrite USB Audio' }]
navigator.mediaDevices.enumerateDevices = async () => devices
gumImpl = async () => mkStream('AirPods Pro'); await a.start(undefined); const g3 = gum.length
await devchange(); assert.equal(gum.length, g3, 'headset: no forced switch')
console.log('audio recovery ok')
