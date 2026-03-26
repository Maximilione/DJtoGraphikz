import React from 'react'

interface OutputPreviewProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

export function OutputPreview({ canvasRef }: OutputPreviewProps) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-secondary)',
      borderRadius: 'var(--panel-radius)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />
      <div style={{
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        fontSize: '10px',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        background: 'rgba(0,0,0,0.6)',
        padding: '2px 6px',
        borderRadius: '3px'
      }}>
        PREVIEW
      </div>
    </div>
  )
}
