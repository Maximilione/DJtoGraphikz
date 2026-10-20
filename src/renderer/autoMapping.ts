import type { Engine, EffectId } from '@engine/Engine'
import { readJson, writeJson } from './storage'
import { smartMap, SKIP_KEYS } from './smartMap'

/**
 * "Mapping consigliato al cambio effetto": quando l'utente sceglie un effetto
 * a mano (griglia, tasti 1-0, telefono) l'effetto arriva gia' collegato
 * all'audio col suo preset. L'Auto VJ, le scalette e i look non passano di
 * qui — portano il loro mapping e chiamano `engine.setEffect` direttamente.
 */
const KEY = 'djtographikz-mapping-consigliato'
// anything but an explicit false ('null', a number, junk) keeps the default on
let enabled = readJson<unknown>(KEY, true) !== false

export function autoMappingEnabled(): boolean { return enabled }
export function setAutoMappingEnabled(on: boolean) { enabled = on; writeJson(KEY, on) }

/** Scelta a mano: setEffect + mapping consigliato sui parametri ancora liberi. */
export function pickEffect(engine: Engine, id: EffectId) {
  engine.setEffect(id)
  if (enabled) engine.applyRecommendedMapping(id)
}

export interface MagicMapResult {
  count: number
  curated: number
  undo: () => void
}

/**
 * Magic Mapping: sostituisce i due pulsanti "Auto" (preset curato) e "Collega
 * all'audio" (euristica) con uno solo, ottimale per costruzione — prende il
 * meglio di entrambi invece di farli scegliere all'utente.
 *
 * 1) smartMap collega OGNI parametro a qualcosa di sensato (via nome/uso nel
 *    sorgente), anche per shader custom/ISF senza preset dedicato.
 * 2) il preset curato in RecommendedMappings, dove esiste per l'effetto,
 *    sovrascrive quei parametri con la combinazione scritta a mano — pensata
 *    apposta per quell'effetto, quindi vince sull'euristica generica.
 *
 * L'undo di smartMap copre quasi tutto: ha salvato lo stato PRIMA di ogni
 * modifica. Le chiavi che smartMap salta (speed, reactivity) il preset curato
 * le imposta lo stesso, quindi qui si salvano a parte e si rimettono a posto.
 */
export function magicMap(engine: Engine): MagicMapResult {
  const effect = engine.getCurrentEffect()
  const custom = engine.getCustomShaderSource()
  const skipped = SKIP_KEYS.map(key => {
    const st = engine.getParamState(key)
    return { key, value: st.value, source: st.source, depth: st.depth, lfoRate: st.lfoRate }
  })
  let r!: ReturnType<typeof smartMap>
  let curated = 0
  // one snapshot for both passes, not one per setter
  engine.batch(() => {
    r = smartMap(engine)
    // the curated preset is keyed by built-in effect id: with a custom shader
    // on, it would write into the built-in's bucket, not the one on screen
    curated = engine.isUsingCustomShader() ? 0 : engine.applyRecommendedMapping(effect, false)
  })
  const undo = () => {
    if (engine.getCurrentEffect() !== effect || engine.getCustomShaderSource() !== custom) return
    engine.batch(() => {
      r.undo()
      for (const p of skipped) {
        engine.setParamValue(p.key, p.value)
        engine.setParamMapping(p.key, p.source, p.depth, p.lfoRate)
      }
    })
  }
  return { count: r.count, curated, undo }
}
