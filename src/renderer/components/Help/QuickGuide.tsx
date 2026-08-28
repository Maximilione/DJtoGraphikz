import React, { useEffect } from 'react'

interface QuickGuideProps {
  onClose: () => void
}

const h3Style: React.CSSProperties = {
  color: 'var(--accent)',
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: 1,
  margin: '20px 0 6px',
}

const pStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 13,
  lineHeight: 1.55,
  margin: '0 0 6px',
}

/** Scrollable quick guide modal. Closes on Escape or backdrop click. */
export function QuickGuide({ onClose }: QuickGuideProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="onboarding-backdrop" onClick={onClose}>
      <div
        className="onboarding-card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 620, maxHeight: '80vh', overflowY: 'auto' }}
      >
        <h2>Guida rapida</h2>

        <h3 style={h3Style}>Flusso base</h3>
        <p style={pStyle}>
          1. Scegli l'ingresso audio nel pannello Audio (line-in dal mixer è l'ideale).
          2. Attiva l'AutoVJ con un genere, oppure guida a mano: effetti con i tasti 1-0, post con Q/W/E/R.
          3. Quando qualcosa ti piace, salvalo come look. Da lì in poi il live è richiamare look a tempo.
        </p>

        <h3 style={h3Style}>Look Bank</h3>
        <p style={pStyle}>
          Griglia 4×4: click su uno slot vuoto salva lo stato corrente (effetto, post, colori, parametri).
          Click su uno slot pieno lo applica; Shift+click lo sovrascrive; doppio click sul nome lo rinomina.
          I primi 10 slot si richiamano con Shift+1-0. Alla prima apertura trovi 8 look di fabbrica.
        </p>

        <h3 style={h3Style}>Effetti e parametri</h3>
        <p style={pStyle}>
          Ogni effetto ha 2-3 parametri propri più Speed e React. Ogni parametro può essere mappato
          all'audio (bass, mid, high, energy, beat) o a un LFO sincronizzato al BPM: scegli la sorgente
          e regola la profondità. Depth negativa inverte il movimento. Rotella sul valore per regolarlo fine.
        </p>

        <h3 style={h3Style}>Deck A/B</h3>
        <p style={pStyle}>
          Due effetti in parallelo con crossfader e blend mode (mix, add, multiply...). Utile per
          transizioni lunghe: prepara il deck B, poi porta il crossfader a tempo. I look salvano anche
          lo stato del deck B.
        </p>

        <h3 style={h3Style}>Media</h3>
        <p style={pStyle}>
          Immagini, GIF e video si caricano come overlay sopra la grafica generativa, con posizione,
          scala e opacità. Le GIF sono limitate a 720px/240 frame per non saturare la memoria.
        </p>

        <h3 style={h3Style}>Remote: telefono, OSC, MIDI</h3>
        <p style={pStyle}>
          Il pulsante 📱 mostra QR e codice: il telefono diventa un telecomando con look, blackout e master.
          OSC riceve su rete locale per integrarsi con altri software. Le superfici MIDI si mappano
          dal pannello MIDI in learn mode: giri una manopola, clicchi il controllo, fatto.
        </p>

        <h3 style={h3Style}>ISF</h3>
        <p style={pStyle}>
          Shader ISF personalizzati vanno in ~/.djtographikz/isf e compaiono nella lista effetti
          con i loro parametri. Gli errori di compilazione vengono mostrati senza bloccare il render.
        </p>

        <h3 style={h3Style}>Registrazione</h3>
        <p style={pStyle}>
          La finestra di output si registra in video dal pannello dedicato; lo screenshot cattura
          il frame corrente. Il rendering non si ferma durante la registrazione.
        </p>

        <h3 style={h3Style}>In emergenza</h3>
        <p style={pStyle}>
          B = blackout istantaneo. F = congela il frame. P = panic: torna a uno stato pulito e sicuro.
        </p>

        <div className="onboarding-footer" style={{ marginTop: 20 }}>
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={onClose}>Chiudi</button>
        </div>
      </div>
    </div>
  )
}
