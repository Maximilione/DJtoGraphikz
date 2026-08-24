import { createRealtimeBpmAnalyzer } from 'realtime-bpm-analyzer'

export interface AudioData {
  sub: number
  bass: number
  lowMid: number
  mid: number
  highMid: number
  high: number
  presence: number
  energy: number
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
}

const EMPTY_SPECTRUM = new Uint8Array(128)

export type BpmMode = 'auto' | 'manual' | 'tap'

export class AudioAnalyzer {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private gainNode: GainNode | null = null
  private stream: MediaStream | null = null
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(0)
  private running = false

  // realtime-bpm-analyzer
  private bpmAnalyzerNode: AudioWorkletNode | null = null
  private bpmAnalyzer: any = null

  // Beat detection — spectral flux (works across all frequency ranges)
  private prevSpectrum: Float32Array = new Float32Array(0)
  private fluxHistory: number[] = []
  private readonly FLUX_HISTORY_SIZE = 80     // ~1.3s at 60fps
  private beatCooldownUntil = 0
  private minBeatIntervalMs = 200
  private sensitivity = 1.4

  // BPM from library
  private libraryBpm = 0
  private libraryConfidence = 0
  private libraryStable = false

  // BPM mode
  private bpmMode: BpmMode = 'auto'
  private manualBpm = 128
  private tapTimes: number[] = []

  // Beat decay for smooth pulse
  private beatDecay = 0

  // Input gain
  private inputGain = 1.0

  // Adaptive normalization — quiet tracks stay alive, loud ones stop clipping
  private peakEnergy = 0.2
  private readonly NOISE_GATE = 0.015

  // Beat phase tracking (continuous, resynced on each detected beat)
  private beatPhase = 0
  private beatIndex = 0
  private lastPhaseTime = 0

  private data: AudioData = {
    sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, presence: 0,
    energy: 0, bassHit: 0, midHit: 0, highHit: 0,
    bpm: 128, beatDetected: false, beatPhase: 0, barPhase: 0,
    spectrum: EMPTY_SPECTRUM
  }

  // Per-band onset detection — same spectral-flux idea as the beat detector,
  // one rolling history per band so hats don't need kick-sized transients
  private bandFluxHistory: [number[], number[], number[]] = [[], [], []]
  private bandPulse = [0, 0, 0]

