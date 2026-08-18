import React, { useState, useCallback, useEffect } from 'react'
import type { Engine, Preset } from '@engine/Engine'

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
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [engine])

  const deleteLook = useCallback((i: number) => {
    setLooks(prev => {
      const next = [...prev]
      next[i] = null
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
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

  return (
    <div className="panel">
      <div className="panel-header" onClick={() => setCollapsed(!collapsed)}>
        <span>Look Bank</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div className="look-bank-grid">
          {looks.map((look, i) => look ? (
            <div
              key={i}
              className={`look-slot${active === i ? ' active' : ''}`}
              title={`${look.name} — click: applica · Shift+click: sovrascrivi${i < 10 ? ` · Shift+${(i + 1) % 10}` : ''}`}
              onClick={e => e.shiftKey ? saveLook(i) : trigger(i)}
            >
              {look.thumb && <img src={look.thumb} alt="" />}
              <span className="look-num">{i + 1}</span>
              <span className="look-name">{look.name}</span>
              <button
                className="look-del"
                title="Elimina"
                onClick={e => { e.stopPropagation(); deleteLook(i) }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div
              key={i}
              className="look-slot empty"
              title="Salva il look corrente"
              onClick={() => saveLook(i)}
            >
              +
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
