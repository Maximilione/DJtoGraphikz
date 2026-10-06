/** Spessore linee globale (uniform uLineBoost), 0..1. Preset vecchi senza il campo: default. */
export const LINE_BOOST_DEFAULT = 0.5

export function sanitizeLineBoost(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : LINE_BOOST_DEFAULT
}
