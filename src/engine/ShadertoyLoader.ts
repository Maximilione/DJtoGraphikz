import type { EffectParam } from './EffectParams'

export interface ShadertoyResult {
  fragment: string
  params: EffectParam[]
  name: string
  warnings: string[]
  imageInputs: string[]
}

/**
 * Import a Shadertoy shader.
 *
 * Two shapes are accepted, because two are all anyone has:
 * - raw GLSL with a `mainImage(out vec4, in vec2)` — what the site's editor
 *   shows, and what a copy-paste gives you. Single pass.
 * - the JSON the Shadertoy API returns (`{Shader:{renderpass:[...]}}`), which
 *   is the only way to get a shader's Buffer A–D. Each buffer becomes an
 *   engine buffer pass; `iChannelN` is wired to whatever that pass reads.
 *
 * ponytail: sound passes and cubemaps are skipped with a warning — there is
 * nothing in this app to render them into.
 */

const CHANNELS = [0, 1, 2, 3]
const BUFFER_LETTERS = ['A', 'B', 'C', 'D']

function preludeFor(channelMap: Record<number, string>, bufferNames: string[], imageChannels: string[]): string {
  const channelDefs = CHANNELS.map(c => {
    const buf = channelMap[c]
    if (buf) return `#define iChannel${c} tBuffer${buf}`
    return imageChannels.includes(`iChannel${c}`) ? '' : `uniform sampler2D iChannel${c};`
  }).filter(Boolean).join('\n')

  return `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;
uniform float uFrame;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
${bufferNames.map(n => `uniform sampler2D tBuffer${n};\nuniform vec2 uBuffer${n}Size;`).join('\n')}
${imageChannels.map(n => `uniform sampler2D ${n};`).join('\n')}
${channelDefs}
// Shadertoy built-ins. iResolution and iMouse are #defines, not globals: GLSL ES
// forbids initialising a global from a uniform, and every Shadertoy shader
// reads them as plain expressions anyway.
#define iResolution vec3(uResolution, 1.0)
#define iTime uTime
#define iTimeDelta (1.0 / 60.0)
#define iFrameRate 60.0
#define iFrame int(uFrame)
#define iSampleRate 44100.0
#define iDate vec4(2026.0, 1.0, 1.0, uTime)
// no mouse on a projector: a slow Lissajous drift keeps mouse-driven shaders alive
#define iMouse vec4(uResolution * (0.5 + 0.24 * vec2(sin(uTime * 0.31), cos(uTime * 0.23))), 0.0, 0.0)
vec3 iChannelResolution[4];
float iChannelTime[4];
`
}

const MAIN_WRAPPER = `
void main() {
  for (int i = 0; i < 4; i++) { iChannelResolution[i] = vec3(uResolution, 1.0); iChannelTime[i] = uTime; }
  vec4 djgOut = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(djgOut, gl_FragCoord.xy);
  gl_FragColor = vec4(djgOut.rgb, 1.0);
}
`

function hasMainImage(code: string): boolean {
  return /\bvoid\s+mainImage\s*\(/.test(code)
}

export function loadShadertoy(source: string, fileName = 'Shadertoy'): ShadertoyResult | { error: string } {
  const trimmed = source.trim()
  const warnings: string[] = []

  // ---- plain GLSL paste: one pass ----
  if (!trimmed.startsWith('{')) {
    if (!hasMainImage(trimmed)) {
      return { error: 'Non sembra uno shader Shadertoy: manca void mainImage(out vec4, in vec2)' }
    }
    const used = CHANNELS.filter(c => trimmed.includes(`iChannel${c}`)).map(c => `iChannel${c}`)
    if (used.length) warnings.push(`${used.length} iChannel: scegli tu le immagini`)
    return {
      fragment: preludeFor({}, [], used) + trimmed + MAIN_WRAPPER,
      params: [], name: fileName, warnings, imageInputs: used,
    }
  }

  // ---- API JSON: buffers become engine buffer passes ----
  let json: any
  try {
    json = JSON.parse(trimmed)
  } catch (e: any) {
    return { error: `JSON non valido: ${e.message}` }
  }
  const shader = Array.isArray(json) ? json[0]?.Shader ?? json[0] : json.Shader ?? json
  const renderpass: any[] = shader?.renderpass
  if (!Array.isArray(renderpass) || renderpass.length === 0) {
    return { error: 'JSON Shadertoy senza renderpass' }
  }

  const common = renderpass.filter(p => p.type === 'common').map(p => p.code || '').join('\n')
  const buffers = renderpass.filter(p => p.type === 'buffer')
  const image = renderpass.find(p => p.type === 'image')
  if (!image) return { error: 'Nessun pass "image": non c\'e\' niente da mostrare' }
  for (const p of renderpass) {
    if (p.type !== 'common' && p.type !== 'buffer' && p.type !== 'image') {
      warnings.push(`pass "${p.type}" ignorato`)
    }
  }
  if (buffers.length > BUFFER_LETTERS.length) {
    return { error: `${buffers.length} buffer: il massimo e' ${BUFFER_LETTERS.length}` }
  }

  // output id → buffer letter, so a pass reading another pass finds it
  const byOutputId = new Map<string, string>()
  buffers.forEach((p, i) => {
    const id = String(p.outputs?.[0]?.id ?? '')
    if (id) byOutputId.set(id, BUFFER_LETTERS[i])
  })
  const bufferNames = buffers.map((_, i) => BUFFER_LETTERS[i])

  const imageChannels = new Set<string>()
  const channelMapOf = (pass: any): Record<number, string> => {
    const map: Record<number, string> = {}
    for (const inp of pass.inputs ?? []) {
      const ch = Number(inp.channel)
      if (!CHANNELS.includes(ch)) continue
      const buf = byOutputId.get(String(inp.id))
      if (buf) map[ch] = buf
      else if (inp.ctype === 'texture' || inp.ctype === 'image') imageChannels.add(`iChannel${ch}`)
      else warnings.push(`input "${inp.ctype}" sul canale ${ch} non supportato`)
    }
    return map
  }

  const maps = [...buffers, image].map(channelMapOf)
  const imgList = [...imageChannels]

  const section = (pass: any, map: Record<number, string>) => {
    const code = `${common}\n${pass.code || ''}`
    if (!hasMainImage(code)) return null
    return preludeFor(map, bufferNames, imgList) + code + MAIN_WRAPPER
  }

  const parts: string[] = []
  for (let i = 0; i < buffers.length; i++) {
    const body = section(buffers[i], maps[i])
    if (!body) return { error: `Buffer ${BUFFER_LETTERS[i]} senza mainImage` }
    parts.push(`//!DJG_BUFFER ${BUFFER_LETTERS[i]}\n${body}`)
  }
  const imageBody = section(image, maps[maps.length - 1])
  if (!imageBody) return { error: 'Il pass "image" non ha mainImage' }
  parts.push(`//!DJG_MAIN\n${imageBody}`)

  if (buffers.length) warnings.push(`${buffers.length} buffer + image`)
  if (imgList.length) warnings.push(`${imgList.length} iChannel: scegli tu le immagini`)

  return {
    fragment: parts.join('\n'),
    params: [],
    name: shader?.info?.name || fileName,
    warnings,
    imageInputs: imgList,
  }
}
