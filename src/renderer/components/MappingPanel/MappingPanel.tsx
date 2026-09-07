import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Engine } from '@engine/Engine'
import { usePanelCollapsed } from '../usePanelCollapsed'
import { pushToast } from '../Toasts/Toasts'

interface MappingPanelProps {
  engine: Engine | null
}

const DEFAULT = [0, 0, 1, 0, 1, 1, 0, 1]
const LABELS = ['TL', 'TR', 'BR', 'BL']
const W = 240
const H = 135

/**
 * Projection mapping (keystone / quad-warp): drag the 4 corners so the image
 * fits a skewed projector. State lives in the engine and rides the snapshot.
 */
export function MappingPanel({ engine }: MappingPanelProps) {
  const [collapsed, toggleCollapsed] = usePanelCollapsed('mapping', true, 'right')
  const [corners, setCorners] = useState<number[]>(() => engine?.getKeystone() ?? [...DEFAULT])
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<number>(-1)

  useEffect(() => {
    if (!engine) return
    setCorners(engine.getKeystone())
    return engine.onState(() => {
      if (dragRef.current < 0) setCorners(engine.getKeystone())
    })
  }, [engine])

  const apply = useCallback((next: number[]) => {
    setCorners(next)
    engine?.setKeystone(next)
  }, [engine])

  const onPointerDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    dragRef.current = i
    const move = (ev: PointerEvent) => {
      const box = svgRef.current?.getBoundingClientRect()
      if (!box || dragRef.current < 0) return
      // margin lets corners go slightly outside for pincushion correction
      const x = (ev.clientX - box.left) / box.width * 1.5 - 0.25
      const y = (ev.clientY - box.top) / box.height * 1.5 - 0.25
      const next = [...corners]
      next[dragRef.current * 2] = Math.max(-0.25, Math.min(1.25, x))
      next[dragRef.current * 2 + 1] = Math.max(-0.25, Math.min(1.25, y))
      apply(next)
    }
    const up = () => {
      dragRef.current = -1
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  if (!engine) return null

  // panel coords: map the -0.25..1.25 draggable space onto the svg box
  const px = (v: number) => (v + 0.25) / 1.5 * W
  const py = (v: number) => (v + 0.25) / 1.5 * H
  const pts = [0, 1, 2, 3].map(i => [px(corners[i * 2]), py(corners[i * 2 + 1])] as const)
  const active = corners.some((v, i) => Math.abs(v - DEFAULT[i]) > 0.0005)

  return (
    <div className="panel">
      <div
        className="panel-header"
        onClick={toggleCollapsed}
        title={collapsed ? 'Espandi Mapping' : 'Comprimi Mapping'}
      >
        <span>Mapping{active ? ' ●' : ''}</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div className="u-col" style={{ gap: 8 }}>
          <div className="u-hint">
            Trascina gli angoli per adattare l'immagine a un proiettore storto (keystone/quad-warp).
          </div>
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
              apply([...DEFAULT])
              pushToast('Mapping azzerato', 'mapping-reset', { label: 'Annulla', fn: () => apply(prev) })
            }}
          >
            Azzera mapping
          </button>
        </div>
      )}
    </div>
  )
}
