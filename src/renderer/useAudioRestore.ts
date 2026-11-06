import { useEffect, useRef } from 'react'
import { pushToast } from './components/Toasts/Toasts'
import type { Engine } from '@engine/Engine'
import type { BpmMode } from '@engine/audio/AudioAnalyzer'
import { readJson } from './storage'
import { listAudioInputs, pickInput } from './audioDevices'
// one source of truth: a venue profile rewrites this very store (P2)
import { AUDIO_STORE_KEY } from './venues'

/** What AudioPanel persists; read here at start, by the panel for its controls. */
export interface SavedAudioSettings {
  deviceId?: string
  bpmMode?: BpmMode
  manualBpm?: number
  sensitivity?: number
  inputGain?: number
  running?: boolean
}

export function loadAudioSettings(): SavedAudioSettings {
  // `?? {}` and not a `{}` fallback: older builds could store a literal `null`.
  return readJson<SavedAudioSettings | null>(AUDIO_STORE_KEY, null) ?? {}
}

/**
 * Restore last session's audio: sensitivity, gain, BPM mode and tempo into
 * the analyser, and if audio was running on a saved device, start it again.
 *
 * Headless and mounted by App, in every layout. It used to be an effect of
 * AudioPanel, which Live mode does not mount: an app restarted in Live had no
 * beat, no BPM, a silent Auto VJ and dark DMX until Pro was opened once.
 *
 * `epoch` is bumped when a venue profile rewrites the store: the hook runs
 * again and moves the analyser to the profile's input. The condition is "not
 * on that device", not "not running" — after a profile load the analyser is
 * already running, on the previous room's sound card.
 *
 * The first run uses the store as it was when App rendered, before any child
 * effect: the engine arrives later, and AudioPanel's persist effect writes
 * {running:false} 250 ms after it mounts — read then, the saved input would
 * never start again (and would stay off next launch too). Later epochs are a
 * profile's own rewrite, read fresh.
 */
export function useAudioRestore(engine: Engine | null, epoch: number) {
  // read synchronously on App's first render, ahead of every child's effects
  const boot = useRef<{ epoch: number; s: SavedAudioSettings } | null>(null)
  if (!boot.current) boot.current = { epoch, s: loadAudioSettings() }
  useEffect(() => {
    if (!engine) return
    const a = engine.audioAnalyzer
    const s = epoch === boot.current!.epoch ? boot.current!.s : loadAudioSettings()
    // start() rebuilds the audio graph: the settings go in after it as well
    const apply = () => {
      a.setSensitivity(s.sensitivity ?? 0.5)
      a.setInputGain(s.inputGain ?? 1.0)
      a.setBpmMode(s.bpmMode ?? 'auto')
      a.setManualBpm(s.manualBpm ?? 128)
    }
    apply()
    // A file under analysis is not a room's sound card: switching to the
    // profile's input there would yank the track being tested.
    if (!s.running || !s.deviceId || a.getSourceKind() === 'file') return
    // Listing inputs can wait on the permission dialog: anyone who started or
    // stopped the analyser meanwhile (Onboarding, the Stop button) has the
    // last word, and so does a newer run of this hook.
    const gen = a.generation
    let stale = false
    // The saved id can be the built-in mic from a rehearsal: choose again
    // from what is plugged in now, before starting on it.
    listAudioInputs().catch(() => [] as MediaDeviceInfo[]).then(inputs => {
      if (stale || a.generation !== gen) return
      const id = inputs.length ? pickInput(inputs, s.deviceId) : (s.deviceId ?? '')
      if (a.currentDeviceId === id) return
      return a.start(id).then(apply)
    }).catch((err: unknown) => {
      console.warn('[Audio] ripristino ingresso fallito:', err)
      // Live has no Audio panel: a grey dot was the only sign
      pushToast('Ingresso audio non avviato: controlla la scheda o il permesso microfono', 'audio-restore', undefined, 'err')
    })
    return () => { stale = true }
  }, [engine, epoch])
}
