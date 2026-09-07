import { app, BrowserWindow, screen, shell, ipcMain } from 'electron'
import { appendFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// Everything that happens in this app used to be invisible once the terminal
// was gone: the output window's errors were not forwarded anywhere, and a
// projector that fails on someone else's machine left no trace to look at.
// This writes one plain-text log per session, so a bug report is a file.

const LOG_DIR = join(homedir(), '.djtographikz', 'logs')
const KEEP_SESSIONS = 10
const MAX_BYTES = 5 * 1024 * 1024

let logFile = ''
let dropped = false

function stamp(): string {
  const d = new Date()
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}

export function logLine(tag: string, message: string) {
  if (!logFile || dropped) return
  try {
    if (statSync(logFile).size > MAX_BYTES) { dropped = true; return }
    appendFileSync(logFile, `${stamp()} [${tag}] ${message}\n`)
  } catch { /* disk full / permissions — never break the show for a log */ }
}

/** Attach a window's console output (and crashes) to the session log */
export function logWindow(win: BrowserWindow, name: string) {
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    // level: 0 verbose, 1 info, 2 warning, 3 error — keep warnings and up
    if (level < 2) return
    const src = sourceId ? ` (${sourceId.split('/').pop()}:${line})` : ''
    logLine(`${name}/${level >= 3 ? 'error' : 'warn'}`, message + src)
  })
  win.webContents.on('render-process-gone', (_e, d) =>
    logLine(`${name}/fatal`, `render process gone: ${d.reason} (exit ${d.exitCode})`))
  win.webContents.on('did-fail-load', (_e, code, desc) =>
    logLine(`${name}/fatal`, `did-fail-load ${code} ${desc}`))
  win.webContents.on('unresponsive', () => logLine(`${name}/warn`, 'window unresponsive'))
}

/** Snapshot of the display topology and where the windows actually sit */
export function logDisplayState(label: string, control: BrowserWindow | null, output: BrowserWindow | null) {
  try {
    const displays = screen.getAllDisplays().map(d => ({
      id: d.id, bounds: d.bounds, scale: d.scaleFactor, internal: (d as any).internal,
      primary: d.id === screen.getPrimaryDisplay().id,
    }))
    logLine('displays', `${label} ${JSON.stringify(displays)}`)
    for (const [name, w] of [['control', control], ['output', output]] as const) {
      if (!w || w.isDestroyed()) { logLine('window', `${name}: assente`); continue }
      const b = w.getBounds()
      logLine('window', `${name}: ${JSON.stringify({
        bounds: b, visible: w.isVisible(), minimized: w.isMinimized(),
        simpleFullScreen: w.isSimpleFullScreen(), fullScreen: w.isFullScreen(),
        onDisplay: screen.getDisplayMatching(b).id,
      })}`)
    }
  } catch (e: any) {
    logLine('displays', `snapshot failed: ${e?.message}`)
  }
}

export function setupDebugLog() {
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    // keep only the last N sessions
    const old = readdirSync(LOG_DIR).filter(f => f.endsWith('.log')).sort()
    for (const f of old.slice(0, Math.max(0, old.length - KEEP_SESSIONS + 1))) {
      try { unlinkSync(join(LOG_DIR, f)) } catch { /* in use */ }
    }
    const d = new Date()
    const name = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}` +
      `-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}.log`
    logFile = join(LOG_DIR, name)
    appendFileSync(logFile, `DJtoGraphikz ${app.getVersion()} — ${process.platform} ${process.arch} — ${d.toISOString()}\n`)
  } catch {
    logFile = ''
    return
  }

  // main-process console also goes to the file
  for (const level of ['log', 'warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      logLine(`main/${level}`, args.map(a => {
        if (typeof a === 'string') return a
        try { return JSON.stringify(a) } catch { return String(a) }
      }).join(' '))
    }
  }

  process.on('uncaughtException', e => logLine('main/fatal', `uncaught: ${e?.stack || e}`))
  process.on('unhandledRejection', e => logLine('main/fatal', `unhandled rejection: ${e}`))

  ipcMain.handle('log:path', () => logFile)
  ipcMain.on('log:open', () => { if (logFile) shell.showItemInFolder(logFile) })
  ipcMain.on('log:renderer', (_e, tag: string, message: string) => logLine(tag, message))

  console.log('[Log] sessione registrata in', logFile)
}

export function getLogPath(): string { return logFile }
