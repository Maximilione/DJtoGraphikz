// pickInput / findExternal / restartPlan: la scheda esterna batte il microfono di sistema (src/shared/audioInput.ts)
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
await build({ entryPoints: ['src/shared/audioInput.ts'], bundle: true, format: 'esm', outfile: '/tmp/djg-ad.mjs', logLevel: 'error' })
const { pickInput, findExternal, isBuiltInLabel, isBluetoothLabel, restartPlan } = await import(pathToFileURL('/tmp/djg-ad.mjs').href)
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
assert.equal(pickInput([d('default', ''), d('z', '')]), 'default', 'etichette vuote: nessuna scheda "esterna" inventata')
assert.equal(findExternal(mac).deviceId, 'b2')
assert.equal(findExternal(solo), undefined, 'solo il microfono: nessun fallback esterno')
assert.equal(findExternal([d('q', '')]), undefined, 'senza permesso (label vuote) non si fida')
assert.equal(isBuiltInLabel('Default - MacBook Pro Microphone'), true)
assert.equal(isBuiltInLabel('Default - Behringer UMC202HD'), false, 'default che e\' una scheda esterna')
assert.equal(isBuiltInLabel('Microphone (Focusrite USB Audio)'), false)
assert.equal(restartPlan(0).delayMs, 1000)
assert.equal(restartPlan(3).delayMs, 8000)
assert.equal(restartPlan(9).delayMs, 30000, 'tetto 30 s')
const logs = [...Array(25).keys()].filter(n => restartPlan(n).log)
assert.deepEqual(logs, [0, 1, 10, 20], 'log non ripetitivo')
const defs = [...Array(30).keys()].filter(n => restartPlan(n).tryDefault)
assert.deepEqual(defs, [5], 'default provato una volta dopo 5 fallimenti')
// schede tipiche dei DJ: tutte ESTERNE, mai scambiate per il microfono di sistema
for (const l of ['Scarlett 2i2 USB', 'Focusrite USB Audio', 'UMC202HD 192k', 'Behringer UMC204HD (1397:0508)', 'Traktor Audio 2 MK2', 'Native Instruments Traktor Audio 10', 'DJM-900NXS2', 'Pioneer DJM-V10', 'XDJ-RX3', 'Allen & Heath Xone:96', 'ZOOM H6 Audio', 'USB Audio CODEC', 'Soundcraft Ui24', 'Mackie Onyx', 'Default - Focusrite USB Audio'])
  assert.equal(isBuiltInLabel(l), false, l + ' deve essere esterna')
for (const l of ['Microphone (Realtek(R) Audio)', 'Microphone Array (Intel Smart Sound)', 'MacBook Air Microphone', 'Microfono integrato'])
  assert.equal(isBuiltInLabel(l), true, l + ' deve essere di sistema')
// Windows: la scheda Realtek elencata col suo id non e' una scheda esterna
const winReal = [d('default', 'Default - Microphone (Realtek(R) Audio)'), d('r1', 'Microphone (Realtek(R) Audio)'), d('f1', 'Line (Focusrite USB Audio)')]
assert.equal(pickInput(winReal), 'f1', 'windows: Realtek non e\' esterna')
// Bluetooth: non scelto al posto di una scheda USB, non scambiato per integrato
const bt = [d('default', 'Default - MacBook Pro Microphone'), d('a1', 'MacBook Pro Microphone'), d('bt', 'AirPods Pro di Max'), d('u', 'USB Audio CODEC')]
assert.equal(pickInput(bt), 'u', 'AirPods non battono la scheda USB')
assert.equal(findExternal(bt).deviceId, 'u')
assert.equal(pickInput(bt, 'bt'), 'bt', 'la scelta esplicita delle cuffie resta (non e\' "integrato")')
assert.equal(isBuiltInLabel('AirPods Pro'), false)
assert.equal(isBluetoothLabel('AirPods Pro'), true)
const onlyBt = [d('default', 'Default - MacBook Pro Microphone'), d('bt', 'AirPods Pro')]
assert.equal(findExternal(onlyBt), undefined, 'solo cuffie: nessuno switch dal microfono')
assert.equal(pickInput(onlyBt), 'default')
console.log('controlli ok')
