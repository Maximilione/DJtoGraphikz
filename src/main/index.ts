import { app, BrowserWindow, ipcMain, screen, session, systemPreferences } from 'electron'

// Menu/dock/notifications name (the bold macOS menu-bar name in dev still reads
// "Electron" from the dev binary's Info.plist — the packaged app shows this)
app.setName('DJtoGraphikz')
import { join } from 'path'
import { setupIpcHandlers } from './ipc-handlers'
import { setupRemoteServer } from './remote-server'
import { setupOscServer } from './osc-server'
import { setupUpdateCheck } from './update-check'
import { setupArtnet } from './artnet'
import { setupDebugLog, logWindow, logDisplayState, logLine } from './debug-log'

let controlWindow: BrowserWindow | null = null
let outputWindow: BrowserWindow | null = null
let quitting = false

// The display the projector belongs to. Without this the window drifts: macOS
// resolves simpleFullScreen against the CURRENT screen, so toggling fullscreen
// eventually lands the output on the laptop and the projector goes black
// (seen in a session log: display 2 → 1050px → display 1 fullscreen).
let outputDisplayId: number | null = null

function targetDisplay() {
  const all = screen.getAllDisplays()
  return all.find(d => d.id === outputDisplayId)
    ?? all.find(d => d.bounds.x !== 0 || d.bounds.y !== 0)
    ?? screen.getPrimaryDisplay()
}

/** Fullscreen that always resolves against the projector's own display */
/**
 * Full-screen projection WITHOUT macOS fullscreen.
 *
 * Every black-projector report traced back to the fullscreen transition:
 * simpleFullScreen on a frameless window on a secondary display gives macOS a
 * window it may put on another Space, resize against the wrong screen, or stop
 * compositing — while the renderer happily keeps painting (the session logs
 * show frames advancing the whole time).
 *
 * A borderless window sized to the display and raised above the menu bar looks
 * identical on the projector and has none of that machinery.
 */
function setOutputFullscreen(win: BrowserWindow, on: boolean) {
  const d = targetDisplay()
  outputDisplayId = d.id
  // never leave a stale macOS fullscreen state behind (older versions set it)
  if (win.isSimpleFullScreen()) win.setSimpleFullScreen(false)
  if (win.isFullScreen()) win.setFullScreen(false)

  if (on) {
    win.setAlwaysOnTop(true, 'screen-saver')   // covers menu bar and Dock
    try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }) } catch { /* not macOS */ }
    if (!win.isVisible()) win.showInactive()   // never re-show: that flashes
    // A normal-level window cannot sit under the menu bar, so at creation macOS
    // shrinks it (1080 -> 1050) and the projector keeps a strip of desktop on
    // top. Once the window is at screen-saver level it can cover the whole
    // display — but the level change needs a beat to take effect, so assert the
    // bounds again shortly after. Only when they actually differ: every
    // setBounds repaints the background black until the renderer presents,
    // which is the "flash then black" people report.
    const assertBounds = () => {
      if (win.isDestroyed()) return
      const b = win.getBounds()
      if (b.x !== d.bounds.x || b.y !== d.bounds.y ||
          b.width !== d.bounds.width || b.height !== d.bounds.height) {
        win.setBounds(d.bounds)
      }
    }
    assertBounds()
    setTimeout(assertBounds, 120)
    setTimeout(() => {
      assertBounds()
      logLine('output', `bounds finali ${JSON.stringify(win.getBounds())}`)
    }, 500)
  } else {
    win.setAlwaysOnTop(false)
    const w = Math.round(d.bounds.width * 0.6)
    const h = Math.round(d.bounds.height * 0.6)
    win.setBounds({ x: d.bounds.x + 40, y: d.bounds.y + 40, width: w, height: h })
  }
  logLine('output', `proiezione=${on} su display ${d.id} ${JSON.stringify(win.getBounds())}`)
}

/** Put the projector back if it wandered off its display */
function keepOutputOnItsDisplay() {
  const win = outputWindow
  if (!win || win.isDestroyed() || outputDisplayId === null) return
  const current = screen.getDisplayMatching(win.getBounds()).id
  if (current === outputDisplayId) return
  const d = screen.getAllDisplays().find(x => x.id === outputDisplayId)
  if (!d) return                     // that screen is gone: leave it alone
  logLine('output', `finestra finita sul display ${current}, riportata su ${d.id}`)
  setOutputFullscreen(win, win.isAlwaysOnTop())
}

// Cached for output-window replay: a late-loading or recreated output window
// gets the latest engine state + overlays instead of defaults.
let lastEngineState: unknown = null
const overlays = new Map<string, Record<string, unknown>>()

function createControlWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'DJtoGraphikz',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    }
  })
  // Keep audio/rendering alive when control window loses focus
  win.webContents.setBackgroundThrottling(false)

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Open DevTools in dev mode
  if (process.env.ELECTRON_RENDERER_URL) {
    win.webContents.openDevTools({ mode: 'bottom' })
  }

  // Log renderer errors
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[RENDERER ERROR] ${message} (${sourceId}:${line})`)
  })
  logWindow(win, 'control')

  return win
}

function createOutputWindow(): BrowserWindow {
  // Try to find a secondary display for the projector
  const displays = screen.getAllDisplays()
  const externalDisplay = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0)

  const bounds = externalDisplay
    ? externalDisplay.bounds
    : { x: 100, y: 100, width: 1920, height: 1080 }

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    // Borderless window sized to the projector: no macOS fullscreen anywhere in
    // this app, so there is no transition that can strand or freeze the surface
    frame: false,
    backgroundColor: '#000000',
    paintWhenInitiallyHidden: true,
    // macOS reserves the menu-bar strip on every display, shrinking the window
    // to 1050 of 1080 and leaving desktop visible at the top of the projection
    enableLargerThanScreen: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    }
  })
  // Prevent throttling when output window loses focus (critical for dual-window VJ)
  win.webContents.setBackgroundThrottling(false)

  // macOS gives each display its own Space: a projector window that lands on a
  // Space the monitor isn't showing looks exactly like "second screen black",
  // while the window still reports itself visible. Pin it everywhere.
  try {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } catch { /* not macOS */ }

  // If no external display, show as a regular window for dev.
  // We still wait for the first painted frame before raising the window, so the
  // projector never gets presented while it has nothing to show.
  if (!externalDisplay) {
    win.setSize(960, 540)
  } else {
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return
      outputDisplayId = externalDisplay.id
      // Going fullscreen before the renderer has painted its first frame is
      // exactly when the projector comes up black: the macOS fullscreen
      // transition catches a window that is not compositing yet. Wait for the
      // output renderer to report a real frame (with a safety timeout).
      let entered = false
      const goFullscreen = () => {
        if (entered || win.isDestroyed()) return
        entered = true
        setOutputFullscreen(win, true)
      }
      ipcMain.once('output:painted', goFullscreen)
      setTimeout(goFullscreen, 2500)
    })
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/output.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/output.html'))
  }

  // Output renderer errors were invisible until now: without this, a broken
  // projector window fails silently and looks like "black screen"
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[OUTPUT ERROR] ${message} (${sourceId}:${line})`)
  })
  logWindow(win, 'output')

  // Initial-state handshake: replay cached engine state + overlays so the
  // projector never sits on defaults (output-main.ts subscribes at load)
  win.webContents.on('did-finish-load', () => {
    logDisplayState('output caricata', controlWindow, win)
    if (lastEngineState) win.webContents.send('engine:state-update', lastEngineState)
    for (const data of overlays.values()) win.webContents.send('overlay:add', data)
  })

  // Auto-recreate if the output renderer crashes mid-set
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[Main] output renderer gone:', details.reason)
    if (outputWindow === win) outputWindow = null
    win.destroy()
    if (!quitting && controlWindow) outputWindow = createOutputWindow()
  })

  win.on('closed', () => {
    if (outputWindow === win) outputWindow = null
    notifyOutputChanged()
  })

  notifyOutputChanged()
  return win
}

// Control window keeps a status chip in sync (U1.3)
function notifyOutputChanged() {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('output:changed')
  }
}

// Single instance: recreate on demand if the user closed it
function ensureOutputWindow(): BrowserWindow {
  if (!outputWindow || outputWindow.isDestroyed()) outputWindow = createOutputWindow()
  return outputWindow
}

