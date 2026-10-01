/**
 * The part of sequence playback that puts a step's graphics on screen.
 *
 * Kept free of React and of the real Engine so check-sequences.mjs can walk
 * enter/leave with a fake host: the rule "a step's overlays carry the `seq:`
 * prefix, nothing else is ever touched" is what keeps the user's own media
 * safe while a sequence runs, and it has to stay testable.
 */
import type { GifSyncMode } from '@engine/Engine'
import type { SequenceStep, StepOverlay } from './sequences'

export const SEQ_PREFIX = 'seq:'

/** The slice of Engine the player needs — the real one satisfies it as is */
export interface OverlayHost {
  getOverlays(): { id: string }[]
  removeOverlay(id: string): void
  addOverlay(name: string, dataUrl: string, existingId?: string): Promise<unknown>
  addTextOverlay(text: string, opts?: { color?: string }, existingId?: string): unknown
  updateOverlay(id: string, u: { opacity?: number; scale?: number; offsetX?: number; offsetY?: number; gifSync?: GifSyncMode }): void
}

let entries = 0

export const OVERLAY_DEFAULTS = { opacity: 1, scale: 0.3, offsetX: 0, offsetY: 0 } as const

/** Remove every overlay a sequence step put up; the user's stay */
export function clearStepOverlays(host: OverlayHost) {
  for (const o of [...host.getOverlays()]) {
    if (o.id.startsWith(SEQ_PREFIX)) host.removeOverlay(o.id)
  }
}

/**
 * Put a step's graphics on screen, replacing whatever the previous step had.
 * `alive` is polled after every await: images decode asynchronously, and a
 * step that was already left must not land its picture on the next one.
 */
export async function enterStep(
  host: OverlayHost,
  step: Pick<SequenceStep, 'overlays'> | undefined,
  readPath: (path: string, name: string) => Promise<string>,
  alive: () => boolean = () => true,
) {
  clearStepOverlays(host)
  // ids are unique per entry, not per slot: a slow image from a step already
  // left must only ever remove itself, never the next step's overlay
  const entry = ++entries
  const list = step?.overlays ?? []
  for (let j = 0; j < list.length; j++) {
    const ov = list[j]
    const id = `${SEQ_PREFIX}${entry}:${j}`
    try {
      if (ov.kind === 'text') {
        host.addTextOverlay(ov.text ?? ov.name, { color: ov.color }, id)
      } else {
        const dataUrl = ov.dataUrl ?? (ov.path ? await readPath(ov.path, ov.name) : '')
        if (!dataUrl) continue
        await host.addOverlay(ov.name, dataUrl, id)
      }
    } catch {
      continue   // a missing file must not take the rest of the step down
    }
    if (!alive()) { host.removeOverlay(id); return }
    const { opacity, scale, offsetX, offsetY, gifSync } = ov
    host.updateOverlay(id, { opacity, scale, offsetX, offsetY, ...(gifSync ? { gifSync } : {}) })
  }
}

/**
 * Parameters for a graphic being added to a step: if the user already has it
 * on screen, "as it is now" wins over the centred defaults.
 */
export function paramsFromScreen(
  onScreen: { name: string; opacity: number; scale: number; offsetX: number; offsetY: number; gifSync: GifSyncMode }[],
  name: string,
): Pick<StepOverlay, 'opacity' | 'scale' | 'offsetX' | 'offsetY' | 'gifSync'> {
  const live = onScreen.find(o => o.name === name)
  if (!live) return { ...OVERLAY_DEFAULTS }
  const { opacity, scale, offsetX, offsetY, gifSync } = live
  return { opacity, scale, offsetX, offsetY, gifSync }
}
