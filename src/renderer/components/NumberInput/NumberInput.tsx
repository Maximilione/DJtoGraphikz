import React, { useState, useRef, useCallback, useEffect } from 'react'

interface NumberInputProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  suffix?: string
}

/**
 * Compact numeric input with:
 * - Click to show editable text field
 * - Arrow keys for nudging (step, shift+step*10)
 * - Mouse wheel to adjust
 * - Displays formatted value normally
 */
export function NumberInput({
  value, min, max, step, onChange, suffix = '',
}: NumberInputProps) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Escape unmounts the input while it has the focus: the blur that follows
  // used to commit the very text Escape was cancelling
  const cancelled = useRef(false)

  const clamp = useCallback((v: number) => {
    return Math.round(Math.min(max, Math.max(min, v)) / step) * step
  }, [min, max, step])

  // Start editing on double-click
  const startEdit = useCallback(() => {
    cancelled.current = false
    setEditText(formatValue(value, step))
    setEditing(true)
  }, [value, step])

  // Commit edit
  const commitEdit = useCallback(() => {
    if (cancelled.current) return
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
      if (e.key === 'Escape') { cancelled.current = true; setEditing(false); e.preventDefault() }
      return
    }

    // Enter is the keyboard twin of the double-click: same action, other device
    if (e.key === 'Enter') { e.preventDefault(); startEdit(); return }

    const mult = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(clamp(value + step * mult))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(clamp(value - step * mult))
    }
  }, [editing, value, step, onChange, clamp, commitEdit, startEdit])

  // Mouse wheel — only when focused (click first), otherwise the sidebar
  // couldn't scroll past any of these values. Registered once: the handler
  // reads the latest props through a ref, where a handler closed over
  // `value` was removed and re-added on every emit of the engine.
  const latest = useRef({ value, step, onChange, clamp })
  latest.current = { value, step, onChange, clamp }
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (document.activeElement !== el) return
      e.preventDefault()
      const { value, step, onChange, clamp } = latest.current
      const delta = e.deltaY < 0 ? step : -step
      const mult = e.shiftKey ? 10 : 1
      onChange(clamp(value + delta * mult))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div
      ref={containerRef}
      className="num-input"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="num-edit"
          type="text"
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onBlur={commitEdit}
          // the container has the same handler: without this Enter bubbled
          // up and committed twice (two onChange to the engine)
          onKeyDown={e => { handleKeyDown(e); e.stopPropagation() }}
        />
      ) : (
        <span
          className="num-value"
          onDoubleClick={startEdit}
          title="Invio o doppio-click per scrivere · frecce o rotella per regolare"
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
