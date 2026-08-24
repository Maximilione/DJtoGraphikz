import React, { useEffect, useRef, useState, useCallback } from 'react'
import { AudioPanel } from './components/AudioPanel/AudioPanel'
import { EffectPanel } from './components/EffectPanel/EffectPanel'
import { AutoVJPanel } from './components/AutoVJPanel/AutoVJPanel'
import { OverlayPanel } from './components/OverlayPanel/OverlayPanel'
import { PresetPanel } from './components/PresetPanel/PresetPanel'
import { ShaderEditor } from './components/ShaderEditor/ShaderEditor'
import { DeckPanel } from './components/DeckPanel/DeckPanel'
import { SimplePanel } from './components/SimplePanel/SimplePanel'
import { LookBank } from './components/LookBank/LookBank'
import { Onboarding, type OnboardingResult } from './components/Onboarding/Onboarding'
import { RemoteModal } from './components/RemoteModal/RemoteModal'
import { Engine, BLEND_MODES, type EffectId, type PostId, type EngineState, type TransitionType, type Preset } from '@engine/Engine'
import { AutoVJ, GENRE_CONFIGS, type Genre } from '@engine/AutoVJ'
import { EFFECT_CATEGORIES, COLOR_PRESETS } from './components/EffectPanel/EffectPanel'

type UIMode = 'simple' | 'pro'
const MODE_KEY = 'djtographikz-ui-mode'
const ONBOARDED_KEY = 'djtographikz-onboarded'
const SETTINGS_KEY = 'djtographikz-settings'

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

  // AutoVJ lives here so Simple and Pro views share one instance
  const vjRef = useRef<AutoVJ>(new AutoVJ())
  const [vjEnabled, setVjEnabled] = useState(false)
  const [vjGenre, setVjGenre] = useState<Genre>('acid-techno')
  const [vjStatus, setVjStatus] = useState({ current: '', count: 0 })

  // Displays for the output-monitor picker
  const [displays, setDisplays] = useState<{ id: number; label: string; primary: boolean }[]>([])

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
  }, [engine, toggleVJ])

  // Phone remote → engine. Commands arrive from the main process HTTP server.
  useEffect(() => {
    if (!engine) return
    return window.api.onRemoteCommand(cmd => {
      const v = cmd.value as any
      switch (cmd.type) {
        case 'effect': toggleVJ(false); engine.setEffect(v); break
        case 'post': engine.togglePost(v); break
        case 'palette': engine.setColors(v[0], v[1], v[2]); break
        case 'crossfade': engine.setCrossfade(v); break
        case 'deckB': engine.setDeckBEffect(v); break
        case 'brightness': setBrightness(v); engine.setBrightness(v); break
        case 'blackout': setBlackout(!!v); engine.setBlackout(!!v); break
        case 'freeze': setFrozen(!!v); engine.setFreeze(!!v); break
        case 'autovj': toggleVJ(!!v); break
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
    })
  }, [engine, toggleVJ, changeVJGenre])

  const fpsColor = fps > 55 ? 'var(--accent)' : fps > 30 ? 'var(--warning)' : 'var(--danger)'

  return (
    <div className="app-layout">
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}
      {showRemote && <RemoteModal onClose={() => setShowRemote(false)} />}

      {/* Top bar */}
      <div className="top-bar">
        <span className="title">DJtoGraphikz</span>

        {/* Simple / Pro switch */}
        <div className="mode-switch">
          <button className={mode === 'simple' ? 'active' : ''} onClick={() => changeMode('simple')}>
            SIMPLE
          </button>
          <button className={mode === 'pro' ? 'active' : ''} onClick={() => changeMode('pro')}>
            PRO
          </button>
        </div>

        <span className="deck-label" title="Master brightness ([ / ])">MASTER</span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={brightness}
          onChange={e => {
            const v = parseFloat(e.target.value)
            setBrightness(v)
            engine?.setBrightness(v)
          }}
          style={{ width: '90px' }}
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
          title="Freeze frame (F)"
        >
          FREEZE
        </button>

        <div className="spacer" />
        <button className="btn btn-secondary btn-sm" onClick={screenshot} title="Salva screenshot PNG">
          📷
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowRemote(true)} title="Remote dal telefono (QR + codice)">
          📱
        </button>
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
        <button className="btn btn-secondary btn-sm" onClick={() => window.api?.toggleOutputFullscreen()} title="Fullscreen finestra di output">
          Fullscreen
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowOnboarding(true)}
          title="Rivedi la configurazione guidata"
        >
          ?
        </button>
      </div>

      {/* Main layout */}
      <div className="main-area">
        {/* Left sidebar */}
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

        {/* Center — Preview (+ deck crossfader in pro) */}
        <div className="center-area">
          <div className="preview-container">
            <canvas ref={canvasRef} className="preview-canvas" />
            <span className="preview-label">PREVIEW</span>
          </div>
          {mode === 'pro' && <DeckPanel engine={engine} />}
        </div>

        {/* Right sidebar — pro only */}
        {mode === 'pro' && (
          <div className="sidebar-right">
            {engine && <LookBank engine={engine} />}
            <OverlayPanel engine={engine} />
            <PresetPanel engine={engine} />
            <ShaderEditor engine={engine} />
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
        <span>B blackout · F freeze · [ ] master · 1-0 effetti · QWER post · Space tap</span>
      </div>
    </div>
  )
}
