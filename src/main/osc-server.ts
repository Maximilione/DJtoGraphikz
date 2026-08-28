import { app, type BrowserWindow } from 'electron'
import { createSocket, type Socket } from 'dgram'
import { getRemoteDefs, getLastEngineState } from './remote-server'

// OSC input: TouchOSC (or any OSC controller) on the LAN drives the engine.
// Zero deps — Node dgram + a minimal OSC 1.0 parser. Commands ride the same
// 'remote:cmd' channel as the phone remote, so App.tsx needs no changes.
//
// ponytail: plain OSC over UDP has no auth — same LAN-trust model as ArtNet.
// Fine for a gig; there is nothing to implement on top of the protocol.

const BASE_PORT = 9700
const THROTTLE_MS = 33 // faders flood 100+/s — per-address throttle, latest wins

type OscArg = number | string

// ---- minimal OSC 1.0 parser ----

// Null-terminated ASCII string padded to a 4-byte boundary. Returns [value, nextOffset].
function readOscString(buf: Buffer, off: number): [string, number] | null {
  if (off >= buf.length) return null
  const end = buf.indexOf(0, off)
  if (end === -1) return null
  return [buf.toString('ascii', off, end), (end + 4) & ~3]
}

function parseMessage(buf: Buffer): { addr: string; args: OscArg[] } | null {
  const a = readOscString(buf, 0)
  if (!a || !a[0].startsWith('/')) return null
  const addr = a[0]
  const t = readOscString(buf, a[1])
  if (!t || !t[0].startsWith(',')) return { addr, args: [] } // tagless (legacy senders)
  let off = t[1]
  const args: OscArg[] = []
  for (const tag of t[0].slice(1)) {
    if (tag === 'f') {
      if (off + 4 > buf.length) return null
      args.push(buf.readFloatBE(off)); off += 4
    } else if (tag === 'i') {
      if (off + 4 > buf.length) return null
      args.push(buf.readInt32BE(off)); off += 4
    } else if (tag === 's') {
      const s = readOscString(buf, off)
      if (!s) return null
      args.push(s[0]); off = s[1]
    } else if (tag === 'T') { args.push(1) }
    else if (tag === 'F') { args.push(0) }
    else return null // unknown tag — can't skip its payload safely, drop
  }
  return { addr, args }
}

// #bundle unpacking is trivial (timetag ignored — we act immediately)
function unpackPackets(buf: Buffer, out: Buffer[], depth = 0): void {
  if (depth > 4) return
  if (buf.length >= 16 && buf.toString('ascii', 0, 8) === '#bundle\0') {
    let off = 16 // 8 name + 8 timetag
    while (off + 4 <= buf.length) {
      const size = buf.readInt32BE(off); off += 4
      if (size <= 0 || off + size > buf.length) return
      unpackPackets(buf.subarray(off, off + size), out, depth + 1)
      off += size
    }
  } else {
    out.push(buf)
  }
}

// ---- address → remote:cmd mapping ----

// remote-server caches the catalogs/state the renderer pushes — reuse them
function effectIdByIndex(n: number): string | null {
  const defs = getRemoteDefs() as { effects?: { id?: unknown }[] } | null
  const id = defs?.effects?.[n - 1]?.id
  return typeof id === 'string' ? id : null
}

function paramDefByKey(key: string): { min: number; max: number } | null {
  const st = getLastEngineState() as { paramDefs?: { key?: unknown; min?: unknown; max?: unknown }[] } | null
  const d = st?.paramDefs?.find(p => p.key === key)
  return d && typeof d.min === 'number' && typeof d.max === 'number'
    ? { min: d.min, max: d.max }
    : null
}

// Grade sliders arrive 0..1 — scale to each key's engine range
const GRADE_SCALE: Record<string, (v: number) => number> = {
  exposure: v => v * 2,       // 0..2
  contrast: v => v * 2,       // 0..2
  saturation: v => v * 2,     // 0..2
  lift: v => v - 0.5,         // -0.5..0.5
  vignette: v => v,           // 0..1
}

