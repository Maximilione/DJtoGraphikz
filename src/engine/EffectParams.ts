export type AudioSource = 'none' | 'bass' | 'mid' | 'high' | 'energy' | 'beat'
export const AUDIO_SOURCES: AudioSource[] = ['none', 'bass', 'mid', 'high', 'energy', 'beat']

export interface EffectParam {
  key: string      // uniform name (custom shaders) or engine param ('speed', 'reactivity')
  label: string
  min: number
  max: number
  default: number
}

/** Live value + audio mapping for one param. depth -1..1 modulates over the full range. */
export interface ParamState {
  value: number
  source: AudioSource
  depth: number
}

// Engine-level params available on every effect without touching the shaders:
// speed drives a per-effect time accumulator, reactivity scales the audio uniforms.
export const COMMON_PARAMS: EffectParam[] = [
  { key: 'speed', label: 'Speed', min: 0, max: 3, default: 1 },
  { key: 'reactivity', label: 'React', min: 0, max: 2, default: 1 },
]
