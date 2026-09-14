import { GENRE_CONFIGS, type Genre } from '@engine/AutoVJ'
import { AutoVJControl } from '../AutoVJ/AutoVJControl'
import { Panel } from '../Panel/Panel'

// The AutoVJ instance lives in App (shared with Simple mode); this panel is just its Pro-view controls.
interface AutoVJPanelProps {
  vjEnabled: boolean
  vjGenre: Genre
  vjStatus: { current: string; count: number }
  onToggle: (on: boolean) => void
  onGenre: (g: Genre) => void
}


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
            <div>
              <span style={{ color: 'var(--accent)' }}>Scene:</span>{' '}
              {config.scenes.map(sc => sc.effect).join(', ')}
            </div>
            <div>
              <span style={{ color: 'var(--accent)' }}>Cambio:</span>{' '}
              ogni {config.switchBeats} beat ({config.transitionStyle})
            </div>
            <div>
              <span style={{ color: 'var(--accent)' }}>Soglia energia:</span>{' '}
              {(config.energyThreshold * 100).toFixed(0)}%
            </div>
            <div>
              <span style={{ color: 'var(--accent)' }}>Combo post-FX:</span>{' '}
              {config.postSets.length}
            </div>
            <div>
              <span style={{ color: 'var(--accent)' }}>Palette:</span>{' '}
              {config.palettes.length}
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
