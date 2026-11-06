import './styles/features.css'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { AudioPanel } from './components/AudioPanel/AudioPanel'
import { Toasts, pushToast } from './components/Toasts/Toasts'
import { useVisibleInterval } from './components/useVisibleInterval'
import { encodeGif, gifTiming, barsSeconds } from './gifEncoder'
import { EffectPanel } from './components/EffectPanel/EffectPanel'
import { AutoVJPanel } from './components/AutoVJPanel/AutoVJPanel'
import { OverlayPanel } from './components/OverlayPanel/OverlayPanel'
import { PresetPanel } from './components/PresetPanel/PresetPanel'
import { seqCommand } from './components/PresetPanel/seqRemote'
import { useSequencePlayer } from './components/PresetPanel/useSequencePlayer'
import type { Sequence } from './components/PresetPanel/sequences'
import { ShaderEditor } from './components/ShaderEditor/ShaderEditor'
import { DeckPanel } from './components/DeckPanel/DeckPanel'
import { SimplePanel } from './components/SimplePanel/SimplePanel'
import { SimpleDeck, type SimpleTab } from './components/SimplePanel/SimpleDeck'
import { flowState, type SimpleFlow } from './simpleFlow'
import { seedFactoryLooks } from './factoryLooks'
import { LookBank } from './components/LookBank/LookBank'
import { MidiPanel } from './components/MidiPanel/MidiPanel'
import { MappingPanel } from './components/MappingPanel/MappingPanel'
import { CameraPanel, ImpactPanel } from './components/CameraPanel/CameraPanel'
import { DmxPanel } from './components/DmxPanel/DmxPanel'
import { VenuePanel } from './components/VenuePanel/VenuePanel'
import { OutputsPanel, useOutputs } from './components/OutputsPanel/OutputsPanel'
import { Onboarding, type OnboardingResult } from './components/Onboarding/Onboarding'
import { RemoteModal } from './components/RemoteModal/RemoteModal'
import { Soundcheck } from './components/Soundcheck/Soundcheck'
import { HelpMenu } from './components/Help/HelpMenu'
import { CheatSheet } from './components/Help/CheatSheet'
import { QuickGuide } from './components/Help/QuickGuide'
import { IconCamera, IconRecord, IconStop, IconPhone, IconFullscreen, IconHelp, IconEye, IconMonitor } from './components/Icons/Icons'
import { Engine, BLEND_MODES, type EffectId, type PostId, type EngineState, type TransitionType, type Preset } from '@engine/Engine'
import { AutoVJ, GENRE_CONFIGS, type Genre, type Phase } from '@engine/AutoVJ'
import { PHASE_LABEL } from './components/AutoVJ/AutoVJControl'
import { ALL_EFFECTS, POST_CATEGORIES, TRANSITIONS, effectLabel } from './catalog'
import { SOURCE_META } from './components/ParamControls/ParamControls'
import { allThumbs, onThumbs } from './fxThumbs'
import { getFavs, setPickContext } from './fxPicks'
import { allPalettes } from './palettes'
import { sanitizeCmd, stepPalette, type Known } from './phoneCmd'
import { AUDIO_SOURCES } from '@engine/EffectParams'
import { loadUserScenes, saveUserScenes, sceneFromLook, userScenesByGenre, getOnlyMine, setOnlyMine, USER_SCENES_EVENT } from './userScenes'
import { useAudioRestore, loadAudioSettings } from './useAudioRestore'
import { shouldIgnoreHotkey } from './hotkeys'
import { momentary } from './momentary'
import { IdleWatch, loadIdleSettings, onIdleSettings } from './idle'
import { runSweep } from './sweep'
import { ReelBuffer, cropRect, reelFileName, loadReelSettings, onReelSettings, CHUNK_MS, DROP_DELAY_MS, REEL_FPS, type ReelLap, type ReelSettings } from './reel'
import { getLook } from './looks'
import { readJson, writeJson, writeJsonText, writeString, readString } from './storage'
import { midi } from './midi'
import { gamepad } from './gamepad'
import { PanelBoundary } from './components/PanelBoundary/PanelBoundary'
import { saveBlob, stampedName } from './download'
import { useDmxOutput, notifyDmxConfigChanged } from './useDmxOutput'
import { pickEffect } from './autoMapping'
import { AUDIO_STORE_KEY, DMX_STORE_KEY, parseRes, type Venue } from './venues'
import { migrateKeystone, type OutputCfg } from './outputs'

type UIMode = 'simple' | 'pro' | 'live'
type WallState = 'air' | 'black' | 'frozen' | 'off'
const WALL_LABEL: Record<WallState, string> = { air: 'IN ONDA', black: 'BLACK', frozen: 'FREEZE', off: 'ANTEPRIMA' }
const MODE_KEY = 'djtographikz-ui-mode'
const ONBOARDED_KEY = 'djtographikz-onboarded'
const SETTINGS_KEY = 'djtographikz-settings'
const PREVIEW_COMPACT_KEY = 'djtographikz-preview-compact-v2'
const BEATFLASH_KEY = 'djtographikz-beatflash'

// Hotkey maps: 1-0 = ten fixed effects (the first ten of the old panel order:
// regrouping the catalog must not move muscle memory), QWER = common post toggles
const HOTKEY_EFFECTS: EffectId[] = ['tunnel', 'kaleidoscope', 'voronoi', 'sacred', 'mandala', 'hexagons', 'rings', 'moire', 'neonpoly', 'truchet']
const HOTKEY_POSTS: Record<string, PostId> = { q: 'bloom', w: 'feedback', e: 'chromatic', r: 'rgb-split' }

// Catalog for the phone remote: derived from the one catalog, never re-typed.
// The Record type still makes tsc fail here if a PostId is added or removed.
const REMOTE_POSTS: { id: PostId; label: string }[] =
  POST_CATEGORIES.flatMap(c => c.effects.map(fx => ({ id: fx.id, label: fx.label })))
const TRANSITION_TYPES: Record<TransitionType, true> = {
  crossfade: true, 'wipe-left': true, 'wipe-down': true, radial: true, dissolve: true,
}

// What a remote command may name; anything else is dropped before the engine
const KNOWN: Known = {
  effects: new Set(ALL_EFFECTS.map(fx => fx.id)),
  posts: new Set(REMOTE_POSTS.map(p => p.id)),
  transitions: new Set(Object.keys(TRANSITION_TYPES)),
  blendModes: new Set(BLEND_MODES),
  genres: new Set(Object.keys(GENRE_CONFIGS)),
  sources: new Set(AUDIO_SOURCES),
}

// Short Italian verb for external-command toasts (U1.4)
function cmdToastLabel(type: string, v: any): string {
  switch (type) {
    case 'effect': return `Effetto ${v}`
    case 'post': return `Post ${v}`
    case 'postClear': return 'Post FX rimossi'
    case 'palette': return 'Palette'
    case 'crossfade': return `Crossfade ${Math.round(v * 100)}%`
    case 'deckB': return `Deck B ${v}`
    case 'brightness': return `Master ${Math.round(v * 100)}%`
    case 'blackout': return v ? 'Blackout ON' : 'Blackout OFF'
    case 'freeze': return v ? 'Freeze ON' : 'Freeze OFF'
    case 'autovj': return v === '__toggle__' ? 'AutoVJ' : v ? 'AutoVJ ON' : 'AutoVJ OFF'
    case 'genre': return `Genere ${v}`
    case 'motionBlur': return `Motion blur ${Math.round(v * 100)}%`
    case 'look': return `Look ${Number(v) + 1}`
    case 'seqStart': return `Scaletta ${Number(v) + 1}`
    case 'seqNext': return 'Scaletta avanti'
    case 'seqPrev': return 'Scaletta indietro'
    case 'seqStop': return 'Scaletta stop'
    case 'tap': return 'Tap BPM'
    case 'panic': return 'PANIC'
    case 'paletteStep': return 'Palette ' + (v > 0 ? 'avanti' : 'indietro')
    case 'bpmMode': return `BPM ${v}`
    case 'bpmScale': return v < 1 ? 'BPM x1/2' : 'BPM x2'
    case 'bpmSet': return `BPM ${Math.round(v)}`
    case 'videoDeck': return 'Video deck'
    case 'cycle': return 'Cicla palette'
    case 'overlay': return 'Overlay'
    case 'onlyMine': return v ? 'Solo mie scene ON' : 'Solo mie scene OFF'
    case 'saveScene': return 'Scena salvata'
    default: return type
  }
}

