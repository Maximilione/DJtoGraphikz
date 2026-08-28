import React from 'react'

interface HelpMenuProps {
  onShortcuts: () => void
  onGuide: () => void
  onOnboarding: () => void
  onClose: () => void
}

const itemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '8px 14px',
  background: 'none',
  border: 'none',
  color: 'var(--text-primary)',
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/** Small help dropdown anchored top-right, below the top bar. Click-outside closes. */
export function HelpMenu({ onShortcuts, onGuide, onOnboarding, onClose }: HelpMenuProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900 }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 44,
          right: 12,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--panel-radius)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          padding: '4px 0',
          minWidth: 190,
        }}
      >
        <button
          style={itemStyle}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          onClick={onShortcuts}
        >
          Scorciatoie <span style={{ color: 'var(--text-muted)' }}>(?)</span>
        </button>
        <button
          style={itemStyle}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          onClick={onGuide}
        >
          Guida rapida
        </button>
        <button
          style={itemStyle}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          onClick={onOnboarding}
        >
          Rifai configurazione
        </button>
      </div>
    </div>
  )
}
