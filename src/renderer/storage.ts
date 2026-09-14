import { pushToast } from './components/Toasts/Toasts'

/**
 * The one door to localStorage.
 *
 * Before this, thirteen keys each did their own thing, and the failures were
 * all silent in the same two ways:
 *
 * - A parse error returned the empty fallback, and the very next save
 *   **overwrote the corrupt value**. One bad byte and all sixteen looks were
 *   gone for good, with no toast and no log. Now a value that will not parse is
 *   moved aside to `<key>.rotto` first, so it is still there to recover.
 * - A quota failure was swallowed by `catch {}`. The biggest writer is the
 *   session snapshot, base64 images included, every 400 ms — so it is the one
 *   that fills the quota and thereby makes every *other* save fail in silence.
 *   Now a write says whether it happened, and the first failure is reported.
 */

/** Bumped when a stored shape changes in a way a reader must know about. */
export const SCHEMA_VERSION = 1

const VERSION_KEY = 'djtographikz-schema'

let quotaReported = false

/**
 * `quarantine: false` for caches. Keeping a corrupt copy is only worth it for
 * values the user made; for a regenerable one it just parks the fattest string
 * in the store forever.
 */
export function readJson<T>(key: string, fallback: T, quarantine = true): T {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    // Keep the bytes. They are the user's presets or looks, and the next write
    // would erase them.
    if (quarantine) {
      try { localStorage.setItem(`${key}.rotto`, raw) } catch { /* no room to even quarantine */ }
      console.error(`[storage] ${key} illeggibile — spostato in ${key}.rotto`)
    } else {
      try { localStorage.removeItem(key) } catch { /* nothing to do */ }
      console.error(`[storage] ${key} illeggibile — buttato via`)
    }
    return fallback
  }
}

/** false = nothing was written. Callers must not show what they did not save. */
export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    if (!quotaReported) {
      quotaReported = true
      pushToast('Spazio di salvataggio esaurito — le modifiche non vengono salvate',
        'storage-quota', undefined, 'err')
    }
    console.error(`[storage] scrittura di ${key} fallita: spazio esaurito`)
    return false
  }
}

export function readString(key: string): string | null {
  return localStorage.getItem(key)
}

export function writeString(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** Records the schema version this build wrote, so a future one can migrate. */
export function stampSchemaVersion(): void {
  const seen = Number(localStorage.getItem(VERSION_KEY) ?? '0')
  if (seen === SCHEMA_VERSION) return
  if (seen > SCHEMA_VERSION) {
    console.warn(`[storage] i dati vengono da una versione piu' recente (${seen} > ${SCHEMA_VERSION})`)
    return
  }
  writeString(VERSION_KEY, String(SCHEMA_VERSION))
}
