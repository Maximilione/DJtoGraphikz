/**
 * Wire format of the OBS / browser output feed (I2).
 *
 * The output window gets the show over IPC: `engine:state-update`,
 * `audio:data`, `overlay:*`, `output:slice`, `output:set-resolution`. A browser
 * on the LAN gets the very same channels and the very same arguments over SSE
 * (`GET /events`): one frame per IPC message, `event:` = channel, `data:` =
 * the args array as JSON. The only thing JSON cannot carry is the spectrum
 * (a Uint8Array), which travels as base64 under a marker key.
 *
 * Pure: no Electron, no DOM — shared by main (encode), the output page
 * (decode) and scripts/check-obs.mjs.
 *
 * ponytail: SSE, not WebSocket — nothing flows back from the browser, and
 * ~30 msg/s × ~3 kB (2048 spectrum bytes in base64) is nothing on a LAN.
 */

const U8 = '__u8'

function u8ToB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function b64ToU8(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

/** One SSE frame for an IPC message: `event: <channel>\ndata: <json>\n\n`. */
export function encodeEvent(channel: string, args: unknown[]): string {
  if (/[\r\n]/.test(channel)) throw new Error('bad channel')
  const json = JSON.stringify(args, (_k, v) => (v instanceof Uint8Array ? { [U8]: u8ToB64(v) } : v))
  return `event: ${channel}\ndata: ${json}\n\n`
}

/** The args array back from an SSE frame's `data`. */
export function decodeEvent(data: string): unknown[] {
  const args = JSON.parse(data, (_k, v) =>
    v && typeof v === 'object' && typeof v[U8] === 'string' ? b64ToU8(v[U8]) : v)
  return Array.isArray(args) ? args : []
}

/**
 * The output token as a browser can hand it over: `?token=` on the page and
 * on the EventSource, the `djg-out` cookie for the module scripts the page
 * loads (a <script src> cannot carry a query string we control).
 */
export function tokenFromRequest(url: string, cookie = ''): string {
  const q = url.indexOf('?')
  if (q >= 0) {
    const t = new URLSearchParams(url.slice(q + 1)).get('token')
    if (t) return t
  }
  const m = /(?:^|;\s*)djg-out=([A-Za-z0-9]+)/.exec(cookie)
  return m ? m[1] : ''
}
