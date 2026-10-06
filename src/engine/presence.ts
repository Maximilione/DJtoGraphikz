/** Presenza proiettore (uniform uPresence), 0..1. Preset vecchi senza il campo: 0 = output identico a prima. */
export const PRESENCE_DEFAULT = 0

export function sanitizePresence(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : PRESENCE_DEFAULT
}
