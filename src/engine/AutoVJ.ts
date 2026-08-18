import type { EffectId, PostId } from './Engine'

/**
 * Genre presets define which effects, post-FX and palettes
 * are preferred for each music genre.
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

export interface GenreConfig {
  label: string
  effects: EffectId[]
  postSets: PostId[][]          // possible post-FX combos
  palettes: [string, string, string][]
  transitionStyle: 'fast' | 'medium' | 'slow'
  switchBeats: number           // beats between effect changes
  energyThreshold: number       // 0-1, above this = high energy mode
}

export const GENRE_CONFIGS: Record<Genre, GenreConfig> = {
  'acid-techno': {
    label: 'Acid Techno',
    effects: ['tunnel', 'kaleidoscope', 'warp', 'plasma', 'rings', 'fluid', 'sacred'],
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
    effects: ['glitch', 'matrix', 'grid', 'voronoi', 'dna', 'hexagons'],
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
    effects: ['mandala', 'lissajous', 'waves', 'rings', 'fluid', 'sacred'],
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
    effects: ['tunnel', 'glitch', 'fire', 'fractal', 'particles', 'hexagons', 'grid'],
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
    effects: ['kaleidoscope', 'starfield', 'mandala', 'waves', 'sacred', 'fluid', 'lissajous'],
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
    effects: ['particles', 'starfield', 'glitch', 'rings', 'tunnel', 'fire', 'warp'],
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
    effects: ['fluid', 'waves', 'mandala', 'starfield', 'metaballs', 'plasma'],
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
    effects: ['glitch', 'fire', 'tunnel', 'fractal', 'hexagons', 'grid', 'particles'],
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
 * AutoVJ — algorithmic VJ that selects effects, post-FX and palettes
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
  private effectBag!: Bag<EffectId>
  private postBag!: Bag<PostId[]>
  private paletteBag!: Bag<[string, string, string]>
  // Pending switch armed on beat count, executed on the next downbeat
  private pendingSwitch: { post: boolean; palette: boolean } | null = null
  private pendingSince = 0
  private prevBarPhase = 0

  // Callbacks for when AutoVJ wants to change something
  public onEffectChange: ((effect: EffectId) => void) | null = null
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
    this.effectBag = new Bag(config.effects)
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
      const switchInterval = this.getSwitchInterval(config, energy)
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
    this.switchEffect(config)
    if (opts.post) this.switchPost(config)
    if (opts.palette) this.switchPalette(config)
  }

  private getSwitchInterval(config: GenreConfig, energy: number): number {
    let base = config.switchBeats

    // High energy = switch faster
    if (this.highEnergyStreak > 4) {
      base = Math.max(4, Math.floor(base * 0.5))
    }
    // Low energy = switch slower
    if (this.lowEnergyStreak > 8) {
      base = Math.floor(base * 1.5)
    }

    return base
  }

  // ponytail: energy-weighted effect bias dropped — bag guarantees full rotation instead
  private switchEffect(config: GenreConfig) {
    if (config.effects.length <= 1) return
    const effect = this.effectBag.next()
    console.log(`[AutoVJ] Switching to effect: ${effect}`)
    this.onEffectChange?.(effect)
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
