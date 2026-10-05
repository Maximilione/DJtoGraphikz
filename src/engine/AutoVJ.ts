import type { EffectId, PostId, TransitionType } from './Engine'
import type { AudioSource } from './EffectParams'
import type { Key } from './audio/KeyDetector'

/**
 * Auto VJ: a set, not a slot machine.
 *
 * The first version drew effects, post-FX and palettes from three independent
 * shuffle bags every N beats, so a photocopied halftone could land under a
 * pastel palette with RGB split, and a breakdown — no kick, so no beats — made
 * it switch scenes at random every five seconds, which is exactly when a VJ
 * holds still. This one follows the track:
 *
 * - **Phase.** The bass envelope says whether there is a kick; the energy
 *   envelope says how hard the room is going. Three phases: `break` (no kick),
 *   `groove`, `peak`. Every scene is written for one of them.
 * - **The drop.** A kick coming back after a break is the one moment that
 *   matters. The scene cuts — no fade — on that first kick, to a peak scene,
 *   with a fresh palette. Everything else waits for a downbeat.
 * - **The break.** Fade slowly into a low scene and hold it. No random
 *   switching while the DJ builds tension.
 * - **Phrases.** In the groove a scene lasts a phrase (8 bars for techno,
 *   16 for minimal, 4 for drum & bass); at the peak half a phrase. The palette
 *   changes once per four scenes, so the room keeps a colour for a while.
 * - **Coherence.** Each scene carries the post-FX that fit it. Two scenes of
 *   the same visual family (two radial things, two tunnels) never play back
 *   to back, and an effect does not return for three switches.
 */
export type Genre =
  | 'acid-techno'
  | 'dark-industrial'
  | 'minimal-hypnotic'
  | 'hard-tekno'
  | 'trance'
  | 'drum-n-bass'
  | 'ambient'
  | 'gabber'
  | 'tech-house'
  | 'psytrance'
  | 'bounce'

/** The moment of the track a scene is written for. `build` is the rise before the drop: no kick yet, energy climbing. */
export type Phase = 'break' | 'build' | 'groove' | 'peak'

/** Visual family — what the eye sees, so two of a kind never follow each other */
export type Family =
  | 'strobe' | 'radial' | 'tunnel' | 'grid' | 'organic' | 'lines' | 'particles' | 'glyph' | 'object'

export interface SceneParam {
  value?: number
  source?: AudioSource
  depth?: number
  lfoRate?: number
}

export interface Scene {
  effect: EffectId
  phase: Phase
  /** post-FX that fit THIS scene; empty means none */
  posts: PostId[]
  params?: Record<string, SceneParam>
}

/** How the engine should move into a scene */
export interface SceneCut {
  type: TransitionType
  seconds: number
}

export interface GenreConfig {
  label: string
  scenes: Scene[]
  palettes: [string, string, string][]
  /** bars a groove scene lasts; a peak scene lasts half, a break scene twice */
  phraseBars: number
  /** the ordinary groove transition — the break fades slow, the drop cuts */
  cut: SceneCut
  /** typical BPM of the genre — centers the beat tracker's tempo prior */
  preferredBpm: number
}

/** One family per effect, written once: the rule needs it, the tables do not repeat it. */
export const FAMILY: Record<EffectId, Family> = {
  tunnel: 'tunnel', kaleidoscope: 'radial', voronoi: 'grid', sacred: 'radial', mandala: 'radial',
  hexagons: 'grid', rings: 'radial', moire: 'lines', neonpoly: 'object', truchet: 'grid',
  quasicrystal: 'organic', stringart: 'radial',
  fluid: 'organic', plasma: 'organic', warp: 'organic', metaballs: 'organic', fire: 'organic',
  fractal: 'organic', inkflow: 'organic', reaction: 'organic', caustics: 'organic', smoke: 'organic',
  ripples: 'organic', vortex: 'radial',
  particles: 'particles', swarm: 'particles', mesh: 'object', starfield: 'tunnel', waves: 'lines', pulsar: 'lines',
  lissajous: 'lines', dna: 'lines', orbits: 'lines', terrain: 'tunnel', pulsecity: 'grid', shatter: 'particles',
  matrix: 'glyph', grid: 'tunnel', glitch: 'glyph', lasers: 'lines', strobegrid: 'strobe',
  raymarch: 'tunnel', gyroid: 'tunnel', ascii: 'glyph', spectrum: 'lines',
  ps2towers: 'tunnel', snowride: 'tunnel',
  flash: 'strobe', impact: 'radial', spiral: 'radial', tribal: 'radial', halftone: 'glyph',
  barcode: 'glyph', chevrons: 'grid', static: 'glyph',
  cage: 'object', cracks: 'grid', warehouse: 'tunnel', downpour: 'particles', eclipse: 'radial',
  blinds: 'grid',
  bounceball: 'object', pump: 'radial', roll: 'grid',
  spaceghost: 'organic',
}

// shorthand builders keep the tables readable
const v = (value: number): SceneParam => ({ value })
const a = (value: number, source: AudioSource, depth: number, lfoRate?: number): SceneParam =>
  ({ value, source, depth, lfoRate })
const s = (phase: Phase, effect: EffectId, posts: PostId[], params?: Record<string, SceneParam>): Scene =>
  ({ effect, phase, posts, params })

// palettes, named once
const MONO: [string, string, string] = ['#ffffff', '#888888', '#ffffff']
const BLOOD: [string, string, string] = ['#ff0000', '#880000', '#ff4444']
const REDWHITE: [string, string, string] = ['#ff2020', '#ffffff', '#400000']
const AMBER: [string, string, string] = ['#ff9500', '#ffffff', '#3a1a00']
const LAVA: [string, string, string] = ['#ff4500', '#ff6347', '#2b0000']
const STEEL: [string, string, string] = ['#9fb4c7', '#3b4a5a', '#ffffff']
const ACID: [string, string, string] = ['#00ff88', '#ff00ff', '#4444ff']
const TOXIC: [string, string, string] = ['#00ff00', '#aaff00', '#00ff88']
const NEON: [string, string, string] = ['#ff00ff', '#00ffff', '#ffff00']
const CYBER: [string, string, string] = ['#f72585', '#7209b7', '#3a0ca3']
const ICE: [string, string, string] = ['#00ccff', '#0044ff', '#88ffff']
const VAPOR: [string, string, string] = ['#ff71ce', '#01cdfe', '#b967ff']
const FOREST: [string, string, string] = ['#2d6a4f', '#52b788', '#95d5b2']
const AURORA: [string, string, string] = ['#00ff87', '#60efff', '#ff00e5']
const PASTEL: [string, string, string] = ['#ffc8dd', '#bde0fe', '#a2d2ff']
const FIRE: [string, string, string] = ['#ff4400', '#ffaa00', '#ff0066']
const OCEAN: [string, string, string] = ['#0077b6', '#00b4d8', '#90e0ef']
const GOLD: [string, string, string] = ['#ffd700', '#daa520', '#b8860b']
const SUNSET: [string, string, string] = ['#ff6b35', '#f7c59f', '#1a535c']

