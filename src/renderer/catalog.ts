import type { EffectId, PostId, TransitionType } from '@engine/Engine'
import type { Genre } from '@engine/AutoVJ'

/**
 * The single catalog of everything the user picks by name: effects, post-FX,
 * palettes. It lives here, and not in the panel that happens to render it,
 * because a second hand-written copy always drifts — the deck B selector used
 * to list 21 of the 46 effects, so 25 of them could not be put on deck B at all.
 *
 * Anything that shows an effect or a post-FX to the user takes its label from
 * here. Nothing shows a raw engine id.
 */

export const EFFECT_CATEGORIES: { name: string; effects: { id: EffectId; label: string; icon: string }[] }[] = [
  {
    name: 'Geometrici',
    effects: [
      { id: 'tunnel', label: 'Tunnel', icon: '◎' },
      { id: 'kaleidoscope', label: 'Kaleido', icon: '✦' },
      { id: 'voronoi', label: 'Voronoi', icon: '⬡' },
      { id: 'sacred', label: 'Sacred', icon: '✡' },
      { id: 'mandala', label: 'Mandala', icon: '❋' },
      { id: 'hexagons', label: 'Hex', icon: '⏣' },
      { id: 'rings', label: 'Rings', icon: '◉' },
      { id: 'moire', label: 'Moiré', icon: '◎' },
      { id: 'neonpoly', label: 'Neon', icon: '⬠' },
      { id: 'truchet', label: 'Truchet', icon: '◜' },
      { id: 'quasicrystal', label: 'Quasi', icon: '❉' },
      { id: 'stringart', label: 'String', icon: '✴' },
    ],
  },
  {
    name: 'Organici',
    effects: [
      { id: 'fluid', label: 'Fluid', icon: '≋' },
      { id: 'plasma', label: 'Plasma', icon: '◈' },
      { id: 'warp', label: 'Warp', icon: '∿' },
      { id: 'metaballs', label: 'Meta', icon: '●' },
      { id: 'fire', label: 'Fire', icon: '△' },
      { id: 'fractal', label: 'Fractal', icon: '✻' },
      { id: 'inkflow', label: 'Ink', icon: '☰' },
      { id: 'reaction', label: 'React', icon: '❋' },
      { id: 'caustics', label: 'Caustic', icon: '≈' },
      { id: 'smoke', label: 'Smoke', icon: '♨' },
      { id: 'ripples', label: 'Ripples', icon: '≈' },
      { id: 'vortex', label: 'Vortex', icon: '❂' },
    ],
  },
  {
    name: 'Movimento',
    effects: [
      { id: 'particles', label: 'Particle', icon: '⁂' },
      { id: 'swarm', label: 'Swarm', icon: '✺' },
      { id: 'starfield', label: 'Stars', icon: '✧' },
      { id: 'waves', label: 'Waves', icon: '〰' },
      { id: 'pulsar', label: 'Pulsar', icon: '⩘' },
      { id: 'lissajous', label: 'Lissaj', icon: '∞' },
      { id: 'dna', label: 'DNA', icon: '⧖' },
      { id: 'orbits', label: 'Orbits', icon: '☉' },
      { id: 'terrain', label: 'Terrain', icon: '⛰' },
      { id: 'pulsecity', label: 'City', icon: '▮' },
      { id: 'shatter', label: 'Shatter', icon: '❖' },
    ],
  },
  {
    name: 'Digitali',
    effects: [
      { id: 'matrix', label: 'Matrix', icon: '▤' },
      { id: 'grid', label: 'Grid', icon: '⊞' },
      { id: 'glitch', label: 'Glitch', icon: '⚡' },
      { id: 'lasers', label: 'Lasers', icon: '☄' },
      { id: 'strobegrid', label: 'Strobe', icon: '▦' },
      { id: 'raymarch', label: 'Lattice', icon: '⌗' },
      { id: 'gyroid', label: 'Gyroid', icon: '⌬' },
      { id: 'ascii', label: 'ASCII', icon: '⌨' },
      { id: 'spectrum', label: 'Spectrum', icon: '▁' },
    ],
  },
  {
    name: 'Videogame',
    effects: [
      { id: 'ps2towers', label: 'PS2', icon: '▊' },
      { id: 'snowride', label: 'Snow', icon: '❅' },
    ],
  },
]

export const POST_CATEGORIES: { name: string; effects: { id: PostId; label: string; icon: string; desc: string }[] }[] = [
  {
    name: 'Luce & Colore',
    effects: [
      { id: 'bloom', label: 'Bloom', icon: '✦', desc: 'Diffusione del glow' },
      { id: 'chromatic', label: 'Chromatic', icon: '◐', desc: 'Aberrazione prismatica' },
      { id: 'rgb-split', label: 'RGB Split', icon: '▥', desc: 'Offset canali colore' },
      { id: 'invert', label: 'Invert', icon: '◑', desc: 'Colori in negativo' },
    ],
  },
  {
    name: 'Distorsione',
    effects: [
      { id: 'feedback', label: 'Feedback', icon: '↻', desc: 'Scia in feedback' },
      { id: 'mirror', label: 'Mirror', icon: '⎸', desc: 'Simmetria orizzontale' },
      { id: 'pixelate', label: 'Pixelate', icon: '▦', desc: 'Pixel retrò' },
    ],
  },
  {
    name: 'Pellicola & Grana',
    effects: [
      { id: 'filmgrain', label: 'Film Grain', icon: '⁘', desc: 'Grana analogica' },
      { id: 'scanlines', label: 'Scanlines', icon: '≡', desc: 'Righe CRT' },
    ],
  },
]

