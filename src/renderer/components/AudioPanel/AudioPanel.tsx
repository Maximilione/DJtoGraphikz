import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { Engine } from '@engine/Engine'
import type { BpmMode } from '@engine/audio/AudioAnalyzer'
import { NumberInput } from '../NumberInput/NumberInput'

interface AudioPanelProps {
  engine: Engine | null
}

const BPM_MODES: { id: BpmMode; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'Rileva il BPM automaticamente dal segnale audio' },
  { id: 'tap', label: 'Tap', hint: 'Batti il tempo a mano con il pulsante TAP' },
  { id: 'manual', label: 'Manuale', hint: 'Imposta il BPM a mano' },
]

const AUDIO_STORE_KEY = 'djtographikz-audio'

interface SavedAudioSettings {
  deviceId?: string
  bpmMode?: BpmMode
  manualBpm?: number
  sensitivity?: number
  inputGain?: number
  running?: boolean
}

function loadAudioSettings(): SavedAudioSettings {
  try {
    return JSON.parse(localStorage.getItem(AUDIO_STORE_KEY) || 'null') || {}
  } catch {
    return {}
  }
}

export function AudioPanel({ engine }: AudioPanelProps) {
  // Persisted settings from the previous session — read once per mount
  const savedRef = useRef<SavedAudioSettings>(loadAudioSettings())
  const saved = savedRef.current
  const [collapsed, setCollapsed] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>(saved.deviceId ?? '')
  const [audioActive, setAudioActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bpmMode, setBpmMode] = useState<BpmMode>(saved.bpmMode ?? 'auto')
  const [manualBpm, setManualBpm] = useState(saved.manualBpm ?? 128)
  const [displayBpm, setDisplayBpm] = useState(128)
  const [sensitivity, setSensitivity] = useState(saved.sensitivity ?? 0.5)
  const [inputGain, setInputGain] = useState(saved.inputGain ?? 1.0)
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
      setError(`Accesso audio negato: ${err.message}`)
    }
  }

  useEffect(() => {
    refreshDevices()
  }, [])

  // Push panel settings into the analyzer — needed on restore and after every
  // (re)start, since start() rebuilds the audio graph
  const applyAnalyzerSettings = () => {
    if (!engine) return
    engine.audioAnalyzer.setSensitivity(sensitivity)
    engine.audioAnalyzer.setInputGain(inputGain)
    engine.audioAnalyzer.setBpmMode(bpmMode)
    engine.audioAnalyzer.setManualBpm(manualBpm)
  }

  // Restore last session: apply saved settings, and if audio was running with
  // a saved device, auto-start the analyzer (the 500ms poll picks up the UI)
  const restoredRef = useRef(false)
  useEffect(() => {
    if (!engine || restoredRef.current) return
    restoredRef.current = true
    applyAnalyzerSettings()
    const s = savedRef.current
    if (s.running && s.deviceId && !engine.audioAnalyzer.isRunning) {
      engine.audioAnalyzer.start(s.deviceId)
        .then(applyAnalyzerSettings)
        .catch((err: any) => console.warn('[AudioPanel] auto-start failed:', err))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  // Persist settings — writes are rare (user tweaks), no debounce needed
  useEffect(() => {
    try {
      localStorage.setItem(AUDIO_STORE_KEY, JSON.stringify({
        deviceId: selectedDevice,
        bpmMode,
        manualBpm,
        sensitivity,
        inputGain,
        running: audioActive,
      }))
    } catch { /* private mode / quota — non-fatal */ }
  }, [selectedDevice, bpmMode, manualBpm, sensitivity, inputGain, audioActive])

  // Audio and BPM mode can change from outside this panel (onboarding, Space
  // hotkey) — keep local state in sync
  useEffect(() => {
    if (!engine) return
    const id = window.setInterval(() => {
      const running = engine.audioAnalyzer.isRunning
      if (running !== audioActive) {
        setAudioActive(running)
        if (running) drawSpectrum()
        else cancelAnimationFrame(animFrameRef.current)
      }
      const m = engine.audioAnalyzer.getBpmMode()
      if (m !== bpmMode) setBpmMode(m)
      const mb = engine.audioAnalyzer.getManualBpm()
      if (mb !== manualBpm) setManualBpm(mb)
    }, 500)
    return () => clearInterval(id)
  }, [engine, audioActive, bpmMode, manualBpm])

  // Detectors often lock onto half or double tempo on four-to-the-floor —
  // these snap the current BPM by the factor and hand control to manual mode
  const scaleBpm = useCallback((factor: number) => {
    if (!engine) return
    const current = engine.audioAnalyzer.getEffectiveBpm()
    const next = Math.round(Math.max(60, Math.min(300, current * factor)))
    engine.audioAnalyzer.setBpmMode('manual')
    engine.audioAnalyzer.setManualBpm(next)
    setBpmMode('manual')
    setManualBpm(next)
  }, [engine])

  const startAudio = async () => {
    if (!engine) { setError('Engine non pronto'); return }
    try {
      setError(null)
      await engine.audioAnalyzer.start(selectedDevice || undefined)
      applyAnalyzerSettings()
      setAudioActive(true)
      drawSpectrum()
    } catch (err: any) {
      console.error('Failed to start audio:', err)
      setError(`Errore audio: ${err.message}`)
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

      // Update display BPM (throttle to avoid 60fps React re-renders)
      const roundedBpm = Math.round(audioData.bpm)
      const conf = engine.audioAnalyzer.getBpmConfidence()
      if (roundedBpm !== displayBpm) setDisplayBpm(roundedBpm)
      if (Math.abs(conf - confidence) > 0.05) setConfidence(conf)

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
      <div
        className="panel-header"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Espandi Ingresso audio' : 'Comprimi Ingresso audio'}
      >
        <span>Ingresso audio</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div className="u-col">
          {error && <div className="u-error">{error}</div>}
          <div>
            <div className="label">Dispositivo ({devices.length} trovati)</div>
            <select
              value={selectedDevice}
              onChange={e => setSelectedDevice(e.target.value)}
              title="Sorgente audio da analizzare"
              style={{ width: '100%' }}
            >
              {devices.length === 0 && (
                <option value="">Nessun dispositivo audio</option>
              )}
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Ingresso audio ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn ${audioActive ? 'btn-danger' : 'btn-primary'}`}
              onClick={audioActive ? stopAudio : startAudio}
              title={audioActive ? 'Ferma l\'analisi audio' : 'Avvia l\'analisi audio'}
              style={{ flex: 1 }}
            >
              {audioActive ? 'Ferma audio' : 'Avvia audio'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={refreshDevices}
              title="Aggiorna la lista dei dispositivi"
            >
              Aggiorna
            </button>
          </div>

          {/* Input Gain — amplify weak mic signals */}
          {audioActive && (
            <div>
              <div className="cat-label">Gain ingresso</div>
              <div className="u-row">
                <span className="u-hint" style={{ width: '18px' }}>1x</span>
                <input
                  type="range"
                  min={1} max={10} step={0.5}
                  value={inputGain}
                  title="Amplifica i segnali deboli (es. microfono lontano)"
                  onChange={e => handleInputGain(parseFloat(e.target.value))}
                  style={{ flex: 1 }}
                />
                <NumberInput
                  value={inputGain}
                  min={1} max={10} step={0.5}
                  suffix="x"
                  onChange={handleInputGain}
                />
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
            <div className="cat-label">Sensibilità beat</div>
            <div className="u-row">
              <span className="u-hint" style={{ width: '28px' }}>Min</span>
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={sensitivity}
                title="Quanto facilmente scatta il rilevamento del beat"
                onChange={e => handleSensitivity(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <span className="u-hint" style={{ width: '28px', textAlign: 'right' }}>Max</span>
            </div>
          </div>

          {/* BPM Section */}
          <div>
            <div className="cat-label" style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
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
                <span className="u-hint" style={{
                  marginLeft: '6px',
                  color: confidence > 0.5 ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                  {confidence > 0.5 ? 'agganciato' : 'rilevo…'}
                </span>
              )}
              <span style={{ flex: 1 }} />
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => scaleBpm(0.5)}
                title="Dimezza il BPM (il detector ha agganciato il doppio tempo)"
              >
                ×½
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => scaleBpm(2)}
                title="Raddoppia il BPM (il detector ha agganciato il mezzo tempo)"
              >
                ×2
              </button>
            </div>

            {/* Mode selector */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              {BPM_MODES.map(mode => (
                <button
                  key={mode.id}
                  className={`pill${bpmMode === mode.id ? ' active' : ''}`}
                  title={mode.hint}
                  onClick={() => handleBpmMode(mode.id)}
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
                title="Batti il tempo: un click per ogni beat"
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
              <div className="u-row">
                <button
                  className="btn btn-secondary"
                  onClick={() => handleManualBpm(manualBpm - 1)}
                  title="Diminuisci il BPM di 1"
                  style={{ padding: '4px 10px', fontSize: '14px', fontWeight: 700 }}
                >
                  -
                </button>
                <input
                  type="number"
                  min={60} max={300}
                  value={manualBpm}
                  title="BPM manuale (60-300)"
                  onChange={e => handleManualBpm(parseInt(e.target.value) || 128)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: '14px',
                    fontWeight: 700,
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => handleManualBpm(manualBpm + 1)}
                  title="Aumenta il BPM di 1"
                  style={{ padding: '4px 10px', fontSize: '14px', fontWeight: 700 }}
                >
                  +
                </button>
              </div>
            )}

            {/* Auto mode info + reset */}
            {bpmMode === 'auto' && (
              <div className="u-row">
                <div className="u-hint" style={{ flex: 1 }}>
                  {audioActive
                    ? (confidence > 0.5
                      ? `Rilevato: ${displayBpm} BPM`
                      : 'In ascolto…')
                    : 'Avvia l\'audio per rilevare il BPM'}
                </div>
                {audioActive && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => engine?.audioAnalyzer.resetBpm()}
                    title="Rileva di nuovo il BPM (usa al cambio traccia)"
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
