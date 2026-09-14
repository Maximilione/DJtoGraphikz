/**
 * The one guard that decides whether a global hotkey may fire.
 *
 * It used to be written twice — App.tsx and LookBank.tsx — with the same three
 * holes in both, which is what duplicated logic does:
 *
 * - `<button>` was not excluded, so pressing Space with a button focused ran
 *   the BPM tap (which calls preventDefault) instead of pressing the button.
 *   In a dark room, tabbing to PANIC and hitting Space tapped the tempo.
 * - NumberInput's container is a `<div tabIndex={0}>`, not an INPUT. With it
 *   focused — the documented way to use its wheel and arrows — a digit changed
 *   the live effect, `B` blacked out the projector and `F` froze it.
 * - `isContentEditable` was never checked.
 */
export function shouldIgnoreHotkey(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) return false

  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true

  // A focusable that is not a button owns the plain keys: the user is inside a
  // control, not driving the show.
  if (tag !== 'BUTTON' && el.hasAttribute('tabindex')) return true

  // A focused button owns its own activation keys, and only those — `B` and
  // `F` must still black out and freeze with a button focused.
  if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return true

  return false
}
