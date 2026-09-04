import type { Engine } from '@engine/Engine'
import type { AudioSource } from '@engine/EffectParams'

// Smart mapping: guess an audio source for each param of the active effect
// (stock or ISF) from its name; round-robin fallback so everything reacts.

type Rule = { re: RegExp; source: AudioSource; depth: number; lfoRate?: number }

// Ordered by specificity — first match wins
const RULES: Rule[] = [
  { re: /beat|pulse|flash|strobe|kick|bang|trig/i, source: 'beat', depth: 0.8 },
  { re: /glitch|noise|distort|chaos|shake|jitter|grain/i, source: 'high', depth: 0.6 },
  { re: /twist|rot|angle|spin|swirl|turn/i, source: 'lfo-sine', depth: 0.5, lfoRate: 8 },
  { re: /hue|colou?r|sat|tint|palette/i, source: 'lfo-sine', depth: 0.4, lfoRate: 32 },
  { re: /offset|shift|slide|scroll|pan\b|movement/i, source: 'lfo-saw', depth: 0.3, lfoRate: 16 },
  { re: /phase|cycle|wave/i, source: 'lfo-saw', depth: 0.4, lfoRate: 8 },
  { re: /zoom|scale|size|radius|amp|width|height|thick/i, source: 'bass', depth: 0.5 },
  { re: /bright|intens|glow|light|exposure|gain|amount|alpha|opacity|level|power|strength/i, source: 'energy', depth: 0.6 },
  { re: /detail|iter|count|num|segment|density|complex|freq|steps|division/i, source: 'mid', depth: 0.4 },
  { re: /speed|rate|vel|flow|time/i, source: 'energy', depth: 0.4 },
]
const FALLBACK: AudioSource[] = ['bass', 'high', 'mid', 'energy', 'beat']

// speed warps the time accumulator, reactivity already scales the audio uniforms
const SKIP = new Set(['speed', 'reactivity'])

export interface SmartMapResult {
  count: number
  /** restore values and mappings as they were before */
  undo: () => void
}

export function smartMap(engine: Engine): SmartMapResult {
  const prev: { key: string; value: number; source: AudioSource; depth: number; lfoRate?: number }[] = []
  let fi = 0
  let count = 0
  for (const def of engine.getParamDefs()) {
    if (SKIP.has(def.key)) continue
    const st = engine.getParamState(def.key)
    prev.push({ key: def.key, value: st.value, source: st.source, depth: st.depth, lfoRate: st.lfoRate })

    const range = def.max - def.min
    // bool-style params (0/1): pulse them on the beat
    const isBool = def.min === 0 && def.max === 1 && Number.isInteger(def.default)
    const rule = isBool
      ? { source: 'beat' as AudioSource, depth: 1, lfoRate: undefined }
      : RULES.find(r => r.re.test(def.key) || r.re.test(def.label))
        ?? { source: FALLBACK[fi++ % FALLBACK.length], depth: 0.45, lfoRate: undefined }

    // positive modulation needs headroom: pull the base down if it sits high
    if (!isBool && st.value > def.min + 0.65 * range) {
      engine.setParamValue(def.key, def.min + 0.35 * range)
    }
    engine.setParamMapping(def.key, rule.source, rule.depth, rule.lfoRate)
    count++
  }
  return {
    count,
    undo: () => {
      for (const p of prev) {
        engine.setParamValue(p.key, p.value)
        engine.setParamMapping(p.key, p.source, p.depth, p.lfoRate)
      }
    },
  }
}
