import type { Engine, EffectId } from '@engine/Engine'
import { readJson, writeJson } from './storage'

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
