import { BrowserWindow, ipcMain, dialog, net, shell } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, readdirSync, unlinkSync, lstatSync, realpathSync } from 'fs'
import { statfs, readFile, writeFile, copyFile, readdir, rename, stat, rm } from 'fs/promises'
import { basename, join, relative, isAbsolute } from 'path'
import { homedir, tmpdir } from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { IMAGE_NATIVE, IMAGE_CONVERT, VIDEO_EXT, MODEL_EXT, CONVERT_RE, SEQ_RE, SEQ_CONVERT_RE, imageMime } from '../shared/mediaFormats'
import { sortNatural } from '../shared/imageSequence'
import { inflateRawSync } from 'zlib'
import { loadAllPlugins, type PluginFs } from '../shared/plugins'

const USER_DATA_DIR = join(homedir(), '.djtographikz')
const ASSETS_DIR = join(USER_DATA_DIR, 'assets')
const ISF_DIR = join(USER_DATA_DIR, 'isf')
const PLUGINS_DIR = join(USER_DATA_DIR, 'plugins')

// sips runs OUT of process and the main thread must not wait for it: while a
// sync spawn converted a TIFF sequence, main forwarded no state and no audio
// to the outputs and served no remote/OSC/DMX — the projector froze mid-set.
const execFileP = promisify(execFile)
const SIPS_TIMEOUT_MS = 120_000
const sips = (args: string[]) => execFileP('/usr/bin/sips', args, { timeout: SIPS_TIMEOUT_MS })
/** sips takes the whole list in one call, but ARG_MAX says how long that list can be */
const SIPS_BATCH = 200
const tmpPng = () => join(tmpdir(), `djg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`)

/**
 * The PNGs sips leaves in tmpdir were never removed: every EXR/TIFF import
 * left tens of MB behind and macOS clears /var/folders only after days. Old
 * ones go at startup, never at quit — a sequence loaded this session may
 * still point into one of these folders.
 */
const TMP_KEEP_MS = 7 * 24 * 3600_000
async function sweepTmp() {
  try {
    const dir = tmpdir()
    const cutoff = Date.now() - TMP_KEEP_MS
    for (const f of await readdir(dir)) {
      if (!/^djg-seq-/.test(f) && !/^djg-.*\.png$/i.test(f)) continue
      const p = join(dir, f)
      try {
        if ((await stat(p)).mtimeMs < cutoff) await rm(p, { recursive: true, force: true })
      } catch { /* vanished meanwhile */ }
    }
  } catch { /* tmpdir unreadable: nothing to clean */ }
}

const NODE_PLUGIN_FS: PluginFs = {
  readdir: d => readdirSync(d),
  lstat: p => { const s = lstatSync(p); return { isFile: s.isFile(), isDirectory: s.isDirectory(), isSymlink: s.isSymbolicLink(), size: s.size } },
  realpath: p => realpathSync(p),
  readFile: p => readFileSync(p, 'utf-8'),
  join,
  isInside: (root, p) => { const r = relative(root, p); return !!r && !r.startsWith('..') && !isAbsolute(r) },
}

function ensureDirs() {
  for (const dir of [USER_DATA_DIR, ASSETS_DIR, ISF_DIR, PLUGINS_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
}

/** Filenames only — no separators, no traversal */
function safeName(name: string): string {
  return basename(name).replace(/[^\w.\- ]/g, '_')
}

// ponytail: minimal ZIP reader (stored + deflate) — the ISF site ships .fs/.vs
// in a zip and a full zip lib is overkill for extracting two text files.
// Only the entries `want` asks for are inflated, and never past 4MB: a shader
// source is kilobytes, and a corrupt or hostile zip must not expand in main.
const UNZIP_MAX_ENTRY = 4 * 1024 * 1024
function unzipEntries(buf: Buffer, want: (name: string) => boolean): { name: string; data: Buffer }[] {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0) throw new Error('ZIP non valido')
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  const out: { name: string; data: Buffer }[] = []
  for (let i = 0; i < count; i++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) break
    const method = buf.readUInt16LE(off + 10)
    const csize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const lho = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)
    off += 46 + nameLen + extraLen + commentLen
    if (name.endsWith('/') || !want(name)) continue
    if (lho + 30 > buf.length) throw new Error('ZIP troncato')
    const dataStart = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28)
    if (dataStart + csize > buf.length) throw new Error('ZIP troncato')
    const cdata = buf.subarray(dataStart, dataStart + csize)
    out.push({ name, data: method === 0 ? Buffer.from(cdata) : inflateRawSync(cdata, { maxOutputLength: UNZIP_MAX_ENTRY }) })
  }
  return out
}

