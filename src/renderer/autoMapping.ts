import type { Engine, EffectId } from '@engine/Engine'
import { readJson, writeJson } from './storage'
import { smartMap } from './smartMap'

/**
 * "Mapping consigliato al cambio effetto": quando l'utente sceglie un effetto
 * a mano (griglia, tasti 1-0, telefono) l'effetto arriva gia' collegato
 * all'audio col suo preset. L'Auto VJ, le scalette e i look non passano di
 * qui — portano il loro mapping e chiamano `engine.setEffect` direttamente.
 */
const KEY = 'djtographikz-mapping-consigliato'
let enabled = readJson<boolean>(KEY, true)

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
 * L'undo di smartMap basta per annullare entrambi: ha salvato lo stato PRIMA
 * di ogni modifica, e il preset curato tocca solo chiavi dello stesso universo.
 */
export function magicMap(engine: Engine): MagicMapResult {
  const r = smartMap(engine)
  const curated = engine.applyRecommendedMapping(engine.getCurrentEffect(), false)
  return { count: r.count, curated, undo: r.undo }
}
