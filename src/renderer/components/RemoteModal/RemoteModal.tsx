import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface RemoteModalProps {
  onClose: () => void
}

/** QR + pairing code for the phone remote. Server runs in the main process. */
export function RemoteModal({ onClose }: RemoteModalProps) {
  type Info = { url: string; code: string; obsUrl: string }
  const [info, setInfo] = useState<Info | null>(null)
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)

  const load = async (i?: Info) => {
    const data = i ?? await window.api.getRemoteInfo()
    setInfo(data)
    setQr(await QRCode.toDataURL(data.url, {
      width: 220, margin: 1,
      color: { dark: '#e8e8f0', light: '#0a0a0e' },
    }))
  }

  useEffect(() => { load().catch(console.error) }, [])

  // Escape closes: without it a modal could only be dismissed with the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])


  return (
    <div className="onboarding-backdrop" onClick={onClose}>
      <div className="onboarding-card" style={{ width: '340px', alignItems: 'center', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <h2>Remote dal telefono</h2>
        <p className="onboarding-hint">
          Telefono sulla <b>stessa rete wifi</b>: inquadra il QR, poi inserisci il codice di abbinamento.
        </p>
        {qr && <img src={qr} alt="QR" style={{ borderRadius: '8px', width: '220px', height: '220px' }} />}
        {info && (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
              {info.url}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '34px', fontWeight: 700,
              letterSpacing: '8px', color: 'var(--accent)',
            }}>
              {info.code}
            </div>
            {/* I2: the same output page for OBS (Browser Source) or a browser on
                another computer. Second render: it costs GPU to whoever opens it. */}
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '6px', alignItems: 'center', maxWidth: '100%' }}>
              <span style={{ whiteSpace: 'nowrap' }}>OBS / browser:</span>
              <span
                title={info.obsUrl}
                style={{ fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {info.obsUrl}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                title="Copia l'indirizzo da incollare in OBS come Browser Source"
                onClick={() => {
                  navigator.clipboard.writeText(info.obsUrl).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }).catch(console.error)
                }}
              >
                {copied ? 'Copiato' : 'Copia'}
              </button>
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            title="Scollega telefoni e browser OBS collegati, genera codice e indirizzo nuovi"
            onClick={async () => {
              const { code, obsUrl } = await window.api.resetRemote()
              if (info) load({ ...info, code, obsUrl })
            }}
          >
            Nuovo codice
          </button>
          <button className="btn btn-primary btn-sm" title="Chiudi la finestra" onClick={onClose}>Chiudi</button>
        </div>
      </div>
    </div>
  )
}
