import { readJson, writeJson } from './storage'

/**
 * Reel automatico (I4): gli ultimi secondi del muro, in 9:16, pronti da postare.
 *
 * Un WebM di MediaRecorder e' decodificabile solo dal primo chunk in poi: l'header
 * sta li', e un buffer circolare che butta via i chunk vecchi butta via anche
 * quello. Quindi niente anello di chunk: due recorder sulla stessa stream,
 * ognuno riparte da zero ogni LAP_MS, il secondo sfalsato di mezzo giro. In
 * ogni istante quello piu' vecchio ha dietro di se' fra 15 e 30 s interi e
 * autonomi — e' quello che si salva. Il costo e' un encoder in piu'; il
 * guadagno e' che il file e' sempre un WebM valido senza rimontarlo.
 *
 * Qui solo la politica (quando ripartire, cosa salvare, come ritagliare), con
 * un clock passato da fuori: il check la fa girare senza browser.
 */
export interface ReelSettings {
  enabled: boolean
  /** altezza del reel: 1280 (720×1280) o 1920 (1080×1920) */
  height: 1280 | 1920
  /** salva anche sul drop dell'Auto VJ */
  onDrop: boolean
}

export const REEL_KEY = 'djtographikz-reel'
export const REEL_DEFAULTS: ReelSettings = { enabled: false, height: 1280, onDrop: false }

const listeners = new Set<(s: ReelSettings) => void>()

export function loadReelSettings(): ReelSettings {
  const raw = readJson<Partial<ReelSettings>>(REEL_KEY, {})
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : REEL_DEFAULTS.enabled,
    height: raw.height === 1920 ? 1920 : 1280,
    onDrop: typeof raw.onDrop === 'boolean' ? raw.onDrop : REEL_DEFAULTS.onDrop,
  }
}

export function saveReelSettings(s: ReelSettings) {
  writeJson(REEL_KEY, s)
  for (const fn of listeners) fn(s)
}

export function onReelSettings(fn: (s: ReelSettings) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** un giro di recorder: la clip piu' lunga possibile */
export const LAP_MS = 30_000
/** il secondo recorder parte a meta' giro: la clip piu' corta possibile e' LAP/2 */
export const STAGGER_MS = LAP_MS / 2
/** un chunk al secondo: salvando si perde al piu' quello in corso, e requestData lo recupera */
export const CHUNK_MS = 1000
/** salvato al drop, il reel finisce qui dopo: resta la salita e il colpo, non solo la salita */
export const DROP_DELAY_MS = 8000
export const REEL_FPS = 30

/** Ritaglio 9:16 centrato di una sorgente w×h: [sx, sy, sw, sh]. */
export function cropRect(w: number, h: number): [number, number, number, number] {
  const sw = Math.min(w, h * 9 / 16)
  const sh = Math.min(h, w * 16 / 9)
  return [(w - sw) / 2, (h - sh) / 2, sw, sh]
}

export function reelFileName(d: Date): string {
  return `djtographikz-reel-${d.toISOString().replace(/[:.]/g, '-')}.webm`
}

export interface ReelLap<T> { startedAt: number; chunks: T[] }

export class ReelBuffer<T> {
  readonly laps: (ReelLap<T> | null)[] = [null, null]

  /**
   * Gli slot da (ri)avviare adesso: lo 0 subito e poi a ogni giro, l'1 a
   * mezzo giro dallo 0. Chi chiama crea un recorder nuovo per ogni giro: il
   * chunk finale del vecchio arriva dopo lo stop e deve finire nel giro
   * vecchio, non in testa a quello nuovo.
   */
  due(t: number): number[] {
    const out: number[] = []
    const a = this.laps[0]
    if (!a || t - a.startedAt >= LAP_MS) out.push(0)
    const b = this.laps[1]
    if (b ? t - b.startedAt >= LAP_MS : a && t - a.startedAt >= STAGGER_MS) out.push(1)
    return out
  }

  started(slot: number, t: number): ReelLap<T> {
    const lap: ReelLap<T> = { startedAt: t, chunks: [] }
    this.laps[slot] = lap
    return lap
  }

  /** Il giro con piu' strada alle spalle: a regime, sempre fra STAGGER e LAP. */
  best(t: number): { slot: number; seconds: number; chunks: T[] } | null {
    let pick: { slot: number; seconds: number; chunks: T[] } | null = null
    this.laps.forEach((lap, slot) => {
      if (!lap || lap.chunks.length === 0) return
      const seconds = (t - lap.startedAt) / 1000
      if (!pick || seconds > pick.seconds) pick = { slot, seconds, chunks: lap.chunks }
    })
    return pick
  }

  clear() { this.laps[0] = this.laps[1] = null }
}
