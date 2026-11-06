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
    name: 'Club & Strobo',
    effects: [
      { id: 'flash', label: 'Flash', icon: '▮' },
      { id: 'strobegrid', label: 'Strobe', icon: '▦' },
      { id: 'lasers', label: 'Lasers', icon: '☄' },
      { id: 'beamfield', label: 'Beamfield', icon: '☼' },
      { id: 'truss', label: 'Truss', icon: '⌁' },
      { id: 'impact', label: 'Impact', icon: '◎' },
      { id: 'kickworks', label: 'Fireworks', icon: '✸' },
      { id: 'pump', label: 'Pump', icon: '▣' },
      { id: 'bounceball', label: 'Balls', icon: '●' },
      { id: 'roll', label: 'Roll', icon: '▬' },
      { id: 'chevrons', label: 'Hazard', icon: '⋀' },
      { id: 'barcode', label: 'Barcode', icon: '▥' },
      { id: 'blinds', label: 'Blinds', icon: '☰' },
      { id: 'typeslam', label: 'Type', icon: 'A' },
      { id: 'pulsecity', label: 'City', icon: '▮' },
      { id: 'spectrum', label: 'Spectrum', icon: '▁' },
      { id: 'pulsar', label: 'Pulsar', icon: '⩘' },
      { id: 'eclipse', label: 'Eclipse', icon: '●' },
    ],
  },
  {
    name: 'Industriale & Dark',
    effects: [
      { id: 'warehouse', label: 'Bunker', icon: '⌂' },
      { id: 'datacenter', label: 'Datacenter', icon: '▧' },
      { id: 'pistons', label: 'Pistons', icon: '⊓' },
      { id: 'chainfence', label: 'Chainfence', icon: '⊠' },
      { id: 'cathedral', label: 'Cathedral', icon: '✝' },
      { id: 'monolith', label: 'Monolith', icon: '▯' },
      { id: 'vaultdoor', label: 'Vaultdoor', icon: '⬭' },
      { id: 'reactor', label: 'Reactor', icon: '☢' },
      { id: 'turbine', label: 'Turbine', icon: '⚙' },
      { id: 'cage', label: 'Cage', icon: '▣' },
      { id: 'static', label: 'Static', icon: '▩' },
      { id: 'cracks', label: 'Cracks', icon: '⌇' },
      { id: 'downpour', label: 'Rain', icon: '⁞' },
      { id: 'storm', label: 'Storm', icon: 'ϟ' },
      { id: 'android', label: 'Android', icon: '☤' },
      { id: 'faces', label: 'Maschere', icon: '☺' },
      { id: 'tribal', label: 'Tribal', icon: '✵' },
    ],
  },
  {
    name: 'Viaggi 3D',
    effects: [
      { id: 'tunnel', label: 'Tunnel', icon: '◎' },
      { id: 'pipes', label: 'Pipes', icon: '⟲' },
      { id: 'ps2towers', label: 'PS2', icon: '▊' },
      { id: 'snowride', label: 'Snow', icon: '❅' },
      { id: 'raymarch', label: 'Lattice', icon: '⌗' },
      { id: 'gyroid', label: 'Gyroid', icon: '⌬' },
      { id: 'hypercube', label: 'Hypercube', icon: '◫' },
      { id: 'chrome', label: 'Chrome', icon: '◍' },
      { id: 'mandelbulb', label: 'Mandelbulb', icon: '❂' },
      { id: 'ringworld', label: 'Ring', icon: '◎' },
      { id: 'escher', label: 'Escher', icon: '⌗' },
      { id: 'isoblocks', label: 'Blocks', icon: '⬢' },
      { id: 'terrain', label: 'Terrain', icon: '⛰' },
      { id: 'starfield', label: 'Stars', icon: '✧' },
      { id: 'galaxy', label: 'Galaxy', icon: '✹' },
      { id: 'mesh', label: 'Mesh 3D', icon: '⬡' },
      { id: 'crystals', label: 'Crystals', icon: '◆' },
    ],
  },
  {
    name: 'Psichedelici',
    effects: [
      { id: 'kaleidoscope', label: 'Kaleido', icon: '✦' },
      { id: 'mandala', label: 'Mandala', icon: '❋' },
      { id: 'sacred', label: 'Sacred', icon: '✡' },
      { id: 'fractal', label: 'Fractal', icon: '✻' },
      { id: 'spiral', label: 'Spiral', icon: '๑' },
      { id: 'vortex', label: 'Vortex', icon: '❂' },
      { id: 'warp', label: 'Warp', icon: '∿' },
      { id: 'plasma', label: 'Plasma', icon: '◈' },
      { id: 'fluid', label: 'Fluid', icon: '≋' },
      { id: 'inkflow', label: 'Ink', icon: '☰' },
      { id: 'quasicrystal', label: 'Quasi', icon: '❉' },
      { id: 'moire', label: 'Moiré', icon: '◎' },
      { id: 'vegabulge', label: 'Vega', icon: '◙' },
      { id: 'spaceghost', label: 'Ghost', icon: '☁' },
      { id: 'lissajous', label: 'Lissaj', icon: '∞' },
      { id: 'stringart', label: 'String', icon: '✴' },
      { id: 'neonpoly', label: 'Neon', icon: '⬠' },
      { id: 'rings', label: 'Rings', icon: '◉' },
      { id: 'hexagons', label: 'Hex', icon: '⏣' },
    ],
  },
  {
    name: 'Organici & Natura',
    effects: [
      { id: 'fire', label: 'Fire', icon: '△' },
      { id: 'smoke', label: 'Smoke', icon: '♨' },
      { id: 'reaction', label: 'React', icon: '❋' },
      { id: 'caustics', label: 'Caustic', icon: '≈' },
      { id: 'ripples', label: 'Ripples', icon: '≈' },
      { id: 'medusae', label: 'Medusae', icon: '☂' },
      { id: 'mycelium', label: 'Mycelium', icon: '⟡' },
      { id: 'agate', label: 'Agate', icon: '◐' },
      { id: 'ribbons', label: 'Ribbons', icon: '∽' },
      { id: 'swarm', label: 'Swarm', icon: '✺' },
      { id: 'particles', label: 'Particle', icon: '⁂' },
      { id: 'orbits', label: 'Orbits', icon: '☉' },
      { id: 'plasmaglobe', label: 'Globe', icon: '◉' },
      { id: 'fluxlines', label: 'Flux', icon: '∿' },
      { id: 'waves', label: 'Waves', icon: '〰' },
      { id: 'dna', label: 'DNA', icon: '⧖' },
      { id: 'metaballs', label: 'Meta', icon: '●' },
    ],
  },
  {
    name: 'Digitali & Glitch',
    effects: [
      { id: 'glitch', label: 'Glitch', icon: '⚡' },
      { id: 'matrix', label: 'Matrix', icon: '▤' },
      { id: 'ascii', label: 'ASCII', icon: '⌨' },
      { id: 'macromosh', label: 'Mosh', icon: '▦' },
      { id: 'pixelsort', label: 'Sort', icon: '▤' },
      { id: 'halftone', label: 'Xerox', icon: '⁙' },
      { id: 'truchet', label: 'Truchet', icon: '◜' },
      { id: 'voronoi', label: 'Voronoi', icon: '⬡' },
      { id: 'grid', label: 'Grid', icon: '⊞' },
      { id: 'shatter', label: 'Shatter', icon: '❖' },
      { id: 'isocontour', label: 'Contour', icon: '⊚' },
      { id: 'imgbeat', label: 'Immagine a tempo', icon: '▣' },
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
      { id: 'rgb-delay', label: 'RGB Delay', icon: '▤', desc: 'Canali colore da frame diversi' },
      { id: 'invert', label: 'Invert', icon: '◑', desc: 'Colori in negativo' },
    ],
  },
  {
    name: 'Distorsione',
    effects: [
      { id: 'feedback', label: 'Feedback', icon: '↻', desc: 'Scia in feedback' },
      { id: 'mirror', label: 'Mirror', icon: '⎸', desc: 'Simmetria: giù con l\'amount passa a verticale, quad, kaleido 6 e 8' },
      { id: 'pixelate', label: 'Pixelate', icon: '▦', desc: 'Pixel retrò' },
      { id: 'displace', label: 'Displace', icon: '≈', desc: 'Onde e noise spostano i pixel sul basso' },
    ],
  },
  {
    name: 'Pellicola & Grana',
    effects: [
      { id: 'filmgrain', label: 'Film Grain', icon: '⁘', desc: 'Grana analogica' },
      { id: 'scanlines', label: 'Scanlines', icon: '≡', desc: 'Righe CRT' },
    ],
  },
  {
    name: 'Cinema',
    effects: [
      { id: 'anamorphic', label: 'Anamorphic', icon: '⟷', desc: 'Flare orizzontale blu sulle alte luci' },
      { id: 'halation', label: 'Halation', icon: '◌', desc: 'Alone caldo attorno alle luci' },
      { id: 'godrays', label: 'God Rays', icon: '☀', desc: 'Raggi radiali dalle alte luci' },
      { id: 'cinegrade', label: 'Cine Grade', icon: '▭', desc: 'Curva a S, split-toning dalla palette, vignetta' },
      { id: 'tiltshift', label: 'Tilt Shift', icon: '⎯', desc: 'Profondita di campo finta con bokeh' },
    ],
  },
  {
    name: 'Frame',
    effects: [
      { id: 'frame-glitch', label: 'Frame Glitch', icon: '▤', desc: 'Righe che saltano, tear e bleed sui colpi' },
      { id: 'outline', label: 'Outline', icon: '◇', desc: 'Contorni neon nel colore 1, originale attenuato' },
    ],
  },
]

