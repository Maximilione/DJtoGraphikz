import { GENRE_CONFIGS, type Genre, type Phase } from '@engine/AutoVJ'
import { AutoVJControl } from '../AutoVJ/AutoVJControl'
import { Panel } from '../Panel/Panel'

// The AutoVJ instance lives in App (shared with Simple mode); this panel is just its Pro-view controls.
interface AutoVJPanelProps {
  vjEnabled: boolean
  vjGenre: Genre
  vjStatus: { current: string; count: number; phase: Phase }
  onToggle: (on: boolean) => void
  onGenre: (g: Genre) => void
}


const PHASE_LABEL: Record<Phase, string> = { break: 'Pausa', build: 'Salita', groove: 'Groove', peak: 'Picco' }

export function AutoVJPanel({ vjEnabled, vjGenre, vjStatus, onToggle, onGenre }: AutoVJPanelProps) {
  const config = GENRE_CONFIGS[vjGenre]

  return (
    <Panel id="autovj" title="Auto VJ">
      <div className="u-col">
        <AutoVJControl
          enabled={vjEnabled} genre={vjGenre} status={vjStatus}
          onToggle={onToggle} onGenre={onGenre}
        />

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
