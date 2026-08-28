import { BrowserWindow, ipcMain, dialog } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs'
import { basename, join } from 'path'
import { homedir } from 'os'

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