  get isRunning() { return this.running }

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
    console.warn(`[AudioAnalyzer] audio device lost (${reason}) — restarting in ${delayMs}ms`)
    this.restartTimer = window.setTimeout(() => {
      this.restartTimer = 0
      this.start(this.lastDeviceId)
        .then(() => { this.restartAttempts = 0 })
        .catch(err => {
          // A USB interface can take seconds to re-enumerate — keep trying
          // with backoff instead of going silent for the rest of the night
          this.restartAttempts++
          console.error('[AudioAnalyzer] restart failed (attempt ' + this.restartAttempts + '):', err)
          this.userStopped = false
          this.scheduleRestart('retry', Math.min(30_000, 1000 * 2 ** this.restartAttempts))
        })
    }, delayMs)
  }

  async start(deviceId?: string): Promise<void> {
    this.stop()
    this.userStopped = false
    this.lastDeviceId = deviceId

    // Native device rate — forcing 44100 on 48k hardware goes through a
    // resampler that is a known source of AudioContext device errors
    this.context = new AudioContext()
    this.context.onstatechange = () => {
      if (!this.context) return
      if (this.context.state === 'suspended' && this.running) {
        this.context.resume().catch(() => {})
      } else if ((this.context.state as string) === 'closed' && this.running) {
        this.scheduleRestart('context closed')
      }
    }

    if (this.context.state === 'suspended') {
      await this.context.resume()
    }

    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 2048
    // Lower smoothing = better transient detection
    this.analyser.smoothingTimeConstant = 0.4
    this.analyser.minDecibels = -90
    this.analyser.maxDecibels = -10

    const constraints: MediaStreamConstraints = {
      audio: deviceId
        ? { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        : { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    }

    console.log('[AudioAnalyzer] Requesting getUserMedia with constraints:', JSON.stringify(constraints))
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      console.error('[AudioAnalyzer] getUserMedia failed:', err)
      throw err
    }
    console.log('[AudioAnalyzer] Got stream, tracks:', this.stream.getAudioTracks().map(t => `${t.label} (${t.readyState})`))

    // Device yanked / OS revoked the track → recover instead of going silent
    const track = this.stream.getAudioTracks()[0]
    if (track) track.onended = () => this.scheduleRestart('track ended')

    this.source = this.context.createMediaStreamSource(this.stream)

    // Add gain node for input amplification (useful for weak mic signals)
    this.gainNode = this.context.createGain()
    this.gainNode.gain.value = this.inputGain
    this.source.connect(this.gainNode)
    this.gainNode.connect(this.analyser)

    // Initialize realtime-bpm-analyzer
    try {
      this.bpmAnalyzer = await createRealtimeBpmAnalyzer(this.context, {
        continuousAnalysis: true,
        stabilizationTime: 10000,
      })
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

    this.freqData = new Uint8Array(this.analyser.frequencyBinCount)
    this.prevSpectrum = new Float32Array(this.analyser.frequencyBinCount)
    this.running = true

    // Reset detection state
    this.fluxHistory = []
    this.bandFluxHistory = [[], [], []]
    this.libraryBpm = 0
    this.libraryConfidence = 0
    this.libraryStable = false

    console.log('[AudioAnalyzer] Started with device:', deviceId || 'default',
      'sample rate:', this.context.sampleRate,
      'bins:', this.analyser.frequencyBinCount)
  }

  stop(): void {
    this.running = false
    this.userStopped = true
    clearTimeout(this.restartTimer)
    this.restartTimer = 0
    if (this.context) this.context.onstatechange = null

    if (this.bpmAnalyzer) {
      try { this.bpmAnalyzer.stop() } catch (_) {}
      this.bpmAnalyzer = null
      this.bpmAnalyzerNode = null
    }

    this.gainNode?.disconnect()
    this.source?.disconnect()
    this.stream?.getTracks().forEach(t => t.stop())
    if (this.context && this.context.state !== 'closed') {
      this.context.close().catch(() => {})
    }
    this.context = null
    this.analyser = null
    this.source = null
    this.gainNode = null
    this.stream = null
  }

  // ---- Public configuration ----

  setBpmMode(mode: BpmMode) {
    this.bpmMode = mode
    if (mode === 'tap') this.tapTimes = []
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
    if (!this.analyser || !this.running) return this.data

    this.analyser.getByteFrequencyData(this.freqData)

    const sr = this.context!.sampleRate
    const binCount = this.freqData.length
    const binHz = (sr / 2) / binCount

    // Frequency bands
    this.data.sub = this.bandAvg(20, 60, binHz)
    this.data.bass = this.bandAvg(60, 250, binHz)
    this.data.lowMid = this.bandAvg(250, 500, binHz)
    this.data.mid = this.bandAvg(500, 2000, binHz)
    this.data.highMid = this.bandAvg(2000, 4000, binHz)
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

    const norm = (v: number) => gated * Math.min(1, v * gain)
    this.data.sub = norm(this.data.sub)
    this.data.bass = norm(this.data.bass)
    this.data.lowMid = norm(this.data.lowMid)
    this.data.mid = norm(this.data.mid)
    this.data.highMid = norm(this.data.highMid)
    this.data.high = norm(this.data.high)
    this.data.presence = norm(this.data.presence)
    this.data.energy = norm(rawEnergy)

    // --- Beat detection via SPECTRAL FLUX ---
    // Spectral flux measures the overall change in the spectrum frame-to-frame.
    // Unlike bass-only detection, this works with any mic (laptop, line-in, etc.)
    // because it detects ANY sudden energy increase across all frequencies.
    const now = performance.now()
    let flux = 0
    const bandFlux = [0, 0, 0] // bass / mid / high
    for (let i = 0; i < this.freqData.length; i++) {
      const curr = this.freqData[i] / 255
      const prev = this.prevSpectrum[i]
      const diff = curr - prev
      // Only count positive flux (onset = energy increase)
      if (diff > 0) {
        // Weight lower frequencies more (kick-heavy music)
        // but still include mids/highs so laptop mics work
        const w = i < binCount / 8 ? 3.0
               : i < binCount / 4 ? 2.0
               : i < binCount / 2 ? 1.0
               : 0.5
        flux += diff * w

        // Per-band onset flux (kick / snare-synth / hats)
        const hz = i * binHz
        if (hz < 250) bandFlux[0] += diff
        else if (hz >= 500 && hz < 2000) bandFlux[1] += diff
        else if (hz >= 4000 && hz < 12000) bandFlux[2] += diff
      }
      this.prevSpectrum[i] = curr
    }
    // Normalize by bin count
    flux /= binCount

    // Per-band hit pulses: adaptive threshold per band, decaying envelope
    for (let b = 0; b < 3; b++) {
      const f = bandFlux[b] / binCount
      const hist = this.bandFluxHistory[b]
      hist.push(f)
      if (hist.length > this.FLUX_HISTORY_SIZE) hist.shift()
      if (hist.length >= 10) {
        const mean = hist.reduce((a, v) => a + v, 0) / hist.length
        let sq = 0
        for (const v of hist) sq += (v - mean) ** 2
        const std = Math.sqrt(sq / hist.length)
        if (f > mean + std * this.sensitivity && f > 0.0008) this.bandPulse[b] = 1
      }
      this.bandPulse[b] *= 0.85
    }
    this.data.bassHit = gated * this.bandPulse[0]
    this.data.midHit = gated * this.bandPulse[1]
    this.data.highHit = gated * this.bandPulse[2]

    // Push to history
    this.fluxHistory.push(flux)
    if (this.fluxHistory.length > this.FLUX_HISTORY_SIZE) {
      this.fluxHistory.shift()
    }

    this.data.beatDetected = false

    if (this.fluxHistory.length >= 10) {
      // Adaptive threshold: mean + sensitivity * stddev
      const mean = this.fluxHistory.reduce((a, b) => a + b, 0) / this.fluxHistory.length
      let sqDiffSum = 0
      for (const f of this.fluxHistory) {
        sqDiffSum += (f - mean) ** 2
      }
      const stddev = Math.sqrt(sqDiffSum / this.fluxHistory.length)

      const threshold = mean + stddev * this.sensitivity

      // Very low absolute floor — allows detection even with quiet signals
      const isAboveThreshold = flux > threshold && flux > 0.003
      const cooldownPassed = now >= this.beatCooldownUntil

      if (isAboveThreshold && cooldownPassed) {
        this.data.beatDetected = true
        this.beatDecay = 1.0

        const currentBpm = this.getEffectiveBpm()
        if (currentBpm > 0) {
          this.beatCooldownUntil = now + (60000 / currentBpm) * 0.55
        } else {
          this.beatCooldownUntil = now + this.minBeatIntervalMs
        }
      }
    }

    // Beat decay
    this.beatDecay *= 0.88

    this.data.bpm = this.getEffectiveBpm()

    // Continuous beat phase — free-runs on BPM, resyncs on every detected beat.
    // Lets shaders anticipate the beat instead of only reacting to it.
    const dtSec = this.lastPhaseTime ? Math.min((now - this.lastPhaseTime) / 1000, 0.5) : 0
    this.lastPhaseTime = now
    this.beatPhase += dtSec * (this.data.bpm / 60)
    while (this.beatPhase >= 1) {
      this.beatPhase -= 1
      this.beatIndex = (this.beatIndex + 1) % 4
    }
    if (this.data.beatDetected) {
      this.beatPhase = 0
      this.beatIndex = (this.beatIndex + 1) % 4
    }
    this.data.beatPhase = this.beatPhase
    this.data.barPhase = (this.beatIndex + this.beatPhase) / 4

    this.data.spectrum = this.freqData

    return this.data
  }

  getEffectiveBpm(): number {
    switch (this.bpmMode) {
      case 'manual':
      case 'tap':
        return this.manualBpm
      case 'auto':
      default:
        return this.libraryBpm > 0 ? this.libraryBpm : this.manualBpm
    }
  }

  getBeatPulse(): number { return this.beatDecay }
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
