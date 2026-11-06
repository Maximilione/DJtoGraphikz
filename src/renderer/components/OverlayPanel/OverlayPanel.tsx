import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { Engine, OverlayItem, GifSyncMode } from '@engine/Engine'
import { SliderRow } from '../SliderRow/SliderRow'
import { pushToast } from '../Toasts/Toasts'
import { Panel } from '../Panel/Panel'
import { IMAGE_RE, MODEL_RE, imageMime } from '../../../shared/mediaFormats'
import { SEQ_DEFAULT_FPS, SEQ_BEAT_CHOICES } from '../../../shared/imageSequence'
import { useVisibleInterval } from '../useVisibleInterval'

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
  if (overlay._seq) return 'SEQ'
  return 'IMG'
}

export { IMAGE_RE }

const mimeFor = imageMime

/** A library file → the data URL the Engine's addOverlay wants */
export async function readLibraryImage(path: string, name: string): Promise<string> {
  const bytes = await window.api.readFile(path)
  const blob = new Blob([bytes], { type: mimeFor(name) })
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export interface LibraryItem { name: string; path: string }

/**
 * Library thumbnails come straight from disk over djg-media, the door the
 * video overlays and the sequences already stream through: no file crosses
 * IPC, no Blob or object URL in the renderer, and Chromium fetches and decodes
 * only the rows on screen (`loading="lazy"`), off the UI thread. Every row
 * used to read its whole file over IPC — tens of MB and a full GIF decode on
 * the live thread for a 40 px picture.
 * ponytail: a 114x64 thumbnail cached on disk by main (nativeImage) would make
 * this a few KB per row instead of the file.
 */
const thumbUrl = (path: string) => `djg-media://f/?p=${encodeURIComponent(path)}`

const sameList = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((x, i) => x === b[i])

function OverlayPanelImpl({ engine }: OverlayPanelProps) {
  const [overlays, setOverlays] = useState<OverlayItem[]>([])
  // When multiple cameras exist we show an inline picker instead of adding blindly
  // A big GIF or a long video takes seconds to decode: say so instead of
  // looking frozen. Same idiom as IsfBrowser — disable and swap the label.
  const [busy, setBusy] = useState<'img' | 'video' | 'seq' | null>(null)
  const [webcamChoices, setWebcamChoices] = useState<MediaDeviceInfo[] | null>(null)
  const [webcamError, setWebcamError] = useState<string | null>(null)
  const [library, setLibrary] = useState<LibraryItem[]>([])
  const [textValue, setTextValue] = useState('')
  const [textColor, setTextColor] = useState('#ffffff')

  const refresh = useCallback(() => {
    if (engine) setOverlays([...engine.getOverlays()])
  }, [engine])
  // The list used to start empty and change only after this panel's own
  // actions: overlays added by a preset, the phone or a playlist step before
  // the mount never showed. Synced at mount, then a light poll by identity —
  // the engine mutates the items in place, so unchanged lists cost no render.
  useEffect(() => { refresh() }, [refresh])
  useVisibleInterval(() => {
    if (!engine) return
    const cur = engine.getOverlays()
    setOverlays(p => (sameList(p, cur) ? p : [...cur]))
  }, engine ? 1000 : null)

  const loadLibrary = useCallback(async () => {
    try {
      setLibrary(await window.api?.libraryList() ?? [])
    } catch { /* library folder unreadable: just show nothing */ }
  }, [])

  // The library IS the persistence: nothing auto-loads at boot, re-adding is one tap
  useEffect(() => { loadLibrary() }, [loadLibrary])

  // The pickers reject too (dialog torn down, IPC gone): the await sits
  // inside the try, and the busy flag is cleared in a finally so a failure
  // never leaves the three buttons disabled.
  const importImage = useCallback(async () => {
    if (!engine) return
    setBusy('img')
    try {
      const assets = await window.api?.importAssets()
      if (!assets || assets.length === 0) return
      for (const asset of assets) {
        // a corrupt image rejects; without this the failure is a silent
        // unhandled rejection and the user sees nothing happen
        try {
          await engine.addOverlay(asset.name, asset.data)
          await window.api?.librarySave(asset.name, asset.data).catch(() => {})
        } catch (err) {
          console.error('[Overlay] import immagine fallito:', err)
          pushToast(`Non riesco a caricare ${asset.name}`, undefined, undefined, 'err')
        }
      }
    } catch (err) {
      console.error('[Overlay] import immagine fallito:', err)
      pushToast(`Import non riuscito: ${(err as Error).message}`, 'overlay-import', undefined, 'err')
    } finally {
      setBusy(null)
      refresh()
      loadLibrary()
    }
  }, [engine, refresh, loadLibrary])

  const importVideo = useCallback(async () => {
    if (!engine) return
    setBusy('video')
    try {
      const files = await window.api?.pickVideos()
      if (!files || files.length === 0) return
      for (const f of files) {
        // rejects if the file moved or the drive was unplugged since the pick
        try {
          await engine.addVideoOverlay(f.name, { kind: 'video', path: f.path })
          await window.api?.librarySaveCopy(f.name, f.path).catch(() => {})
        } catch (err) {
          console.error('[Overlay] import video fallito:', err)
          pushToast(`Non riesco a caricare ${f.name}`, undefined, undefined, 'err')
        }
      }
    } catch (err) {
      console.error('[Overlay] import video fallito:', err)
      pushToast(`Import non riuscito: ${(err as Error).message}`, 'overlay-import', undefined, 'err')
    } finally {
      setBusy(null)
      refresh()
      loadLibrary()
    }
  }, [engine, refresh, loadLibrary])

  const importSequence = useCallback(async () => {
    if (!engine) return
    setBusy('seq')
    try {
      const seq = await window.api?.pickSequence()
      if (!seq) return
      if (seq.note) pushToast(seq.note, undefined, undefined, seq.paths.length ? undefined : 'err')
      if (!seq.paths.length) return
      await engine.addSequenceOverlay(seq.name, { kind: 'sequence', paths: seq.paths, fps: SEQ_DEFAULT_FPS, beats: 0 })
    } catch (err) {
      console.error('[Overlay] import sequenza fallito:', err)
      pushToast(`Non riesco a caricare la sequenza: ${(err as Error).message}`, 'overlay-import', undefined, 'err')
    } finally {
      setBusy(null)
      refresh()
    }
  }, [engine, refresh])

  const addFromLibrary = useCallback(async (item: LibraryItem) => {
    if (!engine) return
    // busy: a big GIF decodes for seconds and a second click added a twin
    setBusy(IMAGE_RE.test(item.name) ? 'img' : 'video')
    try {
      if (IMAGE_RE.test(item.name)) {
        await engine.addOverlay(item.name, await readLibraryImage(item.path, item.name))
      } else if (MODEL_RE.test(item.name)) {
        // a 3D model is not an overlay: it becomes the `mesh` effect's model
        engine.setMeshModelFile({ name: item.name, path: item.path })
        engine.setEffect('mesh')
        pushToast(`Effetto Mesh: ${item.name}`, 'mesh-model')
      } else {
        await engine.addVideoOverlay(item.name, { kind: 'video', path: item.path })
      }
      refresh()
    } catch (err) {
      console.error('[Library] add failed:', err)
      pushToast(`Non riesco a caricare ${item.name}`, undefined, undefined, 'err')
    } finally {
      setBusy(null)
    }
  }, [engine, refresh])

  const deleteFromLibrary = useCallback(async (item: LibraryItem) => {
    // Removes from the library only — active overlays stay on screen.
    // U3.4 — undo: images/GIFs are small, capture the bytes BEFORE deleting
    // and re-save on Annulla. Videos can be huge: no undo, plain toast.
    // ponytail: video undo would mean buffering GB in RAM — re-import is one tap
    let dataUrl: string | null = null
    if (IMAGE_RE.test(item.name)) {
      try {
        dataUrl = await readLibraryImage(item.path, item.name)
      } catch { /* unreadable — fall through to delete without undo */ }
    }
    // The two cases are not the same thing and must not say the same thing:
    // an image can be put back, a video is gone from disk for good. The
    // confirmation is the row's own second tap (LibraryRow): window.confirm
    // froze this renderer, which feeds audio and state to the projectors.
    try {
      await window.api?.libraryDelete(item.name)
    } catch (err) {
      pushToast(`Non riesco a cancellare ${item.name}: ${(err as Error).message}`, `lib-del-${item.name}`, undefined, 'err')
      return
    }
    loadLibrary()
    if (dataUrl) {
      const saved = dataUrl
      pushToast(`"${item.name}" rimosso dalla libreria`, `lib-del-${item.name}`, {
        label: 'Annulla',
        fn: async () => {
          await window.api?.librarySave(item.name, saved).catch(() => {})
          loadLibrary()
        },
      })
    } else {
      pushToast(`"${item.name}" cancellato dal disco`, `lib-del-${item.name}`, undefined, 'err')
    }
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

  const updateOverlay = useCallback((id: string, updates: Partial<Pick<OverlayItem, 'opacity' | 'scale' | 'offsetX' | 'offsetY' | 'visible' | 'gifSync' | 'displace' | 'seqFps' | 'seqBeats'>>) => {
    if (!engine) return
    engine.updateOverlay(id, updates)
    refresh()
  }, [engine, refresh])

  return (
    <Panel id="media" title="Media" defaultCollapsed group="right">
      <div className="u-col">
        <div className="media-add">
          <button onClick={importImage} disabled={busy !== null} title="Importa un'immagine o una GIF come overlay">
            {busy === 'img' ? 'Carico…' : '🖼 Immagine/GIF'}
          </button>
          <button onClick={importVideo} disabled={busy !== null} title="Importa un video come overlay">
            {busy === 'video' ? 'Carico…' : '🎬 Video'}
          </button>
          <button onClick={importSequence} disabled={busy !== null} title="Importa una cartella di frame numerati (PNG/JPG/WebP/AVIF, con alpha) come overlay animato">
            {busy === 'seq' ? 'Carico…' : '🎞 Sequenza'}
          </button>
          <button onClick={onWebcamClick} title="Aggiungi la webcam come overlay">📷 Webcam</button>
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
            <button className="btn btn-ghost btn-sm" onClick={() => setWebcamChoices(null)}>
              Annulla
            </button>
          </div>
        )}

        {webcamError && <div className="media-error">{webcamError}</div>}

        <div className="media-text-row">
          <input
            type="text"
            placeholder="Testo overlay…"
            title="Testo da mostrare sopra i visual (Invio per aggiungere)"
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { addText(); e.currentTarget.blur() } }}   /* the hotkeys come back after Invio */
          />
          <input
            type="color"
            value={textColor}
            onChange={e => setTextColor(e.target.value)}
            title="Colore testo"
          />
          <button onClick={addText} disabled={!textValue.trim()} title="Aggiungi il testo come overlay">Aggiungi</button>
        </div>

        {library.length > 0 && (
          <div className="media-library">
            <div className="label">Libreria</div>
            {library.map(item => (
              <LibraryRow
                key={item.path}
                item={item}
                disabled={busy !== null}
                onAdd={() => addFromLibrary(item)}
                onDelete={() => deleteFromLibrary(item)}
              />
            ))}
          </div>
        )}

        {overlays.length === 0 && (
          <div className="media-empty">
            {library.length ? 'Nessun media in onda. Tocca un file della Libreria.' : "Nessun media. Aggiungi un'immagine, un video o la webcam."}
          </div>
        )}

        {overlays.map(overlay => (
          <div key={overlay.id} className="media-card">
            <div className="media-card-header">
              <button type="button" aria-pressed={overlay.visible}
                className={`btn media-toggle${overlay.visible ? ' on' : ''}`}
                onClick={() => updateOverlay(overlay.id, { visible: !overlay.visible })}
                title={overlay.visible ? 'Nascondi' : 'Mostra'}
              />
              <span className="media-name">{overlay.name}</span>
              <span className="media-badge">{mediaBadge(overlay)}</span>
              <button
                className="btn btn-ghost btn-sm danger"
                onClick={() => removeOverlay(overlay.id)}
                title="Rimuovi media"
               aria-label="Rimuovi media">
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
                      title={mode.id === 'beat' ? 'GIF avanza sul beat' : mode.id === 'bpm' ? 'GIF sincronizzata al BPM' : 'GIF a velocità propria'}
                      onClick={() => updateOverlay(overlay.id, { gifSync: mode.id })}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {overlay._seq && (
              <>
                <SliderRow
                  label={`FPS (${overlay._seq.count} frame)`}
                  value={overlay.seqFps ?? SEQ_DEFAULT_FPS}
                  min={1} max={120} step={1}
                  onChange={v => updateOverlay(overlay.id, { seqFps: v })}
                />
                <div>
                  <div className="label">Loop</div>
                  <select
                    value={overlay.seqBeats ?? 0}
                    title="Durata di un giro della sequenza: libera (a FPS) o agganciata al beat"
                    onChange={e => updateOverlay(overlay.id, { seqBeats: parseInt(e.target.value, 10) })}
                  >
                    {SEQ_BEAT_CHOICES.map(n => <option key={n} value={n}>{n === 0 ? 'libero (FPS)' : `${n} ${n === 1 ? 'battuta' : 'battute'}`}</option>)}
                  </select>
                </div>
              </>
            )}

            <SliderRow
              label="Opacità"
              value={overlay.opacity}
              min={0} max={1} step={0.05}
              onChange={v => updateOverlay(overlay.id, { opacity: v })}
            />

            <SliderRow
              label="Scala"
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
              label="Displace" labelTitle="L'overlay deforma i visual invece di coprirli"
              value={overlay.displace}
              min={0} max={0.5} step={0.01}
              onChange={v => updateOverlay(overlay.id, { displace: v })}
            />
          </div>
        ))}
      </div>
    </Panel>
  )
}

