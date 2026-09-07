import type { EffectId, PostId } from './Engine'
import type { AudioSource } from './EffectParams'

/**
 * Genre presets: curated SCENES (effect + tuned params + audio mappings),
 * post-FX combos and palettes for each music genre. A scene is a look that
 * works — not just an effect name with whatever params were left behind.
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

export interface SceneParam {
  value?: number
  source?: AudioSource
  depth?: number
  lfoRate?: number
}

export interface Scene {
  effect: EffectId
  params?: Record<string, SceneParam>
}

export interface GenreConfig {
  label: string
  scenes: Scene[]
  postSets: PostId[][]          // possible post-FX combos
  palettes: [string, string, string][]
  transitionStyle: 'fast' | 'medium' | 'slow'
  switchBeats: number           // beats between effect changes
  energyThreshold: number       // 0-1, above this = high energy mode
}

// shorthand builders keep the tables readable
const v = (value: number): SceneParam => ({ value })
const a = (value: number, source: AudioSource, depth: number, lfoRate?: number): SceneParam =>
  ({ value, source, depth, lfoRate })

export const GENRE_CONFIGS: Record<Genre, GenreConfig> = {
  'acid-techno': {
    label: 'Acid Techno',
    scenes: [
      { effect: 'tunnel', params: { speed: v(1.2), twist: a(0.5, 'lfo-sine', 0.5, 8), ringdensity: a(8, 'bass', 0.35) } },
      { effect: 'vortex', params: { arms: v(3), twist: a(1.2, 'lfo-sine', 0.4, 16), pull: a(0.8, 'bass', 0.5) } },
      { effect: 'kaleidoscope', params: { segments: v(8), zoom: a(1.2, 'bass', 0.4), detail: a(2, 'mid', 0.3) } },
      { effect: 'lasers', params: { beams: v(7), spread: a(0.8, 'energy', 0.4), sweep: v(1.1) } },
      { effect: 'moire', params: { density: a(55, 'bass', 0.3), moireoff: a(0.12, 'lfo-sine', 0.35, 16), rotspeed: v(0.6) } },
      { effect: 'rings', params: { ringcount: v(10), spacing: a(0.08, 'bass', 0.3), gapfreq: a(6, 'lfo-saw', 0.3, 8) } },
      { effect: 'neonpoly', params: { sides: v(5), layers: v(6), thickness: a(1, 'mid', 0.5) } },
      { effect: 'plasma', params: { speed: v(1.1), zoom: a(1.3, 'bass', 0.4) } },
      { effect: 'raymarch', params: { repscale: v(2.2), glowk: a(1, 'energy', 0.5), camfov: a(1, 'bass', -0.25) } },
    ],
    postSets: [['bloom'], ['bloom', 'feedback'], ['bloom', 'chromatic'], ['bloom', 'rgb-split']],
    palettes: [
      ['#00ff88', '#ff00ff', '#4444ff'],
      ['#00ff00', '#aaff00', '#00ff88'],
      ['#ff00ff', '#00ffff', '#ffff00'],
    ],
    transitionStyle: 'fast',
    switchBeats: 16,
    energyThreshold: 0.4,
  },
  'dark-industrial': {
    label: 'Dark Industrial',
    scenes: [
      { effect: 'glitch', params: { blocks: v(14), intensity: a(0.4, 'high', 0.6), fps: v(12) } },
      { effect: 'matrix', params: { cols: v(48), fallspeed: a(1, 'bass', 0.4), trailfade: v(0.85) } },
      { effect: 'grid', params: { density: v(1.6), fogamt: a(0.25, 'energy', 0.3), wavefreq: a(2, 'bass', 0.35) } },
      { effect: 'raymarch', params: { speed: v(0.8), repscale: v(1.6), glowk: a(0.7, 'bass', 0.5), camfov: v(1.15) } },
      { effect: 'shatter', params: { shards: v(18), burst: a(1.1, 'bass', 0.4), edgeglow: a(0.7, 'high', 0.5) } },
      { effect: 'strobegrid', params: { cells: v(16), litratio: v(0.18), chaos: a(0.6, 'energy', 0.4) } },
      { effect: 'pulsecity', params: { columns: v(26), gapw: v(0.2), punch: a(1.2, 'bass', 0.4) } },
      { effect: 'voronoi', params: { cells: v(12), edgewidth: a(0.04, 'high', 0.4) } },
      { effect: 'hexagons', params: { zoom: v(4), wavefreq: a(2.5, 'bass', 0.45) } },
    ],
    postSets: [['bloom', 'scanlines'], ['bloom', 'filmgrain'], ['feedback', 'invert'], ['chromatic', 'scanlines']],
    palettes: [
      ['#ff0000', '#880000', '#ff4444'],
      ['#ffffff', '#888888', '#ffffff'],
      ['#ff4500', '#ff6347', '#2b0000'],
    ],
    transitionStyle: 'medium',
    switchBeats: 32,
    energyThreshold: 0.5,
  },
  'minimal-hypnotic': {
    label: 'Minimal Hypnotic',
    scenes: [
      { effect: 'moire', params: { speed: v(0.7), density: v(42), moireoff: a(0.1, 'lfo-sine', 0.4, 32), rotspeed: v(0.25) } },
      { effect: 'vortex', params: { speed: v(0.7), arms: v(2), twist: v(1.6), pull: a(0.5, 'lfo-sine', 0.3, 16) } },
      { effect: 'mandala', params: { symmetry: v(8), ringfreq: a(5, 'lfo-sine', 0.3, 32) } },
      { effect: 'rings', params: { speed: v(0.8), ringcount: v(12), spacing: v(0.07), gapfreq: a(4, 'lfo-saw', 0.25, 16) } },
      { effect: 'inkflow', params: { inkscale: v(2.2), flowspd: a(0.5, 'bass', 0.3), inkcontrast: v(1.3) } },
      { effect: 'lissajous', params: { freqa: a(3, 'lfo-sine', 0.2, 32), freqb: v(4), size: v(0.5) } },
      { effect: 'waves', params: { count: v(5), amp: a(0.09, 'bass', 0.35), freq: v(2.5) } },
      { effect: 'orbits', params: { speed: v(0.8), bodies: v(6), orbitr: v(0.5), trail: v(0.7) } },
      { effect: 'ripples', params: { spreadv: v(1.2), heightk: a(0.9, 'bass', 0.35), sheen: v(1.1) } },
    ],
    postSets: [['bloom'], ['bloom', 'feedback'], ['feedback']],
    palettes: [
      ['#00ccff', '#0044ff', '#88ffff'],
      ['#ff71ce', '#01cdfe', '#b967ff'],
      ['#2d6a4f', '#52b788', '#95d5b2'],
    ],
    transitionStyle: 'slow',
    switchBeats: 64,
    energyThreshold: 0.3,
  },
  'hard-tekno': {
    label: 'Hard Tekno',
    scenes: [
      { effect: 'tunnel', params: { speed: v(1.6), sides: v(6), twist: a(0.8, 'bass', 0.5), ringdensity: v(10) } },
      { effect: 'strobegrid', params: { cells: v(10), litratio: a(0.35, 'energy', 0.4), chaos: v(0.7) } },
      { effect: 'lasers', params: { beams: v(9), spread: v(1.1), sweep: a(1.3, 'energy', 0.5) } },
      { effect: 'shatter', params: { shards: v(14), burst: v(1.6), edgeglow: a(1, 'high', 0.6) } },
      { effect: 'fire', params: { falloff: v(0.7), turbulence: a(0.7, 'mid', 0.5), sparks: v(12) } },
      { effect: 'glitch', params: { blocks: v(18), intensity: a(0.55, 'high', 0.6), fps: v(18) } },
      { effect: 'raymarch', params: { speed: v(1.4), repscale: v(2.8), glowk: v(1.3), camfov: a(1, 'bass', -0.3) } },
      { effect: 'vortex', params: { speed: v(1.4), arms: v(5), twist: v(2), pull: a(1.2, 'bass', 0.5) } },
      { effect: 'pulsecity', params: { columns: v(18), gapw: v(0.12), punch: a(1.5, 'bass', 0.4) } },
      { effect: 'fractal', params: { iterations: v(30), zoom: a(1.4, 'bass', 0.45), morph: a(0.22, 'lfo-saw', 0.4, 4) } },
    ],
    postSets: [['bloom', 'rgb-split'], ['bloom', 'chromatic', 'filmgrain'], ['feedback', 'bloom'], ['pixelate', 'bloom']],
    palettes: [
      ['#ff4400', '#ffaa00', '#ff0066'],
      ['#ff0000', '#880000', '#ff4444'],
      ['#f72585', '#7209b7', '#3a0ca3'],
    ],
    transitionStyle: 'fast',
    switchBeats: 16,
    energyThreshold: 0.5,
  },
  'trance': {
    label: 'Trance',
    scenes: [
      { effect: 'kaleidoscope', params: { segments: v(12), zoom: a(1.1, 'lfo-sine', 0.35, 16), detail: v(2.4) } },
      { effect: 'starfield', params: { speed: v(1.2), tile: v(8), density: a(0.6, 'energy', 0.4) } },
      { effect: 'orbits', params: { bodies: v(10), orbitr: a(0.6, 'lfo-sine', 0.25, 32), trail: v(0.8) } },
      { effect: 'mandala', params: { symmetry: v(12), ringfreq: a(6, 'bass', 0.35) } },
      { effect: 'sacred', params: { zoom: a(1.1, 'lfo-sine', 0.3, 32), radius: v(0.32), ringfreq: v(5) } },
      { effect: 'terrain', params: { ridges: v(12), horizon: v(0.5), glowamt: a(1.2, 'energy', 0.4) } },
      { effect: 'neonpoly', params: { sides: v(6), layers: v(7), thickness: a(0.9, 'lfo-sine', 0.4, 8) } },
      { effect: 'waves', params: { count: v(7), amp: a(0.1, 'bass', 0.4), freq: v(3) } },
      { effect: 'fluid', params: { zoom: v(1.3), swirl: a(1.4, 'lfo-sine', 0.35, 16) } },
    ],
    postSets: [['bloom', 'feedback'], ['bloom', 'chromatic'], ['bloom']],
    palettes: [
      ['#00ff87', '#60efff', '#ff00e5'],
      ['#ff71ce', '#01cdfe', '#b967ff'],
      ['#00ccff', '#0044ff', '#88ffff'],
      ['#ffc8dd', '#bde0fe', '#a2d2ff'],
    ],
    transitionStyle: 'slow',
    switchBeats: 32,
    energyThreshold: 0.35,
  },
  'drum-n-bass': {
    label: 'Drum & Bass',
    scenes: [
      { effect: 'particles', params: { count: v(32), size: a(0.012, 'bass', 0.5), spread: v(1.2) } },
      { effect: 'glitch', params: { blocks: v(16), intensity: a(0.45, 'high', 0.7), fps: v(24) } },
      { effect: 'lasers', params: { beams: v(8), spread: v(0.9), sweep: a(1.5, 'high', 0.4) } },
      { effect: 'pulsecity', params: { columns: v(28), gapw: v(0.14), punch: a(1.4, 'bass', 0.5) } },
      { effect: 'shatter', params: { shards: v(20), burst: a(1.3, 'bass', 0.5), edgeglow: v(1) } },
      { effect: 'rings', params: { speed: v(1.3), ringcount: v(9), spacing: a(0.09, 'bass', 0.4), gapfreq: v(8) } },
      { effect: 'tunnel', params: { speed: v(1.4), sides: v(8), twist: a(0.6, 'high', 0.4), ringdensity: v(9) } },
      { effect: 'strobegrid', params: { cells: v(14), litratio: v(0.25), chaos: a(0.8, 'high', 0.3) } },
      { effect: 'orbits', params: { speed: v(1.5), bodies: v(12), orbitr: v(0.6), trail: a(0.6, 'energy', 0.4) } },
    ],
    postSets: [['bloom', 'rgb-split'], ['bloom', 'chromatic'], ['feedback', 'bloom']],
    palettes: [
      ['#ff00ff', '#00ffff', '#ffff00'],
      ['#ff4400', '#ffaa00', '#ff0066'],
      ['#00ff88', '#ff00ff', '#4444ff'],
    ],
    transitionStyle: 'fast',
    switchBeats: 8,
    energyThreshold: 0.45,
  },
  'ambient': {
    label: 'Ambient',
    scenes: [
      { effect: 'inkflow', params: { speed: v(0.6), inkscale: v(2), flowspd: v(0.4), inkcontrast: a(1.1, 'bass', 0.3) } },
      { effect: 'ripples', params: { spreadv: v(1), heightk: a(0.8, 'bass', 0.4), sheen: v(1.3) } },
      { effect: 'fluid', params: { speed: v(0.7), zoom: v(1.1), swirl: a(1.2, 'lfo-sine', 0.3, 32) } },
      { effect: 'waves', params: { speed: v(0.7), count: v(4), amp: a(0.12, 'bass', 0.35), freq: v(2) } },
      { effect: 'metaballs', params: { count: v(6), size: a(0.1, 'bass', 0.3), threshold: v(1.1) } },
      { effect: 'starfield', params: { speed: v(0.5), tile: v(4), density: v(0.5) } },
      { effect: 'orbits', params: { speed: v(0.55), bodies: v(5), orbitr: v(0.55), trail: v(0.85) } },
      { effect: 'terrain', params: { speed: v(0.6), ridges: v(8), horizon: v(0.55), glowamt: v(0.8) } },
      { effect: 'plasma', params: { speed: v(0.6), zoom: v(1), ringfreq: a(12, 'lfo-sine', 0.25, 32) } },
    ],
    postSets: [['bloom', 'feedback'], ['bloom'], ['feedback']],
    palettes: [
      ['#0077b6', '#00b4d8', '#90e0ef'],
      ['#2d6a4f', '#52b788', '#95d5b2'],
      ['#ffc8dd', '#bde0fe', '#a2d2ff'],
      ['#ffd700', '#daa520', '#b8860b'],
    ],
    transitionStyle: 'slow',
    switchBeats: 64,
    energyThreshold: 0.2,
  },
  'gabber': {
    label: 'Gabber',
    scenes: [
      { effect: 'strobegrid', params: { cells: v(8), litratio: v(0.5), chaos: v(1) } },
      { effect: 'fire', params: { falloff: v(0.6), turbulence: v(1), sparks: v(16) } },
      { effect: 'glitch', params: { blocks: v(24), intensity: a(0.7, 'high', 0.6), fps: v(30) } },
      { effect: 'shatter', params: { shards: v(12), burst: v(2), edgeglow: v(1.4) } },
      { effect: 'tunnel', params: { speed: v(2), sides: v(4), twist: v(1), ringdensity: v(12) } },
      { effect: 'lasers', params: { beams: v(11), spread: v(1.3), sweep: v(1.8) } },
      { effect: 'raymarch', params: { speed: v(1.8), repscale: v(3.2), glowk: v(1.5), camfov: v(0.85) } },
      { effect: 'moire', params: { speed: v(1.5), density: v(85), moireoff: v(0.2), rotspeed: v(1.2) } },
      { effect: 'vortex', params: { speed: v(1.8), arms: v(6), twist: v(2.5), pull: v(1.6) } },
    ],
    postSets: [['bloom', 'rgb-split', 'filmgrain'], ['bloom', 'pixelate'], ['chromatic', 'scanlines', 'bloom'], ['invert', 'bloom']],
    palettes: [
      ['#ff0000', '#880000', '#ff4444'],
      ['#ff4500', '#ff6347', '#2b0000'],
      ['#ffffff', '#888888', '#ffffff'],
    ],
    transitionStyle: 'fast',
    switchBeats: 8,
    energyThreshold: 0.6,
  },
}

/**
 * Shuffle bag: draws every item once (random order) before reshuffling,
 * never starting a new bag with the item just played.
 */
