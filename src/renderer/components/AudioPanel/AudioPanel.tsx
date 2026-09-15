import React, { useEffect, useRef, useState, useCallback } from 'react'
import { readJson, writeJson } from '../../storage'
import { pushToast } from '../Toasts/Toasts'
import { listAudioInputs } from '../../audioDevices'
import type { Engine } from '@engine/Engine'
import type { BpmMode } from '@engine/audio/AudioAnalyzer'
import { SliderRow } from '../SliderRow/SliderRow'
import { Panel } from '../Panel/Panel'
// one source of truth: a venue profile rewrites this very store (P2)
import { AUDIO_STORE_KEY } from '../../venues'

interface AudioPanelProps {
  engine: Engine | null
}

const BPM_MODES: { id: BpmMode; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'Rileva il BPM automaticamente dal segnale audio' },
  { id: 'tap', label: 'Tap', hint: 'Batti il tempo a mano con il pulsante TAP' },
  { id: 'manual', label: 'Manuale', hint: 'Imposta il BPM a mano' },
  { id: 'midi', label: 'MIDI', hint: 'Prende tempo e posizione nella battuta dal MIDI clock del mixer o del lettore — esatti, non stimati' },
]

/** 93.4 → "1:33". A transport with a raw seconds count is not a transport. */
function mmss(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface SavedAudioSettings {
  deviceId?: string
  bpmMode?: BpmMode
  manualBpm?: number
  sensitivity?: number
  inputGain?: number
  running?: boolean
}

function loadAudioSettings(): SavedAudioSettings {
  // `?? {}` and not a `{}` fallback: older builds could store a literal `null`.
  return readJson<SavedAudioSettings | null>(AUDIO_STORE_KEY, null) ?? {}
}

export function AudioPanel({ engine }: AudioPanelProps) {
  // Persisted settings from the previous session — read once per mount
  const savedRef = useRef<SavedAudioSettings>(loadAudioSettings())
  const saved = savedRef.current
  /** live = ticking right now; seen = a clock arrived at some point this session */
  const [clock, setClock] = useState({ live: false, seen: false })
  /** file transport, polled with the rest of the panel */
  const [file, setFile] = useState({ name: '', playing: false, at: 0, len: 0, loop: true })
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  // The rAF chain keeps running with the closure it started with, so comparing
  // against the state variables here would compare against the values captured
  // on the first render forever. Refs are what the loop can actually see.
  const shownBpmRef = useRef(128)
  const shownConfRef = useRef(0)
  const beatFlashRef = useRef(0)

  const refreshDevices = async () => {
    try {
      const audioInputs = await listAudioInputs()
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
  //
  // The condition is "not on that device", not "not running": loading a venue
  // profile (P2) remounts this panel while the analyzer is already running on
  // the *previous* room's sound card. `!isRunning` left it there, so the one
  // setting the profile exists for — which input the music comes in on — was
  // the one it silently did not restore.
  const restoredRef = useRef(false)
  useEffect(() => {
    if (!engine || restoredRef.current) return
    restoredRef.current = true
    applyAnalyzerSettings()
    const s = savedRef.current
    // A file under analysis is not a room's sound card: switching to the
    // profile's input there would yank the track being tested.
    const onFile = engine.audioAnalyzer.getSourceKind() === 'file'
    if (s.running && s.deviceId && !onFile && engine.audioAnalyzer.currentDeviceId !== s.deviceId) {
      engine.audioAnalyzer.start(s.deviceId)
        .then(applyAnalyzerSettings)
        .catch((err: any) => console.warn('[AudioPanel] auto-start failed:', err))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  // Persist settings — writes are rare (user tweaks), no debounce needed
  useEffect(() => {
    try {
      writeJson(AUDIO_STORE_KEY, ({
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
      const ck = engine.audioAnalyzer.hasMidiClock()
      const seen = engine.audioAnalyzer.sawMidiClock()
      setClock(c => (c.live === ck && c.seen === seen ? c : { live: ck, seen }))
      // The readout is normally refreshed by the spectrum draw, which only
      // runs while audio does. A MIDI clock works with no audio at all, so
      // the number has to be kept alive from here too.
      if (ck) {
        const b = Math.round(engine.audioAnalyzer.getEffectiveBpm())
        setDisplayBpm(d => (d === b ? d : b))
      }
      const a = engine.audioAnalyzer
      if (a.getSourceKind() === 'file') {
        setFile({
          name: a.getFileName(), playing: a.isPlaying(),
          at: a.getCurrentTime(), len: a.getDuration(), loop: a.isLooping(),
        })
      } else if (file.name) {
        setFile({ name: '', playing: false, at: 0, len: 0, loop: true })
      }
    }, 500)
    return () => clearInterval(id)
  }, [engine, audioActive, bpmMode, manualBpm, file.name])

  const loadFile = useCallback(async (f: File) => {
    if (!engine) return
    setError(null)
    try {
      await engine.audioAnalyzer.startFile(f)
      setAudioActive(true)
      drawSpectrum()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non riesco a leggere il file')
    }
  // drawSpectrum is a stable module-level closure over refs, not a dependency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) loadFile(f)
  }, [loadFile])

  // Detectors often lock onto half or double tempo on four-to-the-floor —
  // these snap the current BPM by the factor and hand control to manual mode
  const scaleBpm = useCallback((factor: number) => {
    if (!engine) return
    const current = engine.audioAnalyzer.getEffectiveBpm()
    const next = Math.round(Math.max(60, Math.min(300, current * factor)))
    // This leaves Auto. Neither the label nor the tooltip used to say so, and
    // the detector then stayed off for the rest of the set.
    const wasAuto = engine.audioAnalyzer.getBpmMode() === 'auto'
    engine.audioAnalyzer.setBpmMode('manual')
    engine.audioAnalyzer.setManualBpm(next)
    setBpmMode('manual')
    setManualBpm(next)
    if (wasAuto) pushToast(`BPM ${next} — rilevamento automatico disattivato`, 'bpm-manual')
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
    // getFrequencyData() re-reads the analyser into the same buffer that
    // update() already filled this frame — read the frame we have instead
    const data = engine.audioAnalyzer.getData().spectrum

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
      if (roundedBpm !== shownBpmRef.current) {
        shownBpmRef.current = roundedBpm
        setDisplayBpm(roundedBpm)
      }
      if (Math.abs(conf - shownConfRef.current) > 0.05) {
        shownConfRef.current = conf
        setConfidence(conf)
      }

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
    <Panel id="audio" title="Ingresso audio">
      <div
        className={`u-col${dragOver ? ' drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {/* A mic that was refused is not news while a file is playing: the
            analysis is running, just not on the input. An error about the file
            itself still shows, because then there is no file loaded. */}
        {error && !file.name && <div className="u-error">{error}</div>}

        {/* Dry run: the same analysis, on a file you can rewind. Everything
            about beat, BPM and envelope was otherwise only testable at a gig. */}
        {file.name ? (
          <div className="sub-card u-col" style={{ gap: 'var(--s2)' }}>
            <div className="u-row">
              <span className="cat-label" style={{ margin: 0, flex: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Prova a secco · {file.name}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={stopAudio}
                title="Chiudi il file e torna all'ingresso dal vivo"
              >
                Torna al vivo
              </button>
            </div>
            <div className="u-row">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { engine?.audioAnalyzer.playPause(); setFile(f => ({ ...f, playing: !f.playing })) }}
                title={file.playing ? 'Pausa' : 'Riproduci'}
                style={{ width: '52px' }}
              >
                {file.playing ? '❚❚' : '▶'}
              </button>
              <input
                type="range"
                min={0} max={Math.max(1, file.len)} step={0.1}
                value={file.at}
                title="Scorri nel brano — il rilevamento del tempo riparte da capo"
                onChange={e => {
                  const t = parseFloat(e.target.value)
                  engine?.audioAnalyzer.seek(t)
                  setFile(f => ({ ...f, at: t }))
                }}
                style={{ flex: 1, minWidth: 0 }}
              />
              <span className="u-value" style={{ width: '74px', flexShrink: 0 }}>
                {mmss(file.at)} / {mmss(file.len)}
              </span>
            </div>
            <button
              type="button"
              aria-pressed={file.loop}
              className={`row-item${file.loop ? ' active' : ''}`}
              onClick={() => { engine?.audioAnalyzer.setLooping(!file.loop); setFile(f => ({ ...f, loop: !f.loop })) }}
              title="Ricomincia da capo alla fine del brano"
            >
              <div className={`toggle${file.loop ? ' active' : ''}`} />
              <span className="row-title">Ripeti</span>
            </button>
          </div>
        ) : (
        <>
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
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => fileInputRef.current?.click()}
          title="Analizza un mp3 o un wav al posto dell'ingresso: la prova a secco di beat, BPM e reattivita' senza serata"
        >
          Prova a secco con un file…
        </button>
        <div className="u-hint">Oppure trascina qui un brano.</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = '' }}
        />
        </>
        )}

        {/* Input Gain — amplify weak mic signals */}
        {audioActive && (
          <div>
            <SliderRow
              label="Gain ingresso" suffix="x"
              value={inputGain} min={1} max={10} step={0.5}
              title="Amplifica i segnali deboli (es. microfono lontano)"
              onChange={handleInputGain}
            />
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
              title="Dimezza il BPM e passa a manuale — il rilevamento automatico si ferma"
             aria-label="Dimezza il BPM e passa a manuale">
              ×½
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => scaleBpm(2)}
              title="Raddoppia il BPM e passa a manuale — il rilevamento automatico si ferma"
             aria-label="Raddoppia il BPM e passa a manuale">
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

          {/* What the clock is actually doing — the mode is useless without it */}
          {bpmMode === 'midi' && (
            <div className="u-hint" style={{ marginBottom: '4px' }}>
              {clock.live
                ? 'MIDI clock agganciato — tempo e posizione nella battuta arrivano dal cavo'
                : clock.seen
                  ? 'Clock fermo — tengo l\'ultimo tempo ricevuto'
                  : 'Nessun clock ricevuto: attiva l\'invio del MIDI clock sul mixer o sul lettore'}
            </div>
          )}
          {bpmMode !== 'midi' && clock.seen && (
            <div className="u-hint" style={{ marginBottom: '4px' }}>
              Arriva un MIDI clock: con <strong>MIDI</strong> il tempo e' esatto invece che stimato.
            </div>
          )}

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
               aria-label="Diminuisci il BPM di 1">
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
               aria-label="Aumenta il BPM di 1">
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
    </Panel>
  )
}
