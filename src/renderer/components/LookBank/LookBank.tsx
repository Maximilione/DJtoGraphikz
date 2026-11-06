import React, { useState, useCallback, useEffect, useRef } from 'react'
import { shouldIgnoreHotkey } from '../../hotkeys'
import { momentary } from '../../momentary'
import type { Engine, Preset } from '@engine/Engine'
import { pushToast } from '../Toasts/Toasts'
import { loadLooks, persistLooks, makeThumb, SLOTS, type SavedLook } from '../../looks'
import { Panel } from '../Panel/Panel'

/** bare: the grid alone, no Panel — Live and Simple draw it full height. A Panel folded in Pro
 *  used to take the looks away from Live as well, body unmounted. */
function LookBankImpl({ engine, onManual, bare, compactEmpty }: { engine: Engine; onManual?: () => (() => void) | undefined; bare?: boolean; compactEmpty?: boolean }) {
  // Simple: one empty slot is enough to show the gesture; the other fourteen were a wall of '+'
  const [showAll, setShowAll] = useState(false)
  const [looks, setLooks] = useState<(SavedLook | null)[]>(loadLooks)
  // What the triggers and the undo toasts read: the state as it is now, not
  // the render they were created in. With `looks` in their deps the window
  // keydown listener was removed and re-added on every save, rename or swap.
  const looksRef = useRef(looks)
  looksRef.current = looks
  const [active, setActive] = useState(-1)
  // the last pad recalled: stays marked, honestly named — nothing knows whether it is still on the wall
  const [last, setLast] = useState(-1)
  const activeTimer = useRef(0)
  // U3.3 — inline rename + drag&drop reorder
  const [renaming, setRenaming] = useState(-1)
  const [renameText, setRenameText] = useState('')
  const [dragOver, setDragOver] = useState(-1)
  const dragFrom = useRef(-1)

  /**
   * Disk first, then screen. The writes and the toasts used to sit inside the
   * setLooks updaters, which React runs during render and twice under
   * StrictMode: double toasts, double 100-200 KB writes.
   */
  const commit = useCallback((next: (SavedLook | null)[]): boolean => {
    if (!persistLooks(next)) {
      pushToast('Spazio esaurito: il Look Bank non e\' stato salvato', 'look-quota', undefined, 'err')
      return false
    }
    looksRef.current = next
    setLooks(next)
    return true
  }, [])

  // Mirror filled slots (thumbs included) to the phone remote — on mount and
  // on change, settled 250 ms: a reorder is several swaps in a row, and each
  // one used to send sixteen thumbnails over IPC
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        window.api?.sendRemoteLooks(
          looks.flatMap((l, index) => (l ? [{ index, name: l.name, thumb: l.thumb }] : []))
        )
      } catch (_) {}
    }, 250)
    return () => clearTimeout(t)
  }, [looks])

  const saveLook = useCallback(async (i: number) => {
    const preset = engine.createPreset(`Look ${i + 1}`)
    const thumb = await makeThumb(engine)
    // read AFTER the await: another save could have landed meanwhile
    const cur = looksRef.current
    const previous = cur[i]
    const next = [...cur]
    next[i] = { name: previous?.name ?? preset.name, preset, thumb }
    if (!commit(next)) return
    if (previous) {
      // Overwriting was the one destructive path with no way back, while
      // DELETING a look has had undo all along.
      pushToast(`Look ${i + 1} sovrascritto`, `look-save-${i}`, {
        label: 'Annulla',
        fn: () => { const back = [...looksRef.current]; back[i] = previous; commit(back) },
      }, 'ok')
    } else {
      pushToast(`Look ${i + 1} salvato`, `look-save-${i}`, undefined, 'ok')
    }
  }, [engine, commit])

  const deleteLook = useCallback((i: number) => {
    const removed = looksRef.current[i]
    const next = [...looksRef.current]
    next[i] = null
    if (!commit(next)) return
    if (removed) {
      // U3.4 — undo: put the captured look back in its slot
      pushToast(`Look ${i + 1} eliminato`, `look-del-${i}`, {
        label: 'Annulla',
        fn: () => { const back = [...looksRef.current]; back[i] = removed; commit(back) },
      })
    }
  }, [commit])

  const renameLook = useCallback((i: number, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const next = [...looksRef.current]
    const l = next[i]
    if (!l) return
    next[i] = { ...l, name: trimmed, preset: { ...l.preset, name: trimmed } }
    commit(next)
  }, [commit])

  const swapLooks = useCallback((a: number, b: number) => {
    if (a === b || a < 0 || b < 0) return
    const next = [...looksRef.current]
    ;[next[a], next[b]] = [next[b], next[a]]
    commit(next)
  }, [commit])

  const trigger = useCallback((i: number) => {
    const look = looksRef.current[i]
    if (!look) return
    const restoreVj = onManual?.()   // a recalled look takes over from the Auto VJ, as the phone's look does
    engine.applyPreset(look.preset)
    setActive(i)
    setLast(i)
    clearTimeout(activeTimer.current)
    activeTimer.current = window.setTimeout(() => setActive(prev => (prev === i ? -1 : prev)), 600)
    return restoreVj
  }, [engine, onManual])
  useEffect(() => () => clearTimeout(activeTimer.current), [])

  // Shift+1..9, Shift+0 → slots 1-10. e.code so shifted symbol layouts don't break.
  useEffect(() => {
    const slotOf = (e: KeyboardEvent) => {
      const m = /^Digit(\d)$/.exec(e.code)
      if (!m) return -1
      return m[1] === '0' ? 9 : parseInt(m[1]) - 1
    }
    const onKey = (e: KeyboardEvent) => {
      if (!e.shiftKey) return
      if (shouldIgnoreHotkey(e)) return
      const i = slotOf(e)
      if (i < 0 || !looksRef.current[i]) return
      e.preventDefault()
      if (e.repeat || !engine || momentary.isDown(`look:${i}`)) return
      // Held, this is momentary — and going back means restoring the look that
      // was on screen, which is not the same as recalling a different slot.
      const before = engine.createPreset('prima del richiamo')
      const lastWas = last
      const restoreVj = trigger(i)
      momentary.press(`look:${i}`, () => { engine.applyPreset(before); restoreVj?.(); setLast(lastWas) })
    }
    // Shift can come up before the digit does, so the release is read off
    // e.code alone and never off shiftKey.
    const onKeyUp = (e: KeyboardEvent) => {
      const i = slotOf(e)
      if (i >= 0) momentary.release(`look:${i}`)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [trigger, engine, last])

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

  const grid = (
      <div className={`look-bank-grid${compactEmpty && !showAll ? ' compact-empty' : ''}`}>
        {bare && looks.every(l => !l) && (
          <p className="look-empty-hint">Nessun look salvato. Tocca un pad per salvare quello che vedi in anteprima.</p>
        )}
        {looks.map((look, i) => look ? (
          <div
            key={i}
            className={`look-slot${active === i ? ' active' : ''}${last === i ? ' last' : ''}${dragOver === i ? ' drag-over' : ''}`}
            draggable={renaming !== i}
            onDragStart={() => { dragFrom.current = i }}
            {...dropHandlers(i)}
          >
            {/* The slot is a drag target and a stacking context, so it cannot
                itself be the button — it holds one. This covers the whole
                tile; the thumbnail, number and name let clicks through. */}
            <button
              type="button"
              className="btn look-hit"
              title={`${look.name} — click: applica · Shift+click: sovrascrivi · trascina per riordinare${i < 10 ? ` · Shift+${(i + 1) % 10} (tieni premuto: momentaneo)` : ''}`}
              onClick={e => e.shiftKey ? saveLook(i) : trigger(i)}
            />
            {look.thumb ? <img src={look.thumb} alt="" />
              : <span className="look-fill" style={{ background: `linear-gradient(135deg, ${look.preset.colors.join(', ')})` }} />}
            <span className="look-num" title={last === i ? 'Ultimo richiamato' : undefined}>{i + 1}</span>
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
              <span className="look-name">{look.name}</span>
            )}
            {renaming !== i && (
              <button
                className="btn btn-ghost btn-sm look-edit"
                title="Rinomina look"
                onClick={() => { setRenameText(look.name); setRenaming(i) }}
               aria-label="Rinomina look">
                ✎
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm danger look-del"
              title="Elimina look"
              onClick={() => deleteLook(i)}
             aria-label="Elimina look">
              ✕
            </button>
          </div>
        ) : (
          <button
            key={i}
            type="button"
            className={`btn look-slot empty${dragOver === i ? ' drag-over' : ''}`}
            title="Salva il look corrente"
            onClick={() => saveLook(i)}
            {...dropHandlers(i)}
          >
            <span className="look-num">{i + 1}</span>
          </button>
        ))}
        {compactEmpty && looks.some(l => !l) && (
          <button className="btn btn-ghost btn-sm look-showall" onClick={() => setShowAll(v => !v)}>
            {showAll ? 'Nascondi gli slot vuoti' : 'Mostra tutti gli slot'}
          </button>
        )}
      </div>
  )
  return bare ? grid : <Panel id="looks" title="Look Bank">{grid}</Panel>
}

/** Memoised: App re-renders on every slider tick and remote command; this panel only depends on the engine. */
export const LookBank = React.memo(LookBankImpl)
