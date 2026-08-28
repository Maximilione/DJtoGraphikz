import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { Engine, Preset } from '@engine/Engine'
import { pushToast } from '../Toasts/Toasts'

interface SavedLook {
  name: string
  preset: Preset
  thumb: string // small JPEG dataURL, '' if capture failed
}

const STORAGE_KEY = 'djtographikz-looks'
const SLOTS = 16

function loadLooks(): (SavedLook | null)[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const arr: (SavedLook | null)[] = raw ? JSON.parse(raw) : []
    return Array.from({ length: SLOTS }, (_, i) => arr[i] ?? null)
  } catch {
    return Array(SLOTS).fill(null)
  }
}

function persistLooks(looks: (SavedLook | null)[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(looks)) } catch {}
}

// Grab next rendered frame and downscale to a 160x90 JPEG dataURL
async function makeThumb(engine: Engine): Promise<string> {
  try {
    const blob = await engine.screenshot()
    if (!blob) return ''
    const bmp = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 90
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, 160, 90)
    bmp.close()
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    return ''
  }
}

export function LookBank({ engine }: { engine: Engine }) {
  const [collapsed, setCollapsed] = useState(false)
  const [looks, setLooks] = useState<(SavedLook | null)[]>(loadLooks)
  const [active, setActive] = useState(-1)
  // U3.3 — inline rename + drag&drop reorder
  const [renaming, setRenaming] = useState(-1)
  const [renameText, setRenameText] = useState('')
  const [dragOver, setDragOver] = useState(-1)
  const dragFrom = useRef(-1)

  // Mirror filled slots (thumbs included) to the phone remote — on mount and on change
  useEffect(() => {
    try {
      window.api?.sendRemoteLooks(
        looks.flatMap((l, index) => (l ? [{ index, name: l.name, thumb: l.thumb }] : []))
      )
    } catch (_) {}
  }, [looks])

  const saveLook = useCallback(async (i: number) => {
    const preset = engine.createPreset(`Look ${i + 1}`)
    const thumb = await makeThumb(engine)
    setLooks(prev => {
      const next = [...prev]
      next[i] = { name: preset.name, preset, thumb }
      persistLooks(next)
      return next
    })
  }, [engine])

  const deleteLook = useCallback((i: number) => {
    const removed = looks[i]
    setLooks(prev => {
      const next = [...prev]
      next[i] = null
      persistLooks(next)
      return next
    })
    if (removed) {
      // U3.4 — undo: put the captured look back in its slot
      pushToast(`Look ${i + 1} eliminato`, `look-del-${i}`, {
        label: 'Annulla',
        fn: () => setLooks(prev => {
          const next = [...prev]
          next[i] = removed
          persistLooks(next)
          return next
        }),
      })
    }
  }, [looks])

  const renameLook = useCallback((i: number, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setLooks(prev => {
      const next = [...prev]
      const l = next[i]
      if (l) next[i] = { ...l, name: trimmed, preset: { ...l.preset, name: trimmed } }
      persistLooks(next)
      return next
    })
  }, [])

  const swapLooks = useCallback((a: number, b: number) => {
    if (a === b || a < 0 || b < 0) return
    setLooks(prev => {
      const next = [...prev]
      ;[next[a], next[b]] = [next[b], next[a]]
      persistLooks(next)
      return next
    })
  }, [])

  const trigger = useCallback((i: number) => {
    const look = looks[i]
    if (!look) return
    engine.applyPreset(look.preset)
    setActive(i)
    window.setTimeout(() => setActive(prev => (prev === i ? -1 : prev)), 600)
  }, [engine, looks])

  // Shift+1..9, Shift+0 → slots 1-10. e.code so shifted symbol layouts don't break.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.shiftKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
      const m = /^Digit(\d)$/.exec(e.code)
      if (!m) return
      const i = m[1] === '0' ? 9 : parseInt(m[1]) - 1
      if (looks[i]) {
        e.preventDefault()
        trigger(i)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [looks, trigger])

  const commitRename = useCallback(() => {
    if (renaming >= 0) renameLook(renaming, renameText)
    setRenaming(-1)
  }, [renaming, renameText, renameLook])

  // Drag&drop: drop on any slot swaps positions (empty slots included → move)
  const dropHandlers = (i: number) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(i) },
    onDragLeave: () => setDragOver(prev => (prev === i ? -1 : prev)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(-1)
      swapLooks(dragFrom.current, i)
      dragFrom.current = -1
    },
  })

  return (
    <div className="panel">
      <div
        className="panel-header"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Espandi Look Bank' : 'Comprimi Look Bank'}
      >
        <span>Look Bank</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div className="look-bank-grid">
          {looks.map((look, i) => look ? (
            <div
              key={i}
              className={`look-slot${active === i ? ' active' : ''}${dragOver === i ? ' drag-over' : ''}`}
              title={`${look.name} — click: applica · Shift+click: sovrascrivi · doppio-click sul nome: rinomina · trascina per riordinare${i < 10 ? ` · Shift+${(i + 1) % 10}` : ''}`}
              onClick={e => e.shiftKey ? saveLook(i) : trigger(i)}
              draggable={renaming !== i}
              onDragStart={() => { dragFrom.current = i }}
              {...dropHandlers(i)}
            >
              {look.thumb && <img src={look.thumb} alt="" />}
              <span className="look-num">{i + 1}</span>
              {renaming === i ? (
                <input
                  className="look-rename"
                  type="text"
                  value={renameText}
                  autoFocus
                  onChange={e => setRenameText(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onBlur={commitRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setRenaming(-1)
                    e.stopPropagation()
                  }}
                />
              ) : (
                <span
                  className="look-name"
                  title="Doppio-click per rinominare"
                  onDoubleClick={e => {
                    e.stopPropagation()
                    setRenameText(look.name)
                    setRenaming(i)
                  }}
                >
                  {look.name}
                </span>
              )}
              <button
                className="look-del"
                title="Elimina look"
                onClick={e => { e.stopPropagation(); deleteLook(i) }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div
              key={i}
              className={`look-slot empty${dragOver === i ? ' drag-over' : ''}`}
              title="Salva il look corrente"
              onClick={() => saveLook(i)}
              {...dropHandlers(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
