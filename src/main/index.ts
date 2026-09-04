import { app, BrowserWindow, ipcMain, screen, session, systemPreferences } from 'electron'

// Menu/dock/notifications name (the bold macOS menu-bar name in dev still reads
// "Electron" from the dev binary's Info.plist — the packaged app shows this)
app.setName('DJtoGraphikz')
import { join } from 'path'
import { setupIpcHandlers } from './ipc-handlers'
import { setupRemoteServer } from './remote-server'
import { setupOscServer } from './osc-server'

let controlWindow: BrowserWindow | null = null
let outputWindow: BrowserWindow | null = null
let quitting = false

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
    // Fullscreen is applied AFTER creation via simpleFullScreen — mixing native
    // fullscreen (here) with the simple one (toggle) breaks the window on macOS
    frame: false,
    backgroundColor: '#000000',
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    }
  })
  // Prevent throttling when output window loses focus (critical for dual-window VJ)
  win.webContents.setBackgroundThrottling(false)

  // If no external display, show as a regular window for dev.
  // Fullscreen waits for ready-to-show: applying simpleFullScreen on a window
  // that isn't laid out yet leaves it OFF-CENTER on macOS (bounds half-applied)
  if (!externalDisplay) {
    win.setSize(960, 540)
  } else {
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return
      win.setBounds(externalDisplay.bounds)
      win.setSimpleFullScreen(true)
    })
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/output.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/output.html'))
  }

  // Initial-state handshake: replay cached engine state + overlays so the
  // projector never sits on defaults (output-main.ts subscribes at load)
  win.webContents.on('did-finish-load', () => {
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

  setupIpcHandlers(controlWindow, outputWindow)
  setupRemoteServer(controlWindow)
  setupOscServer(controlWindow)

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
    if (win.isSimpleFullScreen() || win.isFullScreen()) {
      win.setSimpleFullScreen(false)
      if (win.isFullScreen()) win.setFullScreen(false) // legacy native state
    } else {
      win.setSimpleFullScreen(true)
    }
  })

  // Output window status for the control-window chip (U1.3)
  ipcMain.handle('output:info', () => {
    const win = outputWindow
    if (!win || win.isDestroyed()) return { open: false, fullscreen: false, display: '' }
    const d = screen.getDisplayMatching(win.getBounds())
    const idx = screen.getAllDisplays().findIndex(x => x.id === d.id)
    return {
      open: true,
      fullscreen: win.isFullScreen() || win.isSimpleFullScreen(),
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
      const win = ensureOutputWindow()
      win.setSimpleFullScreen(false)
      if (win.isFullScreen()) win.setFullScreen(false)
      win.setBounds(display.bounds)
      win.setSimpleFullScreen(true)
    }
  })
})

app.on('before-quit', () => { quitting = true })

app.on('window-all-closed', () => {
  app.quit()
})
