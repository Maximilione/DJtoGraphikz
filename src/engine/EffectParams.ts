export type AudioSource =
  | 'none' | 'bass' | 'mid' | 'high' | 'energy' | 'beat'
  | 'lfo-sine' | 'lfo-saw' | 'lfo-square'
export const AUDIO_SOURCES: AudioSource[] = [
  'none', 'bass', 'mid', 'high', 'energy', 'beat',
  'lfo-sine', 'lfo-saw', 'lfo-square',
]

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
  /** LFO sources only: beats per cycle (tempo-synced). Default 4 = one bar. */
  lfoRate?: number
}

// Engine-level params available on every effect without touching the shaders:
// speed drives a per-effect time accumulator, reactivity scales the audio uniforms.
export const COMMON_PARAMS: EffectParam[] = [
  { key: 'speed', label: 'Speed', min: 0, max: 3, default: 1 },
  { key: 'reactivity', label: 'React', min: 0, max: 2, default: 1 },
]

// Per-effect curated params. Key == GLSL uniform name in the effect's .frag.
// Defaults reproduce each shader's original hardcoded look exactly.
export const EFFECT_PARAMS: Record<string, EffectParam[]> = {
  tunnel: [
    { key: 'sides', label: 'Sides', min: 3, max: 16, default: 6 },
    { key: 'ringdensity', label: 'Rings', min: 4, max: 30, default: 12 },
    { key: 'twist', label: 'Twist', min: 0, max: 1, default: 0.15 },
  ],
  kaleidoscope: [
    { key: 'segments', label: 'Segments', min: 2, max: 16, default: 4 },
    { key: 'zoom', label: 'Zoom', min: 1, max: 8, default: 3 },
    { key: 'detail', label: 'Detail', min: 2, max: 20, default: 8 },
  ],
  warp: [
    { key: 'zoom', label: 'Zoom', min: 0.4, max: 3, default: 1 },
    { key: 'warpamt', label: 'Warp', min: 0, max: 8, default: 4 },
    { key: 'linefreq', label: 'Lines', min: 5, max: 40, default: 20 },
  ],
  plasma: [
    { key: 'zoom', label: 'Zoom', min: 0.3, max: 3, default: 1 },
    { key: 'ringfreq', label: 'Rings', min: 5, max: 60, default: 30 },
  ],
  matrix: [
    { key: 'cols', label: 'Columns', min: 10, max: 80, default: 40 },
    { key: 'fallspeed', label: 'Fall', min: 0.5, max: 8, default: 2 },
    { key: 'trailfade', label: 'Trail', min: 0.5, max: 6, default: 2 },
  ],
  voronoi: [
    { key: 'cells', label: 'Cells', min: 2, max: 12, default: 4 },
    { key: 'edgewidth', label: 'Edge', min: 0.01, max: 0.3, default: 0.08 },
  ],
  sacred: [
    { key: 'zoom', label: 'Zoom', min: 1, max: 5, default: 2.5 },
    { key: 'radius', label: 'Radius', min: 0.3, max: 0.9, default: 0.5 },
    { key: 'ringfreq', label: 'Rings', min: 5, max: 40, default: 20 },
  ],
  fractal: [
    { key: 'iterations', label: 'Iterations', min: 10, max: 80, default: 40 },
    { key: 'zoom', label: 'Zoom', min: 0.5, max: 3, default: 1.5 },
    { key: 'morph', label: 'Morph', min: 0, max: 0.4, default: 0.15 },
  ],
  particles: [
    { key: 'count', label: 'Count', min: 5, max: 40, default: 20 },
    { key: 'size', label: 'Size', min: 0.002, max: 0.03, default: 0.008 },
    { key: 'spread', label: 'Spread', min: 0.3, max: 1.2, default: 0.6 },
  ],
  starfield: [
    { key: 'tile', label: 'Scale', min: 4, max: 25, default: 10 },
    { key: 'density', label: 'Density', min: 0.05, max: 0.6, default: 0.3 },
  ],
  metaballs: [
    { key: 'count', label: 'Count', min: 3, max: 12, default: 8 },
    { key: 'size', label: 'Size', min: 0.02, max: 0.15, default: 0.06 },
    { key: 'threshold', label: 'Threshold', min: 0.4, max: 2.5, default: 1 },
  ],
  mandala: [
    { key: 'symmetry', label: 'Symmetry', min: 3, max: 16, default: 6 },
    { key: 'ringfreq', label: 'Rings', min: 5, max: 40, default: 20 },
  ],
  grid: [
    { key: 'density', label: 'Density', min: 0.3, max: 3, default: 1 },
    { key: 'fogamt', label: 'Fog', min: 0.03, max: 0.5, default: 0.15 },
    { key: 'wavefreq', label: 'Waves', min: 0.5, max: 6, default: 2 },
  ],
  waves: [
    { key: 'count', label: 'Count', min: 4, max: 40, default: 20 },
    { key: 'amp', label: 'Height', min: 0.01, max: 0.12, default: 0.03 },
    { key: 'freq', label: 'Frequency', min: 1, max: 10, default: 3 },
  ],
  lissajous: [
    { key: 'freqa', label: 'Freq A', min: 1, max: 8, default: 2 },
    { key: 'freqb', label: 'Freq B', min: 1, max: 8, default: 3 },
    { key: 'size', label: 'Size', min: 0.15, max: 0.6, default: 0.35 },
  ],
  fluid: [
    { key: 'zoom', label: 'Zoom', min: 0.5, max: 5, default: 2 },
    { key: 'swirl', label: 'Swirl', min: 0, max: 3, default: 1 },
  ],
  glitch: [
    { key: 'blocks', label: 'Blocks', min: 4, max: 40, default: 10 },
    { key: 'intensity', label: 'Intensity', min: 0, max: 3, default: 1 },
    { key: 'fps', label: 'Stutter', min: 2, max: 30, default: 15 },
  ],
  rings: [
    { key: 'ringcount', label: 'Count', min: 3, max: 16, default: 8 },
    { key: 'spacing', label: 'Spacing', min: 0.03, max: 0.2, default: 0.08 },
    { key: 'gapfreq', label: 'Gaps', min: 0, max: 8, default: 3 },
  ],
  fire: [
    { key: 'falloff', label: 'Falloff', min: 0.4, max: 1.5, default: 0.8 },
    { key: 'turbulence', label: 'Turbulence', min: 0, max: 1.5, default: 0.5 },
    { key: 'sparks', label: 'Sparks', min: 0, max: 16, default: 8 },
  ],
  hexagons: [
    { key: 'zoom', label: 'Zoom', min: 2, max: 12, default: 5 },
    { key: 'wavefreq', label: 'Waves', min: 1, max: 15, default: 5 },
  ],
  lasers: [
    { key: 'beams', label: 'Beams', min: 2, max: 12, default: 6 },
    { key: 'spread', label: 'Spread', min: 0.2, max: 1.5, default: 0.8 },
    { key: 'sweep', label: 'Sweep', min: 0, max: 2, default: 0.8 },
  ],
  strobegrid: [
    { key: 'cells', label: 'Cells', min: 4, max: 32, default: 12 },
    { key: 'litratio', label: 'Lit', min: 0.05, max: 0.8, default: 0.3 },
    { key: 'chaos', label: 'Chaos', min: 0, max: 1, default: 0.5 },
  ],
  vortex: [
    { key: 'arms', label: 'Arms', min: 1, max: 8, default: 3 },
    { key: 'twist', label: 'Twist', min: 0, max: 3, default: 1.2 },
    { key: 'pull', label: 'Pull', min: 0, max: 2, default: 0.8 },
  ],
  terrain: [
    { key: 'ridges', label: 'Ridges', min: 4, max: 24, default: 10 },
    { key: 'horizon', label: 'Horizon', min: 0.25, max: 0.75, default: 0.45 },
    { key: 'glowamt', label: 'Glow', min: 0, max: 2, default: 1 },
  ],
  orbits: [
    { key: 'bodies', label: 'Bodies', min: 2, max: 16, default: 7 },
    { key: 'orbitr', label: 'Radius', min: 0.2, max: 1, default: 0.55 },
    { key: 'trail', label: 'Trail', min: 0, max: 1, default: 0.5 },
  ],
  shatter: [
    { key: 'shards', label: 'Shards', min: 4, max: 30, default: 14 },
    { key: 'burst', label: 'Burst', min: 0, max: 2, default: 1 },
    { key: 'edgeglow', label: 'Edges', min: 0, max: 2, default: 0.8 },
  ],
  moire: [
    { key: 'density', label: 'Density', min: 10, max: 120, default: 50 },
    { key: 'moireoff', label: 'Offset', min: 0.01, max: 0.5, default: 0.12 },
    { key: 'rotspeed', label: 'Rotation', min: 0, max: 2, default: 0.4 },
  ],
  pulsecity: [
    { key: 'columns', label: 'Towers', min: 6, max: 48, default: 20 },
    { key: 'gapw', label: 'Gap', min: 0.02, max: 0.5, default: 0.15 },
    { key: 'punch', label: 'Punch', min: 0, max: 2, default: 1 },
  ],
  neonpoly: [
    { key: 'sides', label: 'Sides', min: 3, max: 9, default: 5 },
    { key: 'layers', label: 'Layers', min: 1, max: 8, default: 5 },
    { key: 'thickness', label: 'Width', min: 0.2, max: 3, default: 1 },
  ],
  inkflow: [
    { key: 'inkscale', label: 'Scale', min: 1, max: 6, default: 2.5 },
    { key: 'flowspd', label: 'Flow', min: 0, max: 2, default: 0.6 },
    { key: 'inkcontrast', label: 'Contrast', min: 0.5, max: 2.5, default: 1.2 },
  ],
  raymarch: [
    { key: 'repscale', label: 'Density', min: 0.5, max: 4, default: 2 },
    { key: 'glowk', label: 'Glow', min: 0, max: 2, default: 1 },
    { key: 'camfov', label: 'FOV', min: 0.6, max: 1.6, default: 1 },
  ],
  ripples: [
    { key: 'spreadv', label: 'Spread', min: 0.5, max: 3, default: 1.5 },
    { key: 'heightk', label: 'Height', min: 0.2, max: 2.5, default: 1 },
    { key: 'sheen', label: 'Sheen', min: 0, max: 2, default: 1 },
  ],
  dna: [
    { key: 'coils', label: 'Coils', min: 3, max: 16, default: 8 },
    { key: 'amp', label: 'Width', min: 0.05, max: 0.3, default: 0.12 },
  ],
}
