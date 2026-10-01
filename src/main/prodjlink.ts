import { app, ipcMain, type BrowserWindow } from 'electron'
import { createSocket, type Socket } from 'dgram'
import { networkInterfaces } from 'os'
import {
  PORT_ANNOUNCE, PORT_BEAT, PORT_STATUS,
  buildKeepAlive, parseBeat, parseKeepAlive, parseStatus,
} from './prodjlink-packets'

// Pro DJ Link input: the tempo the CDJs agree on, straight off the booth
// switch. Off by default — the renderer turns it on with 'prolink:enable'
// when the user picks the mode, and nothing listens on the network before.
//
// We pose as a virtual player so the decks unicast us their status (that is
// where "who is master" lives); beats themselves are broadcast. Protocol
// notes and offsets: ./prodjlink-packets.ts.
//
// ponytail: no dbserver (TCP) session, so no track title — the id is there in
// the status packet, the name is not. Add Beat Link's dbserver dance if a
// title on the projector ever earns it.

/**
 * Real players take 1–4 (up to 6 on CDJ-3000 setups). Like Beat Link's
 * virtual CDJ we start above that and step up if someone announces the same
 * number: this app must never knock a real deck off the network.
 */
const FIRST_DEVICE = 7
const LAST_DEVICE = 15
const KEEP_ALIVE_MS = 1500
/** A deck that has not announced for this long is gone (Beat Link: 10 s). */
const DEVICE_TIMEOUT_MS = 10000
const OUR_NAME = 'DJtoGraphikz'

interface Iface { address: string; netmask: string; mac: string }

let sockets: Socket[] = []
let timer: ReturnType<typeof setInterval> | null = null
let deviceNumber = FIRST_DEVICE
let iface: Iface | null = null
const devices = new Map<number, { name: string; ip: string; seen: number }>()
const masters = new Map<number, boolean>()
/** rekordbox id loaded on each deck, from its last status (0 = empty). */
const tracks = new Map<number, number>()
/** last beat heard from each deck — the stand-in for "master" when no deck claims it. */
const beatAt = new Map<number, number>()
let followed = 0
let sentTrackId = 0
/** Like the renderer's clock (ProDjLinkClock): the master if any, else the first deck heard beating, kept until it falls silent. */
const BEAT_SILENCE_MS = 2500

const ipNum = (ip: string) => ip.split('.').reduce((n, o) => ((n << 8) | +o) >>> 0, 0)
const ipBytes = (ip: string) => ip.split('.').map(Number)
const sameSubnet = (a: Iface, ip: string) =>
  ((ipNum(a.address) & ipNum(a.netmask)) >>> 0) === ((ipNum(ip) & ipNum(a.netmask)) >>> 0)

/** The LAN interface: the one the decks are on once we have heard one, else the first real one. */
function pickInterface(peerIp?: string): Iface | null {
  const all = Object.values(networkInterfaces()).flat()
    .filter((i): i is NonNullable<typeof i> => !!i && i.family === 'IPv4' && !i.internal && i.mac !== '00:00:00:00:00:00')
  return (peerIp && all.find(i => sameSubnet(i, peerIp))) || all[0] || null
}

function broadcastOf(i: Iface): string {
  const n = (ipNum(i.address) | ~ipNum(i.netmask)) >>> 0
  return `${n >>> 24}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`
}

function followedDevice(now: number): number {
  for (const [n, m] of masters) if (m) return n
  if (followed && now - (beatAt.get(followed) ?? 0) < BEAT_SILENCE_MS) return followed
  let best = 0, bestAt = 0
  for (const [n, t] of beatAt) if (t > bestAt) { best = n; bestAt = t }
  return best
}

export function setupProDjLink(controlWindow: BrowserWindow): void {
  ipcMain.on('prolink:enable', (_e, on: boolean) => { if (on) start(controlWindow); else stop() })
  app.on('before-quit', stop)
}

