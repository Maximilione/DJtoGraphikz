import { createRealtimeBpmAnalyzer } from 'realtime-bpm-analyzer'
import { BandHits } from './BandHits'
import { KeyDetector, type Key } from './KeyDetector'
import { BeatTracker } from './BeatTracker'
import { MidiClock } from './MidiClock'
import { ProDjLinkClock } from './ProDjLinkClock'
import { findExternal, isBuiltInLabel, restartPlan } from '../../shared/audioInput'

export interface AudioData {
  sub: number
  bass: number
  mid: number
  high: number
  presence: number
  energy: number
  /** bass and energy BEFORE the adaptive gain: byte/255 of the dB spectrum, never clipped.
   *  The gain pins `bass` at 1.0 on any loud track; the phase detector needs the unclipped level. */
  bassRaw: number
  energyRaw: number
  /** Per-band onset pulses (1 on transient, decaying) — kick / snare-synth / hats */
  bassHit: number
  midHit: number
  highHit: number
  bpm: number
  beatDetected: boolean
  /** 0..1 position inside the current beat (resynced on every detected beat) */
  beatPhase: number
  /** 0..1 position inside the current 4-beat bar */
  barPhase: number
  spectrum: Uint8Array
  /** Time-domain samples, 0..255 centred on 128 — the oscilloscope trace */
  waveform: Uint8Array
  /** Hz per spectrum bin, so consumers can map bins to frequencies */
  binHz: number
  /** musical key over the last ~8 s, null until there is enough harmony to name one */
  key: Key | null
}

const EMPTY_SPECTRUM = new Uint8Array(128)
const EMPTY_WAVEFORM = new Uint8Array(128).fill(128)

/**
 * 'midi' takes tempo and phase from a MIDI clock, 'prodjlink' from the Pioneer
 * decks on the booth LAN — the two that are not a guess.
 */
export type BpmMode = 'auto' | 'manual' | 'tap' | 'midi' | 'prodjlink'

export class AudioAnalyzer {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: AudioNode | null = null
  /**
   * Where the signal comes from. A file is not a device: it cannot be yanked,
   * so none of the reconnection machinery applies to it, and it is the only
   * source you can rewind — which is the whole point of having it.
   */
  private sourceKind: 'device' | 'file' = 'device'
  private mediaEl: HTMLAudioElement | null = null
  private mediaUrl = ''
  private fileName = ''
  private gainNode: GainNode | null = null
  private stream: MediaStream | null = null
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(0)
  private waveData: Uint8Array<ArrayBuffer> = new Uint8Array(0)
  private running = false

  // realtime-bpm-analyzer
  private bpmAnalyzerNode: AudioWorkletNode | null = null
  private bpmAnalyzer: any = null

  // Beat detection lives in BeatTracker (pure DSP, unit-testable):
  // log-flux onsets, median+MAD threshold, PLL phase, own ACF tempo
  private tracker = new BeatTracker()
  private specBuf: Float32Array = new Float32Array(0)
  private sensitivity = 1.4

  // BPM from library
  private libraryBpm = 0
  private libraryConfidence = 0
  private libraryStable = false

  /**
   * Tempo off the wire. Lives here and not in the MIDI module because this is
   * where tempo and phase are decided; `midi.ts` only hands it bytes, and it
   * keeps working with no audio device at all — a cable and no line-in is a
   * real way to run a night.
   */
  readonly midiClock = new MidiClock()
  /** Same idea over the network: beats forwarded by main from the CDJs (App.tsx feeds it). */
  readonly proLink = new ProDjLinkClock()

  // BPM mode
  private bpmMode: BpmMode = 'auto'
  private manualBpm = 128
  private tapTimes: number[] = []

  // Beat decay for smooth pulse

  // Input gain
  private inputGain = 1.0

  // Adaptive normalization — quiet tracks stay alive, loud ones stop clipping
  private peakEnergy = 0.2
  private readonly NOISE_GATE = 0.015

  private data: AudioData = {
    sub: 0, bass: 0, mid: 0, high: 0, presence: 0,
    energy: 0, bassRaw: 0, energyRaw: 0, bassHit: 0, midHit: 0, highHit: 0, key: null,
    bpm: 128, beatDetected: false, beatPhase: 0, barPhase: 0,
    spectrum: EMPTY_SPECTRUM, waveform: EMPTY_WAVEFORM, binHz: 21.5
  }

