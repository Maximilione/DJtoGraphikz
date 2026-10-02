import { useEffect, useState } from 'react'
import { GENRE_CONFIGS, type AutoVJ, type Genre, type Phase } from '@engine/AutoVJ'
import type { Engine } from '@engine/Engine'
import { AutoVJControl } from '../AutoVJ/AutoVJControl'
import { Panel } from '../Panel/Panel'
import { effectLabel } from '../../catalog'
import { loadUserScenes, saveUserScenes, sceneFromLook, userScenesByGenre, ONLY_MINE_KEY, USER_SCENES_EVENT, type UserScene } from '../../userScenes'
import { readJson, writeJson } from '../../storage'

// The AutoVJ instance lives in App (shared with Simple mode); this panel is just its Pro-view controls.
interface AutoVJPanelProps {
  engine: Engine | null
  vj: AutoVJ
  vjEnabled: boolean
  vjGenre: Genre
  vjStatus: { current: string; count: number; phase: Phase }
  onToggle: (on: boolean) => void
  onGenre: (g: Genre) => void
}


const PHASE_LABEL: Record<Phase, string> = { break: 'Pausa', build: 'Salita', groove: 'Groove', peak: 'Picco' }


export function AutoVJPanel({ engine, vj, vjEnabled, vjGenre, vjStatus, onToggle, onGenre }: AutoVJPanelProps) {
  const config = GENRE_CONFIGS[vjGenre]
  const [mine, setMine] = useState<UserScene[]>(loadUserScenes)
  const [onlyMine, setOnlyMine] = useState<boolean>(() => readJson<boolean>(ONLY_MINE_KEY, false))
  const [savePhase, setSavePhase] = useState<Phase | ''>('')

  // the phone can save a scene or flip the flag while this panel is open
  useEffect(() => {
    const reload = () => { setMine(loadUserScenes()); setOnlyMine(readJson<boolean>(ONLY_MINE_KEY, false)) }
    window.addEventListener(USER_SCENES_EVENT, reload)
    return () => window.removeEventListener(USER_SCENES_EVENT, reload)
  }, [])

  // the Auto VJ reads them from here, on every change and at mount
  useEffect(() => { vj.setUserScenes(userScenesByGenre(mine), onlyMine) }, [vj, mine, onlyMine])

  const addCurrent = () => {
    if (!engine) return
    const phase = savePhase || vjStatus.phase
    const next = [...mine, sceneFromLook(engine, vjGenre, phase)]
    setMine(next); saveUserScenes(next)
  }
  const remove = (id: string) => {
    const next = mine.filter(m => m.id !== id)
    setMine(next); saveUserScenes(next)
  }
  const toggleOnlyMine = (on: boolean) => { setOnlyMine(on); writeJson(ONLY_MINE_KEY, on) }
  const mineHere = mine.filter(m => m.genre === vjGenre)

  return (
    <Panel id="autovj" title="Auto VJ">
      <div className="u-col">
        <AutoVJControl
          enabled={vjEnabled} genre={vjGenre} status={vjStatus}
          onToggle={onToggle} onGenre={onGenre}
        />

        {/* The user's own scenes for this genre */}
        <div className="u-col" style={{ gap: 4 }}>
          <div className="slider-row">
            <button type="button" className="btn" onClick={addCurrent} disabled={!engine}
              title="Salva l'effetto corrente con parametri, mapping audio e post-FX come scena di questo genere">
              + Look corrente come scena
            </button>
            <select value={savePhase} onChange={e => setSavePhase(e.target.value as Phase | '')} title="In quale momento del pezzo va questa scena">
              <option value="">fase: {PHASE_LABEL[vjStatus.phase].toLowerCase()} (attuale)</option>
              {(['break', 'build', 'groove', 'peak'] as Phase[]).map(ph => <option key={ph} value={ph}>{PHASE_LABEL[ph]}</option>)}
            </select>
          </div>
          {mineHere.length > 0 && (
            <>
              <label className="slider-row" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={onlyMine} onChange={e => toggleOnlyMine(e.target.checked)} />
                <span className="label">Solo le mie (dove ne ho)</span>
              </label>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                {mineHere.map(m => (
                  <li key={m.id} className="slider-row" style={{ gap: 6 }}>
                    <span style={{ flex: 1 }}>{effectLabel(m.effect)} · {PHASE_LABEL[m.phase].toLowerCase()}{m.posts.length ? ` · ${m.posts.join('+')}` : ''}</span>
                    <button type="button" className="btn" onClick={() => remove(m.id)} aria-label={`Rimuovi la scena ${m.name}`} title="Rimuovi">×</button>
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
                <span style={{ color: 'var(--accent)' }}>{PHASE_LABEL[ph]}:</span>{' '}
                {config.scenes.filter(sc => sc.phase === ph).map(sc => sc.effect).join(', ')}
              </div>
            ))}
            <div>
              <span style={{ color: 'var(--accent)' }}>Frase:</span>{' '}
              {config.phraseBars} battute nel groove, {Math.max(2, config.phraseBars / 2)} al picco, {config.phraseBars * 2} in pausa
            </div>
            <div>
              <span style={{ color: 'var(--accent)' }}>Cambio:</span>{' '}
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
