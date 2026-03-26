import React, { useEffect, useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { OutputPreview } from './components/OutputPreview/OutputPreview'
import { Engine } from '@engine/Engine'

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [engine, setEngine] = useState<Engine | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const eng = new Engine(canvasRef.current)

    // Sync state changes to output window via IPC
    eng.onStateChange = (state) => {
      try {
        window.api?.sendEngineState(state)
      } catch (_) {}
    }

    eng.start()
    setEngine(eng)

    return () => {
      eng.dispose()
      setEngine(null)
    }
  }, [])

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100%',
      overflow: 'hidden'
    }}>
      <Sidebar engine={engine} />
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        padding: '8px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          marginBottom: '8px',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--panel-radius)',
          border: '1px solid var(--border)'
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--accent)'
          }}>
            DJtoGraphikz
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => window.api?.toggleOutputFullscreen()}
            >
              Toggle Fullscreen
            </button>
          </div>
        </div>
        <OutputPreview canvasRef={canvasRef} />
      </div>
    </div>
  )
}