  // Per-band onset detection — same spectral-flux idea as the beat detector,
  // one rolling history per band so hats don't need kick-sized transients
  private bandHits = new BandHits()
  private keyDetector = new KeyDetector()
  private keyFrames = 0
  private lastKeyAt = 0

  get isRunning() { return this.running }
  /** Device the graph is actually on — a caller cannot tell from isRunning alone. */
  get currentDeviceId() { return this.lastDeviceId }
  /** Label of the track actually delivering audio ('' when none) — what the OS really opened. */
  get currentLabel() { return this.activeLabel }
  private activeLabel = ''
  private devChangeBound = false
  /**
   * Bumped by every start()/startFile()/stop(). An async start that finds it changed
   * after an await has been superseded (another start, or the user's Stop): it releases
   * what it opened and quits instead of resurrecting the graph.
   */
  private gen = 0
  get generation() { return this.gen }
  /** Why automatic recovery gave up (permission denied), '' otherwise. */
  private fatal = ''
  get lastError() { return this.fatal }

  /** Id of an external (non built-in) card plugged in now, if any. */
  private async externalInputId(): Promise<string | undefined> {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      return findExternal(all.filter(d => d.kind === 'audioinput'))?.deviceId
    } catch { return undefined }
  }

  /** A card (re)appearing while we are on the room mic, or while recovering: go to it. */
  private onDeviceChange = async () => {
    if (this.userStopped || this.sourceKind === 'file') return
    const recovering = !!this.restartTimer
    if (!recovering && !(this.running && isBuiltInLabel(this.activeLabel))) return
    const id = await this.externalInputId()
    if (!id || this.userStopped) return
    console.log('[AudioAnalyzer] external card available — switching to it')
    this.start(id).then(() => { this.restartAttempts = 0 }).catch(err => {
      if (!this.giveUp(err)) this.scheduleRestart('switch failed')
    })
  }

  getStatus(): 'running' | 'reconnecting' | 'stopped' {
    if (this.restartTimer) return 'reconnecting'
    return this.running ? 'running' : 'stopped'
  }

  // Auto-recovery: the audio device can die under us (Bluetooth profile
  // switch, device unplug, Chromium "AudioContext encountered an error") —
  // without this the app silently stops reacting to the mic until restart.
  private lastDeviceId?: string
  private restartTimer = 0
  private restartAttempts = 0
  // start() calls stop() internally, so `running` can't gate restarts — this
  // flag distinguishes a user stop (no retry) from a recovery stop (retry)
  private userStopped = true

  private scheduleRestart(reason: string, delayMs = 1000) {
    if (this.userStopped || this.restartTimer) return
    // A file has no device to come back: restarting would re-open the mic.
    if (this.sourceKind === 'file') return
    if (restartPlan(this.restartAttempts).log) {
      console.warn(`[AudioAnalyzer] audio device lost (${reason}) — restarting in ${delayMs}ms`)
    }
    this.restartTimer = window.setTimeout(async () => {
      this.restartTimer = 0
      // After enough failures the remembered id is not the way back: one try on the default
      const plan = restartPlan(this.restartAttempts)
      // No remembered id (we fell back before): prefer a card over the room mic
      const id = plan.tryDefault ? undefined : (this.lastDeviceId ?? await this.externalInputId())
      // Stop (or another start) may have come in while the cards were being listed
      if (this.userStopped || this.restartTimer) return
      this.start(id)
        .then(() => { this.restartAttempts = 0 })
        .catch(err => {
          if (this.userStopped || this.giveUp(err)) return
          // A USB interface can take seconds to re-enumerate — keep trying
          // with backoff instead of going silent for the rest of the night
          this.restartAttempts++
          const next = restartPlan(this.restartAttempts)
          if (next.log) console.error('[AudioAnalyzer] restart failed (attempt ' + this.restartAttempts + '):', err)
          this.scheduleRestart('retry', next.delayMs)
        })
    }, delayMs)
  }

  /** Permission denied will not fix itself: stop retrying and keep the reason for the UI. */
  private giveUp(err: unknown): boolean {
    const name = (err as DOMException)?.name
    if (name !== 'NotAllowedError' && name !== 'SecurityError') return false
    console.error('[AudioAnalyzer] microphone access denied — automatic recovery stopped')
    this.fatal = `${name}: ${(err as Error)?.message ?? ''}`
    this.restartAttempts = 0
    return true
  }

  async start(deviceId?: string): Promise<void> {
    this.stop()
    const gen = this.gen
    this.userStopped = false
    this.fatal = ''
    this.lastDeviceId = deviceId
    if (!this.devChangeBound) {
      this.devChangeBound = true
      navigator.mediaDevices.addEventListener?.('devicechange', this.onDeviceChange)
    }
    const opened: MediaStream[] = []
    try {
      await this.open(deviceId, gen, st => { opened.push(st) })
    } catch (err) {
      // Superseded: whoever superseded us owns the graph now. Current: do not leave
      // a half-built graph (context, analyser) behind a failure.
      opened.forEach(o => o.getTracks().forEach(t => t.stop()))
      if (gen !== this.gen) return
      this.teardown()
      throw err
    }
    // Superseded while the last await was in flight: the stream we opened is ours to drop.
    if (gen !== this.gen) opened.forEach(o => o.getTracks().forEach(t => t.stop()))
  }

  private async open(deviceId: string | undefined, gen: number, got: (s: MediaStream) => void): Promise<void> {
    const stale = () => gen !== this.gen

    // Native device rate — forcing 44100 on 48k hardware goes through a
    // resampler that is a known source of AudioContext device errors
    const context = new AudioContext()
    this.context = context
    context.onstatechange = () => {
      if (this.context !== context) return
      if (context.state === 'suspended' && this.running) {
        context.resume().catch(() => {})
      } else if ((context.state as string) === 'closed' && this.running) {
        this.scheduleRestart('context closed')
      }
    }

    if (context.state === 'suspended') {
      await context.resume()
      if (stale()) return
    }

    this.makeAnalyser()

    const raw = { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId }, ...raw } : raw
    }

    console.log('[AudioAnalyzer] Requesting getUserMedia with constraints:', JSON.stringify(constraints))
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      console.error('[AudioAnalyzer] getUserMedia failed:', err)
      // Stale deviceId (card replugged → new id): retrying the same exact id
      // loops forever. Fall back to the system default and forget the id.
      // A denied permission is not a stale id: no fallback, the error goes up.
      const name = (err as DOMException)?.name
      if (stale() || !deviceId || (name !== 'OverconstrainedError' && name !== 'NotFoundError')) throw err
      // Another card may be plugged in under a new id: take it over the room mic
      const extId = await this.externalInputId()
      let fallback: MediaStream | null = null
      if (extId && !stale()) {
        try {
          fallback = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: extId }, ...raw } })
          got(fallback)
          if (!stale()) this.lastDeviceId = extId
          console.warn('[AudioAnalyzer] device id gone — using the external card found')
        } catch (e2) { console.warn('[AudioAnalyzer] external card failed:', e2) }
      }
      if (stale()) return
      if (!fallback) {
        console.warn('[AudioAnalyzer] device id gone — falling back to default input')
        this.lastDeviceId = undefined
        fallback = await navigator.mediaDevices.getUserMedia({ audio: raw })
        got(fallback)
      }
      stream = fallback
    }
    got(stream)
    if (stale()) return   // start() drops the stream we opened
    this.stream = stream
    console.log('[AudioAnalyzer] Got stream, tracks:', stream.getAudioTracks().map(t => `${t.label} (${t.readyState})`))

    // Device yanked / OS revoked the track → recover instead of going silent
    const track = stream.getAudioTracks()[0]
    this.activeLabel = track?.label ?? ''
    if (track) track.onended = () => { if (this.stream === stream) this.scheduleRestart('track ended') }

    this.source = context.createMediaStreamSource(stream)
    await this.wireGraph()

    console.log('[AudioAnalyzer] Started with device:', deviceId || 'default',
      'sample rate:', context.sampleRate,
      'bins:', this.analyser?.frequencyBinCount)
  }

  /**
   * Analyse a file instead of an input.
   *
   * Every bit of the beat, BPM and envelope work is only verifiable on a
   * night out, with a real set through a real line-in — which means it was
   * never verifiable at a desk. Drop an mp3 in and the same graph runs on it,
   * with a transport you can rewind.
   */
  async startFile(file: File): Promise<void> {
    this.stop()
    const gen = this.gen
    this.userStopped = false
    this.fatal = ''
    this.sourceKind = 'file'
    this.fileName = file.name

    this.context = new AudioContext()
    if (this.context.state === 'suspended') await this.context.resume()
    if (gen !== this.gen) return
    this.makeAnalyser()

    this.mediaUrl = URL.createObjectURL(file)
    const el = new Audio(this.mediaUrl)
    el.crossOrigin = 'anonymous'
    el.loop = true
    this.mediaEl = el

    await new Promise<void>((resolve, reject) => {
      el.onloadedmetadata = () => resolve()
      el.onerror = () => reject(new Error(`Non riesco a leggere ${file.name}`))
    })

    if (gen !== this.gen) return
    this.source = this.context.createMediaElementSource(el)
    await this.wireGraph()
    if (gen !== this.gen) return
    // You have to hear it: this is a rehearsal, not a measurement.
    this.gainNode!.connect(this.context.destination)

    await el.play()
    // A media element keeps playing on a suspended context, and the analyser
    // then reads pure silence — indistinguishable from broken beat detection.
    if (this.context.state !== 'running') {
      await this.context.resume().catch(() => {})
      if ((this.context.state as string) !== 'running') {
        console.warn('[AudioAnalyzer] AudioContext sospeso: l\'analisi leggera\' silenzio')
      }
    }
    console.log('[AudioAnalyzer] file:', file.name, `${el.duration.toFixed(1)}s`,
      'sample rate:', this.context.sampleRate)
  }

  /** The analyser settings, which are the same whatever feeds them. */
  private makeAnalyser(): void {
    this.analyser = this.context!.createAnalyser()
    this.analyser.fftSize = 2048
    // Lower smoothing = better transient detection
    this.analyser.smoothingTimeConstant = 0.4
    this.analyser.minDecibels = -90
    this.analyser.maxDecibels = -10
  }

  /** gain → analyser → BPM library, and the buffers that read them. */
  private async wireGraph(): Promise<void> {
    const gen = this.gen
    // Add gain node for input amplification (useful for weak mic signals)
    this.gainNode = this.context!.createGain()
    this.gainNode.gain.value = this.inputGain
    this.source!.connect(this.gainNode)
    this.gainNode.connect(this.analyser!)

    // Initialize realtime-bpm-analyzer
    try {
      const created = await createRealtimeBpmAnalyzer(this.context!, {
        continuousAnalysis: true,
        stabilizationTime: 10000,
      })
      if (gen !== this.gen) { try { created.stop() } catch (_) {} return }   // stopped meanwhile
      this.bpmAnalyzer = created
      this.bpmAnalyzerNode = this.bpmAnalyzer.node

      // Connect gain → bpmAnalyzer (parallel to analyser)
      this.gainNode.connect(this.bpmAnalyzerNode!)

      this.bpmAnalyzer.on('bpm', (data: any) => {
        if (data.bpm && data.bpm.length > 0) {
          const top = data.bpm[0]
          this.libraryBpm = Math.round(top.tempo)
          this.libraryConfidence = top.confidence ?? (top.count > 20 ? 0.8 : top.count / 25)
        }
      })

      this.bpmAnalyzer.on('bpmStable', (data: any) => {
        if (data.bpm && data.bpm.length > 0) {
          this.libraryBpm = Math.round(data.bpm[0].tempo)
          this.libraryConfidence = 1.0
          this.libraryStable = true
          console.log('[BPM] STABLE:', this.libraryBpm)
        }
      })

      this.bpmAnalyzer.on('error', (data: any) => {
        console.error('[BPM] error:', data.message)
      })

      console.log('[AudioAnalyzer] realtime-bpm-analyzer connected')
    } catch (err) {
      console.warn('[AudioAnalyzer] Failed to init realtime-bpm-analyzer, falling back to manual:', err)
    }

    this.freqData = new Uint8Array(this.analyser!.frequencyBinCount)
    this.waveData = new Uint8Array(this.analyser!.fftSize)
    this.specBuf = new Float32Array(this.analyser!.frequencyBinCount)
    this.running = true

    // Reset detection state
    this.tracker.reset()
    this.bandHits.reset()
    this.keyDetector.reset()
    this.data.key = null
    this.libraryBpm = 0
    this.libraryConfidence = 0
    this.libraryStable = false
  }

  stop(): void {
    this.gen++
    this.userStopped = true
    clearTimeout(this.restartTimer)
    this.restartTimer = 0
    this.teardown()
  }

  /** Release everything the graph holds; says nothing about whether recovery may follow. */
  private teardown(): void {
    this.running = false
    if (this.context) this.context.onstatechange = null

    if (this.bpmAnalyzer) {
      try { this.bpmAnalyzer.stop() } catch (_) {}
      this.bpmAnalyzer = null
      this.bpmAnalyzerNode = null
    }

    this.gainNode?.disconnect()
    this.source?.disconnect()
    this.stream?.getTracks().forEach(t => t.stop())

    if (this.mediaEl) {
      this.mediaEl.pause()
      this.mediaEl.src = ''
      this.mediaEl = null
    }
    // An object URL pins the whole file in memory until it is revoked, and a
    // set is 100 MB of wav.
    if (this.mediaUrl) { URL.revokeObjectURL(this.mediaUrl); this.mediaUrl = '' }
    this.fileName = ''
    this.activeLabel = ''
    this.sourceKind = 'device'
    if (this.context && this.context.state !== 'closed') {
      this.context.close().catch(() => {})
    }
    this.context = null
    this.analyser = null
    this.source = null
    this.gainNode = null
    this.stream = null
  }

  // ---- File transport ----
  // Only meaningful while a file is the source; all of it is a no-op otherwise,
  // so callers do not have to branch.

  /** 'device' or 'file' — what is feeding the analysis right now. */
  getSourceKind(): 'device' | 'file' { return this.sourceKind }
  getFileName(): string { return this.fileName }

  isPlaying(): boolean { return !!this.mediaEl && !this.mediaEl.paused }
  getDuration(): number { return this.mediaEl?.duration ?? 0 }
  getCurrentTime(): number { return this.mediaEl?.currentTime ?? 0 }
  isLooping(): boolean { return this.mediaEl?.loop ?? false }
  setLooping(on: boolean): void { if (this.mediaEl) this.mediaEl.loop = on }

  playPause(): void {
    const el = this.mediaEl
    if (!el) return
    if (el.paused) el.play().catch(err => console.warn('[AudioAnalyzer] play:', err))
    else el.pause()
  }

  /**
   * Jump to a point in seconds. The tempo estimator keeps a running history
   * that a jump invalidates — what it heard before the jump is not what plays
   * after it — so the estimate starts over.
   */
  seek(seconds: number): void {
    const el = this.mediaEl
    if (!el) return
    el.currentTime = Math.max(0, Math.min(el.duration || 0, seconds))
    this.tracker.reset()
    this.resetBpm()
  }

  // ---- Public configuration ----

  setBpmMode(mode: BpmMode) {
    this.bpmMode = mode
    if (mode === 'tap') this.tapTimes = []
  }

  /** Is a MIDI clock actually ticking right now? (Offer the mode, or explain it.) */
  hasMidiClock(): boolean { return this.midiClock.read(performance.now()).running }

  /** Has one ever ticked this session? Used to point the user at the mode. */
  sawMidiClock(): boolean { return this.midiClock.seen }

  /** Is a CDJ beating at us right now? */
  hasProLink(): boolean { return this.proLink.read(performance.now()).running }

  /** Has one ever? */
  sawProLink(): boolean { return this.proLink.seen }

  /** The exact clock the mode follows, if the mode follows one. */
  private externalClock(): MidiClock | ProDjLinkClock | null {
    if (this.bpmMode === 'midi') return this.midiClock
    if (this.bpmMode === 'prodjlink') return this.proLink
    return null
  }

  getBpmMode(): BpmMode { return this.bpmMode }

  setManualBpm(bpm: number) {
    this.manualBpm = Math.max(60, Math.min(300, bpm))
  }

  getManualBpm(): number { return this.manualBpm }

  tap(): number {
    const now = performance.now()
    this.tapTimes.push(now)
    while (this.tapTimes.length > 1 && now - this.tapTimes[0] > 4000) {
      this.tapTimes.shift()
    }
    if (this.tapTimes.length > 16) this.tapTimes.shift()

    if (this.tapTimes.length >= 2) {
      const intervals: number[] = []
      for (let i = 1; i < this.tapTimes.length; i++) {
        intervals.push(this.tapTimes[i] - this.tapTimes[i - 1])
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const bpm = 60000 / avg
      if (bpm >= 60 && bpm <= 300) {
        this.manualBpm = Math.round(bpm)
        return this.manualBpm
      }
    }
    return 0
  }

  setSensitivity(value: number) {
    // value 0..1 → multiplier 1.05..2.0 (higher sensitivity = lower multiplier)
    this.sensitivity = 1.05 + (1.0 - value) * 0.95
    this.tracker.sensitivity = this.sensitivity
    this.bandHits.sensitivity = this.sensitivity
  }

  getSensitivity(): number {
    return (2.0 - this.sensitivity) / 0.95
  }

  setInputGain(value: number) {
    this.inputGain = value
    if (this.gainNode) {
      this.gainNode.gain.value = value
    }
  }

  getInputGain(): number { return this.inputGain }

  /** genre hint from AutoVJ: centers the tempo search prior */
  setTempoPrior(bpm: number) { this.tracker.tempoPrior = Math.max(60, Math.min(200, bpm)) }

  getAutoBpm(): number { return this.libraryBpm }
  getBpmConfidence(): number { return this.libraryConfidence }
  isStable(): boolean { return this.libraryStable }

  resetBpm(): void {
    this.libraryBpm = 0
    this.libraryConfidence = 0
    this.libraryStable = false
    if (this.bpmAnalyzer) {
      try { this.bpmAnalyzer.reset() } catch (_) {}
    }
  }

  // ---- Main update ----

  update(): AudioData {
    // A MIDI clock is worth following even with no audio device: the cable
    // carries tempo and phase, and everything beat-driven runs off those.
    if (!this.analyser || !this.running) {
      const ext = this.externalClock()
      if (ext) this.applyClock(ext)
      else this.data.beatDetected = false
      return this.data
    }

    this.analyser.getByteFrequencyData(this.freqData)
    this.analyser.getByteTimeDomainData(this.waveData)

    const sr = this.context!.sampleRate
    const binCount = this.freqData.length
    const binHz = (sr / 2) / binCount

    // Frequency bands
    this.data.sub = this.bandAvg(20, 60, binHz)
    this.data.bass = this.bandAvg(60, 250, binHz)
    this.data.mid = this.bandAvg(500, 2000, binHz)
    this.data.high = this.bandAvg(4000, 8000, binHz)
    this.data.presence = this.bandAvg(8000, 20000, binHz)

    // Energy (weighted towards bass+sub for electronic music)
    let sum = 0, count = 0
    for (let i = 0; i < this.freqData.length; i++) {
      const weight = i < this.freqData.length / 4 ? 2.0 : 1.0
      sum += (this.freqData[i] / 255) * weight
      count += weight
    }
    const rawEnergy = sum / count

    // Adaptive normalization: track a slowly decaying peak and scale everything to it.
    // Quiet tracks don't look dead, loud ones don't sit pinned at 1.0.
    this.peakEnergy = Math.max(rawEnergy, this.peakEnergy * 0.998, 0.05)
    const gain = 1 / this.peakEnergy

    // Noise gate — below this the signal is room noise, not music
    const gated = rawEnergy < this.NOISE_GATE ? 0 : 1

    this.data.bassRaw = gated * this.data.bass
    this.data.energyRaw = gated * rawEnergy
    const norm = (v: number) => gated * Math.min(1, v * gain)
    this.data.sub = norm(this.data.sub)
    this.data.bass = norm(this.data.bass)
    this.data.mid = norm(this.data.mid)
    this.data.high = norm(this.data.high)
    this.data.presence = norm(this.data.presence)
    this.data.energy = norm(rawEnergy)

    // --- Beat tracking (BeatTracker: log-flux, PLL, ACF tempo) ---
    const now = performance.now()
    if (this.specBuf.length !== binCount) this.specBuf = new Float32Array(binCount)
    for (let i = 0; i < binCount; i++) this.specBuf[i] = this.freqData[i] / 255

    // the tracker free-runs on the best external tempo we have; its own ACF
    // estimate fills in while the library is still stabilizing
    this.tracker.externalBpm = this.bpmMode === 'auto'
      ? (this.libraryStable ? this.libraryBpm : 0)
      : this.manualBpm
    const bandFlux = [0, 0, 0]
    const bt = this.tracker.update(this.specBuf, binHz, now, bandFlux, gated === 1)

    this.data.beatDetected = bt.beat
    this.data.beatPhase = bt.beatPhase
    this.data.barPhase = bt.barPhase
    this.data.bpm = this.getEffectiveBpm()

    // Per-band hit pulses: adaptive threshold per band, decaying envelope
    const hits = this.bandHits.update([bandFlux[0] / binCount, bandFlux[1] / binCount, bandFlux[2] / binCount], gated)
    this.data.bassHit = hits[0]
    this.data.midHit = hits[1]
    this.data.highHit = hits[2]

    this.data.spectrum = this.freqData
    this.data.waveform = this.waveData
    this.data.binHz = binHz

    // key: chroma every frame, the 24-way correlation twice a second
    if (gated) {
      const dtKey = this.lastKeyAt ? Math.min(100, now - this.lastKeyAt) : 16
      this.keyDetector.update(this.freqData, binHz, dtKey)
      if (++this.keyFrames >= 30) { this.keyFrames = 0; this.data.key = this.keyDetector.estimate() }
    }
    this.lastKeyAt = now

    // The clock wins outright over the PLL: it is not an estimate, and pulling
    // an exact grid 35% towards whatever the hats just did can only make it
    // worse. The tracker still runs — the per-band hits above are its work.
    const ext = this.externalClock()
    if (ext) this.applyClock(ext)

    return this.data
  }

  /** Overwrite tempo and phase from the clock, when it is running. */
  private applyClock(clock: MidiClock | ProDjLinkClock): void {
    const c = clock.read(performance.now())
    this.data.bpm = this.getEffectiveBpm()
    if (!c.running) {
      // Clock gone mid-set: keep the last tempo and stop claiming beats rather
      // than snapping the visuals back to whatever the microphone thinks.
      this.data.beatDetected = false
      return
    }
    this.data.beatPhase = c.beatPhase
    this.data.barPhase = c.barPhase
    this.data.beatDetected = c.beatDetected
    // This is the one caller per frame that consumes it; every other read of
    // the clock (the panel, getEffectiveBpm) is a peek.
    clock.clearBeat()
  }

  getEffectiveBpm(): number {
    switch (this.bpmMode) {
      case 'midi':
      case 'prodjlink': {
        const c = this.externalClock()!.read(performance.now())
        // A stopped transport keeps the tempo it last sent: a DJ who hits stop
        // between tracks should not watch the visuals fall back to 128.
        return c.bpm > 0 ? Math.round(c.bpm) : this.manualBpm
      }
      case 'manual':
      case 'tap':
        return this.manualBpm
      case 'auto':
      default:
        // stable library wins; then our live ACF estimate; then whatever's left
        if (this.libraryStable && this.libraryBpm > 0) return this.libraryBpm
        if (this.tracker.acfConfidence > 0.6 && this.tracker.acfBpm > 0) return Math.round(this.tracker.acfBpm)
        return this.libraryBpm > 0 ? this.libraryBpm : this.manualBpm
    }
  }

  getData(): AudioData { return this.data }

  getFrequencyData(): Uint8Array | null {
    if (!this.analyser || !this.running) return null
    this.analyser.getByteFrequencyData(this.freqData)
    return this.freqData
  }

  private bandAvg(lowHz: number, highHz: number, binHz: number): number {
    const lo = Math.max(0, Math.floor(lowHz / binHz))
    const hi = Math.min(Math.ceil(highHz / binHz), this.freqData.length - 1)
    if (hi <= lo) return 0
    let sum = 0
    for (let i = lo; i <= hi; i++) sum += this.freqData[i]
    return sum / ((hi - lo + 1) * 255)
  }
}