export const GENRE_CONFIGS: Record<Genre, GenreConfig> = {
  // Free party, black room, white and red. The break is a dark place, not a
  // pretty one; the peak is a strobe.
  'hard-tekno': {
    label: 'Hard Tekno',
    scenes: [
      s('break', 'eclipse', ['bloom'], { radius: v(0.3), corona: a(0.8, 'bass', 0.5), wobble: v(0.4) }),
      s('break', 'warehouse', ['filmgrain'], { pillars: v(2), fog: v(1.3), flicker: v(0.7) }),
      s('break', 'static', ['scanlines'], { grain: v(3), roll: a(0.6, 'bass', 0.5), bands: v(0.6) }),
      s('break', 'smoke', ['filmgrain'], { rise: v(0.9), swirl: v(1.4), dissipate: v(0.3) }),
      s('break', 'halftone', ['filmgrain'], { dots: v(50), contrast: v(1.8), drift: v(0.4) }),
      s('build', 'impact', ['bloom'], { speed: v(0.6), rings: v(2), width: v(2.5), fade: v(0.4) }),
      s('build', 'eclipse', ['bloom'], { radius: v(0.22), corona: a(1.8, 'energy', 0.6), wobble: v(0.8) }),
      s('build', 'blinds', ['filmgrain'], { slats: v(12), open: a(0.15, 'energy', 0.9), tilt: v(0.4) }),
      s('groove', 'spiral', ['filmgrain'], { arms: v(2), twist: v(8), pulse: v(0.6) }),
      s('groove', 'tribal', ['filmgrain'], { blades: v(8), spikes: a(0.6, 'high', 0.3), turn: v(1) }),
      s('groove', 'chevrons', [], { lanes: v(5), thickness: v(0.5), drift: v(1.5) }),
      s('groove', 'cage', ['bloom', 'chromatic'], { size: v(1.1), thickness: v(1.8), spin: v(1.2) }),
      s('groove', 'tunnel', ['bloom'], { speed: v(1.6), sides: v(6), twist: a(0.8, 'bass', 0.5), ringdensity: v(10) }),
      s('groove', 'cracks', ['bloom'], { cells: v(8), width: v(1), glow: a(1, 'bass', 0.6) }),
      s('groove', 'barcode', ['scanlines'], { bars: v(56), gap: v(0.4), jitter: a(1, 'high', 0.6) }),
      s('groove', 'moire', ['chromatic'], { speed: v(1.3), density: v(75), moireoff: a(0.18, 'bass', 0.4), rotspeed: v(0.9) }),
      s('groove', 'raymarch', ['bloom', 'chromatic'], { speed: v(1.4), repscale: v(2.8), glowk: v(1.3), camfov: a(1, 'bass', -0.3) }),
      s('groove', 'grid', ['bloom', 'scanlines'], { speed: v(1.5), density: v(2.2), fogamt: v(0.15), wavefreq: a(2.8, 'bass', 0.5) }),
      s('groove', 'pulsecity', ['bloom'], { columns: v(18), gapw: v(0.12), punch: a(1.5, 'bass', 0.4) }),
      s('groove', 'blinds', ['filmgrain'], { slats: v(14), open: a(0.5, 'bass', 0.5), tilt: v(0.2) }),
      s('peak', 'flash', [], { decay: v(3), scan: v(0.3), tint: v(0.2) }),
      s('peak', 'impact', ['bloom'], { rings: v(4), width: a(1, 'bass', 0.5), fade: v(1) }),
      s('peak', 'strobegrid', ['bloom'], { cells: v(10), litratio: a(0.35, 'energy', 0.4), chaos: v(0.7) }),
      s('peak', 'lasers', ['bloom'], { beams: v(9), spread: v(1.1), sweep: a(1.3, 'energy', 0.5) }),
      s('peak', 'shatter', ['bloom', 'chromatic'], { shards: v(14), burst: v(1.6), edgeglow: a(1, 'high', 0.6) }),
      s('peak', 'glitch', ['rgb-split', 'scanlines'], { blocks: v(18), intensity: a(0.55, 'high', 0.6), fps: v(18) }),
      s('peak', 'vortex', ['bloom', 'feedback'], { speed: v(1.4), arms: v(5), twist: v(2), pull: a(1.2, 'bass', 0.5) }),
      s('peak', 'fire', ['bloom'], { falloff: v(0.7), turbulence: a(0.7, 'mid', 0.5), sparks: v(12) }),
      s('peak', 'rings', ['bloom'], { speed: v(1.6), ringcount: v(14), spacing: a(0.06, 'bass', 0.5), gapfreq: v(8) }),
      s('peak', 'neonpoly', ['bloom'], { speed: v(1.4), sides: v(3), layers: v(7), thickness: a(1.5, 'bass', 0.6) }),
    ],
    palettes: [MONO, BLOOD, REDWHITE, AMBER],
    phraseBars: 8,
    cut: { type: 'crossfade', seconds: 0.25 },
    preferredBpm: 155,
  },

  // Faster and meaner than tekno: half the phrase, dissolve cuts, no fades.
  'gabber': {
    label: 'Gabber',
    scenes: [
      s('break', 'static', ['scanlines'], { grain: v(4), roll: v(1.2), bands: v(0.7) }),
      s('break', 'eclipse', ['bloom'], { radius: v(0.32), corona: a(1, 'bass', 0.6), wobble: v(0.6) }),
      s('break', 'warehouse', ['filmgrain'], { pillars: v(1.5), fog: v(1.5), flicker: v(0.9) }),
      s('break', 'halftone', ['filmgrain'], { dots: v(40), contrast: v(2.2), drift: v(0.8) }),
      s('build', 'impact', ['bloom'], { speed: v(0.7), rings: v(3), width: v(2), fade: v(0.5) }),
      s('build', 'eclipse', ['bloom'], { radius: v(0.2), corona: a(2, 'energy', 0.6), wobble: v(1) }),
      s('build', 'blinds', ['filmgrain'], { slats: v(12), open: a(0.15, 'energy', 0.9), tilt: v(0.4) }),
      s('groove', 'chevrons', [], { lanes: v(7), thickness: v(0.55), drift: v(2) }),
      s('groove', 'barcode', ['scanlines'], { bars: v(80), gap: v(0.5), jitter: v(1.6) }),
      s('groove', 'tribal', ['filmgrain'], { blades: v(12), spikes: v(0.8), turn: v(1) }),
      s('groove', 'moire', ['chromatic'], { speed: v(1.5), density: v(85), moireoff: v(0.2), rotspeed: v(1.2) }),
      s('groove', 'tunnel', ['bloom'], { speed: v(2), sides: v(4), twist: v(1), ringdensity: v(12) }),
      s('groove', 'pulsecity', ['bloom'], { speed: v(1.6), columns: v(12), gapw: v(0.08), punch: v(2) }),
      s('groove', 'raymarch', ['bloom', 'chromatic'], { speed: v(1.8), repscale: v(3.2), glowk: v(1.5), camfov: v(0.85) }),
      s('peak', 'flash', [], { decay: v(5), scan: v(0.6), tint: v(0) }),
      s('peak', 'impact', ['bloom'], { rings: v(6), width: v(1.5), fade: v(1.6) }),
      s('peak', 'strobegrid', ['bloom'], { cells: v(8), litratio: v(0.5), chaos: v(1) }),
      s('peak', 'glitch', ['rgb-split', 'scanlines'], { blocks: v(24), intensity: a(0.7, 'high', 0.6), fps: v(30) }),
      s('peak', 'shatter', ['bloom', 'chromatic'], { shards: v(12), burst: v(2), edgeglow: v(1.4) }),
      s('peak', 'fire', ['bloom'], { falloff: v(0.6), turbulence: v(1), sparks: v(16) }),
      s('peak', 'lasers', ['bloom'], { beams: v(11), spread: v(1.3), sweep: v(1.8) }),
      s('peak', 'vortex', ['bloom', 'feedback'], { speed: v(1.8), arms: v(6), twist: v(2.5), pull: v(1.6) }),
      s('peak', 'rings', ['bloom'], { speed: v(2), ringcount: v(16), spacing: v(0.05), gapfreq: v(8) }),
      s('peak', 'fractal', ['bloom', 'chromatic'], { speed: v(1.7), iterations: v(40), zoom: a(1.6, 'bass', 0.5), morph: v(0.3) }),
      s('peak', 'particles', ['bloom'], { speed: v(1.8), count: v(40), size: a(0.015, 'bass', 0.6), spread: v(1.2) }),
    ],
    palettes: [BLOOD, MONO, LAVA, REDWHITE],
    phraseBars: 4,
    cut: { type: 'dissolve', seconds: 0.15 },
    preferredBpm: 185,
  },

  // Concrete, rust, cold light. Slower cuts, longer scenes, grain everywhere.
  'dark-industrial': {
    label: 'Dark Industrial',
    scenes: [
      s('break', 'warehouse', ['filmgrain'], { pillars: v(2), fog: v(1.2), flicker: v(0.7) }),
      s('break', 'smoke', ['filmgrain'], { rise: v(1.3), swirl: v(1.8), dissipate: v(0.2) }),
      s('break', 'static', ['scanlines'], { grain: v(3), roll: a(0.8, 'bass', 0.5), bands: v(0.6) }),
      s('break', 'eclipse', ['bloom'], { radius: v(0.28), corona: a(1, 'bass', 0.5), wobble: v(0.4) }),
      s('break', 'downpour', ['filmgrain'], { density: v(60), streak: v(0.2), wind: a(0.15, 'lfo-sine', 0.5, 32) }),
      s('break', 'halftone', ['filmgrain'], { dots: v(60), contrast: v(1.6), drift: v(0.6) }),
      s('break', 'gyroid', ['bloom'], { cells: v(1.8), shell: v(0.35), travel: v(0.6) }),
      s('build', 'eclipse', ['bloom'], { radius: v(0.26), corona: a(1.2, 'energy', 0.7), wobble: v(0.5) }),
      s('build', 'cracks', ['bloom'], { speed: v(0.5), cells: v(5), width: v(1.5), glow: a(0.6, 'energy', 0.8) }),
      s('build', 'blinds', ['filmgrain'], { slats: v(10), open: a(0.2, 'energy', 0.8), tilt: v(0.5) }),
      s('groove', 'cracks', ['bloom'], { cells: v(8), width: v(1), glow: a(1, 'bass', 0.6) }),
      s('groove', 'blinds', ['filmgrain'], { slats: v(14), open: a(0.5, 'bass', 0.5), tilt: v(0.2) }),
      s('groove', 'cage', ['bloom', 'chromatic'], { size: v(1), thickness: v(2), spin: v(0.6) }),
      s('groove', 'pulsar', ['bloom'], { lines: v(40), peaks: a(1.3, 'bass', 0.5), flow: v(0.5) }),
      s('groove', 'matrix', ['bloom', 'scanlines'], { cols: v(48), fallspeed: a(1, 'bass', 0.4), trailfade: v(0.85) }),
      s('groove', 'grid', ['bloom', 'scanlines'], { density: v(1.6), fogamt: a(0.25, 'energy', 0.3), wavefreq: a(2, 'bass', 0.35) }),
      s('groove', 'raymarch', ['bloom', 'chromatic'], { speed: v(0.8), repscale: v(1.6), glowk: a(0.7, 'bass', 0.5), camfov: v(1.15) }),
      s('groove', 'moire', ['chromatic'], { speed: v(0.8), density: v(90), moireoff: v(0.08), rotspeed: a(0.3, 'bass', 0.4) }),
      s('groove', 'voronoi', ['bloom'], { cells: v(12), edgewidth: a(0.04, 'high', 0.4) }),
      s('groove', 'hexagons', ['bloom'], { zoom: v(4), wavefreq: a(2.5, 'bass', 0.45) }),
      s('groove', 'tunnel', ['bloom'], { speed: v(1), sides: v(4), twist: a(0.2, 'high', 0.4), ringdensity: v(12) }),
      s('groove', 'barcode', ['scanlines'], { bars: v(40), gap: v(0.5), jitter: a(0.6, 'high', 0.6) }),
      s('groove', 'chevrons', ['filmgrain'], { lanes: v(4), thickness: v(0.4), drift: v(0.6) }),
      s('peak', 'glitch', ['rgb-split', 'scanlines'], { blocks: v(14), intensity: a(0.4, 'high', 0.6), fps: v(12) }),
      s('peak', 'shatter', ['bloom', 'chromatic'], { shards: v(18), burst: a(1.1, 'bass', 0.4), edgeglow: a(0.7, 'high', 0.5) }),
      s('peak', 'strobegrid', ['bloom'], { cells: v(16), litratio: v(0.18), chaos: a(0.6, 'energy', 0.4) }),
      s('peak', 'pulsecity', ['bloom'], { columns: v(26), gapw: v(0.2), punch: a(1.2, 'bass', 0.4) }),
      s('peak', 'lasers', ['bloom'], { beams: v(5), spread: v(0.5), sweep: a(0.5, 'lfo-saw', 0.4, 16) }),
      s('peak', 'fire', ['bloom'], { falloff: v(1.1), turbulence: a(0.5, 'mid', 0.4), sparks: v(4) }),
      s('peak', 'vortex', ['bloom', 'feedback'], { speed: v(0.8), arms: v(4), twist: v(2.2), pull: a(0.6, 'bass', 0.4) }),
      s('peak', 'flash', ['filmgrain'], { decay: v(2), scan: v(0.5), tint: v(0.5) }),
      s('peak', 'impact', ['bloom'], { rings: v(3), width: v(1.5), fade: v(0.8) }),
    ],
    palettes: [BLOOD, MONO, LAVA, STEEL],
    phraseBars: 8,
    cut: { type: 'crossfade', seconds: 0.8 },
    preferredBpm: 135,
  },

  // Colour is allowed here — acid green and magenta — but the structure is
  // still techno: hypnotic groove, strobing peak, a squelchy break.
  'acid-techno': {
    label: 'Acid Techno',
    scenes: [
      s('break', 'spaceghost', ['bloom', 'chromatic'], { folds: v(5), glow: a(30, 'bass', 0.4), drift: v(1.2) }),
      s('break', 'reaction', ['bloom'], { feed: v(0.0545), kill: a(0.062, 'lfo-sine', 0.15, 32), inject: v(1.4) }),
      s('break', 'eclipse', ['bloom'], { radius: v(0.24), corona: a(1.4, 'bass', 0.5), wobble: v(0.8) }),
      s('break', 'caustics', ['bloom'], { causticscale: v(1.6), sharpness: v(0.7), depthk: v(1) }),
      s('break', 'inkflow', ['filmgrain'], { inkscale: v(2.2), flowspd: a(0.6, 'bass', 0.3), inkcontrast: v(1.3) }),
      s('break', 'smoke', ['filmgrain'], { rise: v(1), swirl: v(1.6), dissipate: v(0.25) }),
      s('build', 'spiral', ['bloom'], { speed: a(0.4, 'energy', 0.8), arms: v(6), twist: v(12), pulse: v(0.2) }),
      s('build', 'eclipse', ['bloom'], { radius: v(0.22), corona: a(1.6, 'energy', 0.6), wobble: v(1) }),
      s('build', 'quasicrystal', ['bloom', 'chromatic'], { speed: a(0.5, 'energy', 0.8), waves: v(9), qfreq: v(80), contrast: v(0.5) }),
      s('groove', 'spiral', ['filmgrain'], { arms: v(3), twist: a(7, 'lfo-sine', 0.3, 16), pulse: v(0.4) }),
      s('groove', 'quasicrystal', ['bloom', 'chromatic'], { waves: v(5), qfreq: v(60), contrast: a(0.4, 'high', 0.4) }),
      s('groove', 'tunnel', ['bloom'], { speed: v(1.2), twist: a(0.5, 'lfo-sine', 0.5, 8), ringdensity: a(8, 'bass', 0.35) }),
      s('groove', 'vortex', ['bloom', 'feedback'], { arms: v(3), twist: a(1.2, 'lfo-sine', 0.4, 16), pull: a(0.8, 'bass', 0.5) }),
      s('groove', 'kaleidoscope', ['bloom', 'chromatic'], { segments: v(8), zoom: a(1.2, 'bass', 0.4), detail: a(2, 'mid', 0.3) }),
      s('groove', 'moire', ['chromatic'], { density: a(55, 'bass', 0.3), moireoff: a(0.12, 'lfo-sine', 0.35, 16), rotspeed: v(0.6) }),
      s('groove', 'rings', ['bloom'], { ringcount: v(10), spacing: a(0.08, 'bass', 0.3), gapfreq: a(6, 'lfo-saw', 0.3, 8) }),
      s('groove', 'neonpoly', ['bloom'], { sides: v(5), layers: v(6), thickness: a(1, 'mid', 0.5) }),
      s('groove', 'plasma', ['bloom'], { speed: v(1.1), zoom: a(1.3, 'bass', 0.4) }),
      s('groove', 'hexagons', ['bloom'], { zoom: v(6), wavefreq: a(3, 'bass', 0.5) }),
      s('groove', 'dna', ['bloom'], { speed: v(1.2), reactivity: v(1.3) }),
      s('groove', 'tribal', ['filmgrain'], { blades: v(6), spikes: v(0.5), turn: v(0.5) }),
      s('groove', 'cage', ['bloom', 'chromatic'], { size: v(1), thickness: v(1.5), spin: v(1) }),
      s('peak', 'lasers', ['bloom'], { beams: v(7), spread: a(0.8, 'energy', 0.4), sweep: v(1.1) }),
      s('peak', 'strobegrid', ['bloom'], { cells: v(14), litratio: a(0.28, 'energy', 0.35), chaos: v(0.8) }),
      s('peak', 'shatter', ['bloom', 'chromatic'], { shards: v(16), burst: a(1.2, 'bass', 0.45), edgeglow: v(1) }),
      s('peak', 'impact', ['bloom'], { rings: v(4), width: v(1.2), fade: v(1) }),
      s('peak', 'raymarch', ['bloom', 'chromatic'], { repscale: v(2.2), glowk: a(1, 'energy', 0.5), camfov: a(1, 'bass', -0.25) }),
      s('peak', 'flash', ['bloom'], { decay: v(3), scan: v(0.4), tint: v(0.8) }),
      s('peak', 'fractal', ['bloom', 'chromatic'], { iterations: v(30), zoom: a(1.4, 'bass', 0.45), morph: a(0.22, 'lfo-saw', 0.4, 4) }),
      s('peak', 'pulsecity', ['bloom'], { columns: v(18), gapw: v(0.12), punch: a(1.5, 'bass', 0.4) }),
    ],
    palettes: [ACID, TOXIC, NEON, CYBER],
    phraseBars: 8,
    cut: { type: 'crossfade', seconds: 0.3 },
    preferredBpm: 145,
  },

  // Nothing fast. Sixteen-bar scenes, two-second fades, LFOs instead of hits.
  'minimal-hypnotic': {
    label: 'Minimal Hypnotic',
    scenes: [
      s('break', 'inkflow', ['filmgrain'], { inkscale: v(2.2), flowspd: a(0.5, 'bass', 0.3), inkcontrast: v(1.3) }),
      s('break', 'lissajous', ['bloom', 'feedback'], { freqa: a(3, 'lfo-sine', 0.2, 32), freqb: v(4), size: v(0.5) }),
      s('break', 'waves', ['bloom'], { count: v(5), amp: a(0.09, 'bass', 0.35), freq: v(2.5) }),
      s('break', 'orbits', ['bloom', 'feedback'], { speed: v(0.8), bodies: v(6), orbitr: v(0.5), trail: v(0.7) }),
      s('break', 'ripples', ['bloom'], { spreadv: v(1.2), heightk: a(0.9, 'bass', 0.35), sheen: v(1.1) }),
      s('break', 'ps2towers', ['bloom', 'filmgrain'], { speed: v(0.7), towers: v(20), foglevel: v(1.3), orbit: v(0.5) }),
      s('break', 'caustics', ['bloom'], { causticscale: v(1.4), sharpness: a(0.7, 'lfo-sine', 0.25, 64), depthk: v(1.1) }),
      s('break', 'smoke', ['filmgrain'], { rise: v(0.7), swirl: v(1), dissipate: v(0.4) }),
      s('break', 'eclipse', ['bloom'], { radius: v(0.3), corona: v(0.6), wobble: v(0.2) }),
      s('build', 'stringart', ['bloom'], { speed: a(0.5, 'energy', 0.6), nodes: v(120), multiplier: v(2.4), linew: v(0.6) }),
      s('build', 'eclipse', ['bloom'], { radius: v(0.3), corona: a(0.8, 'energy', 0.6), wobble: v(0.3) }),
      s('build', 'blinds', ['filmgrain'], { slats: v(20), open: a(0.15, 'energy', 0.8), tilt: v(0.5) }),
      s('groove', 'stringart', ['bloom'], { nodes: v(84), multiplier: a(2.4, 'lfo-sine', 0.4, 64), linew: v(0.9) }),
      s('groove', 'truchet', ['bloom'], { tiles: v(7), thickness: v(1.2), flip: v(0.25) }),
      s('groove', 'swarm', ['bloom', 'feedback'], { turbulence: v(0.7), drag: v(0.2), burst: v(0.6), dotsize: v(3.2) }),
      s('groove', 'pulsar', ['bloom'], { lines: v(58), peaks: a(0.9, 'energy', 0.35), flow: v(0.25) }),
      s('groove', 'moire', [], { speed: v(0.7), density: v(42), moireoff: a(0.1, 'lfo-sine', 0.4, 32), rotspeed: v(0.25) }),
      s('groove', 'vortex', ['bloom', 'feedback'], { speed: v(0.7), arms: v(2), twist: v(1.6), pull: a(0.5, 'lfo-sine', 0.3, 16) }),
      s('groove', 'mandala', ['bloom', 'feedback'], { symmetry: v(8), ringfreq: a(5, 'lfo-sine', 0.3, 32) }),
      s('groove', 'rings', ['bloom'], { speed: v(0.8), ringcount: v(12), spacing: v(0.07), gapfreq: a(4, 'lfo-saw', 0.25, 16) }),
      s('groove', 'metaballs', ['bloom'], { count: v(5), size: a(0.09, 'bass', 0.3), threshold: v(1.2) }),
      s('groove', 'sacred', ['bloom'], { speed: v(0.7), zoom: a(1, 'lfo-sine', 0.25, 32), radius: v(0.3), ringfreq: v(6) }),
      s('groove', 'hexagons', ['bloom'], { speed: v(0.7), zoom: v(3), wavefreq: a(1.5, 'lfo-sine', 0.3, 16) }),
      s('groove', 'kaleidoscope', ['bloom', 'chromatic'], { speed: v(0.7), segments: v(6), zoom: a(1, 'lfo-sine', 0.25, 32), detail: v(2.2) }),
      s('groove', 'spiral', ['filmgrain'], { speed: v(0.6), arms: v(1), twist: v(4), pulse: v(0.2) }),
      s('groove', 'halftone', ['filmgrain'], { dots: v(70), contrast: v(1.4), drift: v(0.3) }),
      s('groove', 'blinds', ['filmgrain'], { slats: v(18), open: a(0.45, 'lfo-sine', 0.4, 16), tilt: v(0.4) }),
      s('peak', 'tribal', ['filmgrain'], { blades: v(6), spikes: v(0.5), turn: v(0.5) }),
      s('peak', 'cage', ['bloom', 'chromatic'], { size: v(1), thickness: v(1.5), spin: v(0.6) }),
      s('peak', 'tunnel', ['bloom'], { speed: v(0.9), sides: v(12), twist: a(0.3, 'lfo-saw', 0.5, 16), ringdensity: v(6) }),
      s('peak', 'impact', ['bloom'], { rings: v(2), width: v(2), fade: v(0.6) }),
      s('peak', 'quasicrystal', ['bloom', 'chromatic'], { waves: v(7), qfreq: a(40, 'lfo-sine', 0.3, 64), contrast: v(0.35) }),
      s('peak', 'cracks', ['bloom'], { cells: v(6), width: v(1.2), glow: a(0.8, 'bass', 0.5) }),
    ],
    palettes: [ICE, VAPOR, FOREST, MONO],
    phraseBars: 16,
    cut: { type: 'crossfade', seconds: 2 },
    preferredBpm: 128,
  },

  'trance': {
    label: 'Trance',
    scenes: [
      s('break', 'spaceghost', ['bloom'], { folds: v(3), glow: v(40), drift: v(0.6) }),
      s('break', 'caustics', ['bloom'], { causticscale: v(1.8), sharpness: v(0.75), depthk: v(1) }),
      s('break', 'orbits', ['bloom', 'feedback'], { bodies: v(10), orbitr: a(0.6, 'lfo-sine', 0.25, 32), trail: v(0.8) }),
      s('break', 'fluid', ['bloom'], { zoom: v(1.3), swirl: a(1.4, 'lfo-sine', 0.35, 16) }),
      s('break', 'waves', ['bloom'], { count: v(7), amp: a(0.1, 'bass', 0.4), freq: v(3) }),
      s('break', 'lissajous', ['bloom', 'feedback'], { freqa: v(3), freqb: a(5, 'lfo-sine', 0.25, 32), size: v(0.45) }),
      s('break', 'ripples', ['bloom'], { spreadv: v(1.6), heightk: a(1.1, 'bass', 0.4), sheen: v(1.4) }),
      s('break', 'plasma', ['bloom'], { speed: v(0.9), zoom: v(1.1), ringfreq: a(14, 'lfo-sine', 0.3, 16) }),
      s('break', 'eclipse', ['bloom'], { radius: v(0.26), corona: v(1.4), wobble: v(0.3) }),
      s('build', 'starfield', ['bloom'], { speed: a(0.6, 'energy', 0.9), tile: v(6), density: v(0.5) }),
      s('build', 'eclipse', ['bloom'], { radius: v(0.24), corona: a(1.4, 'energy', 0.7), wobble: v(0.4) }),
      s('build', 'sacred', ['bloom'], { speed: a(0.5, 'energy', 0.7), zoom: v(1.4), radius: v(0.32), ringfreq: v(9) }),
      s('groove', 'stringart', ['bloom'], { nodes: v(96), multiplier: a(3.2, 'lfo-saw', 0.3, 64), linew: v(0.8) }),
      s('groove', 'kaleidoscope', ['bloom', 'chromatic'], { segments: v(12), zoom: a(1.1, 'lfo-sine', 0.35, 16), detail: v(2.4) }),
      s('groove', 'mandala', ['bloom', 'feedback'], { symmetry: v(12), ringfreq: a(6, 'bass', 0.35) }),
      s('groove', 'sacred', ['bloom'], { zoom: a(1.1, 'lfo-sine', 0.3, 32), radius: v(0.32), ringfreq: v(5) }),
      s('groove', 'terrain', ['bloom', 'scanlines'], { ridges: v(12), horizon: v(0.5), glowamt: a(1.2, 'energy', 0.4) }),
      s('groove', 'neonpoly', ['bloom'], { sides: v(6), layers: v(7), thickness: a(0.9, 'lfo-sine', 0.4, 8) }),
      s('groove', 'ps2towers', ['bloom', 'filmgrain'], { towers: v(32), foglevel: v(0.9), orbit: a(0.8, 'energy', 0.3) }),
      s('groove', 'snowride', ['bloom'], { pistewidth: v(1.2), curviness: a(0.8, 'lfo-sine', 0.4, 32), gates: v(5) }),
      s('groove', 'starfield', ['bloom'], { speed: v(1), tile: v(8), density: a(0.6, 'energy', 0.4) }),
      s('groove', 'spiral', ['bloom'], { arms: v(4), twist: v(6), pulse: v(0.3) }),
      s('groove', 'gyroid', ['bloom'], { cells: v(2), shell: v(0.4), travel: v(0.9) }),
      s('peak', 'starfield', ['bloom'], { speed: v(1.8), tile: v(10), density: v(0.6) }),
      s('peak', 'tunnel', ['bloom'], { speed: v(1.3), sides: v(8), twist: a(0.4, 'lfo-sine', 0.4, 8), ringdensity: v(9) }),
      s('peak', 'lasers', ['bloom'], { beams: v(7), spread: v(1), sweep: a(1.2, 'energy', 0.4) }),
      s('peak', 'impact', ['bloom'], { rings: v(3), width: v(2), fade: v(0.8) }),
      s('peak', 'rings', ['bloom'], { speed: v(1.3), ringcount: v(10), spacing: a(0.08, 'bass', 0.4), gapfreq: v(6) }),
      s('peak', 'vortex', ['bloom', 'feedback'], { arms: v(4), twist: v(1.8), pull: a(1, 'bass', 0.5) }),
      s('peak', 'fractal', ['bloom', 'chromatic'], { iterations: v(28), zoom: a(1.3, 'bass', 0.4), morph: a(0.2, 'lfo-sine', 0.4, 8) }),
      s('peak', 'shatter', ['bloom', 'chromatic'], { shards: v(14), burst: a(1.2, 'bass', 0.4), edgeglow: v(1) }),
      s('peak', 'flash', ['bloom'], { decay: v(2), scan: v(0.3), tint: v(1) }),
    ],
    palettes: [AURORA, VAPOR, ICE, PASTEL],
    phraseBars: 8,
    cut: { type: 'crossfade', seconds: 1.2 },
    preferredBpm: 138,
  },

  'drum-n-bass': {
    label: 'Drum & Bass',
    scenes: [
      s('break', 'ascii', ['scanlines'], { cellsize: v(10), levels: v(5), sourcezoom: a(1, 'lfo-sine', 0.3, 32) }),
      s('break', 'spectrum', ['bloom', 'scanlines'], { bars: v(64), mirror: v(1), scope: v(0.9) }),
      s('break', 'smoke', ['filmgrain'], { rise: v(1.2), swirl: v(1.8), dissipate: v(0.3) }),
      s('break', 'static', ['scanlines'], { grain: v(2), roll: v(0.6), bands: v(0.3) }),
      s('break', 'eclipse', ['bloom'], { radius: v(0.26), corona: a(1, 'bass', 0.6), wobble: v(0.6) }),
      s('build', 'spectrum', ['bloom', 'scanlines'], { bars: v(96), mirror: v(1), scope: a(0.5, 'energy', 0.8) }),
      s('build', 'impact', ['bloom'], { speed: v(0.8), rings: v(3), width: v(2), fade: v(0.5) }),
      s('build', 'downpour', ['filmgrain'], { density: a(40, 'energy', 0.9), streak: v(0.3), wind: v(0.3) }),
      s('groove', 'swarm', ['bloom', 'feedback'], { turbulence: v(1.8), drag: v(0.5), burst: v(1.5), dotsize: v(2.2) }),
      s('groove', 'particles', ['bloom'], { count: v(32), size: a(0.012, 'bass', 0.5), spread: v(1.2) }),
      s('groove', 'pulsecity', ['bloom'], { columns: v(28), gapw: v(0.14), punch: a(1.4, 'bass', 0.5) }),
      s('groove', 'rings', ['bloom'], { speed: v(1.3), ringcount: v(9), spacing: a(0.09, 'bass', 0.4), gapfreq: v(8) }),
      s('groove', 'tunnel', ['bloom'], { speed: v(1.4), sides: v(8), twist: a(0.6, 'high', 0.4), ringdensity: v(9) }),
      s('groove', 'orbits', ['bloom', 'feedback'], { speed: v(1.5), bodies: v(12), orbitr: v(0.6), trail: a(0.6, 'energy', 0.4) }),
      s('groove', 'snowride', ['bloom'], { speed: v(1.5), pistewidth: v(0.8), curviness: v(1.3), gates: v(9) }),
      s('groove', 'waves', ['bloom'], { speed: v(1.4), count: v(8), amp: a(0.11, 'bass', 0.5), freq: v(4) }),
      s('groove', 'chevrons', [], { lanes: v(6), thickness: v(0.5), drift: v(2) }),
      s('groove', 'barcode', ['scanlines'], { bars: v(64), gap: v(0.45), jitter: a(1.2, 'high', 0.6) }),
      s('groove', 'cage', ['bloom', 'chromatic'], { size: v(1), thickness: v(1.5), spin: v(1.5) }),
      s('groove', 'cracks', ['bloom'], { cells: v(10), width: v(0.8), glow: a(1.2, 'bass', 0.6) }),
      s('peak', 'glitch', ['rgb-split', 'scanlines'], { blocks: v(16), intensity: a(0.45, 'high', 0.7), fps: v(24) }),
      s('peak', 'lasers', ['bloom'], { beams: v(8), spread: v(0.9), sweep: a(1.5, 'high', 0.4) }),
      s('peak', 'shatter', ['bloom', 'chromatic'], { shards: v(20), burst: a(1.3, 'bass', 0.5), edgeglow: v(1) }),
      s('peak', 'strobegrid', ['bloom'], { cells: v(14), litratio: v(0.25), chaos: a(0.8, 'high', 0.3) }),
      s('peak', 'vortex', ['bloom', 'feedback'], { speed: v(1.3), arms: v(4), twist: a(1.8, 'high', 0.4), pull: v(1.1) }),
      s('peak', 'raymarch', ['bloom', 'chromatic'], { speed: v(1.3), repscale: v(3), glowk: a(1.2, 'energy', 0.5), camfov: v(0.9) }),
      s('peak', 'fractal', ['bloom', 'chromatic'], { iterations: v(24), zoom: a(1.2, 'bass', 0.5), morph: a(0.18, 'lfo-saw', 0.5, 2) }),
      s('peak', 'impact', ['bloom'], { rings: v(6), width: v(1), fade: v(1.6) }),
      s('peak', 'flash', [], { decay: v(4), scan: v(0.5), tint: v(0.3) }),
      s('peak', 'downpour', ['filmgrain'], { density: v(100), streak: v(0.15), wind: v(0.6) }),
    ],
    palettes: [NEON, FIRE, ACID, CYBER],
    phraseBars: 4,
    cut: { type: 'dissolve', seconds: 0.2 },
    preferredBpm: 174,
  },

  // Almost everything is a break scene here: the genre lives there. The peak
  // is what other genres call a groove.
  'ambient': {
    label: 'Ambient',
    scenes: [
      s('break', 'spaceghost', ['bloom'], { speed: v(0.5), folds: v(4), glow: v(45), drift: v(0.4) }),
      s('break', 'caustics', ['bloom'], { causticscale: v(1.3), sharpness: a(0.7, 'lfo-sine', 0.25, 64), depthk: v(1.2) }),
      s('break', 'smoke', ['filmgrain'], { rise: v(0.7), swirl: v(1), dissipate: v(0.4) }),
      s('break', 'reaction', ['bloom'], { feed: v(0.038), kill: v(0.061), inject: v(0.5) }),
      s('break', 'pulsar', ['bloom'], { lines: v(64), peaks: a(0.7, 'lfo-sine', 0.3, 32), flow: v(0.15) }),
      s('break', 'inkflow', ['filmgrain'], { speed: v(0.6), inkscale: v(2), flowspd: v(0.4), inkcontrast: a(1.1, 'bass', 0.3) }),
      s('break', 'ripples', ['bloom'], { spreadv: v(1), heightk: a(0.8, 'bass', 0.4), sheen: v(1.3) }),
      s('break', 'fluid', ['bloom'], { speed: v(0.7), zoom: v(1.1), swirl: a(1.2, 'lfo-sine', 0.3, 32) }),
      s('break', 'waves', ['bloom'], { speed: v(0.7), count: v(4), amp: a(0.12, 'bass', 0.35), freq: v(2) }),
      s('break', 'starfield', ['bloom'], { speed: v(0.5), tile: v(4), density: v(0.5) }),
      s('break', 'orbits', ['bloom', 'feedback'], { speed: v(0.55), bodies: v(5), orbitr: v(0.55), trail: v(0.85) }),
      s('break', 'terrain', ['bloom', 'scanlines'], { speed: v(0.6), ridges: v(8), horizon: v(0.55), glowamt: v(0.8) }),
      s('break', 'plasma', ['bloom'], { speed: v(0.6), zoom: v(1), ringfreq: a(12, 'lfo-sine', 0.25, 32) }),
      s('break', 'ps2towers', ['bloom', 'filmgrain'], { speed: v(0.5), towers: v(16), foglevel: v(1.6), orbit: v(0.3) }),
      s('break', 'lissajous', ['bloom', 'feedback'], { speed: v(0.5), freqa: v(2), freqb: v(3), size: v(0.5) }),
      s('break', 'eclipse', ['bloom'], { speed: v(0.6), radius: v(0.3), corona: v(0.8), wobble: v(0.2) }),
      s('break', 'downpour', ['filmgrain'], { speed: v(0.7), density: v(40), streak: v(0.3), wind: v(0.1) }),
      s('build', 'caustics', ['bloom'], { speed: a(0.5, 'energy', 0.6), causticscale: v(1.2), sharpness: v(0.8), depthk: v(1.3) }),
      s('build', 'eclipse', ['bloom'], { speed: v(0.5), radius: v(0.3), corona: a(0.9, 'energy', 0.6), wobble: v(0.2) }),
      s('build', 'starfield', ['bloom'], { speed: a(0.4, 'energy', 0.7), tile: v(4), density: v(0.5) }),
      s('groove', 'metaballs', ['bloom'], { count: v(6), size: a(0.1, 'bass', 0.3), threshold: v(1.1) }),
      s('groove', 'sacred', ['bloom'], { speed: v(0.5), zoom: v(1.1), radius: v(0.35), ringfreq: a(6, 'lfo-sine', 0.2, 32) }),
      s('groove', 'mandala', ['bloom', 'feedback'], { speed: v(0.5), symmetry: v(10), ringfreq: a(6, 'lfo-sine', 0.2, 32) }),
      s('groove', 'gyroid', ['bloom'], { speed: v(0.6), cells: v(1.6), shell: v(0.4), travel: v(0.4) }),
      s('groove', 'stringart', ['bloom'], { speed: v(0.6), nodes: v(72), multiplier: a(2.2, 'lfo-sine', 0.3, 64), linew: v(0.8) }),
      s('groove', 'truchet', ['bloom'], { speed: v(0.5), tiles: v(6), thickness: v(1), flip: v(0.1) }),
      s('groove', 'blinds', ['filmgrain'], { speed: v(0.6), slats: v(20), open: v(0.4), tilt: v(0.3) }),
      s('groove', 'warehouse', ['filmgrain'], { speed: v(0.5), pillars: v(3), fog: v(1.8), flicker: v(0.1) }),
      s('groove', 'halftone', ['filmgrain'], { speed: v(0.6), dots: v(80), contrast: v(1.3), drift: v(0.2) }),
      s('peak', 'kaleidoscope', ['bloom', 'chromatic'], { speed: v(0.6), segments: v(8), zoom: a(1, 'lfo-sine', 0.2, 32), detail: v(2) }),
      s('peak', 'cracks', ['bloom'], { speed: v(0.6), cells: v(6), width: v(1.2), glow: v(0.6) }),
      s('peak', 'spiral', ['bloom'], { speed: v(0.4), arms: v(1), twist: v(3), pulse: v(0.1) }),
      s('peak', 'quasicrystal', ['bloom', 'chromatic'], { speed: v(0.6), waves: v(6), qfreq: v(30), contrast: v(0.3) }),
    ],
    palettes: [OCEAN, FOREST, PASTEL, GOLD],
    phraseBars: 16,
    cut: { type: 'crossfade', seconds: 3 },
    preferredBpm: 95,
  },

  'tech-house': {
    label: 'Tech House',
    scenes: [
      s('break', 'spectrum', ['bloom', 'scanlines'], { bars: v(48), mirror: v(1), scope: v(0.6) }),
      s('break', 'fluid', ['bloom'], { zoom: v(1.2), swirl: a(1.2, 'lfo-sine', 0.3, 16) }),
      s('break', 'waves', ['bloom'], { count: v(6), amp: a(0.08, 'bass', 0.4), freq: v(3) }),
      s('break', 'orbits', ['bloom', 'feedback'], { bodies: v(8), orbitr: v(0.55), trail: v(0.6) }),
      s('break', 'ripples', ['bloom'], { spreadv: v(1.4), heightk: a(1, 'bass', 0.4), sheen: v(1.2) }),
      s('break', 'caustics', ['bloom'], { causticscale: v(1.5), sharpness: v(0.7), depthk: v(1) }),
      s('break', 'blinds', ['filmgrain'], { slats: v(12), open: v(0.6), tilt: v(0.3) }),
      s('build', 'blinds', ['filmgrain'], { slats: v(16), open: a(0.2, 'energy', 0.8), tilt: v(0.3) }),
      s('build', 'eclipse', ['bloom'], { radius: v(0.26), corona: a(1.2, 'energy', 0.6), wobble: v(0.4) }),
      s('build', 'rings', ['bloom'], { speed: a(0.5, 'energy', 0.8), ringcount: v(6), spacing: v(0.12), gapfreq: v(4) }),
      s('groove', 'truchet', ['bloom'], { tiles: v(10), thickness: a(1, 'bass', 0.4), flip: v(0.5) }),
      s('groove', 'metaballs', ['bloom'], { count: v(7), size: a(0.1, 'bass', 0.4), threshold: v(1) }),
      s('groove', 'voronoi', ['bloom'], { cells: v(9), edgewidth: a(0.05, 'mid', 0.4) }),
      s('groove', 'hexagons', ['bloom'], { zoom: v(5), wavefreq: a(2, 'bass', 0.4) }),
      s('groove', 'pulsecity', ['bloom'], { columns: v(22), gapw: v(0.18), punch: a(1, 'bass', 0.4) }),
      s('groove', 'rings', ['bloom'], { ringcount: v(8), spacing: a(0.09, 'bass', 0.35), gapfreq: v(5) }),
      s('groove', 'moire', [], { density: v(38), moireoff: a(0.1, 'lfo-sine', 0.3, 16), rotspeed: v(0.45) }),
      s('groove', 'neonpoly', ['bloom'], { sides: v(6), layers: v(5), thickness: a(0.8, 'mid', 0.45) }),
      s('groove', 'kaleidoscope', ['bloom', 'chromatic'], { segments: v(10), zoom: a(1.1, 'bass', 0.3), detail: v(2) }),
      s('groove', 'cracks', ['bloom'], { cells: v(9), width: v(1), glow: a(0.9, 'bass', 0.5) }),
      s('groove', 'halftone', ['filmgrain'], { dots: v(60), contrast: v(1.5), drift: v(0.6) }),
      s('groove', 'cage', ['bloom', 'chromatic'], { size: v(0.9), thickness: v(1.5), spin: v(0.8) }),
      s('groove', 'chevrons', [], { lanes: v(4), thickness: v(0.45), drift: v(0.8) }),
      s('peak', 'tunnel', ['bloom'], { speed: v(1.2), sides: v(6), twist: a(0.4, 'bass', 0.4), ringdensity: v(9) }),
      s('peak', 'lasers', ['bloom'], { beams: v(5), spread: v(0.8), sweep: a(1, 'energy', 0.4) }),
      s('peak', 'strobegrid', ['bloom'], { cells: v(12), litratio: v(0.25), chaos: v(0.6) }),
      s('peak', 'impact', ['bloom'], { rings: v(3), width: v(1.5), fade: v(1) }),
      s('peak', 'tribal', ['filmgrain'], { blades: v(8), spikes: v(0.5), turn: v(0.5) }),
      s('peak', 'shatter', ['bloom', 'chromatic'], { shards: v(10), burst: a(1, 'bass', 0.4), edgeglow: v(0.9) }),
      s('peak', 'vortex', ['bloom', 'feedback'], { arms: v(3), twist: v(1.5), pull: a(0.8, 'bass', 0.4) }),
    ],
    palettes: [SUNSET, GOLD, VAPOR, OCEAN],
    phraseBars: 8,
    cut: { type: 'crossfade', seconds: 0.8 },
    preferredBpm: 125,
  },

  'psytrance': {
    label: 'Psytrance',
    scenes: [
      s('break', 'reaction', ['bloom'], { feed: a(0.052, 'lfo-sine', 0.2, 64), kill: v(0.061), inject: v(1.2) }),
      s('break', 'quasicrystal', ['bloom', 'chromatic'], { speed: v(0.7), waves: v(7), qfreq: a(45, 'lfo-sine', 0.3, 64), contrast: v(0.4) }),
      s('break', 'caustics', ['bloom'], { causticscale: v(1.6), sharpness: v(0.8), depthk: v(1.2) }),
      s('break', 'inkflow', ['filmgrain'], { inkscale: v(2.4), flowspd: a(0.6, 'bass', 0.3), inkcontrast: v(1.4) }),
      s('break', 'smoke', ['filmgrain'], { rise: v(1), swirl: v(2), dissipate: v(0.25) }),
      s('break', 'eclipse', ['bloom'], { radius: v(0.24), corona: a(1.4, 'bass', 0.5), wobble: v(1) }),
      s('build', 'spiral', ['bloom'], { speed: a(0.4, 'energy', 0.9), arms: v(7), twist: v(14), pulse: v(0.2) }),
      s('build', 'eclipse', ['bloom'], { radius: v(0.22), corona: a(1.8, 'energy', 0.6), wobble: v(1) }),
      s('build', 'gyroid', ['bloom'], { cells: v(2.4), shell: v(0.3), travel: a(0.3, 'energy', 0.9) }),
      s('groove', 'spaceghost', ['bloom'], { folds: v(4), glow: a(34, 'bass', 0.3), drift: v(1) }),
      s('groove', 'gyroid', ['bloom'], { cells: v(2.4), shell: a(0.45, 'bass', 0.4), travel: v(1) }),
      s('groove', 'swarm', ['bloom', 'feedback'], { turbulence: a(1.4, 'lfo-sine', 0.35, 32), drag: v(0.3), burst: v(1.2), dotsize: v(2.6) }),
      s('groove', 'fractal', ['bloom', 'chromatic'], { iterations: v(36), zoom: a(1.3, 'bass', 0.5), morph: a(0.25, 'lfo-sine', 0.5, 8) }),
      s('groove', 'kaleidoscope', ['bloom', 'chromatic'], { segments: v(16), zoom: a(1.3, 'bass', 0.45), detail: v(2.8) }),
      s('groove', 'sacred', ['bloom'], { zoom: a(1.2, 'lfo-sine', 0.4, 16), radius: v(0.32), ringfreq: v(8) }),
      s('groove', 'mandala', ['bloom', 'feedback'], { symmetry: v(14), ringfreq: a(7, 'bass', 0.4) }),
      s('groove', 'vortex', ['bloom', 'feedback'], { arms: v(6), twist: a(2.2, 'lfo-sine', 0.4, 8), pull: a(1, 'bass', 0.5) }),
      s('groove', 'moire', ['chromatic'], { density: v(65), moireoff: a(0.15, 'lfo-sine', 0.45, 8), rotspeed: v(0.8) }),
      s('groove', 'plasma', ['bloom'], { speed: v(1.2), zoom: a(1.4, 'bass', 0.45), ringfreq: v(20) }),
      s('groove', 'warp', ['bloom', 'chromatic'], { zoom: v(1.3), warpamt: a(1.5, 'mid', 0.5), linefreq: v(8) }),
      s('groove', 'neonpoly', ['bloom'], { sides: v(7), layers: v(8), thickness: a(1.1, 'lfo-sine', 0.5, 4) }),
      s('groove', 'dna', ['bloom'], { speed: v(1.3), reactivity: v(1.4) }),
      s('groove', 'spiral', ['bloom'], { arms: v(5), twist: v(10), pulse: v(0.4) }),
      s('groove', 'tribal', ['filmgrain'], { blades: v(12), spikes: v(0.8), turn: v(0.5) }),
      s('groove', 'cage', ['bloom', 'chromatic'], { size: v(1.2), thickness: v(1.2), spin: v(1.4) }),
      s('peak', 'raymarch', ['bloom', 'chromatic'], { repscale: v(2.5), glowk: a(1.2, 'energy', 0.5), camfov: a(1.1, 'bass', -0.3) }),
      s('peak', 'starfield', ['bloom'], { speed: v(1.4), tile: v(6), density: a(0.5, 'energy', 0.35) }),
      s('peak', 'lasers', ['bloom'], { beams: v(8), spread: v(1.1), sweep: a(1.4, 'energy', 0.5) }),
      s('peak', 'strobegrid', ['bloom'], { cells: v(12), litratio: a(0.3, 'energy', 0.4), chaos: v(0.8) }),
      s('peak', 'impact', ['bloom'], { rings: v(5), width: v(1.2), fade: v(1.2) }),
      s('peak', 'shatter', ['bloom', 'chromatic'], { shards: v(16), burst: a(1.3, 'bass', 0.45), edgeglow: v(1.1) }),
      s('peak', 'tunnel', ['bloom'], { speed: v(1.3), sides: v(3), twist: a(0.7, 'lfo-sine', 0.5, 8), ringdensity: v(10) }),
      s('peak', 'flash', ['bloom'], { decay: v(3), scan: v(0.4), tint: v(1) }),
    ],
    palettes: [TOXIC, ACID, AURORA, CYBER],
    phraseBars: 8,
    cut: { type: 'crossfade', seconds: 0.5 },
    preferredBpm: 145,
  },

  // Bounce techno: rolling offbeat bass, dark room, hypnotic groove with a
  // swing to it. Not Melbourne bounce — no colour party. Grey, red, steel;
  // the pump and the roll are the groove, the strobes are the peak.
  'bounce': {
    label: 'Bounce Techno',
    scenes: [
      s('break', 'eclipse', ['bloom'], { radius: v(0.28), corona: a(0.9, 'bass', 0.5), wobble: v(0.4) }),
      s('break', 'warehouse', ['filmgrain'], { pillars: v(2), fog: v(1.3), flicker: v(0.6) }),
      s('break', 'smoke', ['filmgrain'], { rise: v(0.9), swirl: v(1.4), dissipate: v(0.3) }),
      s('break', 'static', ['scanlines'], { grain: v(3), roll: a(0.6, 'bass', 0.5), bands: v(0.5) }),
      s('build', 'eclipse', ['bloom'], { radius: v(0.22), corona: a(1.6, 'energy', 0.6), wobble: v(0.8) }),
      s('build', 'pump', ['bloom'], { rings: v(10), pump: a(0.3, 'energy', 0.8), spin: v(0.2) }),
      s('build', 'blinds', ['filmgrain'], { slats: v(12), open: a(0.15, 'energy', 0.9), tilt: v(0.4) }),
      s('build', 'impact', ['bloom'], { speed: v(0.6), rings: v(2), width: v(2.5), fade: v(0.4) }),
      s('groove', 'roll', [], { lanes: v(6), pump: v(0.7), drift: v(1) }),
      s('groove', 'pump', ['bloom'], { rings: v(6), pump: v(0.7), spin: v(0.4) }),
      s('groove', 'bounceball', ['filmgrain'], { balls: v(3), bounce: a(1, 'bass', 0.4), squash: v(0.7) }),
      s('groove', 'tunnel', ['bloom'], { speed: v(1.3), sides: v(6), twist: a(0.5, 'bass', 0.5), ringdensity: v(10) }),
      s('groove', 'spiral', ['filmgrain'], { arms: v(2), twist: v(8), pulse: v(0.6) }),
      s('groove', 'tribal', ['filmgrain'], { blades: v(8), spikes: a(0.6, 'high', 0.3), turn: v(1) }),
      s('groove', 'chevrons', [], { lanes: v(5), thickness: v(0.5), drift: v(1.5) }),
      s('groove', 'cage', ['bloom', 'chromatic'], { size: v(1.1), thickness: v(1.8), spin: v(1) }),
      s('groove', 'rings', ['bloom'], { speed: v(1.2), ringcount: v(12), spacing: a(0.07, 'bass', 0.5), gapfreq: v(6) }),
      s('groove', 'cracks', ['bloom'], { cells: v(8), width: v(1), glow: a(1, 'bass', 0.6) }),
      s('groove', 'barcode', ['scanlines'], { bars: v(56), gap: v(0.4), jitter: a(1, 'high', 0.6) }),
      s('groove', 'raymarch', ['bloom', 'chromatic'], { speed: v(1.2), repscale: v(2.6), glowk: v(1.2), camfov: a(1, 'bass', -0.3) }),
      s('groove', 'pulsecity', ['bloom'], { columns: v(18), gapw: v(0.12), punch: a(1.5, 'bass', 0.4) }),
      s('groove', 'roll', ['bloom'], { lanes: v(9), pump: v(0.9), drift: v(1.6) }),
      s('peak', 'flash', [], { decay: v(3), scan: v(0.3), tint: v(0.2) }),
      s('peak', 'impact', ['bloom'], { rings: v(4), width: a(1, 'bass', 0.5), fade: v(1) }),
      s('peak', 'strobegrid', ['bloom'], { cells: v(10), litratio: a(0.35, 'energy', 0.4), chaos: v(0.7) }),
      s('peak', 'lasers', ['bloom'], { beams: v(9), spread: v(1.1), sweep: a(1.3, 'energy', 0.5) }),
      s('peak', 'shatter', ['bloom', 'chromatic'], { shards: v(14), burst: v(1.6), edgeglow: a(1, 'high', 0.6) }),
      s('peak', 'vortex', ['bloom', 'feedback'], { speed: v(1.4), arms: v(5), twist: v(2), pull: a(1.2, 'bass', 0.5) }),
      s('peak', 'glitch', ['rgb-split', 'scanlines'], { blocks: v(18), intensity: a(0.55, 'high', 0.6), fps: v(18) }),
      s('peak', 'pump', ['bloom'], { rings: v(12), pump: v(1), spin: v(1.5) }),
      s('peak', 'neonpoly', ['bloom'], { speed: v(1.4), sides: v(3), layers: v(7), thickness: a(1.5, 'bass', 0.6) }),
    ],
    palettes: [MONO, BLOOD, STEEL, AMBER],
    phraseBars: 8,
    cut: { type: 'crossfade', seconds: 0.25 },
    preferredBpm: 145,
  },
}

