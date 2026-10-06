import { useEffect, useState } from 'react'
import type { Engine, Preset } from '@engine/Engine'
import type { AudioSource } from '@engine/EffectParams'
import { loadISF } from '@engine/IsfLoader'
import { getPlugins, isPluginEnabled, onPlugins, refreshPlugins, setPluginEnabled } from '../../plugins'
import { migrateAll, type Sequence } from './sequences'
import { pushToast } from '../Toasts/Toasts'
import type { LoadedPlugin } from '../../../shared/plugins'

interface Props {
  engine: Engine | null
  sequences: Sequence[]
  persist: (list: Sequence[]) => boolean
}

/**
 * Plugin dichiarativi: elenco, stato, errori, attiva/disattiva. Gli effetti
 * passano da engine.setCustomShader, lo stesso percorso degli ISF (la finestra
 * output riceve lo shader dallo stateSnapshot, nessuna pipeline in piu').
 */
export function PluginPanel({ engine, sequences, persist }: Props) {
  const [, bump] = useState(0)
  useEffect(() => onPlugins(() => bump(n => n + 1)), [])
  const plugins = getPlugins()

  const runEffect = (p: LoadedPlugin, fx: LoadedPlugin['effects'][number]) => {
    try {
      if (!engine) return
      const res = loadISF(fx.source, fx.name)
      if ('error' in res) return void pushToast(`${fx.name}: ${res.error}`, `plug-${fx.id}`, undefined, 'err')
      if (!engine.setCustomShader(res.fragment, res.params, res.imageInputs)) {
        return void pushToast(`${fx.name}: ${engine.getLastShaderError() || 'shader rifiutato'}`, `plug-${fx.id}`, undefined, 'err')
      }
      // mapping consigliati dal plugin per questo effetto
      for (const m of p.mappings.filter(m => m.effect === fx.id)) {
        for (const [key, v] of Object.entries(m.params)) {
          if (!res.params.some(d => d.key === key)) continue
          if (typeof v.value === 'number') engine.setParamValue(key, v.value)
          engine.setParamMapping(key, v.source as AudioSource, v.depth, v.lfoRate)
        }
      }
    } catch (e: any) {
      pushToast(`${fx.name}: ${e?.message || e}`, `plug-${fx.id}`, undefined, 'err')
    }
  }

  const apply = (preset: Record<string, unknown>) => {
    try { engine?.applyPreset(preset as unknown as Preset) } catch (e: any) { pushToast(`Preset non applicabile: ${e?.message || e}`, 'plug-preset', undefined, 'err') }
  }

  const addSequence = (raw: Record<string, unknown>) => {
    try {
      const imported = migrateAll([raw])
      if (imported.length && persist([...sequences, ...imported])) pushToast(`Scaletta "${imported[0].name}" aggiunta`, 'plug-seq', undefined, 'ok')
    } catch { pushToast('Scaletta non importabile', 'plug-seq', undefined, 'err') }
  }

  return (
    <div className="u-col">
      <div style={{ display: 'flex', gap: '4px' }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { void window.api?.openPluginsFolder?.() }} title="Apre ~/.djtographikz/plugins">Apri cartella plugin</button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { void refreshPlugins() }} title="Rilegge la cartella dei plugin">Ricarica</button>
      </div>
      {plugins.length === 0 && (
        <div className="u-hint" style={{ textAlign: 'center', padding: 'var(--s2)' }}>
          Nessun plugin in ~/.djtographikz/plugins (solo dati: shader, palette, preset, scalette — vedi docs/PLUGINS.md)
        </div>
      )}
      {plugins.map(p => {
        const on = p.status === 'ok' && isPluginEnabled(p.id)
        return (
          <div key={p.dir} className="u-col" style={{ gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <strong style={{ flex: 1 }}>{p.name}</strong>
              <span className="u-hint">plugin{p.version ? ` · v${p.version}` : ''}{p.author ? ` · ${p.author}` : ''}</span>
              {p.status === 'ok' && (
                <button className={`pill${on ? ' active' : ''}`} aria-pressed={on} onClick={() => setPluginEnabled(p.id, !on)} title={on ? 'Disattiva il plugin' : 'Attiva il plugin'}>
                  {on ? 'Attivo' : 'Spento'}
                </button>
              )}
            </div>
            {p.description && <div className="u-hint">{p.description}</div>}
            {p.errors.map((e, i) => <div key={i} className="u-hint" style={{ color: 'var(--danger)' }}>{p.status === 'error' ? 'Non valido: ' : 'Ignorato: '}{e}</div>)}
            {on && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {p.effects.map(fx => <button key={fx.id} className="btn btn-secondary btn-sm" title={`Effetto plugin ${fx.id}${fx.description ? ' — ' + fx.description : ''}`} onClick={() => runEffect(p, fx)}>{fx.name}</button>)}
                {p.presets.map(x => <button key={x.id} className="btn btn-secondary btn-sm" title={`Preset plugin ${x.id}`} onClick={() => apply(x.preset)}>▶ {String(x.preset.name)}</button>)}
                {p.sequences.map(x => <button key={x.id} className="btn btn-secondary btn-sm" title={`Aggiunge la scaletta alle tue (${x.id})`} onClick={() => addSequence(x.sequence)}>+ scaletta {String(x.sequence.name)}</button>)}
                {p.palettes.length > 0 && <span className="u-hint">{p.palettes.length} palette nella griglia colori</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
