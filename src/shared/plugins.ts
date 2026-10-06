/**
 * Plugin dichiarativi (~/.djtographikz/plugins/<nome>/plugin.json).
 *
 * Un plugin contribuisce SOLO dati: shader ISF/GLSL (che girano sulla GPU come
 * quelli di ~/.djtographikz/isf), palette, preset, scalette, mapping
 * consigliati. Nessun codice JS viene mai caricato o eseguito.
 *
 * Modulo puro: niente fs ne' path di node, il chiamante passa un `PluginFs`
 * (main = node, check-plugins = node su cartella temporanea).
 */

export const PLUGIN_PREFIX = 'plugin:'
export const LIMITS = {
  manifest: 64 * 1024,
  shader: 256 * 1024,
  json: 1024 * 1024,
  perKind: 64,
  pathLen: 120,
} as const
export const SHADER_EXT = ['.fs', '.frag', '.glsl']
export const JSON_EXT = ['.json']
const SOURCES = ['none', 'bass', 'mid', 'high', 'energy', 'beat', 'lfo-sine', 'lfo-saw', 'lfo-square']
const ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/
const HEX_RE = /^#[0-9a-f]{6}$/i

export interface PluginFs {
  readdir(dir: string): string[]
  lstat(p: string): { isFile: boolean; isDirectory: boolean; isSymlink: boolean; size: number }
  realpath(p: string): string
  readFile(p: string): string
  join(a: string, b: string): string
  /** `p` e' dentro `root` (entrambi reali) */
  isInside(root: string, p: string): boolean
}

export interface PluginMapping { source: string; depth: number; lfoRate?: number; value?: number }
export interface LoadedPlugin {
  dir: string
  status: 'ok' | 'error'
  errors: string[]
  id: string
  name: string
  version: string
  author: string
  description: string
  effects: { id: string; name: string; description: string; source: string }[]
  palettes: { id: string; label: string; colors: [string, string, string] }[]
  presets: { id: string; preset: Record<string, unknown> }[]
  sequences: { id: string; sequence: Record<string, unknown> }[]
  /** id completo dell'effetto -> parametro -> mapping */
  mappings: { effect: string; params: Record<string, PluginMapping> }[]
}

export const pluginItemId = (pluginId: string, localId: string) => `${PLUGIN_PREFIX}${pluginId}/${localId}`

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max

function emptyPlugin(dir: string, name: string): LoadedPlugin {
  return { dir, status: 'error', errors: [], id: '', name, version: '', author: '', description: '', effects: [], palettes: [], presets: [], sequences: [], mappings: [] }
}

/** Percorso relativo interno al plugin: solo '/', niente '..', niente assoluti, estensione ammessa. */
export function sanitizePluginPath(rel: unknown, exts: string[]): { path: string } | { error: string } {
  if (typeof rel !== 'string' || !rel) return { error: 'percorso mancante' }
  if (rel.length > LIMITS.pathLen) return { error: `percorso troppo lungo: ${rel.slice(0, 30)}…` }
  if (/[\0\\]/.test(rel)) return { error: `percorso non ammesso: ${rel}` }
  if (rel.startsWith('/') || /^[a-zA-Z]:/.test(rel)) return { error: `percorso assoluto non ammesso: ${rel}` }
  if (rel.split('/').some(s => s === '' || s === '.' || s === '..')) return { error: `percorso non ammesso (../): ${rel}` }
  const ext = rel.includes('.') ? rel.slice(rel.lastIndexOf('.')).toLowerCase() : ''
  if (!exts.includes(ext)) return { error: `estensione non ammessa: ${rel} (ammesse ${exts.join(' ')})` }
  return { path: rel }
}

/** Legge un file del plugin: no symlink, dentro la cartella, dimensione massima. */
export function readPluginFile(fs: PluginFs, root: string, rel: unknown, exts: string[], max: number): { text: string } | { error: string } {
  const s = sanitizePluginPath(rel, exts)
  if ('error' in s) return s
  try {
    const full = fs.join(root, s.path)
    const st = fs.lstat(full)
    if (st.isSymlink) return { error: `symlink non ammesso: ${s.path}` }
    if (!st.isFile) return { error: `non e' un file: ${s.path}` }
    if (!fs.isInside(fs.realpath(root), fs.realpath(full))) return { error: `fuori dalla cartella del plugin: ${s.path}` }
    if (st.size > max) return { error: `file troppo grande: ${s.path} (${st.size} > ${max} byte)` }
    return { text: fs.readFile(full) }
  } catch {
    return { error: `file illeggibile: ${s.path}` }
  }
}

