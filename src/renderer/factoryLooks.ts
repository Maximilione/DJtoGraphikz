import type { Preset } from '@engine/Engine'

// Shape must match LookBank's SavedLook (not exported there — kept in sync by hand).
interface SavedLook {
  name: string
  preset: Preset
  thumb: string
}

const STORAGE_KEY = 'djtographikz-looks'
const SLOTS = 16

const GRADE = { contrast: 1.05, saturation: 1.1, vignette: 0.25, lift: 0, exposure: 1.1 }

// ponytail: hand-curated seeds, no generator — 8 looks is content, not code
const FACTORY: Preset[] = [
  {
    name: 'Tunnel Acid',
    effect: 'tunnel',
    post: ['bloom', 'feedback'],
    colors: ['#00ff88', '#ff00ff', '#4444ff'],
    grade: { ...GRADE },
    effectParams: {
      tunnel: {
        sides: { value: 8, source: 'none', depth: 0 },
        twist: { value: 0.25, source: 'bass', depth: 0.4 },
      },
    },
  },
  {
    name: 'Kaleido Trance',
    effect: 'kaleidoscope',
    post: ['bloom', 'chromatic'],
    colors: ['#ff71ce', '#01cdfe', '#b967ff'],
    grade: { ...GRADE, saturation: 1.2 },
    effectParams: {
      kaleidoscope: {
        segments: { value: 8, source: 'none', depth: 0 },
        zoom: { value: 3, source: 'lfo-sine', depth: 0.3 },
      },
    },
  },
  {
    name: 'Dark Grid',
    effect: 'grid',
    post: ['bloom', 'scanlines'],
    colors: ['#ff0000', '#880000', '#ff4444'],
    grade: { ...GRADE, contrast: 1.15, vignette: 0.4, exposure: 1 },
  },
  {
    name: 'Fluid Ambient',
    effect: 'fluid',
    post: ['bloom', 'feedback'],
    colors: ['#0077b6', '#00b4d8', '#90e0ef'],
    grade: { ...GRADE, contrast: 1, vignette: 0.3 },
  },
  {
    name: 'Strobo Glitch',
    effect: 'glitch',
    post: ['rgb-split', 'bloom'],
    colors: ['#ffffff', '#ff2222', '#880000'],
    grade: { ...GRADE, contrast: 1.2, saturation: 1 },
    effectParams: {
      glitch: {
        intensity: { value: 1.5, source: 'beat', depth: 0.5 },
      },
    },
  },
  {
    name: 'Sacred Minimal',
    effect: 'sacred',
    post: ['bloom'],
    colors: ['#00ccff', '#0044ff', '#88ffff'],
    grade: { ...GRADE, vignette: 0.35 },
  },
  {
    name: 'Fire Gabber',
    effect: 'fire',
    post: ['bloom', 'filmgrain'],
    colors: ['#ff4400', '#ffaa00', '#ff0066'],
    grade: { ...GRADE, exposure: 1.15 },
  },
  {
    name: 'Starfield Chill',
    effect: 'starfield',
    post: ['bloom'],
    colors: ['#f72585', '#7209b7', '#3a0ca3'],
    grade: { ...GRADE, contrast: 1, saturation: 1.05 },
  },
]

/**
 * Seed the Look Bank with 8 factory looks (slots 0-7) on first run.
 * No-op if the bank already holds anything. Returns true if seeded.
 */
export function seedFactoryLooks(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const arr: unknown[] = JSON.parse(raw)
      if (Array.isArray(arr) && arr.some(Boolean)) return false
    }
    const looks: (SavedLook | null)[] = Array(SLOTS).fill(null)
    FACTORY.forEach((preset, i) => {
      looks[i] = { name: preset.name, preset, thumb: '' }
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(looks))
    return true
  } catch {
    return false
  }
}