app.whenReady().then(async () => {
  setupDebugLog()

  // Self-test hook (DJG_SELFTEST=<file>): grabs what the projector is actually
  // painting and quits. Used by scripts/check-output.py as a release gate —
  // logs and frame counters proved not to be enough on their own.
  if (process.env.DJG_SELFTEST) {
    ipcMain.on('selftest:data', async (_e, buf: ArrayBuffer) => {
      try {
        const { writeFileSync } = await import('fs')
        writeFileSync(process.env.DJG_SELFTEST!, Buffer.from(buf))
        console.log('[SelfTest] frame del proiettore salvato:', buf.byteLength, 'byte')
      } catch (err) { console.error('[SelfTest] salvataggio fallito:', err) }
      setTimeout(() => app.quit(), 300)
    })
    setTimeout(() => {
      if (outputWindow && !outputWindow.isDestroyed()) outputWindow.webContents.send('selftest:shot')
      else { console.error('[SelfTest] nessuna finestra output'); app.quit() }
    }, 14000)
    setTimeout(() => { console.error('[SelfTest] timeout'); app.quit() }, 25000)
  }
  // On macOS, request microphone access at OS level before anything else
  if (process.platform === 'darwin') {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone')
    console.log('[Main] macOS microphone access status:', micStatus)
    if (micStatus !== 'granted') {
      const granted = await systemPreferences.askForMediaAccess('microphone')
      console.log('[Main] macOS microphone permission granted:', granted)
    }
  }

  // Grant microphone/audio permissions automatically in Electron
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem', 'audioCapture']
    callback(allowed.includes(permission))
  })

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ['media', 'mediaKeySystem', 'audioCapture']
    return allowed.includes(permission)
  })

  controlWindow = createControlWindow()
  outputWindow = createOutputWindow()

  logDisplayState('avvio', controlWindow, outputWindow)
  screen.on('display-added', () => logDisplayState('display collegato', controlWindow, outputWindow))
  screen.on('display-removed', () => logDisplayState('display scollegato', controlWindow, outputWindow))
  screen.on('display-metrics-changed', () => {
    logDisplayState('display cambiato', controlWindow, outputWindow)
    keepOutputOnItsDisplay()
  })
  // periodic guard: nothing else notices when macOS relocates the window
  setInterval(keepOutputOnItsDisplay, 4000)

  setupIpcHandlers(controlWindow, outputWindow)
  setupRemoteServer(controlWindow)
  setupOscServer(controlWindow)
  setupUpdateCheck(() => controlWindow)
  setupArtnet()

  // Forward engine state from control to output window (cache for replay)
  ipcMain.on('engine:state-update', (_event, state) => {
    lastEngineState = state
    outputWindow?.webContents.send('engine:state-update', state)
  })

  // Forward audio data from control to output
  ipcMain.on('audio:data', (_event, data) => {
    outputWindow?.webContents.send('audio:data', data)
  })

  // Forward overlay operations from control to output (cache descriptors for replay)
  ipcMain.on('overlay:add', (_event, data) => {
    if (data?.id) overlays.set(data.id, data)
    outputWindow?.webContents.send('overlay:add', data)
  })
  ipcMain.on('overlay:remove', (_event, id) => {
    overlays.delete(id)
    outputWindow?.webContents.send('overlay:remove', id)
  })
  ipcMain.on('overlay:update', (_event, id, updates) => {
    const cached = overlays.get(id)
    if (cached) Object.assign(cached, updates)
    outputWindow?.webContents.send('overlay:update', id, updates)
  })

  controlWindow.on('closed', () => {
    controlWindow = null
    outputWindow?.close()
    outputWindow = null
  })

  // Forward resolution change to output window
  ipcMain.on('output:set-resolution', (_event, w: number, h: number) => {
    ensureOutputWindow().webContents.send('output:set-resolution', w, h)
  })

  // Toggle output fullscreen. simpleFullScreen ONLY — it's instant on macOS and,
  // unlike the native one, doesn't fight the window state when toggled fast.
  ipcMain.on('output:toggle-fullscreen', () => {
    const win = ensureOutputWindow()
    setOutputFullscreen(win, !win.isAlwaysOnTop())
  })

  // Output window status for the control-window chip (U1.3)
  ipcMain.handle('output:info', () => {
    const win = outputWindow
    if (!win || win.isDestroyed()) return { open: false, fullscreen: false, display: '' }
    const d = screen.getDisplayMatching(win.getBounds())
    const idx = screen.getAllDisplays().findIndex(x => x.id === d.id)
    return {
      open: true,
      fullscreen: win.isAlwaysOnTop(),
      display: d.label || `Display ${idx + 1}`,
    }
  })

  ipcMain.on('output:reopen', () => { ensureOutputWindow() })

  // Get available displays
  ipcMain.handle('displays:list', () => {
    return screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      label: `Display ${i + 1} (${d.size.width}x${d.size.height})`,
      bounds: d.bounds,
      primary: d.bounds.x === 0 && d.bounds.y === 0
    }))
  })

  // Move output to specific display (exit fullscreen first: setBounds is a
  // no-op while fullscreen, the window would "move" to the same display)
  ipcMain.on('output:move-to-display', (_event, displayId: number) => {
    const display = screen.getAllDisplays().find(d => d.id === displayId)
    if (display) {
      outputDisplayId = display.id
      setOutputFullscreen(ensureOutputWindow(), true)
    }
  })
})

app.on('before-quit', () => { quitting = true })

app.on('window-all-closed', () => {
  app.quit()
})
