import React, { useEffect, useRef } from 'react'
import type { Engine } from '@engine/Engine'
import { pushToast } from '../Toasts/Toasts'
import { Panel } from '../Panel/Panel'
import { DEFAULT_KEYSTONE, keystoneActive, type OutputCfg } from '../../outputs'

interface MappingPanelProps {
  engine: Engine | null
  /** the corners live with the outputs: one quad per wall */
  outputs: OutputCfg[]
  onChange: (list: OutputCfg[]) => void
  /** which output is being aligned — App previews that one in the control window */
  selected: number
  onSelect: (i: number) => void
}

const LABELS = ['TL', 'TR', 'BR', 'BL']
const W = 240
const H = 135

/**
 * Projection mapping (keystone / quad-warp): drag the 4 corners so the image
 * fits a skewed projector. One quad per output: the corners are part of the
 * OutputCfg and reach the window with its slice, not with the show snapshot.
 */
export function MappingPanel({ engine, outputs, onChange, selected, onSelect }: MappingPanelProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<number>(-1)
  /** ends the drag in progress: the listeners on window must not outlive the panel */
  const cleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => cleanupRef.current?.(), [])
  const sel = Math.min(selected, outputs.length - 1)
  const corners = outputs[sel]?.keystone ?? DEFAULT_KEYSTONE

  const apply = (next: number[]) =>
    onChange(outputs.map((o, i) => (i === sel ? { ...o, keystone: next } : o)))

  const onPointerDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    cleanupRef.current?.()
    dragRef.current = i
    // pointermove arrives at 120-240 Hz on a good mouse; one apply a frame is
    // all the preview can show, and each apply is a render of App
    let pendingMove: PointerEvent | null = null
    let raf = 0
    const flush = () => {
      raf = 0
      const ev = pendingMove
      pendingMove = null
      const box = svgRef.current?.getBoundingClientRect()
      if (!ev || !box || dragRef.current < 0) return
      // margin lets corners go slightly outside for pincushion correction
      const x = (ev.clientX - box.left) / box.width * 1.5 - 0.25
      const y = (ev.clientY - box.top) / box.height * 1.5 - 0.25
      const next = [...corners]
      next[dragRef.current * 2] = Math.max(-0.25, Math.min(1.25, x))
      next[dragRef.current * 2 + 1] = Math.max(-0.25, Math.min(1.25, y))
      apply(next)
    }
    const move = (ev: PointerEvent) => {
      pendingMove = ev
      if (!raf) raf = requestAnimationFrame(flush)
    }
    const up = () => {
      dragRef.current = -1
      cancelAnimationFrame(raf)
      pendingMove = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      // pointercancel (touch, pen, lost capture) used to leave the drag armed
      window.removeEventListener('pointercancel', up)
      cleanupRef.current = null
    }
    cleanupRef.current = up
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  if (!engine) return null

  // panel coords: map the -0.25..1.25 draggable space onto the svg box
  const px = (v: number) => (v + 0.25) / 1.5 * W
  const py = (v: number) => (v + 0.25) / 1.5 * H
  const pts = [0, 1, 2, 3].map(i => [px(corners[i * 2]), py(corners[i * 2 + 1])] as const)
  const active = keystoneActive(corners)
  const anyActive = outputs.some(o => keystoneActive(o.keystone))

  return (
    <Panel id="mapping" title="Mapping" defaultCollapsed group="right" active={anyActive}>
      <div className="u-col" style={{ gap: 8 }}>
        <div className="u-hint">
          Trascina gli angoli per adattare l'immagine a un proiettore storto (keystone/quad-warp).
        </div>
        {outputs.length > 1 && (
          <div className="slider-row">
            <span className="label">Uscita</span>
            <select value={sel} style={{ flex: 1 }} onChange={e => onSelect(+e.target.value)}>
              {outputs.map((o, i) => (
                <option key={i} value={i}>
                  {i === 0 ? 'Proiettore' : `Uscita ${i + 1}`}{keystoneActive(o.keystone) ? ' •' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          style={{ background: 'var(--bg0)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', touchAction: 'none' }}
        >
          {/* reference frame = full output */}
          <rect x={px(0)} y={py(0)} width={px(1) - px(0)} height={py(1) - py(0)}
            fill="none" stroke="var(--border)" strokeDasharray="4 3" />
          {/* warped quad */}
          <polygon
            points={pts.map(p => p.join(',')).join(' ')}
            fill="rgba(0,255,136,0.08)"
            stroke="var(--accent)"
            strokeWidth="1.5"
          />
          {pts.map((p, i) => (
            <g key={i} onPointerDown={onPointerDown(i)} style={{ cursor: 'grab' }}>
              <circle cx={p[0]} cy={p[1]} r="9" fill="transparent" />
              <circle cx={p[0]} cy={p[1]} r="5" fill="var(--bg2)" stroke="var(--accent)" strokeWidth="1.5" />
              <text x={p[0]} y={p[1] - 9} textAnchor="middle" fontSize="8" fill="var(--text-muted)">{LABELS[i]}</text>
            </g>
          ))}
        </svg>
        <button
          className="btn"
          disabled={!active}
          onClick={() => {
            const prev = [...corners]
            apply([...DEFAULT_KEYSTONE])
            pushToast('Mapping azzerato', 'mapping-reset', { label: 'Annulla', fn: () => apply(prev) })
          }}
        >
          Azzera mapping
        </button>
      </div>
    </Panel>
  )
}