const ISF_API = 'https://editor.isf.video/api/shaders'
const ISF_INDEX_CACHE = join(USER_DATA_DIR, 'isf-index.json')
const ISF_INDEX_TTL = 24 * 3600_000

function stripIsfExt(name: string): string {
  return safeName(name).replace(/\.(fs|frag|glsl)$/i, '').trim() || 'shader'
}

export function setupIpcHandlers(
  _controlWindow: BrowserWindow,
  _outputWindow: BrowserWindow
) {
  ensureDirs()
  void sweepTmp()

  // Soundcheck (P3): free bytes on the volume that holds the user data
  ipcMain.handle('disk:free', async () => {
    const s = await statfs(USER_DATA_DIR)
    return s.bavail * s.bsize
  })

  // Media library: assets copied under ~/.djtographikz/assets survive restarts
  ipcMain.handle('library:save', async (_e, name: string, dataUrl: string) => {
    const file = join(ASSETS_DIR, safeName(name))
    const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
    if (!m) throw new Error('expected base64 data URL')
    await writeFile(file, Buffer.from(m[2], 'base64'))
    return { name: safeName(name), path: file }
  })

  // copyFile: the kernel moves the bytes, a 1GB clip no longer passes through
  // main's heap and the thread stays free while a USB stick is read
  ipcMain.handle('library:save-copy', async (_e, name: string, sourcePath: string) => {
    const file = join(ASSETS_DIR, safeName(name))
    await copyFile(sourcePath, file)
    return { name: safeName(name), path: file }
  })

  ipcMain.handle('library:list', async () => {
    return readdirSync(ASSETS_DIR)
      .filter(f => !f.startsWith('.'))
      .map(f => ({ name: f, path: join(ASSETS_DIR, f) }))
  })

  ipcMain.handle('library:delete', async (_e, name: string) => {
    const file = join(ASSETS_DIR, safeName(name))
    if (existsSync(file)) unlinkSync(file)
  })

  // ISF folder: every generator dropped in ~/.djtographikz/isf becomes an effect
  // One unreadable file no longer fails the whole list: it is skipped
  ipcMain.handle('isf:list', async () => {
    const files = (await readdir(ISF_DIR)).filter(f => /\.(fs|frag|glsl)$/i.test(f))
    const all = await Promise.all(files.map(async f => {
      try { return { name: f.replace(/\.(fs|frag|glsl)$/i, ''), source: await readFile(join(ISF_DIR, f), 'utf-8') } }
      catch { return null }
    }))
    return all.filter((x): x is { name: string; source: string } => x !== null)
  })

  // Plugin dichiarativi: solo dati, validati qui (src/shared/plugins.ts); un plugin rotto non butta giu' gli altri
  ipcMain.handle('plugins:list', async () => loadAllPlugins(NODE_PLUGIN_FS, PLUGINS_DIR))
  ipcMain.handle('plugins:open-folder', async () => { await shell.openPath(PLUGINS_DIR) })

  // Online library (editor.isf.video): light index of the public generators,
  // cached 24h on disk — the full dump is ~40MB, fetched at most once a day.
  // One download at a time (two panels asking together parsed 40MB twice), a
  // timeout, and the stale cache as the fallback when the club has no internet.
  let browseInflight: Promise<any[]> | null = null
  ipcMain.handle('isf:browse', (_e, force?: boolean) =>
    browseInflight ??= browseIsf(!!force).finally(() => { browseInflight = null }))

  async function browseIsf(force: boolean): Promise<any[]> {
    let stale: any[] | null = null
    try {
      const c = JSON.parse(await readFile(ISF_INDEX_CACHE, 'utf-8'))
      if (Array.isArray(c.shaders)) {
        if (!force && Date.now() - c.fetchedAt < ISF_INDEX_TTL) return c.shaders
        stale = c.shaders
      }
    } catch { /* missing or corrupt cache — refetch */ }
    let res: Response
    try {
      res = await net.fetch(`${ISF_API}?limit=100000`, { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) throw new Error(`editor.isf.video ha risposto ${res.status}`)
    } catch (e) {
      if (stale) { console.warn('[ISF] rete assente, uso l\'indice in cache:', (e as Error)?.message); return stale }
      throw e
    }
    const all = await res.json() as any[]
    const shaders = all
      .filter(s => {
        // same rejects as IsfLoader — don't list what can't load (~3%)
        if (s.shaderType !== 'generator' || s.private || !s._id) return false
        const src: string = s.rawFragmentSource || ''
        if (/\binputImage\b/.test(src)) return false
        const header = src.match(/\/\*\s*(\{[\s\S]*?\})\s*\*\//)
        try {
          const passes = header ? JSON.parse(header[1]).PASSES : null
          if (Array.isArray(passes) && passes.length > 1) return false
        } catch { return false }
        return true
      })
      .map(s => ({
        id: String(s._id),
        title: s.title || 'Senza nome',
        user: s.username || '',
        thumb: s.thumbnailCloudinaryId || '',
        stars: Array.isArray(s.stars) ? s.stars.length : 0,
      }))
      .sort((a, b) => b.stars - a.stars)
    // write + rename: a crash mid-write leaves the old index, not half a JSON
    try {
      const tmp = ISF_INDEX_CACHE + '.tmp'
      await writeFile(tmp, JSON.stringify({ fetchedAt: Date.now(), shaders }))
      await rename(tmp, ISF_INDEX_CACHE)
    } catch (e) { console.warn('[ISF] cache non scritta:', (e as Error)?.message) }
    return shaders
  }

  // Import one shader from the online library into ~/.djtographikz/isf
  ipcMain.handle('isf:import-online', async (_e, id: string, title: string) => {
    const res = await net.fetch(`${ISF_API}/${encodeURIComponent(id)}`)
    if (!res.ok) throw new Error(`editor.isf.video ha risposto ${res.status}`)
    const s = await res.json() as any
    if (!s.rawFragmentSource) throw new Error('sorgente mancante nella risposta')
    const name = stripIsfExt(title || s.title || id)
    writeFileSync(join(ISF_DIR, name + '.fs'), s.rawFragmentSource)
    return { name, source: s.rawFragmentSource as string }
  })

  // Import local .fs/.zip files (the site's download is a zip with .fs + .vs;
  // the .vs is ignored — our vertex stage is fixed)
  ipcMain.handle('isf:import-file', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Shader ISF', extensions: ['fs', 'frag', 'glsl', 'zip'] }]
    })
    if (r.canceled) return []
    const imported: { name: string; source: string }[] = []
    const isShader = (n: string) => /\.(fs|frag|glsl)$/i.test(n)
    // per file: one broken zip skips itself, not the others picked with it
    for (const fp of r.filePaths) {
      try {
        if (/\.zip$/i.test(fp)) {
          for (const ent of unzipEntries(await readFile(fp), isShader)) {
            const name = stripIsfExt(ent.name)
            await writeFile(join(ISF_DIR, name + '.fs'), ent.data)
            imported.push({ name, source: ent.data.toString('utf-8') })
          }
        } else {
          const name = stripIsfExt(fp)
          const source = await readFile(fp, 'utf-8')
          await writeFile(join(ISF_DIR, name + '.fs'), source)
          imported.push({ name, source })
        }
      } catch (e) {
        console.error('[ISF] import saltato', fp, (e as Error)?.message)
      }
    }
    return imported
  })

  // Video files are picked by path and read on demand — base64 over IPC would
  // blow up for a 100MB clip, and each window needs its own <video> anyway.
  ipcMain.handle('asset:pick-video', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Video', extensions: VIDEO_EXT }]
    })
    if (result.canceled) return []
    return result.filePaths.map(filePath => ({ name: basename(filePath), path: filePath }))
  })

  // One 3D model for the `mesh` effect; the renderer copies it into the library
  ipcMain.handle('asset:pick-model', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Modelli 3D', extensions: MODEL_EXT }]
    })
    if (result.canceled) return []
    return result.filePaths.map(filePath => ({ name: basename(filePath), path: filePath }))
  })

  // Pictures for the `imgbeat` effect (the renderer copies them into the library).
  // `img.decode()` in Engine.loadImgbeat only reads Chromium-native formats, so
  // HEIC/TIFF/PSD/RAW are converted to PNG here first — same sips path as asset:import.
  ipcMain.handle('asset:pick-image', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Immagini', extensions: process.platform === 'darwin' ? [...IMAGE_NATIVE, ...IMAGE_CONVERT] : IMAGE_NATIVE }]
    })
    if (result.canceled) return []
    // conversions run in parallel, off the main thread; the order is kept
    return Promise.all(result.filePaths.slice(0, 8).map(async filePath => {
      if (!CONVERT_RE.test(filePath)) return { name: basename(filePath), path: filePath }
      const png = tmpPng()
      try {
        await sips(['-s', 'format', 'png', filePath, '--out', png])
        return { name: basename(filePath).replace(/\.[^.]+$/, '') + '.png', path: png }
      } catch {
        return { name: basename(filePath), path: filePath }
      }
    }))
  })

  // A folder of numbered frames. One sequence per folder; frames are streamed
  // by the renderer over djg-media, so only paths cross IPC.
  ipcMain.handle('asset:pick-sequence', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths[0]) return null
    const dir = result.filePaths[0]
    const files = readdirSync(dir)
    const native = files.filter(f => SEQ_RE.test(f))
    const foreign = files.filter(f => SEQ_CONVERT_RE.test(f))
    const name = basename(dir)
    if (native.length) {
      const note = foreign.length ? `${foreign.length} file EXR/DPX/TIFF ignorati: una sola sequenza per cartella` : undefined
      return { name, dir, paths: sortNatural(native).map(f => join(dir, f)), note }
    }
    if (!foreign.length) return { name, dir, paths: [], note: 'nessun frame PNG/JPG/WebP/AVIF nella cartella' }
    if (process.platform !== 'darwin') {
      return { name, dir, paths: [], note: 'EXR/DPX/TIFF non si leggono qui: convertili in PNG (ffmpeg, oiiotool) e riprova' }
    }
    // macOS: sips → PNG in a temp folder, in batches of SIPS_BATCH frames
    // (ARG_MAX), two batches at a time, each one on its own: a batch that
    // fails leaves the others' output, and what landed is what counts
    const out = mkdtempSync(join(tmpdir(), 'djg-seq-'))
    const src = sortNatural(foreign).map(f => join(dir, f))
    const batches: string[][] = []
    for (let i = 0; i < src.length; i += SIPS_BATCH) batches.push(src.slice(i, i + SIPS_BATCH))
    const worker = async () => {
      for (let b = batches.shift(); b; b = batches.shift()) {
        try { await sips(['-s', 'format', 'png', ...b, '--out', out]) }
        catch { /* partial output is still usable: judge by what landed */ }
      }
    }
    await Promise.all([worker(), worker()])
    const pngs = sortNatural((await readdir(out)).filter(f => /\.png$/i.test(f))).map(f => join(out, f))
    if (!pngs.length) return { name, dir, paths: [], note: 'conversione con sips fallita: converti i frame in PNG' }
    return { name, dir, paths: pngs, note: 'frame convertiti in PNG a 8 bit (sips)' }
  })

  ipcMain.handle('asset:read-file', async (_event, filePath: string) => {
    return readFile(filePath)
  })

  // Asset import via dialog
  ipcMain.handle('asset:import', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Immagini', extensions: process.platform === 'darwin' ? [...IMAGE_NATIVE, ...IMAGE_CONVERT] : IMAGE_NATIVE }
      ]
    })
    if (result.canceled) return []
    const out: { name: string; ext: string; data: string }[] = []
    for (const filePath of result.filePaths) {
      let path = filePath
      let name = basename(filePath) || 'asset'
      // HEIC/TIFF/PSD/RAW...: Chromium can't decode them, macOS can. sips → PNG.
      if (CONVERT_RE.test(path)) {
        if (process.platform !== 'darwin') continue
        const png = tmpPng()
        try {
          await sips(['-s', 'format', 'png', path, '--out', png])
        } catch { continue }
        path = png
        name = name.replace(/\.[^.]+$/, '') + '.png'
      }
      const data = await readFile(path)
      out.push({ name, ext: name.split('.').pop() || 'png', data: `data:${imageMime(name)};base64,${data.toString('base64')}` })
    }
    return out
  })
}
