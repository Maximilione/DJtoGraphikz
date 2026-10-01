#!/usr/bin/env node
/**
 * Pro DJ Link is reverse engineered and we have no CDJ on the desk: the one
 * thing that can be checked without hardware is that the parser reads the
 * documented offsets and that the clock turns a beat stream into tempo and
 * phase. Fixtures are built from the layout in src/main/prodjlink-packets.ts
 * (dysentery / Beat Link), not from captures — a real deck is the last test.
 *
 *     node scripts/check-prodjlink.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))

async function load(entry, platform) {
  const out = await build({ entryPoints: [join(REPO, entry)], bundle: true, format: 'esm', write: false, platform })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}
const { parseBeat, parseKeepAlive, parseStatus, buildKeepAlive, MAGIC } = await load('src/main/prodjlink-packets.ts', 'node')
const { ProDjLinkClock } = await load('src/engine/audio/ProDjLinkClock.ts', 'neutral')

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('  ok', name) }

// ---- fixtures ----

const hex = s => Buffer.from(s.replace(/\s+/g, ''), 'hex')
const name20 = s => Buffer.from(s.padEnd(20, '\0'), 'latin1').toString('hex')

/** Beat packet, 0x60 bytes: CDJ-2000nexus #2, 128.00 BPM, pitch +0 %, beat 3 of the bar. */
function beatPacket({ device = 2, bpm100 = 12800, pitch = 0x100000, beat = 3, name = 'CDJ-2000nexus' } = {}) {
  const u32 = n => n.toString(16).padStart(8, '0')
  const u16 = n => n.toString(16).padStart(4, '0')
  return hex(
    MAGIC.toString('hex') + '28' + name20(name)          // 0x00 magic, 0x0a type, 0x0b name
    + '01 00' + device.toString(16).padStart(2, '0')      // 0x1f, 0x20, 0x21 device
    + '003c'                                              // 0x22 length of the rest
    + u32(469) + u32(937) + u32(937) + u32(1875) + u32(2812) + u32(3750)   // 0x24.. next beat / 2nd / bar / 4th / 2nd bar / 8th
    + 'ff'.repeat(24)                                     // 0x3c padding
    + u32(pitch)                                          // 0x54 pitch
    + '0000' + u16(bpm100)                                // 0x58 reserved, 0x5a bpm ×100
    + beat.toString(16).padStart(2, '0') + '0000'         // 0x5c beat in bar, 0x5d
    + device.toString(16).padStart(2, '0'),               // 0x5f device again
  )
}

/** Keep-alive, 0x36 bytes, as a CDJ #1 at 192.168.1.11 sends it. */
const KEEP_ALIVE = hex(
  MAGIC.toString('hex') + '06 00' + name20('CDJ-2000nexus')
  + '01 02 0036' + '01' + '01' + '00e036d1a2b3' + 'c0a8010b' + '01 00 00 00 01 00',
)

/** CDJ status, 0xd4 bytes, from deck #1: playing, master, on air, track id 0x1234. */
function statusPacket({ device = 1, flags = 0x40 | 0x20 | 0x08, beat = 2 } = {}) {
  const b = Buffer.alloc(0xd4)
  MAGIC.copy(b, 0)
  b[0x0a] = 0x0a
  b.write('CDJ-2000nexus', 0x0b, 'latin1')
  b[0x1f] = 0x01; b[0x20] = 0x03; b[0x21] = device
  b.writeUInt16BE(0xd4 - 0x24, 0x22)
  b.writeUInt32BE(0x1234, 0x2c)
  b[0x89] = flags
  b.writeUInt16BE(12800, 0x92)
  b[0xa6] = beat
  return b
}

// ---- parser ----

check('il beat packet legge BPM, battito, pitch e lettore agli offset di Beat Link', () => {
  const p = beatPacket()
  assert.equal(p.length, 0x60, 'fixture lunga sbagliata')
  const b = parseBeat(p)
  assert.ok(b, 'non riconosciuto')
  assert.equal(b.device, 2)
  assert.equal(b.name, 'CDJ-2000nexus')
  assert.equal(b.trackBpm, 128)
  assert.equal(b.bpm, 128)
  assert.equal(b.pitch, 0)
  assert.equal(b.beatInBar, 3)
  assert.equal(b.nextBeatMs, 469)
})

