import { app, BrowserWindow, ipcMain, screen, session, systemPreferences } from 'electron'
import { join } from 'path'
import { setupIpcHandlers } from './ipc-handlers'

let controlWindow: BrowserWindow | null = null
let outputWindow: BrowserWindow | null = null

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
    fullscreen: !!externalDisplay,
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

  // If no external display, show as a regular window for dev
  if (!externalDisplay) {
    win.setSize(960, 540)
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/output.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/output.html'))
  }

  return win
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

  // Forward engine state from control to output window
  ipcMain.on('engine:state-update', (_event, state) => {
    outputWindow?.webContents.send('engine:state-update', state)
  })

  // Forward audio data from control to output
  ipcMain.on('audio:data', (_event, data) => {
    outputWindow?.webContents.send('audio:data', data)
  })

  // Forward overlay operations from control to output
  ipcMain.on('overlay:add', (_event, data) => {
    outputWindow?.webContents.send('overlay:add', data)
  })
  ipcMain.on('overlay:remove', (_event, id) => {
    outputWindow?.webContents.send('overlay:remove', id)
  })
  ipcMain.on('overlay:update', (_event, id, updates) => {
    outputWindow?.webContents.send('overlay:update', id, updates)
  })

  controlWindow.on('closed', () => {
    controlWindow = null
    outputWindow?.close()
    outputWindow = null
  })

  outputWindow.on('closed', () => {
    outputWindow = null
  })

  // Forward resolution change to output window
  ipcMain.on('output:set-resolution', (_event, w: number, h: number) => {
    outputWindow?.webContents.send('output:set-resolution', w, h)
  })

  // Toggle output fullscreen (simpleFullScreen for instant switch on macOS)
  ipcMain.on('output:toggle-fullscreen', () => {
    if (outputWindow) {
      const current = outputWindow.isFullScreen() || outputWindow.isSimpleFullScreen()
      if (current) {
        outputWindow.setSimpleFullScreen(false)
        outputWindow.setFullScreen(false)
      } else {
        outputWindow.setSimpleFullScreen(true)
      }
    }
  })

  // Get available displays
  ipcMain.handle('displays:list', () => {
    return screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      label: `Display ${i + 1} (${d.size.width}x${d.size.height})`,
      bounds: d.bounds,
      primary: d.bounds.x === 0 && d.bounds.y === 0
    }))
  })

  // Move output to specific display
  ipcMain.on('output:move-to-display', (_event, displayId: number) => {
    const display = screen.getAllDisplays().find(d => d.id === displayId)
    if (display && outputWindow) {
      outputWindow.setBounds(display.bounds)
      outputWindow.setFullScreen(true)
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
