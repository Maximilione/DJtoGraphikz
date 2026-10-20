// Device labels are hidden until the page has been granted microphone access,
// so every panel that lists inputs used to call getUserMedia itself. Two of
// them mount together on first launch and macOS put up TWO permission dialogs.
// One shared request, reused by everyone — and none at all when the labels
// are already readable: opening and closing the default input for nothing
// can flip a Bluetooth headset to its phone profile right as AudioAnalyzer
// opens the card.

let unlock: Promise<void> | null = null

/** Make the input labels readable, asking for microphone access at most once per session. */
export function ensureMicAccess(): Promise<void> {
  if (!unlock) {
    unlock = navigator.mediaDevices.enumerateDevices()
      .then(all => {
        if (all.some(d => d.kind === 'audioinput' && d.label)) return
        return navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => { stream.getTracks().forEach(t => t.stop()) })
      })
      .catch(err => {
        unlock = null   // a denial must not poison later attempts
        throw err
      })
  }
  return unlock
}

let inflight: Promise<MediaDeviceInfo[]> | null = null
let dirty = false

/**
 * Audio inputs with real labels (requests access once if needed). Concurrent
 * callers share one enumeration — a hotplug fires devicechange in a burst,
 * and two lists resolving out of order left the panel on the stale one. A
 * call that lands while one is running gets a fresh read after it.
 */
export function listAudioInputs(): Promise<MediaDeviceInfo[]> {
  if (inflight) { dirty = true; return inflight }
  const run = async (): Promise<MediaDeviceInfo[]> => {
    await ensureMicAccess()
    let all = await navigator.mediaDevices.enumerateDevices()
    while (dirty) {
      dirty = false
      all = await navigator.mediaDevices.enumerateDevices()
    }
    return all.filter(d => d.kind === 'audioinput')
  }
  dirty = false
  inflight = run().finally(() => { inflight = null })
  return inflight
}

export { pickInput } from '../shared/audioInput'