function validPreset(p: unknown): string | null {
  if (!isObj(p)) return 'preset non valido'
  if (!str(p.name, 80) || !str(p.effect, 80)) return 'preset senza name/effect'
  if (!Array.isArray(p.post) || !p.post.every(x => typeof x === 'string')) return 'preset: post non valido'
  if (!Array.isArray(p.colors) || p.colors.length !== 3 || !p.colors.every(c => typeof c === 'string' && HEX_RE.test(c))) return 'preset: colors deve essere di 3 colori #rrggbb'
  return null
}
function validSequence(s: unknown): string | null {
  if (!isObj(s) || !str(s.name, 80) || !Array.isArray(s.steps) || s.steps.length === 0 || s.steps.length > 500) return 'scaletta non valida (name, steps)'
  for (const st of s.steps) {
    if (!isObj(st)) return 'scaletta: step non valido'
    const e = validPreset(st.preset)
    if (e) return `scaletta: ${e}`
  }
  return null
}

/** Valida plugin.json e legge tutti i file referenziati. Non lancia mai: gli errori finiscono in `errors`. */
export function loadPlugin(fs: PluginFs, dir: string, takenIds: Set<string>): LoadedPlugin {
  const p = emptyPlugin(dir, dir.split(/[\\/]/).pop() || dir)
  try {
    const m = readPluginFile(fs, dir, 'plugin.json', JSON_EXT, LIMITS.manifest)
    if ('error' in m) { p.errors.push(m.error); return p }
    let raw: unknown
    try { raw = JSON.parse(m.text) } catch { p.errors.push("plugin.json non e' JSON valido"); return p }
    if (!isObj(raw)) { p.errors.push('plugin.json deve essere un oggetto'); return p }
    if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) p.errors.push('id: minuscole, cifre e trattini (max 32)')
    else if (takenIds.has(raw.id)) p.errors.push(`id duplicato: "${raw.id}" e' gia' usato da un altro plugin`)
    else p.id = raw.id
    if (str(raw.name, 60)) p.name = raw.name; else p.errors.push('name: stringa 1-60 caratteri')
    if (typeof raw.version === 'string' && /^\d+\.\d+\.\d+([-+][\w.]+)?$/.test(raw.version)) p.version = raw.version; else p.errors.push('version: formato X.Y.Z')
    if (str(raw.author, 60)) p.author = raw.author; else p.errors.push('author: stringa 1-60 caratteri')
    if (raw.description !== undefined) { if (typeof raw.description === 'string' && raw.description.length <= 300) p.description = raw.description; else p.errors.push('description: max 300 caratteri') }
    if (p.errors.length) return p

    const seen = new Set<string>()
    const list = (key: string): unknown[] => {
      const v = raw[key]
      if (v === undefined) return []
      if (!Array.isArray(v) || v.length > LIMITS.perKind) { p.errors.push(`${key}: lista di max ${LIMITS.perKind} elementi`); return [] }
      return v
    }
    // Un elemento rotto non butta giu' il plugin: l'errore e' registrato e il resto si carica.
    const each = (kind: string, fn: (it: Record<string, unknown>, id: string) => void) => {
      for (const it of list(kind)) {
        try {
          if (!isObj(it)) { p.errors.push(`${kind}: elemento non valido`); continue }
          if (typeof it.id !== 'string' || !ID_RE.test(it.id)) { p.errors.push(`${kind}: id non valido (${String(it.id).slice(0, 20)})`); continue }
          const id = pluginItemId(p.id, it.id)
          if (seen.has(id)) { p.errors.push(`${kind}: id duplicato ${id}`); continue }
          seen.add(id)
          fn(it, id)
        } catch { p.errors.push(`${kind}: errore imprevisto`) }
      }
    }
    const jsonFile = (it: Record<string, unknown>, id: string): unknown => {
      const f = readPluginFile(fs, dir, it.file, JSON_EXT, LIMITS.json)
      if ('error' in f) { p.errors.push(`${id}: ${f.error}`); return undefined }
      try { return JSON.parse(f.text) } catch { p.errors.push(`${id}: JSON non valido`); return undefined }
    }
    each('effects', (it, id) => {
      if (!str(it.name, 60)) return void p.errors.push(`${id}: name mancante`)
      const f = readPluginFile(fs, dir, it.file, SHADER_EXT, LIMITS.shader)
      if ('error' in f) return void p.errors.push(`${id}: ${f.error}`)
      p.effects.push({ id, name: it.name, description: typeof it.description === 'string' ? it.description.slice(0, 200) : '', source: f.text })
    })
    each('palettes', (it, id) => {
      if (!str(it.name, 14)) return void p.errors.push(`${id}: name 1-14 caratteri`)
      if (!Array.isArray(it.colors) || it.colors.length !== 3 || !it.colors.every(c => typeof c === 'string' && HEX_RE.test(c))) return void p.errors.push(`${id}: colors deve essere di 3 colori #rrggbb`)
      p.palettes.push({ id, label: it.name, colors: it.colors as [string, string, string] })
    })
    each('presets', (it, id) => {
      const j = jsonFile(it, id)
      if (j === undefined) return
      const e = validPreset(j)
      if (e) return void p.errors.push(`${id}: ${e}`)
      p.presets.push({ id, preset: j as Record<string, unknown> })
    })
    each('sequences', (it, id) => {
      const j = jsonFile(it, id)
      if (j === undefined) return
      // un file puo' contenere una scaletta o (come docs/scalette/live-4h.json) una lista: si prende la prima
      const s = Array.isArray(j) ? j[0] : j
      const e = validSequence(s)
      if (e) return void p.errors.push(`${id}: ${e}`)
      p.sequences.push({ id, sequence: s as Record<string, unknown> })
    })
    for (const it of list('mappings')) {
      if (!isObj(it) || typeof it.effect !== 'string' || !isObj(it.params)) { p.errors.push('mappings: serve {effect, params}'); continue }
      const eff = pluginItemId(p.id, it.effect)
      if (!p.effects.some(e => e.id === eff)) { p.errors.push(`mappings: effetto sconosciuto "${it.effect}"`); continue }
      const params: Record<string, PluginMapping> = {}
      for (const [k, v] of Object.entries(it.params)) {
        if (!/^\w{1,40}$/.test(k) || !isObj(v) || typeof v.source !== 'string' || !SOURCES.includes(v.source)
          || typeof v.depth !== 'number' || !(v.depth >= -1 && v.depth <= 1)
          || (v.lfoRate !== undefined && (typeof v.lfoRate !== 'number' || !(v.lfoRate >= 0.25 && v.lfoRate <= 64)))
          || (v.value !== undefined && typeof v.value !== 'number')) { p.errors.push(`mappings: parametro "${k}" non valido`); continue }
        params[k] = { source: v.source, depth: v.depth, ...(v.lfoRate !== undefined && { lfoRate: v.lfoRate }), ...(v.value !== undefined && { value: v.value }) }
      }
      p.mappings.push({ effect: eff, params })
    }
    // gli elementi scartati restano errori visibili, ma un plugin con almeno un contributo e' utilizzabile
    const n = p.effects.length + p.palettes.length + p.presets.length + p.sequences.length
    if (n === 0 && !p.errors.length) p.errors.push('nessun contributo')
    p.status = n > 0 ? 'ok' : 'error'
    return p
  } catch {
    p.errors.push('errore imprevisto nel caricamento')
    p.status = 'error'
    return p
  }
}

/** Scansiona la cartella plugins: ogni sottocartella e' un plugin (i symlink sono rifiutati). */
export function loadAllPlugins(fs: PluginFs, root: string): LoadedPlugin[] {
  const out: LoadedPlugin[] = []
  const taken = new Set<string>()
  let names: string[]
  try { names = fs.readdir(root).filter(n => !n.startsWith('.')).sort() } catch { return out }
  for (const n of names) {
    const dir = fs.join(root, n)
    try {
      const st = fs.lstat(dir)
      if (st.isSymlink) { const e = emptyPlugin(dir, n); e.errors.push('cartella symlink non ammessa'); out.push(e); continue }
      if (!st.isDirectory) continue
      const p = loadPlugin(fs, dir, taken)
      if (p.id) taken.add(p.id)
      out.push(p)
    } catch { /* cartella illeggibile: ignorata */ }
  }
  return out
}
