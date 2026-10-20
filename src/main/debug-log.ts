import { app, BrowserWindow, screen, shell, ipcMain } from 'electron'
import { appendFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { appendFile } from 'fs/promises'
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
/** bytes handed to the writer so far — counted here, no stat per line */
let written = 0
const MAX_LINE = 4000
/** lines waiting for the next flush; the show never waits on the disk */
let pending: string[] = []
let flushTimer: NodeJS.Timeout | null = null
const FLUSH_MS = 250

function stamp(): string {
  const d = new Date()
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}

function flush() {
  flushTimer = null
  if (!pending.length) return
  const s = pending.join('')
  pending = []
  appendFile(logFile, s).catch(() => { /* disk full / permissions — never break the show for a log */ })
}

/** Whatever is still buffered, written now (quit, crash) */
function flushSync() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
  if (!pending.length) return
  const s = pending.join('')
  pending = []
  try { appendFileSync(logFile, s) } catch { /* see flush */ }
}

/**
 * Buffered: a renderer in a warning loop (one per frame) used to cost main a
 * stat and a sync append per line, ~240 syscalls a second on the thread that
 * routes the show. Lines are batched and written off-thread every 250ms;
 * `/fatal` lines go straight to disk, and they still go after the 5MB cap —
 * a crash at the end of the night is exactly what the file is for.
 */
export function logLine(tag: string, message: string) {
  if (!logFile) return
  const fatal = tag.endsWith('/fatal')
  if (dropped && !fatal) return
  const line = `${stamp()} [${tag}] ${message.length > MAX_LINE ? message.slice(0, MAX_LINE) + '…' : message}\n`
  written += line.length
  if (written > MAX_BYTES && !dropped) {
    dropped = true
    pending.push(`${stamp()} [log] tetto di ${MAX_BYTES >> 20}MB raggiunto: da qui solo i fatal\n`)
  }
  if (fatal) {
    pending.push(line)
    flushSync()
    return
  }
  pending.push(line)
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS)
}

/** Attach a window's console output (and crashes) to the session log */
export function logWindow(win: BrowserWindow, name: string) {
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    // level: 0 verbose, 1 info, 2 warning, 3 error — keep warnings and up.
    // This is the one place renderer output is recorded: index.ts used to
    // log the same messages again through console.error (twice the I/O).
    if (level < 2) return
    const src = sourceId ? ` (${sourceId.split('/').pop()}:${line})` : ''
    logLine(`${name}/${level >= 3 ? 'error' : 'warn'}`, message + src)
    // in dev the terminal still shows renderer errors, without re-entering the log
    if (level >= 3 && !app.isPackaged) process.stderr.write(`[${name.toUpperCase()} ERROR] ${message}${src}\n`)
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
    // No file (home read-only, disk full): everything below still gets wired.
    // Returning here used to leave the process without uncaughtException and
    // unhandledRejection handlers — a late socket error then closed the app —
    // and `log:path` without a handler. logLine is a no-op with no file.
    logFile = ''
  }

  // main-process console also goes to the file
  for (const level of ['log', 'warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      if (dropped) return   // past the cap: no stringify for nothing
      logLine(`main/${level}`, args.map(a => {
        if (typeof a === 'string') return a
        try { return JSON.stringify(a) } catch { return String(a) }
      }).join(' '))
    }
  }

  process.on('uncaughtException', e => logLine('main/fatal', `uncaught: ${e?.stack || e}`))
  process.on('unhandledRejection', e => logLine('main/fatal', `unhandled rejection: ${e}`))
  app.on('before-quit', flushSync)

  ipcMain.handle('log:path', () => logFile)
  ipcMain.on('log:open', () => { if (logFile) shell.showItemInFolder(logFile) })
  // strings only, a tag that cannot fake a line break; the length cap is in logLine
  ipcMain.on('log:renderer', (_e, tag: unknown, message: unknown) => {
    if (typeof tag !== 'string' || typeof message !== 'string') return
    logLine(tag.replace(/[\r\n]/g, ' ').slice(0, 64), message)
  })

  if (logFile) console.log('[Log] sessione registrata in', logFile)
  else console.warn('[Log] cartella dei log non scrivibile: sessione senza file')
}

export function getLogPath(): string { return logFile }
