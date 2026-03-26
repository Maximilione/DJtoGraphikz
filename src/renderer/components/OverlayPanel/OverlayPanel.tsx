import React, { useState, useCallback } from 'react'
import type { Engine, OverlayItem, GifSyncMode } from '@engine/Engine'

interface OverlayPanelProps {
  engine: Engine | null
}

const SYNC_MODES: { id: GifSyncMode; label: string }[] = [
  { id: 'beat', label: 'Beat' },
  { id: 'bpm', label: 'BPM' },
  { id: 'free', label: 'Free' },
]

export function OverlayPanel({ engine }: OverlayPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [overlays, setOverlays] = useState<OverlayItem[]>([])

  const importOverlay = useCallback(async () => {
    if (!engine) return
    const assets = await window.api?.importAssets()
    if (!assets || assets.length === 0) return

    for (const asset of assets) {
      await engine.addOverlay(asset.name, asset.data)
    }
    setOverlays([...engine.getOverlays()])
  }, [engine])

  const removeOverlay = useCallback((id: string) => {
    if (!engine) return
    engine.removeOverlay(id)
    setOverlays([...engine.getOverlays()])
  }, [engine])

  const updateOverlay = useCallback((id: string, updates: Partial<Pick<OverlayItem, 'opacity' | 'scale' | 'offsetX' | 'offsetY' | 'visible' | 'gifSync'>>) => {
    if (!engine) return
    engine.updateOverlay(id, updates)
    setOverlays([...engine.getOverlays()])
  }, [engine])

  return (
    <div className="panel">
      <div className="panel-header" onClick={() => setCollapsed(!collapsed)}>
        <span>Image Overlay</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            className="btn btn-primary"
            onClick={importOverlay}
            style={{ width: '100%' }}
          >
            Import Image / GIF
          </button>

          {overlays.length === 0 && (
            <div style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '12px 0',
            }}>
              No overlays loaded. Import a PNG, JPG, or GIF.
            </div>
          )}

          {overlays.map(overlay => (
            <div
              key={overlay.id}
              style={{
                background: 'var(--bg-tertiary)',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {/* Header with name, visibility toggle, remove */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                  onClick={() => updateOverlay(overlay.id, { visible: !overlay.visible })}
                  style={{
                    width: '28px', height: '14px', borderRadius: '7px',
                    background: overlay.visible ? 'var(--accent)' : 'var(--border)',
                    position: 'relative', cursor: 'pointer', flexShrink: 0,
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute', top: '2px',
                    left: overlay.visible ? '16px' : '2px',
                    transition: 'left 0.2s',
                  }} />
                </div>
                <span style={{
                  fontSize: '11px',
                  color: 'var(--text-primary)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {overlay.name}
                </span>
                <button
                  onClick={() => removeOverlay(overlay.id)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '14px', padding: '0 4px',
                  }}
                  title="Remove overlay"
                >
                  x
                </button>
              </div>

              {/* Thumbnail */}
              <img
                src={overlay.dataUrl}
                style={{
                  width: '100%', height: '48px', objectFit: 'contain',
                  borderRadius: '4px', background: '#000',
                }}
              />

              {/* GIF Sync Mode — only for GIFs */}
              {overlay._isGif && (
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    GIF Sync
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {SYNC_MODES.map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => updateOverlay(overlay.id, { gifSync: mode.id })}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          borderRadius: '4px',
                          border: overlay.gifSync === mode.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: overlay.gifSync === mode.id ? 'var(--accent-glow)' : 'var(--bg-primary)',
                          color: overlay.gifSync === mode.id ? 'var(--accent)' : 'var(--text-secondary)',
                          fontSize: '10px',
                          fontWeight: overlay.gifSync === mode.id ? 600 : 400,
                          cursor: 'pointer',
                        }}
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '52px', flexShrink: 0 }}>
        {label}
      </span>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, height: '14px' }}
      />
      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', width: '32px', textAlign: 'right' }}>
        {value.toFixed(2)}
      </span>
    </div>
  )
}