function toCmd(addr: string, args: OscArg[]): Record<string, unknown> | null {
  const f = typeof args[0] === 'number' ? args[0] : null
  const s = typeof args[0] === 'string' ? args[0] : null
  const on = f !== null && f > 0.5 // TouchOSC buttons send 1/0 floats

  switch (addr) {
    case '/djg/brightness': return f === null ? null : { type: 'brightness', value: f }
    case '/djg/crossfade': return f === null ? null : { type: 'crossfade', value: f }
    case '/djg/motionblur': return f === null ? null : { type: 'motionBlur', value: f }
    case '/djg/blackout': return f === null ? null : { type: 'blackout', value: on }
    case '/djg/freeze': return f === null ? null : { type: 'freeze', value: on }
    case '/djg/autovj': return f === null ? null : { type: 'autovj', value: on }
    case '/djg/tap': return { type: 'tap' }
    case '/djg/effect': return s === null ? null : { type: 'effect', value: s }
    case '/djg/post': return s === null ? null : { type: 'post', value: s }
  }

  let m = addr.match(/^\/djg\/effect\/([1-9]\d*)$/)
  if (m) {
    if (!on) return null // momentary: act on press, ignore release
    const id = effectIdByIndex(parseInt(m[1], 10))
    return id === null ? null : { type: 'effect', value: id }
  }

  m = addr.match(/^\/djg\/look\/([1-9]\d*)$/)
  if (m) return on ? { type: 'look', value: parseInt(m[1], 10) - 1 } : null

  m = addr.match(/^\/djg\/grade\/(exposure|contrast|saturation|lift|vignette)$/)
  if (m) return f === null ? null : { type: 'grade', value: { key: m[1], value: GRADE_SCALE[m[1]](f) } }

  m = addr.match(/^\/djg\/param\/([\w-]+)$/)
  if (m) {
    if (f === null) return null
    const d = paramDefByKey(m[1])
    // engine expects the def's min..max — OSC sends 0..1; drop if def unknown
    return d === null ? null : { type: 'param', value: { key: m[1], value: d.min + f * (d.max - d.min) } }
  }

  return null
}

// ---- server ----

export function setupOscServer(controlWindow: BrowserWindow): void {
  // Per-address throttle: send at most every THROTTLE_MS, trailing flush
  // keeps the final fader value (release position must never be dropped)
  const lastSent = new Map<string, number>()
  const trailing = new Map<string, { cmd: unknown }>()

  const emit = (cmd: unknown) => {
    if (!controlWindow.isDestroyed()) controlWindow.webContents.send('remote:cmd', { ...(cmd as Record<string, unknown>), source: 'osc' })
  }

  const send = (addr: string, cmd: unknown) => {
    const pending = trailing.get(addr)
    if (pending) { pending.cmd = cmd; return } // flush already scheduled — latest wins
    const now = Date.now()
    const wait = THROTTLE_MS - (now - (lastSent.get(addr) ?? 0))
    if (wait <= 0) {
      lastSent.set(addr, now)
      emit(cmd)
    } else {
      const entry = { cmd }
      trailing.set(addr, entry)
      setTimeout(() => {
        trailing.delete(addr)
        lastSent.set(addr, Date.now())
        emit(entry.cmd)
      }, wait)
    }
  }

  const onMessage = (msg: Buffer) => {
    const packets: Buffer[] = []
    unpackPackets(msg, packets)
    for (const b of packets) {
      try {
        const parsed = parseMessage(b)
        if (!parsed) continue // malformed → drop silently
        const cmd = toCmd(parsed.addr, parsed.args)
        if (cmd) send(parsed.addr, cmd)
      } catch { /* malformed → drop silently */ }
    }
  }

  let socket: Socket | null = null

  // Port may be taken — walk forward like remote-server does. dgram sockets
  // aren't reusable after a bind error, so each attempt gets a fresh one.
  const tryBind = (p: number) => {
    const s = createSocket('udp4')
    s.on('message', onMessage)
    s.once('error', (err: NodeJS.ErrnoException) => {
      try { s.close() } catch { /* already closed */ }
      if (err.code === 'EADDRINUSE' && p < BASE_PORT + 10) tryBind(p + 1)
      else console.error('[OSC] server failed:', err.message)
    })
    s.bind(p, '0.0.0.0', () => {
      socket = s
      console.log(`[OSC] listening on :${p} (UDP, unauthenticated — LAN trust, same as ArtNet)`)
    })
  }
  tryBind(BASE_PORT)

  app.on('before-quit', () => {
    try { socket?.close() } catch { /* already closed */ }
    socket = null
  })
}