class Bag<T> {
  private pool: T[] = []
  private last: T | undefined
  constructor(private readonly items: readonly T[]) {}

  next(): T {
    if (this.pool.length === 0) {
      this.pool = [...this.items]
      // Fisher-Yates shuffle
      for (let i = this.pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[this.pool[i], this.pool[j]] = [this.pool[j], this.pool[i]]
      }
      // Next draw is pop() from the end — make sure it isn't a repeat
      const top = this.pool.length - 1
      if (top > 0 && this.pool[top] === this.last) {
        const j = Math.floor(Math.random() * top)
        ;[this.pool[top], this.pool[j]] = [this.pool[j], this.pool[top]]
      }
    }
    this.last = this.pool.pop()!
    return this.last
  }
}

/**
 * AutoVJ — algorithmic VJ that selects scenes, post-FX and palettes
 * based on audio analysis and genre configuration.
 */
export class AutoVJ {
  private enabled = false
  private genre: Genre = 'acid-techno'
  private beatCount = 0
  private highEnergyStreak = 0
  private lowEnergyStreak = 0
  private frameCount = 0
  private lastSwitchFrame = 0
  private sceneBag!: Bag<Scene>
  private postBag!: Bag<PostId[]>
  private paletteBag!: Bag<[string, string, string]>
  // Pending switch armed on beat count, executed on the next downbeat
  private pendingSwitch: { post: boolean; palette: boolean } | null = null
  private pendingSince = 0
  private prevBarPhase = 0

