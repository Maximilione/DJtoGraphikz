import { readJson, writeJson } from './storage'
import type { LoadedPlugin } from '../shared/plugins'

/**
 * Plugin dichiarativi (docs/PLUGINS.md): il main li valida e li legge, qui si
 * tiene l'elenco e quali sono attivi. Un plugin nuovo parte DISATTIVATO:
 * l'utente lo accende dal pannello. Solo dati, mai codice.
 */
const KEY = 'djtographikz-plugins-enabled'
let plugins: LoadedPlugin[] = []
let enabled: Record<string, boolean> = readJson<Record<string, boolean>>(KEY, {})
const listeners = new Set<() => void>()
const emit = () => { for (const fn of listeners) fn() }

export const getPlugins = () => plugins
export const isPluginEnabled = (id: string) => !!id && enabled[id] === true
export const onPlugins = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

export function setPluginEnabled(id: string, on: boolean) {
  enabled = { ...enabled, [id]: on }
  writeJson(KEY, enabled)
  emit()
}

export async function refreshPlugins(): Promise<void> {
  try {
    const list = await window.api?.listPlugins?.()
    plugins = Array.isArray(list) ? list : []
  } catch {
    plugins = []   // IPC non disponibile (preload vecchio): nessun plugin, l'app va avanti
  }
  emit()
}

export const activePlugins = () => plugins.filter(p => p.status === 'ok' && isPluginEnabled(p.id))

export function activePluginPalettes(): { label: string; colors: [string, string, string]; plugin: true }[] {
  return activePlugins().flatMap(p => p.palettes.map(x => ({ label: x.label, colors: x.colors, plugin: true as const })))
}

void refreshPlugins()