function loadSettings(): Partial<EngineState> | null {
  try {
    const raw = readString(SETTINGS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// Commands that change nothing the phone's "ext" block shows (BPM mode,
// scenes, overlays): a slider stream from the phone or a MIDI knob used to
// rebuild and stringify it after every one of them, up to 60 times a second.
// The 1 s tick stays as the safety net.
const EXT_STABLE = new Set([
  'param', 'paramMap', 'postAmount', 'postMove', 'grade', 'motionBlur', 'intensity', 'lineBoost',
  'presence', 'camera', 'blendMode', 'maskSoft', 'brightness', 'crossfade', 'palette', 'transitionDuration',
])

/**
 * The FPS counter as a leaf. Its setState used to live in App, so the whole
 * tree — every panel, none of them memoised — re-rendered once a second on
 * the thread that paints the preview. The engine already calls its frame
 * listeners once per rendered frame, so it counts those: one chain, and the
 * number means what it says.
 */
function FpsLabel({ engine }: { engine: Engine | null }) {
  const [fps, setFps] = useState(0)
  useEffect(() => {
    if (!engine) return
    let frames = 0
    let lastTime = performance.now()
    return engine.onAudioFrame(() => {
      frames++
      const now = performance.now()
      if (now - lastTime < 1000) return
      setFps(frames)
      frames = 0
      lastTime = now
    })
  }, [engine])
  // a healthy number has no colour: the colour is for when something is wrong
  const color = fps > 55 ? 'var(--text-muted)' : fps > 30 ? 'var(--warning)' : 'var(--danger)'
  return <span style={{ color }}>{fps} FPS</span>
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [engine, setEngine] = useState<Engine | null>(null)
  const seqPlayer = useSequencePlayer(engine)
  // a playlist drives the wall on purpose: the idle fade must not take it over
  const seqPlayingRef = useRef(false); seqPlayingRef.current = seqPlayer.playing
  const engineRef = React.useRef<Engine | null>(null)
  engineRef.current = engine
  const [bpm, setBpm] = useState(0)
  /** Intensity macro, 0..1 — one fader instead of five sliders, key I */
  const [intensity, setIntensity] = useState(0)
  /** Beat-roll division latched by , . / — 0 = off. Mirrors engine.getBeatRoll() for the bottom bar. */
  const [beatRoll, setBeatRollUi] = useState(0)
  /**
   * The outputs of the show. The projector is outputs[0]: the toolbar edits
   * that one, the Uscite panel edits them all, and both go through the same
   * store — two doors onto one truth was how the display picker came to forget
   * what it had been told.
   */
  const [outputs, setOutputs] = useOutputs()
  const primaryOut = outputs[0]
  /** Which output the Mapping panel is aligning; the preview shows its corners. */
  const [mappingOut, setMappingOut] = useState(0)
  const outputRes = `${primaryOut.width}x${primaryOut.height}`
  const [brightness, setBrightness] = useState(1)
  const [blackout, setBlackout] = useState(false)
  const [frozen, setFrozen] = useState(false)
  // Mirrors for the hotkeys: they read and write these synchronously in the
  // keydown, instead of inside a setState updater that React runs later (and
  // twice under StrictMode, registering the momentary release twice).
  const blackoutRef = useRef(blackout); blackoutRef.current = blackout
  const frozenRef = useRef(frozen); frozenRef.current = frozen
  const intensityRef = useRef(intensity); intensityRef.current = intensity
  const brightnessRef = useRef(brightness); brightnessRef.current = brightness

  // UI mode + onboarding
  const [mode, setMode] = useState<UIMode>(() => {
    // a stale or hand-edited value used to go straight into the layout
    const saved = window.api?.selfTestMode || readString(MODE_KEY)
    return saved === 'pro' || saved === 'live' || saved === 'simple' ? saved : 'simple'
  })
  const [showRemote, setShowRemote] = useState(false)
  const [showSoundcheck, setShowSoundcheck] = useState(false)
  // No wizard: Simple mode is the path (1 Musica, 2 Stile, 3 Via) and the
  // first picture is the app itself. The factory looks are seeded here, before
  // LookBank mounts and reads the bank. The old wizard stays in the help menu.
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (!readString(ONBOARDED_KEY)) { seedFactoryLooks(); writeString(ONBOARDED_KEY, '1') }
    return false
  })
  /** which tab is open under the preview in Simple */
  const [simpleTab, setSimpleTab] = useState<SimpleTab>('look')
  // Simple's "ti sento": the frame listener below stamps a ref whenever there
  // is signal; this reads it at 2 Hz and changes state only when the word changes.
  const lastSoundRef = useRef(-Infinity)
  const [flow, setFlow] = useState<SimpleFlow>('fermo')

  // U2.1/U2.2 — menu aiuto + overlay scorciatoie/guida
  const [showHelpMenu, setShowHelpMenu] = useState(false)
  const [showCheatSheet, setShowCheatSheet] = useState(false)
  const [showQuickGuide, setShowQuickGuide] = useState(false)

  // Preview riducibile: compatta la striscia video, i pannelli prendono spazio
  const [previewCompact, setPreviewCompact] = React.useState(() => readString(PREVIEW_COMPACT_KEY) !== '0')
  const togglePreviewCompact = React.useCallback(() => {
    setPreviewCompact(c => {
      writeString(PREVIEW_COMPACT_KEY, c ? '0' : '1')
      return !c
    })
  }, [])

  // U4.2 — flash del bordo preview sul beat (opt-in, persistito)
  const [beatFlash, setBeatFlash] = useState(() => readString(BEATFLASH_KEY) === '1')
  const beatFlashRef = useRef<HTMLDivElement>(null)

  // AutoVJ lives here so Simple and Pro views share one instance. Lazy: the
  // argument of useRef is evaluated on every render, so `useRef(new AutoVJ())`
  // built one per render and threw it away.
  const vjRef = useRef<AutoVJ>(null!)
  if (!vjRef.current) {
    vjRef.current = new AutoVJ()
    // Only AutoVJPanel handed the user scenes over, and it mounts in Pro only:
    // an app started in Simple or Live ran on factory scenes, "Solo le mie" ignored.
    vjRef.current.setUserScenes(userScenesByGenre(loadUserScenes()), getOnlyMine())
  }
  // Pro: gli FX stanno sotto il Look Bank; sotto 1100px tornano nella sidebar
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1100px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1100px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const fxCenter = mode === 'pro' && wide
  const [vjEnabled, setVjEnabled] = useState(false)
  const [vjGenre, setVjGenre] = useState<Genre>('acid-techno')
  const [vjStatus, setVjStatus] = useState<{ current: string; count: number; phase: Phase }>({ current: '', count: 0, phase: 'groove' })
  // hold: picture stays put, phase detection keeps running underneath — the
  // on/off toggle was the only way to pin a look, and it also surrendered
  // phase-driven palette/post automation and reset scheduling memory
  const [vjHeld, setVjHeld] = useState(false)

  // Displays for the output-monitor picker
  const [displays, setDisplays] = useState<{ id: number; label: string; primary: boolean }[]>([])
  /**
   * P2 — bumped when a venue profile rewrites the audio/DMX stores. Both panels
   * read their store once, at mount; remounting them is the whole re-read.
   * ponytail: a store-change event would be tidier, for two readers it is not worth it.
   */
  const [panelEpoch, setPanelEpoch] = useState(0)

  // U1.2 — beat dot (flashed via direct DOM mutation, no setState per frame) + audio status
  const beatDotRef = useRef<HTMLSpanElement>(null)
  const [audioStatus, setAudioStatus] = useState<'running' | 'reconnecting' | 'stopped'>('stopped')
  // a lost WebGL context froze the preview with one line in the console; the Engine handles the restore
  const [gpuLost, setGpuLost] = useState(false)

  // Main comes up with one output on defaults; the saved list is the truth.
  useEffect(() => { try { window.api?.setOutputs?.(outputs) } catch (_) {} }, [])

  // The keystone is per output and travels with the OutputCfg; the control
  // window previews the one being aligned so a dragged corner is seen here too.
  useEffect(() => {
    engine?.setKeystone((outputs[mappingOut] ?? primaryOut).keystone)
  }, [engine, outputs, mappingOut, primaryOut])

  // U1.3 — output window status chip
  const [outputInfo, setOutputInfo] = useState<{ open: boolean; fullscreen: boolean; display: string; count?: number } | null>(null)
  const refreshOutputInfo = useCallback(() => {
    window.api?.getOutputInfo?.().then(setOutputInfo).catch(() => {})
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const onLost = () => setGpuLost(true), onRestored = () => setGpuLost(false)
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    const eng = new Engine(canvas)
    // Persistence debounced: a synchronous localStorage write per emitted state
    // (~16/s while dragging a remote slider) blocks the render thread
    let persistTimer = 0
    // The snapshot carries paramDefs, every effect's params and any ISF image
    // inputs as base64. Dragging a slider emits one per frame, so
    // sending each one structured-clones megabytes at 60Hz to main and on to
    // the output window. 30Hz, same rate as the audio push: leading edge so a
    // look change lands at once, trailing flush so the last value is never lost.
    let ipcTimer = 0
    let lastSent = 0
    let pending: EngineState | null = null
    // The ISF image inputs are the same strings snapshot after snapshot while
    // the shader stays (the engine hands out its own map), yet each send
    // cloned them to main and on to every output and browser. They go once,
    // and again only when one changes: applyRemoteState leaves the images
    // alone when the field is absent, and main puts them back into the copy
    // it replays to a window or a browser that connects later.
    let sentImgs: Record<string, string> | undefined
    let sentShader: string | undefined
    const sendState = () => {
      ipcTimer = 0
      lastSent = performance.now()
      let out = pending
      const imgs = out?.customImages
      if (out && imgs && sentImgs && out.customShader === sentShader) {
        const keys = Object.keys(imgs)
        if (keys.length === Object.keys(sentImgs).length && keys.every(k => imgs[k] === sentImgs![k])) {
          const { customImages, ...rest } = out
          void customImages
          out = rest as EngineState
        } else {
          sentImgs = { ...imgs }
        }
      } else {
        sentImgs = imgs ? { ...imgs } : undefined
        sentShader = out?.customShader
      }
      try { window.api?.sendEngineState(out) } catch (_) {}
    }
    let lastSnap = ''
    // blackout/frozen excluded on restore. This is the biggest writer in the
    // app — base64 images included — so it is the one that fills the quota and
    // makes every other save fail. Many state changes serialize to the same
    // string (a slider back where it was, applyRemoteState): the synchronous MB
    // setItem is skipped for those.
    let latest: EngineState | null = null
    let lastWrite = performance.now()
    const flush = () => {
      persistTimer = 0
      if (latest === null) return
      // paramDefs, the audio readings and the running transition are never
      // read back by applySettings: out of the file, and out of the compare —
      // with `energy` in it no two snapshots were ever the same string
      const { paramDefs, energy, beatPulse, bpm, transition, ...persist } = latest
      void paramDefs; void energy; void beatPulse; void bpm; void transition
      const snap = JSON.stringify(persist)
      latest = null
      lastWrite = performance.now()
      if (snap === lastSnap) return
      if (writeJsonText(SETTINGS_KEY, snap)) lastSnap = snap
    }
    eng.onStateChange = (state) => {
      pending = state
      const wait = 33 - (performance.now() - lastSent)
      if (wait <= 0) {
        if (ipcTimer) clearTimeout(ipcTimer)
        sendState()
      } else if (!ipcTimer) {
        ipcTimer = window.setTimeout(sendState, wait)
      }
      // Debounced 400 ms after the last change, but never later than 5 s after
      // the previous write: a trailing-only timer re-armed by every emit (a
      // long drag, the Auto VJ) could go minutes without touching disk, and a
      // crash in that window lost the look. The write itself waits for an idle
      // slot so the MB serialization does not land inside a frame.
      latest = state
      clearTimeout(persistTimer)
      if (performance.now() - lastWrite > 5000) { flush(); return }
      persistTimer = window.setTimeout(() => {
        if ('requestIdleCallback' in window) requestIdleCallback(flush, { timeout: 1000 })
        else flush()
      }, 400)
    }
    eng.onDeckClipError = path => pushToast(`Clip non leggibile: ${path.split('/').pop()}`, 'deck-clip-err', undefined, 'err')
    // the last look must survive a close: flush on the way out
    window.addEventListener('pagehide', flush)
    eng.start()

    // Restore last session's look. A corrupt or stale snapshot used to throw
    // here, before setEngine and before the cleanup was registered: an app
    // with no engine, at every start, until the user cleared the data by hand.
    const saved = loadSettings()
    if (saved) {
      try {
        eng.applySettings(saved)
        if (typeof saved.brightness === 'number') setBrightness(saved.brightness)
        setIntensity(eng.getIntensity())   // the engine restores it; the fader started at 0 and the I key read that
      } catch (err) {
        console.error('[Settings] ripristino fallito:', err)
        window.api?.logToFile?.('settings', `[Settings] ripristino fallito: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
        // a copy instead of a delete: the look stays recoverable by hand
        try {
          const raw = readString(SETTINGS_KEY)
          if (raw) writeString(`${SETTINGS_KEY}-broken`, raw)
          localStorage.removeItem(SETTINGS_KEY)
        } catch { /* storage blocked: nothing to park */ }
        pushToast('Look della sessione precedente non leggibile: ripartito dai default', 'settings-restore', undefined, 'err')
      }
    }

    // Release gate: pin the effect it asked for (DJG_SELFTEST_EFFECT), or the
    // custom shader source it handed over (DJG_SELFTEST_SHADER)
    try {
      if (window.api?.selfTestShader) eng.setCustomShader(window.api.selfTestShader)
      else if (window.api?.selfTestEffect) eng.setEffect(window.api.selfTestEffect as any)
    } catch (err) { console.error('[SelfTest] effetto/shader non applicabile:', err) }

    // Release sweep: every effect, post and Auto VJ post chain, probed on the projector
    let sweepTimer = 0
    if (window.api?.selfTestSweep) sweepTimer = window.setTimeout(() => { void runSweep(eng) }, 4000)

    // Gate: frame the scene, so a screenshot can prove the camera pass runs.
    if (window.api?.selfTestCamera) {
      try { eng.setCamera(JSON.parse(window.api.selfTestCamera)) }
      catch (err) { console.error('[SelfTest] camera illeggibile:', err) }
    }

    // Dry run under the gate: analyse a file instead of opening the mic, so a
    // script can assert on what the beat and BPM machinery actually reports.
    // The renderer cannot read a path — it goes through the same djg-media
    // protocol the video overlays already use.
    // StrictMode mounts effects twice in dev, and the second mount is the one
    // that survives: without clearing this the first engine's timer keeps
    // reporting on an analyser that was already disposed, i.e. silence.
    let dryRunTimer = 0
    // The timer is created inside a promise that resolves long after the
    // StrictMode cleanup has already run, so clearing it there is not enough:
    // the dead mount has to know it is dead before it starts anything.
    let disposed = false
    const dryRun = window.api?.selfTestAudio
    if (dryRun) {
      fetch(`djg-media://f?p=${encodeURIComponent(dryRun)}`)
        .then(r => r.blob())
        // a mount already disposed must not start a file on a dead analyser
        .then(b => disposed ? undefined : eng.audioAnalyzer.startFile(new File([b], dryRun.split('/').pop() || 'prova.wav')))
        .then(() => {
          if (disposed) return
          // One line a second, so the check can read the tempo the analysis
          // settled on instead of guessing when it was ready.
          let beats = 0
          const a = eng.audioAnalyzer
          eng.onAudioFrame(hit => { if (hit) beats++ })
          dryRunTimer = window.setInterval(() => {
            const d = a.getData()
            // Through the log bridge, not console.log: the session log keeps
            // warnings and up on purpose, and this has to survive to the file
            // for the check to read it — the same door output/health uses.
            window.api?.logToFile?.('dryrun',
              `[DryRun] t=${a.getCurrentTime().toFixed(1)}s bpm=${d.bpm}`
              + ` conf=${a.getBpmConfidence().toFixed(2)} beats=${beats}`
              + ` energy=${d.energy.toFixed(2)} bass=${d.bass.toFixed(2)}`)
          }, 1000)
        })
        .catch(err => {
          console.error('[DryRun] non riesco ad aprire', dryRun, err)
          window.api?.logToFile?.('dryrun', `[DryRun] fallito: ${err}`)
        })
    }

    // Wire AutoVJ → engine
    const vj = vjRef.current
    vj.onSceneChange = (scene, cut, phase) => {
      // one state change for the whole scene: effect + a setter per param used
      // to emit ~10 snapshots in the same frame, each one re-rendering panels
      eng.batch(() => {
        // the Auto VJ decides how to move into a scene (the drop cuts, a break
        // fades slow); the user's own transition comes back right after
        const prevType = eng.getTransitionType()
        const prevSeconds = eng.getTransitionDuration()
        eng.setTransitionType(cut.type)
        eng.setTransitionDuration(cut.seconds)
        eng.setEffect(scene.effect)
        eng.setTransitionType(prevType)
        eng.setTransitionDuration(prevSeconds)
        // tuned params + audio mappings make the scene, not just the effect
        for (const [key, sp] of Object.entries(scene.params ?? {})) {
          if (typeof sp.value === 'number') eng.setParamValue(key, sp.value)
          if (sp.source) eng.setParamMapping(key, sp.source, sp.depth ?? 0.5, sp.lfoRate)
          else eng.setParamMapping(key, 'none', 0.5)
        }
      })
      setVjStatus(prev => ({ current: scene.effect, count: prev.count + 1, phase }))
      // the drop is the hard cut into peak — the reel (I4) may want it
      if (phase === 'peak' && cut.seconds === 0) reelRef.current?.drop()
    }
    vj.onPostChange = (posts) => eng.setActivePosts(posts)
    vj.onPhaseChange = (phase) => setVjStatus(prev => ({ ...prev, phase }))
    vj.onPaletteChange = (colors) => eng.setColors(colors[0], colors[1], colors[2])
    // Idle on silence (S5): with the Auto VJ off, N seconds of nothing fade
    // the wall to a calm look and the music brings the old one back. The Auto
    // VJ handles silence itself (it is a break there), so it is left alone.
    let idleSettings = loadIdleSettings()
    const idle = new IdleWatch(idleSettings.seconds)
    let idleBefore: EffectId | null = null
    const fadeTo = (effect: EffectId, seconds: number) => {
      const prevType = eng.getTransitionType(), prevSeconds = eng.getTransitionDuration()
      eng.setTransitionType('crossfade'); eng.setTransitionDuration(seconds)
      eng.setEffect(effect)
      eng.setTransitionType(prevType); eng.setTransitionDuration(prevSeconds)
    }
    const unIdle = onIdleSettings(s => {
      // idle switched off while the wall IS idle: bring the picture back, or
      // the calm look stays up for the rest of the night. The old effect is
      // read before the new settings replace it.
      if (!s.enabled && idle.isIdle() && idleBefore && eng.getCurrentEffect() === idleSettings.effect) fadeTo(idleBefore, 1.5)
      idleSettings = s
      idle.setSeconds(s.seconds)
      if (!s.enabled) { idle.reset(); idleBefore = null }
    })
    let listenerErrorAt = -Infinity
    const unsubscribe = eng.onAudioFrame((beat, energy, bass, barPhase, bassRaw, energyRaw, key) => {
      // The engine runs its listeners without isolating them: a throw here
      // (a user scene the Auto VJ cannot apply) used to skip the rest of
      // renderFrame on every frame until the cause went away — frozen preview.
      try {
        if (energyRaw > 0) lastSoundRef.current = performance.now()
        vj.update({ beat, energy, bass, barPhase, bassRaw, energyRaw, key })
        eng.notePhase(vj.getPhase())   // the track-change detector reads it after this listener
        // the release sweep sets effects itself and measures them: idle must not move the picture under it.
        // The watch is reset while it is not in charge: a silence from minutes ago
        // must not count the moment the Auto VJ is switched off.
        if (!idleSettings.enabled || vj.isEnabled() || seqPlayingRef.current || window.api?.selfTestSweep) { idle.reset(); idleBefore = null; return }
        const ev = idle.update(energyRaw > 0, performance.now())
        if (ev) window.api?.logToFile?.('idle', `[Idle] ${ev} effect=${eng.getCurrentEffect()}`)
        if (ev === 'enter' && eng.getCurrentEffect() !== idleSettings.effect) {
          idleBefore = eng.getCurrentEffect()
          fadeTo(idleSettings.effect, 3)
        } else if (ev === 'exit' && idleBefore) {
          // only if nobody changed the picture in the meantime
          if (eng.getCurrentEffect() === idleSettings.effect) fadeTo(idleBefore, 1.5)
          idleBefore = null
        }
      } catch (e) {
        const now = performance.now()
        if (now - listenerErrorAt < 5000) return   // one line every 5 s, not one per frame
        listenerErrorAt = now
        console.error('[AutoVJ/idle]', e)
        window.api?.logToFile?.('autovj', `[AutoVJ/idle] ${e instanceof Error ? e.stack ?? e.message : String(e)}`)
      }
    })

    // Push catalogs to the phone remote (served at GET /defs, version added server-side)
    try {
      window.api?.sendRemoteDefs({
        effects: ALL_EFFECTS.map(fx => ({ id: fx.id, label: fx.label, category: fx.category })),
        posts: REMOTE_POSTS,
        palettes: allPalettes(),
        genres: (Object.keys(GENRE_CONFIGS) as Genre[]).map(id => ({ id, label: GENRE_CONFIGS[id].label })),
        blendModes: BLEND_MODES,
        // the phone shows these: labels travel with the ids, never re-typed there
        blendLabels: { 'split-v': 'split V', 'split-h': 'split O', radial: 'radiale', luma: 'luma', audio: 'audio', difference: 'diff' },
        transitionTypes: TRANSITIONS.map(t => ({ id: t.id, label: t.label })),
        paramSourceLabels: Object.fromEntries(AUDIO_SOURCES.map(s => [s, s === 'none' ? 'Audio: no' : SOURCE_META[s].label])),
      })
    } catch (_) {}

    setEngine(eng)
    return () => {
      clearTimeout(ipcTimer)
      clearTimeout(persistTimer)
      flush()
      window.removeEventListener('pagehide', flush)
      disposed = true
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      clearTimeout(sweepTimer)
      clearInterval(dryRunTimer)
      unsubscribe()
      unIdle()
      vj.onSceneChange = null
      vj.onPostChange = null
      vj.onPaletteChange = null
      vj.onPhaseChange = null
      eng.dispose()
      setEngine(null)
    }
  }, [])

  // Effect thumbnails to the phone grid: once now, then on every capture
  // (debounced — a fresh session captures one per effect change)
  useEffect(() => {
    let t = 0
    const push = () => { try { window.api?.sendRemoteThumbs(allThumbs()) } catch (_) {} }
    push()
    const off = onThumbs(() => { clearTimeout(t); t = window.setTimeout(push, 2000) })
    return () => { off(); clearTimeout(t) }
  }, [])

  // "Adatti ora" row of the effect grid follows the genre and the live phase
  useEffect(() => { setPickContext(vjGenre, vjStatus.phase) }, [vjGenre, vjStatus.phase])

  // Enumerate displays for the monitor picker: at mount and on every hotplug
  useEffect(() => {
    const read = () => { window.api?.listDisplays().then((list: any[]) => setDisplays(list)).catch(() => {}) }
    read()
    return window.api?.onDisplaysChanged?.(read)
  }, [])

  // Update check: main pings GitHub, we show a toast with a download link
  useEffect(() => {
    return window.api?.onUpdateAvailable?.(({ version }) => {
      pushToast(`Nuova versione ${version} disponibile`, 'update', {
        label: 'Scarica',
        fn: () => window.api?.openReleasesPage?.(),
      })
    })
  }, [])

  // U1.2 — flash the beat dot on beatDetected: direct DOM animation on the
  // ref, no setState per frame. The Web Animations API instead of the
  // `void el.offsetWidth` restart trick: that was a forced synchronous layout
  // of the whole control window inside the engine's frame, on every beat.
  useEffect(() => {
    if (!engine) return
    return engine.onAudioFrame((beat) => {
      const el = beatDotRef.current
      if (!beat || !el) return
      el.animate(
        [{ transform: 'scale(1.5)', boxShadow: '0 0 10px var(--accent)' }, { transform: 'scale(1)', boxShadow: 'none' }],
        { duration: 250, easing: 'ease-out' },
      )
    })
  }, [engine])

  // U4.2 — flash sul bordo della preview a ogni beat: stessa tecnica del beat
  // dot (l'opacita' di base, 0, e' nel CSS)
  useEffect(() => {
    if (!engine || !beatFlash) return
    return engine.onAudioFrame((beat) => {
      const el = beatFlashRef.current
      if (!beat || !el) return
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out' })
    })
  }, [engine, beatFlash])

  // U1.2 — poll audio status: 'reconnecting' shows the banner, a user stop is fine
  useVisibleInterval(() => {
    if (!engine) return
    setAudioStatus(engine.audioAnalyzer.getStatus())
    setBpm(Math.round(engine.audioAnalyzer.getData().bpm) || 0)
  }, engine ? 1000 : null)
  useVisibleInterval(() => {
    if (!engine) return
    const next = flowState(engine.audioAnalyzer.getStatus() === 'running', performance.now() - lastSoundRef.current)
    setFlow(prev => (prev === next ? prev : next))
  }, engine && mode === 'simple' ? 500 : null)

  // The control engine follows the projector's size from wherever it is set
  // (toolbar, Uscite panel, a venue): the Uscite panel used to change the
  // projector alone and the preview kept the old aspect.
  useEffect(() => {
    if (!engine) return
    engine.setRenderSize(primaryOut.width, primaryOut.height)
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))   // preview re-letterboxes
  }, [engine, primaryOut.width, primaryOut.height])

  // The engine sizes the preview on the window resize event only; the box it
  // sits in changes with the mode, the drawer, the compact toggle and the Live
  // grid. One observer on that box fires the same event for all of them.
  useEffect(() => {
    const box = canvasRef.current?.parentElement
    if (!engine || !box) return
    const ro = new ResizeObserver(() => window.dispatchEvent(new Event('resize')))
    ro.observe(box)
    return () => ro.disconnect()
  }, [engine])

  // U1.3 — output window status: on mount + whenever main signals a change
  useEffect(() => {
    refreshOutputInfo()
    return window.api?.onOutputChanged?.(refreshOutputInfo)
  }, [refreshOutputInfo])

  const screenshot = useCallback(async () => {
    if (!engine) return
    let blob: Blob | null
    try { blob = await engine.screenshot() }
    catch (e) { pushToast(`Screenshot non riuscito: ${(e as Error).message}`, 'shot', undefined, 'err'); return }
    if (!blob) return
    saveBlob(blob, stampedName('png'))
    pushToast('Screenshot salvato in Download', 'shot')
  }, [engine])

  // WebM recording of the preview canvas — zero deps, saves on stop
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  // The chunks sit in RAM until stop: at 12 Mbps an hour is ~5 GB inside the
  // renderer that owns the engine and the audio. Stop and save before that.
  // ponytail: stream the chunks to disk through main — then a crash really
  // loses one second, as the 1 s timeslice promises.
  const REC_MAX_BYTES = 1.5e9
  const toggleRecording = useCallback(() => {
    if (recorderRef.current) {
      try { recorderRef.current.stop() } catch { /* already inactive */ }
      recorderRef.current = null
      setRecording(false)
      return
    }
    if (!canvasRef.current) return
    const stream = canvasRef.current.captureStream(60)
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9' : 'video/webm'
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
    } catch (e) {
      stream.getTracks().forEach(t => t.stop())
      pushToast(`Registrazione non disponibile: ${(e as Error).message}`, 'rec', undefined, 'err')
      return
    }
    const chunks: Blob[] = []
    let bytes = 0
    rec.ondataavailable = e => {
      if (e.data.size === 0) return
      chunks.push(e.data)
      bytes += e.data.size
      if (bytes > REC_MAX_BYTES && recorderRef.current === rec) {
        try { rec.stop() } catch { /* already inactive */ }
        recorderRef.current = null
        setRecording(false)
        pushToast('Registrazione fermata: limite memoria (1,5 GB) — file salvato', 'rec')
      }
    }
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      saveBlob(new Blob(chunks, { type: 'video/webm' }), stampedName('webm'))
      pushToast('Registrazione salvata in Download', 'rec')   // same key as the 1.5 GB stop: they collapse
    }
    try {
      rec.start(1000) // 1s chunks so a crash loses at most a second
    } catch (e) {
      stream.getTracks().forEach(t => t.stop())
      pushToast(`Registrazione non avviata: ${(e as Error).message}`, 'rec', undefined, 'err')
      return
    }
    recorderRef.current = rec
    setRecording(true)
  }, [])
  // a recording still running at unmount is saved, not leaked
  useEffect(() => () => { try { recorderRef.current?.stop() } catch { /* inactive */ } }, [])

  // GIF export: N seconds (or N bars at the current BPM) of the preview, looped, no dependencies
  const [gifMenu, setGifMenu] = useState(false)
  const [gifBusy, setGifBusy] = useState<string | null>(null)
  const [gifOpt, setGifOpt] = useState({ secs: 5, width: 480, bars: false })
  // the guard is a ref, not the state: two quick clicks read the same stale
  // closure and started two captures
  const gifRunning = useRef(false)
  const startGif = useCallback(async () => {
    const eng = engineRef.current
    if (!eng || gifRunning.current) return
    gifRunning.current = true
    setGifMenu(false)
    const bpmNow = eng.audioAnalyzer.getEffectiveBpm()
    const useBars = gifOpt.bars && bpmNow > 0
    // bars mode: 1 bar at 60-200 BPM is 1.2-4 s; 2 bars when that is under 3 s, so the loop is not a blink
    const bars = useBars ? (barsSeconds(1, bpmNow) < 3 ? 2 : 1) : 0
    const seconds = useBars ? barsSeconds(bars, bpmNow) : gifOpt.secs
    const fps = 15
    const { frames: total, delayCs } = gifTiming(seconds, fps)
    const src0 = canvasRef.current
    if (!src0) { gifRunning.current = false; return }
    const w = Math.min(gifOpt.width, src0.width)
    const h = Math.max(1, Math.round(w * src0.height / src0.width))
    const cv = document.createElement('canvas')
    cv.width = w; cv.height = h
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    const frames: { data: Uint8ClampedArray }[] = []
    setGifBusy('GIF 0%')
    const startedAt = performance.now()
    try {
      await new Promise<void>((resolve, reject) => {
        // an engine that stops emitting frames (lost context, dispose) must
        // not leave the button at "GIF n%" for ever
        const timeout = window.setTimeout(() => { off(); reject(new Error('nessun frame dal motore')) }, seconds * 3000 + 2000)
        const off = eng.onFrameRendered(canvas => {
          // frame k is due at k/total of the span: pace by clock, not by render count
          if (frames.length > (performance.now() - startedAt) / (seconds * 1000) * total) return
          ctx.drawImage(canvas, 0, 0, w, h)
          frames.push({ data: ctx.getImageData(0, 0, w, h).data })
          setGifBusy(`GIF ${Math.round(frames.length / total * 50)}%`)
          if (frames.length >= total) { clearTimeout(timeout); off(); resolve() }
        })
      })
      const bytes = await encodeGif(frames, {
        width: w, height: h, delayCs, dither: true,
        onProgress: (d, t) => setGifBusy(`GIF ${50 + Math.round(d / t * 50)}%`),
      })
      saveBlob(new Blob([bytes as BlobPart], { type: 'image/gif' }), stampedName('gif'))
      pushToast(`GIF salvata · ${seconds.toFixed(1)} s${useBars ? ` (${bars} ${bars === 1 ? 'battuta' : 'battute'} a ${Math.round(bpmNow)} BPM)` : ''} · ${w}×${h} · ${(bytes.length / 1048576).toFixed(1)} MB`, 'gif')
    } catch (e) {
      pushToast(`GIF non riuscita: ${(e as Error).message}`, 'gif', undefined, 'err')
    } finally {
      gifRunning.current = false
      setGifBusy(null)
    }
  }, [gifOpt])

  // I4 — reel: the last 15–30 s of the preview in 9:16, armed in the Outputs
  // panel, saved by V, the toolbar chip or (opt-in) the Auto VJ's drop. The
  // policy is in reel.ts; here only the 9:16 canvas and the two recorders.
  const [reelArmed, setReelArmed] = useState(false)
  const reelRef = useRef<{ save: () => void; drop: () => void } | null>(null)
  useEffect(() => {
    if (!engine) return
    let cur: ReelSettings | null = null
    let teardown: (() => void) | null = null
    const arm = (s: ReelSettings) => {
      teardown?.(); teardown = null; reelRef.current = null; setReelArmed(false)
      if (!s.enabled) return
      const W = s.height * 9 / 16, H = s.height
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      // captureStream samples the canvas at REEL_FPS: copying the full-size
      // WebGL frame into it on every rendered frame (60+) threw half the
      // copies away, on the render path
      let lastDraw = 0
      const minDt = 1000 / REEL_FPS - 2
      const unFrame = engine.onFrameRendered(src => {
        const t = performance.now()
        if (t - lastDraw < minDt) return
        lastDraw = t
        const [sx, sy, sw, sh] = cropRect(src.width, src.height)
        ctx.drawImage(src, sx, sy, sw, sh, 0, 0, W, H)
      })
      const stream = canvas.captureStream(REEL_FPS)
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
      const buf = new ReelBuffer<Blob>()
      const recs: (MediaRecorder | null)[] = [null, null]
      let pending: ReelLap<Blob> | null = null
      let warned = false
      const download = (lap: ReelLap<Blob>) => {
        saveBlob(new Blob(lap.chunks, { type: 'video/webm' }), reelFileName(new Date()))
        pushToast(`Reel salvato · ${Math.round((performance.now() - lap.startedAt) / 1000)} s · ${W}×${H}`, 'reel')
      }
      const tick = () => {
        const now = performance.now()
        for (const slot of buf.due(now)) {
          const old = recs[slot]
          try { if (old && old.state !== 'inactive') old.stop() } catch { /* already gone */ }
          // a recorder per lap: the old one's last chunk lands in its own lap.
          // In a setInterval a throw here repeated every second and the reel
          // silently stopped saving: one toast, and the slot stays empty.
          try {
            const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
            const lap = buf.started(slot, now)
            rec.ondataavailable = e => {
              if (e.data.size > 0) lap.chunks.push(e.data)
              if (pending === lap) { pending = null; download(lap) }
            }
            rec.start(CHUNK_MS)
            recs[slot] = rec
          } catch (e) {
            recs[slot] = null
            if (!warned) {
              warned = true
              console.error('[reel]', e)
              pushToast('Reel: registratore non disponibile', 'reel', undefined, 'err')
            }
          }
        }
      }
      tick()
      const timer = window.setInterval(tick, CHUNK_MS)
      let dropTimer = 0
      const save = () => {
        const best = buf.best(performance.now())
        if (!best) { pushToast('Reel: ancora niente in memoria', 'reel'); return }
        // the second in progress comes too: requestData flushes it, the handler saves
        pending = buf.laps[best.slot]
        recs[best.slot]?.requestData()
      }
      const drop = () => {
        if (!cur?.onDrop) return
        clearTimeout(dropTimer)
        dropTimer = window.setTimeout(save, DROP_DELAY_MS)
      }
      reelRef.current = { save, drop }
      setReelArmed(true)
      teardown = () => {
        clearInterval(timer); clearTimeout(dropTimer); pending = null
        for (const r of recs) if (r && r.state !== 'inactive') r.stop()
        stream.getTracks().forEach(t => t.stop())
        unFrame()
      }
    }
    // a checkbox must not throw away 30 s of buffer: rebuild only when the picture changes
    const apply = (s: ReelSettings) => {
      const rebuild = !cur || cur.enabled !== s.enabled || cur.height !== s.height
      cur = s
      if (rebuild) arm(s)
    }
    apply(loadReelSettings())
    const un = onReelSettings(apply)
    return () => { un(); teardown?.(); reelRef.current = null }
  }, [engine])

  const toggleVJ = useCallback((on: boolean) => {
    vjRef.current.setEnabled(on)
    setVjEnabled(on)
    if (on) setVjStatus({ current: '', count: 0, phase: 'groove' })
    // held is meaningless with the Auto VJ off; don't carry it into the next enable
    if (!on) { vjRef.current.setHeld(false); setVjHeld(false) }
    // Keep the phone remote honest — hotkeys/effect cmds disable AutoVJ silently
    try { window.api?.sendRemoteVj({ enabled: on, genre: vjRef.current.getGenre() }) } catch (_) {}
  }, [])

  const toggleVJHold = useCallback((held: boolean) => {
    vjRef.current.setHeld(held)
    setVjHeld(held)
  }, [])

  // A pick from the Pro grid or a Look Bank click takes over from the Auto VJ,
  // as 1-0, the phone, MIDI and the Simple grid already did: otherwise the
  // next scene replaced it and the click looked broken.
  // Returns what puts it back, for a held look that gets released.
  const onManual = useCallback(() => {
    if (!vjRef.current.isEnabled()) return undefined
    const heldWas = vjRef.current.isHeld()
    const restore = () => { toggleVJ(true); if (heldWas) toggleVJHold(true) }
    toggleVJ(false)
    pushToast('Auto VJ spento: scelta manuale', 'vj-manual', { label: 'Riattiva', fn: restore })
    return restore
  }, [toggleVJ, toggleVJHold])

  const changeVJGenre = useCallback((g: Genre) => {
    vjRef.current.setGenre(g)
    // the genre is the best tempo hint we have — center the BPM search on it
    engineRef.current?.audioAnalyzer.setTempoPrior(GENRE_CONFIGS[g].preferredBpm)
    setVjGenre(g)
    try { window.api?.sendRemoteVj({ enabled: vjRef.current.isEnabled(), genre: g }) } catch (_) {}
  }, [])

  // P2 — "posti": snapshot of the room, not of the show.
  const captureVenue = useCallback((name: string): Venue | null => {
    if (!engine) return null
    return {
      name,
      // outputRes/displayId describe the projector and stay for profiles saved
      // before multi-output existed; `outputs` is the whole room.
      outputRes,
      displayId: primaryOut.displayId,
      outputs,
      // output 1's corners, kept so a profile still validates as before
      keystone: primaryOut.keystone,
      brightness,
      audio: readJson(AUDIO_STORE_KEY, null),
      dmx: readJson(DMX_STORE_KEY, null),
    }
  }, [engine, outputRes, outputs, primaryOut, brightness])

  const applyVenue = useCallback((v: Venue) => {
    if (!engine) return
    // A profile saved before multi-output has only the projector: rebuild the
    // one-output list from it rather than making the old field a second truth.
    // One saved between multi-output and per-output keystone has outputs
    // without corners: the global ones it carries become output 1's.
    const res = parseRes(v.outputRes)
    const list = migrateKeystone(v.outputs ?? [{
      displayId: v.displayId, width: res?.[0] ?? 1920, height: res?.[1] ?? 1080,
      src: [0, 0, 1, 1], gamma: 1, brightness: 1,
    }], v.keystone)
    // A screen that is not plugged in tonight is dropped: sending an output to
    // a display id that is gone puts the show on nothing.
    const missing = list.filter(o => o.displayId !== null && !displays.some(d => d.id === o.displayId))
    setOutputs(list.map(o => missing.includes(o) ? { ...o, displayId: null } : o))

    engine.setBrightness(v.brightness); setBrightness(v.brightness)
    if (v.audio !== null) writeJson(AUDIO_STORE_KEY, v.audio)
    if (v.dmx !== null) { writeJson(DMX_STORE_KEY, v.dmx); notifyDmxConfigChanged() }
    setPanelEpoch(e => e + 1)
    pushToast(`Posto "${v.name}" caricato${missing.length ? ` (${missing.length} schermo/i non collegati)` : ''}`)
  }, [engine, displays, setOutputs])

  // U1.1 — PANIC: back to a clean, visible baseline in one gesture.
  // The current effect stays on purpose: switching it mid-panic is more jarring.
  // Undo: a P one key from [ wipes a post chain built by hand. The snapshot
  // survives a double P (the reflex in a panic), or the second one would
  // save the clean state and there would be nothing to go back to.
  const panicUndo = useRef<{
    at: number; preset: Preset; vj: boolean; held: boolean; intensity: number; roll: number
    brightness: number; blackout: boolean; frozen: boolean
    seq: { list: Sequence; step: number } | null
  } | null>(null)
  const seqNow = useRef(seqPlayer)
  seqNow.current = seqPlayer
  const panic = useCallback(() => {
    if (!engine) return
    const now = performance.now()
    if (!panicUndo.current || now - panicUndo.current.at > 5000) {
      const s = seqNow.current
      panicUndo.current = {
        at: now, preset: engine.createPreset('prima del panic'),
        vj: vjRef.current.isEnabled(), held: vjRef.current.isHeld(),
        intensity: intensityRef.current, roll: engine.getBeatRoll() as 0 | 4 | 8 | 16,
        brightness: engine.getBrightness(), blackout: engine.isBlackout(), frozen: engine.isFrozen(),
        seq: s.playing && s.playingSeq ? { list: s.playingSeq, step: s.stepIndex } : null,
      }
    }
    const u = panicUndo.current
    engine.setActivePosts([])
    engine.setCrossfade(0)
    engine.setMotionBlur(0)
    engine.setBrightness(1); setBrightness(1)
    engine.setBlackout(false); setBlackout(false)
    engine.setFreeze(false); setFrozen(false)
    // intensity and a latched beat-roll are often the very cause of a dirty
    // picture; a running playlist would re-dirty it at the next step
    engine.setIntensity(0); setIntensity(0)
    engine.setBeatRoll(0); setBeatRollUi(0)
    seqPlayer.stop()
    toggleVJ(false)
    pushToast(`PANIC · post, crossfade, intensità e beat-roll azzerati${u.vj ? ', Auto VJ spento' : ''}${u.seq ? ', scaletta fermata' : ''}`, 'panic-undo', {
      label: 'Annulla',
      fn: () => {
        engine.applyPreset(u.preset)
        engine.setIntensity(u.intensity); setIntensity(u.intensity)
        engine.setBeatRoll(u.roll as 0 | 4 | 8 | 16); setBeatRollUi(u.roll)
        engine.setBrightness(u.brightness); setBrightness(u.brightness)
        engine.setBlackout(u.blackout); setBlackout(u.blackout)
        engine.setFreeze(u.frozen); setFrozen(u.frozen)
        if (u.vj) { toggleVJ(true); if (u.held) toggleVJHold(true) }
        if (u.seq) seqNow.current.start(u.seq.list, u.seq.step)
        panicUndo.current = null   // spent: a later P must snapshot afresh
      },
    })
  }, [engine, toggleVJ, toggleVJHold, seqPlayer.stop])

  // One word for the state of the wall, on the preview's frame and tag. The
  // output window closed means the preview is only a preview: saying IN ONDA
  // would be false. Black also with the master at zero, as the banner does.
  const wallState: WallState = !outputInfo?.open ? 'off' : blackout || brightness < 0.05 ? 'black' : frozen ? 'frozen' : 'air'

  const changeMode = useCallback((m: UIMode) => {
    setMode(m)
    writeString(MODE_KEY, m)
  }, [])

  const finishOnboarding = useCallback(async (result: OnboardingResult | null) => {
    writeString(ONBOARDED_KEY, '1')
    setShowOnboarding(false)
    if (!result || !engine) return
    changeVJGenre(result.genre)
    if (result.autoVJ) toggleVJ(true)
    try {
      await engine.audioAnalyzer.start(result.deviceId || undefined)
    } catch (err) {
      console.error('[App] onboarding audio start failed:', err)
      pushToast(`Audio non avviato: ${(err as Error).message} — scegli l'ingresso nel pannello Audio`, 'onboarding-audio', undefined, 'err')
    }
  }, [engine, changeVJGenre, toggleVJ])

  // DMX PARs and pixel map follow the show in every mode, not only with the Pro panel mounted
  useDmxOutput(engine)
  // Last session's input and analyser settings come back in every mode too:
  // this lived in AudioPanel, which Live mode never mounts, so an app
  // restarted in Live sat silent with default settings
  useAudioRestore(engine, panelEpoch)

  // Tap tempo from Space, the phone and MIDI: leaving auto detection is said once
  const tapBpm = useCallback(() => {
    const a = engine?.audioAnalyzer
    if (!a) return
    if (a.getBpmMode() === 'auto') pushToast('Tap: rilevamento automatico disattivato', 'bpm-manual')
    a.setBpmMode('tap')
    a.tap()
  }, [engine])

  // Live performance hotkeys:
  // B blackout · F freeze · [ ] master · 1-0 effects · QWER post toggles · Space tap BPM
  // Every one of those latches on a tap and is momentary on a hold — see momentary.ts.
  useEffect(() => {
    if (!engine) return
    const onKey = (e: KeyboardEvent) => {
      if (shouldIgnoreHotkey(e)) return

      const k = e.key.toLowerCase()

      // Auto-repeat would re-press a key that is already down and overwrite
      // the state captured to go back to — and holding B should not strobe
      // the blackout either.
      if (e.repeat || momentary.isDown(k)) return

      // The engine is driven in the keydown itself, through the mirror refs:
      // inside a setState updater React ran it later, and twice under
      // StrictMode — so the momentary release was registered twice and dev and
      // prod behaved differently on the most critical gesture of the night.
      if (k === 'b') {
        const prev = blackoutRef.current
        blackoutRef.current = !prev
        engine.setBlackout(!prev); setBlackout(!prev)
        momentary.press(k, () => { blackoutRef.current = prev; engine.setBlackout(prev); setBlackout(prev) })
      } else if (k === 'f') {
        const prev = frozenRef.current
        frozenRef.current = !prev
        engine.setFreeze(!prev); setFrozen(!prev)
        momentary.press(k, () => { frozenRef.current = prev; engine.setFreeze(prev); setFrozen(prev) })
      } else if (k === 'i') {
        // The macro as a key: held it is momentary, tapped it latches — the
        // same rule as everything else. A fader you have to find in the dark
        // is not a fader you will use.
        const prev = intensityRef.current
        const next = prev > 0 ? 0 : 1
        intensityRef.current = next
        engine.setIntensity(next); setIntensity(next)
        momentary.press(k, () => { intensityRef.current = prev; engine.setIntensity(prev); setIntensity(prev) })
      } else if (k === ',' || k === '.' || (!e.shiftKey && (k === '/' || e.code === 'Slash'))) {
        // Beat-roll: the clocks loop over a quarter, an eighth or a sixteenth
        // of a beat. Held it stutters while you hold; tapped it latches, and
        // the same key taps it off. On IT/DE layouts Shift+7 is '/', the same
        // key that recalls look 7: the physical key next to '.' (e.code Slash,
        // '-' on IT) is the sixteenth there, Shift excluded.
        const division = k === ',' ? 4 : k === '.' ? 8 : 16
        const prev = engine.getBeatRoll() as 0 | 4 | 8 | 16
        engine.setBeatRoll(prev === division ? 0 : division)
        setBeatRollUi(engine.getBeatRoll())
        momentary.press(k, () => { engine.setBeatRoll(prev); setBeatRollUi(engine.getBeatRoll()) })
      } else if (k === 'p') {
        panic()
      } else if (k === 'v') {
        if (reelRef.current) reelRef.current.save()
        else pushToast('Reel spento — attivalo in PRO, pannello Uscite', 'reel')
      } else if (e.key === '?') {
        // U2.2 — Shift+/ apre/chiude direttamente la cheat sheet
        setShowCheatSheet(prev => !prev)
      } else if (e.key === '[' || e.key === ']') {
        const v = e.key === '[' ? Math.max(0, brightnessRef.current - 0.05) : Math.min(1, brightnessRef.current + 0.05)
        brightnessRef.current = v
        engine.setBrightness(v); setBrightness(v)
      } else if (!e.shiftKey && k >= '0' && k <= '9') {
        // Shift+digit is the Look Bank's, and it handles its own hold.
        const idx = k === '0' ? 9 : parseInt(k) - 1
        const effect = HOTKEY_EFFECTS[idx]
        if (effect) {
          const before = engine.getCurrentEffect()
          // "held = momentary, let go and it comes back": the Auto VJ too
          const vjWas = vjRef.current.isEnabled(), heldWas = vjRef.current.isHeld()
          toggleVJ(false)
          pickEffect(engine, effect)
          momentary.press(k, () => {
            engine.setEffect(before)
            if (vjWas) { toggleVJ(true); if (heldWas) toggleVJHold(true) }
          })
        }
      } else if (k in HOTKEY_POSTS) {
        const id = HOTKEY_POSTS[k]
        const was = engine.isPostActive(id)
        engine.togglePost(id)
        momentary.press(k, () => { if (engine.isPostActive(id) !== was) engine.togglePost(id) })
      } else if (k === ' ') {
        e.preventDefault()
        tapBpm()
      }
    }

    // Hold it and it is momentary; tap it and it latches. One key, both.
    const onKeyUp = (e: KeyboardEvent) => { momentary.release(e.key.toLowerCase()) }
    // A keyup that never arrives (the window lost focus mid-hold) would leave
    // the key logically down for ever, and the next press would be ignored.
    const onBlur = () => momentary.clear()

    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      momentary.clear()
    }
  }, [engine, toggleVJ, toggleVJHold, panic, tapBpm])

  // Focus left on a clicked control made the hotkeys deaf: B after the master
  // fader did nothing, and Space re-pressed the BLACK or PANIC just clicked
  // (a focused button owns Space, see hotkeys.ts). A mouse click gives the
  // focus back; a keyboard activation (detail 0, :focus-visible) keeps it, so
  // Tab navigation still works. Capture: React stops some clicks bubbling.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) return
      const btn = (e.target as HTMLElement | null)?.closest?.('button')
      if (btn && btn === document.activeElement) btn.blur()
      // a checkbox owns Space too; a click on its label focuses it only after
      // this capture listener, hence the deferred read
      setTimeout(() => {
        const a = document.activeElement
        if (a instanceof HTMLInputElement && (a.type === 'checkbox' || a.type === 'radio')) a.blur()
      }, 0)
    }
    // a select keeps the focus after a pick and a digit then type-aheads it
    const onChange = (e: Event) => {
      const el = e.target
      if (el instanceof HTMLSelectElement && !el.matches(':focus-visible')) el.blur()
    }
    window.addEventListener('click', onClick, true)
    window.addEventListener('change', onChange, true)
    return () => {
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('change', onChange, true)
    }
  }, [])

  // What the phone shows beyond the engine snapshot: BPM mode, Auto VJ scenes,
  // loaded overlays. Pushed on change (1s tick + after every command).
  const phoneExtSig = useRef('')
  const pushPhoneExt = useCallback(() => {
    if (!engine) return
    const vj = vjRef.current
    const genre = vj.getGenre()
    const ext = {
      bpmMode: engine.audioAnalyzer.getBpmMode(),
      manualBpm: engine.audioAnalyzer.getManualBpm(),
      phase: vj.getPhase(),
      onlyMine: getOnlyMine(),
      scenes: loadUserScenes().filter(sc => sc.genre === genre).length,
      favs: getFavs(),
      audio: engine.audioAnalyzer.getStatus(),
      overlays: engine.getOverlays().filter(o => !o.id.startsWith('seq:')).slice(0, 24)
        .map(o => ({ id: o.id, name: o.name.slice(0, 40), visible: o.visible, opacity: Math.round(o.opacity * 100) / 100 })),
    }
    const sig = JSON.stringify(ext)
    if (sig === phoneExtSig.current) return
    phoneExtSig.current = sig
    try { window.api?.sendRemoteExt(ext) } catch (_) {}
  }, [engine])
  useEffect(() => {
    if (!engine) return
    // deliberately NOT gated on document.visibilityState like the other
    // polls below: the phone remote is meant to keep working while the
    // control window is minimized or backgrounded (that's the point of a
    // remote), so pausing this one on hide would silently break it
    pushPhoneExt()
    const t = window.setInterval(pushPhoneExt, 1000)
    return () => clearInterval(t)
  }, [engine, pushPhoneExt])

  // Shared command dispatch — phone remote, OSC (via remote:cmd) and MIDI all
  // land here so every surface drives the engine identically
  const dispatchCmd = useCallback((raw: { type: string; value?: unknown; source?: string; hold?: string }) => {
    if (!engine) return
    // phone, OSC and MIDI can send anything: nothing unvalidated reaches the engine
    const cmd = sanitizeCmd(raw, KNOWN)
    if (!cmd) return
    const v = cmd.value as any

    // The phone sends a press and a release, so a look or a post-FX held with
    // a thumb behaves like a held key. `hold` names the press; `release`
    // undoes it if it lasted.
    if (cmd.type === 'release') { momentary.release(`remote:${v}`, cmd.heldMs); return }
    if (cmd.hold) {
      if (cmd.type === 'look') {
        const before = engine.createPreset('prima del richiamo')
        const vjWas = vjRef.current.isEnabled(), heldWas = vjRef.current.isHeld()
        momentary.press(`remote:${cmd.hold}`, () => {
          engine.applyPreset(before)
          if (vjWas) { toggleVJ(true); if (heldWas) toggleVJHold(true) }
        })
      } else if (cmd.type === 'post') {
        const id = v as PostId
        const was = engine.isPostActive(id)
        momentary.press(`remote:${cmd.hold}`, () => {
          if (engine.isPostActive(id) !== was) engine.togglePost(id)
        })
      }
    }

    switch (cmd.type) {
        case 'panic': panic(); break
        case 'effect': toggleVJ(false); pickEffect(engine, v); break
        case 'post': engine.togglePost(v); break
        case 'postClear': engine.setActivePosts([]); break
        case 'palette': engine.setColors(v[0], v[1], v[2]); break
        case 'crossfade': engine.setCrossfade(v); break
        case 'deckB': engine.setDeckBEffect(v); break
        case 'brightness': setBrightness(v); engine.setBrightness(v); break
        case 'blackout': setBlackout(!!v); engine.setBlackout(!!v); break
        case 'freeze': setFrozen(!!v); engine.setFreeze(!!v); break
        case 'autovj': toggleVJ(v === '__toggle__' ? !vjRef.current.isEnabled() : !!v); break
        case 'genre': changeVJGenre(v); break
        case 'postAmount': engine.setPostAmount(v.id, v.value); break
        case 'postMove': engine.movePost(v.id, v.delta); break
        case 'grade': engine.setGrade({ [v.key]: v.value }); break
        case 'motionBlur': engine.setMotionBlur(v); break
        case 'intensity': setIntensity(v); engine.setIntensity(v); break
        case 'lineBoost': engine.setLineBoost(v); break
        case 'presence': engine.setPresence(v); break
        case 'camera': engine.setCamera(v); break
        case 'cameraReset': engine.resetCamera(); break
        case 'blendMode': engine.setBlendMode(v); break
        case 'maskSoft': engine.setMaskSoft(v); break
        case 'param': engine.setParamValue(v.key, v.value); break
        case 'paramMap': engine.setParamMapping(v.key, v.source, v.depth); break
        case 'transitionType': engine.setTransitionType(v); break
        case 'transitionDuration': engine.setTransitionDuration(v); break
        case 'look': {
          // Same source LookBank reads. This used to re-read the raw key by
          // hand, so a change to the key or the shape broke the phone and MIDI
          // triggers in silence.
          const slot = getLook(v)
          if (slot?.preset) { toggleVJ(false); engine.applyPreset(slot.preset) }
          break
        }
        case 'seqStart': case 'seqNext': case 'seqPrev': case 'seqStop': seqCommand(cmd.type, v); break
        case 'paletteStep': {
          const p = stepPalette(allPalettes(), engine.createPreset('').colors, v)
          if (p) engine.setColors(p.colors[0], p.colors[1], p.colors[2])
          break
        }
        case 'bpmMode': engine.audioAnalyzer.setBpmMode(v); break
        case 'bpmScale': {
          // a detector locked on half/double tempo: same snap as the audio panel
          const a = engine.audioAnalyzer
          const next = Math.round(Math.max(60, Math.min(300, a.getEffectiveBpm() * v)))
          a.setBpmMode('manual'); a.setManualBpm(next)
          break
        }
        case 'bpmSet': engine.audioAnalyzer.setBpmMode('manual'); engine.audioAnalyzer.setManualBpm(v); break
        case 'videoDeck': {
          const patch = { ...v }
          if (patch.clip !== undefined && patch.clip >= engine.getVideoDeck().clips.length) delete patch.clip
          engine.setVideoDeck(patch)
          break
        }
        case 'cycle': {
          // the cycle needs two palettes at least: with none chosen it walks them all
          if (v.enabled && engine.getCyclePalettes().length < 2) engine.setCyclePalettes(allPalettes().map(p => p.colors))
          if (v.intervalMs !== undefined) engine.setCycleInterval(v.intervalMs)
          if (v.beatSync !== undefined) engine.setCycleBeatSync(v.beatSync)
          if (v.beatsPerSwitch !== undefined) engine.setCycleBeatsPerSwitch(v.beatsPerSwitch)
          if (v.enabled !== undefined) engine.setCycleEnabled(v.enabled)
          break
        }
        case 'overlay': {
          if (!engine.getOverlays().some(o => o.id === v.id)) break   // gone since the last poll
          engine.updateOverlay(v.id, { ...(v.visible !== undefined ? { visible: v.visible } : {}), ...(v.opacity !== undefined ? { opacity: v.opacity } : {}) })
          break
        }
        case 'onlyMine': {
          setOnlyMine(!!v)
          vjRef.current.setUserScenes(userScenesByGenre(loadUserScenes()), !!v)
          window.dispatchEvent(new Event(USER_SCENES_EVENT))
          break
        }
        case 'saveScene': {
          const vj = vjRef.current
          const list = [...loadUserScenes(), sceneFromLook(engine, vj.getGenre(), vj.getPhase())]
          if (!saveUserScenes(list)) break   // not on disk = not a scene: the toast already said why
          vj.setUserScenes(userScenesByGenre(list), getOnlyMine())
          window.dispatchEvent(new Event(USER_SCENES_EVENT))
          break
        }
        case 'tap': tapBpm(); break
    }
    // U1.4 — toast for external surfaces (phone/OSC). MIDI cmds arrive without
    // source and stay silent: MIDI is the operator's own hands.
    // Keyed on cmd.type so a slider stream collapses into one updating toast.
    if (cmd.source) pushToast(`${cmdToastLabel(cmd.type, v)} · ${cmd.source}`, cmd.type)
    if (!EXT_STABLE.has(cmd.type)) pushPhoneExt()
  }, [engine, pushPhoneExt, toggleVJ, toggleVJHold, changeVJGenre, panic, tapBpm])

  // The Auto VJ and a playlist would fight for the wall: the playlist wins,
  // when it starts and if the Auto VJ is turned on under it, from any surface.
  useEffect(() => {
    if (seqPlayer.playing && vjRef.current.isEnabled()) {
      toggleVJ(false)
      pushToast('Auto VJ spento: guida la scaletta', 'vj-seq')
    }
  }, [seqPlayer.playing, vjEnabled, toggleVJ])

  // A controller whose cable drops goes quiet with no word anywhere but the
  // MIDI panel, collapsed and Pro-only. The bottom bar is in every mode.
  const [midiLost, setMidiLost] = useState(false)
  useEffect(() => {
    let seen = midi.deviceNames.length > 0
    const check = () => {
      if (midi.deviceNames.length > 0) seen = true
      setMidiLost(seen && midi.deviceNames.length === 0)   // same boolean = no re-render
    }
    const off = midi.onChange(check)
    check()
    return off
  }, [])

  // MIDI and gamepad start with the engine, whatever the layout. They used to
  // start in MidiPanel's effect — mounted in Pro mode only — so a show run in
  // Live (or the default Simple) had dead controllers until Pro was opened
  // once, and after leaving Pro they kept a dispatch from a stale closure.
  // The ref keeps the dispatch current without restarting anything.
  const dispatchRef = useRef(dispatchCmd)
  dispatchRef.current = dispatchCmd
  useEffect(() => {
    if (!engine) return
    const d = (c: { type: string; value?: unknown }) => dispatchRef.current(c)
    void midi.start(engine, d)
    gamepad.start(engine, d)
  }, [engine])

  // Phone remote / OSC → engine (commands arrive from the main process)
  useEffect(() => {
    if (!engine) return
    return window.api.onRemoteCommand(dispatchCmd)
  }, [engine, dispatchCmd])

  // Pro DJ Link beats → the analyzer's clock (main only listens while the mode is on)
  useEffect(() => {
    if (!engine) return
    const offBeat = window.api.onProLinkBeat(b => engine.audioAnalyzer.proLink.onBeat(b, performance.now()))
    const offDevices = window.api.onProLinkDevices(d => engine.audioAnalyzer.proLink.setDevices(d))
    const offTrack = window.api.onProLinkTrack(t => engine.noteProLinkTrack(t.trackId))
    return () => { offBeat(); offDevices(); offTrack() }
  }, [engine])

  // Strumenti menu: closes on Esc and on a click outside (the GIF menu never did)
  const [toolsOpen, setToolsOpen] = useState(false)
  /** the scaletta picked in the Live Regia, before it starts */
  const [liveSeq, setLiveSeq] = useState(0)
  const toolsRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!toolsOpen) return
    const onDown = (e: MouseEvent) => { if (!toolsRef.current?.contains(e.target as Node)) { setToolsOpen(false); setGifMenu(false) } }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setToolsOpen(false); setGifMenu(false) } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [toolsOpen])

  // The pieces that move between the top bar (Simple, Pro) and the Live rail:
  // one handler each, rendered in exactly one place per mode. beatDotRef is a
  // single ref, so the tempo block is mounted once.
  const tempo = (
    <>
      <span
        ref={beatDotRef}
        className={`beat-dot${audioStatus === 'running' ? '' : ' beat-dot-off'}`}
        title={audioStatus === 'running' ? 'Audio attivo — lampeggia sul beat' : audioStatus === 'reconnecting' ? 'Audio perso — riconnessione…' : 'Audio fermo'}
      />
      <span className="tb-bpm" title="BPM rilevato (la modalita' BPM si cambia da Regolazioni audio, in Simple o Pro)">
        <b>{audioStatus === 'running' && bpm > 0 ? bpm : '—'}</b> BPM
      </span>
    </>
  )
  const faders = (
    <>
      <label className="fader" title="Intensità: un comando invece di cinque cursori — a zero la scena e' quella che hai impostato (I)">
        <span className="deck-label">Intensità</span>
        <input
          className="tb-master"
          type="range" min={0} max={1} step={0.01}
          value={intensity}
          style={{ '--p': `${intensity * 100}%` } as React.CSSProperties}
          onChange={e => {
            const v = parseFloat(e.target.value)
            setIntensity(v)
            engine?.setIntensity(v)
          }}
        />
        <span className="fader-value">{Math.round(intensity * 100)}%</span>
      </label>
      <label className="fader" title="Luminosità master ([ / ])">
        <span className="deck-label">Master</span>
        <input
          className="tb-master"
          type="range" min={0} max={1} step={0.01}
          value={brightness}
          style={{ '--p': `${brightness * 100}%` } as React.CSSProperties}
          onChange={e => {
            const v = parseFloat(e.target.value)
            setBrightness(v)
            engine?.setBrightness(v)
          }}
        />
        <span className="fader-value">{Math.round(brightness * 100)}%</span>
      </label>
    </>
  )
  const safety = (
    <>
      <button
        className={`btn btn-emg btn-black${blackout ? ' on' : ''}`}
        onClick={() => { const v = !blackout; setBlackout(v); engine?.setBlackout(v) }}
        aria-pressed={blackout}
        title="Blackout (B)"
      >
        BLACK<kbd className="emg-key" aria-hidden="true">B</kbd>
      </button>
      <button
        className={`btn btn-emg btn-freeze${frozen ? ' on' : ''}`}
        onClick={() => { const v = !frozen; setFrozen(v); engine?.setFreeze(v) }}
        aria-pressed={frozen}
        title="Freeze (F)"
      >
        FREEZE<kbd className="emg-key" aria-hidden="true">F</kbd>
      </button>
      <button
        className="btn btn-emg btn-panic"
        onClick={panic}
        title="PANIC — azzera post, crossfade, motion blur, intensità, beat-roll, blackout e freeze, ferma scaletta e Auto VJ (P)"
      >
        PANIC<kbd className="emg-key" aria-hidden="true">P</kbd>
      </button>
    </>
  )
  const recButton = (
    <button
      className={`btn btn-sm${recording ? ' btn-danger' : ''}`}
      onClick={toggleRecording}
      title={recording ? 'Ferma e salva la registrazione WebM' : 'Registra la preview in WebM'}
      aria-label={recording ? 'Ferma e salva la registrazione WebM' : 'Registra la preview in WebM'}>
      {recording ? <><IconStop /> REC</> : <><IconRecord />{mode === 'live' ? ' Registra' : ''}</>}
    </button>
  )

  return (
    <div className={`app-layout mode-${mode}`}>
      {/* modals get a boundary each, like the panels: a throw in one must not take App (and the engine) down */}
      {showOnboarding && <PanelBoundary name="Configurazione"><Onboarding onDone={finishOnboarding} /></PanelBoundary>}
      {showRemote && <PanelBoundary name="Remote"><RemoteModal onClose={() => setShowRemote(false)} /></PanelBoundary>}
      {showSoundcheck && (
        <PanelBoundary name="Soundcheck">
          <Soundcheck engine={engine} outputRes={outputRes} onClose={() => setShowSoundcheck(false)} />
        </PanelBoundary>
      )}
      {showHelpMenu && (
        <PanelBoundary name="Aiuto">
          <HelpMenu
            onShortcuts={() => { setShowHelpMenu(false); setShowCheatSheet(true) }}
            onGuide={() => { setShowHelpMenu(false); setShowQuickGuide(true) }}
            onOnboarding={() => { setShowHelpMenu(false); setShowOnboarding(true) }}
            onClose={() => setShowHelpMenu(false)}
          />
        </PanelBoundary>
      )}
      {showCheatSheet && <PanelBoundary name="Scorciatoie"><CheatSheet onClose={() => setShowCheatSheet(false)} /></PanelBoundary>}
      {showQuickGuide && <PanelBoundary name="Guida"><QuickGuide onClose={() => setShowQuickGuide(false)} /></PanelBoundary>}

      {/* Top bar: one row. Identity · mode · faders · BLACK FREEZE PANIC · output · tools.
          In Live the faders and the trio live in the rail on the right and the
          tools fold into the Strumenti menu, so nothing moves during a set. */}
      <div className="top-bar">
        <div className="tb-group">
          <span className="tb-eye"><IconEye /></span>
          <span className="title">DJtoGraphikz</span>
          {mode !== 'live' && tempo}
        </div>

        {/* Simple / Pro / Live switch */}
        <div className="tb-group">
          <div className="mode-switch">
            <button
              className={mode === 'simple' ? 'active' : ''}
              aria-pressed={mode === 'simple'}
              onClick={() => changeMode('simple')}
              title="Modalità Simple — controlli essenziali"
            >
              SIMPLE
            </button>
            <button
              className={mode === 'pro' ? 'active' : ''}
              aria-pressed={mode === 'pro'}
              onClick={() => changeMode('pro')}
              title="Modalità Pro — tutti i pannelli"
            >
              PRO
            </button>
            <button
              className={mode === 'live' ? 'active' : ''}
              aria-pressed={mode === 'live'}
              onClick={() => changeMode('live')}
              title="Modalità Live — solo preview e Look Bank"
            >
              LIVE
            </button>
          </div>
        </div>

        {mode !== 'live' && (
          <>
            <div className="tb-group tb-faders">{faders}</div>
            <div className="tb-group tb-safety">{safety}</div>
          </>
        )}
        {seqPlayer.playing && seqPlayer.playingSeq && mode !== 'live' && (
          // a playlist started from the phone drove the wall with no trace in Simple
          <button
            className="btn btn-sm"
            style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            onClick={seqPlayer.stop}
            title="Ferma la scaletta"
          >
            ■ {seqPlayer.playingSeq.name} {seqPlayer.stepIndex + 1}/{seqPlayer.playingSeq.steps.length}
          </button>
        )}

        <div className="spacer" />

        <div className="tb-group tb-right">
          {mode !== 'live' && (
            <button className="btn btn-sm" onClick={screenshot} title="Screenshot PNG" aria-label="Screenshot PNG">
              <IconCamera />
            </button>
          )}
          {(recording || mode !== 'live') && recButton}
          {mode !== 'live' && (
            <button className="btn btn-sm" onClick={() => setShowRemote(true)} title="Remote dal telefono (QR + codice)" aria-label="Remote dal telefono (QR + codice)">
              <IconPhone />
            </button>
          )}
          {outputInfo && (outputInfo.open ? (
            <span className="chip output-chip" title="Stato della finestra di output">
              <IconMonitor size={14} />
              <span className="output-chip-name">Output · {outputInfo.display}{outputInfo.fullscreen ? ' · FS' : ''}
              {(outputInfo.count ?? 1) > 1 ? ` +${(outputInfo.count ?? 1) - 1}` : ''}</span>
              {(outputInfo.count ?? 1) < outputs.length && (
                // a secondary wall that closed or crashed out: main recreates the missing ones on the list
                <button className="btn btn-sm output-reopen" onClick={() => window.api?.setOutputs?.(outputs)} title="Un'uscita secondaria è chiusa — riaprila">
                  Riapri uscite
                </button>
              )}
            </span>
          ) : (
            <button
              className="btn btn-sm output-reopen"
              onClick={() => window.api?.reopenOutput?.()}
              title="La finestra di output è chiusa — riaprila"
            >
              <IconMonitor size={14} />
              Riapri output
            </button>
          ))}
          <span className="tb-tools" ref={toolsRef}>
            <button
              className={`btn btn-sm${toolsOpen ? ' active' : ''}`}
              onClick={() => setToolsOpen(o => !o)}
              aria-expanded={toolsOpen}
              title="Strumenti: foto, registrazione, GIF, reel, telefono, soundcheck, uscita"
            >
              {gifBusy ?? 'Strumenti'} ▾
            </button>
            {toolsOpen && (
              <div className="tb-menu" role="menu">
                {mode === 'live' && (
                  <>
                    <button className="btn btn-sm" onClick={screenshot} title="Screenshot PNG"><IconCamera /> Foto</button>
                    {!recording && recButton}
                    <button className="btn btn-sm" onClick={() => { setShowRemote(true); setToolsOpen(false) }} title="Remote dal telefono (QR + codice)"><IconPhone /> Telefono</button>
                  </>
                )}
                <button className="btn btn-sm" disabled={!!gifBusy}
                  onClick={() => setGifMenu(m => !m)}
                  title="Esporta una GIF in loop dalla preview"
                  aria-expanded={gifMenu}>
                  {gifBusy ?? 'GIF…'}
                </button>
                {gifMenu && (
                  <div className="tb-menu-sub">
                    <label>Durata
                      <select value={gifOpt.secs} disabled={gifOpt.bars && bpm > 0}
                        onChange={e => setGifOpt(o => ({ ...o, secs: +e.target.value }))}>
                        {[3, 5, 8].map(s => <option key={s} value={s}>{s} s</option>)}
                      </select>
                    </label>
                    <label>Larghezza
                      <select value={gifOpt.width} onChange={e => setGifOpt(o => ({ ...o, width: +e.target.value }))}>
                        {[320, 480, 640].map(s => <option key={s} value={s}>{s} px</option>)}
                      </select>
                    </label>
                    <label title={bpm > 0 ? 'Cattura 1-2 battute esatte al BPM corrente: il loop non scatta' : 'BPM non rilevato: usa i secondi'}>
                      <input type="checkbox" checked={gifOpt.bars} disabled={!(bpm > 0)}
                        onChange={e => setGifOpt(o => ({ ...o, bars: e.target.checked }))} />
                      Loop a battuta
                    </label>
                    <button className="btn btn-sm btn-primary" onClick={() => { startGif(); setToolsOpen(false) }}>Cattura GIF</button>
                  </div>
                )}
                {reelArmed && (
                  <button className="btn btn-sm" onClick={() => reelRef.current?.save()}
                    title="Reel armato: salva gli ultimi 15–30 s in 9:16 (V)">
                    <span style={{ color: 'var(--state-on)' }}>●</span> Salva reel
                  </button>
                )}
                <button className="btn btn-sm" onClick={() => { setShowSoundcheck(true); setToolsOpen(false) }} title="Soundcheck: ingresso, proiettore, fps, DMX, telefono e disco in pochi secondi">
                  Soundcheck
                </button>
                {displays.length > 1 && (
                  <label>Output su
                    <select
                      className="tb-select"
                      value={primaryOut.displayId ?? ''}
                      onChange={e => {
                        const id = parseInt(e.target.value)
                        if (!isNaN(id)) setOutputs(outputs.map((o, i) => i === 0 ? { ...o, displayId: id } : o))
                      }}
                      title="Sposta la finestra di output su un display"
                    >
                      <option value="" disabled>Output su…</option>
                      {displays.map(d => (
                        <option key={d.id} value={d.id}>{d.label}{d.primary ? ' (primario)' : ''}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label>Risoluzione
                  <select
                    className="tb-select"
                    value={outputRes}
                    onChange={e => {
                      const [w, h] = e.target.value.split('x').map(Number)
                      setOutputs(outputs.map((o, i) => i === 0 ? { ...o, width: w, height: h } : o))
                    }}
                    title="Risoluzione di uscita del proiettore"
                  >
                    <option value="1280x720">720p</option>
                    <option value="1920x1080">1080p</option>
                    <option value="2560x1440">1440p</option>
                    <option value="3840x2160">4K</option>
                    {/* the Uscite panel allows any size — never show a wrong value here */}
                    {!['1280x720', '1920x1080', '2560x1440', '3840x2160'].includes(outputRes) && (
                      <option value={outputRes}>{outputRes}</option>
                    )}
                  </select>
                </label>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    window.api?.toggleOutputFullscreen()
                    // fullscreen flips have no dedicated event — re-read after the switch
                    setTimeout(refreshOutputInfo, 400)
                  }}
                  title="Fullscreen della finestra di output">
                  <IconFullscreen /> Fullscreen output
                </button>
              </div>
            )}
          </span>
          <button
            className="btn btn-sm"
            onClick={() => setShowHelpMenu(v => !v)}
            title="Aiuto — scorciatoie, guida, configurazione (?)"
           aria-label="Aiuto — scorciatoie, guida, configurazione (?)">
            <IconHelp />
          </button>
        </div>
      </div>

      {/* Banners: one stack. Static in Simple and Pro; in Live it floats over
          the monitor, so pads and rail never move while something is wrong. */}
      <div className="banner-stack">
      {gpuLost && <div className="audio-banner">⚠ Preview persa (contesto grafico), ripristino in corso… il proiettore ha il suo motore</div>}
      {/* U1.2 — slim static banner: layout shifts once, no overlay on the preview */}
      {audioStatus === 'reconnecting' && (
        <div className="audio-banner">⚠ Audio perso — riconnessione in corso…</div>
      )}
      {/* Live has no Audio panel: an input that never came up (permission,
          card busy) had only a grey dot. A stop by the user is not a condition. */}
      {mode === 'live' && engine && audioStatus === 'stopped' && !engine.audioAnalyzer.isUserStopped() && (
        <div className="audio-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--s5)' }}>
          <span>⚠ Audio fermo{engine.audioAnalyzer.lastError ? ` — ${engine.audioAnalyzer.lastError}` : ''}</span>
          <button className="btn btn-sm" onClick={() => {
            const a = engine.audioAnalyzer, s = loadAudioSettings()
            // start() rebuilds the graph: the saved settings go back in after it
            a.start(s.deviceId).then(() => {
              a.setSensitivity(s.sensitivity ?? 0.5); a.setInputGain(s.inputGain ?? 1)
              a.setBpmMode(s.bpmMode ?? 'auto'); a.setManualBpm(s.manualBpm ?? 128)
            }).catch(err => pushToast(`Audio non avviato: ${(err as Error).message}`, 'audio-retry', undefined, 'err'))
          }}>Riprova</button>
        </div>
      )}

      {/* The projector must never be black without saying why: a blackout left
          on (or the master pulled down) looked exactly like a broken output. */}
      {(blackout || brightness < 0.05) && (
        <div className="black-banner">
          <span>
            ⬛ <strong>PROIETTORE NERO</strong> — {blackout ? 'blackout attivo (tasto B)' : 'master a 0%'}
          </span>
          <button
            className="btn btn-sm"
            onClick={() => {
              if (blackout) { setBlackout(false); engine?.setBlackout(false) }
              if (brightness < 0.05) { setBrightness(1); engine?.setBrightness(1) }
            }}
          >
            Ripristina
          </button>
        </div>
      )}
      </div>

      {/* Main layout — U4.1: in live niente sidebar, solo preview + Look Bank */}
      <div className={`main-area${mode === 'live' ? ' live-layout' : ''}`}>
        {/* Left sidebar */}
        {mode !== 'live' && (
        <div className={`sidebar${mode === 'simple' ? ' sidebar-wide' : ''}`}>
          {/* one PanelBoundary per panel: a panel that throws must not unmount App, which owns the engine */}
          {mode === 'simple' ? (
            <PanelBoundary name="Semplice">
              <SimplePanel
                vjEnabled={vjEnabled}
                vjGenre={vjGenre}
                vjStatus={vjStatus}
                vjHeld={vjHeld}
                onVJToggle={toggleVJ}
                onVJGenre={changeVJGenre}
                onVJHold={toggleVJHold}
                flow={flow}
                bpm={bpm}
                audio={
                  <PanelBoundary key={panelEpoch} name="Audio">
                    <AudioPanel engine={engine} phase={vjEnabled ? vjStatus.phase : null} variant="simple" />
                  </PanelBoundary>
                }
              />
            </PanelBoundary>
          ) : (
            <>
              <PanelBoundary key={panelEpoch} name="Audio">
                <AudioPanel engine={engine} phase={vjEnabled ? vjStatus.phase : null} />
              </PanelBoundary>
              {!fxCenter && <PanelBoundary name="Effetti"><EffectPanel engine={engine} onManual={onManual} /></PanelBoundary>}
              <PanelBoundary name="Auto VJ">
                <AutoVJPanel
                  engine={engine}
                  vj={vjRef.current}
                  vjEnabled={vjEnabled}
                  vjGenre={vjGenre}
                  vjStatus={vjStatus}
                  vjHeld={vjHeld}
                  onToggle={toggleVJ}
                  onGenre={changeVJGenre}
                  onHold={toggleVJHold}
                />
              </PanelBoundary>
            </>
          )}
        </div>
        )}

        {/* Center — Preview (+ deck crossfader in pro, Look Bank in live) */}
        <div className={`center-area${fxCenter ? ' center-fx-on' : ''}`}>
          {/* always present (display:contents outside the Pro bench): the canvas never remounts, the WebGL context lives */}
          <div className="stage-row">
          <div className={`preview-container${previewCompact && mode !== 'live' ? ' compact' : ''}`}
               data-wall={wallState}
               style={{ '--out-aspect': `${primaryOut.width} / ${primaryOut.height}` } as React.CSSProperties}>
            <canvas ref={canvasRef} className="preview-canvas" />
            {mode !== 'live' && (
              <button
                className="btn preview-toggle"
                onClick={togglePreviewCompact}
                title={previewCompact ? 'Espandi la preview' : 'Riduci la preview (i pannelli prendono lo spazio)'}
              >
                {previewCompact ? '▴ espandi' : '▾ riduci'}
              </button>
            )}
            {/* U4.2 — bordo che lampeggia sul beat (opacity via DOM diretto) */}
            <div ref={beatFlashRef} className="beat-flash" />
            {mode === 'simple' && flow !== 'sento' && (
              // over the control canvas only: the DOM never reaches the output, a screenshot or a recording
              <span className="preview-note">{flow === 'fermo' ? 'Audio fermo: premi Ascolta la musica' : 'Silenzio: fai partire un brano'}</span>
            )}
            <span className="preview-label">
              <span className={`air-tag ${wallState}`}>{WALL_LABEL[wallState]}</span>
              {outputInfo?.open ? outputInfo.display : 'proiettore non collegato'}
            </span>
          </div>
          {mode === 'simple' && (
            <SimpleDeck engine={engine} vjEnabled={vjEnabled} onVJToggle={toggleVJ} tab={simpleTab} onTab={setSimpleTab} />
          )}
          {engine && (
            // mounted in every mode, hidden under the other Simple tabs: it keeps the Shift+1-0 listener
            <div className="live-lookbank" hidden={mode === 'simple' && simpleTab !== 'look'}>
              <PanelBoundary name="Look Bank"><LookBank engine={engine} onManual={onManual} bare={mode !== 'pro'} compactEmpty={mode === 'simple'} /></PanelBoundary>
            </div>
          )}
          </div>
          {mode === 'pro' && <PanelBoundary name="Deck"><DeckPanel engine={engine} /></PanelBoundary>}
          {fxCenter && <div className="center-fx"><PanelBoundary name="Effetti"><EffectPanel engine={engine} onManual={onManual} /></PanelBoundary></div>}
          {mode === 'live' && (
            <>
              {/* Regia: who is driving the wall — tempo, Auto VJ, scaletta. Same
                  data the top bar and the panels already have, nothing new at audio rate. */}
              <div className="live-director">
                <div className="ld-row ld-tempo">
                  <span className="ld-label">Tempo</span>
                  {tempo}
                </div>
                <div className="ld-row">
                  <span className="ld-label">Auto VJ</span>
                  <div className="u-row">
                    <button
                      className={`btn ${vjEnabled ? 'btn-primary' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => toggleVJ(!vjEnabled)}
                      aria-pressed={vjEnabled}
                      title={vjEnabled ? 'Auto VJ acceso: clic per spegnerlo' : 'Auto VJ spento: clic per riaccenderlo'}
                    >
                      {vjEnabled ? 'Acceso' : 'Spento'}
                    </button>
                    <button
                      className={`btn${vjHeld ? ' is-armed' : ''}`}
                      disabled={!vjEnabled}
                      onClick={() => toggleVJHold(!vjHeld)}
                      aria-pressed={vjHeld}
                      title="Tiene fermo il look attuale — fasi e palette continuano a seguire la musica sotto"
                    >
                      {vjHeld ? 'Riprendi' : 'Tieni'}
                    </button>
                  </div>
                  <div className="u-hint ld-now">
                    {vjEnabled ? `${PHASE_LABEL[vjStatus.phase]} · ora: ${vjStatus.current ? effectLabel(vjStatus.current as EffectId) : '—'}` : 'Comandi tu'}
                  </div>
                </div>
                <div className="ld-row">
                  <span className="ld-label">Scaletta</span>
                  <select
                    value={seqPlayer.playingSeq ? seqPlayer.sequences.indexOf(seqPlayer.playingSeq) : liveSeq}
                    onChange={e => setLiveSeq(+e.target.value)}
                    disabled={seqPlayer.playing}
                    title="Scaletta da avviare"
                  >
                    {seqPlayer.sequences.length === 0 && <option value={-1}>Nessuna scaletta</option>}
                    {seqPlayer.sequences.map((sq, i) => <option key={i} value={i}>{sq.name} · {sq.steps.length}</option>)}
                  </select>
                  <div className="u-row">
                    <button className="btn" disabled={!seqPlayer.playing} onClick={seqPlayer.prev} title="Passo precedente" aria-label="Passo precedente">◀</button>
                    <button
                      className={`btn${seqPlayer.playing ? ' btn-primary' : ''}`}
                      style={{ flex: 1 }}
                      disabled={!seqPlayer.playing && !seqPlayer.sequences[liveSeq]}
                      onClick={() => seqPlayer.playing ? seqPlayer.stop() : seqPlayer.start(seqPlayer.sequences[liveSeq])}
                      title={seqPlayer.playing ? 'Ferma la scaletta' : 'Avvia la scaletta (spegne l\'Auto VJ)'}
                    >
                      {seqPlayer.playing && seqPlayer.playingSeq ? `Ferma · ${seqPlayer.stepIndex + 1}/${seqPlayer.playingSeq.steps.length}` : 'Avvia'}
                    </button>
                    <button className="btn" disabled={!seqPlayer.playing} onClick={seqPlayer.next} title="Passo successivo" aria-label="Passo successivo">▶</button>
                  </div>
                </div>
              </div>
              {/* Rail: faders and the trio in the same corner at every window size */}
              <div className="live-rail">
                <div className="live-faders">{faders}</div>
                <div className="live-safety">{safety}</div>
              </div>
            </>
          )}
        </div>

        {/* Right sidebar — pro only */}
        {mode === 'pro' && (
          // A rail of tabs with one drawer: the ten headers are always in view, the
          // open panel's body is the drawer on their left. Order follows the show:
          // what goes on the wall, how it reacts, where it comes out.
          <div className="sidebar-right">
            <div className="rail-label">Scena</div>
            <PanelBoundary name="Overlay"><OverlayPanel engine={engine} /></PanelBoundary>
            <PanelBoundary name="Scalette"><PresetPanel engine={engine} player={seqPlayer} /></PanelBoundary>
            <PanelBoundary name="Shader"><ShaderEditor engine={engine} /></PanelBoundary>
            <div className="rail-label">Reazione</div>
            <PanelBoundary name="Impatto"><ImpactPanel engine={engine} /></PanelBoundary>
            <PanelBoundary name="Camera"><CameraPanel engine={engine} /></PanelBoundary>
            <div className="rail-label">Impianto</div>
            <PanelBoundary name="Uscite"><OutputsPanel displays={displays} outputs={outputs} onChange={setOutputs} /></PanelBoundary>
            <PanelBoundary name="Mapping">
              <MappingPanel engine={engine} outputs={outputs} onChange={setOutputs}
                selected={mappingOut} onSelect={setMappingOut} />
            </PanelBoundary>
            <PanelBoundary key={panelEpoch} name="DMX"><DmxPanel engine={engine} /></PanelBoundary>
            <PanelBoundary name="MIDI"><MidiPanel engine={engine} /></PanelBoundary>
            <PanelBoundary name="Posti"><VenuePanel capture={captureVenue} apply={applyVenue} /></PanelBoundary>
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="bottom-bar">
        <FpsLabel engine={engine} />
        <span>|</span>
        <span>{outputRes}</span>
        {blackout && <><span>|</span><span style={{ color: 'var(--danger)' }}>BLACKOUT</span></>}
        {frozen && <><span>|</span><span style={{ color: 'var(--state-frozen)' }}>FREEZE</span></>}
        {beatRoll > 0 && <><span>|</span><span style={{ color: 'var(--warning)' }}>ROLL 1/{beatRoll}</span></>}
        {recording && <><span>|</span><span style={{ color: 'var(--danger)' }}>REC</span></>}
        {midiLost && <><span>|</span><span style={{ color: 'var(--warning)' }}>MIDI scollegato</span></>}
        <div className="spacer" />
        <label className="beatflash-toggle tb-extra" title="Flash del bordo preview a ogni beat">
          <input
            type="checkbox"
            checked={beatFlash}
            onChange={e => {
              setBeatFlash(e.target.checked)
              writeString(BEATFLASH_KEY, e.target.checked ? '1' : '0')
            }}
          />
          flash beat
        </label>
        <span className="bb-keys tb-extra" title="Scorciatoie da tastiera">B blackout · F freeze · P panic · [ ] master · 1-0 effetti · QWER post · I intensità · Space tap · tieni premuto = momentaneo</span>
      </div>

      <Toasts />
    </div>
  )
}
