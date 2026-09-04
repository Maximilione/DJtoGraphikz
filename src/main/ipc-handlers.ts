import { BrowserWindow, ipcMain, dialog, net } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs'
import { basename, join } from 'path'
import { homedir } from 'os'
import { inflateRawSync } from 'zlib'

const USER_DATA_DIR = join(homedir(), '.djtographikz')
const ASSETS_DIR = join(USER_DATA_DIR, 'assets')
const ISF_DIR = join(USER_DATA_DIR, 'isf')

function ensureDirs() {
  for (const dir of [USER_DATA_DIR, ASSETS_DIR, ISF_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
}

/** Filenames only — no separators, no traversal */
function safeName(name: string): string {
  return basename(name).replace(/[^\w.\- ]/g, '_')
}

// ponytail: minimal ZIP reader (stored + deflate) — the ISF site ships .fs/.vs
// in a zip and a full zip lib is overkill for extracting two text files
function unzipEntries(buf: Buffer): { name: string; data: Buffer }[] {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0) throw new Error('ZIP non valido')
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  const out: { name: string; data: Buffer }[] = []
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const method = buf.readUInt16LE(off + 10)
    const csize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const lho = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)
    const dataStart = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28)
    const cdata = buf.subarray(dataStart, dataStart + csize)
    if (!name.endsWith('/')) out.push({ name, data: method === 0 ? Buffer.from(cdata) : inflateRawSync(cdata) })
    off += 46 + nameLen + extraLen + commentLen
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

  // Media library: assets copied under ~/.djtographikz/assets survive restarts
  ipcMain.handle('library:save', async (_e, name: string, dataUrl: string) => {
    const file = join(ASSETS_DIR, safeName(name))
    const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
    if (!m) throw new Error('expected base64 data URL')
    writeFileSync(file, Buffer.from(m[2], 'base64'))
    return { name: safeName(name), path: file }
  })

  ipcMain.handle('library:save-copy', async (_e, name: string, sourcePath: string) => {
    const file = join(ASSETS_DIR, safeName(name))
    writeFileSync(file, readFileSync(sourcePath))
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
  ipcMain.handle('isf:list', async () => {
    return readdirSync(ISF_DIR)
      .filter(f => /\.(fs|frag|glsl)$/i.test(f))
      .map(f => ({ name: f.replace(/\.(fs|frag|glsl)$/i, ''), source: readFileSync(join(ISF_DIR, f), 'utf-8') }))
  })

  // Online library (editor.isf.video): light index of the public generators,
  // cached 24h on disk — the full dump is ~40MB, fetched at most once a day
  ipcMain.handle('isf:browse', async (_e, force?: boolean) => {
    if (!force && existsSync(ISF_INDEX_CACHE)) {
      try {
        const c = JSON.parse(readFileSync(ISF_INDEX_CACHE, 'utf-8'))
        if (Date.now() - c.fetchedAt < ISF_INDEX_TTL && Array.isArray(c.shaders)) return c.shaders
      } catch { /* corrupt cache — refetch */ }
    }
    const res = await net.fetch(`${ISF_API}?limit=100000`)
    if (!res.ok) throw new Error(`editor.isf.video ha risposto ${res.status}`)
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
    writeFileSync(ISF_INDEX_CACHE, JSON.stringify({ fetchedAt: Date.now(), shaders }))
    return shaders
  })

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
    for (const fp of r.filePaths) {
      if (/\.zip$/i.test(fp)) {
        for (const ent of unzipEntries(readFileSync(fp))) {
          if (!/\.(fs|frag|glsl)$/i.test(ent.name)) continue
          const name = stripIsfExt(ent.name)
          writeFileSync(join(ISF_DIR, name + '.fs'), ent.data)
          imported.push({ name, source: ent.data.toString('utf-8') })
        }
      } else {
        const name = stripIsfExt(fp)
        const source = readFileSync(fp, 'utf-8')
        writeFileSync(join(ISF_DIR, name + '.fs'), source)
        imported.push({ name, source })
      }
    }
    return imported
  })

  // Video files are picked by path and read on demand — base64 over IPC would
  // blow up for a 100MB clip, and each window needs its own <video> anyway.
  ipcMain.handle('asset:pick-video', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'webm', 'mkv', 'm4v'] }]
    })
    if (result.canceled) return []
    return result.filePaths.map(filePath => ({ name: basename(filePath), path: filePath }))
  })

  ipcMain.handle('asset:read-file', async (_event, filePath: string) => {
    return readFileSync(filePath)
  })

  // Asset import via dialog
  ipcMain.handle('asset:import', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp'] }
      ]
    })
    if (result.canceled) return []
    return result.filePaths.map(filePath => {
      const data = readFileSync(filePath)
      const ext = filePath.split('.').pop() || 'png'
      const name = basename(filePath) || 'asset'
      return {
        name,
        ext,
        data: `data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${data.toString('base64')}`
      }
    })
  })
}
