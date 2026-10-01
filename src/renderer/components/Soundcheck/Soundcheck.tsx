import React, { useEffect, useState } from 'react'
import type { Engine } from '@engine/Engine'
import { readJson } from '../../storage'
import { DMX_STORE_KEY } from '../../venues'
import {
  INPUT_WINDOW_S, judgeDisk, judgeDmx, judgeFps, judgeInput, judgeOutput, judgeRemote, worst, type Row,
} from '../../soundcheck'

interface SoundcheckProps {
  engine: Engine | null
  /** the projector resolution the fps row is measured at, e.g. "1920x1080" */
  outputRes: string
  onClose: () => void
}

const NAMES: Record<string, string> = {
  input: 'Ingresso audio', output: 'Finestra di output', fps: 'Frame rate',
  dmx: 'ArtNet / DMX', remote: 'Remote dal telefono', disk: 'Spazio disco',
}
const ORDER = Object.keys(NAMES)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** One pass of every check; each row lands as soon as its measurement is in. */
function runSoundcheck(engine: Engine, outputRes: string, onRow: (row: Row) => void): () => void {
  let cancelled = false
  const put = (row: Row) => { if (!cancelled) onRow(row) }
  const quiet = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null)

  // 1 + 3: listen for INPUT_WINDOW_S seconds, summing the time with signal,
  // and count the frames the control window renders meanwhile.
  let signalMs = 0
  let last = performance.now()
  const unsub = engine.onAudioFrame((_b, _e, _bass, _bar, _bassRaw, energyRaw) => {
    const now = performance.now()
    if (energyRaw > 0) signalMs += Math.min(100, now - last)
    last = now
  })
  const f0 = engine.frames
  const t0 = performance.now()
  let outputFps: number | null = null

  // 2: the projector answers with a frame's statistics and its own pace
  const outputDone = Promise.all([
    quiet(window.api.getOutputInfo()),
    quiet(window.api.probeOutput()),
  ]).then(([info, probe]) => {
    outputFps = probe?.fps ?? null
    put(judgeOutput(!!info?.open, probe))
  })

  // 4: a packet down the ArtNet socket, to the configured node or broadcast
  const dmx = readJson<{ enabled?: boolean; host?: string }>(DMX_STORE_KEY, {}) ?? {}
  quiet(window.api.probeDmx(dmx.host ?? '')).then(res => put(judgeDmx(!!dmx.enabled, dmx.host ?? '', res)))
  // 5 + 6
  quiet(window.api.getRemoteInfo()).then(info => put(judgeRemote(info)))
  quiet(window.api.getDiskFree()).then(free => put(judgeDisk(free)))

  sleep(INPUT_WINDOW_S * 1000).then(async () => {
    unsub()
    const controlFps = (engine.frames - f0) / ((performance.now() - t0) / 1000)
    put(judgeInput(signalMs / 1000))
    await outputDone
    put(judgeFps(controlFps, outputFps, outputRes))
  })

  return () => { cancelled = true; unsub() }
}

/** Soundcheck (P3): the pre-show list, green or red, in a few seconds. */
export function Soundcheck({ engine, outputRes, onClose }: SoundcheckProps) {
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [pass, setPass] = useState(0)

  useEffect(() => {
    if (!engine) return
    setRows({})
    return runSoundcheck(engine, outputRes, row => setRows(prev => ({ ...prev, [row.id]: row })))
  }, [engine, pass])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const done = ORDER.every(id => rows[id])
  const overall = done ? worst(ORDER.map(id => rows[id])) : null

  return (
    <div className="onboarding-backdrop" onClick={onClose}>
      <div className="onboarding-card soundcheck" onClick={e => e.stopPropagation()}>
        <h2>Soundcheck</h2>
        <p className="onboarding-hint">
          {overall === null ? `Ascolto l'ingresso per ${INPUT_WINDOW_S} secondi e interrogo proiettore, rete e disco…`
            : overall === 'ok' ? 'Tutto verde: si puo\' partire.'
            : overall === 'warn' ? 'Si parte, ma guarda le righe gialle.'
            : 'C\'e\' qualcosa da sistemare prima di partire.'}
        </p>
        <ul className="sc-list">
          {ORDER.map(id => {
            const row = rows[id]
            return (
              <li key={id} className="sc-row">
                <span className={`sc-dot ${row?.status ?? 'pending'}`} aria-hidden="true" />
                <span className="sc-name">{row?.name ?? NAMES[id]}</span>
                <span className="sc-detail">{row?.detail ?? '…'}</span>
              </li>
            )
          })}
        </ul>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" disabled={!done} onClick={() => setPass(p => p + 1)} title="Rifai tutti i controlli">
            Ripeti
          </button>
          <button className="btn btn-primary btn-sm" onClick={onClose} title="Chiudi la finestra">Chiudi</button>
        </div>
      </div>
    </div>
  )
}
