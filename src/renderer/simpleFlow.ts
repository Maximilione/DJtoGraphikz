/**
 * Does the app actually hear the music? "Audio avviato" is not an answer: a
 * cable left out or the wrong input looks exactly like a working one, with
 * the graphics standing still. This is the one place that decides.
 *
 *   fermo    the analysis is not running
 *   attesa   running, no signal yet (under SILENCE_MS): "metti un brano"
 *   silenzio running, nothing for SILENCE_MS or more: something to check
 *   sento    signal within HEARD_MS
 */
export type SimpleFlow = 'fermo' | 'attesa' | 'silenzio' | 'sento'

export const HEARD_MS = 1500
export const SILENCE_MS = 4000

export function flowState(running: boolean, msSinceSound: number): SimpleFlow {
  if (!running) return 'fermo'
  if (msSinceSound < HEARD_MS) return 'sento'
  return msSinceSound >= SILENCE_MS ? 'silenzio' : 'attesa'
}
