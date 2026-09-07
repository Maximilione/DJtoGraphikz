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
