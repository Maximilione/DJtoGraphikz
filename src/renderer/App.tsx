import './styles/features.css'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { AudioPanel } from './components/AudioPanel/AudioPanel'
import { Toasts, pushToast } from './components/Toasts/Toasts'
import { EffectPanel } from './components/EffectPanel/EffectPanel'
import { AutoVJPanel } from './components/AutoVJPanel/AutoVJPanel'
import { OverlayPanel } from './components/OverlayPanel/OverlayPanel'
import { PresetPanel } from './components/PresetPanel/PresetPanel'
import { ShaderEditor } from './components/ShaderEditor/ShaderEditor'
import { DeckPanel } from './components/DeckPanel/DeckPanel'
import { SimplePanel } from './components/SimplePanel/SimplePanel'
import { LookBank } from './components/LookBank/LookBank'
import { MidiPanel } from './components/MidiPanel/MidiPanel'
import { Onboarding, type OnboardingResult } from './components/Onboarding/Onboarding'
import { RemoteModal } from './components/RemoteModal/RemoteModal'
import { HelpMenu } from './components/Help/HelpMenu'
import { CheatSheet } from './components/Help/CheatSheet'
import { QuickGuide } from './components/Help/QuickGuide'
import { IconCamera, IconRecord, IconStop, IconPhone, IconFullscreen, IconHelp, IconEye, IconMonitor } from './components/Icons/Icons'
import { Engine, BLEND_MODES, type EffectId, type PostId, type EngineState, type TransitionType, type Preset } from '@engine/Engine'
import { AutoVJ, GENRE_CONFIGS, type Genre } from '@engine/AutoVJ'
import { EFFECT_CATEGORIES, COLOR_PRESETS } from './components/EffectPanel/EffectPanel'

type UIMode = 'simple' | 'pro' | 'live'
const MODE_KEY = 'djtographikz-ui-mode'
const ONBOARDED_KEY = 'djtographikz-onboarded'
const SETTINGS_KEY = 'djtographikz-settings'
const BEATFLASH_KEY = 'djtographikz-beatflash'

// Hotkey maps: 1-0 = first ten effects in panel order, QWER = common post toggles
const HOTKEY_EFFECTS: EffectId[] = EFFECT_CATEGORIES.flatMap(c => c.effects.map(e => e.id)).slice(0, 10)
const HOTKEY_POSTS: Record<string, PostId> = { q: 'bloom', w: 'feedback', e: 'chromatic', r: 'rgb-split' }

// Catalogs for the phone remote. Keyed on the engine union types so tsc fails
// right here whenever a PostId / TransitionType is added or removed.
const POST_LABELS: Record<PostId, string> = {
  bloom: 'Bloom', feedback: 'Feedback', chromatic: 'Chromatic', 'rgb-split': 'RGB Split',
  pixelate: 'Pixelate', mirror: 'Mirror', invert: 'Invert', filmgrain: 'Film Grain', scanlines: 'Scanlines',
}
const TRANSITION_TYPES: Record<TransitionType, true> = {
  crossfade: true, 'wipe-left': true, 'wipe-down': true, radial: true, dissolve: true,
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
    case 'tap': return 'Tap BPM'
    case 'panic': return 'PANIC'
    default: return type
  }
}

