import React, { useState, useRef, useCallback, useEffect } from 'react'

interface NumberInputProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  label?: string
  suffix?: string
  width?: number
}

/**
 * Compact numeric input with:
 * - Click to show editable text field
 * - Arrow keys for nudging (step, shift+step*10)
 * - Mouse wheel to adjust
 * - Displays formatted value normally
 */
export function NumberInput({
  value, min, max, step, onChange, label, suffix = '', width = 42,
}: NumberInputProps) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const clamp = useCallback((v: number) => {
    return Math.round(Math.min(max, Math.max(min, v)) / step) * step
  }, [min, max, step])

  // Start editing on double-click
  const startEdit = useCallback(() => {
    setEditText(formatValue(value, step))
    setEditing(true)
  }, [value, step])

  // Commit edit
  const commitEdit = useCallback(() => {
    const parsed = parseFloat(editText)
    if (!isNaN(parsed)) {
      onChange(clamp(parsed))
    }
    setEditing(false)
  }, [editText, onChange, clamp])

  // Focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  // Arrow key nudge
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === 'Enter') { commitEdit(); e.preventDefault() }
      if (e.key === 'Escape') { setEditing(false); e.preventDefault() }
      return
    }

    const mult = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(clamp(value + step * mult))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(clamp(value - step * mult))
    }
  }, [editing, value, step, onChange, clamp, commitEdit])

  // Mouse wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? step : -step
    const mult = e.shiftKey ? 10 : 1
    onChange(clamp(value + delta * mult))
  }, [value, step, onChange, clamp])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        width: `${width}px`,
        outline: 'none',
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            padding: '1px 3px',
            borderRadius: '2px',
            border: '1px solid var(--accent)',
            background: 'var(--bg-primary)',
            color: 'var(--accent)',
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            textAlign: 'right',
            outline: 'none',
          }}
        />
      ) : (
        <span
          onDoubleClick={startEdit}
          title="Double-click to edit, scroll or arrows to adjust"
          style={{
            width: '100%',
            textAlign: 'right',
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            cursor: 'ns-resize',
            userSelect: 'none',
            padding: '1px 3px',
            borderRadius: '2px',
            border: '1px solid transparent',
            transition: 'border-color 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-light)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
        >
          {formatValue(value, step)}{suffix}
        </span>
      )}
    </div>
  )
}

function formatValue(value: number, step: number): string {
  if (step >= 1) return Math.round(value).toString()
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  return value.toFixed(decimals)
}
