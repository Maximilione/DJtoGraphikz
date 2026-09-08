import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { Engine, Preset, EffectId, PostId, TransitionType } from '@engine/Engine'
import { loadLooks, makeThumb, type SavedLook } from '../../looks'
import {
  migrateAll, migrate, clampHold, nextIndex, prevIndex, moveStep, totalHold, indexAfterRemoval,
  HOLD_LIMITS, type Sequence, type SequenceStep,
} from './sequences'
import { usePanelCollapsed } from '../usePanelCollapsed'
import { pushToast } from '../Toasts/Toasts'

interface PresetPanelProps {
  engine: Engine | null
}

const STORAGE_KEY_PRESETS = 'djtographikz-presets'
const STORAGE_KEY_PLAYLISTS = 'djtographikz-playlists'

function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRESETS)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function savePresetsToStorage(presets: Preset[]) {
  // Presets carry custom shaders and every effect's params: over quota this
  // throws from inside a click handler, after React already showed the preset
  // in the list — the user would only find out on the next launch
  try {
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets))
  } catch {
    pushToast('Spazio esaurito: il preset non è stato salvato su disco')
  }
}

function loadSequences(): Sequence[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLAYLISTS)
    // migrate(): playlists saved before per-step holds existed still load
    return migrateAll(raw ? JSON.parse(raw) : [])
  } catch { return [] }
}

function saveSequencesToStorage(playlists: Sequence[]) {
  try {
    localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(playlists))
  } catch {
    pushToast('Spazio esaurito: la playlist non è stata salvata su disco')
  }
}

