/**
 * Pro DJ Link: the bytes, and nothing else.
 *
 * Pioneer never published this protocol. Everything below comes from the
 * reverse engineering of Deep Symmetry's *dysentery* analysis and its Java
 * implementation *Beat Link* (https://djl-analysis.deepsymmetry.org/), which
 * this file cites by section. Offsets are hexadecimal, exactly as in those
 * documents, so a reader can check them side by side.
 *
 * This module is pure — `Buffer` in, plain objects out, no sockets, no
 * Electron — so `scripts/check-prodjlink.mjs` can feed it packets as hex.
 *
 * Three UDP ports, all on the booth LAN:
 *   50000  device announcements (keep-alive), broadcast every ~1.5 s
 *   50001  beat packets, broadcast by every playing deck on each beat
 *   50002  status packets, sent **unicast** to every device that announced
 *          itself on 50000 — hence we must announce to learn who is master
 */

/** Every packet opens with these ten bytes: "Qspt1WmJOL". */
export const MAGIC = Buffer.from([0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c])

export const PORT_ANNOUNCE = 50000
export const PORT_BEAT = 50001
export const PORT_STATUS = 50002

/** Packet type byte at 0x0a. */
const TYPE_KEEP_ALIVE = 0x06
const TYPE_CDJ_STATUS = 0x0a
const TYPE_BEAT = 0x28

/** Pitch is a 20.12-ish fixed point: 0x100000 means +0 %. (Beat Link `Util.pitchToMultiplier`) */
const PITCH_UNITY = 0x100000

export interface LinkBeat {
  device: number
  name: string
  /** Track BPM × pitch — the tempo you actually hear. */
  bpm: number
  /** BPM written in the track's grid, unpitched. */
  trackBpm: number
  /** Pitch fader, in percent: +3.125 means 3.125 % faster. */
  pitch: number
  /** 1..4 inside the bar. */
  beatInBar: number
  /** Milliseconds until the next beat, as the deck predicts it. */
  nextBeatMs: number
}

export interface LinkDevice {
  device: number
  name: string
  ip: string
}

export interface LinkStatus {
  device: number
  name: string
  playing: boolean
  master: boolean
  onAir: boolean
  /** rekordbox id of the loaded track, 0 when none. The title needs the dbserver (TCP), not done. */
  trackId: number
  beatInBar: number
}

function hasMagic(b: Buffer): boolean {
  return b.length > 0x0a && b.subarray(0, MAGIC.length).equals(MAGIC)
}

/** 20-byte device name, NUL padded. Cut at the first control byte, like Beat Link's `trim()`. */
function readName(b: Buffer, off: number): string {
  const raw = b.toString('latin1', off, off + 20)
  const cut = raw.search(/[\x00-\x1f]/)
  return (cut >= 0 ? raw.slice(0, cut) : raw).trim()
}

/**
 * Beat packet, 96 (0x60) bytes, port 50001. dysentery "Beat packets";
 * Beat Link `Beat`: bpm at 0x5a (2 bytes, ×100), beat-within-bar at 0x5c,
 * pitch at 0x55 (3 bytes — read as 4 from 0x54, the top byte is zero),
 * nextBeat at 0x24, device number at 0x21 (and again at 0x5f).
 */
export function parseBeat(b: Buffer): LinkBeat | null {
  if (!hasMagic(b) || b[0x0a] !== TYPE_BEAT || b.length < 0x60) return null
  const raw = b.readUInt16BE(0x5a)
  if (raw === 0 || raw === 0xffff) return null          // no beat grid
  const beatInBar = b[0x5c]
  if (beatInBar < 1 || beatInBar > 4) return null
  const mult = b.readUInt32BE(0x54) / PITCH_UNITY
  const trackBpm = raw / 100
  return {
    device: b[0x21],
    name: readName(b, 0x0b),
    bpm: trackBpm * mult,
    trackBpm,
    pitch: (mult - 1) * 100,
    beatInBar,
    nextBeatMs: b.readUInt32BE(0x24),
  }
}

/**
 * Keep-alive, 54 (0x36) bytes, port 50000. dysentery "Device keep-alive";
 * Beat Link `DeviceAnnouncement`: name at 0x0c (note: one byte later than in
 * beat/status packets), device number at 0x24, MAC at 0x26, IP at 0x2c.
 */
export function parseKeepAlive(b: Buffer): LinkDevice | null {
  if (!hasMagic(b) || b[0x0a] !== TYPE_KEEP_ALIVE || b.length < 0x36) return null
  return {
    device: b[0x24],
    name: readName(b, 0x0c),
    ip: `${b[0x2c]}.${b[0x2d]}.${b[0x2e]}.${b[0x2f]}`,
  }
}

/**
 * CDJ status, port 50002, 0xd4 bytes on a CDJ-2000 and longer on newer decks.
 * Beat Link `CdjStatus`: flags at 0x89 (0x40 playing, 0x20 tempo master,
 * 0x10 synced, 0x08 on air), rekordbox id at 0x2c, beat-within-bar at 0xa6.
 * Mixers send type 0x0a too but far shorter: the length check skips them.
 */
export function parseStatus(b: Buffer): LinkStatus | null {
  if (!hasMagic(b) || b[0x0a] !== TYPE_CDJ_STATUS || b.length < 0xa7) return null
  const flags = b[0x89]
  return {
    device: b[0x21],
    name: readName(b, 0x0b),
    playing: (flags & 0x40) !== 0,
    master: (flags & 0x20) !== 0,
    onAir: (flags & 0x08) !== 0,
    trackId: b.readUInt32BE(0x2c),
    beatInBar: b[0xa6],
  }
}

/**
 * Our own keep-alive, so the decks unicast us their status. Layout as parsed
 * above plus the constants Beat Link's `VirtualCdj` sends: 0x20 = 0x01,
 * 0x21 = 0x02, length 0x0036 at 0x22, device type 0x01 (player) at 0x25 and
 * 0x34, 0x01 at 0x30.
 */
export function buildKeepAlive(opts: { device: number; name: string; mac: number[]; ip: number[] }): Buffer {
  const b = Buffer.alloc(0x36)
  MAGIC.copy(b, 0)
  b[0x0a] = TYPE_KEEP_ALIVE
  b.write(opts.name.slice(0, 20), 0x0c, 20, 'latin1')
  b[0x20] = 0x01
  b[0x21] = 0x02
  b.writeUInt16BE(0x36, 0x22)
  b[0x24] = opts.device
  b[0x25] = 0x01
  Buffer.from(opts.mac).copy(b, 0x26, 0, 6)
  Buffer.from(opts.ip).copy(b, 0x2c, 0, 4)
  b[0x30] = 0x01
  b[0x34] = 0x01
  return b
}
