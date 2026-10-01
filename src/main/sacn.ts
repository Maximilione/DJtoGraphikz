/**
 * sACN (ANSI E1.31) data packet, one universe of up to 512 channels. Pure:
 * no socket here, so the check can look at the bytes.
 *
 * ArtNet on broadcast floods the booth's network past a handful of
 * universes; sACN multicasts one group per universe (239.255.hi.lo:5568)
 * and a LED processor subscribes only to what it maps.
 */
const ACN_ID = Buffer.from([0x41, 0x53, 0x43, 0x2d, 0x45, 0x31, 0x2e, 0x31, 0x37, 0x00, 0x00, 0x00])
// one CID per app install would be nicer; one per app is what the spec needs (unique per source)
export const CID = Buffer.from('d1c6903cd39c41119f16a762b0052740', 'hex')
const SOURCE_NAME = 'DJtoGraphikz'
export const SACN_PORT = 5568

export function sacnMulticast(universe: number): string {
  return `239.255.${(universe >> 8) & 255}.${universe & 255}`
}

export function sacnPacket(universe: number, data: Uint8Array, sequence: number, priority = 100): Buffer {
  const slots = Math.min(512, data.length)
  const propCount = slots + 1                      // start code + slots
  const total = 126 + slots
  const buf = Buffer.alloc(total)
  // root layer
  buf.writeUInt16BE(0x0010, 0)                      // preamble size
  buf.writeUInt16BE(0x0000, 2)                      // post-amble size
  ACN_ID.copy(buf, 4)
  buf.writeUInt16BE(0x7000 | (total - 16), 16)      // flags + length
  buf.writeUInt32BE(0x00000004, 18)                 // VECTOR_ROOT_E131_DATA
  CID.copy(buf, 22)
  // framing layer
  buf.writeUInt16BE(0x7000 | (total - 38), 38)
  buf.writeUInt32BE(0x00000002, 40)                 // VECTOR_E131_DATA_PACKET
  buf.write(SOURCE_NAME, 44, 64, 'utf8')
  buf.writeUInt8(priority, 108)
  buf.writeUInt16BE(0, 109)                         // sync address
  buf.writeUInt8(sequence & 255, 111)
  buf.writeUInt8(0, 112)                            // options
  buf.writeUInt16BE(universe & 0xffff, 113)
  // DMP layer
  buf.writeUInt16BE(0x7000 | (total - 115), 115)
  buf.writeUInt8(0x02, 117)                         // VECTOR_DMP_SET_PROPERTY
  buf.writeUInt8(0xa1, 118)                         // address type & data type
  buf.writeUInt16BE(0x0000, 119)                    // first property address
  buf.writeUInt16BE(0x0001, 121)                    // address increment
  buf.writeUInt16BE(propCount, 123)
  buf.writeUInt8(0x00, 125)                         // DMX start code
  Buffer.from(data.subarray(0, slots)).copy(buf, 126)
  return buf
}
