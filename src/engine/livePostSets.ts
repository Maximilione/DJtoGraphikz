import type { PostId } from './Engine'

/**
 * The heavy post chains the live setlists (docs/scalette) put over the scenes.
 * One list, read by the generator (scripts/gen-scalette.mjs) and by the sweep
 * (src/renderer/sweep.ts), so every chain a setlist can show has been
 * measured over a bright effect for white, black and flat frames.
 */
export interface LivePostSet { name: string; amounts: Partial<Record<PostId, number>> }

export const LIVE_POSTS: Record<'break' | 'build' | 'groove' | 'peak' | 'bright', LivePostSet[]> = {
  break: [
    { name: 'K1', amounts: { filmgrain: 0.6, bloom: 0.5 } },
    { name: 'C1', amounts: { cinegrade: 0.7, halation: 0.6, filmgrain: 0.4 } },
  ],
  build: [
    { name: 'B1', amounts: { feedback: 0.5, displace: 0.35, bloom: 0.6 } },
    { name: 'B2', amounts: { 'rgb-delay': 0.6, bloom: 0.6 } },
  ],
  groove: [
    { name: 'G1', amounts: { bloom: 0.7, chromatic: 0.5 } },
    { name: 'G2', amounts: { chromatic: 0.6, scanlines: 0.5 } },
    { name: 'G3', amounts: { bloom: 0.6, 'rgb-delay': 0.5 } },
    { name: 'C2', amounts: { anamorphic: 0.6, bloom: 0.5, cinegrade: 0.5 } },
  ],
  peak: [
    { name: 'P1', amounts: { bloom: 0.8, chromatic: 0.7, 'rgb-delay': 0.6 } },
    { name: 'P2', amounts: { bloom: 0.7, chromatic: 0.6, 'frame-glitch': 0.6 } },
    { name: 'P3', amounts: { feedback: 0.55, chromatic: 0.7, bloom: 0.6 } },
    { name: 'P4', amounts: { 'rgb-split': 0.8, bloom: 0.7, displace: 0.5 } },
    { name: 'C3', amounts: { godrays: 0.6, anamorphic: 0.5, chromatic: 0.5, tiltshift: 0.4 } },
  ],
  // flash, strobegrid, lasers: already the brightest scenes, nothing piles on
  bright: [
    { name: 'X1', amounts: { chromatic: 0.5 } },
  ],
}
