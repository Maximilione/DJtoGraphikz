import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface RemoteModalProps {
  onClose: () => void
}

/** QR + pairing code for the phone remote. Server runs in the main process. */
export function RemoteModal({ onClose }: RemoteModalProps) {
  const [info, setInfo] = useState<{ url: string; code: string } | null>(null)
  const [qr, setQr] = useState('')

  const load = async (i?: { url: string; code: string }) => {
    const data = i ?? await window.api.getRemoteInfo()
    setInfo(data)
    setQr(await QRCode.toDataURL(data.url, {
      width: 220, margin: 1,
      color: { dark: '#e8e8f0', light: '#0a0a0e' },
    }))
  }

  useEffect(() => { load().catch(console.error) }, [])

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
          </>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            title="Scollega i telefoni collegati e genera un nuovo codice"
            onClick={async () => {
              const { code } = await window.api.resetRemote()
              if (info) load({ ...info, code })
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
