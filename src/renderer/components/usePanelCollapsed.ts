import { readJson, writeJson } from '../storage'
import { useCallback, useEffect, useRef, useState } from 'react'

// U3.2 — accordion sidebar: per-panel collapsed state, persisted in one
// localStorage JSON object. Panels that pass a `group` behave as an
// accordion: expanding one collapses the others of the same group
// (via the 'djg-panel-open' window event — no shared store needed).

const STORAGE_KEY = 'djtographikz-panels'

// Parsed once: every Panel used to re-read and re-parse the whole object at
// mount, and persist() re-read it on every toggle. The only writer is below.
let cache: Record<string, boolean> | null = null

function readAll(): Record<string, boolean> {
  if (!cache) cache = readJson<Record<string, boolean>>(STORAGE_KEY, {})
  return cache
}

function persist(id: string, collapsed: boolean) {
  const all = readAll()
  all[id] = collapsed
  writeJson(STORAGE_KEY, all)
}

export function usePanelCollapsed(
  id: string,
  defaultCollapsed = false,
  group?: string,
): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => readAll()[id] ?? defaultCollapsed)
  // The write and the accordion event stay out of the setState updater: React
  // runs updaters during render (twice under StrictMode), so siblings were
  // told to collapse while another component was rendering.
  const ref = useRef(collapsed)
  ref.current = collapsed

  const toggle = useCallback(() => {
    const next = !ref.current
    ref.current = next
    setCollapsed(next)
    persist(id, next)
    if (!next && group) {
      window.dispatchEvent(new CustomEvent('djg-panel-open', { detail: { id, group } }))
    }
  }, [id, group])

  // A sibling of the same group expanded → collapse this panel
  useEffect(() => {
    if (!group) return
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; group: string }>).detail
      if (d.group !== group || d.id === id) return
      if (ref.current) return
      ref.current = true
      persist(id, true)
      setCollapsed(true)
    }
    window.addEventListener('djg-panel-open', onOpen)
    return () => window.removeEventListener('djg-panel-open', onOpen)
  }, [id, group])

  return [collapsed, toggle]
}
