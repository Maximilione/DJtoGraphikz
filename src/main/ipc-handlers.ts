import { BrowserWindow, ipcMain, dialog } from 'electron'
import { readFileSync, mkdirSync, existsSync } from 'fs'
import { basename, join } from 'path'
import { homedir } from 'os'

const USER_DATA_DIR = join(homedir(), '.djtographikz')
const ASSETS_DIR = join(USER_DATA_DIR, 'assets')

function ensureDirs() {
  for (const dir of [USER_DATA_DIR, ASSETS_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
}

export function setupIpcHandlers(
  _controlWindow: BrowserWindow,
  _outputWindow: BrowserWindow
) {
  ensureDirs()

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
