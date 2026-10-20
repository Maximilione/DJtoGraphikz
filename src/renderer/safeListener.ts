/**
 * Engine.onAudioFrame runs its listeners inside renderFrame without isolating
 * them: an exception in one skips the rest of that frame — track change,
 * beat-synced transitions, the render itself — and repeats sixty times a
 * second until the cause goes away. The engine belongs to the other team;
 * this guards the renderer's own listeners. One log line every 5 s at most,
 * never one per frame.
 */
export function guardListener<A extends unknown[]>(tag: string, fn: (...a: A) => void): (...a: A) => void {
  let errors = 0
  let lastLog = -Infinity
  return (...a: A) => {
    try {
      fn(...a)
    } catch (e) {
      errors++
      const now = performance.now()
      if (now - lastLog < 5000) return
      lastLog = now
      console.error(`[${tag}] listener (${errors} errori):`, e)
      const text = e instanceof Error ? e.stack ?? e.message : String(e)
      try { window.api?.logToFile?.(tag, `[${tag}] listener (${errors}): ${text}`) } catch { /* no bridge */ }
    }
  }
}
