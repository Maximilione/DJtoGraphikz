// Sequence playback lives at App level: the phone (and OSC) must be able to run
// a sequence in Live mode too, where PresetPanel is not mounted. PresetPanel is
// only a view of this state plus the editor.
import { useState, useCallback, useEffect, useRef } from 'react'
import { readJson, writeJson } from '../../storage'
import type { Engine } from '@engine/Engine'
import { migrateAll, nextIndex, manualStep, validSeqIndex, type Sequence, type SequenceStep } from './sequences'
import { registerSeqHandlers, pushSeqStatus } from './seqRemote'
import { enterStep, clearStepOverlays } from './sequencePlayer'
import { readLibraryImage } from '../OverlayPanel/OverlayPanel'
import { shouldIgnoreHotkey } from '../../hotkeys'

const STORAGE_KEY_PLAYLISTS = 'djtographikz-playlists'

function loadSequences(): Sequence[] {
  // migrate(): playlists saved before per-step holds existed still load
  return migrateAll(readJson<unknown[]>(STORAGE_KEY_PLAYLISTS, []))
}

export function useSequencePlayer(engine: Engine | null) {
  const [sequences, setSequences] = useState<Sequence[]>(loadSequences)
  const [playingSeq, setPlayingSeq] = useState<Sequence | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timerRef = useRef<number>(0)
  const beatCountRef = useRef(0)

  const step: SequenceStep | undefined = playingSeq?.steps[stepIndex]

  /** disk first, then the screen — false means nothing was written */
  const persist = useCallback((list: Sequence[]): boolean => {
    if (!writeJson(STORAGE_KEY_PLAYLISTS, list)) return false
    setSequences(list)
    return true
  }, [])

  const advance = useCallback(() => {
    // The next index is computed here, not inside the state updater: React may
    // run an updater more than once, and stopping playback from inside one made
    // the end of a sequence depend on how many times that happened
    setStepIndex(p => {
      const n = nextIndex(p, playingSeq?.steps.length ?? 0, playingSeq?.loop ?? false)
      if (n < 0) {
        queueMicrotask(() => setPlaying(false))   // end of a non-looping run
        return p
      }
      return n
    })
  }, [playingSeq])

  const prev = useCallback(() => {
    setStepIndex(p => manualStep(p, playingSeq?.steps.length ?? 0, playingSeq?.loop ?? false, -1))
  }, [playingSeq])

  const next = useCallback(() => {
    setStepIndex(p => manualStep(p, playingSeq?.steps.length ?? 0, true, 1))  // manual skip always wraps
  }, [playingSeq])

  const start = useCallback((seq: Sequence) => {
    if (seq.steps.length === 0) return
    setPlayingSeq(seq)
    setStepIndex(0)
    setPlaying(true)
  }, [])

  const stop = useCallback(() => {
    setPlaying(false)
    setPlayingSeq(null)
  }, [])

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

  // Track advance — one step per song, on Engine.onTrackChange
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
      if (e.shiftKey) prev(); else next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, prev, next])

  // Remote surfaces (phone, OSC) drive the same functions the buttons and N do.
  // A ref keeps the registered handlers current without re-registering each render.
  const remoteRef = useRef({ sequences, playingSeq, playing, start, stop, next, prev })
  remoteRef.current = { sequences, playingSeq, playing, start, stop, next, prev }
  useEffect(() => registerSeqHandlers({
    start: v => {
      const r = remoteRef.current
      const i = validSeqIndex(v, r.sequences.length)
      if (i < 0 || r.sequences[i].steps.length === 0) return
      if (r.playing && r.playingSeq === r.sequences[i]) return   // no double start
      r.start(r.sequences[i])
    },
    next: () => { if (remoteRef.current.playing) remoteRef.current.next() },
    prev: () => { if (remoteRef.current.playing) remoteRef.current.prev() },
    stop: () => { if (remoteRef.current.playing) remoteRef.current.stop() },
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

  return { sequences, persist, playingSeq, stepIndex, playing, step, start, stop, next, prev }
}

export type SequencePlayer = ReturnType<typeof useSequencePlayer>
