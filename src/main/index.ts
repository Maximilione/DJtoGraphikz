import { app, BrowserWindow, dialog, ipcMain, net, powerSaveBlocker, protocol, screen, session, systemPreferences } from 'electron'
import { writeFileSync } from 'fs'

// Menu/dock/notifications name (the bold macOS menu-bar name in dev still reads
// "Electron" from the dev binary's Info.plist — the packaged app shows this)
app.setName('DJtoGraphikz')

// Chromium suspends an AudioContext created without a click, and a suspended
// context feeds the analyser silence while the media element happily plays on
// — which reads exactly like "the beat detection is broken". Nothing here is a
// web page that should be quiet until asked: the projector is the product.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
import { join } from 'path'
import { pathToFileURL } from 'url'
import { setupIpcHandlers } from './ipc-handlers'
import { publishOutput, setupRemoteServer } from './remote-server'
import { setupOscServer } from './osc-server'
import { setupProDjLink } from './prodjlink'
import { setupUpdateCheck } from './update-check'
import { setupArtnet } from './artnet'
import { setupDebugLog, logWindow, logDisplayState, logLine } from './debug-log'
import { VIDEO_RE, SEQ_RE, IMAGE_RE } from '../shared/mediaFormats'

let controlWindow: BrowserWindow | null = null
let quitting = false

// One instance. A second double-click on the icon used to open a second
// analyser, a second projector on the same display and a remote server on the
// next port, while the phone stayed paired to the first. The release gate and
// the parallel smoke-test instances (DJG_VITE_PORT) are the exception.
// app.quit() before ready does not stop whenReady from firing: the second
// instance checks this there and builds nothing (no window, no socket).
const primaryInstance = !!process.env.DJG_SELFTEST || !!process.env.DJG_VITE_PORT || app.requestSingleInstanceLock()
if (!primaryInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (controlWindow && !controlWindow.isDestroyed()) {
      if (controlWindow.isMinimized()) controlWindow.restore()
      controlWindow.focus()
    }
  })
}

// Windows may stop presenting a window another one covers (the DJ software over
// the console), and backgroundThrottling:false does not cover occlusion on
// every version. The control window is where audio:data for the projector is made.
if (process.platform === 'win32') app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')

/**
 * One show, many walls.
 *
 * An output is a window on a display plus the part of the composition it
 * presents. The engine state travels to every output unchanged — it is the
 * show — while this is about the room: which screen, at what resolution, which
 * rectangle of the canvas, and how hard to drive it (a LED wall crushes blacks
 * and runs hot at full white).
 *
 * Plain JSON: it crosses to the renderer as-is, so the shape is declared again
 * in `src/renderer/outputs.ts`, the way every other IPC contract here is.
 */
interface OutputCfg {
  displayId: number | null
  width: number
  height: number
  /** x,y,w,h in 0..1 of the composition, y from the bottom (uv) */
  src: [number, number, number, number]
  gamma: number
  brightness: number
  /** TL,TR,BR,BL as x,y — this wall's own projection mapping */
  keystone: number[]
}

const DEFAULT_CFG: OutputCfg = {
  displayId: null, width: 1920, height: 1080, src: [0, 0, 1, 1], gamma: 1, brightness: 1,
  keystone: [0, 0, 1, 0, 1, 1, 0, 1],
}

interface Output {
  id: number
  win: BrowserWindow
  cfg: OutputCfg
  /**
   * The display this output belongs to. Per output and not global: with one
   * projector a global was enough, with two the second one inherited the
   * first one's screen and both landed on the same wall.
   */
  displayId: number | null
}

/** id 1 is the projector every existing feature (and the release gate) means. */
const PRIMARY = 1
const outputs = new Map<number, Output>()

function primaryOutput(): Output | null {
  const o = outputs.get(PRIMARY)
  return o && !o.win.isDestroyed() ? o : null
}

function liveOutputs(): Output[] {
  return [...outputs.values()].filter(o => !o.win.isDestroyed())
}

