import React, { useEffect, useReducer } from 'react'
import type { Engine } from '@engine/Engine'
import { midi, MIDI_TARGETS, bindingLabel } from '../../midi'
import { gamepad, gpBindingLabel } from '../../gamepad'
import { pushToast } from '../Toasts/Toasts'
import { Panel } from '../Panel/Panel'

interface MidiPanelProps {
  engine: Engine | null
  dispatchCmd: (cmd: { type: string; value?: unknown }) => void
}

/** MIDI learn: arm a target, touch a knob/pad, done. Bindings persist. */
export function MidiPanel({ engine, dispatchCmd }: MidiPanelProps) {
  const [, force] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    if (!engine) return
    midi.start(engine, dispatchCmd)
    gamepad.start(engine, dispatchCmd)
    const offs = [midi.onChange(force), gamepad.onChange(force)]
    return () => offs.forEach(f => f())
  }, [engine, dispatchCmd])

  if (!engine) return null

  const groups = [...new Set(MIDI_TARGETS.map(t => t.group))]
  const learning = midi.learning()
  const gpLearning = gamepad.learning()

  const clearWithUndo = (targetId: string, label: string) => {
    const b = midi.getBinding(targetId)
    if (!b) return
    midi.clearBinding(targetId)
    pushToast(`Binding rimosso: ${label}`, `midi-clear-${targetId}`, {
      label: 'Annulla',
      fn: () => midi.setBinding(targetId, b),
    })
  }

  return (
    <Panel id="midi" title="MIDI" defaultCollapsed group="right">
      <div className="midi-panel">
        <div className="midi-status">
          {!midi.supported ? 'Web MIDI non disponibile'
            : midi.deviceNames.length === 0 ? 'Nessun device MIDI collegato'
            : midi.deviceNames.join(' · ')}
          {midi.lastMessage && <span className="midi-last"> · {midi.lastMessage}</span>}
        </div>
        {learning && (
          <div className="midi-learning">
            Muovi un controllo MIDI per assegnarlo…{' '}
            <button className="btn btn-secondary btn-sm" title="Annulla l'assegnazione MIDI" onClick={() => midi.cancelLearn()}>Annulla</button>
          </div>
        )}
        {groups.map(g => (
          <div key={g}>
            <div className="midi-group">{g}</div>
            {MIDI_TARGETS.filter(t => t.group === g).map(t => {
              const b = midi.getBinding(t.id)
              return (
                <div key={t.id} className="midi-row">
                  <span className="midi-label">{t.label}</span>
                  <span className="midi-binding">{bindingLabel(b)}</span>
                  <button
                    className={`btn btn-sm ${learning === t.id ? 'btn-danger' : 'btn-secondary'}`}
                    title={learning === t.id ? 'Annulla learn' : 'Assegna un controllo MIDI: premi e poi muovi un knob/pad'}
                    onClick={() => (learning === t.id ? midi.cancelLearn() : midi.learn(t.id))}
                  >
                    {learning === t.id ? '…' : 'Learn'}
                  </button>
                  {b && (
                    <button className="btn btn-secondary btn-sm" title="Rimuovi binding"
                      onClick={() => clearWithUndo(t.id, t.label)} aria-label="Rimuovi binding">✕</button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        <div className="midi-group">Gamepad</div>
        <div className="midi-status">
          {!gamepad.supported ? 'Gamepad API non disponibile'
            : gamepad.padNames.length === 0 ? 'Nessun gamepad collegato (premi un tasto per farlo rilevare)'
            : gamepad.padNames.join(' · ')}
          {gamepad.lastMessage && <span className="midi-last"> · {gamepad.lastMessage}</span>}
        </div>
        {gpLearning && (
          <div className="midi-learning">
            Premi un pulsante o muovi un asse del gamepad…{' '}
            <button className="btn btn-secondary btn-sm" title="Annulla l'assegnazione gamepad" onClick={() => gamepad.cancelLearn()}>Annulla</button>
          </div>
        )}
        {gamepad.padNames.length > 0 && MIDI_TARGETS.map(t => {
          const b = gamepad.getBinding(t.id)
          return (
            <div key={t.id} className="midi-row">
              <span className="midi-label">{t.label}</span>
              <span className="midi-binding">{gpBindingLabel(b)}</span>
              <button
                className={`btn btn-sm ${gpLearning === t.id ? 'btn-danger' : 'btn-secondary'}`}
                title={gpLearning === t.id ? 'Annulla learn' : 'Assegna un pulsante o asse del gamepad'}
                onClick={() => (gpLearning === t.id ? gamepad.cancelLearn() : gamepad.learn(t.id))}
              >
                {gpLearning === t.id ? '…' : 'Learn'}
              </button>
              {b && (
                <button className="btn btn-secondary btn-sm" title="Rimuovi binding gamepad"
                  onClick={() => gamepad.clearBinding(t.id)} aria-label="Rimuovi binding gamepad">✕</button>
              )}
            </div>
          )
        })}
        {gamepad.padNames.length > 0 && (
          <button className="btn btn-secondary btn-sm" title="Rimuove tutti i binding del gamepad" onClick={() => gamepad.clearAll()}>Azzera gamepad</button>
        )}
      </div>
    </Panel>
  )
}
