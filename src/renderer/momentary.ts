/**
 * Tap to latch, hold to be momentary — on the same key.
 *
 * "Ho acceso lo strobe e me lo sono dimenticato" is the classic way to ruin a
 * room, and the usual fix is a second set of controls: one bank that toggles,
 * one that only holds. That is twice the surface to remember in the dark.
 *
 * So the key decides by how long it is held. Under {@link HOLD_MS} it is a
 * tap and the change stays — the behaviour every key had before this existed.
 * Held longer, the change is undone on release. Nothing to configure, nothing
 * to switch, and a nervous quick press cannot leave anything hanging.
 *
 * It stores *how to undo*, captured at press time, and not "the opposite of
 * what I did": a look recall is undone by re-applying the look that was on
 * screen, which is not the same thing as recalling another one.
 */

/**
 * Longer than a deliberate tap, shorter than a musical gesture. 250 ms is
 * about four tenths of a beat at 128 BPM: you cannot hold one accidentally,
 * and you cannot miss one you meant.
 */
export const HOLD_MS = 250

interface Press {
  at: number
  revert: () => void
}

/**
 * One instance for the whole app. Two handlers own hotkeys — this file's
 * caller for the transport keys, `LookBank` for Shift+digit — and a key is
 * pressed in one and released in the other only if they agree on its name, so
 * the names are namespaced: `b`, `q`, `1`, `look:3`.
 */
export class Momentary {
  private held = new Map<string, Press>()

  /** Is this key down already? Keyboard auto-repeat must not re-press. */
  isDown(key: string): boolean { return this.held.has(key) }

  /**
   * Record a press. `revert` is called on release only if the key was held —
   * so callers apply their change first, then hand over the way back.
   */
  press(key: string, revert: () => void): void {
    this.held.set(key, { at: performance.now(), revert })
  }

  /**
   * Release. Returns true when the press counted as a hold and was undone,
   * so the caller can tell the user which of the two things happened.
   */
  release(key: string): boolean {
    const p = this.held.get(key)
    if (!p) return false
    this.held.delete(key)
    if (performance.now() - p.at < HOLD_MS) return false
    p.revert()
    return true
  }

  /**
   * Release everything without undoing anything. For the window losing focus:
   * a keyup that never arrives would otherwise leave a key logically stuck
   * down, and the next press would be ignored as auto-repeat.
   */
  clear(): void { this.held.clear() }
}

/** The shared instance. A press and its release must find the same map. */
export const momentary = new Momentary()
