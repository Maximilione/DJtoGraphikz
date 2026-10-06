// Pure choice logic for audio inputs, shared by the renderer (panels) and the
// engine (AudioAnalyzer's own recovery) — the engine must not import the renderer.

type Dev = { label: string; deviceId: string }

// The system's own microphone, in the labels macOS and Windows give it. An
// external card (a console's interface, a USB mixer) is never called this.
const BUILT_IN = /built-?in|incorporat|internal|interno|predefinit|\bmac(book)?\b|imac|mac (mini|studio|pro)|^(default|communications)\b/i
// Chromium labels the default entry "Default - <real device>": judge the device behind it
const DEFAULT_PREFIX = /^(default|communications|predefinit\w*)\s*-\s*/i

/** A track/device label alone (the "Default - " alias is looked through). */
export function isBuiltInLabel(label: string): boolean {
  return BUILT_IN.test(label.replace(DEFAULT_PREFIX, ''))
}

export function isBuiltIn(d: Dev): boolean {
  return d.deviceId === 'default' || d.deviceId === 'communications' || isBuiltInLabel(d.label)
}

/** First real external card. Unlabelled entries (no mic permission yet) are not trusted. */
export function findExternal<T extends Dev>(devices: T[]): T | undefined {
  return devices.find(d => d.label && !isBuiltIn(d))
}

/**
 * Which input to use. The list's first entry is the system default, which on
 * a laptop is the built-in microphone: taking `[0]` put the music on the room
 * mic in front of a console with a sound card plugged in. A saved choice that
 * is still there and is an external card stays; the built-in microphone gives
 * way to an external card when there is one; a saved id that is gone falls
 * back to the best available.
 */
export function pickInput(devices: Dev[], saved = ''): string {
  const kept = devices.find(d => d.deviceId === saved)
  const external = findExternal(devices)
  if (kept && !(isBuiltIn(kept) && external)) return kept.deviceId
  return (external ?? devices[0])?.deviceId ?? ''
}

/**
 * Backoff for the automatic restart. `failures` = consecutive failed attempts so far.
 * Log on the first failure and then every 10th (a card gone for a night must not
 * flood the console); after the 5th failure try the system default once, even when
 * no id is remembered — a half-dead card must not keep the music silent.
 */
export function restartPlan(failures: number): { delayMs: number; log: boolean; tryDefault: boolean } {
  return {
    delayMs: Math.min(30_000, 1000 * 2 ** failures),
    log: failures <= 1 || failures % 10 === 0,
    tryDefault: failures === 5,
  }
}
