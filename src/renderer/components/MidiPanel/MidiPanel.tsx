import React, { useEffect, useReducer } from 'react'
import type { Engine } from '@engine/Engine'
import { midi, MIDI_TARGETS, bindingLabel } from '../../midi'
import { usePanelCollapsed } from '../usePanelCollapsed'
import { pushToast } from '../Toasts/Toasts'

interface MidiPanelProps {
  engine: Engine | null
  dispatchCmd: (cmd: { type: string; value?: unknown }) => void
}

/** MIDI learn: arm a target, touch a knob/pad, done. Bindings persist. */
export function MidiPanel({ engine, dispatchCmd }: MidiPanelProps) {
  const [collapsed, toggleCollapsed] = usePanelCollapsed('midi', true, 'right')
  const [, force] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    if (!engine) return
    midi.start(engine, dispatchCmd)
    return midi.onChange(force)
  }, [engine, dispatchCmd])

  if (!engine) return null

  const groups = [...new Set(MIDI_TARGETS.map(t => t.group))]
  const learning = midi.learning()

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
    <div className="panel">
      <div className="panel-header" onClick={toggleCollapsed} title={collapsed ? 'Espandi pannello MIDI' : 'Comprimi pannello MIDI'}>
        <span>MIDI</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
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
                        onClick={() => clearWithUndo(t.id, t.label)}>✕</button>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
