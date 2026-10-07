/**
 * HAP frame decoder — the pure part (no I/O, no mp4box, no network, no GPU).
 *
 * HAP (github.com/Vidvox/hap) stores DXT1/DXT5 blocks — already in the shape
 * the GPU wants — inside a QuickTime .mov, with Snappy as an optional second
 * compression pass. This file turns one already-read frame payload (the raw
 * bytes `hapContainer.ts` pulled from disk for one sample) into a raw DXT
 * block buffer ready for `compressedTexImage2D`. Nothing here touches the
 * container: `hapContainer.ts` is the only thing that knows about files,
 * mp4box or fetch.
 *
 * Supported: Hap1 (DXT1/BC1, no alpha) and Hap5 (DXT5/BC3, with alpha).
 *
 * Out of scope for this batch (see HAP_UNSUPPORTED_FOURCCS): HapY (scaled
 * YCoCg), HapM (dual chroma+alpha image), HapA (alpha only), Hap7 (BC7),
 * HapH (BC6 float). These get a clear error, never a black or corrupt frame.
 * ProRes is a separate codec entirely and has no GPU-friendly browser path —
 * not handled here at all.
 *
 * Spec values below are taken from documentation/HapVideoDRAFT.md at
 * github.com/Vidvox/hap — not re-derived from any other source.
 */
import { uncompress as snappyUncompress } from 'snappyjs'

export type HapFormat = 'dxt1' | 'dxt5'

/** Only the two fourccs this batch actually decodes. */
export const HAP_FOURCC_FORMAT: Record<string, HapFormat> = { Hap1: 'dxt1', Hap5: 'dxt5' }

/** Real HAP fourccs this batch does not decode — a clear error, not a guess. */
export const HAP_UNSUPPORTED_FOURCCS: Record<string, string> = {
  HapY: 'HapY (YCoCg scalato)',
  HapM: 'HapM (doppia immagine chroma+alpha)',
  HapA: 'HapA (solo alpha)',
  Hap7: 'Hap7 (BC7)',
  HapH: 'HapH (BC6 float)',
}

// Top-level section "type" byte (byte 3 of the section header).
const TYPE_DXT1_RAW = 0xab
const TYPE_DXT1_SNAPPY = 0xbb
const TYPE_DXT1_DECODE_INSTRUCTIONS = 0xcb
const TYPE_DXT5_RAW = 0xae
const TYPE_DXT5_SNAPPY = 0xbe
const TYPE_DXT5_DECODE_INSTRUCTIONS = 0xce
const TYPE_DECODE_INSTRUCTIONS_CONTAINER = 0x01
const SUBTYPE_COMPRESSOR_TABLE = 0x02
const SUBTYPE_CHUNK_SIZE_TABLE = 0x03
const SUBTYPE_CHUNK_OFFSET_TABLE = 0x04
const COMPRESSOR_NONE = 0x0a
const COMPRESSOR_SNAPPY = 0x0b

// Other type bytes from the HAP spec table: real HAP variants this batch
// doesn't decode (HapY/HapM/HapA/Hap7/HapH and their second-stage-compression
// siblings). Listed explicitly so hitting one is a clear error, not a guess.
const OUT_OF_SCOPE_TYPES = new Set([0xaf, 0xbf, 0xcf, 0xac, 0xbc, 0xcc, 0xa1, 0xb1, 0xc1, 0x0d])

function hex(n: number): string { return n.toString(16).padStart(2, '0') }

/** A frame WxH compresses into ceil(W/4)*ceil(H/4) blocks, 8 (DXT1) or 16 (DXT5) byte each. */
export function dxtBufferSize(format: HapFormat, width: number, height: number): number {
  const blocks = Math.ceil(width / 4) * Math.ceil(height / 4)
  return blocks * (format === 'dxt1' ? 8 : 16)
}

function uncompressSnappy(data: Uint8Array, maxLength: number): Uint8Array {
  return snappyUncompress(data, maxLength)
}

interface Section { type: number; payload: Uint8Array; end: number }

/**
 * One section header: short (4 byte: 24-bit LE size + type) or long (8 byte:
 * three zero bytes + type + 32-bit LE size) — a section uses the long form
 * exactly when the short form's 24-bit size field would be zero.
 */
function readSection(buf: Uint8Array, offset: number): Section {
  if (offset + 4 > buf.length) throw new Error('HAP: sezione header troncato')
  const b0 = buf[offset], b1 = buf[offset + 1], b2 = buf[offset + 2], b3 = buf[offset + 3]
  const size24 = b0 | (b1 << 8) | (b2 << 16)
  if (size24 === 0) {
    if (offset + 8 > buf.length) throw new Error('HAP: sezione header lungo troncato')
    const type = b3
    const size = buf[offset + 4] | (buf[offset + 5] << 8) | (buf[offset + 6] << 16) | (buf[offset + 7] * 0x1000000)
    const start = offset + 8
    if (start + size > buf.length) throw new Error('HAP: sezione (header lungo) oltre la fine del buffer')
    return { type, payload: buf.subarray(start, start + size), end: start + size }
  }
  const type = b3
  const start = offset + 4
  if (start + size24 > buf.length) throw new Error('HAP: sezione oltre la fine del buffer')
  return { type, payload: buf.subarray(start, start + size24), end: start + size24 }
}

