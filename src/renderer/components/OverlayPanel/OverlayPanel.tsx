import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { Engine, OverlayItem, GifSyncMode } from '@engine/Engine'
import { NumberInput } from '../NumberInput/NumberInput'

interface OverlayPanelProps {
  engine: Engine | null
}

const SYNC_MODES: { id: GifSyncMode; label: string }[] = [
  { id: 'beat', label: 'Beat' },
  { id: 'bpm', label: 'BPM' },
  { id: 'free', label: 'Free' },
]

function mediaBadge(overlay: OverlayItem): string {
  if (overlay._isGif) return 'GIF'
  if (overlay.source?.kind === 'webcam') return 'WEBCAM'
  if (overlay._isVideo) return 'VIDEO'
  return 'IMG'
}

export function OverlayPanel({ engine }: OverlayPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [overlays, setOverlays] = useState<OverlayItem[]>([])
  // When multiple cameras exist we show an inline picker instead of adding blindly
  const [webcamChoices, setWebcamChoices] = useState<MediaDeviceInfo[] | null>(null)
  const [webcamError, setWebcamError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (engine) setOverlays([...engine.getOverlays()])
  }, [engine])

  const importImage = useCallback(async () => {
    if (!engine) return
    const assets = await window.api?.importAssets()
    if (!assets || assets.length === 0) return
    for (const asset of assets) {
      await engine.addOverlay(asset.name, asset.data)
    }
    refresh()
  }, [engine, refresh])

  const importVideo = useCallback(async () => {
    if (!engine) return
    const files = await window.api?.pickVideos()
    if (!files || files.length === 0) return
    for (const f of files) {
      await engine.addVideoOverlay(f.name, { kind: 'video', path: f.path })
    }
    refresh()
  }, [engine, refresh])

  const addWebcamDevice = useCallback(async (deviceId?: string, label?: string) => {
    if (!engine) return
    setWebcamChoices(null)
    setWebcamError(null)
    try {
      await engine.addVideoOverlay(label || 'Webcam', { kind: 'webcam', deviceId })
      refresh()
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      setWebcamError(
        name === 'NotAllowedError'
          ? 'Permesso webcam negato. Controlla le impostazioni di sistema.'
          : 'Webcam non disponibile o già in uso.'
      )
    }
  }, [engine, refresh])

  const onWebcamClick = useCallback(async () => {
    setWebcamError(null)
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cams = devices.filter(d => d.kind === 'videoinput')
      if (cams.length > 1) {
        setWebcamChoices(cams)
      } else {
        // 0 or 1 device: let getUserMedia pick the default (and surface its error)
        await addWebcamDevice()
      }
    } catch {
      setWebcamError('Impossibile elencare le webcam.')
    }
  }, [addWebcamDevice])

  const removeOverlay = useCallback((id: string) => {
    if (!engine) return
    engine.removeOverlay(id)
    refresh()
  }, [engine, refresh])

  const updateOverlay = useCallback((id: string, updates: Partial<Pick<OverlayItem, 'opacity' | 'scale' | 'offsetX' | 'offsetY' | 'visible' | 'gifSync' | 'displace'>>) => {
    if (!engine) return
    engine.updateOverlay(id, updates)
    refresh()
  }, [engine, refresh])

  return (
    <div className="panel">
      <div className="panel-header" onClick={() => setCollapsed(!collapsed)}>
        <span>Media</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="media-add">
            <button onClick={importImage}>🖼 Immagine/GIF</button>
            <button onClick={importVideo}>🎬 Video</button>
            <button onClick={onWebcamClick}>📷 Webcam</button>
          </div>

          {webcamChoices && (
            <div className="media-device-pick">
              <div className="label">Scegli la webcam</div>
              {webcamChoices.map((cam, i) => (
                <button
                  key={cam.deviceId || i}
                  onClick={() => addWebcamDevice(cam.deviceId || undefined, cam.label || undefined)}
                >
                  {cam.label || `Camera ${i + 1}`}
                </button>
              ))}
              <button className="media-device-cancel" onClick={() => setWebcamChoices(null)}>
                Annulla
              </button>
            </div>
          )}

          {webcamError && <div className="media-error">{webcamError}</div>}

          {overlays.length === 0 && (
            <div className="media-empty">
              Nessun media. Aggiungi un'immagine, un video o la webcam.
            </div>
          )}

          {overlays.map(overlay => (
            <div key={overlay.id} className="media-card">
              <div className="media-card-header">
                <div
                  className={`media-toggle${overlay.visible ? ' on' : ''}`}
                  onClick={() => updateOverlay(overlay.id, { visible: !overlay.visible })}
                  title={overlay.visible ? 'Nascondi' : 'Mostra'}
                />
                <span className="media-name">{overlay.name}</span>
                <span className="media-badge">{mediaBadge(overlay)}</span>
                <button
                  className="media-remove"
                  onClick={() => removeOverlay(overlay.id)}
                  title="Rimuovi media"
                >
                  x
                </button>
              </div>

              {overlay.dataUrl ? (
                <img className="media-thumb" src={overlay.dataUrl} />
              ) : overlay._video ? (
                <VideoThumb video={overlay._video} />
              ) : null}

              {/* GIF Sync Mode — only for GIFs */}
              {overlay._isGif && (
                <div>
                  <div className="label">GIF Sync</div>
                  <div className="media-seg">
                    {SYNC_MODES.map(mode => (
                      <button
                        key={mode.id}
                        className={overlay.gifSync === mode.id ? 'active' : ''}
                        onClick={() => updateOverlay(overlay.id, { gifSync: mode.id })}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <SliderRow
                label="Opacity"
                value={overlay.opacity}
                min={0} max={1} step={0.05}
                onChange={v => updateOverlay(overlay.id, { opacity: v })}
              />

              <SliderRow
                label="Scale"
                value={overlay.scale}
                min={0.05} max={2} step={0.05}
                onChange={v => updateOverlay(overlay.id, { scale: v })}
              />

              <SliderRow
                label="Offset X"
                value={overlay.offsetX}
                min={-0.5} max={0.5} step={0.01}
                onChange={v => updateOverlay(overlay.id, { offsetX: v })}
              />

              <SliderRow
                label="Offset Y"
                value={overlay.offsetY}
                min={-0.5} max={0.5} step={0.01}
                onChange={v => updateOverlay(overlay.id, { offsetY: v })}
              />

              {/* Displacement: the overlay warps the visuals instead of covering them */}
              <SliderRow
                label="Displace"
                value={overlay.displace}
                min={0} max={0.5} step={0.01}
                onChange={v => updateOverlay(overlay.id, { displace: v })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Live thumbnail for video/webcam overlays, redrawn at ~2fps. */
function VideoThumb({ video }: { video: HTMLVideoElement }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      // readyState < 2: no frame decoded yet, drawImage would throw/blank
      if (!canvas || video.readyState < 2) return
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    }
    draw()
    // ponytail: 2fps preview is plenty for a 64px thumbnail
    const id = setInterval(draw, 500)
    return () => clearInterval(id)
  }, [video])

  return <canvas ref={canvasRef} className="media-thumb" width={114} height={64} />
}

function SliderRow({ label, value, min, max, step, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="media-slider-row">
      <span>{label}</span>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      <NumberInput
        value={value}
        min={min} max={max} step={step}
        onChange={onChange}
      />
    </div>
  )
}
