import { readJson, writeJson } from '../storage'
import { useCallback, useEffect, useState } from 'react'

// U3.2 — accordion sidebar: per-panel collapsed state, persisted in one
// localStorage JSON object. Panels that pass a `group` behave as an
// accordion: expanding one collapses the others of the same group
// (via the 'djg-panel-open' window event — no shared store needed).

const STORAGE_KEY = 'djtographikz-panels'

function readAll(): Record<string, boolean> {
  return readJson<Record<string, boolean>>(STORAGE_KEY, {})
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

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      persist(id, next)
      if (!next && group) {
        window.dispatchEvent(new CustomEvent('djg-panel-open', { detail: { id, group } }))
      }
      return next
    })
  }, [id, group])

  // A sibling of the same group expanded → collapse this panel
  useEffect(() => {
    if (!group) return
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; group: string }>).detail
      if (d.group !== group || d.id === id) return
      setCollapsed(prev => {
        if (!prev) persist(id, true)
        return true
      })
    }
    window.addEventListener('djg-panel-open', onOpen)
    return () => window.removeEventListener('djg-panel-open', onOpen)
  }, [id, group])

  return [collapsed, toggle]
}
