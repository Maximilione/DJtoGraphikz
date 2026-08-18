import React, { useEffect, useState } from 'react'
import { GENRE_CONFIGS, type Genre } from '@engine/AutoVJ'

export interface OnboardingResult {
  deviceId: string
  genre: Genre
  autoVJ: boolean
}

interface OnboardingProps {
  onDone: (result: OnboardingResult | null) => void  // null = skipped
}

/** First-launch wizard: device → genre → go. Never shown again after done/skip. */
export function Onboarding({ onDone }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [genre, setGenre] = useState<Genre>('acid-techno')
  const [autoVJ, setAutoVJ] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ audio: true })
        tmp.getTracks().forEach(t => t.stop())
        const all = await navigator.mediaDevices.enumerateDevices()
        const inputs = all.filter(d => d.kind === 'audioinput')
        setDevices(inputs)
        if (inputs.length > 0) setDeviceId(inputs[0].deviceId)
      } catch (err: any) {
        setError(`Impossibile accedere all'audio: ${err.message}`)
      }
    })()
  }, [])

  const steps = ['Audio', 'Stile', 'Via!']

  return (
    <div className="onboarding-backdrop">
      <div className="onboarding-card">
        {/* Step indicator */}
        <div className="onboarding-steps">
          {steps.map((label, i) => (
            <div key={label} className={`onboarding-step${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}>
              <span className="dot">{i < step ? '✓' : i + 1}</span>
              {label}
            </div>
          ))}
        </div>

        {step === 0 && (
          <>
            <h2>Da dove arriva la musica?</h2>
            <p className="onboarding-hint">
              Scegli l'ingresso audio: line-in dal mixer, microfono del laptop o cavo audio virtuale.
            </p>
            {error && <div className="onboarding-error">{error}</div>}
            <select
              value={deviceId}
              onChange={e => setDeviceId(e.target.value)}
              className="onboarding-select"
            >
              {devices.length === 0 && <option value="">Nessun dispositivo trovato</option>}
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Ingresso audio ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </>
        )}

        {step === 1 && (
          <>
            <h2>Che musica suoni stasera?</h2>
            <p className="onboarding-hint">
              Il genere imposta effetti, colori e velocità di cambio. Puoi cambiarlo quando vuoi.
            </p>
            <div className="onboarding-genres">
              {(Object.entries(GENRE_CONFIGS) as [Genre, typeof GENRE_CONFIGS[Genre]][]).map(([id, cfg]) => (
                <button
                  key={id}
                  className={`onboarding-genre${genre === id ? ' active' : ''}`}
                  onClick={() => setGenre(id)}
                >
                  <div className="genre-label">{cfg.label}</div>
                  <div className="genre-swatches">
                    {cfg.palettes[0].map((c, j) => (
                      <span key={j} style={{ background: c }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
            <label className="onboarding-check">
              <input type="checkbox" checked={autoVJ} onChange={e => setAutoVJ(e.target.checked)} />
              Auto VJ: cambia effetti e colori da solo, a tempo di musica
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Tutto pronto</h2>
            <p className="onboarding-hint">
              Collega il proiettore o un secondo schermo: la finestra di output va in fullscreen da sola.
              <br /><br />
              Scorciatoie: <b>B</b> blackout · <b>F</b> freeze · <b>[</b> / <b>]</b> luminosità
            </p>
            <div className="onboarding-summary">
              <div><span>Audio</span>{devices.find(d => d.deviceId === deviceId)?.label || 'Default'}</div>
              <div><span>Genere</span>{GENRE_CONFIGS[genre].label}</div>
              <div><span>Auto VJ</span>{autoVJ ? 'Attivo' : 'Spento'}</div>
            </div>
          </>
        )}

        {/* Footer buttons */}
        <div className="onboarding-footer">
          <button className="btn btn-secondary btn-sm" onClick={() => onDone(null)}>
            Salta
          </button>
          <div style={{ flex: 1 }} />
          {step > 0 && (
            <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
              Indietro
            </button>
          )}
          {step < 2 ? (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
              Avanti
            </button>
          ) : (
            <button
              className="btn btn-primary onboarding-start"
              onClick={() => onDone({ deviceId, genre, autoVJ })}
            >
              ▶ INIZIA
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
