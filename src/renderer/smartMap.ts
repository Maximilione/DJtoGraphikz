import type { Engine } from '@engine/Engine'
import type { AudioSource } from '@engine/EffectParams'

// Smart mapping v2: decide an audio source for each param of the active effect
// from (1) its name, (2) HOW the shader actually uses it — which variables it
// touches, whether it gates branches, scales coordinates, feeds colors — and
// (3) a role budget so the result reads musically instead of everything
// strobing on the same band.

type Pick = { source: AudioSource; depth: number; lfoRate?: number }
type Rule = { re: RegExp } & Pick

// Ordered by specificity — first match wins
const NAME_RULES: Rule[] = [
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

// speed warps the time accumulator, reactivity already scales the audio uniforms
const SKIP = new Set(['speed', 'reactivity'])

/** How the shader body uses a uniform — the lines that mention it, summarized */
function analyzeUsage(src: string, key: string) {
  const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
  const lines = src.split('\n').filter(l =>
    re.test(l) && !/^\s*uniform\b|^\s*#define\b|^\s*varying\b/.test(l))
  const ctx = lines.join(' ')
  return {
    uses: lines.length,
    geom: /\b(uv|st|coord|pos|p|xy|dist|len)\b/.test(ctx),
    color: /\b(col|color|rgb|rgba|hsv|hue|gl_FragColor)\b/i.test(ctx),
    timed: /\b(uTime|TIME|time|t)\b/.test(ctx),
    trig: /\b(sin|cos)\s*\(/.test(ctx),
    gate: /\b(step|smoothstep|if|mix)\s*\(?/.test(ctx),
  }
}

function pickByUsage(u: ReturnType<typeof analyzeUsage>): Pick {
  // gates/thresholds read as on-off — punch them on the beat
  if (u.gate && !u.geom) return { source: 'beat', depth: 0.7 }
  // phase-like: feeds sin/cos together with time — glide, don't jitter
  if (u.trig && u.timed) return { source: 'lfo-saw', depth: 0.4, lfoRate: 8 }
  // scales space → the kick should move space
  if (u.geom) return { source: 'bass', depth: 0.5 }
  // feeds colors → slow drift looks intentional, audio jitter looks broken
  if (u.color) return { source: 'lfo-sine', depth: 0.4, lfoRate: 32 }
  if (u.timed) return { source: 'energy', depth: 0.4 }
  if (u.trig) return { source: 'lfo-sine', depth: 0.4, lfoRate: 8 }
  return { source: 'energy', depth: 0.45 }
}

const AUDIO_BANDS = new Set<AudioSource>(['bass', 'mid', 'high', 'energy', 'beat'])
const LFO_RATES = [4, 8, 16, 32]

export interface SmartMapResult {
  count: number
  /** restore values and mappings as they were before */
  undo: () => void
}

export function smartMap(engine: Engine): SmartMapResult {
  const src = engine.getCustomShaderSource()
  const prev: { key: string; value: number; source: AudioSource; depth: number; lfoRate?: number }[] = []

  // Pass 1 — score and pick per param
  const picks: { key: string; min: number; max: number; pick: Pick; impact: number }[] = []
  for (const def of engine.getParamDefs()) {
    if (SKIP.has(def.key)) continue
    const st = engine.getParamState(def.key)
    prev.push({ key: def.key, value: st.value, source: st.source, depth: st.depth, lfoRate: st.lfoRate })

    const isBool = def.min === 0 && def.max === 1 && Number.isInteger(def.default)
    const named = NAME_RULES.find(r => r.re.test(def.key) || r.re.test(def.label))
    // ISF long inputs expose "<name>_f" as param key but the body uses "<name>"
    const usage = src ? analyzeUsage(src, def.key.replace(/_f$/, '')) : null
    const pick: Pick = isBool ? { source: 'beat', depth: 1 }
      : named ? { source: named.source, depth: named.depth, lfoRate: named.lfoRate }
      : usage && usage.uses > 0 ? pickByUsage(usage)
      : { source: 'energy', depth: 0.45 }
    // heavily-used uniforms swing the whole image — modulate them more gently
    const impact = usage ? usage.uses : 1
    if (impact >= 4) pick.depth = Math.max(0.25, pick.depth * 0.7)
    picks.push({ key: def.key, min: def.min, max: def.max, pick, impact })
  }

  // Pass 2 — role budget: max 2 params per audio band; extras (least impactful
  // first stay, most redundant demoted) become staggered LFOs so the result
  // breathes instead of everything strobing together
  const bandCount = new Map<AudioSource, number>()
  let li = 0
  for (const p of picks.sort((a, b) => b.impact - a.impact)) {
    const s = p.pick.source
    if (AUDIO_BANDS.has(s)) {
      const n = (bandCount.get(s) || 0) + 1
      bandCount.set(s, n)
      if (n > 2) {
        p.pick = { source: li % 2 ? 'lfo-sine' : 'lfo-saw', depth: p.pick.depth * 0.8, lfoRate: LFO_RATES[li % LFO_RATES.length] }
        li++
      }
    }
  }

  // Pass 3 — apply, giving positive modulation headroom
  for (const p of picks) {
    const st = engine.getParamState(p.key)
    const range = p.max - p.min
    const isBool = p.min === 0 && p.max === 1
    if (!isBool && st.value > p.min + 0.65 * range) {
      engine.setParamValue(p.key, p.min + 0.35 * range)
    }
    engine.setParamMapping(p.key, p.pick.source, p.pick.depth, p.pick.lfoRate)
  }

  return {
    count: picks.length,
    undo: () => {
      for (const p of prev) {
        engine.setParamValue(p.key, p.value)
        engine.setParamMapping(p.key, p.source, p.depth, p.lfoRate)
      }
    },
  }
}
