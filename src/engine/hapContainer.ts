/**
 * HAP container glue: the only file that touches mp4box, fetch and byte
 * ranges. `hap.ts` decodes an already-read frame; this demuxes just enough
 * of a QuickTime/.mov to know whether its video track is HAP and, if so,
 * fetches one frame's raw bytes at a time off disk (over djg-media, which
 * already serves Range requests — that's how plain <video> seeking works
 * today).
 *
 * mp4box reads the moov box progressively (stops as soon as it's parsed —
 * a few hundred KB for a normal fast-start export) and that alone gives the
 * full sample table (offset/size/cts per frame): it comes entirely from the
 * stbl boxes (stsz/stco/stts), which are codec-agnostic. The frame bytes
 * themselves are fetched on demand, one Range request per frame, never all
 * held in memory at once — a multi-GB clip stays cheap.
 *
 * ponytail: width/height for an unrecognized fourcc (which Hap1/Hap5 are, as
 * far as mp4box is concerned — it falls back to a generic SampleEntry with
 * no VisualSampleEntry fields parsed) are read by hand from the sample
 * entry's fixed byte layout, the same for every codec — see the comment at
 * the fetch below.
 */
import { createFile } from 'mp4box'
import { decodeHapFrame, HAP_FOURCC_FORMAT, HAP_UNSUPPORTED_FOURCCS, type HapFormat } from './hap'

const PROBE_CHUNK = 1 << 20 // 1MB progressive reads while hunting for moov

function mediaUrl(path: string): string { return `djg-media://f/?p=${encodeURIComponent(path)}` }

async function fetchRange(path: string, start: number, endInclusive: number): Promise<Uint8Array> {
  const res = await fetch(mediaUrl(path), { headers: { Range: `bytes=${start}-${endInclusive}` } })
  if (!res.ok) throw new Error(`HAP: lettura file fallita (HTTP ${res.status}): ${path}`)
  return new Uint8Array(await res.arrayBuffer())
}

async function fileSize(path: string): Promise<number> {
  const res = await fetch(mediaUrl(path), { headers: { Range: 'bytes=0-0' } })
  const contentRange = res.headers.get('content-range') // "bytes 0-0/12345"
  const total = contentRange ? Number(contentRange.split('/')[1]) : Number(res.headers.get('content-length'))
  if (!total) throw new Error(`HAP: impossibile leggere la dimensione del file: ${path}`)
  return total
}

interface HapSample { offset: number; size: number; cts: number }

export interface HapTrack {
  fourcc: 'Hap1' | 'Hap5'
  format: HapFormat
  width: number
  height: number
  durationSec: number
  /** Decoded DXT1/DXT5 block buffer for the sample nearest-below `timeSec`. */
  frameAt(timeSec: number): Promise<Uint8Array>
}

/** Rightmost sample whose cts is <= target — frames are all-intra, so any one is a valid seek target. */
function sampleIndexAt(samples: HapSample[], cts: number): number {
  let lo = 0, hi = samples.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (samples[mid].cts <= cts) lo = mid; else hi = mid - 1
  }
  return lo
}

/**
 * Opens `path` as a QuickTime container and inspects its first video track.
 * - Not HAP at all (or moov never found within the file) → null: caller falls
 *   back to the plain <video> path.
 * - A real HAP fourcc this batch doesn't decode (HapY/HapM/HapA/Hap7/HapH) →
 *   throws, with the exact codec name: a <video> fallback would also fail,
 *   just silently, which is the whole bug this batch fixes.
 */
