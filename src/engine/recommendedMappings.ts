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
 * Mai un parametro che nello shader moltiplica un orologio (uTime,
 * uBeatClock, uBassTime): il motore non integra i parametri, quindi ogni
 * variazione sposta la fase di orologio × variazione e l'immagine salta, sempre
 * peggio piu' dura il set. Dove serve un ritmo si mappa `speed`, che il motore
 * integra.
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
    sides: { source: 'lfo-square', depth: 0.25, lfoRate: 16 },
    speed: { source: 'energy', depth: 0.2, value: 0.8 },
  },
  kaleidoscope: {
    zoom: { source: 'lfo-sine', depth: 0.2, lfoRate: 32, value: 2.4 },
    detail: { source: 'mid', depth: 0.3, value: 7 },
    segments: { source: 'lfo-square', depth: 0.3, lfoRate: 16 },
  },
  warp: {
    warpamt: { source: 'mid', depth: 0.35, value: 2.5 },
    zoom: { source: 'bass', depth: 0.25, value: 0.85 },
    linefreq: { source: 'lfo-sine', depth: 0.3, lfoRate: 32 },
  },
  plasma: {
    zoom: { source: 'bass', depth: -0.3, value: 1.6 },
    ringfreq: { source: 'lfo-sine', depth: 0.3, lfoRate: 16, value: 20 },
  },
  matrix: {
    trailfade: { source: 'bass', depth: 0.35, value: 1.5 },
    cols: { source: 'lfo-square', depth: 0.3, lfoRate: 32, value: 30 },
    speed: { source: 'energy', depth: 0.25, value: 0.8 },
  },
  voronoi: {
    edgewidth: { source: 'high', depth: 0.4, value: 0.04 },
    cells: { source: 'bass', depth: 0.2, value: 3.5 },
  },
  sacred: {
    zoom: { source: 'lfo-sine', depth: 0.25, lfoRate: 32, value: 1.8 },
    radius: { source: 'bass', depth: 0.25, value: 0.42 },
    ringfreq: { source: 'energy', depth: 0.3, value: 10 },
  },
  fractal: {
    zoom: { source: 'bass', depth: -0.3, value: 1.9 },
    morph: { source: 'lfo-sine', depth: 0.5, lfoRate: 16, value: 0.1 },
    speed: { source: 'energy', depth: 0.2, value: 0.85 },
  },
  particles: {
    size: { source: 'bass', depth: 0.28, value: 0.007 },
    spread: { source: 'lfo-sine', depth: 0.3, lfoRate: 16, value: 0.5 },
    count: { source: 'lfo-square', depth: 0.3, lfoRate: 32, value: 14 },
  },
  starfield: {
    tile: { source: 'lfo-sine', depth: 0.25, lfoRate: 32, value: 8 },
    density: { source: 'energy', depth: 0.35, value: 0.3 },
    speed: { source: 'energy', depth: 0.35, value: 0.6 },
  },
  metaballs: {
    size: { source: 'bass', depth: 0.3, value: 0.05 },
    threshold: { source: 'lfo-sine', depth: 0.25, lfoRate: 16, value: 0.9 },
    count: { source: 'lfo-square', depth: 0.34, lfoRate: 32, value: 6 },
  },
  mandala: {
    ringfreq: { source: 'bass', depth: 0.35, value: 6 },
    symmetry: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  // density is the grid's spacing: modulating it slides every line, so it stays
  // put. wavefreq is the height of the dunes beside the road, fogamt the haze.
  grid: {
    fogamt: { source: 'bass', depth: 0.6, value: 0.08 },
    density: { source: 'lfo-square', depth: 0.37, lfoRate: 32 },
    speed: { source: 'energy', depth: 0.25, value: 0.8 },
  },
  waves: {
    amp: { source: 'bass', depth: 0.3, value: 0.03 },
    freq: { source: 'lfo-sine', depth: 0.25, lfoRate: 16 },
    speed: { source: 'energy', depth: 0.2, value: 0.85 },
  },
  lissajous: {
    freqa: { source: 'lfo-sine', depth: 0.2, lfoRate: 32 },
    freqb: { source: 'lfo-sine', depth: 0.25, lfoRate: 64 },
    size: { source: 'bass', depth: 0.25, value: 0.26 },
  },
  fluid: {
    swirl: { source: 'lfo-sine', depth: 0.2, lfoRate: 16, value: 0.7 },
    zoom: { source: 'bass', depth: -0.2, value: 2.2 },
  },
  glitch: {
    intensity: { source: 'high', depth: 0.6, value: 0.55 },
    blocks: { source: 'lfo-square', depth: 0.35, lfoRate: 16, value: 8 },
    speed: { source: 'beat', depth: 0.3 },
  },
  rings: {
    spacing: { source: 'bass', depth: 0.3, value: 0.08 },
    gapfreq: { source: 'lfo-square', depth: 0.25, lfoRate: 16, value: 3 },
    ringcount: { source: 'lfo-square', depth: 0.31, lfoRate: 32, value: 8 },
  },
  fire: {
    turbulence: { source: 'mid', depth: 0.3, value: 0.4 },
    falloff: { source: 'energy', depth: -0.3, value: 1.05 },
    sparks: { source: 'lfo-square', depth: 0.4, lfoRate: 32, value: 6 },
  },
  hexagons: {
    wavefreq: { source: 'energy', depth: 0.25, value: 3 },
    zoom: { source: 'lfo-sine', depth: 0.3, lfoRate: 32, value: 4 },
  },
  lasers: {
    spread: { source: 'bass', depth: 0.4, value: 0.6 },
    speed: { source: 'energy', depth: 0.25, value: 0.7 },
    beams: { source: 'lfo-square', depth: 0.3, lfoRate: 16 },
  },
  strobegrid: {
    litratio: { source: 'energy', depth: 0.35, value: 0.2 },
    chaos: { source: 'high', depth: 0.7, value: 0.3 },
    cells: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  vortex: {
    speed: { source: 'bass', depth: 0.3, value: 0.8 },
    twist: { source: 'lfo-sine', depth: 0.4, lfoRate: 16, value: 1.2 },
    arms: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  terrain: {
    glowamt: { source: 'energy', depth: 0.4, value: 0.8 },
    horizon: { source: 'lfo-sine', depth: 0.2, lfoRate: 32, value: 0.4 },
    ridges: { source: 'lfo-square', depth: 0.25, lfoRate: 32, value: 8 },
  },
  orbits: {
    orbitr: { source: 'bass', depth: 0.2, value: 0.42 },
    trail: { source: 'energy', depth: 0.6, value: 0.3 },
    bodies: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  shatter: {
    burst: { source: 'energy', depth: 0.3, value: 0.6 },
    edgeglow: { source: 'high', depth: 0.5, value: 0.7 },
    shards: { source: 'lfo-saw', depth: 0.3, lfoRate: 32, value: 10 },
  },
  moire: {
    moireoff: { source: 'bass', depth: 0.25, value: 0.12 },
    density: { source: 'lfo-sine', depth: 0.2, lfoRate: 32, value: 40 },
    speed: { source: 'energy', depth: 0.3, value: 0.7 },
  },
  pulsecity: {
    punch: { source: 'bass', depth: 0.4, value: 0.8 },
    columns: { source: 'lfo-sine', depth: 0.35, lfoRate: 32, value: 14 },
    gapw: { source: 'lfo-sine', depth: 0.3, lfoRate: 64, value: 0.1 },
  },
  neonpoly: {
    thickness: { source: 'bass', depth: 0.4, value: 0.8 },
    speed: { source: 'energy', depth: 0.25, value: 0.8 },
    sides: { source: 'lfo-square', depth: 0.5, lfoRate: 32, value: 4 },
  },
  inkflow: {
    speed: { source: 'bass', depth: 0.3, value: 0.7 },
    inkcontrast: { source: 'energy', depth: 0.3, value: 1.1 },
    inkscale: { source: 'lfo-sine', depth: 0.25, lfoRate: 64, value: 2.3 },
  },
  raymarch: {
    camfov: { source: 'bass', depth: -0.25, value: 1.1 },
    glowk: { source: 'energy', depth: 0.4, value: 0.6 },
    speed: { source: 'lfo-sine', depth: 0.2, lfoRate: 32, value: 0.8 },
  },
  ps2towers: {
    orbit: { source: 'energy', depth: 0.3, value: 0.8 },
    foglevel: { source: 'bass', depth: -0.3, value: 1.2 },
    towers: { source: 'lfo-sine', depth: 0.2, lfoRate: 32 },
  },
  snowride: {
    curviness: { source: 'lfo-sine', depth: 0.4, lfoRate: 32, value: 0.8 },
    pistewidth: { source: 'lfo-sine', depth: 0.25, lfoRate: 64, value: 0.9 },
    gates: { source: 'lfo-square', depth: 0.3, lfoRate: 32, value: 4 },
    speed: { source: 'energy', depth: 0.45, value: 0.7 },
  },
  ripples: {
    heightk: { source: 'bass', depth: 0.25, value: 0.8 },
    sheen: { source: 'high', depth: 0.4, value: 0.8 },
    spreadv: { source: 'lfo-sine', depth: 0.25, lfoRate: 32 },
  },
  dna: {
    amp: { source: 'bass', depth: 0.3, value: 0.09 },
    coils: { source: 'lfo-sine', depth: 0.3, lfoRate: 32, value: 6 },
  },
  spectrum: {
    scope: { source: 'energy', depth: 0.6, value: 0.5 },
    bars: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  truchet: {
    thickness: { source: 'bass', depth: 0.2, value: 0.8 },
    speed: { source: 'energy', depth: 0.3, value: 0.6 },
    tiles: { source: 'lfo-square', depth: 0.25, lfoRate: 32, value: 7 },
  },
  caustics: {
    causticscale: { source: 'lfo-sine', depth: 0.2, lfoRate: 32, value: 1.2 },
    depthk: { source: 'bass', depth: 0.7, value: 0.4 },
    sharpness: { source: 'energy', depth: -0.6, value: 0.9 },
  },
  quasicrystal: {
    qfreq: { source: 'bass', depth: -0.15, value: 50 },
    contrast: { source: 'high', depth: 0.6, value: 0.2 },
    waves: { source: 'lfo-square', depth: 0.25, lfoRate: 32, value: 5 },
  },
  gyroid: {
    shell: { source: 'bass', depth: 0.35, value: 0.3 },
    speed: { source: 'energy', depth: 0.4, value: 0.5 },
  },
  stringart: {
    linew: { source: 'bass', depth: 0.25, value: 0.8 },
    multiplier: { source: 'lfo-sine', depth: 0.2, lfoRate: 64, value: 2 },
    nodes: { source: 'lfo-square', depth: 0.22, lfoRate: 32, value: 60 },
  },
  ascii: {
    sourcezoom: { source: 'bass', depth: 0.3, value: 0.9 },
    speed: { source: 'energy', depth: 0.35, value: 0.6 },
    cellsize: { source: 'lfo-square', depth: 0.3, lfoRate: 32, value: 10 },
    levels: { source: 'lfo-square', depth: 0.5, lfoRate: 16, value: 4 },
  },
  smoke: {
    rise: { source: 'bass', depth: 0.4, value: 0.8 },
    swirl: { source: 'lfo-sine', depth: 0.3, lfoRate: 32, value: 1 },
    dissipate: { source: 'energy', depth: 0.3, value: 0.25 },
  },
  // --- Tekno
  flash: {
    decay: { source: 'energy', depth: -0.3, value: 3 },
    tint: { source: 'lfo-sine', depth: 0.7, lfoRate: 32, value: 0.1 },
    scan: { source: 'high', depth: 0.8, value: 0.2 },
  },
  halftone: {
    contrast: { source: 'bass', depth: -0.5, value: 2.2 },
    speed: { source: 'energy', depth: 0.4, value: 0.6 },
    dots: { source: 'lfo-square', depth: 0.25, lfoRate: 32, value: 45 },
  },
  spiral: {
    twist: { source: 'lfo-sine', depth: 0.3, lfoRate: 16, value: 7 },
    pulse: { source: 'bass', depth: 0.4, value: 0.4 },
    arms: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  warehouse: {
    flicker: { source: 'high', depth: 0.9, value: 0.15 },
    fog: { source: 'bass', depth: -0.3, value: 1.2 },
    speed: { source: 'energy', depth: 0.4, value: 0.6 },
  },
  impact: {
    width: { source: 'bass', depth: 0.3, value: 0.8 },
    rings: { source: 'lfo-square', depth: 0.3, lfoRate: 16 },
    fade: { source: 'energy', depth: -0.3, value: 1.2 },
  },
  barcode: {
    gap: { source: 'bass', depth: -0.5, value: 0.6 },
    speed: { source: 'energy', depth: 0.5, value: 0.5 },
    bars: { source: 'lfo-square', depth: 0.3, lfoRate: 32, value: 32 },
  },
  static: {
    grain: { source: 'bass', depth: 0.45, value: 2 },
    bands: { source: 'high', depth: 1.0, value: 0.3 },
  },
  cage: {
    size: { source: 'lfo-sine', depth: 0.1, lfoRate: 32, value: 0.65 },
    thickness: { source: 'bass', depth: 0.25, value: 1.2 },
    speed: { source: 'energy', depth: 0.4, value: 0.6 },
  },
  downpour: {
    streak: { source: 'bass', depth: 0.25, value: 0.12 },
    speed: { source: 'energy', depth: 0.5, value: 0.6 },
    wind: { source: 'lfo-sine', depth: 0.25, lfoRate: 32, value: 0.1 },
    density: { source: 'lfo-square', depth: 0.18, lfoRate: 32, value: 40 },
  },
  cracks: {
    glow: { source: 'bass', depth: 0.6, value: 0.8 },
    width: { source: 'high', depth: 0.3, value: 0.9 },
    cells: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  tribal: {
    spikes: { source: 'energy', depth: 0.8, value: 0.3 },
    speed: { source: 'bass', depth: 0.5, value: 0.6 },
    blades: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  chevrons: {
    thickness: { source: 'bass', depth: 0.5, value: 0.3 },
    speed: { source: 'energy', depth: 0.3, value: 0.7 },
    lanes: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  eclipse: {
    radius: { source: 'bass', depth: 0.2, value: 0.22 },
    corona: { source: 'energy', depth: 0.3, value: 0.8 },
    wobble: { source: 'lfo-sine', depth: 0.6, lfoRate: 16, value: 0.2 },
  },
  blinds: {
    open: { source: 'energy', depth: 0.35, value: 0.3 },
    tilt: { source: 'bass', depth: 0.3, value: 0.15 },
    slats: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  // --- Bounce techno
  bounceball: {
    bounce: { source: 'bass', depth: 0.4, value: 0.5 },
    squash: { source: 'energy', depth: 0.4, value: 0.4 },
    balls: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  pump: {
    pump: { source: 'bass', depth: 0.6, value: 0.3 },
    spin: { source: 'energy', depth: 0.4, value: 0.3 },
    rings: { source: 'lfo-square', depth: 0.3, lfoRate: 32, value: 5 },
  },
  roll: {
    pump: { source: 'bass', depth: 0.5, value: 0.4 },
    lanes: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  reaction: {
    feed: { source: 'lfo-sine', depth: 0.2, lfoRate: 64, value: 0.052 },
    kill: { source: 'lfo-sine', depth: 0.15, lfoRate: 32, value: 0.062 },
    inject: { source: 'bass', depth: 0.5, value: 0.8 },
  },
  swarm: {
    turbulence: { source: 'lfo-sine', depth: 0.25, lfoRate: 32, value: 0.8 },
    burst: { source: 'bass', depth: 0.4, value: 0.6 },
    dotsize: { source: 'energy', depth: 0.15, value: 2.6 },
    drag: { source: 'high', depth: 0.3, value: 0.3 },
  },
  imgbeat: {
    punch: { source: 'bass', depth: 0.35, value: 0.8 },
    size: { source: 'energy', depth: 0.15, value: 0.7 },
    spin: { source: 'lfo-sine', depth: 0.3, lfoRate: 32 },
  },
  mesh: {
    burst: { source: 'beat', depth: 0.5, value: 0.6 },
    speed: { source: 'energy', depth: 0.25, value: 0.7 },
    dotsize: { source: 'high', depth: 0.5, value: 2.5 },
    dissolve: { source: 'mid', depth: 0.4, value: 0.2 },
  },
  pulsar: {
    peaks: { source: 'bass', depth: 0.4, value: 0.7 },
    flow: { source: 'energy', depth: 0.3, value: 0.05 },
  },
  cathedral: {
    rays: { source: 'bass', depth: 0.3, value: 0.7 },
    density: { source: 'energy', depth: 0.3, value: 0.7 },
    sway: { source: 'lfo-sine', depth: 0.4, lfoRate: 32, value: 0.6 },
  },
  chrome: {
    morph: { source: 'bass', depth: 0.3, value: 0.5 },
    shine: { source: 'high', depth: 0.8, value: 0.8 },
    blobs: { source: 'lfo-square', depth: 0.25, lfoRate: 32, value: 3 },
  },
  mandelbulb: {
    glow: { source: 'bass', depth: 0.35, value: 0.5 },
    zoom: { source: 'energy', depth: 0.3, value: 0.7 },
    power: { source: 'lfo-sine', depth: 0.5, lfoRate: 64, value: 5 },
  },
  storm: {
    fog: { source: 'bass', depth: 0.4, value: 0.8 },
    bolts: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
    branches: { source: 'lfo-square', depth: 0.25, lfoRate: 16, value: 0.5 },
  },
  ribbons: {
    curl: { source: 'bass', depth: 0.25, value: 0.55 },
    twist: { source: 'lfo-sine', depth: 0.4, lfoRate: 16, value: 0.6 },
    count: { source: 'lfo-square', depth: 0.3, lfoRate: 32, value: 7 },
  },
  beamfield: {
    haze: { source: 'bass', depth: 0.25, value: 0.6 },
    beams: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  android: {
    dissolve: { source: 'bass', depth: 0.25, value: 0.1 },
    glow: { source: 'energy', depth: 0.4, value: 0.7 },
    panels: { source: 'lfo-sine', depth: 0.25, lfoRate: 64 },
  },
  faces: {
    glow: { source: 'bass', depth: 0.5, value: 0.8 },
    spin: { source: 'lfo-sine', depth: 0.6, lfoRate: 32, value: 0.6 },
    faces: { source: 'lfo-sine', depth: 0.15, lfoRate: 64 },
  },
  monolith: {
    pulse: { source: 'bass', depth: 0.35, value: 0.6 },
    haze: { source: 'energy', depth: 0.5, value: 0.7 },
    width: { source: 'lfo-sine', depth: 0.35, lfoRate: 32, value: 0.6 },
  },
  truss: {
    strobe: { source: 'bass', depth: 0.35, value: 0.5 },
    fixtures: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
    spin: { source: 'energy', depth: 0.4, value: 0.3 },
  },
  hypercube: {
    glow: { source: 'bass', depth: 0.25, value: 0.7 },
    scale: { source: 'lfo-sine', depth: 0.1, lfoRate: 32, value: 0.8 },
  },
  vaultdoor: {
    apertura: { source: 'bass', depth: 0.25, value: 0.25 },
    glow: { source: 'energy', depth: 0.4, value: 0.7 },
    rings: { source: 'lfo-square', depth: 0.25, lfoRate: 32 },
  },
  pistons: {
    stagger: { source: 'lfo-sine', depth: 0.5, lfoRate: 32, value: 0.5 },
    haze: { source: 'energy', depth: 0.5, value: 0.7 },
  },
  datacenter: {
    alarm: { source: 'bass', depth: 0.3, value: 0.5 },
    speed: { source: 'energy', depth: 0.25, value: 0.8 },
  },
  chainfence: {
    beamIntensity: { source: 'bass', depth: 0.3, value: 0.6 },
    haze: { source: 'lfo-sine', depth: 0.35, lfoRate: 32, value: 0.6 },
  },
  turbine: {
    speed: { source: 'lfo-sine', depth: 0.2, lfoRate: 32, value: 0.9 },
    strobe: { source: 'bass', depth: 0.3, value: 0.5 },
    blades: { source: 'lfo-square', depth: 0.2, lfoRate: 32, value: 5 },
  },
  reactor: {
    speed: { source: 'energy', depth: 0.2, value: 0.8 },
    rings: { source: 'lfo-square', depth: 0.2, lfoRate: 32, value: 5 },
    glow: { source: 'bass', depth: 0.25, value: 0.6 },
  },
  pipes: {
    speed: { source: 'energy', depth: 0.25, value: 0.9 },
    glow: { source: 'bass', depth: 0.5, value: 0.6 },
    density: { source: 'lfo-square', depth: 0.3, lfoRate: 64, value: 0.8 },
  },
  crystals: {
    size: { source: 'bass', depth: 0.25, value: 0.8 },
    dispersion: { source: 'energy', depth: 0.3, value: 0.5 },
    facets: { source: 'lfo-square', depth: 0.3, lfoRate: 32 },
  },
  galaxy: {
    burst: { source: 'bass', depth: 0.25, value: 0.5 },
    twist: { source: 'lfo-sine', depth: 0.3, lfoRate: 32, value: 1.4 },
    arms: { source: 'lfo-square', depth: 0.2, lfoRate: 64 },
  },
  // Non ancora in EFFECT_PARAMS su main: la voce aspetta l'effetto, il check
  // la valida senza pretendere le chiavi (e senza `value`, range ignoto).
  spaceghost: {
    glow: { source: 'bass', depth: 0.2, value: 30 },
    folds: { source: 'lfo-square', depth: 0.25, lfoRate: 32 },
  },
  isoblocks: {
    height: { source: 'bass', depth: 0.3, value: 1 },
    edge: { source: 'high', depth: 0.4, value: 0.8 },
    wavespeed: { source: 'lfo-sine', depth: 0.25, lfoRate: 32, value: 1 },
  },
  vegabulge: {
    bulge: { source: 'bass', depth: 0.3, value: 0.6 },
    cells: { source: 'lfo-sine', depth: 0.15, lfoRate: 32, value: 10 },
    lenses: { source: 'lfo-square', depth: 0.3, lfoRate: 32, value: 2 },
  },
  isocontour: {
    density: { source: 'bass', depth: 0.2, value: 16 },
    morph: { source: 'energy', depth: 0.5, value: 0.4 },
    shapes: { source: 'lfo-square', depth: 0.5, lfoRate: 32, value: 3 },
  },
  mycelium: {
    pulse: { source: 'bass', depth: 0.35, value: 0.6 },
    glow: { source: 'energy', depth: 0.3, value: 0.7 },
    density: { source: 'lfo-sine', depth: 0.12, lfoRate: 32, value: 2.6 },
  },
  medusae: {
    glow: { source: 'bass', depth: 0.35, value: 0.8 },
    speed: { source: 'energy', depth: 0.15, value: 0.8 },
    tentacles: { source: 'lfo-sine', depth: 0.4, lfoRate: 16, value: 0.8 },
    count: { source: 'lfo-square', depth: 0.25, lfoRate: 32, value: 0.45 },
  },
  agate: {
    warp: { source: 'bass', depth: 0.2, value: 0.8 },
    gloss: { source: 'high', depth: 0.6, value: 0.7 },
    speed: { source: 'lfo-sine', depth: 0.2, lfoRate: 32, value: 0.7 },
  },
  macromosh: {
    drift: { source: 'bass', depth: 0.3, value: 0.7 },
    bleed: { source: 'high', depth: 0.8, value: 0.3 },
    scene: { source: 'lfo-square', depth: 0.5, lfoRate: 32, value: 0 },
  },
  pixelsort: {
    threshold: { source: 'bass', depth: -0.2, value: 0.5 },
    streak: { source: 'energy', depth: 0.3, value: 0.3 },
    steps: { source: 'lfo-square', depth: 0.3, lfoRate: 32, value: 10 },
  },
  typeslam: {
    gap: { source: 'bass', depth: -0.25, value: 0.12 },
    scheme: { source: 'lfo-square', depth: 0.5, lfoRate: 32, value: 0 },
    words: { source: 'lfo-square', depth: 0.34, lfoRate: 64, value: 0 },
  },
  ringworld: {
    sun: { source: 'bass', depth: 0.4, value: 0.7 },
    speed: { source: 'energy', depth: 0.15, value: 0.8 },
    density: { source: 'lfo-square', depth: 0.5, lfoRate: 32, value: 0.4 },
  },
  singularity: {
    disk: { source: 'bass', depth: 0.3, value: 0.8 },
    speed: { source: 'energy', depth: 0.15, value: 0.8 },
    tilt: { source: 'lfo-sine', depth: 0.45, lfoRate: 32, value: 0.15 },
  },
  aurora: {
    height: { source: 'bass', depth: 0.25, value: 0.9 },
    shimmer: { source: 'high', depth: 0.7, value: 0.5 },
    curtains: { source: 'lfo-sine', depth: 0.25, lfoRate: 32, value: 1 },
  },
  armillary: {
    core: { source: 'bass', depth: 0.4, value: 0.7 },
    speed: { source: 'energy', depth: 0.15, value: 0.8 },
  },
  telemetry: {
    glitch: { source: 'bass', depth: 0.6, value: 0.3 },
    speed: { source: 'energy', depth: 0.15, value: 0.8 },
    land: { source: 'lfo-sine', depth: 0.7, lfoRate: 32, value: 0.2 },
  },
  aegis: {
    beam: { source: 'bass', depth: 0.3, value: 0.7 },
    impacts: { source: 'energy', depth: 0.35, value: 0.7 },
    cells: { source: 'lfo-sine', depth: 0.35, lfoRate: 32, value: 7 },
  },
  titanhand: {
    pyro: { source: 'energy', depth: 0.25, value: 0.8 },
  },
  kaijustomp: {
    pyro: { source: 'energy', depth: 0.25, value: 0.8 },
    haze: { source: 'lfo-sine', depth: 0.4, lfoRate: 32, value: 0.6 },
  },
  robokaiju: {
    pyro: { source: 'energy', depth: 0.25, value: 0.8 },
    haze: { source: 'lfo-sine', depth: 0.4, lfoRate: 32, value: 0.6 },
  },
  escher: {
    edge: { source: 'bass', depth: 0.4, value: 0.7 },
    complexity: { source: 'lfo-square', depth: 0.4, lfoRate: 32, value: 0.45 },
  },
  plasmaglobe: {
    chaos: { source: 'bass', depth: 0.35, value: 0.6 },
    discharge: { source: 'energy', depth: 0.4, value: 0.7 },
    globe: { source: 'lfo-sine', depth: 0.4, lfoRate: 16, value: 0.33 },
  },
  kickworks: {
    trail: { source: 'bass', depth: 0.4, value: 0.6 },
    gravity: { source: 'mid', depth: 0.5, value: 0.3 },
    density: { source: 'lfo-square', depth: 0.4, lfoRate: 32, value: 32 },
  },
  fluxlines: {
    glow: { source: 'high', depth: 0.8, value: 0.5 },
    density: { source: 'lfo-square', depth: 0.25, lfoRate: 32, value: 16 },
  },
}

export function recommendedFor(effect: string): Record<string, Recommendation> {
  return RECOMMENDED[effect] ?? {}
}