/**
 * Effects that show fewer than the palette's three colours, measured on the
 * rendered frame by `yarn check:palette-use` (pure R/G/B palette; one colour
 * ≥ 75% of the chroma = 1, one under 10% = 2). Anything not listed shows all
 * three. The grid puts a badge on these, so a monochrome look is a choice the
 * VJ sees and not a palette that seems to do nothing. The four at 1 are
 * monochrome by design (hazard stripes, a black sun, rain code, tribal ink).
 */
export const EFFECT_PALETTE_USE: Partial<Record<EffectId, 1 | 2>> = {
  eclipse: 1, chevrons: 1, matrix: 1, tribal: 1,
  faces: 2, spaceghost: 2, cage: 2, reactor: 2, warp: 2, inkflow: 2, starfield: 2, plasmaglobe: 2,
  ascii: 2, pipes: 2, fluid: 2, reaction: 2, galaxy: 2, orbits: 2, lasers: 2, strobegrid: 2,
  ps2towers: 2, fire: 2, caustics: 2, vortex: 2, mesh: 2, pulsar: 2, snowride: 2,
}

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
export const TRANSITIONS: { id: TransitionType; label: string }[] = [
  { id: 'crossfade', label: 'Dissolvenza' },
  { id: 'wipe-left', label: 'Tendina ←' },
  { id: 'wipe-down', label: 'Tendina ↓' },
  { id: 'radial', label: 'A cerchio' },
  { id: 'dissolve', label: 'A grana' },
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
  { id: 'bounce', label: 'Bounce Techno', desc: 'Groove rotolante, scuro, pompa sull\'offbeat' },
]
