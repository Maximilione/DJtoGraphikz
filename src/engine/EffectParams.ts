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
  { key: 'speed', label: 'Velocità', min: 0, max: 3, default: 1 },
  { key: 'reactivity', label: 'Reazione', min: 0, max: 2, default: 1 },
]

// Per-effect curated params. Key == GLSL uniform name in the effect's .frag.
// Defaults reproduce each shader's original hardcoded look exactly.
export const EFFECT_PARAMS: Record<string, EffectParam[]> = {
  tunnel: [
    { key: 'sides', label: 'Lati', min: 3, max: 16, default: 6 },
    { key: 'ringdensity', label: 'Anelli', min: 4, max: 30, default: 12 },
    { key: 'twist', label: 'Torsione', min: 0, max: 1, default: 0.15 },
  ],
  kaleidoscope: [
    { key: 'segments', label: 'Segmenti', min: 2, max: 16, default: 4 },
    { key: 'zoom', label: 'Zoom', min: 1, max: 8, default: 3 },
    { key: 'detail', label: 'Dettaglio', min: 2, max: 20, default: 8 },
  ],
  warp: [
    { key: 'zoom', label: 'Zoom', min: 0.4, max: 3, default: 1 },
    { key: 'warpamt', label: 'Distorsione', min: 0, max: 8, default: 4 },
    { key: 'linefreq', label: 'Linee', min: 5, max: 40, default: 20 },
  ],
  plasma: [
    { key: 'zoom', label: 'Zoom', min: 0.3, max: 3, default: 1 },
    { key: 'ringfreq', label: 'Anelli', min: 5, max: 60, default: 30 },
  ],
  matrix: [
    { key: 'cols', label: 'Colonne', min: 10, max: 80, default: 40 },
    { key: 'fallspeed', label: 'Caduta', min: 0.5, max: 8, default: 2 },
    { key: 'trailfade', label: 'Scia', min: 0.5, max: 6, default: 2 },
  ],
  voronoi: [
    { key: 'cells', label: 'Celle', min: 2, max: 12, default: 4 },
    { key: 'edgewidth', label: 'Bordo', min: 0.01, max: 0.3, default: 0.08 },
  ],
  sacred: [
    { key: 'zoom', label: 'Zoom', min: 1, max: 5, default: 2.5 },
    { key: 'radius', label: 'Raggio', min: 0.3, max: 0.9, default: 0.5 },
    { key: 'ringfreq', label: 'Anelli', min: 5, max: 40, default: 20 },
  ],
  fractal: [
    { key: 'iterations', label: 'Iterazioni', min: 10, max: 80, default: 40 },
    { key: 'zoom', label: 'Zoom', min: 0.5, max: 3, default: 1.5 },
    { key: 'morph', label: 'Muta', min: 0, max: 0.4, default: 0.15 },
  ],
  particles: [
    { key: 'count', label: 'Quantità', min: 5, max: 40, default: 20 },
    { key: 'size', label: 'Dimensione', min: 0.002, max: 0.03, default: 0.008 },
    { key: 'spread', label: 'Diffusione', min: 0.3, max: 1.2, default: 0.6 },
  ],
  starfield: [
    { key: 'tile', label: 'Scala', min: 4, max: 25, default: 10 },
    { key: 'density', label: 'Densità', min: 0.05, max: 0.6, default: 0.3 },
  ],
  metaballs: [
    { key: 'count', label: 'Quantità', min: 3, max: 12, default: 8 },
    { key: 'size', label: 'Dimensione', min: 0.02, max: 0.15, default: 0.06 },
    { key: 'threshold', label: 'Soglia', min: 0.4, max: 2.5, default: 1 },
  ],
  mandala: [
    { key: 'symmetry', label: 'Simmetria', min: 3, max: 16, default: 6 },
    { key: 'ringfreq', label: 'Anelli', min: 5, max: 40, default: 20 },
  ],
  grid: [
    { key: 'density', label: 'Densità', min: 0.3, max: 3, default: 1 },
    { key: 'fogamt', label: 'Nebbia', min: 0.03, max: 0.5, default: 0.15 },
    { key: 'wavefreq', label: 'Onde', min: 0.5, max: 6, default: 2 },
  ],
  waves: [
    { key: 'count', label: 'Quantità', min: 4, max: 40, default: 20 },
    { key: 'amp', label: 'Altezza', min: 0.01, max: 0.12, default: 0.03 },
    { key: 'freq', label: 'Frequenza', min: 1, max: 10, default: 3 },
  ],
  lissajous: [
    { key: 'freqa', label: 'Freq A', min: 1, max: 8, default: 2 },
    { key: 'freqb', label: 'Freq B', min: 1, max: 8, default: 3 },
    { key: 'size', label: 'Dimensione', min: 0.15, max: 0.6, default: 0.35 },
  ],
  fluid: [
    { key: 'zoom', label: 'Zoom', min: 0.5, max: 5, default: 2 },
    { key: 'swirl', label: 'Vortice', min: 0, max: 3, default: 1 },
  ],
  glitch: [
    { key: 'blocks', label: 'Blocchi', min: 4, max: 40, default: 10 },
    { key: 'intensity', label: 'Intensità', min: 0, max: 3, default: 1 },
    { key: 'fps', label: 'Singhiozzo', min: 2, max: 30, default: 15 },
  ],
  rings: [
    { key: 'ringcount', label: 'Quantità', min: 3, max: 16, default: 8 },
    { key: 'spacing', label: 'Passo', min: 0.03, max: 0.2, default: 0.08 },
    { key: 'gapfreq', label: 'Spazi', min: 0, max: 8, default: 3 },
  ],
  fire: [
    { key: 'falloff', label: 'Sfumatura', min: 0.4, max: 1.5, default: 0.8 },
    { key: 'turbulence', label: 'Turbolenza', min: 0, max: 1.5, default: 0.5 },
    { key: 'sparks', label: 'Scintille', min: 0, max: 16, default: 8 },
  ],
  hexagons: [
    { key: 'zoom', label: 'Zoom', min: 2, max: 12, default: 5 },
    { key: 'wavefreq', label: 'Onde', min: 1, max: 15, default: 5 },
  ],
  lasers: [
    { key: 'beams', label: 'Raggi', min: 2, max: 12, default: 6 },
    { key: 'spread', label: 'Diffusione', min: 0.2, max: 1.5, default: 0.8 },
    { key: 'sweep', label: 'Spazzata', min: 0, max: 2, default: 0.8 },
  ],
  strobegrid: [
    { key: 'cells', label: 'Celle', min: 4, max: 32, default: 12 },
    { key: 'litratio', label: 'Accese', min: 0.05, max: 0.8, default: 0.3 },
    { key: 'chaos', label: 'Caos', min: 0, max: 1, default: 0.5 },
  ],
  vortex: [
    { key: 'arms', label: 'Braccia', min: 1, max: 8, default: 3 },
    { key: 'twist', label: 'Torsione', min: 0, max: 3, default: 1.2 },
    { key: 'pull', label: 'Attrazione', min: 0, max: 2, default: 0.8 },
  ],
  terrain: [
    { key: 'ridges', label: 'Creste', min: 4, max: 24, default: 10 },
    { key: 'horizon', label: 'Orizzonte', min: 0.25, max: 0.75, default: 0.45 },
    { key: 'glowamt', label: 'Bagliore', min: 0, max: 2, default: 1 },
  ],
  orbits: [
    { key: 'bodies', label: 'Corpi', min: 2, max: 16, default: 7 },
    { key: 'orbitr', label: 'Raggio', min: 0.2, max: 1, default: 0.55 },
    { key: 'trail', label: 'Scia', min: 0, max: 1, default: 0.5 },
  ],
  shatter: [
    { key: 'shards', label: 'Schegge', min: 4, max: 30, default: 14 },
    { key: 'burst', label: 'Scoppio', min: 0, max: 2, default: 1 },
    { key: 'edgeglow', label: 'Bordi', min: 0, max: 2, default: 0.8 },
  ],
  moire: [
    { key: 'density', label: 'Densità', min: 10, max: 120, default: 50 },
    { key: 'moireoff', label: 'Sposta', min: 0.01, max: 0.5, default: 0.12 },
    { key: 'rotspeed', label: 'Rotazione', min: 0, max: 2, default: 0.4 },
  ],
  pulsecity: [
    { key: 'columns', label: 'Torri', min: 6, max: 48, default: 20 },
    { key: 'gapw', label: 'Spazio', min: 0.02, max: 0.5, default: 0.15 },
    { key: 'punch', label: 'Colpo', min: 0, max: 2, default: 1 },
  ],
  neonpoly: [
    { key: 'sides', label: 'Lati', min: 3, max: 9, default: 5 },
    { key: 'layers', label: 'Strati', min: 1, max: 8, default: 5 },
    { key: 'thickness', label: 'Larghezza', min: 0.2, max: 3, default: 1 },
  ],
  inkflow: [
    { key: 'inkscale', label: 'Scala', min: 1, max: 6, default: 2.5 },
    { key: 'flowspd', label: 'Flusso', min: 0, max: 2, default: 0.6 },
    { key: 'inkcontrast', label: 'Contrasto', min: 0.5, max: 2.5, default: 1.2 },
  ],
  raymarch: [
    { key: 'repscale', label: 'Densità', min: 0.5, max: 4, default: 2 },
    { key: 'glowk', label: 'Bagliore', min: 0, max: 2, default: 1 },
    { key: 'camfov', label: 'FOV', min: 0.6, max: 1.6, default: 1 },
  ],
  ps2towers: [
    { key: 'towers', label: 'Torri', min: 8, max: 48, default: 28 },
    { key: 'foglevel', label: 'Nebbia', min: 0, max: 2, default: 1 },
    { key: 'orbit', label: 'Orbita', min: 0, max: 2, default: 0.8 },
  ],
  snowride: [
    { key: 'pistewidth', label: 'Pista', min: 0.4, max: 2, default: 1 },
    { key: 'curviness', label: 'Curva', min: 0, max: 2, default: 0.9 },
    { key: 'gates', label: 'Porte', min: 0, max: 11, default: 6 },
  ],
  ripples: [
    { key: 'spreadv', label: 'Diffusione', min: 0.5, max: 3, default: 1.5 },
    { key: 'heightk', label: 'Altezza', min: 0.2, max: 2.5, default: 1 },
    { key: 'sheen', label: 'Lucentezza', min: 0, max: 2, default: 1 },
  ],
  dna: [
    { key: 'coils', label: 'Spire', min: 3, max: 16, default: 8 },
    { key: 'amp', label: 'Larghezza', min: 0.05, max: 0.3, default: 0.12 },
  ],
  spectrum: [
    { key: 'bars', label: 'Barre', min: 8, max: 96, default: 40 },
    { key: 'mirror', label: 'Specchio', min: 0, max: 1, default: 1 },
    { key: 'scope', label: 'Traccia', min: 0, max: 1.5, default: 0.7 },
  ],
  truchet: [
    { key: 'tiles', label: 'Piastrelle', min: 3, max: 24, default: 9 },
    { key: 'thickness', label: 'Larghezza', min: 0.3, max: 2.5, default: 1 },
    { key: 'flip', label: 'Ribalta', min: 0, max: 2, default: 0.5 },
  ],
  caustics: [
    { key: 'causticscale', label: 'Scala', min: 0.6, max: 5, default: 1.5 },
    { key: 'sharpness', label: 'Nitidezza', min: 0, max: 1, default: 0.7 },
    { key: 'depthk', label: 'Profondità', min: 0, max: 2, default: 1 },
  ],
  quasicrystal: [
    { key: 'waves', label: 'Onde', min: 3, max: 12, default: 7 },
    { key: 'qfreq', label: 'Freq', min: 8, max: 120, default: 45 },
    { key: 'contrast', label: 'Contrasto', min: 0, max: 1, default: 0.35 },
  ],
  gyroid: [
    { key: 'cells', label: 'Celle', min: 0.5, max: 4, default: 2.2 },
    { key: 'shell', label: 'Spessore', min: 0, max: 1.5, default: 0.45 },
    { key: 'travel', label: 'Avanzata', min: 0, max: 2, default: 0.8 },
  ],
  stringart: [
    { key: 'nodes', label: 'Nodi', min: 12, max: 120, default: 72 },
    { key: 'multiplier', label: 'Tabellina', min: 2, max: 12, default: 2.4 },
    { key: 'linew', label: 'Larghezza', min: 0.3, max: 3, default: 1 },
  ],
  ascii: [
    { key: 'cellsize', label: 'Cella', min: 4, max: 32, default: 12 },
    { key: 'levels', label: 'Livelli', min: 2, max: 6, default: 5 },
    { key: 'sourcezoom', label: 'Zoom', min: 0.3, max: 2.5, default: 1 },
  ],
  smoke: [
    { key: 'rise', label: 'Salita', min: 0, max: 2, default: 1 },
    { key: 'swirl', label: 'Vortice', min: 0, max: 3, default: 1.2 },
    { key: 'dissipate', label: 'Dissolvenza', min: 0, max: 1, default: 0.3 },
  ],
  reaction: [
    { key: 'feed', label: 'Nutrimento', min: 0.014, max: 0.07, default: 0.0545 },
    { key: 'kill', label: 'Consumo', min: 0.045, max: 0.07, default: 0.062 },
    { key: 'inject', label: 'Inietta', min: 0, max: 2, default: 1 },
  ],
  swarm: [
    { key: 'turbulence', label: 'Turbolenza', min: 0, max: 3, default: 1.2 },
    { key: 'drag', label: 'Attrito', min: 0, max: 1, default: 0.35 },
    { key: 'burst', label: 'Scoppio', min: 0, max: 2, default: 1 },
    { key: 'dotsize', label: 'Punti', min: 1, max: 8, default: 3.2 },
  ],
  pulsar: [
    { key: 'lines', label: 'Linee', min: 16, max: 72, default: 46 },
    { key: 'peaks', label: 'Picchi', min: 0.2, max: 2.5, default: 1 },
    { key: 'flow', label: 'Flusso', min: 0, max: 1.5, default: 0.35 },
  ],
}

