import React, { useEffect, useState } from 'react'

// Tiny module-level toast bus: pushToast() works from anywhere (no context,
// no store) and the single <Toasts /> instance subscribes.
export type ToastAction = { label: string; fn: () => void }
/**
 * Every toast used to look identical — the same green left border whether a
 * preset had been saved or had failed to save. A success state that cannot be
 * told apart from a failure is not a success state.
 */
export type ToastLevel = 'info' | 'ok' | 'err'
type Toast = { id: number; key: string; msg: string; ts: number; level: ToastLevel; action?: ToastAction }

const DISMISS_MS = 2500
const ACTION_DISMISS_MS = 5000 // undo toasts stay long enough to be clicked
const COLLAPSE_MS = 1500
const MAX_TOASTS = 4

let nextId = 1
let toasts: Toast[] = []
let listener: ((t: Toast[]) => void) | null = null
const timers = new Map<number, number>()

function remove(id: number) {
  timers.delete(id)
  toasts = toasts.filter(t => t.id !== id)
  listener?.(toasts)
}

// key collapses identical consecutive toasts (sliders): same key within
// COLLAPSE_MS updates the existing toast in place instead of stacking.
// action (U3.4): shows an underlined button, toast becomes clickable and
// lives 5s instead of 2.5s.
export function pushToast(msg: string, key = msg, action?: ToastAction, level: ToastLevel = 'info') {
  const now = Date.now()
  const dismissMs = action ? ACTION_DISMISS_MS : DISMISS_MS
  const existing = toasts.find(t => t.key === key && now - t.ts < COLLAPSE_MS)
  if (existing) {
    existing.msg = msg
    existing.ts = now
    existing.action = action
    existing.level = level
    clearTimeout(timers.get(existing.id))
    timers.set(existing.id, window.setTimeout(() => remove(existing.id), dismissMs))
    toasts = [...toasts]
  } else {
    const t: Toast = { id: nextId++, key, msg, ts: now, level, action }
    toasts = [...toasts, t].slice(-MAX_TOASTS)
    timers.set(t.id, window.setTimeout(() => remove(t.id), dismissMs))
  }
  listener?.(toasts)
}

export function Toasts() {
  const [list, setList] = useState<Toast[]>(toasts)
  useEffect(() => {
    listener = setList
    return () => { if (listener === setList) listener = null }
  }, [])
  if (list.length === 0) return null
  return (
    <div className="toast-stack">
      {list.map(t => (
        <div key={t.id} className={`toast toast-${t.level}${t.action ? ' toast-action' : ''}`}>
          {t.msg}
          {t.action && (
            <button
              className="btn btn-ghost btn-sm toast-action"
              onClick={() => { t.action?.fn(); remove(t.id) }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
