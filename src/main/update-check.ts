import { app, net, shell, ipcMain, BrowserWindow } from 'electron'

// ponytail: notification-only updates. Unsigned builds can't self-install on
// macOS anyway (signature validation), so the honest flow everywhere is:
// check GitHub → toast "nuova versione" → click apre la pagina release.

const RELEASES_API = 'https://api.github.com/repos/Maximilione/DJtoGraphikz/releases/latest'
const RELEASES_PAGE = 'https://github.com/Maximilione/DJtoGraphikz/releases/latest'
const CHECK_EVERY_MS = 6 * 3600_000

/** "v0.22.1-beta" → [0, 22, 1] for comparison */
function parseVer(v: string): number[] {
  const m = v.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/)
  return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0]
}

function isNewer(remote: string, local: string): boolean {
  const r = parseVer(remote)
  const l = parseVer(local)
  for (let i = 0; i < 3; i++) {
    if (r[i] > l[i]) return true
    if (r[i] < l[i]) return false
  }
  return false
}

export function setupUpdateCheck(getControlWindow: () => BrowserWindow | null) {
  // dev builds run from source — checking would only nag (DJG_FORCE_UPDATE_CHECK for testing)
  if (!app.isPackaged && !process.env.DJG_FORCE_UPDATE_CHECK) return

  let notified = ''

  const check = async () => {
    try {
      const res = await net.fetch(RELEASES_API, { headers: { 'User-Agent': 'DJtoGraphikz' } })
      if (!res.ok) return
      const rel = await res.json() as { tag_name?: string }
      const tag = rel.tag_name || ''
      if (!tag || tag === notified || !isNewer(tag, app.getVersion())) return
      notified = tag
      const win = getControlWindow()
      if (win && !win.isDestroyed()) win.webContents.send('update:available', { version: tag })
      console.log('[Update] nuova versione disponibile:', tag)
    } catch { /* offline in a club — retry at the next interval */ }
  }

  ipcMain.on('update:open', () => { shell.openExternal(RELEASES_PAGE) })

  setTimeout(check, 15_000) // not during boot jank
  setInterval(check, CHECK_EVERY_MS)
}