function start(win: BrowserWindow): void {
  if (sockets.length) return
  const send = (channel: string, payload: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
  const deviceList = () => [...devices].map(([device, d]) => ({ device, name: d.name }))
  // 'prolink:track' once per new track on the followed deck: a status packet
  // comes several times a second, the renderer only wants the change.
  const checkTrack = () => {
    followed = followedDevice(Date.now())
    const trackId = tracks.get(followed) ?? 0
    if (!trackId || trackId === sentTrackId) return
    sentTrackId = trackId
    console.log(`[ProDJLink] nuova traccia sul lettore #${followed}: rekordbox id ${trackId}`)
    send('prolink:track', { device: followed, trackId, master: masters.get(followed) === true })
  }

  const announce = bind(PORT_ANNOUNCE, (msg, from) => {
    const d = parseKeepAlive(msg)
    if (!d) return
    if (!iface || !sameSubnet(iface, from)) iface = pickInterface(from) ?? iface
    if (d.device === deviceNumber && iface && d.ip !== iface.address) {
      // Someone real holds our number: step aside, never argue.
      if (deviceNumber < LAST_DEVICE) deviceNumber++
      console.log(`[ProDJLink] il numero ${d.device} e' di "${d.name}": divento il lettore virtuale #${deviceNumber}`)
    }
    const known = devices.get(d.device)
    devices.set(d.device, { name: d.name, ip: d.ip, seen: Date.now() })
    if (!known) {
      console.log(`[ProDJLink] lettore in rete: "${d.name}" #${d.device} (${d.ip})`)
      send('prolink:devices', deviceList())
    }
  })
  const beats = bind(PORT_BEAT, msg => {
    const b = parseBeat(msg)
    if (!b) return
    send('prolink:beat', { ...b, master: masters.get(b.device) })
    beatAt.set(b.device, Date.now())
    checkTrack()
  })
  const status = bind(PORT_STATUS, msg => {
    const s = parseStatus(msg)
    if (!s) return
    masters.set(s.device, s.master)
    tracks.set(s.device, s.trackId)
    checkTrack()
  })
  sockets = [announce, beats, status]
  iface = pickInterface()

  timer = setInterval(() => {
    // Keep-alive: without it the decks never send us status, and without
    // status we cannot tell which deck is master.
    if (iface && announce) {
      const pkt = buildKeepAlive({
        device: deviceNumber, name: OUR_NAME,
        mac: iface.mac.split(':').map(h => parseInt(h, 16)), ip: ipBytes(iface.address),
      })
      announce.send(pkt, PORT_ANNOUNCE, broadcastOf(iface), () => { /* best effort */ })
    }
    const cutoff = Date.now() - DEVICE_TIMEOUT_MS
    let changed = false
    for (const [n, d] of devices) {
      if (d.seen < cutoff) { devices.delete(n); masters.delete(n); tracks.delete(n); beatAt.delete(n); changed = true; console.log(`[ProDJLink] lettore sparito: "${d.name}" #${n}`) }
    }
    if (changed) send('prolink:devices', deviceList())
  }, KEEP_ALIVE_MS)

  console.log(`[ProDJLink] avviato: ascolto UDP ${PORT_ANNOUNCE}/${PORT_BEAT}/${PORT_STATUS}, mi annuncio come "${OUR_NAME}" #${deviceNumber}`
    + (iface ? ` da ${iface.address}` : ' (nessuna interfaccia di rete: solo ascolto)'))
}

function stop(): void {
  if (!sockets.length) return
  if (timer) clearInterval(timer)
  timer = null
  for (const s of sockets) { try { s.close() } catch { /* already closed */ } }
  sockets = []
  devices.clear()
  masters.clear()
  tracks.clear()
  beatAt.clear()
  followed = 0
  sentTrackId = 0
  console.log('[ProDJLink] fermato: nessun ascolto UDP')
}

function bind(port: number, onMessage: (msg: Buffer, from: string) => void): Socket {
  // reuseAddr: rekordbox or a second tool on the same machine may hold these
  // ports too; broadcast traffic reaches every binder.
  const s = createSocket({ type: 'udp4', reuseAddr: true })
  s.on('message', (msg, rinfo) => { try { onMessage(msg, rinfo.address) } catch { /* malformed: drop */ } })
  s.on('error', err => console.error(`[ProDJLink] porta ${port}: ${err.message}`))
  s.bind(port, '0.0.0.0', () => { try { s.setBroadcast(true) } catch { /* not fatal: we still hear */ } })
  return s
}