export async function probeHapTrack(path: string): Promise<HapTrack | null> {
  const size = await fileSize(path)
  const mp4box = createFile() as ReturnType<typeof createFile> & { moov?: any }
  let ready = false
  mp4box.onReady = () => { ready = true }

  let pos = 0
  while (!ready && pos < size) {
    const end = Math.min(pos + PROBE_CHUNK, size) - 1
    const bytes = await fetchRange(path, pos, end)
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer & { fileStart: number }
    ab.fileStart = pos
    mp4box.appendBuffer(ab as Parameters<typeof mp4box.appendBuffer>[0])
    pos = end + 1
  }
  if (!ready) return null // no moov in the whole file — let <video> try and fail on its own

  const trak = mp4box.moov?.traks?.find((t: any) => t.mdia?.hdlr?.handler === 'vide')
  if (!trak) return null
  const entry = trak.mdia.minf.stbl.stsd.entries[0]
  const fourcc: string = entry.type

  if (!(fourcc in HAP_FOURCC_FORMAT)) {
    if (fourcc in HAP_UNSUPPORTED_FOURCCS) {
      throw new Error(`HAP: ${HAP_UNSUPPORTED_FOURCCS[fourcc]} non è decodificato in questo batch — converti la clip in Hap1/Hap5 o in H.264.`)
    }
    return null // some other codec entirely — plain <video> path
  }
  const format = HAP_FOURCC_FORMAT[fourcc]

  // mp4box only parses width/height for codecs it recognizes as a
  // VisualSampleEntry subclass; Hap1/Hap5 fall back to a generic SampleEntry
  // with none of that. The fixed layout is the same for every codec though:
  // 8 bytes of SampleEntry header (reserved + data_reference_index), then
  // VisualSampleEntry's pre_defined/reserved/pre_defined (16 bytes), then
  // width (uint16 BE) and height (uint16 BE) — 24 and 26 bytes into the box.
  const headerStart = entry.start + entry.hdr_size
  const headerBytes = await fetchRange(path, headerStart, headerStart + 27)
  const view = new DataView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength)
  const width = view.getUint16(24, false)
  const height = view.getUint16(26, false)
  if (!width || !height) throw new Error(`HAP: impossibile leggere larghezza/altezza della clip: ${path}`)

  const timescale: number = trak.mdia.mdhd.timescale
  const samples: HapSample[] = trak.samples.map((s: any) => ({ offset: s.offset, size: s.size, cts: s.cts }))
  if (samples.length === 0) throw new Error(`HAP: nessun campione nella track video: ${path}`)
  const durationSec = trak.mdia.mdhd.duration / timescale

  return {
    fourcc: fourcc as 'Hap1' | 'Hap5',
    format, width, height, durationSec,
    async frameAt(timeSec: number) {
      const cts = Math.max(0, timeSec) * timescale
      const s = samples[sampleIndexAt(samples, cts)]
      const raw = await fetchRange(path, s.offset, s.offset + s.size - 1)
      return decodeHapFrame(raw, fourcc as 'Hap1' | 'Hap5', width, height)
    },
  }
}

/**
 * Lifecycle wrapper around probeHapTrack, mirroring SequencePlayer's
 * ready()/show() shape so Engine.ts's deck-video tick reads the same way for
 * both. `ready()` resolves with `isHap` false for a file that isn't HAP at
 * all (caller falls back to <video>); it rejects for a HAP fourcc this batch
 * can't decode, or an unreadable file — a real error, not a silent fallback.
 */
export class HapPlayer {
  width = 0
  height = 0
  format: HapFormat | null = null
  durationSec = 0
  /** Latest decoded DXT buffer, and the clip time it was decoded for. */
  buffer: Uint8Array | null = null
  bufferTime = -1
  /** 'pending' while the probe is in flight; the caller shows nothing meanwhile, same as a sequence's first frame. */
  status: 'pending' | 'hap' | 'not-hap' | 'error' = 'pending'
  private track: HapTrack | null = null
  private pending = false
  private lastRequested = -1
  private dead = false

  constructor(readonly path: string) {}

  async ready(): Promise<void> {
    try {
      this.track = await probeHapTrack(this.path)
      if (this.track) { this.width = this.track.width; this.height = this.track.height; this.format = this.track.format; this.durationSec = this.track.durationSec }
      if (!this.dead) this.status = this.track ? 'hap' : 'not-hap'
    } catch (err) {
      if (!this.dead) this.status = 'error'
      throw err
    }
  }

  /** Per frame: request the frame for this clip time. Drops overlapping requests instead of queuing — a slow fetch skips frames, it never backs up. */
  show(timeSec: number) {
    if (this.dead || !this.track || this.pending || timeSec === this.lastRequested) return
    this.lastRequested = timeSec
    this.pending = true
    this.track.frameAt(timeSec).then(buf => {
      this.pending = false
      if (!this.dead) { this.buffer = buf; this.bufferTime = timeSec }
    }).catch(err => {
      this.pending = false
      console.error('[HAP] frame illeggibile:', this.path, err)
    })
  }

  dispose() { this.dead = true }
}
