import React, { useState, useCallback, useEffect, useRef } from 'react'
import { readJson, writeJson } from '../../storage'
import { TRANSITIONS } from '../../catalog'
import type { Engine, Preset, EffectId, PostId, TransitionType } from '@engine/Engine'
import { loadLooks, makeThumb, type SavedLook } from '../../looks'
import {
  migrateAll, migrate, clampHold, nextIndex, manualStep, validSeqIndex, moveStep, totalHold, indexAfterRemoval,
  usesHold, HOLD_LIMITS, MODE_LABELS, type Sequence, type SequenceStep, type SequenceMode, type StepOverlay,
} from './sequences'
import { registerSeqHandlers, pushSeqStatus } from './seqRemote'
import { enterStep, clearStepOverlays, paramsFromScreen } from './sequencePlayer'
import { readLibraryImage, IMAGE_RE, type LibraryItem } from '../OverlayPanel/OverlayPanel'
import { shouldIgnoreHotkey } from '../../hotkeys'
import { pushToast } from '../Toasts/Toasts'
import { Panel } from '../Panel/Panel'
import { SliderRow } from '../SliderRow/SliderRow'

interface PresetPanelProps {
  engine: Engine | null
}


const STORAGE_KEY_PRESETS = 'djtographikz-presets'
const STORAGE_KEY_PLAYLISTS = 'djtographikz-playlists'

function loadPresets(): Preset[] {
  return readJson<Preset[]>(STORAGE_KEY_PRESETS, [])
}

/**
 * Returns false when the write did not happen. Presets carry custom shaders and
 * every effect's params, so the quota is a real limit — and the caller must not
 * put the preset on screen until this says yes.
 */
function savePresetsToStorage(presets: Preset[]): boolean {
  return writeJson(STORAGE_KEY_PRESETS, presets)
}

function loadSequences(): Sequence[] {
  // migrate(): playlists saved before per-step holds existed still load
  return migrateAll(readJson<unknown[]>(STORAGE_KEY_PLAYLISTS, []))
}

function saveSequencesToStorage(playlists: Sequence[]): boolean {
  return writeJson(STORAGE_KEY_PLAYLISTS, playlists)
}

