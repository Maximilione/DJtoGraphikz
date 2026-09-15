import { useCallback, useEffect, useState } from 'react'
import type { Engine, CameraState } from '@engine/Engine'
import { CAMERA_NEUTRAL } from '@engine/Engine'
import { Panel } from '../Panel/Panel'
import { SliderRow } from '../SliderRow/SliderRow'

interface CameraPanelProps {
  engine: Engine | null
}

/**
 * The master camera.
 *
 * It sits in front of the post chain and resamples whatever the effect drew,
 * so these six controls act on all 46 built-in effects and on every imported
 * ISF at once. Nothing downstream of it — and nothing upstream — knows it is
 * there, which is exactly why it is worth more than a control on any single
 * effect.
 */
export function CameraPanel({ engine }: CameraPanelProps) {
  const [cam, setCam] = useState<CameraState>(CAMERA_NEUTRAL)

  // The camera moves from the phone, OSC and MIDI too, so the panel follows
  // the engine rather than owning the value.
  useEffect(() => {
    if (!engine) return
    setCam(engine.getCamera())
    return engine.onState(() => setCam(engine.getCamera()))
  }, [engine])

  const set = useCallback((patch: Partial<CameraState>) => {
    engine?.setCamera(patch)
    setCam(c => ({ ...c, ...patch }))
  }, [engine])

  if (!engine) return null
  const moved = JSON.stringify(cam) !== JSON.stringify(CAMERA_NEUTRAL)

  return (
    <Panel id="camera" title="Camera" defaultCollapsed group="right" active={moved}>
      <div className="u-col" style={{ gap: 'var(--s2)' }}>
        <div className="u-hint">
          Inquadratura di tutta la scena, prima dei post-FX: vale per ogni effetto insieme.
        </div>
        <SliderRow
          label="Zoom" value={cam.zoom} min={0.2} max={4} step={0.05}
          title="Avvicina o allontana tutta la scena"
          onChange={v => set({ zoom: v })}
        />
        <SliderRow
          label="Rotazione" value={cam.rotation} min={-180} max={180} step={1} suffix="°"
          title="Ruota tutta la scena"
          onChange={v => set({ rotation: v })}
        />
        <SliderRow
          label="Pan X" value={cam.panX} min={-1} max={1} step={0.01}
          title="Sposta l'inquadratura in orizzontale"
          onChange={v => set({ panX: v })}
        />
        <SliderRow
          label="Pan Y" value={cam.panY} min={-1} max={1} step={0.01}
          title="Sposta l'inquadratura in verticale"
          onChange={v => set({ panY: v })}
        />
        <SliderRow
          label="Mosaico" value={cam.tile} min={1} max={8} step={1}
          title="Ripete la scena a specchio: 1 la lascia intera"
          onChange={v => set({ tile: v })}
        />
        <SliderRow
          label="Spinta" value={cam.push} min={0} max={1} step={0.05}
          title="Quanto la cassa spinge dentro l'inquadratura — a zero la camera sta ferma"
          onChange={v => set({ push: v })}
        />
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => engine.resetCamera()}
          disabled={!moved}
          title="Riporta l'inquadratura al centro, senza zoom né rotazione"
        >
          Azzera inquadratura
        </button>
      </div>
    </Panel>
  )
}
