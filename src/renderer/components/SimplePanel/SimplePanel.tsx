import React, { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Genre, Phase } from '@engine/AutoVJ'
import { GENRE_CONFIGS } from '@engine/AutoVJ'
import type { EffectId } from '@engine/Engine'
import { GENRES, effectLabel } from '../../catalog'
import { PHASE_LABEL } from '../AutoVJ/AutoVJControl'
import type { SimpleFlow } from '../../simpleFlow'

interface SimplePanelProps {
  vjEnabled: boolean
  vjGenre: Genre
  vjStatus: { current: string; count: number; phase: Phase }
  vjHeld: boolean
  onVJToggle: (on: boolean) => void
  onVJGenre: (g: Genre) => void
  onVJHold: (held: boolean) => void
  /** does the app hear the music — from App, at most 2 Hz */
  flow: SimpleFlow
  bpm: number
  /** the AudioPanel in its simple variant: mounted by App so its boundary key survives */
  audio: ReactNode
}

const PHASES: Phase[] = ['break', 'build', 'groove', 'peak']

/**
 * Simple mode as a path: 1 Musica, 2 Stile, 3 Via. One step is current and
 * shows its controls; the ones done fold into a row with a "Cambia"; the
 * next is dimmed but never disabled. A step closes once and never reopens
 * on its own — a break in the music must not make the column jump.
 */
export function SimplePanel({ vjEnabled, vjGenre, vjStatus, vjHeld, onVJToggle, onVJGenre, onVJHold, flow, bpm, audio }: SimplePanelProps) {
  const [musicDone, setMusicDone] = useState(false)
  const [styleOpen, setStyleOpen] = useState(false)
  // once only: reopened with Cambia, a break in the music must not fold it again
  const autoClosed = useRef(false)
  useEffect(() => {
    if (flow === 'sento' && !autoClosed.current) { autoClosed.current = true; setMusicDone(true) }
  }, [flow])
  // once the Auto VJ is on, the style is chosen: the tiles fold
  useEffect(() => { if (vjEnabled) setStyleOpen(false) }, [vjEnabled])

  const step = !musicDone ? 1 : !vjEnabled ? 2 : 3
  const cls = (n: number) => `sf-step${step === n ? ' current' : n < step ? ' done' : ' next'}`
  const genreLabel = GENRES.find(g => g.id === vjGenre)?.label ?? vjGenre
  const showTiles = step === 2 || styleOpen

  return (
    <div className="panel simple-panel">
      {/* 1 — Musica */}
      <section className={cls(1)}>
        <header className="sf-head">
          <span className="sf-num">1</span>
          <span className="sf-title">Musica</span>
          {musicDone && (
            <>
              <span className="sf-sum">
                {flow === 'sento' ? `Ti sento${bpm > 0 ? ` · ${bpm} BPM` : ''}` : flow === 'fermo' ? 'Audio fermo' : 'Silenzio'}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setMusicDone(false)}>Cambia</button>
            </>
          )}
          {!musicDone && autoClosed.current && (
            <button className="btn btn-ghost btn-sm" onClick={() => setMusicDone(true)}>Fatto</button>
          )}
        </header>
        {!musicDone && (
          <div className="sf-body">
            {audio}
            {flow === 'silenzio' && (
              <div className="sf-warn" role="status">
                Non arriva suono. Controlla cavo o volume, oppure scegli un altro ingresso. Musica molto bassa? Alza il Gain in Regolazioni audio.
              </div>
            )}
            {flow === 'attesa' && <div className="u-hint">Metti un brano: appena lo sento passo al passo 2.</div>}
          </div>
        )}
      </section>

      {/* 2 — Stile */}
      <section className={cls(2)}>
        <header className="sf-head">
          <span className="sf-num">2</span>
          <span className="sf-title">Stile</span>
          {!showTiles && (
            <>
              <span className="sf-sum">{genreLabel}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setStyleOpen(true)}>Cambia</button>
            </>
          )}
        </header>
        {showTiles && (
          <div className="sf-body">
            <div className="sf-genres">
              {GENRES.map(g => (
                <button
                  key={g.id}
                  className={`btn genre-tile${vjGenre === g.id ? ' active' : ''}`}
                  aria-pressed={vjGenre === g.id}
                  title={g.desc}
                  onClick={() => { onVJGenre(g.id as Genre); setStyleOpen(false) }}
                >
                  <span className="genre-label">{g.label}</span>
                  <span className="genre-swatches">
                    {GENRE_CONFIGS[g.id as Genre].palettes[0].map((c, j) => <span key={j} style={{ background: c }} />)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 3 — Via: one big button, then the card that says what the machine is doing */}
      <section className={`${cls(3)} sf-go-wrap`}>
        {!vjEnabled ? (
          <button className="btn btn-primary sf-go" onClick={() => onVJToggle(true)} title="Accende l'Auto VJ">
            <span className="sf-go-title"><span className="sf-num">3</span> Grafiche in automatico</span>
            <span className="sf-go-sub">Auto VJ: cambia tutto da solo, a tempo</span>
          </button>
        ) : (
          <div className="sf-card">
            <div className="sf-card-head">
              <span className="air-tag">Auto VJ in regia</span>
              <button className="btn btn-ghost btn-sm" onClick={() => onVJToggle(false)} title="Spegne l'Auto VJ: comandi tu">Spegni Auto VJ</button>
            </div>
            <div className="sf-now">Ora: {vjStatus.current ? effectLabel(vjStatus.current as EffectId) : '—'}</div>
            <div className="sf-phases" title="In che momento del pezzo siamo, secondo l'Auto VJ">
              {PHASES.map(ph => <span key={ph} className={ph === vjStatus.phase ? 'on' : ''}>{PHASE_LABEL[ph]}</span>)}
            </div>
            <button
              className={`btn${vjHeld ? ' is-armed' : ''}`}
              aria-pressed={vjHeld}
              onClick={() => onVJHold(!vjHeld)}
              title="Tiene fermo il look attuale — fasi e palette continuano a seguire la musica sotto, pronte a ripartire"
            >
              {vjHeld ? 'Riprendi i cambi' : 'Tieni questo effetto'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
