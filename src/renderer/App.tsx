import React, { useEffect, useRef, useState } from 'react'
import { AudioPanel } from './components/AudioPanel/AudioPanel'
import { EffectPanel } from './components/EffectPanel/EffectPanel'
import { AutoVJPanel } from './components/AutoVJPanel/AutoVJPanel'
import { OverlayPanel } from './components/OverlayPanel/OverlayPanel'
import { PresetPanel } from './components/PresetPanel/PresetPanel'
import { ShaderEditor } from './components/ShaderEditor/ShaderEditor'
import { DeckPanel } from './components/DeckPanel/DeckPanel'
import { Engine } from '@engine/Engine'

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [engine, setEngine] = useState<Engine | null>(null)
  const [fps, setFps] = useState(0)
  const [outputRes, setOutputRes] = useState('1920x1080')
  const [brightness, setBrightness] = useState(1)
  const [blackout, setBlackout] = useState(false)
  const [frozen, setFrozen] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return

    const eng = new Engine(canvasRef.current)
    eng.onStateChange = (state) => {
      try { window.api?.sendEngineState(state) } catch (_) {}
    }
    eng.start()
    setEngine(eng)
    return () => { eng.dispose(); setEngine(null) }
  }, [])

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
      {/* Top bar */}
      <div className="top-bar">
        <span className="title">DJtoGraphikz</span>

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
          title="Output resolution"
        >
          <option value="1280x720">720p</option>
          <option value="1920x1080">1080p</option>
          <option value="2560x1440">1440p</option>
          <option value="3840x2160">4K</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => window.api?.toggleOutputFullscreen()}>
          Fullscreen
        </button>
      </div>

      {/* Main 3-column layout */}
      <div className="main-area">
        {/* Left sidebar — Audio + Effects */}
        <div className="sidebar">
          <AudioPanel engine={engine} />
          <EffectPanel engine={engine} />
          <AutoVJPanel engine={engine} />
        </div>

        {/* Center — Preview + deck crossfader */}
        <div className="center-area">
          <div className="preview-container">
            <canvas ref={canvasRef} className="preview-canvas" />
            <span className="preview-label">PREVIEW</span>
          </div>
          <DeckPanel engine={engine} />
        </div>

        {/* Right sidebar — Overlays + Presets */}
        <div className="sidebar-right">
          <OverlayPanel engine={engine} />
          <PresetPanel engine={engine} />
          <ShaderEditor engine={engine} />
        </div>
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
