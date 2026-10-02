// Bridge between the sequence player (PresetPanel) and remote surfaces.
// PresetPanel owns the playback state and registers handlers while mounted;
// App's dispatchCmd routes seq* commands here; the status goes to the phone
// the same way the AutoVJ status does (remote:vj).

export interface SeqHandlers {
  start: (index: number) => void
  next: () => void
  prev: () => void
  stop: () => void
}

export interface SeqStatus {
  /** false when the panel is not mounted (live mode): the phone says so */
  available: boolean
  list: { name: string; steps: number }[]
  playing: boolean
  index: number
  total: number
  name: string
  stepName: string
}

const NONE: SeqStatus = { available: false, list: [], playing: false, index: 0, total: 0, name: '', stepName: '' }
let handlers: SeqHandlers | null = null

export function pushSeqStatus(s: SeqStatus) {
  try { window.api?.sendRemoteSeq(s) } catch (_) {}
}

export function registerSeqHandlers(h: SeqHandlers): () => void {
  handlers = h
  return () => {
    if (handlers !== h) return
    handlers = null
    pushSeqStatus(NONE)
  }
}

/** Returns false when the command is not a seq one, or nobody can take it. */
export function seqCommand(type: string, value: unknown): boolean {
  if (!handlers) return false
  switch (type) {
    case 'seqStart': handlers.start(value as number); return true
    case 'seqNext': handlers.next(); return true
    case 'seqPrev': handlers.prev(); return true
    case 'seqStop': handlers.stop(); return true
  }
  return false
}