check('il pitch moltiplica il BPM: +3.125 % su 128 fa 132', () => {
  const b = parseBeat(beatPacket({ pitch: 0x108000 }))
  assert.ok(Math.abs(b.pitch - 3.125) < 1e-9, `pitch=${b.pitch}`)
  assert.ok(Math.abs(b.bpm - 132) < 1e-9, `bpm=${b.bpm}`)
  const slow = parseBeat(beatPacket({ pitch: 0x0f0000 }))
  assert.ok(Math.abs(slow.bpm - 120) < 1e-9, `-6.25 % -> ${slow.bpm}`)
})

check('pacchetti che non sono beat vengono scartati senza eccezioni', () => {
  assert.equal(parseBeat(Buffer.alloc(0)), null)
  assert.equal(parseBeat(beatPacket().subarray(0, 0x50)), null, 'troncato')
  const wrongMagic = beatPacket(); wrongMagic[0] = 0x00
  assert.equal(parseBeat(wrongMagic), null, 'magic sbagliato')
  assert.equal(parseBeat(KEEP_ALIVE), null, 'un keep-alive non e\' un beat')
  assert.equal(parseBeat(beatPacket({ bpm100: 0xffff })), null, 'senza griglia')
  assert.equal(parseBeat(beatPacket({ beat: 0 })), null, 'battito fuori 1..4')
})

check('il keep-alive di un CDJ da numero, nome e IP', () => {
  assert.equal(KEEP_ALIVE.length, 0x36)
  const d = parseKeepAlive(KEEP_ALIVE)
  assert.deepEqual(d, { device: 1, name: 'CDJ-2000nexus', ip: '192.168.1.11' })
  assert.equal(parseKeepAlive(beatPacket()), null)
})

check('il nostro keep-alive e\' lungo 54 byte e si rilegge come lettore virtuale', () => {
  const pkt = buildKeepAlive({ device: 7, name: 'DJtoGraphikz', mac: [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff], ip: [192, 168, 1, 50] })
  assert.equal(pkt.length, 0x36)
  assert.equal(pkt[0x0a], 0x06)
  assert.equal(pkt.readUInt16BE(0x22), 0x36)
  assert.equal(pkt[0x24], 7, 'numero device a 0x24')
  assert.equal(pkt.subarray(0x26, 0x2c).toString('hex'), 'aabbccddeeff', 'MAC a 0x26')
  assert.deepEqual(parseKeepAlive(pkt), { device: 7, name: 'DJtoGraphikz', ip: '192.168.1.50' })
  const long = buildKeepAlive({ device: 8, name: 'x'.repeat(40), mac: [0, 0, 0, 0, 0, 0], ip: [10, 0, 0, 1] })
  assert.equal(long.length, 0x36, 'un nome lungo non sfonda il pacchetto')
  assert.equal(long[0x20], 0x01, 'il nome e\' troncato a 20 byte')
})

check('lo stato di un CDJ dice chi e\' master e cosa suona', () => {
  const s = parseStatus(statusPacket())
  assert.ok(s)
  assert.equal(s.device, 1)
  assert.equal(s.master, true)
  assert.equal(s.playing, true)
  assert.equal(s.onAir, true)
  assert.equal(s.trackId, 0x1234)
  assert.equal(s.beatInBar, 2)
  const slave = parseStatus(statusPacket({ device: 2, flags: 0x40 }))
  assert.equal(slave.master, false)
  assert.equal(parseStatus(statusPacket().subarray(0, 0x38)), null, 'uno stato da mixer (corto) non e\' un CDJ')
  assert.equal(parseStatus(beatPacket()), null)
})

// ---- clock ----

const msg = (device, beatInBar, extra = {}) => ({ device, name: `CDJ #${device}`, bpm: 128, pitch: 0, beatInBar, ...extra })

/** Feed `beats` beats from `device` at `bpm`, starting at t0, one per beat period. Returns the end time. */
function play(clock, device, bpm, beats, t0 = 1000, startBeat = 1, extra = {}) {
  const period = 60000 / bpm
  let t = t0
  for (let i = 0; i < beats; i++) {
    clock.onBeat({ ...msg(device, ((startBeat - 1 + i) % 4) + 1, extra), bpm }, t)
    if (i < beats - 1) t += period
  }
  return t
}

check('un lettore a 128 BPM legge 128 BPM', () => {
  const c = new ProDjLinkClock()
  const t = play(c, 1, 128, 4)
  const s = c.read(t)
  assert.equal(s.running, true)
  assert.equal(s.bpm, 128)
  assert.equal(c.seen, true)
})

