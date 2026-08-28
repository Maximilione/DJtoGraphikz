import React, { useEffect, useState } from 'react'
import { GENRE_CONFIGS, type Genre } from '@engine/AutoVJ'
import { seedFactoryLooks } from '../../factoryLooks'

export interface OnboardingResult {
  deviceId: string
  genre: Genre
  autoVJ: boolean
}

interface OnboardingProps {
  onDone: (result: OnboardingResult | null) => void  // null = skipped
}

/** First-launch wizard: device → genre → look bank → go. Never shown again after done/skip. */
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

  const steps = ['Audio', 'Stile', 'Look', 'Via!']
  const last = steps.length - 1

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
              Line-in dal mixer, microfono del laptop o cavo audio virtuale. Si cambia quando vuoi.
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
              Il genere imposta effetti, colori e ritmo dei cambi. Modificabile in ogni momento.
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
              Auto VJ: effetti e colori cambiano da soli, a tempo di musica
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Il tuo primo look</h2>
            <p className="onboarding-hint">
              Il Look Bank è una griglia 4×4: click su uno slot salva quello che vedi,
              <b> Shift+1-0</b> lo richiama al volo.
              <br /><br />
              Trovi già <b>8 look di fabbrica</b> pronti negli slot 1-8: parti da lì e sovrascrivili quando vuoi.
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <h2>Tutto pronto</h2>
            <p className="onboarding-hint">
              Collega il proiettore o un secondo schermo: l'output va in fullscreen da solo.
              <br /><br />
              Scorciatoie: <b>B</b> blackout · <b>F</b> freeze · <b>[</b> / <b>]</b> luminosità · <b>?</b> aiuto
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
          {step < last ? (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
              Avanti
            </button>
          ) : (
            <button
              className="btn btn-primary onboarding-start"
              onClick={() => { seedFactoryLooks(); onDone({ deviceId, genre, autoVJ }) }}
            >
              ▶ INIZIA
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
