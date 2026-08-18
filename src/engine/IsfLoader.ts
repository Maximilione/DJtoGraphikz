import type { EffectParam } from './EffectParams'

export interface IsfResult {
  fragment: string
  params: EffectParam[]
  name: string
  warnings: string[]
}

// ponytail: generator-only ISF support (float/bool inputs). Filters, audio
// inputs, multi-pass, imported textures → clear error, add if ever needed.

const UNSUPPORTED_TYPES = new Set(['image', 'audio', 'audioFFT', 'event', 'point2D', 'color', 'long'])

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

  // Generators only — filters and multi-pass need infrastructure we don't have
  if (/\binputImage\b|\bIMG_THIS_PIXEL\b|\bIMG_PIXEL\b|\bIMG_NORM_PIXEL\b|\bIMG_SIZE\b/.test(body)) {
    return { error: 'Questo ISF è un filtro (usa inputImage) — supportiamo solo i generator' }
  }
  if (Array.isArray(meta.PASSES) && meta.PASSES.length > 1) {
    return { error: 'ISF multi-pass non supportato' }
  }

  const warnings: string[] = []
  const params: EffectParam[] = []
  const uniformDecls: string[] = []

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
${uniformDecls.join('\n')}
`

  return {
    fragment: prelude + body,
    params,
    name: meta.DESCRIPTION || fileName,
    warnings,
  }
}