// ---------------------------------------------------------------------------

/** Slow fade into a break scene; the drop cuts. Same for every genre. */
export const BREAK_CUT: SceneCut = { type: 'crossfade', seconds: 2.5 }
export const DROP_CUT: SceneCut = { type: 'crossfade', seconds: 0 }

// How the phase is read. `scripts/check-phases.mjs` replays a recording
// through this same class and prints where it heard breaks and drops; these
// were set against a ten-minute hard tekno mix and two demo tracks, by eye on
// the raw bass envelope, and they are the first thing to touch when the
// detector is wrong on a rig.
//
// Why the RAW levels: the analyser scales every band against one slowly
// decaying peak of the whole spectrum, and the bass band sits well above that
// peak on any mastered track, so `bass` is pinned at 1.0 the whole night and
// a breakdown is invisible in it. `bassRaw` is the band's dB-domain level
// (byte/255), never clipped.
//
// Why SWING, not level: a break often keeps a bassline or a pad, so the bass
// level barely moves; what disappears is the kick's transient. The swing
// (max - min) of the smoothed raw bass over half a second is 15-25 dB while a
// kick plays and under 5 dB when it does not, whatever the level. In byte/255
// units 0.0375 is 3 dB.
export const PHASE = {
  /** swing of the smoothed raw bass over 0.5 s below this = no kick (0.1 = 8 dB) */
  breakKick: 0.09,
  /** no kick for this long = break. A fill is 1-2 s; a break is 8 bars. */
  breakHoldMs: 3200,
  /** raw bass rising this much within ~50 ms during a break = the drop */
  dropRise: 0.18,
  /** swing back above this for 2 s with no sharp drop = quiet exit from the break */
  kickBack: 0.16,
  /** loudness (raw energy, ~1.5 s) above its 120 s mean by this = peak; byte/255: 0.0375 is 3 dB */
  peakAbove: 0.03,
  peakRelease: 0.012,
  peakHoldMs: 2500,
  /** in a break, loudness this far above where the break started = the build (0.02 is 1.6 dB) */
  buildAbove: 0.02,
}
/** a scene keeps its palette for this many groove/peak switches */
const PALETTE_EVERY = 4
/** no beats for this long and the phrase clock free-runs at the genre's BPM */
const BEAT_TIMEOUT_MS = 2000

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** the analyser must stand this far above the runner-up key before colours follow it */
const KEY_CONFIDENCE = 0.35

