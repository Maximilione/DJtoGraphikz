import React, { useEffect, useRef, useState, useCallback } from 'react'
import { AudioPanel } from './components/AudioPanel/AudioPanel'
import { EffectPanel } from './components/EffectPanel/EffectPanel'
import { AutoVJPanel } from './components/AutoVJPanel/AutoVJPanel'
import { OverlayPanel } from './components/OverlayPanel/OverlayPanel'
import { PresetPanel } from './components/PresetPanel/PresetPanel'
import { ShaderEditor } from './components/ShaderEditor/ShaderEditor'
import { DeckPanel } from './components/DeckPanel/DeckPanel'
import { SimplePanel } from './components/SimplePanel/SimplePanel'
import { Onboarding, type OnboardingResult } from './components/Onboarding/Onboarding'
import { Engine } from '@engine/Engine'
import { AutoVJ, type Genre } from '@engine/AutoVJ'

type UIMode = 'simple' | 'pro'
const MODE_KEY = 'djtographikz-ui-mode'
const ONBOARDED_KEY = 'djtographikz-onboarded'

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
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDED_KEY))

  // AutoVJ lives here so Simple and Pro views share one instance
  const vjRef = useRef<AutoVJ>(new AutoVJ())
  const [vjEnabled, setVjEnabled] = useState(false)
  const [vjGenre, setVjGenre] = useState<Genre>('acid-techno')
  const [vjStatus, setVjStatus] = useState({ current: '', count: 0 })

  useEffect(() => {
    if (!canvasRef.current) return

    const eng = new Engine(canvasRef.current)
    eng.onStateChange = (state) => {
      try { window.api?.sendEngineState(state) } catch (_) {}
    }
    eng.start()

    // Wire AutoVJ → engine
    const vj = vjRef.current
    vj.onEffectChange = (effect) => {
      eng.setEffect(effect)
      setVjStatus(prev => ({ current: effect, count: prev.count + 1 }))
    }
    vj.onPostChange = (posts) => eng.setActivePosts(posts)
    vj.onPaletteChange = (colors) => eng.setColors(colors[0], colors[1], colors[2])
    const unsubscribe = eng.onAudioFrame((beat, energy, bass) => vj.update(beat, energy, bass))

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

  const toggleVJ = useCallback((on: boolean) => {
    vjRef.current.setEnabled(on)
    setVjEnabled(on)
    if (on) setVjStatus({ current: '', count: 0 })
  }, [])

  const changeVJGenre = useCallback((g: Genre) => {
    vjRef.current.setGenre(g)
    setVjGenre(g)
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

  // Live performance hotkeys — B blackout, F freeze, [ / ] master brightness
  useEffect(() => {
    if (!engine) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return

      if (e.key === 'b' || e.key === 'B') {
        setBlackout(prev => { engine.setBlackout(!prev); return !prev })
      } else if (e.key === 'f' || e.key === 'F') {
        setFrozen(prev => { engine.setFreeze(!prev); return !prev })
      } else if (e.key === '[') {
        setBrightness(prev => { const v = Math.max(0, prev - 0.05); engine.setBrightness(v); return v })
      } else if (e.key === ']') {
        setBrightness(prev => { const v = Math.min(1, prev + 0.05); engine.setBrightness(v); return v })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [engine])

  const fpsColor = fps > 55 ? 'var(--accent)' : fps > 30 ? 'var(--warning)' : 'var(--danger)'

  return (
    <div className="app-layout">
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}

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
      </div>

      {/* Main layout */}
      <div className="main-area">
        {/* Left sidebar */}
        <div className={`sidebar${mode === 'simple' ? ' sidebar-wide' : ''}`}>
          <AudioPanel engine={engine} />
          {mode === 'simple' ? (
            <SimplePanel
              engine={engine}
              vjEnabled={vjEnabled}
              vjGenre={vjGenre}
              vjStatus={vjStatus}
              onVJToggle={toggleVJ}
              onVJGenre={changeVJGenre}
            />
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
        <span>B blackout · F freeze · [ ] master</span>
      </div>
    </div>
  )
}