function loadSettings(): Partial<EngineState> | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [engine, setEngine] = useState<Engine | null>(null)
  const [fps, setFps] = useState(0)
  const [outputRes, setOutputRes] = useState('1920x1080')
  const [brightness, setBrightness] = useState(1)
  const [blackout, setBlackout] = useState(false)
  const [frozen, setFrozen] = useState(false)

  // UI mode + onboarding
  const [mode, setMode] = useState<UIMode>(() => (localStorage.getItem(MODE_KEY) as UIMode) || 'simple')
  const [showRemote, setShowRemote] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDED_KEY))

  // U2.1/U2.2 — menu aiuto + overlay scorciatoie/guida
  const [showHelpMenu, setShowHelpMenu] = useState(false)
  const [showCheatSheet, setShowCheatSheet] = useState(false)
  const [showQuickGuide, setShowQuickGuide] = useState(false)

  // Preview riducibile: compatta la striscia video, i pannelli prendono spazio
  const [previewCompact, setPreviewCompact] = React.useState(() => localStorage.getItem('djtographikz-preview-compact') === '1')
  const togglePreviewCompact = React.useCallback(() => {
    setPreviewCompact(c => {
      try { localStorage.setItem('djtographikz-preview-compact', c ? '0' : '1') } catch { /* full */ }
      return !c
    })
    // engine resizes on window resize — the class toggle alone doesn't fire it
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }, [])

  // U4.2 — flash del bordo preview sul beat (opt-in, persistito)
  const [beatFlash, setBeatFlash] = useState(() => localStorage.getItem(BEATFLASH_KEY) === '1')
  const beatFlashRef = useRef<HTMLDivElement>(null)

  // AutoVJ lives here so Simple and Pro views share one instance
  const vjRef = useRef<AutoVJ>(new AutoVJ())
  const [vjEnabled, setVjEnabled] = useState(false)
  const [vjGenre, setVjGenre] = useState<Genre>('acid-techno')
  const [vjStatus, setVjStatus] = useState({ current: '', count: 0 })

  // Displays for the output-monitor picker
  const [displays, setDisplays] = useState<{ id: number; label: string; primary: boolean }[]>([])

  // U1.2 — beat dot (flashed via direct DOM mutation, no setState per frame) + audio status
  const beatDotRef = useRef<HTMLSpanElement>(null)
  const [audioStatus, setAudioStatus] = useState<'running' | 'reconnecting' | 'stopped'>('stopped')

  // U1.3 — output window status chip
  const [outputInfo, setOutputInfo] = useState<{ open: boolean; fullscreen: boolean; display: string } | null>(null)
  const refreshOutputInfo = useCallback(() => {
    window.api?.getOutputInfo?.().then(setOutputInfo).catch(() => {})
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return

    const eng = new Engine(canvasRef.current)
    // Persistence debounced: a synchronous localStorage write per emitted state
    // (~16/s while dragging a remote slider) blocks the render thread
    let persistTimer = 0
    eng.onStateChange = (state) => {
      try { window.api?.sendEngineState(state) } catch (_) {}
      clearTimeout(persistTimer)
      persistTimer = window.setTimeout(() => {
        // blackout/frozen excluded on restore
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state)) } catch (_) {}
      }, 400)
    }
    eng.start()

    // Restore last session's look
    const saved = loadSettings()
    if (saved) {
      eng.applySettings(saved)
      if (typeof saved.brightness === 'number') setBrightness(saved.brightness)
    }

    // Wire AutoVJ → engine
    const vj = vjRef.current
    vj.onEffectChange = (effect) => {
      eng.setEffect(effect)
      setVjStatus(prev => ({ current: effect, count: prev.count + 1 }))
    }
    vj.onPostChange = (posts) => eng.setActivePosts(posts)
    vj.onPaletteChange = (colors) => eng.setColors(colors[0], colors[1], colors[2])
    const unsubscribe = eng.onAudioFrame((beat, energy, bass, barPhase) => vj.update(beat, energy, bass, barPhase))

    // Push catalogs to the phone remote (served at GET /defs, version added server-side)
    try {
      window.api?.sendRemoteDefs({
        effects: EFFECT_CATEGORIES.flatMap(c => c.effects.map(fx => ({ id: fx.id, label: fx.label, category: c.name }))),
        posts: (Object.keys(POST_LABELS) as PostId[]).map(id => ({ id, label: POST_LABELS[id] })),
        palettes: COLOR_PRESETS,
        genres: (Object.keys(GENRE_CONFIGS) as Genre[]).map(id => ({ id, label: GENRE_CONFIGS[id].label })),
        blendModes: BLEND_MODES,
        transitionTypes: Object.keys(TRANSITION_TYPES),
      })
    } catch (_) {}

    setEngine(eng)
    return () => {
      unsubscribe()
      vj.onEffectChange = null
      vj.onPostChange = null
      vj.onPaletteChange = null
      eng.dispose()
      setEngine(null)
    }
  }, [])

  // Enumerate displays for the monitor picker
  useEffect(() => {
    window.api?.listDisplays().then((list: any[]) => setDisplays(list)).catch(() => {})
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
  useEffect(() => {
    if (!engine) return
    const id = window.setInterval(() => setAudioStatus(engine.audioAnalyzer.getStatus()), 1000)
    return () => clearInterval(id)
  }, [engine])

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

  const toggleVJ = useCallback((on: boolean) => {
    vjRef.current.setEnabled(on)
    setVjEnabled(on)
    if (on) setVjStatus({ current: '', count: 0 })
    // Keep the phone remote honest — hotkeys/effect cmds disable AutoVJ silently
    try { window.api?.sendRemoteVj({ enabled: on, genre: vjRef.current.getGenre() }) } catch (_) {}
  }, [])

  const changeVJGenre = useCallback((g: Genre) => {
    vjRef.current.setGenre(g)
    setVjGenre(g)
    try { window.api?.sendRemoteVj({ enabled: vjRef.current.isEnabled(), genre: g }) } catch (_) {}
  }, [])

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
    localStorage.setItem(MODE_KEY, m)
  }, [])

  const finishOnboarding = useCallback(async (result: OnboardingResult | null) => {
    localStorage.setItem(ONBOARDED_KEY, '1')
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

  // FPS counter
  useEffect(() => {
    let frames = 0
    let lastTime = performance.now()
    let rafId = 0
    const tick = () => {
      frames++
      const now = performance.now()
      if (now - lastTime >= 1000) {
        setFps(frames)
        frames = 0
        lastTime = now
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Live performance hotkeys:
  // B blackout · F freeze · [ ] master · 1-0 effects · QWER post toggles · Space tap BPM
  useEffect(() => {
    if (!engine) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return

      const k = e.key.toLowerCase()

      if (k === 'b') {
        setBlackout(prev => { engine.setBlackout(!prev); return !prev })
      } else if (k === 'f') {
        setFrozen(prev => { engine.setFreeze(!prev); return !prev })
      } else if (k === 'p') {
        panic()
      } else if (e.key === '?') {
        // U2.2 — Shift+/ apre/chiude direttamente la cheat sheet
        setShowCheatSheet(prev => !prev)
      } else if (e.key === '[') {
        setBrightness(prev => { const v = Math.max(0, prev - 0.05); engine.setBrightness(v); return v })
      } else if (e.key === ']') {
        setBrightness(prev => { const v = Math.min(1, prev + 0.05); engine.setBrightness(v); return v })
      } else if (k >= '0' && k <= '9') {
        const idx = k === '0' ? 9 : parseInt(k) - 1
        const effect = HOTKEY_EFFECTS[idx]
        if (effect) { toggleVJ(false); engine.setEffect(effect) }
      } else if (k in HOTKEY_POSTS) {
        engine.togglePost(HOTKEY_POSTS[k])
      } else if (k === ' ') {
        e.preventDefault()
        engine.audioAnalyzer.setBpmMode('tap')
        engine.audioAnalyzer.tap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [engine, toggleVJ, panic])

  // Shared command dispatch — phone remote, OSC (via remote:cmd) and MIDI all
  // land here so every surface drives the engine identically
  const dispatchCmd = useCallback((cmd: { type: string; value?: unknown; source?: string }) => {
    if (!engine) return
    const v = cmd.value as any
    switch (cmd.type) {
        case 'panic': panic(); break
        case 'effect': toggleVJ(false); engine.setEffect(v); break
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
        case 'blendMode': engine.setBlendMode(v); break
        case 'param': engine.setParamValue(v.key, v.value); break
        case 'paramMap': engine.setParamMapping(v.key, v.source, v.depth); break
        case 'transitionType': engine.setTransitionType(v); break
        case 'transitionDuration': engine.setTransitionDuration(v); break
        case 'look': {
          // Looks live in this renderer's localStorage — same source LookBank reads
          try {
            const looks = JSON.parse(localStorage.getItem('djtographikz-looks') || '[]') as ({ preset: Preset } | null)[]
            const slot = looks[v]
            if (slot?.preset) { toggleVJ(false); engine.applyPreset(slot.preset) }
          } catch (_) {}
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
  }, [engine, toggleVJ, changeVJGenre, panic])

  // Phone remote / OSC → engine (commands arrive from the main process)
  useEffect(() => {
    if (!engine) return
    return window.api.onRemoteCommand(dispatchCmd)
  }, [engine, dispatchCmd])

  const fpsColor = fps > 55 ? 'var(--accent)' : fps > 30 ? 'var(--warning)' : 'var(--danger)'

  return (
    <div className="app-layout">
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}
      {showRemote && <RemoteModal onClose={() => setShowRemote(false)} />}
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
          <span className="deck-label" title="Luminosità master ([ / ])">MASTER</span>
          <input
            className="tb-master"
            type="range" min={0} max={1} step={0.01}
            value={brightness}
            onChange={e => {
              const v = parseFloat(e.target.value)
              setBrightness(v)
              engine?.setBrightness(v)
            }}
            title="Luminosità master ([ / ])"
          />
          <button
            className={`btn btn-sm ${blackout ? 'btn-danger' : 'btn-secondary'}`}
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

        <div className="tb-group">
          <button className="btn btn-secondary btn-sm" onClick={screenshot} title="Screenshot PNG">
            <IconCamera />
          </button>
          <button
            className={`btn btn-sm ${recording ? 'btn-danger' : 'btn-secondary'}`}
            onClick={toggleRecording}
            title={recording ? 'Ferma e salva la registrazione WebM' : 'Registra la preview in WebM'}
          >
            {recording ? <IconStop /> : <IconRecord />}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowRemote(true)} title="Remote dal telefono (QR + codice)">
            <IconPhone />
          </button>
          {outputInfo && (outputInfo.open ? (
            <span className="output-chip" title="Stato della finestra di output">
              <IconMonitor size={14} />
              Output · {outputInfo.display}{outputInfo.fullscreen ? ' · FS' : ''}
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
              defaultValue=""
              onChange={e => {
                const id = parseInt(e.target.value)
                if (!isNaN(id)) window.api?.moveOutputToDisplay(id)
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
            value={outputRes}
            onChange={e => {
              setOutputRes(e.target.value)
              const [w, h] = e.target.value.split('x').map(Number)
              engine?.setRenderSize(w, h)
              window.api?.setOutputResolution(w, h)
            }}
            title="Risoluzione di uscita"
          >
            <option value="1280x720">720p</option>
            <option value="1920x1080">1080p</option>
            <option value="2560x1440">1440p</option>
            <option value="3840x2160">4K</option>
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              window.api?.toggleOutputFullscreen()
              // fullscreen flips have no dedicated event — re-read after the switch
              setTimeout(refreshOutputInfo, 400)
            }}
            title="Fullscreen della finestra di output"
          >
            <IconFullscreen />
          </button>
        </div>

        <div className="tb-group">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowHelpMenu(v => !v)}
            title="Aiuto — scorciatoie, guida, configurazione (?)"
          >
            <IconHelp />
          </button>
        </div>
      </div>

      {/* U1.2 — slim static banner: layout shifts once, no overlay on the preview */}
      {audioStatus === 'reconnecting' && (
        <div className="audio-banner">⚠ Audio perso — riconnessione in corso…</div>
      )}

      {/* Main layout — U4.1: in live niente sidebar, solo preview + Look Bank */}
      <div className={`main-area${mode === 'live' ? ' live-layout' : ''}`}>
        {/* Left sidebar */}
        {mode !== 'live' && (
        <div className={`sidebar${mode === 'simple' ? ' sidebar-wide' : ''}`}>
          <AudioPanel engine={engine} />
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
              {engine && <LookBank engine={engine} />}
            </>
          ) : (
            <>
              <EffectPanel engine={engine} />
              <AutoVJPanel
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
        <div className="center-area">
          <div className={`preview-container${previewCompact && mode !== 'live' ? ' compact' : ''}`}>
            <canvas ref={canvasRef} className="preview-canvas" />
            {mode !== 'live' && (
              <button
                className="preview-toggle"
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
          {mode === 'live' && engine && (
            <div className="live-lookbank">
              <LookBank engine={engine} />
            </div>
          )}
        </div>

        {/* Right sidebar — pro only */}
        {mode === 'pro' && (
          <div className="sidebar-right">
            {engine && <LookBank engine={engine} />}
            <OverlayPanel engine={engine} />
            <PresetPanel engine={engine} />
            <ShaderEditor engine={engine} />
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
        <label className="beatflash-toggle" title="Flash del bordo preview a ogni beat">
          <input
            type="checkbox"
            checked={beatFlash}
            onChange={e => {
              setBeatFlash(e.target.checked)
              try { localStorage.setItem(BEATFLASH_KEY, e.target.checked ? '1' : '0') } catch (_) {}
            }}
          />
          flash beat
        </label>
        <span>B blackout · F freeze · P panic · [ ] master · 1-0 effetti · QWER post · Space tap</span>
      </div>

      <Toasts />
    </div>
  )
}