/** Every output gets the show. Replaces the single `outputWindow?.send`. */
function broadcastOutputs(channel: string, ...args: unknown[]) {
  // 30Hz path (audio + state): iterate in place, no array per call
  for (const o of outputs.values()) if (!o.win.isDestroyed()) o.win.webContents.send(channel, ...args)
  // OBS / browsers on the LAN: same channels, same args, over SSE (I2)
  publishOutput(channel, ...args)
}

/**
 * What an output needs before its first frame: its slice, its resolution, the
 * last state and every overlay. Same for a window on did-finish-load and for a
 * browser that connects mid-set — one function, or the two drift.
 */
function replayShow(send: (channel: string, ...args: unknown[]) => void, cfg: OutputCfg) {
  // Its own slice first: an output that gets the show before it knows which
  // part of it to present shows the whole canvas for a frame.
  send('output:slice', cfg)
  send('output:set-resolution', cfg.width, cfg.height)
  if (lastEngineState) send('engine:state-update', lastEngineState)
  for (const data of overlays.values()) send('overlay:add', data)
}

// The display an output belongs to. Without this the window drifts: macOS
// resolves simpleFullScreen against the CURRENT screen, so toggling fullscreen
// eventually lands the output on the laptop and the projector goes black
// (seen in a session log: display 2 → 1050px → display 1 fullscreen).
function targetDisplay(o: Output) {
  const all = screen.getAllDisplays()
  return all.find(d => d.id === o.displayId)
    ?? all.find(d => d.id === o.cfg.displayId)
    ?? all.find(d => d.bounds.x !== 0 || d.bounds.y !== 0)
    ?? screen.getPrimaryDisplay()
}

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
function setOutputFullscreen(o: Output, on: boolean) {
  const win = o.win
  const d = targetDisplay(o)
  o.displayId = d.id
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
      // closed or recreated within 500ms: getBounds on a destroyed window
      // throws, and that landed in the log as a false main/fatal
      if (win.isDestroyed()) return
      assertBounds()
      logLine('output', `bounds finali ${JSON.stringify(win.getBounds())}`)
    }, 500)
  } else {
    win.setAlwaysOnTop(false)
    const w = Math.round(d.bounds.width * 0.6)
    const h = Math.round(d.bounds.height * 0.6)
    win.setBounds({ x: d.bounds.x + 40, y: d.bounds.y + 40, width: w, height: h })
  }
  logLine('output', `uscita ${o.id}: proiezione=${on} su display ${d.id} ${JSON.stringify(win.getBounds())}`)
}

/** Put each projector back if it wandered off its display */
function keepOutputOnItsDisplay() {
  for (const o of liveOutputs()) {
    if (o.displayId === null) continue
    const current = screen.getDisplayMatching(o.win.getBounds()).id
    if (current === o.displayId) continue
    const d = screen.getAllDisplays().find(x => x.id === o.displayId)
    if (!d) continue                   // that screen is gone: leave it alone
    logLine('output', `uscita ${o.id} finita sul display ${current}, riportata su ${d.id}`)
    setOutputFullscreen(o, o.win.isAlwaysOnTop())
  }
}

// Cached for output-window replay: a late-loading or recreated output window
// gets the latest engine state + overlays instead of defaults.
let lastEngineState: unknown = null
const overlays = new Map<string, Record<string, unknown>>()

/** Renderer crash times per output id, for the recreate backoff */
const crashTimes = new Map<number, number[]>()
const CRASH_WINDOW_MS = 60_000
const CRASH_MAX = 4

/**
 * The release gate (scripts/check-output.py) launches the whole app. On the
 * machine someone is working on that meant windows jumping in front of them
 * and stealing the keyboard, several times per release — so under the self-test
 * every window comes up without focus and the app stays out of the Dock.
 */
const SELFTEST = !!process.env.DJG_SELFTEST

