import { ipcMain } from 'electron'
import { createSocket, type Socket } from 'dgram'
import { isIP } from 'net'
import { lookup } from 'dns'
import { SACN_PORT, sacnMulticast, sacnPacket } from './sacn'

// ArtNet output: plain UDP on :6454, no native addon needed. The renderer
// builds the channel values (audio-reactive) and sends them over IPC at
// ~30Hz; here we just wrap them in ArtDMX packets.

const ARTNET_PORT = 6454
const HEADER = Buffer.from('Art-Net\0', 'ascii')
const OP_DMX = 0x5000
const OP_POLL = 0x2000
const PROT_VER = 14

let socket: Socket | null = null
let sequence = 1

function ensureSocket(): Socket {
  if (socket) return socket
  const s = socket = createSocket('udp4')
  s.on('error', (e: NodeJS.ErrnoException) => {
    console.error('[ArtNet] socket error:', e.message)
    // A failed bind leaves a socket that can never send: close it, the next
    // frame makes a new one. Send errors are not that — a UDP send failing
    // says nothing about the socket, and recreating it per error would thrash.
    if (e.syscall === 'bind') { try { s.close() } catch { /* already closed */ } }
  })
  // Closed by anyone (the bind above, an interface gone after sleep): forget
  // it, so the next frame at 30 Hz recreates it instead of every send failing
  // until the app is restarted, with the lights and the LED wall dark.
  s.on('close', () => { if (socket === s) socket = null })
  s.bind(() => s.setBroadcast(true))
  return s
}

/**
 * The host field is free text: with a name ('nodo.local') every sock.send
 * ran getaddrinfo in the libuv threadpool — hundreds of lookups a second at
 * 30-60fps × N universes, jitter included. Resolve once, refresh every 30s;
 * until the first answer the frame is skipped. A literal IP passes through.
 */
const resolved = new Map<string, { ip: string; at: number }>()
const RESOLVE_TTL_MS = 30_000
function hostIp(h: string): string | null {
  if (!h || isIP(h)) return h
  const r = resolved.get(h)
  const now = Date.now()
  if (!r || now - r.at > RESOLVE_TTL_MS) {
    if (r) r.at = now   // one refresh in flight, not one per frame
    lookup(h, { family: 4 }, (err, ip) => { if (!err && ip) resolved.set(h, { ip, at: Date.now() }) })
  }
  return r?.ip ?? null
}

/** values from IPC: a Uint8Array (pixel map) or a number[] (DMX panel), both to bytes */
function toBytes(values: Uint8Array | number[]): Uint8Array {
  return values instanceof Uint8Array ? values : Uint8Array.from(values, v => Math.max(0, Math.min(255, v | 0)))
}

/** ArtDMX packet: header + opcode + protver + seq + physical + universe + length + data */
function artDmxPacket(universe: number, data: Uint8Array): Buffer {
  const len = Math.min(512, Math.max(2, data.length + (data.length % 2))) // even, 2..512
  const buf = Buffer.alloc(18 + len)
  HEADER.copy(buf, 0)
  buf.writeUInt16LE(OP_DMX, 8)
  buf.writeUInt16BE(PROT_VER, 10)
  buf.writeUInt8(sequence, 12)
  sequence = sequence % 255 + 1
  buf.writeUInt8(0, 13)                      // physical
  buf.writeUInt16LE(universe & 0x7fff, 14)   // SubUni + Net
  buf.writeUInt16BE(len, 16)
  buf.set(data.subarray(0, Math.min(len, data.length)), 18)
  return buf
}

/** ArtPoll: a legal packet that moves no channel, for the soundcheck probe */
function artPollPacket(): Buffer {
  const buf = Buffer.alloc(14)
  HEADER.copy(buf, 0)
  buf.writeUInt16LE(OP_POLL, 8)
  buf.writeUInt16BE(PROT_VER, 10)
  return buf
}

let sacnSeq = 0

export function setupArtnet() {
  // Pixel map (I6): several universes a frame, ArtNet or sACN.
  // {host, protocol, frames: [{universe, values}]}
  ipcMain.on('pixelmap:frame', (_e, msg: { host?: string; protocol?: 'artnet' | 'sacn'; frames?: { universe: number; values: number[] | Uint8Array }[] }) => {
    const frames = msg?.frames
    if (!Array.isArray(frames) || frames.length === 0) return
    const sock = ensureSocket()
    const host = hostIp(typeof msg.host === 'string' && msg.host.trim() ? msg.host.trim() : '')
    if (host === null) return   // name not resolved yet: this frame is skipped
    sacnSeq = (sacnSeq + 1) & 255
    for (const f of frames) {
      const v = f?.values
      if (!(v instanceof Uint8Array || Array.isArray(v)) || !v.length) continue
      const data = toBytes(v)
      try {
        if (msg.protocol === 'artnet') sock.send(artDmxPacket(f.universe, data), ARTNET_PORT, host || '255.255.255.255')
        else sock.send(sacnPacket(f.universe, data, sacnSeq), SACN_PORT, host || sacnMulticast(f.universe))
      } catch (e: any) {
        console.error('[PixelMap] send failed:', e.message)
      }
    }
  })

  // {host, universe, values: number[]} — values already 0..255, ch 1 = index 0
  ipcMain.on('dmx:frame', (_e, msg: { host?: string; universe?: number; values?: number[] | Uint8Array }) => {
    const values = msg?.values
    if (!(values instanceof Uint8Array || Array.isArray(values)) || values.length === 0) return
    const host = hostIp(typeof msg.host === 'string' && msg.host.trim() ? msg.host.trim() : '255.255.255.255')
    if (host === null) return
    const pkt = artDmxPacket(msg.universe ?? 0, toBytes(values))
    try {
      ensureSocket().send(pkt, ARTNET_PORT, host)
    } catch (e: any) {
      console.error('[ArtNet] send failed:', e.message)
    }
  })

  // Soundcheck (P3): does a packet leave on the same socket the frames use?
  // ArtPoll instead of ArtDMX so the probe never blinks a fixture.
  ipcMain.handle('dmx:probe', (_e, host?: string) => new Promise<{ ok: boolean; error?: string }>(resolve => {
    const name = typeof host === 'string' && host.trim() ? host.trim() : '255.255.255.255'
    // one-off: by name if not cached yet (one lookup, and it warms the cache)
    const to = hostIp(name) ?? name
    try {
      ensureSocket().send(artPollPacket(), ARTNET_PORT, to, err => resolve(err ? { ok: false, error: err.message } : { ok: true }))
    } catch (e: any) {
      resolve({ ok: false, error: e.message })
    }
  }))
}
