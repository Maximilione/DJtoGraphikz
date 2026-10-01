import { ipcMain } from 'electron'
import { createSocket, type Socket } from 'dgram'
import { SACN_PORT, sacnMulticast, sacnPacket } from './sacn'

// ArtNet output: plain UDP on :6454, no native addon needed. The renderer
// builds the channel values (audio-reactive) and sends them over IPC at
// ~30Hz; here we just wrap them in ArtDMX packets.

const ARTNET_PORT = 6454
const HEADER = Buffer.from('Art-Net\0', 'ascii')
const OP_DMX = 0x5000
const PROT_VER = 14

let socket: Socket | null = null
let sequence = 1

function ensureSocket(): Socket {
  if (socket) return socket
  socket = createSocket('udp4')
  socket.bind(() => socket!.setBroadcast(true))
  socket.on('error', e => console.error('[ArtNet] socket error:', e.message))
  return socket
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
  Buffer.from(data.subarray(0, len)).copy(buf, 18)
  return buf
}

let sacnSeq = 0

export function setupArtnet() {
  // Pixel map (I6): several universes a frame, ArtNet or sACN.
  // {host, protocol, frames: [{universe, values}]}
  ipcMain.on('pixelmap:frame', (_e, msg: { host?: string; protocol?: 'artnet' | 'sacn'; frames?: { universe: number; values: number[] }[] }) => {
    const frames = msg?.frames
    if (!Array.isArray(frames) || frames.length === 0) return
    const sock = ensureSocket()
    const host = typeof msg.host === 'string' && msg.host.trim() ? msg.host.trim() : ''
    sacnSeq = (sacnSeq + 1) & 255
    for (const f of frames) {
      if (!Array.isArray(f?.values) || !f.values.length) continue
      const data = Uint8Array.from(f.values.map(v => Math.max(0, Math.min(255, v | 0))))
      try {
        if (msg.protocol === 'artnet') sock.send(artDmxPacket(f.universe, data), ARTNET_PORT, host || '255.255.255.255')
        else sock.send(sacnPacket(f.universe, data, sacnSeq), SACN_PORT, host || sacnMulticast(f.universe))
      } catch (e: any) {
        console.error('[PixelMap] send failed:', e.message)
      }
    }
  })

  // {host, universe, values: number[]} — values already 0..255, ch 1 = index 0
  ipcMain.on('dmx:frame', (_e, msg: { host?: string; universe?: number; values?: number[] }) => {
    const values = msg?.values
    if (!Array.isArray(values) || values.length === 0) return
    const host = typeof msg.host === 'string' && msg.host.trim() ? msg.host.trim() : '255.255.255.255'
    const pkt = artDmxPacket(msg.universe ?? 0, Uint8Array.from(values.map(v => Math.max(0, Math.min(255, v | 0)))))
    try {
      ensureSocket().send(pkt, ARTNET_PORT, host)
    } catch (e: any) {
      console.error('[ArtNet] send failed:', e.message)
    }
  })
}
