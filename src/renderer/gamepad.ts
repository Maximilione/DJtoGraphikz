import type { Engine } from '@engine/Engine'
import { readJson, writeJson } from './storage'
import { momentary } from './momentary'
import { MIDI_TARGETS, type MidiTarget } from './midi'
import { GamepadTracker, bindingKey, type GpBinding, type GpEvent, type GpFrame } from './gamepadLogic'

// Gamepad as a VJ pad: same targets, same hold = momentary as MIDI. Bindings
// are by button/axis index, whichever pad sends them. The rAF loop runs only
// while at least one pad is connected.

type Cmd = { type: string; value?: unknown }
const STORAGE_KEY = 'djtographikz-gamepad'
const TRIGGER_GROUPS = new Set(['Trigger', 'Look Bank'])
const isTrigger = (t: MidiTarget) => TRIGGER_GROUPS.has(t.group)

class GamepadEngine {
  private bindings: Record<string, GpBinding> = {}
  private reverse = new Map<string, MidiTarget>()
  private learnTarget: string | null = null
  private listeners = new Set<() => void>()
  private dispatch: ((cmd: Cmd) => void) | null = null
  private engine: Engine | null = null
  private tracker = new GamepadTracker()
  private raf = 0
  private started = false

  lastMessage = ''
  padNames: string[] = []
  supported = typeof navigator !== 'undefined' && 'getGamepads' in navigator

  constructor() {
    this.bindings = readJson<Record<string, GpBinding>>(STORAGE_KEY, {})
    this.rebuildReverse()
  }

  start(engine: Engine, dispatch: (cmd: Cmd) => void) {
    this.engine = engine
    this.dispatch = dispatch
    if (!this.supported || this.started) { this.notify(); return }
    this.started = true
    window.addEventListener('gamepadconnected', this.onConnect)
    window.addEventListener('gamepaddisconnected', this.onDisconnect)
    this.refresh()
  }

  private pads(): Gamepad[] {
    return Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p)
  }

  private onConnect = () => this.refresh()
  private onDisconnect = (e: GamepadEvent) => { this.tracker.drop(e.gamepad.index); this.refresh() }

  /** names + start/stop the loop: nothing runs without a pad */
  private refresh() {
    const pads = this.pads()
    this.padNames = pads.map(p => p.id)
    if (pads.length && !this.raf) this.raf = requestAnimationFrame(this.tick)
    if (!pads.length && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0 }
    this.notify()
  }

  private tick = () => {
    this.raf = 0
    const pads = this.pads()
    if (!pads.length) { this.refresh(); return }
    for (const p of pads) {
      const f: GpFrame = { buttons: p.buttons.map(b => b.value), axes: [...p.axes] }
      const events = this.tracker.poll(p.index, f)
      if (!events.length) continue
      if (this.learnTarget) {
        const b = this.tracker.learnCandidate(p.index, f, events)
        if (b) {
          this.bindings[this.learnTarget] = b
          this.learnTarget = null
          this.persist(); this.rebuildReverse(); this.notify()
          continue
        }
      }
      for (const e of events) this.handle(e)
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  private handle(e: GpEvent) {
    const key = bindingKey(e)
    if (e.pressed) { this.lastMessage = `${e.kind === 'btn' ? 'Pulsante' : 'Asse'} ${e.num}`; this.notify() }
    const target = this.reverse.get(key)
    if (!target || !this.dispatch || !this.engine) return
    const engine = this.engine, dispatch = this.dispatch
    if (isTrigger(target)) {
      if (e.released) { momentary.release(`pad:${key}`); return }
      if (!e.pressed) return
      const cmd = target.toCmd(1, engine)
      if (!cmd) return
      if (target.hold === 'preset') {
        const before = engine.createPreset('prima del richiamo')
        momentary.press(`pad:${key}`, () => engine.applyPreset(before))
      } else if (target.hold === 'toggle') {
        momentary.press(`pad:${key}`, () => { const back = target.toCmd(1, engine); if (back) dispatch(back) })
      }
      dispatch(cmd)
    } else {
      const cmd = target.toCmd(e.value, engine)
      if (cmd) dispatch(cmd)
    }
  }

  learn(targetId: string) { this.learnTarget = targetId; this.notify() }
  cancelLearn() { this.learnTarget = null; this.notify() }
  learning(): string | null { return this.learnTarget }
  getBinding(id: string): GpBinding | undefined { return this.bindings[id] }

  clearBinding(id: string) { delete this.bindings[id]; this.persist(); this.rebuildReverse(); this.notify() }
  setBinding(id: string, b: GpBinding) { this.bindings[id] = b; this.persist(); this.rebuildReverse(); this.notify() }
  clearAll() { this.bindings = {}; this.persist(); this.rebuildReverse(); this.notify() }

  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }

  private rebuildReverse() {
    this.reverse.clear()
    for (const t of MIDI_TARGETS) {
      const b = this.bindings[t.id]
      if (b) this.reverse.set(bindingKey(b), t)
    }
  }
  private persist() { writeJson(STORAGE_KEY, this.bindings) }
  private notify() { for (const fn of this.listeners) fn() }
}

export const gamepad = new GamepadEngine()

export function gpBindingLabel(b: GpBinding | undefined): string {
  if (!b) return '—'
  return `${b.kind === 'btn' ? 'Pulsante' : 'Asse'} ${b.num}`
}
