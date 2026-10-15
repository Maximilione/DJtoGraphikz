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
import { ShaderEditor } from './components/ShaderEditor/ShaderEditor'
import { DeckPanel } from './components/DeckPanel/DeckPanel'
import { SimplePanel } from './components/SimplePanel/SimplePanel'
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
import { ALL_EFFECTS, POST_CATEGORIES } from './catalog'
import { allPalettes } from './palettes'
import { sanitizeCmd, stepPalette, type Known } from './phoneCmd'
import { AUDIO_SOURCES } from '@engine/EffectParams'
import { loadUserScenes, saveUserScenes, sceneFromLook, userScenesByGenre, ONLY_MINE_KEY, USER_SCENES_EVENT } from './userScenes'
import { shouldIgnoreHotkey } from './hotkeys'
import { momentary } from './momentary'
import { IdleWatch, loadIdleSettings, onIdleSettings } from './idle'
import { runSweep } from './sweep'
import { ReelBuffer, cropRect, reelFileName, loadReelSettings, onReelSettings, CHUNK_MS, DROP_DELAY_MS, REEL_FPS, type ReelLap, type ReelSettings } from './reel'
import { loadLooks } from './looks'
import { readJson, writeJson, writeString, readString } from './storage'
import { pickEffect } from './autoMapping'
import { AUDIO_STORE_KEY, DMX_STORE_KEY, parseRes, type Venue } from './venues'
import { migrateKeystone, type OutputCfg } from './outputs'

type UIMode = 'simple' | 'pro' | 'live'
const MODE_KEY = 'djtographikz-ui-mode'
const ONBOARDED_KEY = 'djtographikz-onboarded'
const SETTINGS_KEY = 'djtographikz-settings'
const PREVIEW_COMPACT_KEY = 'djtographikz-preview-compact-v2'
const BEATFLASH_KEY = 'djtographikz-beatflash'