/** One saved asset: click = add as overlay, ✕ = delete from disk. */
function LibraryRow({ item, disabled, onAdd, onDelete }: {
  item: LibraryItem
  disabled?: boolean
  onAdd: () => void
  onDelete: () => void
}) {
  const isImage = IMAGE_RE.test(item.name)
  const isModel = MODEL_RE.test(item.name)
  // a file that will not decode (moved, corrupt) shows the icon, not a broken image
  const [broken, setBroken] = useState(false)
  // A deletion with no undo (video, model, unreadable image) asks with a
  // second tap on the same button, armed for 3 s; a double click does not count.
  const [armed, setArmed] = useState(0)
  const armTimer = useRef(0)
  useEffect(() => () => clearTimeout(armTimer.current), [])
  const needsArm = !isImage || broken
  const del = () => {
    if (!needsArm) { onDelete(); return }
    const now = performance.now()
    if (armed) {
      if (now - armed < 400) return
      clearTimeout(armTimer.current); setArmed(0); onDelete(); return
    }
    setArmed(now)
    armTimer.current = window.setTimeout(() => setArmed(0), 3000)
  }

  return (
    <div className="media-lib-row">
      <button type="button" className="btn media-lib-item" onClick={onAdd} disabled={disabled}
        title={isModel ? "Usa come modello dell'effetto Mesh (cambia l'effetto in onda)" : 'Aggiungi come overlay'}>
        {isImage && !broken
          ? <img className="media-lib-thumb" src={thumbUrl(item.path)} loading="lazy" decoding="async" alt="" onError={() => setBroken(true)} />
          : <span className="media-lib-icon">{isImage ? '🖼' : isModel ? '🧊' : '🎬'}</span>}
        <span className="media-lib-name">{item.name}</span>
        <span className="media-badge">{isImage ? (/\.gif$/i.test(item.name) ? 'GIF' : 'IMG') : isModel ? '3D' : 'VIDEO'}</span>
      </button>
      <button className={`btn btn-ghost btn-sm danger${armed ? ' active' : ''}`} onClick={del}
        title={armed ? 'Tocca ancora: cancella dal disco, senza annulla' : 'Cancella dalla libreria'} aria-label="Cancella dalla libreria">
        {armed ? 'Sicuro?' : '✕'}
      </button>
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
  }, [video])
  // ponytail: 2fps preview is plenty for a 64px thumbnail; paused while the window is hidden
  useVisibleInterval(() => {
    const canvas = canvasRef.current
    if (!canvas || video.readyState < 2) return
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
  }, 500)

  return <canvas ref={canvasRef} className="media-thumb" width={114} height={64} />
}

/** Memoised: App re-renders on every slider tick and remote command; this panel only depends on the engine. */
export const OverlayPanel = React.memo(OverlayPanelImpl)
