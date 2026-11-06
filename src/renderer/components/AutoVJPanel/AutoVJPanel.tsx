import { memo, useEffect, useState } from 'react'
import { GENRE_CONFIGS, type AutoVJ, type Genre, type Phase } from '@engine/AutoVJ'
import type { Engine } from '@engine/Engine'
import { AutoVJControl } from '../AutoVJ/AutoVJControl'
import { Panel } from '../Panel/Panel'
import { effectLabel, postLabel } from '../../catalog'
import { pushToast } from '../Toasts/Toasts'
import { loadUserScenes, saveUserScenes, sceneFromLook, userScenesByGenre, getOnlyMine, setOnlyMine, USER_SCENES_EVENT, type UserScene } from '../../userScenes'

// The AutoVJ instance lives in App (shared with Simple mode); this panel is just its Pro-view controls.
interface AutoVJPanelProps {
  engine: Engine | null
  vj: AutoVJ
  vjEnabled: boolean
  vjGenre: Genre
  vjStatus: { current: string; count: number; phase: Phase }
  vjHeld: boolean
  onToggle: (on: boolean) => void
  onGenre: (g: Genre) => void
  onHold: (held: boolean) => void
}


const PHASE_LABEL: Record<Phase, string> = { break: 'Pausa', build: 'Salita', groove: 'Groove', peak: 'Picco' }


function AutoVJPanelImpl({ engine, vj, vjEnabled, vjGenre, vjStatus, vjHeld, onToggle, onGenre, onHold }: AutoVJPanelProps) {
  const config = GENRE_CONFIGS[vjGenre]
  const [mine, setMine] = useState<UserScene[]>(loadUserScenes)
  const [onlyMine, setOnlyMineState] = useState<boolean>(getOnlyMine)
  const [savePhase, setSavePhase] = useState<Phase | ''>('')

  // the phone can save a scene or flip the flag while this panel is open
  useEffect(() => {
    const reload = () => { setMine(loadUserScenes()); setOnlyMineState(getOnlyMine()) }
    window.addEventListener(USER_SCENES_EVENT, reload)
    return () => window.removeEventListener(USER_SCENES_EVENT, reload)
  }, [])

  // the Auto VJ reads them from here, on every change and at mount
  useEffect(() => { vj.setUserScenes(userScenesByGenre(mine), onlyMine) }, [vj, mine, onlyMine])

  // From the stored list, not from `mine` of this render: a scene the phone
  // saved a moment ago, before the event re-read it here, was overwritten.
  const addCurrent = () => {
    if (!engine) return
    const phase = savePhase || vjStatus.phase
    const next = [...loadUserScenes(), sceneFromLook(engine, vjGenre, phase)]
    // disk first: a scene shown as saved with the quota full was gone at restart
    if (saveUserScenes(next)) setMine(next)
  }
  const remove = (id: string) => {
    const all = loadUserScenes()
    const removed = all.find(m => m.id === id)
    if (!removed) return   // the phone may have changed the list meanwhile
    const next = all.filter(m => m.id !== id)
    if (!saveUserScenes(next)) return
    setMine(next)
    // a scene captured live on a look that will not come back
    pushToast('Scena rimossa', `scene-del-${id}`, { label: 'Annulla', fn: () => { const back = [...loadUserScenes(), removed]; if (saveUserScenes(back)) setMine(back) } })
  }
  const toggleOnlyMine = (on: boolean) => { setOnlyMineState(on); setOnlyMine(on) }
  const mineHere = mine.filter(m => m.genre === vjGenre)

  return (
    <Panel id="autovj" title="Auto VJ">
      <div className="u-col">
        <AutoVJControl
          enabled={vjEnabled} genre={vjGenre} status={vjStatus}
          onToggle={onToggle} onGenre={onGenre}
          held={vjHeld} onHold={onHold}
        />

        {/* The user's own scenes for this genre */}
        <div className="u-col" style={{ gap: 4 }}>
          {/* titled, with the count elsewhere: a genre change made the list vanish as if lost */}
          <div className="cat-label">Le mie scene · {config.label}{mine.length > mineHere.length ? ` (${mine.length - mineHere.length} in altri generi)` : ''}</div>
          <div className="u-col" style={{ gap: 4 }}>
            <select style={{ width: '100%' }} value={savePhase} onChange={e => setSavePhase(e.target.value as Phase | '')} title="In quale momento del pezzo va questa scena">
              <option value="">fase: {PHASE_LABEL[vjStatus.phase].toLowerCase()} (attuale)</option>
              {(['break', 'build', 'groove', 'peak'] as Phase[]).map(ph => <option key={ph} value={ph}>{PHASE_LABEL[ph]}</option>)}
            </select>
            <button type="button" className="btn" onClick={addCurrent} disabled={!engine}
              title="Salva l'effetto corrente con parametri, mapping audio e post-FX come scena di questo genere">
              + Look corrente come scena
            </button>
          </div>
          {mineHere.length > 0 && (
            <>
              <label className="u-row" style={{ cursor: 'pointer', minHeight: 28 }}>
                <input type="checkbox" checked={onlyMine} onChange={e => toggleOnlyMine(e.target.checked)} />
                <span className="label">Usa solo le mie, nelle fasi dove ne ho</span>
              </label>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                {mineHere.map(m => (
                  <li key={m.id} className="u-row" style={{ minHeight: 28 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-xs)' }}>{effectLabel(m.effect)} · {PHASE_LABEL[m.phase].toLowerCase()}{m.posts.length ? ` · ${m.posts.map(postLabel).join('+')}` : ''}</span>
                    <button type="button" className="btn btn-sm" onClick={() => remove(m.id)} aria-label={`Rimuovi la scena ${m.name}`} title="Rimuovi">×</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Genre info */}
        <details className="u-hint">
          <summary style={{ cursor: 'pointer', marginBottom: '4px' }} title="Dettagli della configurazione del genere">
            Configurazione {config.label}
          </summary>
          <div style={{ paddingLeft: '6px', lineHeight: '1.6' }}>
            {(['break', 'build', 'groove', 'peak'] as Phase[]).map(ph => (
              <div key={ph}>
                <span style={{ color: 'var(--text-primary)' }}>{PHASE_LABEL[ph]}:</span>{' '}
                {config.scenes.filter(sc => sc.phase === ph).map(sc => effectLabel(sc.effect)).join(', ')}
              </div>
            ))}
            <div>
              <span style={{ color: 'var(--text-primary)' }}>Frase:</span>{' '}
              {config.phraseBars} battute nel groove, {Math.max(2, config.phraseBars / 2)} al picco, {config.phraseBars * 2} in pausa
            </div>
            <div>
              <span style={{ color: 'var(--text-primary)' }}>Cambio:</span>{' '}
              {config.cut.seconds}s sul groove · 2.5s verso la pausa · taglio secco sul drop
            </div>
            {/* Palette swatches */}
            <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
              {config.palettes.map((pal, i) => (
                <div key={i} style={{ display: 'flex', gap: '1px' }}>
                  {pal.map((c, j) => (
                    <div key={j} style={{ width: '8px', height: '8px', borderRadius: '1px', background: c }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>
    </Panel>
  )
}

/** Memoised: App re-renders on every fader tick; every prop here is stable or state. */
export const AutoVJPanel = memo(AutoVJPanelImpl)