// Hotkey maps: 1-0 = first ten effects in panel order, QWER = common post toggles
const HOTKEY_EFFECTS: EffectId[] = ALL_EFFECTS.slice(0, 10).map(fx => fx.id)
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

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [engine, setEngine] = useState<Engine | null>(null)
  const seqPlayer = useSequencePlayer(engine)
  const engineRef = React.useRef<Engine | null>(null)
  engineRef.current = engine
  const [fps, setFps] = useState(0)
  const [bpm, setBpm] = useState(0)
  /** Intensity macro, 0..1 — one fader instead of five sliders, key I */
  const [intensity, setIntensity] = useState(0)
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

  // UI mode + onboarding
  const [mode, setMode] = useState<UIMode>(() => {
    // a stale or hand-edited value used to go straight into the layout
    const saved = window.api?.selfTestMode || readString(MODE_KEY)
    return saved === 'pro' || saved === 'live' || saved === 'simple' ? saved : 'simple'
  })
  const [showRemote, setShowRemote] = useState(false)
  const [showSoundcheck, setShowSoundcheck] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => !readString(ONBOARDED_KEY))

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
    // engine resizes on window resize — the class toggle alone doesn't fire it
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }, [])

  // U4.2 — flash del bordo preview sul beat (opt-in, persistito)
  const [beatFlash, setBeatFlash] = useState(() => readString(BEATFLASH_KEY) === '1')
  const beatFlashRef = useRef<HTMLDivElement>(null)

  // AutoVJ lives here so Simple and Pro views share one instance
  const vjRef = useRef<AutoVJ>(new AutoVJ())
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

    const eng = new Engine(canvasRef.current)
    // Persistence debounced: a synchronous localStorage write per emitted state
    // (~16/s while dragging a remote slider) blocks the render thread
    let persistTimer = 0
    // The snapshot carries paramDefs, every effect's params and any ISF image
    // inputs as base64. Dragging a slider emits one per frame, so
    // sending each one structured-clones megabytes at 60Hz to main and on to
    // the output window. 30Hz, same rate as the audio push: leading edge so a
    // look change lands at once, trailing flush so the last value is never lost.
    // ponytail: images ride along on every send — split them out only if a set
    // with many ISF image inputs still shows a hitch.
    let ipcTimer = 0
    let lastSent = 0
    let pending: unknown = null
    const sendState = () => {
      ipcTimer = 0
      lastSent = performance.now()
      try { window.api?.sendEngineState(pending) } catch (_) {}
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
      clearTimeout(persistTimer)
      persistTimer = window.setTimeout(() => {
        // blackout/frozen excluded on restore. This is the biggest writer in
        // the app — base64 images included, every 400 ms — so it is the one
        // that fills the quota and makes every other save fail.
        writeJson(SETTINGS_KEY, state)
      }, 400)
    }
    eng.start()

    // Restore last session's look
    const saved = loadSettings()
    if (saved) {
      eng.applySettings(saved)
      if (typeof saved.brightness === 'number') setBrightness(saved.brightness)
    }

    // Release gate: pin the effect it asked for (DJG_SELFTEST_EFFECT), or the
    // custom shader source it handed over (DJG_SELFTEST_SHADER)
    if (window.api?.selfTestShader) eng.setCustomShader(window.api.selfTestShader)
    else if (window.api?.selfTestEffect) eng.setEffect(window.api.selfTestEffect as any)

    // Release sweep: every effect, post and Auto VJ post chain, probed on the projector
    if (window.api?.selfTestSweep) setTimeout(() => { void runSweep(eng) }, 4000)

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
        .then(b => eng.audioAnalyzer.startFile(new File([b], dryRun.split('/').pop() || 'prova.wav')))
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
    const unIdle = onIdleSettings(s => { idleSettings = s; idle.setSeconds(s.seconds); if (!s.enabled) idle.reset() })
    let idleBefore: EffectId | null = null
    const fadeTo = (effect: EffectId, seconds: number) => {
      const prevType = eng.getTransitionType(), prevSeconds = eng.getTransitionDuration()
      eng.setTransitionType('crossfade'); eng.setTransitionDuration(seconds)
      eng.setEffect(effect)
      eng.setTransitionType(prevType); eng.setTransitionDuration(prevSeconds)
    }
    const unsubscribe = eng.onAudioFrame((beat, energy, bass, barPhase, bassRaw, energyRaw, key) => {
      vj.update({ beat, energy, bass, barPhase, bassRaw, energyRaw, key })
      eng.notePhase(vj.getPhase())   // the track-change detector reads it after this listener
      // the release sweep sets effects itself and measures them: idle must not move the picture under it
      if (!idleSettings.enabled || vj.isEnabled() || window.api?.selfTestSweep) return
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
    })

    // Push catalogs to the phone remote (served at GET /defs, version added server-side)
    try {
      window.api?.sendRemoteDefs({
        effects: ALL_EFFECTS.map(fx => ({ id: fx.id, label: fx.label, category: fx.category })),
        posts: REMOTE_POSTS,
        palettes: allPalettes(),
        genres: (Object.keys(GENRE_CONFIGS) as Genre[]).map(id => ({ id, label: GENRE_CONFIGS[id].label })),
        blendModes: BLEND_MODES,
        transitionTypes: Object.keys(TRANSITION_TYPES),
      })
    } catch (_) {}

    setEngine(eng)
    return () => {
      clearTimeout(ipcTimer)
      clearTimeout(persistTimer)
      disposed = true
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

  // Enumerate displays for the monitor picker
  useEffect(() => {
    window.api?.listDisplays().then((list: any[]) => setDisplays(list)).catch(() => {})
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

  // U1.2 — flash the beat dot on beatDetected: direct DOM mutation on the ref,
  // instant jump to scale+glow then a CSS transition decays it back
  useEffect(() => {
    if (!engine) return
    return engine.onAudioFrame((beat) => {
      const el = beatDotRef.current
      if (!beat || !el) return
      el.style.transition = 'none'
      el.style.transform = 'scale(1.5)'
      el.style.boxShadow = '0 0 10px var(--accent)'
      void el.offsetWidth
      el.style.transition = 'transform 0.25s ease-out, box-shadow 0.25s ease-out'
      el.style.transform = 'scale(1)'
      el.style.boxShadow = 'none'
    })
  }, [engine])

  // U4.2 — flash sul bordo della preview a ogni beat: stessa tecnica del beat
  // dot, mutazione DOM diretta sul ref (nessun setState per frame)
  useEffect(() => {
    if (!engine || !beatFlash) return
    const unsub = engine.onAudioFrame((beat) => {
      const el = beatFlashRef.current
      if (!beat || !el) return
      el.style.transition = 'none'
      el.style.opacity = '1'
      void el.offsetWidth
      el.style.transition = 'opacity 180ms ease-out'
      el.style.opacity = '0'
    })
    return () => {
      unsub()
      if (beatFlashRef.current) beatFlashRef.current.style.opacity = '0'
    }
  }, [engine, beatFlash])

  // U1.2 — poll audio status: 'reconnecting' shows the banner, a user stop is fine
  useVisibleInterval(() => {
    if (!engine) return
    setAudioStatus(engine.audioAnalyzer.getStatus())
    setBpm(Math.round(engine.audioAnalyzer.getData().bpm) || 0)
  }, engine ? 1000 : null)

  // U1.3 — output window status: on mount + whenever main signals a change
  useEffect(() => {
    refreshOutputInfo()
    return window.api?.onOutputChanged?.(refreshOutputInfo)
  }, [refreshOutputInfo])

  const screenshot = useCallback(async () => {
    if (!engine) return
    const blob = await engine.screenshot()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `djtographikz-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, [engine])

  // WebM recording of the preview canvas — zero deps, saves on stop
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const toggleRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop()
      recorderRef.current = null
      setRecording(false)
      return
    }
    if (!canvasRef.current) return
    const stream = canvasRef.current.captureStream(60)
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9' : 'video/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
    const chunks: Blob[] = []
    rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      const url = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `djtographikz-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`
      a.click()
      URL.revokeObjectURL(url)
    }
    rec.start(1000) // 1s chunks so a crash loses at most a second
    recorderRef.current = rec
    setRecording(true)
  }, [])

  // GIF export: N seconds (or N bars at the current BPM) of the preview, looped, no dependencies
  const [gifMenu, setGifMenu] = useState(false)
  const [gifBusy, setGifBusy] = useState<string | null>(null)
  const [gifOpt, setGifOpt] = useState({ secs: 5, width: 480, bars: false })
  const startGif = useCallback(async () => {
    const eng = engineRef.current
    if (!eng || gifBusy) return
    setGifMenu(false)
    const bpmNow = eng.audioAnalyzer.getEffectiveBpm()
    const useBars = gifOpt.bars && bpmNow > 0
    // bars mode: 1 bar at 60-200 BPM is 1.2-4 s; 2 bars when that is under 3 s, so the loop is not a blink
    const bars = useBars ? (barsSeconds(1, bpmNow) < 3 ? 2 : 1) : 0
    const seconds = useBars ? barsSeconds(bars, bpmNow) : gifOpt.secs
    const fps = 15
    const { frames: total, delayCs } = gifTiming(seconds, fps)
    const src0 = canvasRef.current
    if (!src0) return
    const w = Math.min(gifOpt.width, src0.width)
    const h = Math.max(1, Math.round(w * src0.height / src0.width))
    const cv = document.createElement('canvas')
    cv.width = w; cv.height = h
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    const frames: { data: Uint8ClampedArray }[] = []
    setGifBusy('GIF 0%')
    const startedAt = performance.now()
    try {
      await new Promise<void>(resolve => {
        const off = eng.onFrameRendered(canvas => {
          // frame k is due at k/total of the span: pace by clock, not by render count
          if (frames.length > (performance.now() - startedAt) / (seconds * 1000) * total) return
          ctx.drawImage(canvas, 0, 0, w, h)
          frames.push({ data: ctx.getImageData(0, 0, w, h).data })
          setGifBusy(`GIF ${Math.round(frames.length / total * 50)}%`)
          if (frames.length >= total) { off(); resolve() }
        })
      })
      const bytes = await encodeGif(frames, {
        width: w, height: h, delayCs, dither: true,
        onProgress: (d, t) => setGifBusy(`GIF ${50 + Math.round(d / t * 50)}%`),
      })
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/gif' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `djtographikz-${new Date().toISOString().replace(/[:.]/g, '-')}.gif`
      a.click()
      URL.revokeObjectURL(url)
      pushToast(`GIF salvata · ${seconds.toFixed(1)} s${useBars ? ` (${bars} ${bars === 1 ? 'battuta' : 'battute'} a ${Math.round(bpmNow)} BPM)` : ''} · ${w}×${h} · ${(bytes.length / 1048576).toFixed(1)} MB`, 'gif')
    } catch (e) {
      pushToast(`GIF non riuscita: ${(e as Error).message}`, 'gif')
    } finally {
      setGifBusy(null)
    }
  }, [gifBusy, gifOpt])

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
      const unFrame = engine.onFrameRendered(src => {
        const [sx, sy, sw, sh] = cropRect(src.width, src.height)
        ctx.drawImage(src, sx, sy, sw, sh, 0, 0, W, H)
      })
      const stream = canvas.captureStream(REEL_FPS)
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
      const buf = new ReelBuffer<Blob>()
      const recs: (MediaRecorder | null)[] = [null, null]
      let pending: ReelLap<Blob> | null = null
      const download = (lap: ReelLap<Blob>) => {
        const url = URL.createObjectURL(new Blob(lap.chunks, { type: 'video/webm' }))
        const a = document.createElement('a')
        a.href = url
        a.download = reelFileName(new Date())
        a.click()
        URL.revokeObjectURL(url)
        pushToast(`Reel salvato · ${Math.round((performance.now() - lap.startedAt) / 1000)} s · ${W}×${H}`, 'reel')
      }
      const tick = () => {
        const now = performance.now()
        for (const slot of buf.due(now)) {
          const old = recs[slot]
          if (old && old.state !== 'inactive') old.stop()
          // a recorder per lap: the old one's last chunk lands in its own lap
          const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
          const lap = buf.started(slot, now)
          rec.ondataavailable = e => {
            if (e.data.size > 0) lap.chunks.push(e.data)
            if (pending === lap) { pending = null; download(lap) }
          }
          rec.start(CHUNK_MS)
          recs[slot] = rec
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
    // Keep the phone remote honest — hotkeys/effect cmds disable AutoVJ silently
    try { window.api?.sendRemoteVj({ enabled: on, genre: vjRef.current.getGenre() }) } catch (_) {}
  }, [])

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
    engine.setRenderSize(list[0].width, list[0].height)
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))   // preview re-letterboxes to the new aspect

    engine.setBrightness(v.brightness); setBrightness(v.brightness)
    if (v.audio !== null) writeJson(AUDIO_STORE_KEY, v.audio)
    if (v.dmx !== null) writeJson(DMX_STORE_KEY, v.dmx)
    setPanelEpoch(e => e + 1)
    pushToast(`Posto "${v.name}" caricato${missing.length ? ` (${missing.length} schermo/i non collegati)` : ''}`)
  }, [engine, displays, setOutputs])

  // U1.1 — PANIC: back to a clean, visible baseline in one gesture.
  // The current effect stays on purpose: switching it mid-panic is more jarring.
  const panic = useCallback(() => {
    if (!engine) return
    engine.setActivePosts([])
    engine.setCrossfade(0)
    engine.setMotionBlur(0)
    engine.setBrightness(1); setBrightness(1)
    engine.setBlackout(false); setBlackout(false)
    engine.setFreeze(false); setFrozen(false)
    toggleVJ(false)
  }, [engine, toggleVJ])

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
    }
  }, [engine, changeVJGenre, toggleVJ])

  // FPS counter. It used to run a second requestAnimationFrame chain of its
  // own, next to the engine's — which measured the renderer's frame rate, not
  // the one the label claims. The engine already calls its frame listeners
  // once per rendered frame, so it counts those instead: one chain, and the
  // number now means what it says.
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

      if (k === 'b') {
        setBlackout(prev => {
          engine.setBlackout(!prev)
          momentary.press(k, () => { engine.setBlackout(prev); setBlackout(prev) })
          return !prev
        })
      } else if (k === 'f') {
        setFrozen(prev => {
          engine.setFreeze(!prev)
          momentary.press(k, () => { engine.setFreeze(prev); setFrozen(prev) })
          return !prev
        })
      } else if (k === 'i') {
        // The macro as a key: held it is momentary, tapped it latches — the
        // same rule as everything else. A fader you have to find in the dark
        // is not a fader you will use.
        setIntensity(prev => {
          const next = prev > 0 ? 0 : 1
          engine.setIntensity(next)
          momentary.press(k, () => { engine.setIntensity(prev); setIntensity(prev) })
          return next
        })
      } else if (k === ',' || k === '.' || k === '/') {
        // Beat-roll: the clocks loop over a quarter, an eighth or a sixteenth
        // of a beat. Held it stutters while you hold; tapped it latches, and
        // the same key taps it off.
        const division = k === ',' ? 4 : k === '.' ? 8 : 16
        const prev = engine.getBeatRoll() as 0 | 4 | 8 | 16
        engine.setBeatRoll(prev === division ? 0 : division)
        momentary.press(k, () => engine.setBeatRoll(prev))
      } else if (k === 'p') {
        panic()
      } else if (k === 'v') {
        if (reelRef.current) reelRef.current.save()
        else pushToast('Reel spento — attivalo nel pannello Uscite', 'reel')
      } else if (e.key === '?') {
        // U2.2 — Shift+/ apre/chiude direttamente la cheat sheet
        setShowCheatSheet(prev => !prev)
      } else if (e.key === '[') {
        setBrightness(prev => { const v = Math.max(0, prev - 0.05); engine.setBrightness(v); return v })
      } else if (e.key === ']') {
        setBrightness(prev => { const v = Math.min(1, prev + 0.05); engine.setBrightness(v); return v })
      } else if (!e.shiftKey && k >= '0' && k <= '9') {
        // Shift+digit is the Look Bank's, and it handles its own hold.
        const idx = k === '0' ? 9 : parseInt(k) - 1
        const effect = HOTKEY_EFFECTS[idx]
        if (effect) {
          const before = engine.getCurrentEffect()
          toggleVJ(false)
          pickEffect(engine, effect)
          momentary.press(k, () => engine.setEffect(before))
        }
      } else if (k in HOTKEY_POSTS) {
        const id = HOTKEY_POSTS[k]
        const was = engine.isPostActive(id)
        engine.togglePost(id)
        momentary.press(k, () => { if (engine.isPostActive(id) !== was) engine.togglePost(id) })
      } else if (k === ' ') {
        e.preventDefault()
        engine.audioAnalyzer.setBpmMode('tap')
        engine.audioAnalyzer.tap()
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
  }, [engine, toggleVJ, panic])

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
      onlyMine: readJson<boolean>(ONLY_MINE_KEY, false),
      scenes: loadUserScenes().filter(sc => sc.genre === genre).length,
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
    if (cmd.type === 'release') { momentary.release(`remote:${v}`); return }
    if (cmd.hold) {
      if (cmd.type === 'look') {
        const before = engine.createPreset('prima del richiamo')
        momentary.press(`remote:${cmd.hold}`, () => engine.applyPreset(before))
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
          const slot = loadLooks()[v]
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
          writeJson(ONLY_MINE_KEY, !!v)
          vjRef.current.setUserScenes(userScenesByGenre(loadUserScenes()), !!v)
          window.dispatchEvent(new Event(USER_SCENES_EVENT))
          break
        }
        case 'saveScene': {
          const vj = vjRef.current
          const list = [...loadUserScenes(), sceneFromLook(engine, vj.getGenre(), vj.getPhase())]
          saveUserScenes(list)
          vj.setUserScenes(userScenesByGenre(list), readJson<boolean>(ONLY_MINE_KEY, false))
          window.dispatchEvent(new Event(USER_SCENES_EVENT))
          break
        }
        case 'tap':
          engine.audioAnalyzer.setBpmMode('tap')
          engine.audioAnalyzer.tap()
          break
    }
    // U1.4 — toast for external surfaces (phone/OSC). MIDI cmds arrive without
    // source and stay silent: MIDI is the operator's own hands.
    // Keyed on cmd.type so a slider stream collapses into one updating toast.
    if (cmd.source) pushToast(`${cmdToastLabel(cmd.type, v)} · ${cmd.source}`, cmd.type)
    pushPhoneExt()
  }, [engine, pushPhoneExt, toggleVJ, changeVJGenre, panic])

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

  const fpsColor = fps > 55 ? 'var(--accent)' : fps > 30 ? 'var(--warning)' : 'var(--danger)'

  return (
    <div className={`app-layout mode-${mode}`}>
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}
      {showRemote && <RemoteModal onClose={() => setShowRemote(false)} />}
      {showSoundcheck && <Soundcheck engine={engine} outputRes={outputRes} onClose={() => setShowSoundcheck(false)} />}
      {showHelpMenu && (
        <HelpMenu
          onShortcuts={() => { setShowHelpMenu(false); setShowCheatSheet(true) }}
          onGuide={() => { setShowHelpMenu(false); setShowQuickGuide(true) }}
          onOnboarding={() => { setShowHelpMenu(false); setShowOnboarding(true) }}
          onClose={() => setShowHelpMenu(false)}
        />
      )}
      {showCheatSheet && <CheatSheet onClose={() => setShowCheatSheet(false)} />}
      {showQuickGuide && <QuickGuide onClose={() => setShowQuickGuide(false)} />}

      {/* Top bar — D4: controlli raggruppati (identità · modalità · master · output · aiuto) */}
      <div className="top-bar">
        <div className="tb-group">
          <span className="tb-eye"><IconEye /></span>
          <span className="title">DJtoGraphikz</span>
          <span
            ref={beatDotRef}
            className={`beat-dot${audioStatus === 'running' ? '' : ' beat-dot-off'}`}
            title={audioStatus === 'running' ? 'Audio attivo — lampeggia sul beat' : audioStatus === 'reconnecting' ? 'Audio perso — riconnessione…' : 'Audio fermo'}
          />
          <span className="tb-bpm" title="BPM rilevato (la modalita' BPM si cambia dal pannello Audio)">
            <b>{audioStatus === 'running' && bpm > 0 ? bpm : '—'}</b> BPM
          </span>
        </div>

        {/* Simple / Pro / Live switch */}
        <div className="tb-group">
          <div className="mode-switch">
            <button
              className={mode === 'simple' ? 'active' : ''}
              onClick={() => changeMode('simple')}
              title="Modalità Simple — controlli essenziali"
            >
              SIMPLE
            </button>
            <button
              className={mode === 'pro' ? 'active' : ''}
              onClick={() => changeMode('pro')}
              title="Modalità Pro — tutti i pannelli"
            >
              PRO
            </button>
            <button
              className={mode === 'live' ? 'active' : ''}
              onClick={() => changeMode('live')}
              title="Modalità Live — solo preview e Look Bank"
            >
              LIVE
            </button>
          </div>
        </div>

        <div className="tb-group">
          <span className="deck-label" title="Intensità: alza insieme velocità, reattività, densità e il wet dei post-FX (I)">INTENS.</span>
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
            title="Intensità: un comando invece di cinque cursori — a zero la scena e' quella che hai impostato (I)"
          />
        </div>

        <div className="tb-group">
          <span className="deck-label" title="Luminosità master ([ / ])">MASTER</span>
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
            title="Luminosità master ([ / ])"
          />
          <button
            className={`btn btn-sm btn-black${blackout ? ' on' : ''}`}
            onClick={() => { const v = !blackout; setBlackout(v); engine?.setBlackout(v) }}
            title="Blackout (B)"
          >
            BLACK
          </button>
          <button
            className={`btn btn-sm ${frozen ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { const v = !frozen; setFrozen(v); engine?.setFreeze(v) }}
            title="Freeze (F)"
          >
            FREEZE
          </button>
          <button
            className="btn btn-sm btn-panic"
            onClick={panic}
            title="PANIC — reset visuali a uno stato pulito (P)"
          >
            PANIC
          </button>
        </div>

        <div className="spacer" />

        <div className="tb-group tb-right">
          <button className="btn btn-secondary btn-sm" onClick={screenshot} title="Screenshot PNG" aria-label="Screenshot PNG">
            <IconCamera />
          </button>
          <button
            className={`btn btn-sm tb-extra ${recording ? 'btn-danger' : 'btn-secondary'}`}
            onClick={toggleRecording}
            title={recording ? 'Ferma e salva la registrazione WebM' : 'Registra la preview in WebM'}
           aria-label={recording ? 'Ferma e salva la registrazione WebM' : 'Registra la preview in WebM'}>
            {recording ? <IconStop /> : <IconRecord />}
          </button>
          <span className="tb-extra" style={{ position: 'relative', display: 'inline-flex' }}>
            <button className="btn btn-secondary btn-sm" disabled={!!gifBusy}
              onClick={() => setGifMenu(m => !m)}
              title="Esporta una GIF in loop dalla preview" aria-label="Esporta una GIF in loop dalla preview"
              aria-expanded={gifMenu}>
              {gifBusy ?? 'GIF'}
            </button>
            {gifMenu && (
              <div role="menu" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50, padding: 'var(--s3)',
                display: 'flex', flexDirection: 'column', gap: 'var(--s2)', background: 'var(--bg-panel, #1a1a1f)',
                border: '1px solid var(--border, #333)', borderRadius: 6, minWidth: 190 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>Durata
                  <select value={gifOpt.secs} disabled={gifOpt.bars && bpm > 0}
                    onChange={e => setGifOpt(o => ({ ...o, secs: +e.target.value }))}>
                    {[3, 5, 8].map(s => <option key={s} value={s}>{s} s</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>Larghezza
                  <select value={gifOpt.width} onChange={e => setGifOpt(o => ({ ...o, width: +e.target.value }))}>
                    {[320, 480, 640].map(s => <option key={s} value={s}>{s} px</option>)}
                  </select>
                </label>
                <label title={bpm > 0 ? 'Cattura 1-2 battute esatte al BPM corrente: il loop non scatta' : 'BPM non rilevato: usa i secondi'}
                  style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={gifOpt.bars} disabled={!(bpm > 0)}
                    onChange={e => setGifOpt(o => ({ ...o, bars: e.target.checked }))} />
                  Loop a battuta
                </label>
                <button className="btn btn-sm btn-danger" onClick={startGif}>Cattura GIF</button>
              </div>
            )}
          </span>
          {reelArmed && (
            <button className="btn btn-secondary btn-sm tb-extra" onClick={() => reelRef.current?.save()}
              title="Reel armato: salva gli ultimi 15–30 s in 9:16 (V)"
              aria-label="Salva il reel degli ultimi 15–30 s">
              <span style={{ color: 'var(--accent)' }}>●</span> Reel
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setShowRemote(true)} title="Remote dal telefono (QR + codice)" aria-label="Remote dal telefono (QR + codice)">
            <IconPhone />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowSoundcheck(true)} title="Soundcheck: ingresso, proiettore, fps, DMX, telefono e disco in pochi secondi">
            Soundcheck
          </button>
          {outputInfo && (outputInfo.open ? (
            <span className="output-chip" title="Stato della finestra di output">
              <IconMonitor size={14} />
              Output · {outputInfo.display}{outputInfo.fullscreen ? ' · FS' : ''}
              {(outputInfo.count ?? 1) > 1 ? ` +${(outputInfo.count ?? 1) - 1}` : ''}
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
          {displays.length > 1 && (
            <select
              className="tb-extra tb-select"
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
          )}
          <select
            className="tb-extra tb-select"
            value={outputRes}
            onChange={e => {
              const [w, h] = e.target.value.split('x').map(Number)
              engine?.setRenderSize(w, h)
              requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))   // preview re-letterboxes
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
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              window.api?.toggleOutputFullscreen()
              // fullscreen flips have no dedicated event — re-read after the switch
              setTimeout(refreshOutputInfo, 400)
            }}
            title="Fullscreen della finestra di output"
           aria-label="Fullscreen della finestra di output">
            <IconFullscreen />
          </button>
        </div>

        <div className="tb-group">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowHelpMenu(v => !v)}
            title="Aiuto — scorciatoie, guida, configurazione (?)"
           aria-label="Aiuto — scorciatoie, guida, configurazione (?)">
            <IconHelp />
          </button>
        </div>
      </div>

      {/* U1.2 — slim static banner: layout shifts once, no overlay on the preview */}
      {audioStatus === 'reconnecting' && (
        <div className="audio-banner">⚠ Audio perso — riconnessione in corso…</div>
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

      {/* Main layout — U4.1: in live niente sidebar, solo preview + Look Bank */}
      <div className={`main-area${mode === 'live' ? ' live-layout' : ''}`}>
        {/* Left sidebar */}
        {mode !== 'live' && (
        <div className={`sidebar${mode === 'simple' ? ' sidebar-wide' : ''}`}>
          <AudioPanel key={panelEpoch} engine={engine} phase={vjEnabled ? vjStatus.phase : null} />
          {mode === 'simple' ? (
            <>
              <SimplePanel
                engine={engine}
                vjEnabled={vjEnabled}
                vjGenre={vjGenre}
                vjStatus={vjStatus}
                onVJToggle={toggleVJ}
                onVJGenre={changeVJGenre}
              />
            </>
          ) : (
            <>
              {!fxCenter && <EffectPanel engine={engine} />}
              <AutoVJPanel
                engine={engine}
                vj={vjRef.current}
                vjEnabled={vjEnabled}
                vjGenre={vjGenre}
                vjStatus={vjStatus}
                onToggle={toggleVJ}
                onGenre={changeVJGenre}
              />
            </>
          )}
        </div>
        )}

        {/* Center — Preview (+ deck crossfader in pro, Look Bank in live) */}
        <div className={`center-area${fxCenter ? ' center-fx-on' : ''}`}>
          <div className={`preview-container${previewCompact && mode !== 'live' ? ' compact' : ''}`}
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
            <span className="preview-label">PREVIEW</span>
          </div>
          {mode === 'pro' && <DeckPanel engine={engine} />}
          {engine && (
            <div className="live-lookbank">
              <LookBank engine={engine} />
            </div>
          )}
          {fxCenter && <div className="center-fx"><EffectPanel engine={engine} /></div>}
        </div>

        {/* Right sidebar — pro only */}
        {mode === 'pro' && (
          <div className="sidebar-right">
            <OverlayPanel engine={engine} />
            <PresetPanel engine={engine} player={seqPlayer} />
            <ShaderEditor engine={engine} />
            <CameraPanel engine={engine} />
            <ImpactPanel engine={engine} />
            <MappingPanel engine={engine} outputs={outputs} onChange={setOutputs}
              selected={mappingOut} onSelect={setMappingOut} />
            <DmxPanel key={panelEpoch} engine={engine} />
            <OutputsPanel displays={displays} outputs={outputs} onChange={setOutputs} />
            <VenuePanel capture={captureVenue} apply={applyVenue} />
            <MidiPanel engine={engine} dispatchCmd={dispatchCmd} />
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="bottom-bar">
        <span style={{ color: fpsColor }}>{fps} FPS</span>
        <span>|</span>
        <span>{outputRes}</span>
        {blackout && <><span>|</span><span style={{ color: 'var(--danger)' }}>BLACKOUT</span></>}
        {frozen && <><span>|</span><span style={{ color: 'var(--accent)' }}>FROZEN</span></>}
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
