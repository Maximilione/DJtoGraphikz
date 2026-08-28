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
  if (overlay.source?.kind === 'text') return 'TXT'
  if (overlay._isVideo) return 'VIDEO'
  return 'IMG'
}

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)$/i

function mimeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || 'png'
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'jpg') return 'image/jpeg'
  return `image/${ext}`
}

interface LibraryItem { name: string; path: string }

export function OverlayPanel({ engine }: OverlayPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [overlays, setOverlays] = useState<OverlayItem[]>([])
  // When multiple cameras exist we show an inline picker instead of adding blindly
  const [webcamChoices, setWebcamChoices] = useState<MediaDeviceInfo[] | null>(null)
  const [webcamError, setWebcamError] = useState<string | null>(null)
  const [library, setLibrary] = useState<LibraryItem[]>([])
  const [textValue, setTextValue] = useState('')
  const [textColor, setTextColor] = useState('#ffffff')

  const refresh = useCallback(() => {
    if (engine) setOverlays([...engine.getOverlays()])
  }, [engine])

  const loadLibrary = useCallback(async () => {
    try {
      setLibrary(await window.api?.libraryList() ?? [])
    } catch { /* library folder unreadable: just show nothing */ }
  }, [])

  // The library IS the persistence: nothing auto-loads at boot, re-adding is one tap
  useEffect(() => { loadLibrary() }, [loadLibrary])

  const importImage = useCallback(async () => {
    if (!engine) return
    const assets = await window.api?.importAssets()
    if (!assets || assets.length === 0) return
    for (const asset of assets) {
      await engine.addOverlay(asset.name, asset.data)
      await window.api?.librarySave(asset.name, asset.data).catch(() => {})
    }
    refresh()
    loadLibrary()
  }, [engine, refresh, loadLibrary])

  const importVideo = useCallback(async () => {
    if (!engine) return
    const files = await window.api?.pickVideos()
    if (!files || files.length === 0) return
    for (const f of files) {
      await engine.addVideoOverlay(f.name, { kind: 'video', path: f.path })
      await window.api?.librarySaveCopy(f.name, f.path).catch(() => {})
    }
    refresh()
    loadLibrary()
  }, [engine, refresh, loadLibrary])

  const addFromLibrary = useCallback(async (item: LibraryItem) => {
    if (!engine) return
    try {
      if (IMAGE_RE.test(item.name)) {
        const bytes = await window.api.readFile(item.path)
        const blob = new Blob([bytes], { type: mimeFor(item.name) })
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob)
        })
        await engine.addOverlay(item.name, dataUrl)
      } else {
        await engine.addVideoOverlay(item.name, { kind: 'video', path: item.path })
      }
      refresh()
    } catch (err) {
      console.error('[Library] add failed:', err)
    }
  }, [engine, refresh])

  const deleteFromLibrary = useCallback(async (name: string) => {
    // Removes from the library only — active overlays stay on screen
    await window.api?.libraryDelete(name).catch(() => {})
    loadLibrary()
  }, [loadLibrary])

  const addText = useCallback(() => {
    if (!engine) return
    const text = textValue.trim()
    if (!text) return
    engine.addTextOverlay(text, { color: textColor })
    setTextValue('')
    refresh()
  }, [engine, textValue, textColor, refresh])

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

          <div className="media-text-row">
            <input
              type="text"
              placeholder="Testo overlay…"
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addText() }}
            />
            <input
              type="color"
              value={textColor}
              onChange={e => setTextColor(e.target.value)}
              title="Colore testo"
            />
            <button onClick={addText} disabled={!textValue.trim()}>Aggiungi</button>
          </div>

          {library.length > 0 && (
            <div className="media-library">
              <div className="label">Libreria</div>
              {library.map(item => (
                <LibraryRow
                  key={item.path}
                  item={item}
                  onAdd={() => addFromLibrary(item)}
                  onDelete={() => deleteFromLibrary(item.name)}
                />
              ))}
            </div>
          )}

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

/** One saved asset: click = add as overlay, ✕ = delete from disk. */
function LibraryRow({ item, onAdd, onDelete }: {
  item: LibraryItem
  onAdd: () => void
  onDelete: () => void
}) {
  const isImage = IMAGE_RE.test(item.name)
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    if (!isImage) return
    let alive = true
    let url: string | null = null
    window.api?.readFile(item.path).then(bytes => {
      if (!alive) return
      url = URL.createObjectURL(new Blob([bytes], { type: mimeFor(item.name) }))
      setThumb(url)
    }).catch(() => {})
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [item.path, item.name, isImage])

  return (
    <div className="media-lib-row">
      <div className="media-lib-item" onClick={onAdd} title="Aggiungi come overlay">
        {isImage
          ? (thumb ? <img className="media-lib-thumb" src={thumb} /> : <span className="media-lib-icon">🖼</span>)
          : <span className="media-lib-icon">🎬</span>}
        <span className="media-lib-name">{item.name}</span>
        <span className="media-badge">{isImage ? (/\.gif$/i.test(item.name) ? 'GIF' : 'IMG') : 'VIDEO'}</span>
      </div>
      <button className="media-remove" onClick={onDelete} title="Rimuovi dalla libreria">✕</button>
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
