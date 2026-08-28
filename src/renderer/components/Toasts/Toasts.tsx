import React, { useEffect, useState } from 'react'

// Tiny module-level toast bus: pushToast() works from anywhere (no context,
// no store) and the single <Toasts /> instance subscribes.
type Toast = { id: number; key: string; msg: string; ts: number }

const DISMISS_MS = 2500
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
// COLLAPSE_MS updates the existing toast in place instead of stacking
export function pushToast(msg: string, key = msg) {
  const now = Date.now()
  const existing = toasts.find(t => t.key === key && now - t.ts < COLLAPSE_MS)
  if (existing) {
    existing.msg = msg
    existing.ts = now
    clearTimeout(timers.get(existing.id))
    timers.set(existing.id, window.setTimeout(() => remove(existing.id), DISMISS_MS))
    toasts = [...toasts]
  } else {
    const t: Toast = { id: nextId++, key, msg, ts: now }
    toasts = [...toasts, t].slice(-MAX_TOASTS)
    timers.set(t.id, window.setTimeout(() => remove(t.id), DISMISS_MS))
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
      {list.map(t => <div key={t.id} className="toast">{t.msg}</div>)}
    </div>
  )
}