/**
 * The Intensity macro: how much each param follows one fader.
 *
 * Under pressure a single command beats five sliders. This is the weight per
 * param key — positive pulls the value towards its maximum, negative towards
 * its minimum, and the size says how hard. A key that is not listed here does
 * not move at all, which is the point: the macro raises *energy*, and there
 * are plenty of params where "more" means "worse" or simply "different".
 *
 * Weights are applied when a param is resolved, never written back, so the
 * fader at zero leaves the scene exactly as it was set by hand.
 */
export const INTENSITY_WEIGHTS: Record<string, number> = {
  // Engine-level, present on every effect
  speed: 0.55,
  reactivity: 0.8,

  // More of the thing: counts, repeats, subdivisions
  arms: 0.5, bars: 0.4, beams: 0.6, blocks: 0.5, bodies: 0.5, cells: 0.5,
  coils: 0.45, cols: 0.4, columns: 0.4, count: 0.6, density: 0.6, detail: 0.5,
  iterations: 0.45, layers: 0.5, levels: 0.4, lines: 0.4, nodes: 0.5,
  peaks: 0.5, ridges: 0.5, ringcount: 0.5, ringdensity: 0.5, ringfreq: 0.4,
  segments: 0.45, shards: 0.6, sides: 0.35, sparks: 0.7, symmetry: 0.35,
  tiles: 0.45, towers: 0.4, waves: 0.5, gates: 0.4,

  // Motion and disorder
  burst: 0.7, chaos: 0.7, curviness: 0.5, fallspeed: 0.5, flow: 0.5,
  flowspd: 0.5, inject: 0.6, morph: 0.5, punch: 0.7, rise: 0.5,
  rotspeed: 0.5, spread: 0.4, spreadv: 0.4, sweep: 0.5, swirl: 0.6,
  travel: 0.5, turbulence: 0.7, twist: 0.5, warpamt: 0.6, amp: 0.5,

  // Glow
  edgeglow: 0.5, glowamt: 0.6, glowk: 0.5, intensity: 0.7, sheen: 0.4,

  // Down, not up: a lower threshold means more of the image survives it
  threshold: -0.5,
}

/**
 * One param under the macro. Pure arithmetic, so it can be asserted without a
 * WebGL context — see `scripts/check-intensity.mjs`.
 *
 * `intensity` 0 returns `base` untouched: that is the contract the whole macro
 * rests on, because the fader must give back exactly the scene that was set by
 * hand. A positive weight heads for `def.max`, a negative one for `def.min`,
 * and a key with no weight never moves.
 */
export function intensityValue(def: EffectParam, base: number, intensity: number): number {
  if (intensity <= 0) return base
  const w = INTENSITY_WEIGHTS[def.key]
  if (!w) return base
  const target = w > 0 ? def.max : def.min
  return base + Math.min(1, intensity) * Math.abs(w) * (target - base)
}

/** Post-FX wet under the macro: towards fully wet, never past it. */
export function intensityWet(amount: number, intensity: number): number {
  if (intensity <= 0) return amount
  return amount + Math.min(1, intensity) * INTENSITY_WET_WEIGHT * (1 - amount)
}

/** How hard the macro pushes the post chain. Less than the params: a chain at
 *  full wet on every effect is mud, not intensity. */
export const INTENSITY_WET_WEIGHT = 0.7