function hueOf(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d === 0) return -1
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return h * 60
}

/** circular mean of the palette's hues; -1 for a grey palette */
export function paletteHue(p: [string, string, string]): number {
  let x = 0, y = 0, n = 0
  for (const c of p) {
    const h = hueOf(c)
    if (h < 0) continue
    x += Math.cos(h * Math.PI / 180); y += Math.sin(h * Math.PI / 180); n++
  }
  if (!n) return -1
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

// Keys on the circle of fifths, a colour wheel: C red, G orange, D yellow, A
// green … the mapping Scriabin and most VJs reach for. A minor key takes the
// hue of its relative major, so A minor is red like C major, but pulls the
// pick toward the cooler palettes.
const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]   // C G D A E B F# C# G# D# A# F
export function keyHue(key: Key): number {
  const major = key.mode === 'major' ? key.tonic : (key.tonic + 3) % 12
  return FIFTHS.indexOf(major) * 30
}

/**
 * The genre palette nearest the key's hue, never the one already showing. A
 * major key prefers warm palettes, a minor one cool; a grey palette is a
 * neutral the key never picks on its own.
 */
export function paletteForKey(palettes: [string, string, string][], key: Key, current: number): number {
  const target = keyHue(key)
  let best = -1, bestScore = Infinity
  palettes.forEach((p, i) => {
    if (i === current) return
    const h = paletteHue(p)
    if (h < 0) return
    let d = Math.abs(h - target); if (d > 180) d = 360 - d
    const warm = h < 60 || h > 330
    const cool = h > 150 && h < 270
    const mode = key.mode === 'major' ? (cool ? 45 : 0) : (warm ? 45 : 0)
    const score = d + mode
    if (score < bestScore) { bestScore = score; best = i }
  })
  return best
}

