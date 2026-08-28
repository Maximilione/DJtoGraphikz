import type { Engine, PostId } from '@engine/Engine'

// Web MIDI learn — bindings route through the same dispatchCmd used by the
// phone remote and OSC, so MIDI can drive everything those can.

export interface MidiBinding { kind: 'cc' | 'note'; ch: number; num: number }
type Cmd = { type: string; value?: unknown }

export interface MidiTarget {
  id: string
  label: string
  group: string
  /** v is 0..1 for continuous input; 1 on note-on / CC press for triggers */
  toCmd: (v: number, engine: Engine) => Cmd | null
}

const POSTS: PostId[] = ['bloom', 'rgb-split', 'chromatic', 'feedback', 'filmgrain', 'scanlines', 'pixelate', 'mirror', 'invert']

export const MIDI_TARGETS: MidiTarget[] = [
  { id: 'master', label: 'Master', group: 'Mix', toCmd: v => ({ type: 'brightness', value: v }) },
  { id: 'crossfade', label: 'Crossfade A/B', group: 'Mix', toCmd: v => ({ type: 'crossfade', value: v }) },
  { id: 'motionblur', label: 'Motion blur', group: 'Mix', toCmd: v => ({ type: 'motionBlur', value: v }) },
  ...POSTS.map(p => ({
    id: `wet:${p}`, label: `Wet ${p}`, group: 'Post FX',
    toCmd: (v: number) => ({ type: 'postAmount', value: { id: p, value: v } }),
  })),
  // Grade: incoming 0..1 scaled to each control's real range (like OSC)
  { id: 'grade:exposure', label: 'Exposure', group: 'Grade', toCmd: v => ({ type: 'grade', value: { key: 'exposure', value: v * 2 } }) },
  { id: 'grade:contrast', label: 'Contrast', group: 'Grade', toCmd: v => ({ type: 'grade', value: { key: 'contrast', value: v * 2 } }) },
  { id: 'grade:saturation', label: 'Saturation', group: 'Grade', toCmd: v => ({ type: 'grade', value: { key: 'saturation', value: v * 2 } }) },
  { id: 'grade:lift', label: 'Lift', group: 'Grade', toCmd: v => ({ type: 'grade', value: { key: 'lift', value: v - 0.5 } }) },
  { id: 'grade:vignette', label: 'Vignette', group: 'Grade', toCmd: v => ({ type: 'grade', value: { key: 'vignette', value: v } }) },
  // Triggers / toggles
  { id: 'tap', label: 'Tap BPM', group: 'Trigger', toCmd: () => ({ type: 'tap' }) },
  { id: 'blackout', label: 'Blackout', group: 'Trigger', toCmd: (_v, e) => ({ type: 'blackout', value: !e.isBlackout() }) },
  { id: 'freeze', label: 'Freeze', group: 'Trigger', toCmd: (_v, e) => ({ type: 'freeze', value: !e.isFrozen() }) },
  { id: 'autovj', label: 'Auto VJ', group: 'Trigger', toCmd: () => ({ type: 'autovj', value: '__toggle__' }) },
  ...Array.from({ length: 16 }, (_, i) => ({
    id: `look:${i}`, label: `Look ${i + 1}`, group: 'Look Bank',
    toCmd: () => ({ type: 'look', value: i }),
  })),
]

const STORAGE_KEY = 'djtographikz-midi'
const TRIGGER_GROUPS = new Set(['Trigger', 'Look Bank'])
const isTrigger = (t: MidiTarget) => TRIGGER_GROUPS.has(t.group)

class MidiEngine {
  private access: MIDIAccess | null = null
  private bindings: Record<string, MidiBinding> = {}
  private reverse = new Map<string, MidiTarget>()
  private learnTarget: string | null = null
  private listeners = new Set<() => void>()
  private dispatch: ((cmd: Cmd) => void) | null = null
  private engine: Engine | null = null
  /** last value per trigger binding, for CC-as-button edge detection */
  private lastCcValue = new Map<string, number>()

  lastMessage = ''
  deviceNames: string[] = []
  supported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator

  constructor() {
    try { this.bindings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { this.bindings = {} }
    this.rebuildReverse()
  }

  async start(engine: Engine, dispatch: (cmd: Cmd) => void) {
    this.engine = engine
    this.dispatch = dispatch
    if (!this.supported || this.access) { this.notify(); return }
    try {
      this.access = await navigator.requestMIDIAccess()
      const wireAll = () => {
        this.deviceNames = []
        this.access!.inputs.forEach(input => {
          this.deviceNames.push(input.name || 'MIDI in')
          input.onmidimessage = this.onMessage
        })
        this.notify()
      }
      this.access.onstatechange = wireAll
      wireAll()
    } catch (e) {
      console.warn('[MIDI] access denied/unavailable:', e)
      this.supported = false
      this.notify()
    }
  }

  private onMessage = (e: MIDIMessageEvent) => {
    const data = e.data
    if (!data || data.length < 2) return
    const status = data[0] & 0xf0
    const ch = data[0] & 0x0f
    const num = data[1]
    let kind: 'cc' | 'note'
    let value: number
    if (status === 0xb0) { kind = 'cc'; value = (data[2] ?? 0) / 127 }
    else if (status === 0x90 && (data[2] ?? 0) > 0) { kind = 'note'; value = 1 }
    else if (status === 0x80 || status === 0x90) { kind = 'note'; value = 0 } // note-off
    else return

    this.lastMessage = `${kind.toUpperCase()} ${num} ch${ch + 1}`

    // Learn mode: bind and consume
    if (this.learnTarget && value > 0) {
      this.bindings[this.learnTarget] = { kind, ch, num }
      this.learnTarget = null
      this.persist()
      this.rebuildReverse()
      this.notify()
      return
    }

    const target = this.reverse.get(`${kind}:${ch}:${num}`)
    this.notify()
    if (!target || !this.dispatch || !this.engine) return

    if (isTrigger(target)) {
      // Notes fire on note-on; CC-as-button fires crossing up through 0.5
      const bkey = `${kind}:${ch}:${num}`
      const prev = this.lastCcValue.get(bkey) ?? 0
      this.lastCcValue.set(bkey, value)
      const fired = kind === 'note' ? value === 1 : prev <= 0.5 && value > 0.5
      if (!fired) return
      const cmd = target.toCmd(1, this.engine)
      if (cmd) this.dispatch(cmd)
    } else {
      // Faders: notes act as 0/1 switches, CC passes through
      const cmd = target.toCmd(value, this.engine)
      if (cmd) this.dispatch(cmd)
    }
  }

  learn(targetId: string) { this.learnTarget = targetId; this.notify() }
  cancelLearn() { this.learnTarget = null; this.notify() }
  learning(): string | null { return this.learnTarget }

  getBinding(targetId: string): MidiBinding | undefined { return this.bindings[targetId] }

  clearBinding(targetId: string) {
    delete this.bindings[targetId]
    this.persist()
    this.rebuildReverse()
    this.notify()
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  private rebuildReverse() {
    this.reverse.clear()
    for (const t of MIDI_TARGETS) {
      const b = this.bindings[t.id]
      if (b) this.reverse.set(`${b.kind}:${b.ch}:${b.num}`, t)
    }
  }

  private persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bindings)) } catch { /* full disk */ }
  }

  private notify() { for (const fn of this.listeners) fn() }
}

export const midi = new MidiEngine()

export function bindingLabel(b: MidiBinding | undefined): string {
  if (!b) return '—'
  return `${b.kind === 'cc' ? 'CC' : 'Note'} ${b.num} ch${b.ch + 1}`
}