export function PresetPanel({ engine }: PresetPanelProps) {
  const [tab, setTab] = useState<'presets' | 'playlist'>('presets')

  // Presets
  const [presets, setPresets] = useState<Preset[]>(loadPresets)
  const [presetName, setPresetName] = useState('')

  // Sequences (saved) + the one open in the editor
  const [sequences, setSequences] = useState<Sequence[]>(loadSequences)
  const [draft, setDraft] = useState<Sequence>(() => ({
    name: '', steps: [], loop: true, mode: 'timer', defaultHold: 8,
  }))
  // index into `sequences` when the draft came from a saved one — that is what
  // makes Salva overwrite instead of piling up a new copy every time
  const [editingIndex, setEditingIndex] = useState(-1)

  // Playback
  const [playingSeq, setPlayingSeq] = useState<Sequence | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  // Looks available as sources for new steps
  const [looks, setLooks] = useState<(SavedLook | null)[]>(loadLooks)
  const [showLookPicker, setShowLookPicker] = useState(false)

  // Step graphics editor: which step has its picker open, the image library,
  // the text being typed, and which step is on screen as a trial
  const [pickerFor, setPickerFor] = useState(-1)
  const [library, setLibrary] = useState<LibraryItem[]>([])
  const [stepText, setStepText] = useState('')
  const [stepTextColor, setStepTextColor] = useState('#ffffff')
  const [trialStep, setTrialStep] = useState(-1)

  const timerRef = useRef<number>(0)
  const beatCountRef = useRef(0)
  const dragFrom = useRef(-1)
  const [dragOver, setDragOver] = useState(-1)

  const step: SequenceStep | undefined = playingSeq?.steps[stepIndex]

  const advance = useCallback(() => {
    // The next index is computed here, not inside the state updater: React may
    // run an updater more than once, and stopping playback from inside one made
    // the end of a sequence depend on how many times that happened
    setStepIndex(prev => {
      const next = nextIndex(prev, playingSeq?.steps.length ?? 0, playingSeq?.loop ?? false)
      if (next < 0) {
        queueMicrotask(() => setPlaying(false))   // end of a non-looping run
        return prev
      }
      return next
    })
  }, [playingSeq])

  const seqPrev = useCallback(() => {
    setStepIndex(prev => manualStep(prev, playingSeq?.steps.length ?? 0, playingSeq?.loop ?? false, -1))
  }, [playingSeq])

  const seqNext = useCallback(() => {
    setStepIndex(prev => manualStep(prev, playingSeq?.steps.length ?? 0, true, 1))  // manual skip always wraps
  }, [playingSeq])

  // Timer advance — the hold belongs to the CURRENT step, so the interval is
  // re-armed on every step instead of running at one fixed rate
  useEffect(() => {
    if (!playing || !playingSeq || playingSeq.mode !== 'timer' || !step) return
    timerRef.current = window.setTimeout(advance, step.hold * 1000)
    return () => clearTimeout(timerRef.current)
  }, [playing, playingSeq, step, advance])

  // Beat advance — counts beats up to this step's hold
  useEffect(() => {
    if (!playing || !playingSeq || playingSeq.mode !== 'beats' || !step || !engine) return
    beatCountRef.current = 0
    // Subscribe to the render loop — polling misses beats (the flag lives one frame)
    return engine.onAudioFrame(beatDetected => {
      if (!beatDetected) return
      beatCountRef.current++
      if (beatCountRef.current < step.hold) return
      beatCountRef.current = 0
      advance()
    })
  }, [playing, playingSeq, step, engine, advance])

  // Track advance — one step per song, on Engine.onTrackChange (Pro DJ Link
  // track id, or the audio heuristic when there are no CDJs)
  useEffect(() => {
    if (!playing || !playingSeq || playingSeq.mode !== 'track' || !engine) return
    return engine.onTrackChange(() => advance())
  }, [playing, playingSeq, engine, advance])

  // Apply the step's look (and its transition, when it names one) and put its
  // graphics up; leaving the step — or stopping — takes them down again
  useEffect(() => {
    if (!playing || !engine || !step) return
    if (step.transition) engine.setTransitionType(step.transition)
    engine.applyPreset(step.preset)
    let alive = true
    enterStep(engine, step, readLibraryImage, () => alive)
    return () => { alive = false; clearStepOverlays(engine) }
  }, [step, playing, engine])

  // N / Shift+N step the running sequence — the only way to move in 'manual'
  useEffect(() => {
    if (!playing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.key.toLowerCase() !== 'n' || shouldIgnoreHotkey(e)) return
      if (e.shiftKey) seqPrev(); else seqNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, seqPrev, seqNext])

  // Save preset
  const savePreset = useCallback(() => {
    if (!engine || !presetName.trim()) return
    const preset = engine.createPreset(presetName.trim())
    const next = [...presets, preset]
    // disk first: the list must not show a preset that never reached storage
    if (!savePresetsToStorage(next)) return
    setPresets(next)
    setPresetName('')
    pushToast(`Preset "${preset.name}" salvato`, 'preset-save', undefined, 'ok')
  }, [engine, presetName, presets])

  // Apply preset
  const applyPreset = useCallback((preset: Preset) => {
    if (!engine) return
    engine.applyPreset(preset)
  }, [engine])

  // Delete preset
  const deletePreset = useCallback((index: number) => {
    const removed = presets[index]
    const next = presets.filter((_, i) => i !== index)
    if (!savePresetsToStorage(next)) return
    setPresets(next)
    // A preset carries the whole engine state, custom shader included, and it
    // used to vanish with no confirmation and no way back.
    pushToast(`Preset "${removed?.name ?? ''}" eliminato`, `preset-del-${index}`, {
      label: 'Annulla',
      fn: () => {
        const back = [...next.slice(0, index), removed, ...next.slice(index)]
        if (savePresetsToStorage(back)) setPresets(back)
      },
    })
  }, [presets])

  // Export all presets as JSON file
  const exportPresets = useCallback(() => {
    const json = JSON.stringify(presets, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'djtographikz-presets.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [presets])

  // Import presets from JSON file
  const importPresets = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const imported: Preset[] = JSON.parse(text)
        if (Array.isArray(imported) && imported.length > 0 && imported[0].effect) {
          const merged = [...presets, ...imported]
          setPresets(merged)
          savePresetsToStorage(merged)
        }
      } catch {}
    }
    input.click()
  }, [presets])

  // ---- Sequence editor ----

  /** disk first, then the screen — false means nothing was written */
  const persist = useCallback((next: Sequence[]): boolean => {
    if (!saveSequencesToStorage(next)) return false
    setSequences(next)
    return true
  }, [])

  const addStep = useCallback((name: string, preset: Preset, thumb?: string) => {
    setDraft(d => ({
      ...d,
      steps: [...d.steps, { name, preset, thumb, hold: d.defaultHold }],
    }))
  }, [])

  /** Add the look currently on screen, capturing a thumbnail for it */
  const addCurrentLook = useCallback(async () => {
    if (!engine) return
    const name = `Passo ${draft.steps.length + 1}`
    const preset = engine.createPreset(name)
    addStep(name, preset, await makeThumb(engine))
  }, [engine, draft.steps.length, addStep])

  const updateStep = useCallback((i: number, patch: Partial<SequenceStep>) => {
    setDraft(d => ({ ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
  }, [])

  const removeStep = useCallback((i: number) => {
    setDraft(d => ({ ...d, steps: d.steps.filter((_, j) => j !== i) }))
  }, [])

  const duplicateStep = useCallback((i: number) => {
    setDraft(d => ({ ...d, steps: [...d.steps.slice(0, i + 1), { ...d.steps[i] }, ...d.steps.slice(i + 1)] }))
  }, [])

  // ---- Step graphics ----

  const addStepOverlay = useCallback((i: number, ov: StepOverlay) => {
    setDraft(d => ({
      ...d,
      steps: d.steps.map((s, j) => (j === i ? { ...s, overlays: [...(s.overlays ?? []), ov] } : s)),
    }))
  }, [])

  const removeStepOverlay = useCallback((i: number, k: number) => {
    setDraft(d => ({
      ...d,
      steps: d.steps.map((s, j) => (j === i ? { ...s, overlays: (s.overlays ?? []).filter((_, m) => m !== k) } : s)),
    }))
  }, [])

  const openPicker = useCallback((i: number) => {
    setPickerFor(p => (p === i ? -1 : i))
    window.api?.libraryList().then(l => setLibrary(l.filter(x => IMAGE_RE.test(x.name)))).catch(() => {})
  }, [])

  /** A library image/GIF → step graphic, with the on-screen params if it is already up */
  const graphicFromLibrary = useCallback((i: number, item: LibraryItem) => {
    addStepOverlay(i, {
      kind: /\.gif$/i.test(item.name) ? 'gif' : 'image',
      name: item.name, path: item.path,
      ...paramsFromScreen(engine?.getOverlays() ?? [], item.name),
    })
  }, [engine, addStepOverlay])

  /** Files from disk go through the library first, so the step points at a path that survives restarts */
  const graphicFromFile = useCallback(async (i: number) => {
    const assets = await window.api?.importAssets()
    if (!assets?.length) return
    for (const a of assets) {
      try {
        graphicFromLibrary(i, await window.api.librarySave(a.name, a.data))
      } catch {
        pushToast(`Non riesco a salvare ${a.name}`, undefined, undefined, 'err')
      }
    }
    setLibrary((await window.api?.libraryList() ?? []).filter(x => IMAGE_RE.test(x.name)))
  }, [graphicFromLibrary])

  const graphicFromText = useCallback((i: number) => {
    const text = stepText.trim()
    if (!text) return
    addStepOverlay(i, {
      kind: 'text', name: text, text, color: stepTextColor,
      ...paramsFromScreen(engine?.getOverlays() ?? [], text),
    })
    setStepText('')
  }, [engine, stepText, stepTextColor, addStepOverlay])

  /** Show one step — look and graphics — without running the sequence; press again to take it down */
  const tryStep = useCallback((i: number) => {
    const st = draft.steps[i]
    if (!engine || !st) return
    if (trialStep === i) {
      clearStepOverlays(engine)
      setTrialStep(-1)
      return
    }
    if (st.transition) engine.setTransitionType(st.transition)
    engine.applyPreset(st.preset)
    enterStep(engine, st, readLibraryImage)
    setTrialStep(i)
  }, [engine, draft.steps, trialStep])

  /** Switching unit re-clamps every hold — 60s is fine, 60 beats is not always */
  const setMode = useCallback((mode: SequenceMode) => {
    setDraft(d => ({
      ...d,
      mode,
      defaultHold: clampHold(d.defaultHold, mode),
      steps: d.steps.map(s => ({ ...s, hold: clampHold(s.hold, mode) })),
    }))
  }, [])

  const newDraft = useCallback(() => {
    setDraft({ name: '', steps: [], loop: true, mode: 'timer', defaultHold: 8 })
    setEditingIndex(-1)
  }, [])

  /** Open a saved sequence in the editor — the whole point of this rewrite */
  const editSequence = useCallback((i: number) => {
    setDraft(migrate(sequences[i]))
    setEditingIndex(i)
  }, [sequences])

  const saveDraft = useCallback((asNew = false) => {
    const name = draft.name.trim()
    if (!name || draft.steps.length === 0) return
    const seq = { ...draft, name }
    if (!asNew && editingIndex >= 0) {
      if (!persist(sequences.map((s, i) => (i === editingIndex ? seq : s)))) return
      pushToast(`Scaletta "${name}" aggiornata`, undefined, undefined, 'ok')
    } else {
      if (!persist([...sequences, seq])) return
      setEditingIndex(sequences.length)
      pushToast(`Scaletta "${name}" salvata`, undefined, undefined, 'ok')
    }
  }, [draft, editingIndex, sequences, persist])

  // ---- Playback ----

  const startSequence = useCallback((seq: Sequence) => {
    if (seq.steps.length === 0) return
    setPlayingSeq(seq)
    setStepIndex(0)
    setPlaying(true)
    setTrialStep(-1)   // the first step's enter replaces whatever was on trial
  }, [])

  const stopSequence = useCallback(() => {
    setPlaying(false)
    setPlayingSeq(null)
  }, [])

  // Remote surfaces (phone, OSC) drive the same functions the buttons and N do.
  // A ref keeps the registered handlers current without re-registering each render.
  const remoteRef = useRef({ sequences, playingSeq, playing, startSequence, stopSequence, seqNext, seqPrev })
  remoteRef.current = { sequences, playingSeq, playing, startSequence, stopSequence, seqNext, seqPrev }
  useEffect(() => registerSeqHandlers({
    start: v => {
      const r = remoteRef.current
      const i = validSeqIndex(v, r.sequences.length)
      if (i < 0 || r.sequences[i].steps.length === 0) return
      if (r.playing && r.playingSeq === r.sequences[i]) return   // no double start
      r.startSequence(r.sequences[i])
    },
    next: () => { if (remoteRef.current.playing) remoteRef.current.seqNext() },
    prev: () => { if (remoteRef.current.playing) remoteRef.current.seqPrev() },
    stop: () => { if (remoteRef.current.playing) remoteRef.current.stopSequence() },
  }), [])

  // Status for the phone: list + what is playing, pushed on every change
  useEffect(() => {
    pushSeqStatus({
      available: true,
      list: sequences.map(s => ({ name: s.name, steps: s.steps.length })),
      playing: playing && !!playingSeq,
      index: stepIndex,
      total: playingSeq?.steps.length ?? 0,
      name: playingSeq?.name ?? '',
      stepName: playing ? (step?.name ?? '') : '',
    })
  }, [sequences, playing, playingSeq, stepIndex, step])

  const deleteSequence = useCallback((i: number) => {
    const removed = sequences[i]
    if (playingSeq === sequences[i]) stopSequence()
    setEditingIndex(indexAfterRemoval(editingIndex, i))
    const next = sequences.filter((_, j) => j !== i)
    if (!persist(next)) return
    pushToast(`Scaletta "${removed?.name ?? ''}" eliminata (${removed?.steps.length ?? 0} passi)`,
      `seq-del-${i}`, {
        label: 'Annulla',
        fn: () => persist([...next.slice(0, i), removed, ...next.slice(i)]),
      })
  }, [sequences, playingSeq, editingIndex, stopSequence, persist])

  const exportSequences = useCallback(() => {
    const json = JSON.stringify(sequences, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'djtographikz-scalette.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [sequences])

  const importSequences = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const imported = migrateAll(JSON.parse(await file.text()))
        if (imported.length) {
          persist([...sequences, ...imported])
          pushToast(`${imported.length} scalette importate`, undefined, undefined, 'ok')
        } else {
          pushToast('Nessuna scaletta nel file', undefined, undefined, 'err')
        }
      } catch {
        pushToast('File non leggibile', undefined, undefined, 'err')
      }
    }
    input.click()
  }, [sequences, persist])

  return (
    <Panel id="presets" title="Preset & Scalette" group="right">
      <div className="u-col" style={{ gap: '10px' }}>
        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className={`pill${tab === 'presets' ? ' active' : ''}`} title="Mostra i preset salvati" onClick={() => setTab('presets')}>
            Preset ({presets.length})
          </button>
          <button className={`pill${tab === 'playlist' ? ' active' : ''}`} title="Mostra le scalette" onClick={() => setTab('playlist')}>
            Scalette ({sequences.length})
          </button>
        </div>

        {tab === 'presets' && (
          <div className="u-col">
            {/* Save current as preset */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="text"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && savePreset()}
                placeholder="Nome preset…"
                title="Nome del preset da salvare"
                style={{ flex: 1, minWidth: 0 }}
              />
              <button className="btn btn-secondary" title="Salva lo stato corrente come preset" onClick={savePreset} disabled={!presetName.trim()}>
                Salva
              </button>
            </div>

            {/* Preset list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '200px', overflowY: 'auto' }}>
              {presets.map((p, i) => (
                <div key={i} className="row-item" style={{ cursor: 'default' }}>
                  {/* Color dots */}
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                    {p.colors.map((c, j) => (
                      <div key={j} style={{
                        width: '8px', height: '8px', borderRadius: '2px', background: c,
                      }} />
                    ))}
                  </div>
                  <span className="row-title" style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                  <span className="row-sub">{p.effect}</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => applyPreset(p)} title="Applica preset" aria-label="Applica preset">
                    ▶
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    addStep(p.name, p)
                    setTab('playlist')
                  }} title="Aggiungi alla scaletta aperta nell'editor" aria-label="Aggiungi alla scaletta aperta nell'editor">
                    +
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deletePreset(i)} title="Elimina preset" aria-label="Elimina preset">
                    ×
                  </button>
                </div>
              ))}
              {presets.length === 0 && (
                <div className="u-hint" style={{ textAlign: 'center', padding: 'var(--s2)' }}>
                  Nessun preset salvato
                </div>
              )}
            </div>

            {/* Import / Export */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} title="Importa preset da file JSON" onClick={importPresets}>Importa</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} title="Esporta i preset in un file JSON" onClick={exportPresets} disabled={presets.length === 0}>Esporta</button>
            </div>
          </div>
        )}

        {tab === 'playlist' && (
          <div className="u-col">
            {/* Now playing */}
            {playing && playingSeq && step && (
              <div className="active-banner" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div className="active-banner-label">In riproduzione: {playingSeq.name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-primary)', marginTop: '3px' }}>
                  {stepIndex + 1}/{playingSeq.steps.length}: {step.name}
                  {usesHold(playingSeq.mode) && <span className="u-hint"> · {step.hold}{HOLD_LIMITS[playingSeq.mode].unit}</span>}
                  {step.overlays?.length ? <span className="u-hint"> · {step.overlays.length} grafiche</span> : null}
                </div>
                {playingSeq.mode === 'track' && (
                  <div className="u-hint" style={{ marginTop: '2px' }}>
                    in attesa del cambio canzone… (Pro DJ Link o audio; Succ / N per forzare)
                  </div>
                )}
                {playingSeq.mode === 'manual' && (
                  <div className="u-hint" style={{ marginTop: '2px' }}>avanza con Succ / N, indietro con Prec / Shift+N</div>
                )}
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                  <button className="btn btn-secondary btn-sm" title="Passo precedente" onClick={seqPrev}>Prec</button>
                  <button className="btn btn-secondary btn-sm" title="Passo successivo" onClick={seqNext}>Succ</button>
                  <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} title="Ferma la scaletta" onClick={stopSequence}>Stop</button>
                </div>
              </div>
            )}

            {/* ---- Editor ---- */}
            <div className="cat-label" style={{ color: 'var(--accent)' }}>
              {editingIndex >= 0 ? `Modifica: ${sequences[editingIndex]?.name ?? ''}` : 'Nuova scaletta'}
            </div>

            {/* Steps */}
            {draft.steps.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '260px', overflowY: 'auto' }}>
                {draft.steps.map((st, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => { dragFrom.current = i }}
                    onDragOver={e => { e.preventDefault(); setDragOver(i) }}
                    onDragLeave={() => setDragOver(-1)}
                    onDrop={e => {
                      e.preventDefault()
                      setDraft(d => ({ ...d, steps: moveStep(d.steps, dragFrom.current, i) }))
                      dragFrom.current = -1
                      setDragOver(-1)
                    }}
                    onDragEnd={() => { dragFrom.current = -1; setDragOver(-1) }}
                    className="u-col"
                    style={{
                      gap: '3px', padding: '4px 6px', borderRadius: 'var(--r-sm)',
                      background: 'var(--bg1)', cursor: 'grab',
                      outline: dragOver === i ? '1px solid var(--accent)' : 'none',
                    }}
                  >
                    <div className="u-row" style={{ gap: '5px' }}>
                      <span className="u-hint" style={{ width: '14px', flexShrink: 0 }}>{i + 1}.</span>
                      {st.thumb
                        ? <img src={st.thumb} alt="" style={{ width: '32px', height: '18px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }} />
                        : (
                          <div style={{ display: 'flex', gap: '1px', flexShrink: 0 }}>
                            {st.preset.colors.map((c, j) => (
                              <div key={j} style={{ width: '6px', height: '18px', borderRadius: '1px', background: c }} />
                            ))}
                          </div>
                        )}
                      <input
                        type="text"
                        value={st.name}
                        onChange={e => updateStep(i, { name: e.target.value })}
                        title="Nome del passo"
                        style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-xs)' }}
                      />
                      <button className={`btn btn-ghost btn-sm${trialStep === i ? ' active' : ''}`} title={trialStep === i ? 'Togli la prova dallo schermo' : 'Prova: mostra look e grafica di questo passo senza avviare la scaletta'} onClick={() => tryStep(i)} disabled={playing} aria-label="Prova questo passo">{trialStep === i ? '■' : 'Prova'}</button>
                      <button className="btn btn-ghost btn-sm" title="Duplica il passo" onClick={() => duplicateStep(i)} aria-label="Duplica il passo">⧉</button>
                      <button className="btn btn-ghost btn-sm danger" title="Togli il passo" onClick={() => removeStep(i)} aria-label="Togli il passo">×</button>
                    </div>
                    <div className="u-row" style={{ gap: '5px' }}>
                      <span className="u-hint" style={{ width: '14px', flexShrink: 0 }} />
                      {usesHold(draft.mode) ? (
                        <>
                          <span className="u-hint" style={{ flexShrink: 0 }}>tieni</span>
                          <input
                            type="range"
                            min={HOLD_LIMITS[draft.mode].min}
                            max={HOLD_LIMITS[draft.mode].max}
                            step={1}
                            value={st.hold}
                            title={draft.mode === 'timer' ? 'Secondi su questo passo' : 'Beat su questo passo'}
                            onChange={e => updateStep(i, { hold: clampHold(parseInt(e.target.value), draft.mode) })}
                            style={{ flex: 1 }}
                          />
                          <span className="u-value" style={{ width: '32px', flexShrink: 0 }}>
                            {st.hold}{HOLD_LIMITS[draft.mode].unit}
                          </span>
                        </>
                      ) : (
                        <span className="u-hint" style={{ flex: 1 }}>
                          {draft.mode === 'track' ? 'fino alla prossima canzone' : 'fino ad Avanti'}
                        </span>
                      )}
                      <select
                        value={st.transition ?? ''}
                        title="Transizione con cui entrare in questo passo"
                        onChange={e => updateStep(i, { transition: (e.target.value || undefined) as TransitionType | undefined })}
                        style={{ fontSize: 'var(--fs-xs)', flexShrink: 0 }}
                      >
                        <option value="">transizione: come impostata</option>
                        {TRANSITIONS.map(t => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    {/* Graphics: the images / GIFs / text that come up with this step */}
                    <div className="u-row" style={{ gap: '5px', alignItems: 'flex-start' }}>
                      <span className="u-hint" style={{ width: '14px', flexShrink: 0 }} />
                      <span className="u-hint" style={{ flexShrink: 0 }}>grafica</span>
                      <div className="seq-chips">
                        {(st.overlays ?? []).map((ov, k) => (
                          <span key={k} className="seq-chip" title={ov.kind === 'text' ? `Testo: ${ov.text}` : ov.path ?? ov.name}>
                            <span>{ov.kind === 'text' ? '"' + ov.name + '"' : ov.name}</span>
                            <button className="btn btn-ghost btn-sm danger" title="Togli questa grafica dal passo" aria-label="Togli questa grafica dal passo" onClick={() => removeStepOverlay(i, k)}>✕</button>
                          </span>
                        ))}
                        {!st.overlays?.length && <span className="u-hint">nessuna</span>}
                      </div>
                      <button className={`btn btn-ghost btn-sm${pickerFor === i ? ' active' : ''}`} title="Aggiungi una grafica a questo passo" aria-label="Aggiungi una grafica a questo passo" onClick={() => openPicker(i)}>＋</button>
                    </div>
                    {pickerFor === i && (
                      <div className="u-col seq-picker">
                        <div className="u-row" style={{ gap: '4px' }}>
                          <input
                            type="text"
                            value={stepText}
                            onChange={e => setStepText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && graphicFromText(i)}
                            placeholder="Testo…"
                            title="Testo che compare con questo passo (Invio per aggiungere)"
                            style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-xs)' }}
                          />
                          <input type="color" value={stepTextColor} onChange={e => setStepTextColor(e.target.value)} title="Colore del testo" style={{ width: '26px', padding: 0 }} />
                          <button className="btn btn-secondary btn-sm" title="Aggiungi il testo al passo" onClick={() => graphicFromText(i)} disabled={!stepText.trim()}>Testo</button>
                          <button className="btn btn-secondary btn-sm" title="Scegli un file PNG/JPG/GIF/WebP: finisce anche nella libreria" onClick={() => graphicFromFile(i)}>File…</button>
                        </div>
                        {library.map(item => (
                          <button key={item.path} type="button" className="btn media-lib-item" title={`Aggiungi "${item.name}" al passo`} onClick={() => graphicFromLibrary(i, item)}>
                            <span className="media-lib-name">{item.name}</span>
                            <span className="media-badge">{/\.gif$/i.test(item.name) ? 'GIF' : 'IMG'}</span>
                          </button>
                        ))}
                        {library.length === 0 && <span className="u-hint">Libreria vuota: importa un file o aggiungi un testo</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {draft.steps.length === 0 && (
              <div className="u-hint" style={{ textAlign: 'center', padding: '4px' }}>
                Aggiungi il look sullo schermo, uno dal Look Bank, o premi + su un preset
              </div>
            )}

            {/* Add steps */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} title="Aggiunge quello che si vede adesso, con la sua miniatura" onClick={addCurrentLook} disabled={!engine}>
                + look corrente
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} title="Scegli da quelli salvati nel Look Bank" onClick={() => {
                setLooks(loadLooks())
                setShowLookPicker(v => !v)
              }}>
                + dal Look Bank
              </button>
            </div>

            {showLookPicker && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
                {looks.map((l, i) => l && (
                  <button
                    key={i}
                    className="btn btn-secondary"
                    title={`Aggiungi "${l.name}" alla scaletta`}
                    onClick={() => { addStep(l.name, l.preset, l.thumb); setShowLookPicker(false) }}
                    style={{ padding: '2px', height: '34px', overflow: 'hidden' }}
                  >
                    {l.thumb
                      ? <img src={l.thumb} alt={l.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '2px' }} />
                      : <span style={{ fontSize: 'var(--fs-xs)' }}>{l.name}</span>}
                  </button>
                ))}
                {looks.every(l => !l) && (
                  <div className="u-hint" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4px' }}>
                    Look Bank vuoto
                  </div>
                )}
              </div>
            )}

            {/* Advance mode + default hold + loop */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {(Object.keys(MODE_LABELS) as SequenceMode[]).map(m => (
                <button key={m} className={`pill${draft.mode === m ? ' active' : ''}`} onClick={() => setMode(m)} title={
                  m === 'timer' ? 'Le durate sono in secondi'
                    : m === 'beats' ? 'Le durate sono in beat, agganciate alla musica'
                      : m === 'track' ? 'Un passo per canzone: avanza quando il DJ cambia traccia'
                        : 'Avanza solo con Succ / N'
                }>
                  {MODE_LABELS[m]}
                </button>
              ))}
              <button className={`pill${draft.loop ? ' active' : ''}`} title="Alla fine ricomincia da capo" onClick={() => setDraft(d => ({ ...d, loop: !d.loop }))}>
                Loop
              </button>
            </div>
            {usesHold(draft.mode) && (
              <SliderRow
                label="Durata nuovi" suffix={HOLD_LIMITS[draft.mode].unit}
                value={draft.defaultHold}
                min={HOLD_LIMITS[draft.mode].min}
                max={HOLD_LIMITS[draft.mode].max}
                step={1}
                title="Durata data ai passi aggiunti da qui in avanti"
                onChange={v => setDraft(d => ({ ...d, defaultHold: clampHold(v, d.mode) }))}
              />
            )}

            {draft.steps.length > 0 && (
              <div className="u-hint" style={{ textAlign: 'right' }}>
                {draft.steps.length} passi{usesHold(draft.mode) ? ` · durata totale ${totalHold(draft)}${HOLD_LIMITS[draft.mode].unit}` : ''}
              </div>
            )}

            {/* Save */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="text"
                value={draft.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && saveDraft()}
                placeholder="Nome scaletta…"
                title="Nome della scaletta"
                style={{ flex: 1, minWidth: 0 }}
              />
              <button className="btn btn-secondary" title={editingIndex >= 0 ? 'Salva sopra questa scaletta' : 'Salva la scaletta'} onClick={() => saveDraft()} disabled={!draft.name.trim() || draft.steps.length === 0}>
                Salva
              </button>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} title="Salva come una scaletta nuova, lasciando intatta quella aperta" onClick={() => saveDraft(true)} disabled={!draft.name.trim() || draft.steps.length === 0}>
                Salva come nuova
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} title="Svuota l'editor" onClick={newDraft} disabled={draft.steps.length === 0 && !draft.name}>
                Svuota
              </button>
            </div>

            {/* Saved sequences */}
            <div className="cat-label" style={{ color: 'var(--accent)', marginTop: '4px' }}>
              Scalette salvate
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '150px', overflowY: 'auto' }}>
              {sequences.map((seq, i) => (
                <div key={i} className={`row-item${playingSeq === seq ? ' active' : ''}`} style={{ cursor: 'default' }}>
                  <span className="row-title" style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {seq.name}
                  </span>
                  <span className="row-sub">
                    {seq.steps.length} passi · {usesHold(seq.mode) ? `${totalHold(seq)}${HOLD_LIMITS[seq.mode].unit}` : MODE_LABELS[seq.mode].toLowerCase()}
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => startSequence(seq)} title="Avvia la scaletta" aria-label="Avvia la scaletta">▶</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => editSequence(i)} title="Apri nell'editor" aria-label="Apri nell'editor">✎</button>
                  <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteSequence(i)} title="Elimina la scaletta" aria-label="Elimina la scaletta">×</button>
                </div>
              ))}
              {sequences.length === 0 && (
                <div className="u-hint" style={{ textAlign: 'center', padding: 'var(--s2)' }}>
                  Nessuna scaletta salvata
                </div>
              )}
            </div>

            {/* Import / Export */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} title="Importa scalette da file JSON" onClick={importSequences}>Importa</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} title="Esporta le scalette in un file JSON" onClick={exportSequences} disabled={sequences.length === 0}>Esporta</button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