/** One frame of what the analyser heard. `bassRaw` / `energyRaw` are the unclipped levels. */
export interface AudioFrame {
  beat: boolean
  energy: number
  bass: number
  barPhase: number
  bassRaw: number
  energyRaw: number
  /** the analyser's key, when it has one; picks the palette for the track */
  key?: Key | null
}

export class AutoVJ {
  private enabled = false
  private genre: Genre = 'hard-tekno'
  private phase: Phase = 'groove'

  // kick presence: swing of the smoothed raw bass over the last half second
  private bassSmooth = -1
  private swingRing: { t: number; v: number }[] = []
  private swing = 0
  private bassRing: number[] = []
  private kickLowSince = -1
  private kickBackSince = -1
  private breakSince = 0
  private breakLoud = 0
  // loudness against its own long mean
  private loud = 0
  private loudMean = -1
  private loudHighSince = -1
  private elapsed = 0

  // phrase clock
  private beatsSinceSwitch = 0
  private lastBeatAt = 0
  private lastFrameAt = 0
  private prevBarPhase = 0
  private armed = false
  private armedAt = 0

  // history for the rules
  private recent: EffectId[] = []
  private lastFamily: Family | null = null
  private switchesOnPalette = 0
  private palette = 0
  private key: Key | null = null

  // the user's own scenes (P4), by genre; `onlyMine` makes them the whole
  // rotation for the phases where the user has some
  private userScenes: Partial<Record<Genre, Scene[]>> = {}
  private onlyMine = false

