/**
 * Pixel mapping (I6): the frame, sampled at the panel's resolution, cut into
 * DMX universes. Pure, so the check can count channels without a GPU.
 *
 * A universe holds 512 channels, 170 RGB pixels (510 channels); pixel 171
 * starts the next universe, never split across two.
 */
export interface PixelMapConfig {
  enabled: boolean
  protocol: 'artnet' | 'sacn'
  cols: number
  rows: number
  /** first universe; the rest follow */
  universe: number
  /** '' = broadcast (ArtNet) / multicast (sACN) */
  host: string
  fps: number
  /** every other row runs right to left, the way most strips are wired */
  snake: boolean
}

export const PIXEL_MAP_DEFAULTS: PixelMapConfig = {
  enabled: false, protocol: 'sacn', cols: 32, rows: 8, universe: 1, host: '', fps: 30, snake: false,
}

export const PIXELS_PER_UNIVERSE = 170

export function sanitizePixelMap(raw: unknown): PixelMapConfig {
  const r = (raw ?? {}) as Partial<PixelMapConfig>
  const int = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d
  const protocol = r.protocol === 'artnet' ? 'artnet' : 'sacn'
  const cols = int(r.cols, 1, 1024, PIXEL_MAP_DEFAULTS.cols)
  const rows = int(r.rows, 1, 1024, PIXEL_MAP_DEFAULTS.rows)
  // ArtNet addresses 15 bits (Net+SubUni): universe 40000 would silently go
  // out as 7232. The whole panel must fit below the protocol's last universe.
  const maxU = protocol === 'artnet' ? 32767 : 63999
  return {
    enabled: !!r.enabled,
    protocol,
    cols,
    rows,
    universe: Math.min(int(r.universe, 0, maxU, PIXEL_MAP_DEFAULTS.universe), Math.max(0, maxU - universesFor(cols, rows) + 1)),
    host: typeof r.host === 'string' ? r.host.trim() : '',
    fps: int(r.fps, 1, 60, PIXEL_MAP_DEFAULTS.fps),
    snake: !!r.snake,
  }
}

export function universesFor(cols: number, rows: number): number {
  return Math.ceil((cols * rows) / PIXELS_PER_UNIVERSE)
}

/**
 * `rgba` is the readback, bottom row first (GL order), 4 bytes a pixel.
 * Returns one channel array per universe, top-left pixel first.
 *
 * One Uint8Array for the whole frame, each universe a view into it: the IPC
 * serializer copies the buffer once, one byte a channel, where arrays of JS
 * numbers were cloned element by element (a 100x100 panel is 59 universes,
 * 30000 values a frame, up to 60 times a second).
 */
export function packUniverses(rgba: Uint8Array, cfg: Pick<PixelMapConfig, 'cols' | 'rows' | 'universe' | 'snake'>): { universe: number; values: Uint8Array }[] {
  const { cols, rows } = cfg
  const total = cols * rows * 3
  const flat = new Uint8Array(total)
  let n = 0
  for (let y = 0; y < rows; y++) {
    const srcRow = rows - 1 - y
    const reverse = cfg.snake && y % 2 === 1
    for (let i = 0; i < cols; i++) {
      const x = reverse ? cols - 1 - i : i
      const o = (srcRow * cols + x) * 4
      flat[n++] = rgba[o]; flat[n++] = rgba[o + 1]; flat[n++] = rgba[o + 2]
    }
  }
  const per = PIXELS_PER_UNIVERSE * 3
  const out: { universe: number; values: Uint8Array }[] = []
  let u = cfg.universe
  for (let s = 0; s < total; s += per) out.push({ universe: u++, values: flat.subarray(s, Math.min(total, s + per)) })
  return out
}
