import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { Engine } from '@engine/Engine'
import type { BpmMode } from '@engine/audio/AudioAnalyzer'

interface AudioPanelProps {
  engine: Engine | null
}

const BPM_MODES: { id: BpmMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'tap', label: 'Tap' },
  { id: 'manual', label: 'Manual' },
]

export function AudioPanel({ engine }: AudioPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [audioActive, setAudioActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bpmMode, setBpmMode] = useState<BpmMode>('auto')
  const [manualBpm, setManualBpm] = useState(128)
  const [displayBpm, setDisplayBpm] = useState(128)
  const [sensitivity, setSensitivity] = useState(0.5)
  const [inputGain, setInputGain] = useState(1.0)
  const [confidence, setConfidence] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const beatFlashRef = useRef(0)

  const refreshDevices = async () => {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      tempStream.getTracks().forEach(t => t.stop())
      const all = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = all.filter(d => d.kind === 'audioinput')
      setDevices(audioInputs)
      if (audioInputs.length > 0 && !selectedDevice) {
        setSelectedDevice(audioInputs[0].deviceId)
      }
      setError(null)
    } catch (err: any) {
      console.error('Failed to enumerate devices:', err)
      setError(`Cannot access audio: ${err.message}`)
    }
  }

  useEffect(() => {
    refreshDevices()
  }, [])

  const startAudio = async () => {
    if (!engine) { setError('Engine not ready'); return }
    try {
      setError(null)
      await engine.audioAnalyzer.start(selectedDevice || undefined)
      setAudioActive(true)
      drawSpectrum()
    } catch (err: any) {
      console.error('Failed to start audio:', err)
      setError(`Audio error: ${err.message}`)
    }
  }

  const stopAudio = () => {
    if (!engine) return
    engine.audioAnalyzer.stop()
    setAudioActive(false)
    cancelAnimationFrame(animFrameRef.current)
  }

  const handleBpmMode = useCallback((mode: BpmMode) => {
    if (!engine) return
    engine.audioAnalyzer.setBpmMode(mode)
    setBpmMode(mode)
  }, [engine])

  const handleManualBpm = useCallback((val: number) => {
    if (!engine) return
    const bpm = Math.max(60, Math.min(300, val))
    engine.audioAnalyzer.setManualBpm(bpm)
    setManualBpm(bpm)
  }, [engine])

  const handleTap = useCallback(() => {
    if (!engine) return
    const result = engine.audioAnalyzer.tap()
    if (result > 0) {
      setManualBpm(result)
    }
  }, [engine])

  const handleSensitivity = useCallback((val: number) => {
    if (!engine) return
    engine.audioAnalyzer.setSensitivity(val)
    setSensitivity(val)
  }, [engine])

  const handleInputGain = useCallback((val: number) => {
    if (!engine) return
    engine.audioAnalyzer.setInputGain(val)
    setInputGain(val)
  }, [engine])

  const drawSpectrum = () => {
    if (!canvasRef.current || !engine) return
    const ctx = canvasRef.current.getContext('2d')!
    const w = canvasRef.current.width
    const h = canvasRef.current.height
    const data = engine.audioAnalyzer.getFrequencyData()

    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, w, h)

    if (data) {
      const barCount = 64
      const step = Math.max(1, Math.floor(data.length / barCount))
      const barW = w / barCount

      for (let i = 0; i < barCount; i++) {
        const val = data[i * step] / 255
        const barH = val * h
        const hue = 140 + val * 60
        ctx.fillStyle = `hsl(${hue}, 100%, ${40 + val * 30}%)`
        ctx.fillRect(i * barW, h - barH, barW - 1, barH)
      }

      const audioData = engine.audioAnalyzer.getData()

      // Beat flash overlay
      if (audioData.beatDetected) beatFlashRef.current = 1.0
      if (beatFlashRef.current > 0.05) {
        ctx.fillStyle = `rgba(0, 255, 136, ${beatFlashRef.current * 0.25})`
        ctx.fillRect(0, 0, w, h)
        beatFlashRef.current *= 0.85
      }

      // Update display BPM
      setDisplayBpm(Math.round(audioData.bpm))
      setConfidence(engine.audioAnalyzer.getBpmConfidence())

      ctx.fillStyle = '#00ff88'
      ctx.font = '10px monospace'
      ctx.fillText(`BPM: ${audioData.bpm.toFixed(0)}`, 4, 12)
      ctx.fillText(`Energy: ${(audioData.energy * 100).toFixed(0)}%`, 4, 24)
      ctx.fillText(`Bass: ${(audioData.bass * 100).toFixed(0)}%`, w - 80, 12)
      ctx.fillText(`Beat: ${audioData.beatDetected ? 'YES' : '-'}`, w - 80, 24)
    }

    animFrameRef.current = requestAnimationFrame(drawSpectrum)
  }

  return (
    <div className="panel">
      <div className="panel-header" onClick={() => setCollapsed(!collapsed)}>
        <span>Audio Input</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {error && (
            <div style={{
              padding: '6px 8px',
              background: 'rgba(255,68,68,0.15)',
              border: '1px solid rgba(255,68,68,0.3)',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#ff6666'
            }}>
              {error}
            </div>
          )}
          <div>
            <div className="label">Device ({devices.length} found)</div>
            <select
              value={selectedDevice}
              onChange={e => setSelectedDevice(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              {devices.length === 0 && (
                <option value="">No audio devices found</option>
              )}
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Audio Input ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn ${audioActive ? 'btn-danger' : 'btn-primary'}`}
              onClick={audioActive ? stopAudio : startAudio}
              style={{ flex: 1 }}
            >
              {audioActive ? 'Stop Audio' : 'Start Audio'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={refreshDevices}
              title="Refresh device list"
            >
              Refresh
            </button>
          </div>

          {/* Input Gain — amplify weak mic signals */}
          {audioActive && (
            <div>
              <div style={catLabel}>Input Gain</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '18px' }}>1x</span>
                <input
                  type="range"
                  min={1} max={10} step={0.5}
                  value={inputGain}
                  onChange={e => handleInputGain(parseFloat(e.target.value))}
                  style={{ flex: 1, height: '14px' }}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', width: '30px', textAlign: 'right' }}>
                  {inputGain.toFixed(1)}x
                </span>
              </div>
            </div>
          )}

          {/* Spectrum visualizer */}
          <canvas
            ref={canvasRef}
            width={296}
            height={60}
            style={{
              width: '100%',
              height: '60px',
              borderRadius: '4px',
              background: 'var(--bg-primary)'
            }}
          />

          {/* Beat Sensitivity */}
          <div>
            <div style={catLabel}>Beat Sensitivity</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '28px' }}>Low</span>
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={sensitivity}
                onChange={e => handleSensitivity(parseFloat(e.target.value))}
                style={{ flex: 1, height: '14px' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '28px', textAlign: 'right' }}>High</span>
            </div>
          </div>

          {/* BPM Section */}
          <div>
            <div style={catLabel}>
              BPM
              <span style={{
                marginLeft: '8px',
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}>
                {displayBpm}
              </span>
              {bpmMode === 'auto' && confidence > 0 && (
                <span style={{
                  marginLeft: '6px',
                  fontSize: '9px',
                  color: confidence > 0.5 ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                  {confidence > 0.5 ? 'locked' : 'detecting...'}
                </span>
              )}
            </div>

            {/* Mode selector */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              {BPM_MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => handleBpmMode(mode.id)}
                  style={{
                    flex: 1,
                    padding: '5px 6px',
                    borderRadius: '4px',
                    border: bpmMode === mode.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: bpmMode === mode.id ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                    color: bpmMode === mode.id ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: bpmMode === mode.id ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Tap button */}
            {bpmMode === 'tap' && (
              <button
                className="btn btn-primary"
                onClick={handleTap}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  marginBottom: '4px',
                }}
              >
                TAP ({manualBpm} BPM)
              </button>
            )}

            {/* Manual BPM input */}
            {bpmMode === 'manual' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleManualBpm(manualBpm - 1)}
                  style={{ padding: '4px 10px', fontSize: '14px', fontWeight: 700 }}
                >
                  -
                </button>
                <input
                  type="number"
                  min={60} max={300}
                  value={manualBpm}
                  onChange={e => handleManualBpm(parseInt(e.target.value) || 128)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 700,
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => handleManualBpm(manualBpm + 1)}
                  style={{ padding: '4px 10px', fontSize: '14px', fontWeight: 700 }}
                >
                  +
                </button>
              </div>
            )}

            {/* Auto mode info + reset */}
            {bpmMode === 'auto' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  flex: 1,
                }}>
                  {audioActive
                    ? (confidence > 0.5
                      ? `Detected: ${displayBpm} BPM`
                      : 'Listening...')
                    : 'Start audio to detect BPM'}
                </div>
                {audioActive && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => engine?.audioAnalyzer.resetBpm()}
                    style={{ fontSize: '10px', padding: '3px 8px' }}
                    title="Re-detect BPM (use when track changes)"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const catLabel: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: '4px',
  display: 'flex',
  alignItems: 'baseline',
  gap: '4px',
}