/**
 * Headless-ish tests: under the self-test every window is fully transparent,
 * click-through and unfocusable, so a 5-minute sweep no longer takes over a
 * screen. It stays on screen to the compositor (real GPU frames, no
 * occlusion throttling), the user just cannot see or touch it.
 * DJG_VISIBLE=1 brings the windows back for debugging.
 */
function ghost(win: BrowserWindow): void {
  if (!SELFTEST || process.env.DJG_VISIBLE === '1') return
  win.setOpacity(0)
  win.setIgnoreMouseEvents(true)
  win.setFocusable(false)
}

function createControlWindow(): BrowserWindow {
  // Open almost full screen on the display the user is on (work area: below the
  // menu bar and above the Dock). Not macOS fullscreen: no Space transition.
  // Under the self-test the old fixed size stays, the captures depend on it.
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const win = new BrowserWindow({
    ...(SELFTEST
      ? { width: 1280, height: 800 }
      : { x: wa.x, y: wa.y, width: wa.width, height: wa.height }),
    minWidth: 900,
    minHeight: 600,
    title: 'DJtoGraphikz',
    backgroundColor: '#0a0a0a',
    show: false,          // shown below: focused normally, inactive under test
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Keep audio/rendering alive when the control window loses focus
      backgroundThrottling: false,
    }
  })
  ghost(win)
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return
    if (SELFTEST) win.showInactive()
    else win.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Open DevTools in dev mode
  if (process.env.ELECTRON_RENDERER_URL) {
    win.webContents.openDevTools({ mode: 'bottom' })
  }

  // Renderer warnings and errors: session log (and the terminal in dev)
  logWindow(win, 'control')

  // The control renderer makes audio:data and the state for every projector,
  // and runs the Auto VJ, MIDI and DMX: when it died, the walls froze on the
  // last frame until someone restarted the app mid-set. A reload brings it
  // back in a second or two (the look comes from the saved settings, the
  // outputs keep going on main's last state meanwhile). Repeats back off and
  // give up after a few in a minute, so a renderer that dies on load does not
  // spin.
  let reloads: number[] = []
  win.webContents.on('render-process-gone', (_e, d) => {
    if (quitting || d.reason === 'clean-exit' || win.isDestroyed()) return
    const now = Date.now()
    reloads = [...reloads.filter(t => now - t < 60_000), now]
    if (reloads.length > 3) {
      console.error(`[Main] control renderer: ${reloads.length} crash in 60s, non lo ricarico (${d.reason})`)
      return
    }
    console.error(`[Main] control renderer gone (${d.reason}), ricarico tra ${500 * reloads.length}ms`)
    setTimeout(() => { if (!quitting && !win.isDestroyed()) win.webContents.reload() }, 500 * reloads.length)
  })

  return win
}

