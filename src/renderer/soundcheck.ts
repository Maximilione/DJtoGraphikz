/**
 * Soundcheck (P3): the pure part. What each measurement means lives here, in
 * one place, so scripts/check-soundcheck.mjs can pin the thresholds without
 * opening a window. The modal only measures and calls these.
 */

export type Status = 'ok' | 'warn' | 'err'

export interface Row {
  id: string
  name: string
  status: Status
  /** one short line, Italian, what the operator reads */
  detail: string
}

/** Seconds of audio the soundcheck listens for, and how many must carry signal */
export const INPUT_WINDOW_S = 6
export const INPUT_MIN_S = 3
export const DISK_MIN_GB = 2
export const FPS_OK = 50
export const FPS_WARN = 30
// Same thresholds as scripts/check-output.py: the release gate and the in-app
// check must agree on what "black" and "uniform" mean.
export const FRAME_BLACK = 0.008
export const FRAME_FLAT = 0.01

export interface FrameStats { mean: number; std: number; bright: number }

/** What the output window answers to a probe: one frame's luma plus its pace */
export interface OutputProbe extends FrameStats {
  fps: number
  canvas: string
}

/** Luma mean/std and lit fraction of an rgba buffer; row order does not matter. */
export function frameStats(rgba: ArrayLike<number>): FrameStats {
  const n = rgba.length >> 2
  if (!n) return { mean: 0, std: 0, bright: 0 }
  let sum = 0, sq = 0, lit = 0
  for (let i = 0; i < rgba.length; i += 4) {
    const l = (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255
    sum += l
    sq += l * l
    if (l > 0.08) lit++
  }
  const mean = sum / n
  return { mean, std: Math.sqrt(Math.max(0, sq / n - mean * mean)), bright: lit / n }
}

export function judgeInput(signalS: number): Row {
  const s = Math.min(INPUT_WINDOW_S, signalS)
  return {
    id: 'input', name: 'Ingresso audio',
    status: s >= INPUT_MIN_S ? 'ok' : s > 0 ? 'warn' : 'err',
    detail: s > 0
      ? `segnale per ${s.toFixed(1)} s su ${INPUT_WINDOW_S}`
      : 'nessun segnale: controlla sorgente e guadagno nel pannello Audio',
  }
}

export function judgeOutput(open: boolean, probe: OutputProbe | null): Row {
  const row = (status: Status, detail: string): Row => ({ id: 'output', name: 'Finestra di output', status, detail })
  if (!open) return row('err', 'chiusa: riaprila dalla barra in alto')
  if (!probe) return row('err', 'aperta ma non risponde')
  if (probe.fps <= 0) return row('err', `immagine ferma (${probe.canvas})`)
  if (probe.mean < FRAME_BLACK) return row('err', 'immagine nera: blackout o luminosita\' a zero?')
  if (probe.std < FRAME_FLAT) return row('err', 'immagine uniforme, nessun contenuto')
  return row('ok', `disegna a ${probe.canvas} · luce ${(probe.mean * 100).toFixed(0)}% · pixel accesi ${(probe.bright * 100).toFixed(0)}%`)
}

function fpsStatus(fps: number): Status {
  return fps >= FPS_OK ? 'ok' : fps >= FPS_WARN ? 'warn' : 'err'
}

/** One row for both windows; the slower one sets the colour. */
export function judgeFps(controlFps: number, outputFps: number | null, res: string): Row {
  const worstFps = outputFps === null ? controlFps : Math.min(controlFps, outputFps)
  const parts = [`controllo ${Math.round(controlFps)} fps`]
  if (outputFps !== null) parts.push(`output ${Math.round(outputFps)} fps`)
  return { id: 'fps', name: `Frame rate a ${res}`, status: fpsStatus(worstFps), detail: parts.join(' · ') }
}

export function judgeDmx(enabled: boolean, host: string, res: { ok: boolean; error?: string } | null): Row {
  const target = host.trim() || 'broadcast'
  const where = enabled ? `verso ${target}` : `DMX spento · rete verso ${target}`
  return {
    id: 'dmx', name: 'ArtNet / DMX',
    status: res?.ok ? 'ok' : enabled ? 'err' : 'warn',
    detail: res?.ok ? `pacchetto inviato ${where}` : `invio fallito ${where}${res?.error ? ` (${res.error})` : ''}`,
  }
}

export function judgeRemote(info: { url: string } | null): Row {
  return {
    id: 'remote', name: 'Remote dal telefono',
    status: info?.url ? 'ok' : 'err',
    detail: info?.url ?? 'server remoto non attivo',
  }
}

export function judgeDisk(freeBytes: number | null): Row {
  if (freeBytes === null || !isFinite(freeBytes)) return { id: 'disk', name: 'Spazio disco', status: 'warn', detail: 'non misurabile' }
  const gb = freeBytes / 1e9
  return {
    id: 'disk', name: 'Spazio disco',
    status: gb >= DISK_MIN_GB ? 'ok' : 'err',
    detail: gb >= DISK_MIN_GB ? `${gb.toFixed(1)} GB liberi` : `${gb.toFixed(1)} GB liberi: sotto ${DISK_MIN_GB} GB le registrazioni possono fallire`,
  }
}

/** The colour of the whole list: red if anything is red, then yellow, then green. */
export function worst(rows: Row[]): Status {
  return rows.some(r => r.status === 'err') ? 'err' : rows.some(r => r.status === 'warn') ? 'warn' : 'ok'
}
