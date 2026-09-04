import type { EffectParam } from './EffectParams'

export interface IsfResult {
  fragment: string
  params: EffectParam[]
  name: string
  warnings: string[]
  /** sampler2D inputs (ISF type "image") — the user picks a picture for each */
  imageInputs: string[]
}

// ponytail: generator-only ISF support (float/bool inputs). Filters, audio
// inputs, multi-pass, imported textures → clear error, add if ever needed.

const UNSUPPORTED_TYPES = new Set(['audio', 'audioFFT'])

const fnum = (v: unknown, d: number) => {
  const n = typeof v === 'number' && isFinite(v) ? v : d
  return Number.isInteger(n) ? n.toFixed(1) : String(n)
}

/**
 * GLSL ES forbids non-constant global initializers (fine on desktop GL, where
 * most ISF shaders were written). Split `float x = TIME * 2.;` at global scope
 * into a bare declaration + an assignment injected at the top of main().
 */
function hoistGlobalInits(body: string): { body: string; inits: string[] } {
  const inits: string[] = []
  let depth = 0
  const lines = body.split('\n').map(line => {
    const code = line.replace(/\/\/.*$/, '')
    const d = depth
    depth += (code.match(/\{/g) || []).length - (code.match(/\}/g) || []).length
    if (d !== 0) return line
    const m = code.match(/^\s*(const\s+)?(float|int|bool|vec[234]|mat[234])\s+([A-Za-z_]\w*)\s*=\s*(.+);\s*$/)
    if (!m) return line
    // constant expressions (numbers, constructors of numbers) are legal — keep
    const refs = m[4].replace(/\b(vec[234]|mat[234]|float|int|bool)\s*\(/g, '(')
    if (!/[A-Za-z_]/.test(refs)) return line
    inits.push(`${m[3]} = ${m[4]};`)
    return `${m[2]} ${m[3]};` // const dropped: it gets assigned in main
  })
  return { body: lines.join('\n'), inits }
}

/** Inject statements at the top of main() */
function injectMain(body: string, stmts: string[]): string {
  if (stmts.length === 0) return body
  return body.replace(/void\s+main\s*\(\s*(void)?\s*\)\s*\{/, m => m + '\n  ' + stmts.join('\n  '))
}

/**
 * Parse an ISF fragment shader: read the JSON header, turn float/bool INPUTS
 * into engine params, and transpile the body to our shader conventions.
 */
export function loadISF(source: string, fileName = 'ISF'): IsfResult | { error: string } {
  // ISF metadata lives in the first /*{ ... }*/ comment block
  const match = source.match(/\/\*\s*(\{[\s\S]*?\})\s*\*\//)
  if (!match) return { error: 'Header JSON ISF non trovato (blocco /*{...}*/)' }

  let meta: any
  try {
    meta = JSON.parse(match[1])
  } catch (e: any) {
    return { error: `Header ISF non è JSON valido: ${e.message}` }
  }

  const body = source.replace(match[0], '')

  // True filters only — generators that sample their own image INPUTS are fine
  // (IMG_* is mapped to texture2D in the prelude)
  if (/\binputImage\b/.test(body)) {
    return { error: 'Questo ISF è un filtro (usa inputImage) — supportiamo solo i generator' }
  }
  if (Array.isArray(meta.PASSES) && meta.PASSES.length > 1) {
    return { error: 'ISF multi-pass non supportato' }
  }

  const warnings: string[] = []
  const params: EffectParam[] = []
  const uniformDecls: string[] = []
  const imageInputs: string[] = []
  const mainInits: string[] = []

  for (const input of meta.INPUTS ?? []) {
    const name = input.NAME
    if (!name) continue
    const type = input.TYPE ?? 'float'

    if (type === 'float' || type === 'bool') {
      const min = type === 'bool' ? 0 : (typeof input.MIN === 'number' ? input.MIN : 0)
      const max = type === 'bool' ? 1 : (typeof input.MAX === 'number' ? input.MAX : 1)
      const def = typeof input.DEFAULT === 'number' ? input.DEFAULT
        : input.DEFAULT === true ? 1
        : min
      uniformDecls.push(`uniform ${type === 'bool' ? 'bool' : 'float'} ${name};`)
      // bool uniforms are driven with 0/1 floats; three.js coerces on upload
      params.push({ key: name, label: input.LABEL || name, min, max, default: Math.max(min, Math.min(max, def)) })
    } else if (type === 'long') {
      // dropdown-style int: expose as a stepless float slider over VALUES range
      const vals: number[] = Array.isArray(input.VALUES) && input.VALUES.length ? input.VALUES : [0, 1]
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const def = typeof input.DEFAULT === 'number' ? input.DEFAULT : min
      uniformDecls.push(`uniform float ${name}_f;\n#define ${name} int(${name}_f + 0.5)`)
      params.push({ key: `${name}_f`, label: input.LABEL || name, min, max, default: Math.max(min, Math.min(max, def)) })
    } else if (type === 'color') {
      // plain global (not #define, not uniform): assignable, constant init is
      // legal — palette already drives the look via uColor1-3
      const d = Array.isArray(input.DEFAULT) ? input.DEFAULT : [1, 1, 1, 1]
      uniformDecls.push(`vec4 ${name} = vec4(${fnum(d[0], 1)}, ${fnum(d[1], 1)}, ${fnum(d[2], 1)}, ${fnum(d[3], 1)});`)
      warnings.push(`input colore "${name}" fissato al default`)
    } else if (type === 'point2D') {
      const d = Array.isArray(input.DEFAULT) ? input.DEFAULT : [0.5, 0.5]
      uniformDecls.push(`vec2 ${name} = vec2(${fnum(d[0], 0.5)}, ${fnum(d[1], 0.5)});`)
      if (/mouse|cursor|pointer|touch/i.test(name)) {
        // no mouse on a projector — slow Lissajous drift around the default.
        // Defaults ≤1 are normalized coords, bigger ones are pixels (ISF allows both)
        const norm = Math.abs(Number(d[0]) || 0) <= 1 && Math.abs(Number(d[1]) || 0) <= 1
        const amp = norm ? '0.25' : '0.25 * uResolution'
        mainInits.push(`${name} += ${amp} * vec2(sin(uTime * 0.31), cos(uTime * 0.23));`)
        warnings.push(`input point2D "${name}" animato in automatico`)
      } else {
        warnings.push(`input point2D "${name}" fissato al default`)
      }
    } else if (type === 'image') {
      uniformDecls.push(`uniform sampler2D ${name};`)
      imageInputs.push(name)
    } else if (type === 'event') {
      // one-shot triggers need per-frame plumbing we don't have — map to beat
      uniformDecls.push(`bool ${name} = false;`)
      mainInits.push(`${name} = uBeat > 0.5;`)
      warnings.push(`input event "${name}" mappato sul beat`)
    } else if (UNSUPPORTED_TYPES.has(type)) {
      warnings.push(`input "${name}" (${type}) ignorato`)
      // declare it anyway with a neutral value so the shader still compiles?
      // No — undeclared use would fail loudly, which is more honest. If the
      // body references it, compilation reports the missing symbol.
    }
  }

  // Compatibility prelude: ISF built-ins mapped onto our uniforms
  const prelude = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
#define TIME uTime
#define RENDERSIZE uResolution
#define isf_FragNormCoord vUv
#define vv_FragNormCoord vUv
#define FRAMEINDEX int(uTime * 60.0)
#define PASSINDEX 0
#define TIMEDELTA (1.0 / 60.0)
#define DATE vec4(2026.0, 1.0, 1.0, uTime)
#define IMG_NORM_PIXEL(i,c) texture2D(i,c)
#define IMG_PIXEL(i,c) texture2D(i,(c)/uResolution)
#define IMG_THIS_NORM_PIXEL(i) texture2D(i,vUv)
#define IMG_THIS_PIXEL(i) texture2D(i,vUv)
#define IMG_SIZE(i) uResolution
${uniformDecls.join('\n')}
`

  const hoisted = hoistGlobalInits(body)
  return {
    // input drifts first: hoisted globals may reference them
    fragment: prelude + injectMain(hoisted.body, [...mainInits, ...hoisted.inits]),
    params,
    name: meta.DESCRIPTION || fileName,
    warnings,
    imageInputs,
  }
}
