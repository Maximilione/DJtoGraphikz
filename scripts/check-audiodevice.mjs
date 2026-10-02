// pickInput: la scheda esterna batte il microfono di sistema (audioDevices.ts)
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
await build({ entryPoints: ['src/renderer/audioDevices.ts'], bundle: true, format: 'esm', outfile: '/tmp/djg-ad.mjs', logLevel: 'error' })
const { pickInput } = await import(pathToFileURL('/tmp/djg-ad.mjs').href)
const d = (deviceId, label) => ({ deviceId, label, kind: 'audioinput' })
const mac = [d('default', 'Default - MacBook Pro Microphone'), d('a1', 'MacBook Pro Microphone'), d('b2', 'Behringer UMC202HD (1397:0507)')]
const win = [d('default', 'Predefinito - Microphone (Realtek)'), d('communications', 'Communications - Microphone (Realtek)'), d('c3', 'Microphone (Focusrite USB Audio)')]
const solo = [d('default', 'Default - MacBook Pro Microphone'), d('a1', 'MacBook Pro Microphone')]
const mic = [d('default', 'Default'), d('x', 'Microfono di MacBook Pro'), d('y', 'USB Audio CODEC')]
assert.equal(pickInput(mac), 'b2', 'mac: scheda esterna, non il default')
assert.equal(pickInput(mac, 'a1'), 'b2', 'mac: il microfono salvato cede alla scheda')
assert.equal(pickInput(mac, 'default'), 'b2')
assert.equal(pickInput(mac, 'b2'), 'b2', 'la scheda salvata resta')
assert.equal(pickInput(mac, 'sparito'), 'b2', 'id salvato che non c\'e\' piu\'')
assert.equal(pickInput(win), 'c3', 'windows: Focusrite, non Realtek')
assert.equal(pickInput(solo), 'default', 'solo il microfono: va bene')
assert.equal(pickInput(solo, 'a1'), 'a1', 'senza schede la scelta salvata resta')
assert.equal(pickInput(mic), 'y', 'microfono di MacBook (it): non scelto')
assert.equal(pickInput([]), '')
console.log('10 controlli ok')