export const COLOR_PRESETS: { label: string; colors: [string, string, string] }[] = [
  { label: 'Acido', colors: ['#00ff88', '#ff00ff', '#4444ff'] },
  { label: 'Fuoco', colors: ['#ff4400', '#ffaa00', '#ff0066'] },
  { label: 'Ghiaccio', colors: ['#00ccff', '#0044ff', '#88ffff'] },
  { label: 'Tossico', colors: ['#00ff00', '#aaff00', '#00ff88'] },
  { label: 'Neon', colors: ['#ff00ff', '#00ffff', '#ffff00'] },
  { label: 'Sangue', colors: ['#ff0000', '#880000', '#ff4444'] },
  { label: 'Vapore', colors: ['#ff71ce', '#01cdfe', '#b967ff'] },
  { label: 'Mono', colors: ['#ffffff', '#888888', '#ffffff'] },
  { label: 'Tramonto', colors: ['#ff6b35', '#f7c59f', '#1a535c'] },
  { label: 'Oceano', colors: ['#0077b6', '#00b4d8', '#90e0ef'] },
  { label: 'Foresta', colors: ['#2d6a4f', '#52b788', '#95d5b2'] },
  { label: 'Cyber', colors: ['#f72585', '#7209b7', '#3a0ca3'] },
  { label: 'Oro', colors: ['#ffd700', '#daa520', '#b8860b'] },
  { label: 'Pastello', colors: ['#ffc8dd', '#bde0fe', '#a2d2ff'] },
  { label: 'Lava', colors: ['#ff4500', '#ff6347', '#2b0000'] },
  { label: 'Aurora', colors: ['#00ff87', '#60efff', '#ff00e5'] },
]


/** Flat list, panel order — the order the hotkeys 1-0 follow */
export const ALL_EFFECTS = EFFECT_CATEGORIES.flatMap(c =>
  c.effects.map(fx => ({ ...fx, category: c.name })))

export const EFFECT_COUNT = ALL_EFFECTS.length

const EFFECT_LABELS = Object.fromEntries(
  ALL_EFFECTS.map(fx => [fx.id, fx.label])) as Record<EffectId, string>

const POST_LABELS = Object.fromEntries(
  POST_CATEGORIES.flatMap(c => c.effects).map(fx => [fx.id, fx.label])) as Record<PostId, string>

/** Human label for an effect id. Falls back to the id so a stale preset still
 *  shows something, but that is a bug to fix, not a state to live in. */
export function effectLabel(id: EffectId): string {
  return EFFECT_LABELS[id] ?? id
}

export function postLabel(id: PostId): string {
  return POST_LABELS[id] ?? id
}

/**
 * The five transitions, named once. The effects panel called them
 * Fade / Wipe← / Wipe↓ / Radial / Noise while the sequence editor called the
 * same five crossfade / wipe orizzontale / wipe verticale / radiale /
 * dissolvenza — two names for one thing, in one app.
 */
export const TRANSITIONS: { id: TransitionType; label: string; short: string }[] = [
  { id: 'crossfade', label: 'Dissolvenza', short: 'Diss.' },
  { id: 'wipe-left', label: 'Tendina ←', short: 'Tend.←' },
  { id: 'wipe-down', label: 'Tendina ↓', short: 'Tend.↓' },
  { id: 'radial', label: 'A cerchio', short: 'Cerchio' },
  { id: 'dissolve', label: 'A grana', short: 'Grana' },
]

/**
 * The ten genres, named once. Simple mode listed them from `GENRE_CONFIGS`
 * with bare labels while the Auto VJ panel kept its own array with one-line
 * descriptions — the same ten, described in one place and not the other.
 */
export const GENRES: { id: Genre; label: string; desc: string }[] = [
  { id: 'acid-techno', label: 'Acid Techno', desc: 'Veloce, psichedelico, neon' },
  { id: 'hard-tekno', label: 'Hard Tekno', desc: 'Aggressivo, intenso, cambi rapidi' },
  { id: 'dark-industrial', label: 'Dark Industrial', desc: 'Glitch, monocromo, digitale' },
  { id: 'minimal-hypnotic', label: 'Minimal', desc: 'Lento, fluido, ipnotico' },
  { id: 'trance', label: 'Trance', desc: 'Colorato, morbido, sognante' },
  { id: 'drum-n-bass', label: 'Drum & Bass', desc: 'Rapido, energico, particelle' },
  { id: 'ambient', label: 'Ambient', desc: 'Calmo, fluido, colori tenui' },
  { id: 'gabber', label: 'Gabber', desc: 'Caos totale, glitch, velocissimo' },
  { id: 'tech-house', label: 'Tech House', desc: 'Groove caldo, geometrie morbide' },
  { id: 'psytrance', label: 'Psytrance', desc: 'Frattali, caleidoscopi, acidissimo' },
]
