import { useCallback, useEffect, useState } from 'react'
import type { Engine, CameraState } from '@engine/Engine'
import { CAMERA_NEUTRAL } from '@engine/Engine'
import { LINE_BOOST_DEFAULT } from '@engine/lineBoost'
import { PRESENCE_DEFAULT } from '@engine/presence'
import { IMPACT_DEFAULT, type ImpactState } from '@engine/impact'
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
  const [lb, setLb] = useState(LINE_BOOST_DEFAULT)
  const [pres, setPres] = useState(PRESENCE_DEFAULT)

  // The camera moves from the phone, OSC and MIDI too, so the panel follows
  // the engine rather than owning the value.
  useEffect(() => {
    if (!engine) return
    const sync = () => { setCam(engine.getCamera()); setLb(engine.getLineBoost()); setPres(engine.getPresence()) }
    sync()
    return engine.onState(sync)
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
        <SliderRow
          label="Spessore linee" value={lb} min={0} max={1} step={0.05}
          title="Spessore e luminosita' delle linee in tutti gli effetti con tratti, contorni e righe. Alza per proiettore, fumo e luci di sala: le linee restano leggibili a distanza"
          onChange={v => { engine.setLineBoost(v); setLb(v) }}
        />
        <SliderRow
          label="Presenza" value={pres} min={0} max={1} step={0.05}
          title="Presenza proiettore: alza i neri perche' i dettagli scuri emergano nel fumo e con le luci di sala accese, colori un po' piu' vivi, bagliore morbido sulle alte luci, mai bianco pieno. A zero l'immagine e' invariata"
          onChange={v => { engine.setPresence(v); setPres(v) }}
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

/** Audio impact: shake, punch-zoom, soft flash, per-band response, energy chaser. Same pass as the camera. */
export function ImpactPanel({ engine }: CameraPanelProps) {
  const [im, setIm] = useState<ImpactState>(IMPACT_DEFAULT)
  useEffect(() => {
    if (!engine) return
    setIm(engine.getImpact())
    return engine.onState(() => setIm(engine.getImpact()))
  }, [engine])
  const set = useCallback((patch: Partial<ImpactState>) => {
    engine?.setImpact(patch)
    setIm(c => ({ ...c, ...patch }))
  }, [engine])
  if (!engine) return null
  return (
    <Panel id="impact" title="Impatto" defaultCollapsed group="right" active={im.on}>
      <div className="u-col" style={{ gap: 'var(--s2)' }}>
        <div className="u-hint">
          Reattivita' globale sul suono, su tutti gli effetti: cassa = shake e zoom a molla, medi = distorsione, alti = scintillio, drop = flash morbido.
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={im.on} onChange={e => set({ on: e.target.checked })} />
          <span className="label">Attivo</span>
        </label>
        <SliderRow label="Intensita'" value={im.intensity} min={0} max={1} step={0.05}
          title="Quanto reagisce tutto, 0 = fermo" onChange={v => set({ intensity: v })} />
        <SliderRow label="Shake" value={im.shake} min={0} max={1} step={0.05}
          title="Tremolio dell'inquadratura sulla cassa (mai oltre pochi %)" onChange={v => set({ shake: v })} />
        <SliderRow label="Punch" value={im.punch} min={0} max={1} step={0.05}
          title="Zoom a tempo sul beat, con ritorno elastico" onChange={v => set({ punch: v })} />
        <SliderRow label="Flash" value={im.flash} min={0} max={1} step={0.05}
          title="Lampo morbido sui colpi alti e sul drop (mai bianco pieno)" onChange={v => set({ flash: v })} />
        <SliderRow label="Distorsione" value={im.warp} min={0} max={1} step={0.05}
          title="Ondulazione guidata dai medi" onChange={v => set({ warp: v })} />
        <SliderRow label="Scintillio" value={im.spark} min={0} max={1} step={0.05}
          title="Chromatic e glitter guidati dagli alti" onChange={v => set({ spark: v })} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
          title="Lenta: smorza nei break, sale su build e picco, seguendo la fase dell'Auto VJ">
          <input type="checkbox" checked={im.follow} onChange={e => set({ follow: e.target.checked })} />
          <span className="label">Segui l'energia</span>
        </label>
      </div>
    </Panel>
  )
}