function readUint32ArrayLE(buf: Uint8Array): number[] {
  if (buf.length % 4 !== 0) throw new Error('HAP: tabella con dimensione non multipla di 4 byte')
  const out = new Array(buf.length / 4)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  for (let i = 0; i < out.length; i++) out[i] = view.getUint32(i * 4, true)
  return out
}

/**
 * Decode Instructions (multi-chunk) payload: a Decode Instructions Container
 * (section type 0x01) with a Compressor Table + Size Table (+ optional Offset
 * Table) as sub-sections, followed by the chunks themselves back to back in
 * the Size Table's (compressed) sizes.
 */
function decodeInstructions(outerPayload: Uint8Array, format: HapFormat, expectedSize: number): Uint8Array {
  const container = readSection(outerPayload, 0)
  if (container.type !== TYPE_DECODE_INSTRUCTIONS_CONTAINER) {
    throw new Error(`HAP: Decode Instructions container atteso (0x01), trovato 0x${hex(container.type)}`)
  }
  let compressorTable: Uint8Array | null = null
  let sizeTable: number[] | null = null
  let offsetTable: number[] | null = null
  let off = 0
  while (off < container.payload.length) {
    const sub = readSection(container.payload, off)
    if (sub.type === SUBTYPE_COMPRESSOR_TABLE) compressorTable = sub.payload
    else if (sub.type === SUBTYPE_CHUNK_SIZE_TABLE) sizeTable = readUint32ArrayLE(sub.payload)
    else if (sub.type === SUBTYPE_CHUNK_OFFSET_TABLE) offsetTable = readUint32ArrayLE(sub.payload)
    off = sub.end
  }
  if (!compressorTable || !sizeTable) throw new Error('HAP: Decode Instructions incompleto (manca compressor table o size table)')
  const n = compressorTable.length
  if (sizeTable.length !== n) throw new Error('HAP: Decode Instructions, compressor table e size table di lunghezza diversa')
  if (offsetTable && offsetTable.length !== n) throw new Error('HAP: Decode Instructions, offset table di lunghezza diversa dalle altre')

  const out = new Uint8Array(expectedSize)
  let chunkCursor = container.end
  let writeCursor = 0
  for (let i = 0; i < n; i++) {
    const compSize = sizeTable[i]
    if (chunkCursor + compSize > outerPayload.length) throw new Error(`HAP: chunk ${i} oltre la fine del payload`)
    const chunkBytes = outerPayload.subarray(chunkCursor, chunkCursor + compSize)
    chunkCursor += compSize
    const compressor = compressorTable[i]
    let decoded: Uint8Array
    if (compressor === COMPRESSOR_NONE) decoded = chunkBytes
    else if (compressor === COMPRESSOR_SNAPPY) decoded = uncompressSnappy(chunkBytes, expectedSize)
    else throw new Error(`HAP: byte compressore sconosciuto 0x${hex(compressor)} nel chunk ${i}`)
    const dest = offsetTable ? offsetTable[i] : writeCursor
    if (dest + decoded.length > out.length) throw new Error(`HAP: chunk ${i} scrive oltre il buffer DXT atteso`)
    out.set(decoded, dest)
    writeCursor += decoded.length
  }
  return out
}

/**
 * Decodes one HAP frame (the bytes of a single sample) into a raw DXT1/DXT5
 * block buffer. `fourcc` must be 'Hap1' or 'Hap5' (resolve it from the
 * container first — see hapContainer.ts); width/height size the output.
 */
export function decodeHapFrame(frame: Uint8Array, fourcc: 'Hap1' | 'Hap5', width: number, height: number): Uint8Array {
  const format = HAP_FOURCC_FORMAT[fourcc]
  const expectedSize = dxtBufferSize(format, width, height)
  const top = readSection(frame, 0)
  const wantDxt1 = format === 'dxt1'
  const mismatch = () => new Error(`HAP: il type byte 0x${hex(top.type)} non combacia col fourcc dichiarato (${fourcc})`)

  let out: Uint8Array
  switch (top.type) {
    case TYPE_DXT1_RAW:
      if (!wantDxt1) throw mismatch()
      out = top.payload
      break
    case TYPE_DXT5_RAW:
      if (wantDxt1) throw mismatch()
      out = top.payload
      break
    case TYPE_DXT1_SNAPPY:
      if (!wantDxt1) throw mismatch()
      out = uncompressSnappy(top.payload, expectedSize)
      break
    case TYPE_DXT5_SNAPPY:
      if (wantDxt1) throw mismatch()
      out = uncompressSnappy(top.payload, expectedSize)
      break
    case TYPE_DXT1_DECODE_INSTRUCTIONS:
      if (!wantDxt1) throw mismatch()
      out = decodeInstructions(top.payload, format, expectedSize)
      break
    case TYPE_DXT5_DECODE_INSTRUCTIONS:
      if (wantDxt1) throw mismatch()
      out = decodeInstructions(top.payload, format, expectedSize)
      break
    default:
      if (OUT_OF_SCOPE_TYPES.has(top.type)) {
        throw new Error(`HAP: variante fuori scope (section type 0x${hex(top.type)}) — HapY/HapM/HapA/Hap7/HapH non sono decodificati in questo batch`)
      }
      throw new Error(`HAP: section type byte 0x${hex(top.type)} sconosciuto o frame corrotto`)
  }
  if (out.length !== expectedSize) {
    throw new Error(`HAP: buffer decodificato di ${out.length} byte, attesi ${expectedSize} per ${width}x${height} ${format}`)
  }
  return out
}
