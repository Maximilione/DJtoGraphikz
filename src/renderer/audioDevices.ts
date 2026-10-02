// Device labels are hidden until the page has been granted microphone access,
// so every panel that lists inputs used to call getUserMedia itself. Two of
// them mount together on first launch and macOS put up TWO permission dialogs.
// One shared request, reused by everyone.

let unlock: Promise<void> | null = null

/** Ask for microphone access at most once per session. */
export function ensureMicAccess(): Promise<void> {
  if (!unlock) {
    unlock = navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(stream => { stream.getTracks().forEach(t => t.stop()) })
      .catch(err => {
        unlock = null   // a denial must not poison later attempts
        throw err
      })
  }
  return unlock
}

/** Audio inputs with real labels (requests access once if needed). */
export async function listAudioInputs(): Promise<MediaDeviceInfo[]> {
  await ensureMicAccess()
  const all = await navigator.mediaDevices.enumerateDevices()
  return all.filter(d => d.kind === 'audioinput')
}

// The system's own microphone, in the labels macOS and Windows give it. An
// external card (a console's interface, a USB mixer) is never called this.
const BUILT_IN = /built-?in|incorporat|internal|interno|predefinit|\bmac(book)?\b|imac|mac (mini|studio|pro)|^(default|communications)\b/i

export function isBuiltIn(d: Pick<MediaDeviceInfo, 'label' | 'deviceId'>): boolean {
  return d.deviceId === 'default' || d.deviceId === 'communications' || BUILT_IN.test(d.label)
}

/**
 * Which input to use. The list's first entry is the system default, which on
 * a laptop is the built-in microphone: taking `[0]` put the music on the room
 * mic in front of a console with a sound card plugged in. A saved choice that
 * is still there and is an external card stays; the built-in microphone gives
 * way to an external card when there is one; a saved id that is gone falls
 * back to the best available.
 */
export function pickInput(devices: MediaDeviceInfo[], saved = ''): string {
  const kept = devices.find(d => d.deviceId === saved)
  const external = devices.find(d => !isBuiltIn(d))
  if (kept && !(isBuiltIn(kept) && external)) return kept.deviceId
  return (external ?? devices[0])?.deviceId ?? ''
}
