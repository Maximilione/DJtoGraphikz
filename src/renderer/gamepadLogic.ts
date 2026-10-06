/**
 * Gamepad input, DOM-free: edge detection, dead zone and axis normalisation.
 * The polling and the learn/dispatch live in gamepad.ts; this is the part
 * that can be asserted without a controller.
 */

export interface GpBinding { kind: 'btn' | 'axis'; num: number }
/** A pad reduced to what we read: button values 0..1 and axes -1..1. */
export interface GpFrame { buttons: number[]; axes: number[] }
export interface GpEvent {
  kind: 'btn' | 'axis'
  num: number
  /** 0..1. Buttons: analog pressure. Axes: -1..1 remapped, centre = 0.5 */
  value: number
  /** buttons only: crossed up / down through PRESS_AT */
  pressed: boolean
  released: boolean
}

export const PRESS_AT = 0.5
export const DEAD_ZONE = 0.12
/** an axis must move by this much (0..1 scale) to count as a new value: debounce for noisy sticks */
export const AXIS_STEP = 0.01
/** learn: an axis must travel this far from where it rested (0..1 scale) to be picked */
export const LEARN_TRAVEL = 0.5

export const bindingKey = (b: GpBinding) => `${b.kind}:${b.num}`

/** -1..1 -> 0..1 with a dead zone around the centre (inside it: exactly 0.5). */
export function normalizeAxis(a: number, dead = DEAD_ZONE): number {
  const x = Math.max(-1, Math.min(1, Number.isFinite(a) ? a : 0))
  if (Math.abs(x) < dead) return 0.5
  const s = (Math.abs(x) - dead) / (1 - dead)
  return 0.5 + Math.sign(x) * s * 0.5
}

/**
 * Remembers the last reading of every pad and turns new frames into events.
 * First frame of a pad only sets the baseline (a button already down when the
 * pad is connected is not a press; a trigger resting at -1 is not a move).
 */
export class GamepadTracker {
  private btn = new Map<string, number>()
  private axis = new Map<string, number>()
  private base = new Map<string, number>()

  /** forget a pad (disconnected) so a reconnect starts from a fresh baseline */
  drop(pad: number) {
    for (const m of [this.btn, this.axis, this.base]) {
      for (const k of [...m.keys()]) if (k.startsWith(`${pad}:`)) m.delete(k)
    }
  }

  poll(pad: number, f: GpFrame): GpEvent[] {
    const out: GpEvent[] = []
    f.buttons.forEach((v, i) => {
      const k = `${pad}:${i}`
      const prev = this.btn.get(k)
      this.btn.set(k, v)
      if (prev === undefined) return
      const pressed = prev < PRESS_AT && v >= PRESS_AT
      const released = prev >= PRESS_AT && v < PRESS_AT
      // analog triggers report while moving; plain buttons only on edges
      if (pressed || released || (v !== prev && v > 0 && v < 1)) {
        out.push({ kind: 'btn', num: i, value: v, pressed, released })
      }
    })
    f.axes.forEach((raw, i) => {
      const k = `${pad}:${i}`
      const v = normalizeAxis(raw)
      const prev = this.axis.get(k)
      if (prev === undefined) { this.axis.set(k, v); this.base.set(k, normalizeAxis(raw, 0)); return }
      if (Math.abs(v - prev) < AXIS_STEP) return
      this.axis.set(k, v)
      out.push({ kind: 'axis', num: i, value: v, pressed: false, released: false })
    })
    return out
  }

  /** learn: did this pad just press a button, or move an axis far from its resting value? */
  learnCandidate(pad: number, f: GpFrame, events: GpEvent[]): GpBinding | null {
    const e = events.find(x => x.kind === 'btn' && x.pressed)
    if (e) return { kind: 'btn', num: e.num }
    for (const x of events) {
      if (x.kind !== 'axis') continue
      const base = this.base.get(`${pad}:${x.num}`) ?? 0.5
      if (Math.abs(normalizeAxis(f.axes[x.num] ?? 0, 0) - base) >= LEARN_TRAVEL) return { kind: 'axis', num: x.num }
    }
    return null
  }
}
