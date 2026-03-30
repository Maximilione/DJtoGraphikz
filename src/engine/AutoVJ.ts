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
 * AutoVJ — algorithmic VJ that selects effects, post-FX and palettes
 * based on audio analysis and genre configuration.
 */
export class AutoVJ {
  private enabled = false
  private genre: Genre = 'acid-techno'
  private beatCount = 0
  private lastEffectIndex = -1
  private lastPostIndex = -1
  private lastPaletteIndex = -1
  private highEnergyStreak = 0
  private lowEnergyStreak = 0
  private frameCount = 0
  private lastSwitchFrame = 0

  // Callbacks for when AutoVJ wants to change something
  public onEffectChange: ((effect: EffectId) => void) | null = null
  public onPostChange: ((posts: PostId[]) => void) | null = null
  public onPaletteChange: ((colors: [string, string, string]) => void) | null = null

  setEnabled(enabled: boolean) { this.enabled = enabled }
  isEnabled(): boolean { return this.enabled }

  setGenre(genre: Genre) {
    this.genre = genre
    this.beatCount = 0
    this.highEnergyStreak = 0
    this.lowEnergyStreak = 0
  }
  getGenre(): Genre { return this.genre }

  /**
   * Call every frame with current audio data.
   * The AutoVJ decides when to switch based on beat count and energy.
   */
  update(beatDetected: boolean, energy: number, bass: number) {
    if (!this.enabled) return
    this.frameCount++

    const config = GENRE_CONFIGS[this.genre]

    // Fallback: if no beats detected for ~300 frames (~5s at 60fps), switch anyway
    if (!beatDetected && this.frameCount - this.lastSwitchFrame > 300) {
      this.lastSwitchFrame = this.frameCount
      this.switchEffect(config, energy, bass)
      if (Math.random() < 0.4) this.switchPost(config, energy)
      if (Math.random() < 0.3) this.switchPalette(config)
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

      // Time to switch effect?
      const switchInterval = this.getSwitchInterval(config, energy)
      if (this.beatCount >= switchInterval) {
        this.beatCount = 0
        this.lastSwitchFrame = this.frameCount
        this.switchEffect(config, energy, bass)
      }

      // Switch post-FX less frequently (every 2x effect switches)
      if (this.beatCount === 0 && Math.random() < 0.5) {
        this.switchPost(config, energy)
      }

      // Switch palette even less frequently
      if (this.beatCount === 0 && Math.random() < 0.3) {
        this.switchPalette(config)
      }
    }
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

  private switchEffect(config: GenreConfig, energy: number, _bass: number) {
    const effects = config.effects
    if (effects.length <= 1) return

    // Pick a different effect, weighted by energy
    let idx: number
    if (energy > config.energyThreshold * 1.5) {
      // High energy: prefer effects at the start of the list (more intense)
      idx = Math.floor(Math.random() * Math.min(3, effects.length))
    } else {
      idx = Math.floor(Math.random() * effects.length)
    }

    // Avoid repeating
    if (idx === this.lastEffectIndex && effects.length > 1) {
      idx = (idx + 1) % effects.length
    }
    this.lastEffectIndex = idx

    console.log(`[AutoVJ] Switching to effect: ${effects[idx]}`)
    this.onEffectChange?.(effects[idx])
  }

  private switchPost(config: GenreConfig, energy: number) {
    const sets = config.postSets
    if (sets.length <= 1) return

    let idx = Math.floor(Math.random() * sets.length)
    if (idx === this.lastPostIndex && sets.length > 1) {
      idx = (idx + 1) % sets.length
    }
    this.lastPostIndex = idx

    this.onPostChange?.(sets[idx])
  }

  private switchPalette(config: GenreConfig) {
    const palettes = config.palettes
    if (palettes.length <= 1) return

    let idx = Math.floor(Math.random() * palettes.length)
    if (idx === this.lastPaletteIndex && palettes.length > 1) {
      idx = (idx + 1) % palettes.length
    }
    this.lastPaletteIndex = idx

    this.onPaletteChange?.(palettes[idx])
  }
}