  public onSceneChange: ((scene: Scene, cut: SceneCut, phase: Phase) => void) | null = null
  public onPostChange: ((posts: PostId[]) => void) | null = null
  public onPaletteChange: ((colors: [string, string, string]) => void) | null = null
  /** the phase lamps and the reel (I4) listen here; fires on every change, scene or not */
  public onPhaseChange: ((phase: Phase) => void) | null = null

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (enabled) this.reset()
  }
  isEnabled(): boolean { return this.enabled }
  getGenre(): Genre { return this.genre }
  getPhase(): Phase { return this.phase }
  getKey(): Key | null { return this.key }
  setUserScenes(byGenre: Partial<Record<Genre, Scene[]>>, onlyMine: boolean) {
    this.userScenes = byGenre
    this.onlyMine = onlyMine
  }
  /** what the phase is read from — for the replay tool and the phase lamps */
  getEnvelopes(): { kick: number; loud: number; loudMean: number } {
    return { kick: this.swing, loud: this.loud, loudMean: Math.max(0, this.loudMean) }
  }

  setGenre(genre: Genre) {
    this.genre = genre
    this.reset()
  }

  private setPhase(phase: Phase) {
    if (phase === this.phase) return
    this.phase = phase
    this.onPhaseChange?.(phase)
  }

  private reset() {
    this.phase = 'groove'
    this.breakLoud = 0
    this.beatsSinceSwitch = 0
    this.armed = false
    this.recent = []
    this.lastFamily = null
    this.switchesOnPalette = 0
    this.palette = Math.floor(Math.random() * GENRE_CONFIGS[this.genre].palettes.length)
    this.bassSmooth = -1
    this.swingRing = []
    this.swing = 0
    this.bassRing = []
    this.kickLowSince = -1
    this.kickBackSince = -1
    this.loud = 0
    this.loudMean = -1
    this.loudHighSince = -1
    this.elapsed = 0
    this.lastBeatAt = 0
    this.lastFrameAt = 0
  }

  /**
   * Call every frame. `t` is a clock in ms, for tests and the replay tool.
   * The phase is tracked with the Auto VJ on or off (the track-change
   * detector reads it); scenes and palettes move only when it is on.
   */
  update(frame: AudioFrame, t: number = now()) {
    const config = GENRE_CONFIGS[this.genre]
    if (frame.key !== undefined) this.key = frame.key
    const dt = this.lastFrameAt ? Math.min(100, t - this.lastFrameAt) : 16
    this.lastFrameAt = t
    this.elapsed += dt
    const k = (ms: number) => 1 - Math.exp(-dt / ms)

    // --- kick presence: swing of the smoothed bass over the last 500 ms
    this.bassSmooth = this.bassSmooth < 0 ? frame.bassRaw : this.bassSmooth + (frame.bassRaw - this.bassSmooth) * k(40)
    this.swingRing.push({ t, v: this.bassSmooth })
    while (this.swingRing.length && this.swingRing[0].t < t - 500) this.swingRing.shift()
    let lo = 1, hi = 0
    for (const e of this.swingRing) { if (e.v < lo) lo = e.v; if (e.v > hi) hi = e.v }
    // smoothed itself, so one quiet half-second between two kicks is not a break
    this.swing += ((hi - lo) - this.swing) * k(400)
    const kick = this.swing
    this.bassRing.push(frame.bassRaw)
    if (this.bassRing.length > 4) this.bassRing.shift()
    const rise = frame.bassRaw - this.bassRing[0]

    // --- loudness against its long mean (the mean ignores silence)
    this.loud += (frame.energyRaw - this.loud) * k(1500)
    if (frame.energyRaw > 0.02) {
      if (this.loudMean < 0) this.loudMean = frame.energyRaw
      else this.loudMean += (frame.energyRaw - this.loudMean) * k(Math.min(120000, 8000 + this.elapsed))
    }

    // --- the drop: the bass comes back sharply after a break. Cut now.
    if ((this.phase === 'break' || this.phase === 'build') && t - this.breakSince > 4000 && rise > PHASE.dropRise) {
      this.setPhase('peak')
      this.loudHighSince = t
      this.kickLowSince = -1
      this.swing = PHASE.kickBack          // assume the kick is back; the envelope confirms in a beat
      this.nextPalette(config)
      this.switchTo(config, 'peak', DROP_CUT)
      return
    }

    // --- the break: no kick for a while. Fade slow, then hold.
    if (kick < PHASE.breakKick) {
      if (this.kickLowSince < 0) this.kickLowSince = t
      else if (this.phase !== 'break' && this.phase !== 'build' && t - this.kickLowSince > PHASE.breakHoldMs) {
        this.setPhase('break')
        this.breakSince = t
        this.breakLoud = this.loud
        this.armed = false
        this.switchTo(config, 'break', BREAK_CUT)
        return
      }
    } else {
      this.kickLowSince = -1
    }
    // a kick that fades back in without a drop: leave the break quietly
    if ((this.phase === 'break' || this.phase === 'build') && kick > PHASE.kickBack) {
      if (this.kickBackSince < 0) this.kickBackSince = t
      else if (t - this.kickBackSince > 2000) { this.setPhase('groove'); this.armed = true; this.armedAt = t }
    } else {
      this.kickBackSince = -1
    }
    // the build: still no kick, but the room is getting louder than the break was
    if (this.phase === 'break' && t - this.breakSince > 4000 && this.loud - this.breakLoud > PHASE.buildAbove) {
      this.setPhase('build')
      this.switchTo(config, 'build', config.cut)
      return
    }
    // a build that sags back to where the break was is a break again
    if (this.phase === 'build' && this.loud - this.breakLoud < PHASE.buildAbove * 0.25) this.setPhase('break')

    // --- peak / groove on loudness, with hysteresis
    if (this.phase !== 'break' && this.phase !== 'build' && this.loudMean >= 0) {
      const above = this.loud - this.loudMean
      if (above > PHASE.peakAbove) {
        if (this.loudHighSince < 0) this.loudHighSince = t
        else if (this.phase === 'groove' && t - this.loudHighSince > PHASE.peakHoldMs) {
          this.setPhase('peak')
          this.armed = true       // a peak wants its own scene on the next downbeat
          this.armedAt = t
        }
      } else {
        this.loudHighSince = -1
        if (this.phase === 'peak' && above < PHASE.peakRelease) this.setPhase('groove')
      }
    }

    // --- phrase clock: real beats, or the genre's tempo when the tracker is silent
    if (frame.beat) {
      this.beatsSinceSwitch += 1
      this.lastBeatAt = t
    } else if (this.lastBeatAt === 0 || t - this.lastBeatAt > BEAT_TIMEOUT_MS) {
      this.beatsSinceSwitch += dt / 1000 * config.preferredBpm / 60
    }
    const beatsWanted = this.phraseBeats(config)
    if (!this.armed && this.beatsSinceSwitch >= beatsWanted) {
      this.armed = true
      this.armedAt = t
    }

    // an armed switch fires on the downbeat, or after two bars if there is none
    if (this.armed) {
      const barWrapped = this.prevBarPhase > 0.5 && frame.barPhase < 0.1
      const barMs = 4 * 60000 / config.preferredBpm
      if (barWrapped || t - this.armedAt > 2 * barMs) {
        this.armed = false
        this.switchTo(config, this.phase, config.cut)
      }
    }
    this.prevBarPhase = frame.barPhase
  }

  /** beats a scene lasts in the current phase */
  private phraseBeats(config: GenreConfig): number {
    const bars = this.phase === 'peak' ? Math.max(2, config.phraseBars / 2)
      : this.phase === 'break' || this.phase === 'build' ? config.phraseBars * 2
      : config.phraseBars
    return bars * 4
  }

  private switchTo(config: GenreConfig, phase: Phase, cut: SceneCut) {
    if (!this.enabled) return
    const scene = this.pick(config, phase)
    if (!scene) return
    this.beatsSinceSwitch = 0
    this.recent = [scene.effect, ...this.recent].slice(0, 3)
    this.lastFamily = FAMILY[scene.effect]
    this.onSceneChange?.(scene, cut, phase)
    this.onPostChange?.(scene.posts)
    // the palette block counts groove and peak scenes; a break keeps its colour
    if (phase !== 'break' && phase !== 'build') {
      this.switchesOnPalette += 1
      if (this.switchesOnPalette >= PALETTE_EVERY) this.nextPalette(config)
    }
  }

  private nextPalette(config: GenreConfig) {
    if (!this.enabled) return
    this.switchesOnPalette = 0
    if (config.palettes.length < 2) return
    const byKey = this.key && this.key.confidence >= KEY_CONFIDENCE
      ? paletteForKey(config.palettes, this.key, this.palette) : -1
    const next = byKey >= 0 ? byKey
      : (this.palette + 1 + Math.floor(Math.random() * (config.palettes.length - 1))) % config.palettes.length
    this.palette = next
    this.onPaletteChange?.(config.palettes[next])
  }

  /**
   * A scene for the phase that is not one of the last three effects and not
   * the family just shown. If the phase has none left under those rules the
   * rules relax one at a time; if the phase has no scenes at all, the
   * neighbouring phase stands in.
   */
  private pick(config: GenreConfig, phase: Phase): Scene | null {
    const mine = this.userScenes[this.genre] ?? []
    const mineInPhase = mine.filter(sc => sc.phase === phase)
    // "solo le mie" holds for the phases the user has written; the others
    // still need a picture, so the factory covers them
    const all = this.onlyMine && mineInPhase.length ? mine : [...config.scenes, ...mine]
    const inPhase = all.filter(sc => sc.phase === phase)
    // a genre with no build scenes rides the build on its break scenes
    const pool = inPhase.length ? inPhase
      : phase === 'build' ? all.filter(sc => sc.phase === 'break')
      : all.filter(sc => sc.phase === 'groove')
    if (!pool.length) return null
    const notRecent = (sc: Scene) => !this.recent.includes(sc.effect)
    const otherFamily = (sc: Scene) => FAMILY[sc.effect] !== this.lastFamily
    const candidates =
      pool.filter(sc => notRecent(sc) && otherFamily(sc)).length ? pool.filter(sc => notRecent(sc) && otherFamily(sc))
      : pool.filter(notRecent).length ? pool.filter(notRecent)
      : pool.filter(sc => sc.effect !== this.recent[0]).length ? pool.filter(sc => sc.effect !== this.recent[0])
      : pool
    return candidates[Math.floor(Math.random() * candidates.length)]
  }
}