function createOutputWindow(id: number, cfg: OutputCfg): Output {
  // The configured display wins; otherwise fall back to the old heuristic
  // (first screen that is not the laptop) so a first run still finds the
  // projector on its own.
  const displays = screen.getAllDisplays()
  const externalDisplay = displays.find(d => d.id === cfg.displayId)
    ?? displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0)

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
      // Never throttle the projector when it has no focus (it never has)
      backgroundThrottling: false,
    }
  })
  ghost(win)

  const out: Output = { id, win, cfg, displayId: externalDisplay?.id ?? null }
  outputs.set(id, out)

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
      out.displayId = externalDisplay.id
      // Going fullscreen before the renderer has painted its first frame is
      // exactly when the projector comes up black: the macOS fullscreen
      // transition catches a window that is not compositing yet. Wait for the
      // output renderer to report a real frame (with a safety timeout).
      // Whatever ends the wait — paint, timeout or the window dying first —
      // removes the listener and the timer: a window that died before its
      // first paint used to leave its listener on ipcMain for good, one more
      // per recreation, each run again on every later 'output:painted'.
      let entered = false
      let timer: NodeJS.Timeout | null = null
      const cleanup = () => {
        ipcMain.removeListener('output:painted', onPainted)
        if (timer) { clearTimeout(timer); timer = null }
      }
      const goFullscreen = () => {
        cleanup()
        if (entered || win.isDestroyed()) return
        entered = true
        setOutputFullscreen(out, true)
      }
      // `once` would be consumed by whichever output painted first, leaving the
      // others waiting on the 2.5s timeout — so match on the sender instead.
      const onPainted = (e: Electron.IpcMainEvent) => {
        if (!win.isDestroyed() && e.sender === win.webContents) goFullscreen()
      }
      ipcMain.on('output:painted', onPainted)
      timer = setTimeout(goFullscreen, 2500)
      win.once('closed', cleanup)
    })
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/output.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/output.html'))
  }

  // Output renderer errors were invisible until now: without this, a broken
  // projector window fails silently and looks like "black screen"
  logWindow(win, 'output')

  // Initial-state handshake: replay cached engine state + overlays so the
  // projector never sits on defaults (output-main.ts subscribes at load)
  win.webContents.on('did-finish-load', () => {
    logDisplayState('output caricata', controlWindow, win)
    replayShow((channel, ...args) => win.webContents.send(channel, ...args), out.cfg)
  })

  // Auto-recreate if the output renderer crashes mid-set. The first crash
  // comes back at once, as before; a renderer that dies while loading (OOM,
  // GPU driver, broken bundle) would otherwise spin create→crash→create at
  // full CPU and GPU, so repeats back off and stop after a few in a minute.
  // 'Riapri uscita' (output:reopen) is the retry.
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error(`[Main] output ${id} renderer gone:`, details.reason)
    if (outputs.get(id) === out) outputs.delete(id)
    win.destroy()
    if (quitting || !controlWindow) return
    const now = Date.now()
    const recent = [...(crashTimes.get(id) ?? []).filter(t => now - t < CRASH_WINDOW_MS), now]
    crashTimes.set(id, recent)
    if (recent.length > CRASH_MAX) {
      logLine('output/fatal', `uscita ${id}: ${recent.length} crash in ${CRASH_WINDOW_MS / 1000}s, non la ricreo (Riapri uscita per riprovare)`)
      notifyOutputChanged()
      return
    }
    const delay = (recent.length - 1) * 1000
    // Same id and same config: a crashed second wall comes back as itself,
    // on the display it was actually on.
    const recreate = () => {
      if (!quitting && controlWindow && !outputs.has(id)) {
        createOutputWindow(id, { ...out.cfg, displayId: out.displayId ?? out.cfg.displayId })
      }
    }
    if (delay === 0) recreate()
    else setTimeout(recreate, delay)
  })

  win.on('closed', () => {
    if (outputs.get(id) === out) outputs.delete(id)
    notifyOutputChanged()
  })

  notifyOutputChanged()
  return out
}

/**
 * The renderer owns the list and hands it over whole; main makes the windows
 * match it. One door instead of add/remove/update, so a half-applied change
 * cannot leave a window nobody is tracking.
 */
function reconcileOutputs(list: OutputCfg[]) {
  const wanted = list.length ? list : [DEFAULT_CFG]
  // Close the extra ones first: the display one of them frees may be claimed
  // by an output below.
  for (const [id, o] of [...outputs]) {
    if (id > wanted.length) {
      outputs.delete(id)
      if (!o.win.isDestroyed()) o.win.destroy()
    }
  }
  wanted.forEach((cfg, i) => {
    const id = i + 1
    const o = outputs.get(id)
    if (!o || o.win.isDestroyed()) { createOutputWindow(id, cfg); return }
    const moved = cfg.displayId !== null && cfg.displayId !== o.displayId
    const prev = o.cfg
    o.cfg = cfg
    o.win.webContents.send('output:slice', cfg)
    // a resize only when the size changed: the renderer sends the whole list
    // on every keystone or trim tick, and each one used to resize every window
    if (!prev || prev.width !== cfg.width || prev.height !== cfg.height) {
      o.win.webContents.send('output:set-resolution', cfg.width, cfg.height)
    }
    if (moved) setOutputFullscreen(o, true)
  })
  notifyOutputChanged()
}