check('la fase sta a 0 sul battito e a mezzo a meta battito', () => {
  const c = new ProDjLinkClock()
  const t = play(c, 1, 120, 2)
  assert.ok(c.read(t).beatPhase < 0.01, `sul battito = ${c.read(t).beatPhase}`)
  assert.ok(Math.abs(c.read(t + 250).beatPhase - 0.5) < 0.01, `a meta = ${c.read(t + 250).beatPhase}`)
  assert.ok(c.read(t + 600).beatPhase < 1, 'un pacchetto in ritardo non fa scattare la fase oltre il battito')
})

check('il battito nella battuta viene dal lettore, non contato da noi', () => {
  const c = new ProDjLinkClock()
  c.onBeat(msg(1, 3), 1000)
  assert.ok(Math.abs(c.read(1000).barPhase - 0.5) < 0.01, `barPhase = ${c.read(1000).barPhase}`)
  c.onBeat(msg(1, 1), 1000 + 60000 / 128)
  assert.ok(c.read(1000 + 60000 / 128).barPhase < 0.01, 'il downbeat riporta a zero')
})

check('il battito viene segnalato una volta sola', () => {
  const c = new ProDjLinkClock()
  const t = play(c, 1, 128, 1)
  assert.equal(c.read(t).beatDetected, true)
  assert.equal(c.read(t).beatDetected, true, 'leggere non deve consumare')
  c.clearBeat()
  assert.equal(c.read(t + 1).beatDetected, false, 'segnalato due volte')
})

check('senza master il primo lettore sentito tiene il tempo, il secondo non lo scalza', () => {
  const c = new ProDjLinkClock()
  let t = play(c, 1, 128, 2)
  c.onBeat({ ...msg(2, 1), bpm: 140 }, t + 100)
  assert.equal(c.read(t + 100).bpm, 128, 'il secondo deck ha preso il tempo')
  assert.equal(c.sourceLabel, 'CDJ #1 #1')
  // the first deck stops: after the silence window the other one takes over
  t += 3000
  c.onBeat({ ...msg(2, 1), bpm: 140 }, t)
  assert.equal(c.read(t).bpm, 140, 'nessun passaggio al deck rimasto')
})

check('il lettore master vince subito su quello seguito', () => {
  const c = new ProDjLinkClock()
  const t = play(c, 1, 128, 2)
  c.onBeat({ ...msg(2, 1, { master: true }), bpm: 140 }, t + 50)
  assert.equal(c.read(t + 50).bpm, 140)
  assert.equal(c.sourceLabel, 'CDJ #2 #2 (master)')
  // and a non-master deck beating afterwards is ignored
  c.onBeat({ ...msg(1, 2, { master: false }), bpm: 128 }, t + 80)
  assert.equal(c.read(t + 80).bpm, 140)
})

check('un lettore che tace non resta "in corso" per sempre, ma tiene il tempo', () => {
  const c = new ProDjLinkClock()
  const t = play(c, 1, 128, 2)
  assert.equal(c.read(t).running, true)
  const dead = c.read(t + 4000)
  assert.equal(dead.running, false)
  assert.equal(dead.bpm, 128, 'il tempo dell\'ultimo beat serve al pannello')
  assert.equal(dead.beatDetected, false)
})

check('un tempo assurdo (scratch, deck fermato a mano) non entra', () => {
  const c = new ProDjLinkClock()
  const t = play(c, 1, 128, 2)
  c.onBeat({ ...msg(1, 3), bpm: 4 }, t + 100)
  assert.equal(c.read(t + 100).bpm, 128)
  c.onBeat({ ...msg(1, 3), bpm: 0 }, t + 100)
  assert.equal(c.read(t + 100).bpm, 128)
})

check('i lettori annunciati compaiono nell\'elenco; reset dimentica tutto', () => {
  const c = new ProDjLinkClock()
  c.setDevices([{ device: 1, name: 'CDJ-3000' }, { device: 2, name: 'CDJ-3000' }])
  assert.equal(c.devices.size, 2)
  const t = play(c, 1, 128, 2)
  assert.equal(c.read(t).running, true)
  c.reset()
  assert.equal(c.seen, false)
  assert.equal(c.devices.size, 0)
  assert.equal(c.read(t).running, false)
  assert.equal(c.sourceLabel, '')
})

console.log(`\n${checks} controlli passati`)