  // Callbacks for when AutoVJ wants to change something
  public onSceneChange: ((scene: Scene) => void) | null = null
  public onPostChange: ((posts: PostId[]) => void) | null = null
  public onPaletteChange: ((colors: [string, string, string]) => void) | null = null

  constructor() { this.resetBags() }

  setEnabled(enabled: boolean) { this.enabled = enabled }
  isEnabled(): boolean { return this.enabled }

  setGenre(genre: Genre) {
    this.genre = genre
    this.beatCount = 0
    this.highEnergyStreak = 0
    this.lowEnergyStreak = 0
    this.pendingSwitch = null
    this.resetBags()
  }

  private resetBags() {
    const config = GENRE_CONFIGS[this.genre]
    this.sceneBag = new Bag(config.scenes)
    this.postBag = new Bag(config.postSets)
    this.paletteBag = new Bag(config.palettes)
  }
  getGenre(): Genre { return this.genre }

  /**
   * Call every frame with current audio data.
   * The AutoVJ decides when to switch based on beat count and energy.
   */
  update(beatDetected: boolean, energy: number, bass: number, barPhase: number) {
    if (!this.enabled) return
    this.frameCount++

    const config = GENRE_CONFIGS[this.genre]

    // Fallback: if no beats detected for ~300 frames (~5s at 60fps), switch anyway
    if (!beatDetected && !this.pendingSwitch && this.frameCount - this.lastSwitchFrame > 300) {
      this.executeSwitch(config, { post: Math.random() < 0.4, palette: Math.random() < 0.3 })
      return
    }

    // Count beats
    if (beatDetected) {
      this.beatCount++

      // Track energy streaks
      if (energy > config.energyThreshold) {
        this.highEnergyStreak++
        this.lowEnergyStreak = 0
      } else {
        this.lowEnergyStreak++
        this.highEnergyStreak = 0
      }

      // Time to switch? Arm it — the actual switch fires on the next downbeat
      const switchInterval = this.getSwitchInterval(config)
      if (this.beatCount >= switchInterval && !this.pendingSwitch) {
        this.beatCount = 0
        this.pendingSwitch = { post: Math.random() < 0.5, palette: Math.random() < 0.3 }
        this.pendingSince = this.frameCount
      }
    }

    // Execute pending switch when the bar wraps (downbeat), or after ~2 bars as safety
    if (this.pendingSwitch) {
      const barWrapped = this.prevBarPhase > 0.5 && barPhase < 0.1
      if (barWrapped || this.frameCount - this.pendingSince > 480) {
        const pending = this.pendingSwitch
        this.pendingSwitch = null
        this.executeSwitch(config, pending)
      }
    }
    this.prevBarPhase = barPhase
  }

  private executeSwitch(config: GenreConfig, opts: { post: boolean; palette: boolean }) {
    this.lastSwitchFrame = this.frameCount
    this.switchScene(config)
    if (opts.post) this.switchPost(config)
    if (opts.palette) this.switchPalette(config)
  }

  private getSwitchInterval(config: GenreConfig): number {
    let base = config.switchBeats
    // High energy = switch faster
    if (this.highEnergyStreak > 4) base = Math.max(4, Math.floor(base * 0.5))
    // Low energy = switch slower
    if (this.lowEnergyStreak > 8) base = Math.floor(base * 1.5)
    return base
  }

  private switchScene(config: GenreConfig) {
    if (config.scenes.length <= 1) return
    const scene = this.sceneBag.next()
    console.log(`[AutoVJ] Switching to scene: ${scene.effect}`)
    this.onSceneChange?.(scene)
  }

  private switchPost(config: GenreConfig) {
    if (config.postSets.length <= 1) return
    this.onPostChange?.(this.postBag.next())
  }

  private switchPalette(config: GenreConfig) {
    if (config.palettes.length <= 1) return
    this.onPaletteChange?.(this.paletteBag.next())
  }
}