// Control window keeps a status chip in sync (U1.3)
function notifyOutputChanged() {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('output:changed')
  }
}

// Recreate the projector on demand if the user closed it
function ensureOutputWindow(): Output {
  return primaryOutput() ?? createOutputWindow(PRIMARY, outputs.get(PRIMARY)?.cfg ?? DEFAULT_CFG)
}

/**
 * Video overlays stream from disk instead of being read into a Blob. Both
 * windows create their own <video> from the same path, so reading the file
 * meant two full copies in RAM — a 1GB clip took the renderer down mid-set.
 * Must be declared before the app is ready.
 * ponytail: no narrower guard than the video extension — the renderer can
 * already read any path through `asset:read-file`, so this adds no reach.
 */
protocol.registerSchemesAsPrivileged([{
  scheme: 'djg-media',
  privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true },
}])

const VIDEO_EXT = VIDEO_RE
/** The dry-run audio the gate feeds the analyser; same door as video. */
const AUDIO_EXT = /\.(wav|mp3|m4a|aac|ogg|flac)$/i

app.whenReady().then(async () => {
  if (!primaryInstance) return
  setupDebugLog()

  // Under the release gate: no Dock icon, no app switch. Launching normally
  // makes macOS bring the app to the front and take the keyboard away from
  // whoever is working on this machine.
  if (SELFTEST) app.dock?.hide()

  // A clip moved away or on a USB stick that was unplugged: every Range
  // request of the <video> rejected here as an unhandled error, now a 404
  protocol.handle('djg-media', async req => {
    try {
      const path = new URL(req.url).searchParams.get('p')
      // images too: the library thumbnails, which used to cross IPC whole
      if (!path || !(VIDEO_EXT.test(path) || AUDIO_EXT.test(path) || SEQ_RE.test(path) || IMAGE_RE.test(path))) return new Response('', { status: 400 })
      return await net.fetch(pathToFileURL(path).toString())
    } catch {
      return new Response('', { status: 404 })
    }
  })

  // Self-test hook (DJG_SELFTEST=<file>): grabs what the projector is actually
  // painting and quits. Used by scripts/check-output.py as a release gate —
  // logs and frame counters proved not to be enough on their own.
  if (process.env.DJG_SELFTEST) {
    ipcMain.on('selftest:data', async (_e, buf: ArrayBuffer) => {
      try {
        // static import: the main process is V8 bytecode, and a vm-compiled
        // script has no dynamic import() (ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING)
        writeFileSync(process.env.DJG_SELFTEST!, Buffer.from(buf))
        console.log('[SelfTest] frame del proiettore salvato:', buf.byteLength, 'byte')
        // The projector shot says the engine is alive; it says nothing about
        // the control window, which is where a CSS refactor breaks. capturePage
        // reads the window's own compositor, so it needs no screen-recording
        // permission and does not care what is on top of it.
        if (process.env.DJG_SELFTEST_UI && controlWindow && !controlWindow.isDestroyed()) {
          // Grow it first: capturePage only sees the viewport, and the sidebars
          // scroll — a screenful shows a third of the surface under review.
          const [w, h] = controlWindow.getContentSize()
          controlWindow.setContentSize(1400, 2000)   // macOS clamps to the screen
          // …so zoom out too: at 0.5 the viewport holds twice the CSS pixels,
          // which is what it takes to see a whole sidebar at once.
          controlWindow.webContents.setZoomFactor(Number(process.env.DJG_SELFTEST_UI_ZOOM) || 0.5)
          await new Promise(r => setTimeout(r, 500))
          const shot = await controlWindow.webContents.capturePage()
          writeFileSync(process.env.DJG_SELFTEST_UI, shot.toPNG())
          controlWindow.webContents.setZoomFactor(1)
          controlWindow.setContentSize(w, h)
          console.log('[SelfTest] finestra di controllo salvata')
          // How many controls does each mode actually put on screen? The audit
          // counted them by hand once (173 / 125 / 47); counting them in the
          // live DOM is the only way to know whether the redesign moved them.
          // It clicks through the three modes and puts the starting one back.
          if (process.env.DJG_SELFTEST_COUNT) {
            const counts = await controlWindow.webContents.executeJavaScript(`(async () => {
              const SEL = 'button, select, input, textarea, a[href], [role="button"]'
              const modes = [...document.querySelectorAll('button')]
                .filter(b => ['SIMPLE', 'PRO', 'LIVE'].includes(b.textContent.trim()))
              // Clicking a mode persists it. Put the stored value back, or the
              // count leaves the app in whatever mode happened to be last.
              const KEY = 'djtographikz-ui-mode'
              const before = localStorage.getItem(KEY)
              const out = {}
              for (const m of modes) {
                m.click()
                await new Promise(r => setTimeout(r, 400))
                out[m.textContent.trim()] = document.querySelectorAll(SEL).length
              }
              if (before === null) localStorage.removeItem(KEY)
              else localStorage.setItem(KEY, before)
              return out
            })()`)
            console.log('[SelfTest] controlli per modalita\':', JSON.stringify(counts))
          }
        }
      } catch (err) { console.error('[SelfTest] salvataggio fallito:', err) }
      setTimeout(() => app.quit(), 300)
    })
    // Count from the moment the projector actually paints, not from app start:
    // the macOS microphone prompt can eat ten seconds before any window opens,
    // and the shot then landed before the output window had lived long enough
    // to log a single 5s heartbeat — which the gate reads as a failure.
    // A dry run (DJG_SELFTEST_AUDIO) needs the analyser to have heard enough
    // of the file before anyone reads the tempo off it — the BPM library alone
    // wants ten seconds to stabilise.
    const settleMs = Number(process.env.DJG_SELFTEST_DELAY_MS) || 8000
    const shoot = () => setTimeout(() => {
      const o = primaryOutput()
      if (o) o.win.webContents.send('selftest:shot')
      else { console.error('[SelfTest] nessuna finestra output'); app.quit() }
    }, settleMs)
    ipcMain.once('output:painted', shoot)
    setTimeout(() => { console.error('[SelfTest] timeout'); app.quit() }, settleMs + 40000)
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

  // A reel (I4) saved on the Auto VJ's drop must not pop a save dialog over the
  // console mid-set: it goes straight to Downloads. Same for every timestamped
  // capture (screenshot, WebM, GIF): the recorder stops itself at 1.5 GB and
  // popped the dialog over the console with nobody touching anything. The
  // named exports (presets, playlists, custom-shader.frag) keep the dialog.
  session.defaultSession.on('will-download', (_e, item) => {
    const name = item.getFilename()
    if (/^djtographikz-(reel-)?\d{4}-\d{2}-\d{2}T/.test(name)) item.setSavePath(join(app.getPath('downloads'), name))
  })

  controlWindow = createControlWindow()
  // The projector comes up on defaults; the renderer sends the saved list of
  // outputs as soon as it has read it, and reconcile makes the rest.
  const primary = createOutputWindow(PRIMARY, DEFAULT_CFG)

  logDisplayState('avvio', controlWindow, primary.win)
  // The renderer read the display list once at start: a projector plugged in
  // with the app open never showed up in the pickers until a restart.
  const notifyDisplaysChanged = () => {
    if (controlWindow && !controlWindow.isDestroyed()) controlWindow.webContents.send('displays:changed')
  }
  screen.on('display-added', () => { logDisplayState('display collegato', controlWindow, primaryOutput()?.win ?? null); notifyDisplaysChanged() })
  screen.on('display-removed', () => { logDisplayState('display scollegato', controlWindow, primaryOutput()?.win ?? null); notifyDisplaysChanged() })
  screen.on('display-metrics-changed', () => {
    logDisplayState('display cambiato', controlWindow, primaryOutput()?.win ?? null)
    keepOutputOnItsDisplay()
  })
  // periodic guard: nothing else notices when macOS relocates the window
  setInterval(keepOutputOnItsDisplay, 4000)

  setupIpcHandlers(controlWindow, primary.win)
  // A browser gets the whole show at the projector's resolution: OBS crops on
  // its side, and a LED-wall slice would be a surprise in a stream.
  // ponytail: replay only at connect — a resolution change mid-set reaches
  // the browser at its next reconnect, not live.
  setupRemoteServer(controlWindow, send => {
    const { width, height } = primaryOutput()?.cfg ?? DEFAULT_CFG
    replayShow(send, { ...DEFAULT_CFG, width, height })
  })
  setupOscServer(controlWindow)
  setupProDjLink(controlWindow)
  setupUpdateCheck(() => controlWindow)
  setupArtnet()

  // macOS microphone access at OS level. Asked after the windows exist and
  // without waiting: at a first start (or after a TCC reset) the prompt used
  // to come before any window, and nothing was on the projector until it was
  // answered. The analyser's own recovery copes with a transient NotAllowed.
  if (process.platform === 'darwin') {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone')
    console.log('[Main] macOS microphone access status:', micStatus)
    if (micStatus !== 'granted') {
      void systemPreferences.askForMediaAccess('microphone')
        .then(granted => console.log('[Main] macOS microphone permission granted:', granted))
    }
  }

  // Chromium keeps the display awake for a playing <video>, not for a WebGL
  // canvas: a DJ on controllers alone, no key or mouse for the OS timeout,
  // had the projector go to sleep with the laptop screen. Not under the gate.
  if (!SELFTEST) {
    const psb = powerSaveBlocker.start('prevent-display-sleep')
    // will-quit, not before-quit: a Cmd+Q answered with "Resta" (see the
    // 'close' handler) must not leave the projector free to sleep mid-show
    app.on('will-quit', () => { if (powerSaveBlocker.isStarted(psb)) powerSaveBlocker.stop(psb) })
  }

  // Forward engine state from control to output window (cache for replay).
  // The control window leaves the ISF images out while they do not change
  // (see sendState in App.tsx): the replay copy keeps the last ones it got,
  // so a window or a browser that connects later still gets the whole look.
  ipcMain.on('engine:state-update', (_event, state) => {
    const prev = lastEngineState as { customShader?: string; customImages?: unknown } | null
    const next = state as { customShader?: string; customImages?: unknown } | null
    lastEngineState = next && next.customShader && !next.customImages && prev?.customImages && prev.customShader === next.customShader
      ? { ...next, customImages: prev.customImages }
      : state
    broadcastOutputs('engine:state-update', state)
  })

  // Forward audio data from control to output
  ipcMain.on('audio:data', (_event, data) => {
    broadcastOutputs('audio:data', data)
  })

  // Forward overlay operations from control to output (cache descriptors for replay)
  ipcMain.on('overlay:add', (_event, data) => {
    if (data?.id) overlays.set(data.id, data)
    broadcastOutputs('overlay:add', data)
  })
  ipcMain.on('overlay:remove', (_event, id) => {
    overlays.delete(id)
    broadcastOutputs('overlay:remove', id)
  })
  ipcMain.on('overlay:update', (_event, id, updates) => {
    const cached = overlays.get(id)
    if (cached) Object.assign(cached, updates)
    broadcastOutputs('overlay:update', id, updates)
  })

  // Cmd+W and Cmd+Q sit one key from the Q and W hotkeys, and closing the
  // console closes every wall: with a projector in fullscreen it asks first.
  // Async dialog: a sync one blocks main, which relays state and audio to
  // the outputs.
  let closeConfirmed = false
  let closeAsking = false
  controlWindow.on('close', e => {
    if (SELFTEST || closeConfirmed || !liveOutputs().some(o => o.win.isAlwaysOnTop())) return
    e.preventDefault()
    quitting = false   // before-quit already set it on Cmd+Q; the recoveries must stay armed
    if (closeAsking || !controlWindow) return
    closeAsking = true
    dialog.showMessageBox(controlWindow, {
      type: 'warning',
      message: 'Il proiettore è a schermo intero',
      detail: 'Chiudere la finestra di controllo spegne tutte le uscite.',
      buttons: ['Resta', 'Chiudi e spegni il proiettore'],
      defaultId: 0, cancelId: 0,
    }).then(r => {
      closeAsking = false
      if (r.response === 1) { closeConfirmed = true; app.quit() }
    }).catch(() => { closeAsking = false })
  })

  controlWindow.on('closed', () => {
    controlWindow = null
    for (const o of liveOutputs()) o.win.close()
    outputs.clear()
  })

  // The renderer owns the list of outputs; this is the only way in.
  ipcMain.on('outputs:set', (_event, list: OutputCfg[]) => {
    if (Array.isArray(list)) reconcileOutputs(list)
  })

  // Forward resolution change to the projector (the toolbar still drives it)
  ipcMain.on('output:set-resolution', (_event, w: number, h: number) => {
    ensureOutputWindow().win.webContents.send('output:set-resolution', w, h)
  })

  // Toggle output fullscreen. simpleFullScreen ONLY — it's instant on macOS and,
  // unlike the native one, doesn't fight the window state when toggled fast.
  ipcMain.on('output:toggle-fullscreen', (_event, id: number = PRIMARY) => {
    const o = id === PRIMARY ? ensureOutputWindow() : outputs.get(id)
    if (o && !o.win.isDestroyed()) setOutputFullscreen(o, !o.win.isAlwaysOnTop())
    notifyOutputChanged()   // the toolbar chip reads isAlwaysOnTop, set synchronously above
  })

  // Output window status for the control-window chip (U1.3)
  ipcMain.handle('output:info', () => {
    const o = primaryOutput()
    const win = o?.win
    if (!win || win.isDestroyed()) return { open: false, fullscreen: false, display: '' }
    const d = screen.getDisplayMatching(win.getBounds())
    const idx = screen.getAllDisplays().findIndex(x => x.id === d.id)
    return {
      open: true,
      fullscreen: win.isAlwaysOnTop(),
      display: d.label || `Display ${idx + 1}`,
      /** How many walls the show is on right now — the chip says "+N" */
      count: liveOutputs().length,
    }
  })

  ipcMain.on('output:reopen', () => { ensureOutputWindow() })

  // Soundcheck (P3): ask the projector for one frame's statistics and its pace.
  // The output renderer answers on 'output:probe-result' with the same id; a
  // renderer that never answers is itself the finding (null = no response).
  let probeSeq = 0
  ipcMain.handle('output:probe', () => {
    const o = primaryOutput()
    if (!o) return null
    const id = ++probeSeq
    return new Promise(resolve => {
      const done = (result: unknown) => { clearTimeout(timer); ipcMain.removeListener('output:probe-result', onResult); resolve(result) }
      const onResult = (_e: Electron.IpcMainEvent, rid: number, data: unknown) => { if (rid === id) done(data) }
      const timer = setTimeout(() => done(null), 5000)
      ipcMain.on('output:probe-result', onResult)
      o.win.webContents.send('output:probe', id)
    })
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

  // Move output to specific display (exit fullscreen first: setBounds is a
  // no-op while fullscreen, the window would "move" to the same display)
  ipcMain.on('output:move-to-display', (_event, displayId: number, id: number = PRIMARY) => {
    const display = screen.getAllDisplays().find(d => d.id === displayId)
    const o = id === PRIMARY ? ensureOutputWindow() : outputs.get(id)
    if (display && o && !o.win.isDestroyed()) {
      o.displayId = display.id
      setOutputFullscreen(o, true)
    }
  })
})

app.on('before-quit', () => { quitting = true })

app.on('window-all-closed', () => {
  app.quit()
})
