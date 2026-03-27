import React, { useEffect, useRef, useState } from 'react'
import { AudioPanel } from './components/AudioPanel/AudioPanel'
import { EffectPanel } from './components/EffectPanel/EffectPanel'
import { OverlayPanel } from './components/OverlayPanel/OverlayPanel'
import { PresetPanel } from './components/PresetPanel/PresetPanel'
import { Engine } from '@engine/Engine'

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [engine, setEngine] = useState<Engine | null>(null)
  const [fps, setFps] = useState(0)
  const [outputRes, setOutputRes] = useState('1920x1080')

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

  const fpsColor = fps > 55 ? 'var(--accent)' : fps > 30 ? 'var(--warning)' : 'var(--danger)'

  return (
    <div className="app-layout">
      {/* Top bar */}
      <div className="top-bar">
        <span className="title">DJtoGraphikz</span>
        <div className="spacer" />
        <select
          value={outputRes}
          onChange={e => {
            setOutputRes(e.target.value)
            const [w, h] = e.target.value.split('x').map(Number)
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
        </div>

        {/* Center — Preview */}
        <div className="center-area">
          <div className="preview-container">
            <canvas ref={canvasRef} className="preview-canvas" />
            <span className="preview-label">PREVIEW</span>
          </div>
        </div>

        {/* Right sidebar — Overlays + Presets */}
        <div className="sidebar-right">
          <OverlayPanel engine={engine} />
          <PresetPanel engine={engine} />
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="bottom-bar">
        <span style={{ color: fpsColor }}>{fps} FPS</span>
        <span>|</span>
        <span>{outputRes}</span>
        <div className="spacer" />
        <span>Electron + Three.js + GLSL</span>
      </div>
    </div>
  )
}