export function PresetPanel({ engine }: PresetPanelProps) {
  const [collapsed, toggleCollapsed] = usePanelCollapsed('presets', false, 'right')
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

  // Apply the step's look (and its transition, when it names one)
  useEffect(() => {
    if (!playing || !engine || !step) return
    if (step.transition) engine.setTransitionType(step.transition)
    engine.applyPreset(step.preset)
  }, [step, playing, engine])

  // Save preset
  const savePreset = useCallback(() => {
    if (!engine || !presetName.trim()) return
    const preset = engine.createPreset(presetName.trim())
    const next = [...presets, preset]
    setPresets(next)
    savePresetsToStorage(next)
    setPresetName('')
  }, [engine, presetName, presets])

  // Apply preset
  const applyPreset = useCallback((preset: Preset) => {
    if (!engine) return
    engine.applyPreset(preset)
  }, [engine])

  // Delete preset
  const deletePreset = useCallback((index: number) => {
    const next = presets.filter((_, i) => i !== index)
    setPresets(next)
    savePresetsToStorage(next)
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

  const persist = useCallback((next: Sequence[]) => {
    setSequences(next)
    saveSequencesToStorage(next)
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

  /** Switching unit re-clamps every hold — 60s is fine, 60 beats is not always */
  const setMode = useCallback((mode: 'timer' | 'beats') => {
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
      persist(sequences.map((s, i) => (i === editingIndex ? seq : s)))
      pushToast(`Scaletta "${name}" aggiornata`)
    } else {
      persist([...sequences, seq])
      setEditingIndex(sequences.length)
      pushToast(`Scaletta "${name}" salvata`)
    }
  }, [draft, editingIndex, sequences, persist])

  // ---- Playback ----

  const startSequence = useCallback((seq: Sequence) => {
    if (seq.steps.length === 0) return
    setPlayingSeq(seq)
    setStepIndex(0)
    setPlaying(true)
  }, [])

  const stopSequence = useCallback(() => {
    setPlaying(false)
    setPlayingSeq(null)
  }, [])

  const deleteSequence = useCallback((i: number) => {
    if (playingSeq === sequences[i]) stopSequence()
    setEditingIndex(indexAfterRemoval(editingIndex, i))
    persist(sequences.filter((_, j) => j !== i))
  }, [sequences, playingSeq, editingIndex, stopSequence, persist])

  const seqPrev = useCallback(() => {
    setStepIndex(prev => {
      const p = prevIndex(prev, playingSeq?.steps.length ?? 0, playingSeq?.loop ?? false)
      return p < 0 ? prev : p
    })
  }, [playingSeq])

  const seqNext = useCallback(() => {
    setStepIndex(prev => {
      const n = nextIndex(prev, playingSeq?.steps.length ?? 0, true)  // manual skip always wraps
      return n < 0 ? prev : n
    })
  }, [playingSeq])

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
          pushToast(`${imported.length} scalette importate`)
        } else {
          pushToast('Nessuna scaletta nel file')
        }
      } catch {
        pushToast('File non leggibile')
      }
    }
    input.click()
  }, [sequences, persist])

  return (
    <div className="panel">
      <div
        className="panel-header"
        onClick={toggleCollapsed}
        title={collapsed ? 'Espandi Preset & Scalette' : 'Comprimi Preset & Scalette'}
      >
        <span>Preset & Scalette</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
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
                    <button className="btn btn-secondary btn-sm" onClick={() => applyPreset(p)} title="Applica preset">
                      ▶
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                      addStep(p.name, p)
                      setTab('playlist')
                    }} title="Aggiungi alla scaletta aperta nell'editor">
                      +
                    </button>
                    <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deletePreset(i)} title="Elimina preset">
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
                    <span className="u-hint"> · {step.hold}{HOLD_LIMITS[playingSeq.mode].unit}</span>
                  </div>
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
                        <button className="tiny-btn" title="Applica ora questo passo" onClick={() => engine?.applyPreset(st.preset)}>▶</button>
                        <button className="tiny-btn" title="Duplica il passo" onClick={() => duplicateStep(i)}>⧉</button>
                        <button className="tiny-btn danger" title="Togli il passo" onClick={() => removeStep(i)}>×</button>
                      </div>
                      <div className="u-row" style={{ gap: '5px' }}>
                        <span className="u-hint" style={{ width: '14px', flexShrink: 0 }} />
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
                        <select
                          value={st.transition ?? ''}
                          title="Transizione con cui entrare in questo passo"
                          onChange={e => updateStep(i, { transition: (e.target.value || undefined) as TransitionType | undefined })}
                          style={{ fontSize: 'var(--fs-xs)', flexShrink: 0 }}
                        >
                          <option value="">transizione: come impostata</option>
                          <option value="crossfade">crossfade</option>
                          <option value="wipe-left">wipe orizzontale</option>
                          <option value="wipe-down">wipe verticale</option>
                          <option value="radial">radiale</option>
                          <option value="dissolve">dissolvenza</option>
                        </select>
                      </div>
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

              {/* Unit + default hold + loop */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button className={`pill${draft.mode === 'timer' ? ' active' : ''}`} title="Le durate sono in secondi" onClick={() => setMode('timer')}>
                  Secondi
                </button>
                <button className={`pill${draft.mode === 'beats' ? ' active' : ''}`} title="Le durate sono in beat, agganciate alla musica" onClick={() => setMode('beats')}>
                  Beat
                </button>
                <button className={`pill${draft.loop ? ' active' : ''}`} title="Alla fine ricomincia da capo" onClick={() => setDraft(d => ({ ...d, loop: !d.loop }))}>
                  Loop
                </button>
              </div>
              <div className="u-row">
                <span className="u-hint" style={{ width: '74px', flexShrink: 0 }}>Durata nuovi</span>
                <input
                  type="range"
                  min={HOLD_LIMITS[draft.mode].min}
                  max={HOLD_LIMITS[draft.mode].max}
                  step={1}
                  value={draft.defaultHold}
                  title="Durata data ai passi aggiunti da qui in avanti"
                  onChange={e => setDraft(d => ({ ...d, defaultHold: clampHold(parseInt(e.target.value), d.mode) }))}
                  style={{ flex: 1 }}
                />
                <span className="u-value" style={{ width: '32px', flexShrink: 0 }}>
                  {draft.defaultHold}{HOLD_LIMITS[draft.mode].unit}
                </span>
              </div>

              {draft.steps.length > 0 && (
                <div className="u-hint" style={{ textAlign: 'right' }}>
                  {draft.steps.length} passi · durata totale {totalHold(draft)}{HOLD_LIMITS[draft.mode].unit}
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
                      {seq.steps.length} passi · {totalHold(seq)}{HOLD_LIMITS[seq.mode].unit}
                    </span>
                    <button className="btn btn-secondary btn-sm" onClick={() => startSequence(seq)} title="Avvia la scaletta">▶</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => editSequence(i)} title="Apri nell'editor">✎</button>
                    <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteSequence(i)} title="Elimina la scaletta">×</button>
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
      )}
    </div>
  )
}
