import type { AudioSource } from './EffectParams'

/**
 * Il mapping consigliato di ogni effetto: un preset, scelto a mano.
 *
 * Criterio per effetto: una cosa sul basso o sul kick (dimensione, spinta,
 * pulsazione), una sugli alti o sull'energia (dettaglio, caos, luce), una su
 * un LFO lento (rotazione, deriva, zoom). Mai tutto sulla stessa banda — una
 * scena dove tutto pompa insieme e' un vu-meter, non un visual. Il punto di
 * partenza e' la mappatura piu' usata nelle scene dell'Auto VJ per quel
 * parametro, corretta dove era pigra.
 *
 * La modulazione e' additiva (valore + sorgente × depth × range), quindi
 * `value` abbassa il default quando serve spazio per salire. I conteggi
 * (lati, bracci, corsie) vanno su un LFO a scatto lento: su una banda audio
 * sfarfallerebbero.
 *
 * `scripts/check-mappings.mjs` verifica chiavi, sorgenti, range e budget.
 */
export interface Recommendation {
  source: AudioSource
  depth: number
  /** solo LFO: battute per giro */
  lfoRate?: number
  /** valore base da impostare insieme al mapping, se il default va spostato */
  value?: number
}

export const RECOMMENDED: Record<string, Record<string, Recommendation>> = {
  tunnel: {
    ringdensity: { source: 'bass', depth: 0.35, value: 8 },
    twist: { source: 'lfo-sine', depth: 0.4, lfoRate: 8 },
    sides: { source: 'lfo-square', depth: 0.25, lfoRate: 16 },
  },
  kaleidoscope: {
    zoom: { source: 'bass', depth: 0.4, value: 2 },
    detail: { source: 'mid', depth: 0.3, value: 6 },
    segments: { source: 'lfo-square', depth: 0.3, lfoRate: 16 },
  },
  warp: {
    warpamt: { source: 'mid', depth: 0.5, value: 1.5 },
    zoom: { source: 'bass', depth: 0.35, value: 0.9 },
    linefreq: { source: 'lfo-sine', depth: 0.3, lfoRate: 32 },
  },
  plasma: {
    zoom: { source: 'bass', depth: 0.4, value: 1.3 },
    ringfreq: { source: 'lfo-sine', depth: 0.3, lfoRate: 16, value: 14 },
  },
  matrix: {
    fallspeed: { source: 'bass', depth: 0.4, value: 1 },
    trailfade: { source: 'high', depth: 0.3 },
    cols: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  voronoi: {
    edgewidth: { source: 'high', depth: 0.4, value: 0.04 },
    cells: { source: 'bass', depth: 0.3, value: 3 },
  },
  sacred: {
    zoom: { source: 'lfo-sine', depth: 0.3, lfoRate: 32, value: 1.1 },
    radius: { source: 'bass', depth: 0.35, value: 0.45 },
    ringfreq: { source: 'energy', depth: 0.3, value: 10 },
  },
  fractal: {
    zoom: { source: 'bass', depth: 0.45, value: 1.4 },
    morph: { source: 'lfo-saw', depth: 0.4, lfoRate: 4, value: 0.2 },
    iterations: { source: 'high', depth: 0.3, value: 30 },
  },
  particles: {
    size: { source: 'bass', depth: 0.5, value: 0.012 },
    spread: { source: 'lfo-sine', depth: 0.3, lfoRate: 16 },
    count: { source: 'energy', depth: 0.4, value: 15 },
  },
  starfield: {
    tile: { source: 'bass', depth: 0.3 },
    density: { source: 'energy', depth: 0.4, value: 0.4 },
    speed: { source: 'energy', depth: 0.8, value: 0.5 },
  },
  metaballs: {
    size: { source: 'bass', depth: 0.35, value: 0.08 },
    threshold: { source: 'lfo-sine', depth: 0.25, lfoRate: 16 },
    count: { source: 'energy', depth: 0.3, value: 6 },
  },
  mandala: {
    ringfreq: { source: 'bass', depth: 0.35, value: 6 },
    symmetry: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  grid: {
    wavefreq: { source: 'bass', depth: 0.45, value: 2.5 },
    fogamt: { source: 'energy', depth: -0.3, value: 0.3 },
    density: { source: 'lfo-sine', depth: 0.3, lfoRate: 32 },
  },
  waves: {
    amp: { source: 'bass', depth: 0.4, value: 0.06 },
    freq: { source: 'lfo-sine', depth: 0.3, lfoRate: 16 },
    count: { source: 'high', depth: 0.3 },
  },
  lissajous: {
    freqa: { source: 'lfo-sine', depth: 0.2, lfoRate: 32 },
    freqb: { source: 'lfo-sine', depth: 0.25, lfoRate: 64 },
    size: { source: 'bass', depth: 0.4, value: 0.3 },
  },
  fluid: {
    swirl: { source: 'lfo-sine', depth: 0.35, lfoRate: 16, value: 1.2 },
    zoom: { source: 'bass', depth: 0.3, value: 1.8 },
  },
  glitch: {
    intensity: { source: 'high', depth: 0.6, value: 0.55 },
    blocks: { source: 'bass', depth: 0.4, value: 8 },
    fps: { source: 'beat', depth: 0.4 },
  },
  rings: {
    spacing: { source: 'bass', depth: 0.4, value: 0.06 },
    gapfreq: { source: 'lfo-saw', depth: 0.3, lfoRate: 8, value: 4 },
    ringcount: { source: 'energy', depth: 0.3, value: 6 },
  },
  fire: {
    turbulence: { source: 'mid', depth: 0.5, value: 0.5 },
    sparks: { source: 'high', depth: 0.5, value: 4 },
    falloff: { source: 'lfo-sine', depth: 0.2, lfoRate: 16 },
  },
  hexagons: {
    wavefreq: { source: 'bass', depth: 0.45, value: 2.5 },
    zoom: { source: 'lfo-sine', depth: 0.3, lfoRate: 32, value: 4 },
  },
  lasers: {
    sweep: { source: 'energy', depth: 0.5, value: 0.9 },
    spread: { source: 'bass', depth: 0.4, value: 0.6 },
    beams: { source: 'lfo-square', depth: 0.3, lfoRate: 16 },
  },
  strobegrid: {
    litratio: { source: 'energy', depth: 0.4, value: 0.3 },
    chaos: { source: 'high', depth: 0.4, value: 0.4 },
    cells: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  vortex: {
    pull: { source: 'bass', depth: 0.5, value: 1 },
    twist: { source: 'lfo-sine', depth: 0.4, lfoRate: 16, value: 1.2 },
    arms: { source: 'lfo-square', depth: 0.25, lfoRate: 32 },
  },
  terrain: {
    glowamt: { source: 'energy', depth: 0.4, value: 0.9 },
    ridges: { source: 'bass', depth: 0.3, value: 8 },
    horizon: { source: 'lfo-sine', depth: 0.15, lfoRate: 32 },
  },
  orbits: {
    orbitr: { source: 'bass', depth: 0.3, value: 0.5 },
    trail: { source: 'energy', depth: 0.4, value: 0.4 },
    bodies: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  shatter: {
    burst: { source: 'bass', depth: 0.45, value: 0.9 },
    edgeglow: { source: 'high', depth: 0.5, value: 0.7 },
    shards: { source: 'lfo-saw', depth: 0.3, lfoRate: 32, value: 10 },
  },
  moire: {
    moireoff: { source: 'bass', depth: 0.3, value: 0.1 },
    rotspeed: { source: 'lfo-sine', depth: 0.3, lfoRate: 32, value: 0.3 },
    density: { source: 'high', depth: 0.3, value: 45 },
  },
  pulsecity: {
    punch: { source: 'bass', depth: 0.4, value: 1.2 },
    gapw: { source: 'lfo-sine', depth: 0.25, lfoRate: 16, value: 0.12 },
    columns: { source: 'energy', depth: 0.3, value: 18 },
  },
  neonpoly: {
    thickness: { source: 'bass', depth: 0.5, value: 1 },
    layers: { source: 'energy', depth: 0.35, value: 4 },
    sides: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  inkflow: {
    flowspd: { source: 'bass', depth: 0.3, value: 0.5 },
    inkcontrast: { source: 'energy', depth: 0.3, value: 1.1 },
    inkscale: { source: 'lfo-sine', depth: 0.25, lfoRate: 64, value: 2.3 },
  },
  raymarch: {
    camfov: { source: 'bass', depth: -0.3, value: 1 },
    glowk: { source: 'energy', depth: 0.5, value: 1 },
    repscale: { source: 'lfo-sine', depth: 0.25, lfoRate: 32, value: 1.8 },
  },
  ps2towers: {
    orbit: { source: 'energy', depth: 0.3, value: 0.8 },
    foglevel: { source: 'bass', depth: -0.3, value: 1.2 },
    towers: { source: 'lfo-square', depth: 0.25, lfoRate: 32 },
  },
  snowride: {
    curviness: { source: 'lfo-sine', depth: 0.4, lfoRate: 32, value: 0.8 },
    pistewidth: { source: 'bass', depth: 0.3, value: 0.9 },
    gates: { source: 'energy', depth: 0.3, value: 5 },
    speed: { source: 'energy', depth: 0.6, value: 0.7 },
  },
  ripples: {
    heightk: { source: 'bass', depth: 0.4, value: 0.9 },
    sheen: { source: 'high', depth: 0.4, value: 0.8 },
    spreadv: { source: 'lfo-sine', depth: 0.25, lfoRate: 32 },
  },
  dna: {
    amp: { source: 'bass', depth: 0.4, value: 0.1 },
    coils: { source: 'lfo-sine', depth: 0.3, lfoRate: 32 },
  },
  spectrum: {
    scope: { source: 'energy', depth: 0.6, value: 0.5 },
    bars: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  truchet: {
    thickness: { source: 'bass', depth: 0.4, value: 0.9 },
    flip: { source: 'high', depth: 0.4, value: 0.4 },
    tiles: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  caustics: {
    sharpness: { source: 'lfo-sine', depth: 0.25, lfoRate: 64, value: 0.6 },
    depthk: { source: 'bass', depth: 0.4, value: 0.8 },
    causticscale: { source: 'high', depth: 0.25, value: 1.4 },
  },
  quasicrystal: {
    contrast: { source: 'high', depth: 0.4, value: 0.35 },
    qfreq: { source: 'lfo-sine', depth: 0.3, lfoRate: 64, value: 40 },
    waves: { source: 'bass', depth: 0.3, value: 6 },
  },
  gyroid: {
    travel: { source: 'energy', depth: 0.6, value: 0.4 },
    shell: { source: 'bass', depth: 0.4, value: 0.4 },
    cells: { source: 'lfo-sine', depth: 0.2, lfoRate: 32 },
  },
  stringart: {
    multiplier: { source: 'lfo-sine', depth: 0.35, lfoRate: 64, value: 2.4 },
    linew: { source: 'bass', depth: 0.4, value: 0.9 },
    nodes: { source: 'energy', depth: 0.25, value: 60 },
  },
  ascii: {
    sourcezoom: { source: 'bass', depth: 0.3, value: 1 },
    cellsize: { source: 'energy', depth: -0.3, value: 14 },
    levels: { source: 'lfo-square', depth: 0.3, lfoRate: 16, value: 4 },
  },
  smoke: {
    rise: { source: 'bass', depth: 0.4, value: 0.8 },
    swirl: { source: 'lfo-sine', depth: 0.3, lfoRate: 32, value: 1 },
    dissipate: { source: 'energy', depth: 0.3, value: 0.25 },
  },
  // --- Tekno
  flash: {
    decay: { source: 'energy', depth: -0.3, value: 3 },
    scan: { source: 'lfo-sine', depth: 0.3, lfoRate: 16, value: 0.3 },
    tint: { source: 'high', depth: 0.3, value: 0.2 },
  },
  halftone: {
    contrast: { source: 'bass', depth: 0.4, value: 1.4 },
    dots: { source: 'high', depth: 0.3, value: 50 },
    drift: { source: 'lfo-sine', depth: 0.3, lfoRate: 32, value: 0.5 },
  },
  spiral: {
    twist: { source: 'lfo-sine', depth: 0.3, lfoRate: 16, value: 7 },
    pulse: { source: 'bass', depth: 0.4, value: 0.4 },
    arms: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
    speed: { source: 'energy', depth: 0.8, value: 0.4 },
  },
  warehouse: {
    flicker: { source: 'high', depth: 0.4, value: 0.4 },
    fog: { source: 'bass', depth: -0.3, value: 1.2 },
    pillars: { source: 'lfo-sine', depth: 0.25, lfoRate: 32, value: 1.8 },
    speed: { source: 'energy', depth: 0.6, value: 0.6 },
  },
  impact: {
    width: { source: 'bass', depth: 0.5, value: 1 },
    rings: { source: 'lfo-square', depth: 0.3, lfoRate: 16 },
    fade: { source: 'energy', depth: -0.3, value: 1.2 },
  },
  barcode: {
    jitter: { source: 'high', depth: 0.6, value: 0.6 },
    gap: { source: 'bass', depth: -0.3, value: 0.5 },
    bars: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  static: {
    roll: { source: 'bass', depth: 0.5, value: 0.6 },
    grain: { source: 'high', depth: 0.4, value: 2.5 },
    bands: { source: 'lfo-sine', depth: 0.3, lfoRate: 16, value: 0.4 },
  },
  cage: {
    size: { source: 'bass', depth: 0.4, value: 0.9 },
    thickness: { source: 'energy', depth: 0.3, value: 1.3 },
    spin: { source: 'lfo-sine', depth: 0.3, lfoRate: 32, value: 0.6 },
  },
  downpour: {
    density: { source: 'energy', depth: 0.6, value: 40 },
    streak: { source: 'bass', depth: 0.4, value: 0.15 },
    wind: { source: 'lfo-sine', depth: 0.4, lfoRate: 32, value: -0.35 },
  },
  cracks: {
    glow: { source: 'bass', depth: 0.6, value: 0.8 },
    width: { source: 'high', depth: 0.3, value: 0.9 },
    cells: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  tribal: {
    spikes: { source: 'high', depth: 0.3, value: 0.5 },
    turn: { source: 'bass', depth: 0.4, value: 0.4 },
    blades: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  chevrons: {
    thickness: { source: 'bass', depth: 0.4, value: 0.4 },
    drift: { source: 'energy', depth: 0.4, value: 0.8 },
    lanes: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  eclipse: {
    corona: { source: 'bass', depth: 0.5, value: 1 },
    radius: { source: 'lfo-sine', depth: 0.2, lfoRate: 64, value: 0.25 },
    wobble: { source: 'high', depth: 0.3, value: 0.3 },
  },
  blinds: {
    open: { source: 'energy', depth: 0.8, value: 0.15 },
    tilt: { source: 'bass', depth: 0.3, value: 0.15 },
    slats: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  // --- Bounce techno
  bounceball: {
    bounce: { source: 'bass', depth: 0.4, value: 0.9 },
    squash: { source: 'energy', depth: 0.3, value: 0.5 },
    balls: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  pump: {
    pump: { source: 'energy', depth: 0.6, value: 0.3 },
    rings: { source: 'bass', depth: 0.3, value: 5 },
    spin: { source: 'lfo-sine', depth: 0.3, lfoRate: 32, value: 0.4 },
  },
  roll: {
    pump: { source: 'bass', depth: 0.5, value: 0.4 },
    drift: { source: 'energy', depth: 0.4, value: 0.8 },
    lanes: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  reaction: {
    feed: { source: 'lfo-sine', depth: 0.2, lfoRate: 64, value: 0.052 },
    kill: { source: 'lfo-sine', depth: 0.15, lfoRate: 32, value: 0.062 },
    inject: { source: 'bass', depth: 0.5, value: 0.8 },
  },
  swarm: {
    turbulence: { source: 'lfo-sine', depth: 0.35, lfoRate: 32, value: 1 },
    burst: { source: 'bass', depth: 0.5, value: 0.8 },
    dotsize: { source: 'energy', depth: 0.3, value: 3 },
    drag: { source: 'high', depth: 0.2, value: 0.3 },
  },
  pulsar: {
    peaks: { source: 'bass', depth: 0.5, value: 0.9 },
    flow: { source: 'energy', depth: 0.4, value: 0.3 },
    lines: { source: 'lfo-sine', depth: 0.25, lfoRate: 64, value: 40 },
  },
  cathedral: {
    rays: { source: 'bass', depth: 0.5, value: 0.8 },
    density: { source: 'energy', depth: 0.3, value: 0.8 },
    sway: { source: 'lfo-sine', depth: 0.3, lfoRate: 32 },
  },
  chrome: {
    morph: { source: 'bass', depth: 0.5, value: 0.8 },
    shine: { source: 'high', depth: 0.3, value: 0.9 },
    blobs: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  mandelbulb: {
    glow: { source: 'bass', depth: 0.5, value: 0.8 },
    zoom: { source: 'energy', depth: 0.3, value: 0.9 },
    power: { source: 'lfo-sine', depth: 0.3, lfoRate: 64 },
  },
  crystals: {
    size: { source: 'bass', depth: 0.4, value: 0.9 },
    dispersion: { source: 'energy', depth: 0.4, value: 0.8 },
    facets: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  galaxy: {
    burst: { source: 'bass', depth: 0.5, value: 0.8 },
    twist: { source: 'lfo-sine', depth: 0.3, lfoRate: 32 },
    arms: { source: 'lfo-square', depth: 0.3, lfoRate: 64 },
  },
  // Non ancora in EFFECT_PARAMS su main: la voce aspetta l'effetto, il check
  // la valida senza pretendere le chiavi (e senza `value`, range ignoto).
  spaceghost: {
    glow: { source: 'bass', depth: 0.5 },
    drift: { source: 'energy', depth: 0.3 },
    folds: { source: 'lfo-sine', depth: 0.3, lfoRate: 32 },
  },
}

export function recommendedFor(effect: string): Record<string, Recommendation> {
  return RECOMMENDED[effect] ?? {}
}
