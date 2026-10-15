import { useEffect, useRef } from 'react'

// #9 resource respect — four setInterval polls (audio status, phone-remote
// push, audio-running check, "N min fa" label) ran forever even with the
// control window minimized or in the background, same as the gamepad and
// spectrum loops already gate themselves on their own feature being active.
// This gates on the OS-level window instead: paused whenever
// document.visibilityState isn't 'visible', resumed the moment it is again
// (firing once immediately on resume so the UI isn't stale for up to a full
// interval).

export function useVisibleInterval(callback: () => void, ms: number | null) {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    if (ms === null) return
    let id: number | undefined
    const start = () => { id = window.setInterval(() => cbRef.current(), ms) }
    const stop = () => { if (id !== undefined) { clearInterval(id); id = undefined } }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { cbRef.current(); start() }
      else stop()
    }
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [ms])
}
