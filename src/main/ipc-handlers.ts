import { BrowserWindow, ipcMain, dialog } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const USER_DATA_DIR = join(homedir(), '.djtographikz')
const TEMPLATES_DIR = join(USER_DATA_DIR, 'templates')
const ASSETS_DIR = join(USER_DATA_DIR, 'assets')

function ensureDirs() {
  for (const dir of [USER_DATA_DIR, TEMPLATES_DIR, ASSETS_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
}

export function setupIpcHandlers(
  _controlWindow: BrowserWindow,
  _outputWindow: BrowserWindow
) {
  ensureDirs()

  // Template operations
  ipcMain.handle('template:save', async (_event, name: string, data: string) => {
    const filePath = join(TEMPLATES_DIR, `${name}.json`)
    writeFileSync(filePath, data, 'utf-8')
    return filePath
  })

  ipcMain.handle('template:load', async (_event, name: string) => {
    const filePath = join(TEMPLATES_DIR, `${name}.json`)
    if (!existsSync(filePath)) return null
    return readFileSync(filePath, 'utf-8')
  })

  ipcMain.handle('template:list', async () => {
    return readdirSync(TEMPLATES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
  })

  ipcMain.handle('template:delete', async (_event, name: string) => {
    const filePath = join(TEMPLATES_DIR, `${name}.json`)
    if (existsSync(filePath)) {
      const { unlinkSync } = await import('fs')
      unlinkSync(filePath)
    }
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
      const name = filePath.split('/').pop() || filePath.split('\\').pop() || 'asset'
      return {
        name,
        ext,
        data: `data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${data.toString('base64')}`
      }
    })
  })
}
