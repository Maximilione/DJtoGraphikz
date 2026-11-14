// Pure choice logic for audio inputs, shared by the renderer (panels) and the
// engine (AudioAnalyzer's own recovery) — the engine must not import the renderer.

type Dev = { label: string; deviceId: string }

// The system's own microphone, in the labels macOS and Windows give it. An
// external card (a console's interface, a USB mixer) is never called this.
// (Windows lists the laptop's own codec by chip name: "Microphone (Realtek(R) Audio)", "Microphone Array")
const BUILT_IN = /built-?in|integrat|incorporat|internal|interno|predefinit|\bmac(book)?\b|imac|mac (mini|studio|pro)|realtek|microphone array|array microfon|conexant|smart sound|^(default|communications)\b/i
// Headsets: neither the room mic nor a sound card. Never worth switching to (the
// headset profile drops the sample rate and the output with it), never a reason to switch away.
const BLUETOOTH = /airpods|bluetooth|\bbeats\b|\bbuds\b|hands-?free|headset|\bhfp\b/i
// Call apps' virtual mics (Teams, Zoom, Webex...): capturing one wakes that app's
// microphone. Never picked automatically; still selectable by hand.
const VIRTUAL_CALL = /teams|zoom|webex|krisp|discord|skype|slack|google meet|nvidia broadcast|camo/i
// Chromium labels the default entry "Default - <real device>": judge the device behind it
const DEFAULT_PREFIX = /^(default|communications|predefinit\w*)\s*-\s*/i

/** A track/device label alone (the "Default - " alias is looked through). */
export function isBuiltInLabel(label: string): boolean {
  return BUILT_IN.test(label.replace(DEFAULT_PREFIX, ''))
}

export function isBuiltIn(d: Dev): boolean {
  return d.deviceId === 'default' || d.deviceId === 'communications' || isBuiltInLabel(d.label)
}

export function isBluetoothLabel(label: string): boolean {
  return BLUETOOTH.test(label)
}

export function isVirtualCallLabel(label: string): boolean {
  return VIRTUAL_CALL.test(label)
}

/** First real external card. Unlabelled entries (no mic permission yet) and headsets are not trusted. */
export function findExternal<T extends Dev>(devices: T[]): T | undefined {
  return devices.find(d => d.label && !isBuiltIn(d) && !isBluetoothLabel(d.label) && !isVirtualCallLabel(d.label))
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
  // a saved call-app mic (often left over from an automatic pick) gives way too
  if (kept && !(isBuiltIn(kept) && external) && !isVirtualCallLabel(kept.label)) return kept.deviceId
  // the system default can itself be a call app's mic ("Default - Microsoft Teams Audio")
  const fallback = devices.find(d => !isVirtualCallLabel(d.label)) ?? devices[0]
  return (external ?? fallback)?.deviceId ?? ''
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
