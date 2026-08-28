import * as THREE from 'three'
import { AudioAnalyzer } from './audio/AudioAnalyzer'
import { COMMON_PARAMS, EFFECT_PARAMS, type EffectParam, type ParamState, type AudioSource } from './EffectParams'
import { GifDecoder, GifFrame } from './GifDecoder'

import tunnelFrag from './shaders/tunnel.frag?raw'
import kaleidoscopeFrag from './shaders/kaleidoscope.frag?raw'
import warpFrag from './shaders/warp.frag?raw'
import plasmaFrag from './shaders/plasma.frag?raw'
import matrixFrag from './shaders/matrix.frag?raw'
import voronoiFrag from './shaders/voronoi.frag?raw'
import sacredFrag from './shaders/sacred.frag?raw'
import fractalFrag from './shaders/fractal.frag?raw'
import particlesFrag from './shaders/particles.frag?raw'
import starfieldFrag from './shaders/starfield.frag?raw'
import metaballsFrag from './shaders/metaballs.frag?raw'
import mandalaFrag from './shaders/mandala.frag?raw'
import gridFrag from './shaders/grid.frag?raw'
import wavesFrag from './shaders/waves.frag?raw'
import lissajousFrag from './shaders/lissajous.frag?raw'
import fluidFrag from './shaders/fluid.frag?raw'
import glitchFrag from './shaders/glitch.frag?raw'
import ringsFrag from './shaders/rings.frag?raw'
import fireFrag from './shaders/fire.frag?raw'
import hexagonsFrag from './shaders/hexagons.frag?raw'
import dnaFrag from './shaders/dna.frag?raw'
import rgbsplitFrag from './shaders/rgbsplit.frag?raw'
import bloomFrag from './shaders/bloom.frag?raw'
import feedbackFrag from './shaders/feedback.frag?raw'
import chromaticFrag from './shaders/chromatic.frag?raw'
import filmgrainFrag from './shaders/filmgrain.frag?raw'
import scanlinesFrag from './shaders/scanlines.frag?raw'
import pixelateFrag from './shaders/pixelate.frag?raw'
import mirrorFrag from './shaders/mirror.frag?raw'
import invertFrag from './shaders/invert.frag?raw'
import transitionFrag from './shaders/transition.frag?raw'
import overlayFrag from './shaders/overlay.frag?raw'
import bloomPrefilterFrag from './shaders/bloomPrefilter.frag?raw'
import blurFrag from './shaders/blur.frag?raw'
import masterFrag from './shaders/master.frag?raw'
import deckmixFrag from './shaders/deckmix.frag?raw'
import motionblurFrag from './shaders/motionblur.frag?raw'

const FULLSCREEN_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const PASSTHROUGH_FRAG = `
precision highp float;
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(tDiffuse, vUv); }
`

export type GifSyncMode = 'free' | 'beat' | 'bpm'

export interface OverlayItem {
  id: string
  name: string
  dataUrl: string
  opacity: number
  scale: number
  offsetX: number
  offsetY: number
  visible: boolean
  gifSync: GifSyncMode
  /** >0 turns the overlay into a displacement map instead of a layer */
  displace: number
  /** Set for video/webcam overlays so the output window can recreate them */
  source?: { kind: 'video'; path: string } | { kind: 'webcam'; deviceId?: string }
  // Internal — managed by engine
  _texture?: THREE.Texture
  _canvas?: HTMLCanvasElement
  _isGif?: boolean
  _isVideo?: boolean
  _video?: HTMLVideoElement
  _gifFrames?: GifFrame[]
  _gifFrameIndex?: number
  _gifLastAdvance?: number
}

export type EffectId =
  | 'tunnel' | 'kaleidoscope' | 'warp' | 'plasma' | 'matrix' | 'voronoi'
  | 'sacred' | 'fractal' | 'particles' | 'starfield' | 'metaballs' | 'mandala'
  | 'grid' | 'waves' | 'lissajous' | 'fluid' | 'glitch' | 'rings' | 'fire'
  | 'hexagons' | 'dna'
export type PostId = 'bloom' | 'rgb-split' | 'chromatic' | 'feedback' | 'filmgrain' | 'scanlines' | 'pixelate' | 'mirror' | 'invert'

export type TransitionType = 'crossfade' | 'wipe-left' | 'wipe-down' | 'radial' | 'dissolve'
const TRANSITION_TYPE_INDEX: Record<TransitionType, number> = {
  'crossfade': 0, 'wipe-left': 1, 'wipe-down': 2, 'radial': 3, 'dissolve': 4,
}

export type BlendMode = 'mix' | 'add' | 'screen' | 'multiply' | 'difference'
export const BLEND_MODES: BlendMode[] = ['mix', 'add', 'screen', 'multiply', 'difference']

export interface Grade {
  contrast: number    // 1 = neutral
  saturation: number  // 1 = neutral
  vignette: number    // 0 = off
  lift: number        // 0 = neutral
  exposure: number    // 1 = neutral (tone mapping exposure)
}

const DEFAULT_GRADE: Grade = { contrast: 1.05, saturation: 1.1, vignette: 0.25, lift: 0, exposure: 1.1 }

export interface EngineState {
  activeEffect: EffectId
  activePost: PostId[]
  postAmounts?: Partial<Record<PostId, number>>
  colors: [string, string, string]
  beatPulse: number
  energy: number
  bpm: number
  transition?: {
    type: TransitionType
    duration: number
    fromEffect: EffectId
  }
  customShader?: string
  customParams?: EffectParam[]
  effectParams?: Record<string, Record<string, ParamState>>
  /** Param defs of the ACTIVE effect — read-only, for remote UIs */
  paramDefs?: EffectParam[]
  // Transition + palette-cycling preferences (persisted, synced to remote UIs)
  transitionType?: TransitionType
  transitionDuration?: number
  transitionBeatSync?: boolean
  colorSpeed?: number
  cycle?: {
    enabled: boolean
    palettes: [string, string, string][]
    intervalMs: number
    beatSync: boolean
    beatsPerSwitch: number
  }
  // Deck / master
  deckBEffect?: EffectId
  crossfade?: number
  blendMode?: BlendMode
  brightness?: number
  blackout?: boolean
  frozen?: boolean
  motionBlur?: number
  grade?: Grade
}

// Preset system
export interface Preset {
  name: string
  effect: EffectId
  post: PostId[]
  colors: [string, string, string]
  postAmounts?: Partial<Record<PostId, number>>
  grade?: Grade
  motionBlur?: number
  deckBEffect?: EffectId
  crossfade?: number
  blendMode?: BlendMode
  /** Per-effect param values + audio mappings — a look isn't a look without them */
  effectParams?: Record<string, Record<string, ParamState>>
  customShader?: string
  customParams?: EffectParam[]
}

export interface Playlist {
  name: string
  presets: Preset[]
  loop: boolean
  autoAdvance: boolean
  advanceMode: 'timer' | 'beats'
  advanceInterval: number   // seconds for timer, beats for beat mode
}

const EFFECT_SHADERS: Record<EffectId, string> = {
  tunnel: tunnelFrag,
  kaleidoscope: kaleidoscopeFrag,
  warp: warpFrag,
  plasma: plasmaFrag,
  matrix: matrixFrag,
  voronoi: voronoiFrag,
  sacred: sacredFrag,
  fractal: fractalFrag,
  particles: particlesFrag,
  starfield: starfieldFrag,
  metaballs: metaballsFrag,
  mandala: mandalaFrag,
  grid: gridFrag,
  waves: wavesFrag,
  lissajous: lissajousFrag,
  fluid: fluidFrag,
  glitch: glitchFrag,
  rings: ringsFrag,
  fire: fireFrag,
  hexagons: hexagonsFrag,
  dna: dnaFrag,
}

const DEFAULT_COLORS: [string, string, string] = ['#00ff88', '#ff00ff', '#4444ff']

export class Engine {
  private renderer: THREE.WebGLRenderer
  private camera: THREE.OrthographicCamera
  private scene: THREE.Scene
  private quad: THREE.Mesh
  private clock: THREE.Clock

  // Render targets
  private rtA: THREE.WebGLRenderTarget
  private rtB: THREE.WebGLRenderTarget
  private rtPrev: THREE.WebGLRenderTarget
  private rtDeckB: THREE.WebGLRenderTarget
  private rtFreeze: THREE.WebGLRenderTarget
  private rtAccum: THREE.WebGLRenderTarget      // motion blur history (ping)
  private rtAccum2: THREE.WebGLRenderTarget     // motion blur history (pong)
  private rtBloomA: THREE.WebGLRenderTarget     // half-res bloom buffers
  private rtBloomB: THREE.WebGLRenderTarget

  // Post processing
  private postScene: THREE.Scene
  private postQuad: THREE.Mesh

  // Reusable passthrough material (avoid per-frame allocations)
  private passthroughMaterial: THREE.ShaderMaterial

  // Current state
  private currentEffect: EffectId = 'tunnel'
  private mainMaterial: THREE.ShaderMaterial
  private postMaterials: Map<PostId, THREE.ShaderMaterial> = new Map()
  /** Ordered post-FX chain — order matters as much as which effects are on */
  private postChain: { id: PostId; amount: number }[] = [{ id: 'bloom', amount: 1 }]

  // Deck B + crossfader
  private deckBEffect: EffectId = 'plasma'
  private deckBMaterial: THREE.ShaderMaterial | null = null
  private crossfade = 0            // 0 = deck A only, 1 = full B
  private blendMode: BlendMode = 'mix'
  private deckMixMaterial!: THREE.ShaderMaterial

  // Master stage (always on)
  private masterMaterial!: THREE.ShaderMaterial
  private brightness = 1
  private blackout = false
  private frozen = false
  private freezeRequested = false
  private grade: Grade = { ...DEFAULT_GRADE }

  // Per-effect parameters (speed/reactivity + custom shader uniforms), audio-mappable
  private paramState: Record<string, Record<string, ParamState>> = {}
  private customParamDefs: EffectParam[] = []
  private usingCustom = false
  private customShaderSource = ''
  private effectTime = 0     // param-speed-driven clock for effect shaders
  private audioScale = 1     // reactivity multiplier applied to audio uniforms
  private beatClock = 0      // continuous beat counter driving tempo-synced LFOs

  // Motion blur + bloom helpers
  private motionBlur = 0
  private motionBlurMaterial!: THREE.ShaderMaterial
  private bloomPrefilterMaterial!: THREE.ShaderMaterial
  private blurMaterial!: THREE.ShaderMaterial
  private bloomResolution = new THREE.Vector2(960, 540)

  // Output resolution drives shader math even when the preview renders smaller
  private outputWidth = 1920
  private outputHeight = 1080

  private colors: THREE.Color[] = [
    new THREE.Color(DEFAULT_COLORS[0]),
    new THREE.Color(DEFAULT_COLORS[1]),
    new THREE.Color(DEFAULT_COLORS[2]),
  ]

  // Color transitions
  private targetColors: THREE.Color[] = [
    new THREE.Color(DEFAULT_COLORS[0]),
    new THREE.Color(DEFAULT_COLORS[1]),
    new THREE.Color(DEFAULT_COLORS[2]),
  ]
  private colorLerpSpeed = 0.04  // per frame, ~0.7s at 60fps

  // Palette cycling
  private cycleEnabled = false
  private cyclePalettes: [string, string, string][] = []
  private cycleIndex = 0
  private cycleIntervalMs = 8000
  private cycleLastSwitch = 0
  private cycleBeatSync = false
  private cycleBeatCount = 0
  private cycleBeatsPerSwitch = 16

  // Effect transitions
  private transitionType: TransitionType = 'crossfade'
  private transitionDuration = 0.8 // seconds
  private transitionProgress = -1  // -1 = not transitioning
  private transitionOldMaterial: THREE.ShaderMaterial | null = null
  private rtTransition: THREE.WebGLRenderTarget
  private transitionMaterial: THREE.ShaderMaterial
  private transitionBeatSync = false
  private transitionPending: EffectId | null = null
  private transitionPendingSince = 0

  // Overlays
  private overlays: OverlayItem[] = []
  private overlayMaterial: THREE.ShaderMaterial

  public audioAnalyzer: AudioAnalyzer
  private animFrameId = 0
  private disposed = false
  private resolution = new THREE.Vector2(1920, 1080)
  private lastIpcTime = 0
  private lastFrameTime = 0

  // Remote mode: output window — audio arrives via IPC, nothing is sent back
  private remote: boolean
  private pendingBeat = false
  private remoteBpm = 128

  // Smoothed audio values for less jitter
  private smoothBass = 0
  private smoothMid = 0
  private smoothHigh = 0
  private smoothEnergy = 0
  private smoothSub = 0
  private smoothPresence = 0
  private beatPulse = 0
  private beatPhase = 0
  private barPhase = 0

  // Extended vocabulary: per-band onset pulses + gated clocks
  // (uBassTime advances only while bass is playing — breakdowns freeze it)
  private bassHit = 0
  private midHit = 0
  private highHit = 0
  private bassTime = 0
  private highTime = 0

  // State change callback (for syncing to output window)
  public onStateChange: ((state: EngineState) => void) | null = null

  // UI listeners — panels subscribe here so they stay in sync when state
  // changes from ANY surface (phone remote, AutoVJ, hotkeys, presets)
  private stateListeners = new Set<(state: EngineState) => void>()

  /** Subscribe to state changes. Returns an unsubscribe function. */
  onState(fn: (state: EngineState) => void): () => void {
    this.stateListeners.add(fn)
    return () => { this.stateListeners.delete(fn) }
  }

  // Per-frame audio listeners (AutoVJ, playlist beat-advance — fresh beat data, one call per frame)
  private audioFrameListeners = new Set<(beatDetected: boolean, energy: number, bass: number, barPhase: number) => void>()

  /** Subscribe to per-frame audio. Returns an unsubscribe function. */
  onAudioFrame(fn: (beatDetected: boolean, energy: number, bass: number, barPhase: number) => void): () => void {
    this.audioFrameListeners.add(fn)
    return () => { this.audioFrameListeners.delete(fn) }
  }

  constructor(private canvas: HTMLCanvasElement, options: { remote?: boolean } = {}) {
    this.remote = !!options.remote
    this.audioAnalyzer = new AudioAnalyzer()
    this.clock = new THREE.Clock()

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(1)
    this.renderer.autoClear = false
    // Filmic tone mapping + sRGB output: saturated neons stop clipping to white on a projector
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = this.grade.exposure

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const geom = new THREE.PlaneGeometry(2, 2)

    // Main scene
    this.scene = new THREE.Scene()
    this.mainMaterial = this.createEffectMaterial('tunnel')
    this.quad = new THREE.Mesh(geom, this.mainMaterial)
    this.scene.add(this.quad)

    // Post scene
    this.postScene = new THREE.Scene()
    this.postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: PASSTHROUGH_FRAG,
      uniforms: { tDiffuse: { value: null } }
    }))
    this.postScene.add(this.postQuad)

    // Reusable passthrough (never allocate in render loop)
    this.passthroughMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: PASSTHROUGH_FRAG,
      uniforms: { tDiffuse: { value: null } }
    })

    // Render targets
    const opts: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    }
    this.rtA = new THREE.WebGLRenderTarget(1920, 1080, opts)
    this.rtB = new THREE.WebGLRenderTarget(1920, 1080, opts)
    this.rtPrev = new THREE.WebGLRenderTarget(1920, 1080, opts)
    this.rtTransition = new THREE.WebGLRenderTarget(1920, 1080, opts)
    this.rtDeckB = new THREE.WebGLRenderTarget(1920, 1080, opts)
    this.rtFreeze = new THREE.WebGLRenderTarget(1920, 1080, opts)
    this.rtAccum = new THREE.WebGLRenderTarget(1920, 1080, opts)
    this.rtAccum2 = new THREE.WebGLRenderTarget(1920, 1080, opts)
    this.rtBloomA = new THREE.WebGLRenderTarget(960, 540, opts)
    this.rtBloomB = new THREE.WebGLRenderTarget(960, 540, opts)

    // Deck crossfader
    this.deckMixMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: deckmixFrag,
      uniforms: {
        tDeckA: { value: null }, tDeckB: { value: null },
        uMix: { value: 0 }, uBlend: { value: 0 },
      }
    })

    // Master grade (always the last pass)
    this.masterMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: masterFrag,
      uniforms: {
        tDiffuse: { value: null },
        uBrightness: { value: 1 },
        uContrast: { value: this.grade.contrast },
        uSaturation: { value: this.grade.saturation },
        uVignette: { value: this.grade.vignette },
        uLift: { value: this.grade.lift },
      }
    })

    // Temporal motion blur
    this.motionBlurMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: motionblurFrag,
      uniforms: { tDiffuse: { value: null }, tPrev: { value: null }, uAmount: { value: 0 } }
    })

    // Bloom: threshold prefilter + separable blur at half resolution
    this.bloomPrefilterMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: bloomPrefilterFrag,
      uniforms: { tDiffuse: { value: null }, uThreshold: { value: 0.55 }, uKnee: { value: 0.25 } }
    })
    this.blurMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: blurFrag,
      uniforms: {
        tDiffuse: { value: null },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uResolution: { value: this.bloomResolution },
        uRadius: { value: 1.5 },
      }
    })

    // Transition material
    this.transitionMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: transitionFrag,
      uniforms: {
        tOld: { value: null },
        tNew: { value: null },
        uProgress: { value: 0 },
        uType: { value: 0 },
        uResolution: { value: this.resolution },
      }
    })

    // Overlay material
    this.overlayMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: overlayFrag,
      uniforms: {
        tDiffuse: { value: null },
        tOverlay: { value: null },
        uOpacity: { value: 1.0 },
        uOverlayScale: { value: new THREE.Vector2(1, 1) },
        uOverlayOffset: { value: new THREE.Vector2(0, 0) },
        uDisplace: { value: 0 },
      }
    })

    // Init post-processing materials
    this.initPostMaterials()

    // WebGL context loss after hours of GPU load: preventDefault allows the
    // browser to restore the context; three re-uploads resources on restore
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault()
      console.error('[Engine] WebGL context LOST — waiting for restore')
    })
    canvas.addEventListener('webglcontextrestored', () => {
      console.warn('[Engine] WebGL context restored')
      this.renderer.resetState()
    })

    this.handleResize()
    window.addEventListener('resize', this.handleResize)
  }

  private handleResize = () => {
    if (this.remote) {
      this.renderer.setSize(window.innerWidth, window.innerHeight)
      this.setRenderSize(this.outputWidth, this.outputHeight)
      return
    }
    const parent = this.canvas.parentElement
    if (!parent) return
    this.renderer.setSize(parent.clientWidth, parent.clientHeight)
    // Preview keeps the OUTPUT resolution in uResolution, so what you see on the
    // preview is the same framing/scale that goes to the projector.
    this.setRenderSize(this.outputWidth, this.outputHeight)
  }

  /**
   * Set the output resolution. `uResolution` always reports this value so shader
   * scale matches the projector; the buffers themselves are capped in preview.
   */
  setRenderSize(w: number, h: number) {
    this.outputWidth = w
    this.outputHeight = h
    this.resolution.set(w, h)

    // Preview renders at most 1080p worth of pixels — same look, less GPU
    const cap = this.remote ? 3840 : 1920
    const scale = Math.min(1, cap / w)
    const bw = Math.max(2, Math.round(w * scale))
    const bh = Math.max(2, Math.round(h * scale))

    for (const rt of [this.rtA, this.rtB, this.rtPrev, this.rtTransition, this.rtDeckB, this.rtFreeze, this.rtAccum, this.rtAccum2]) {
      // Resizing an RT discards its contents — the freeze frame must survive
      if (rt === this.rtFreeze && this.frozen) continue
      rt.setSize(bw, bh)
    }
    this.rtBloomA.setSize(Math.max(2, bw >> 1), Math.max(2, bh >> 1))
    this.rtBloomB.setSize(Math.max(2, bw >> 1), Math.max(2, bh >> 1))
    this.bloomResolution.set(bw >> 1, bh >> 1)
  }

  private createEffectMaterial(id: EffectId): THREE.ShaderMaterial {
    // Curated per-effect uniforms start at their defaults; the render loop
    // drives the ACTIVE effect's ones from param state every frame
    const paramUniforms: Record<string, THREE.IUniform> = {}
    for (const d of EFFECT_PARAMS[id] ?? []) paramUniforms[d.key] = { value: d.default }
    return new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: EFFECT_SHADERS[id],
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uEnergy: { value: 0 },
        uBeat: { value: 0 },
        uBeatPhase: { value: 0 },
        uBarPhase: { value: 0 },
        uSub: { value: 0 },
        uPresence: { value: 0 },
        uBassHit: { value: 0 },
        uMidHit: { value: 0 },
        uHighHit: { value: 0 },
        uBassTime: { value: 0 },
        uHighTime: { value: 0 },
        uColor1: { value: this.colors[0] },
        uColor2: { value: this.colors[1] },
        uColor3: { value: this.colors[2] },
        uResolution: { value: this.resolution },
        ...paramUniforms,
      }
    })
  }

  private initPostMaterials() {
    this.postMaterials.set('bloom', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: bloomFrag,
      uniforms: {
        tDiffuse: { value: null },
        tBloom: { value: null },
        uStrength: { value: 1.4 },
        uEnergy: { value: 0 },
        uWet: { value: 1 },
      }
    }))

    this.postMaterials.set('rgb-split', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: rgbsplitFrag,
      uniforms: {
        tDiffuse: { value: null },
        uWet: { value: 1 },
        uAmount: { value: 0.003 },
        uAngle: { value: 0.0 },
        uBass: { value: 0 },
        uBeat: { value: 0 },
      }
    }))

    this.postMaterials.set('chromatic', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: chromaticFrag,
      uniforms: {
        tDiffuse: { value: null },
        uWet: { value: 1 },
        uStrength: { value: 0.008 },
        uBass: { value: 0 },
        uBeat: { value: 0 },
        uResolution: { value: this.resolution },
      }
    }))

    this.postMaterials.set('feedback', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: feedbackFrag,
      uniforms: {
        tDiffuse: { value: null },
        uWet: { value: 1 },
        tPrevFrame: { value: this.rtPrev.texture },
        uDecay: { value: 0.9 },
        uZoom: { value: 0.003 },
        uRotation: { value: 0.2 },
        uBass: { value: 0 },
        uTime: { value: 0 },
        uWarp: { value: 0.6 },
      }
    }))

    this.postMaterials.set('filmgrain', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: filmgrainFrag,
      uniforms: {
        tDiffuse: { value: null },
        uWet: { value: 1 },
        uTime: { value: 0 },
        uEnergy: { value: 0 },
        uResolution: { value: this.resolution },
      }
    }))

    this.postMaterials.set('scanlines', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: scanlinesFrag,
      uniforms: {
        tDiffuse: { value: null },
        uWet: { value: 1 },
        uTime: { value: 0 },
        uEnergy: { value: 0 },
        uResolution: { value: this.resolution },
      }
    }))

    this.postMaterials.set('pixelate', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: pixelateFrag,
      uniforms: {
        tDiffuse: { value: null },
        uWet: { value: 1 },
        uEnergy: { value: 0 },
        uResolution: { value: this.resolution },
      }
    }))

    this.postMaterials.set('mirror', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: mirrorFrag,
      uniforms: {
        tDiffuse: { value: null },
        uWet: { value: 1 },
      }
    }))

    this.postMaterials.set('invert', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: invertFrag,
      uniforms: {
        tDiffuse: { value: null },
        uWet: { value: 1 },
      }
    }))
  }

  // ---- Public API ----

  setEffect(id: EffectId) {
    if (this.usingCustom) {
      // leave custom-shader mode: rebuild the stock material even for the same id
      this.usingCustom = false
      this.startTransition(id)
      return
    }
    if (id === this.currentEffect && this.transitionProgress < 0) return

    // If beat-sync is on and no beat right now, queue the transition
    if (this.transitionBeatSync) {
      this.transitionPending = id
      this.transitionPendingSince = performance.now()
      return
    }

    this.startTransition(id)
  }

  private cancelCurrentTransition() {
    // Clean up any in-progress transition before starting a new one
    if (this.transitionOldMaterial) {
      this.transitionOldMaterial.dispose()
      this.transitionOldMaterial = null
    }
    this.transitionProgress = -1
    this.transitionPending = null
  }

  private startTransition(id: EffectId) {
    // Always cancel existing transition first
    this.cancelCurrentTransition()

    const fromEffect = this.currentEffect

    if (this.transitionDuration <= 0 || id === this.currentEffect) {
      // Instant switch
      this.currentEffect = id
      this.mainMaterial.dispose()
      this.mainMaterial = this.createEffectMaterial(id)
      this.quad.material = this.mainMaterial
      this.emitState()
      return
    }

    // Start transition: keep old material, create new
    this.transitionOldMaterial = this.mainMaterial
    this.mainMaterial = this.createEffectMaterial(id)
    this.quad.material = this.mainMaterial
    this.currentEffect = id
    this.transitionProgress = 0

    // Emit state with transition info for output window
    if (this.onStateChange) {
      this.onStateChange({
        ...this.stateSnapshot(),
        transition: {
          type: this.transitionType,
          duration: this.transitionDuration,
          fromEffect,
        },
      })
    }
  }

  // ---- Custom Shader API ----

  private lastShaderError: string | null = null
  getLastShaderError(): string | null { return this.lastShaderError }

  /**
   * Compile the material through three.js BEFORE swapping it in — three
   * compiles lazily at first render (with its own GLSL ES 3.0 prelude, so a
   * raw standalone compile is not representative), and a broken shader would
   * spam "useProgram: program not valid" every frame instead of failing here.
   * One throwaway render into a small RT + debug.onShaderError catches it.
   */
  private validateMaterial(mat: THREE.ShaderMaterial): string | null {
    let error: string | null = null
    const prevHandler = this.renderer.debug.onShaderError
    this.renderer.debug.onShaderError = (gl, _program, _vs, fs) => {
      error = (gl.getShaderInfoLog(fs) || 'unknown GLSL error').trim()
    }
    const prevMat = this.quad.material
    this.quad.material = mat
    try {
      this.renderer.setRenderTarget(this.rtBloomB)
      this.renderer.render(this.scene, this.camera)
    } catch (e: any) {
      error = error || e.message
    } finally {
      this.renderer.setRenderTarget(null)
      this.quad.material = prevMat
      this.renderer.debug.onShaderError = prevHandler
    }
    return error
  }

  /** Load a custom GLSL fragment shader as the active effect */
  setCustomShader(fragSource: string, params?: EffectParam[]): boolean {
    try {
      const defs = params ?? this.customParamDefs
      const uniforms: Record<string, THREE.IUniform> = {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uEnergy: { value: 0 },
        uBeat: { value: 0 },
        uBeatPhase: { value: 0 },
        uBarPhase: { value: 0 },
        uSub: { value: 0 },
        uPresence: { value: 0 },
        uBassHit: { value: 0 },
        uMidHit: { value: 0 },
        uHighHit: { value: 0 },
        uBassTime: { value: 0 },
        uHighTime: { value: 0 },
        uColor1: { value: this.colors[0] },
        uColor2: { value: this.colors[1] },
        uColor3: { value: this.colors[2] },
        uResolution: { value: this.resolution },
      }
      // Custom shader params (e.g. from ISF INPUTS) become uniforms driven per-frame
      for (const d of defs) uniforms[d.key] = { value: d.default }
      const mat = new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: fragSource,
        uniforms,
      })

      this.lastShaderError = this.validateMaterial(mat)
      if (this.lastShaderError) {
        console.error('[Engine] Custom shader rejected:', this.lastShaderError)
        mat.dispose()
        return false
      }

      // Cancel any in-progress transition
      this.cancelCurrentTransition()
      this.mainMaterial.dispose()
      this.mainMaterial = mat
      this.quad.material = this.mainMaterial
      this.customParamDefs = defs
      this.usingCustom = true
      this.customShaderSource = fragSource
      this.emitState()
      return true
    } catch (e) {
      console.error('[Engine] Custom shader compile error:', e)
      return false
    }
  }

  /** Send custom shader to output window via IPC */
  sendCustomShaderToOutput(fragSource: string) {
    try {
      window.api?.sendEngineState({ ...this.stateSnapshot(), customShader: fragSource, customParams: this.customParamDefs })
    } catch (_) {}
  }

  setTransitionType(type: TransitionType) { this.transitionType = type; this.emitState() }
  getTransitionType(): TransitionType { return this.transitionType }

  setTransitionDuration(seconds: number) { this.transitionDuration = Math.max(0, seconds); this.emitState() }
  getTransitionDuration(): number { return this.transitionDuration }

  setTransitionBeatSync(enabled: boolean) { this.transitionBeatSync = enabled; this.emitState() }
  isTransitionBeatSync(): boolean { return this.transitionBeatSync }

  isTransitioning(): boolean { return this.transitionProgress >= 0 }

  getActiveEffect(): EffectId {
    return this.currentEffect
  }

  togglePost(id: PostId) {
    const idx = this.postChain.findIndex(p => p.id === id)
    if (idx >= 0) this.postChain.splice(idx, 1)
    else this.postChain.push({ id, amount: 1 })
    this.emitState()
  }

  isPostActive(id: PostId): boolean {
    return this.postChain.some(p => p.id === id)
  }

  /** Replace the whole post-FX chain in one shot (order is preserved) */
  setActivePosts(ids: PostId[], amounts?: Partial<Record<PostId, number>>) {
    this.postChain = ids
      .filter(id => this.postMaterials.has(id))
      .map(id => ({ id, amount: amounts?.[id] ?? 1 }))
    this.emitState()
  }

  /** Wet/dry per post effect (0..1) */
  setPostAmount(id: PostId, amount: number) {
    const entry = this.postChain.find(p => p.id === id)
    if (!entry) return
    entry.amount = Math.max(0, Math.min(1, amount))
    this.emitState()
  }

  getPostAmount(id: PostId): number {
    return this.postChain.find(p => p.id === id)?.amount ?? 1
  }

  /** Move an effect up (-1) or down (+1) in the chain — order changes the look a lot */
  movePost(id: PostId, delta: number) {
    const idx = this.postChain.findIndex(p => p.id === id)
    const next = idx + delta
    if (idx < 0 || next < 0 || next >= this.postChain.length) return
    const [entry] = this.postChain.splice(idx, 1)
    this.postChain.splice(next, 0, entry)
    this.emitState()
  }

  getPostChain(): { id: PostId; amount: number }[] {
    return this.postChain.map(p => ({ ...p }))
  }

  // ---- Per-effect parameters ----

  /** Params of the ACTIVE effect: common engine params + curated/custom uniforms */
  getParamDefs(): EffectParam[] {
    return this.usingCustom
      ? [...COMMON_PARAMS, ...this.customParamDefs]
      : [...COMMON_PARAMS, ...(EFFECT_PARAMS[this.currentEffect] ?? [])]
  }

  isUsingCustomShader(): boolean { return this.usingCustom }

  private paramBucket(): Record<string, ParamState> {
    const key = this.usingCustom ? '__custom__' : this.currentEffect
    if (!this.paramState[key]) this.paramState[key] = {}
    return this.paramState[key]
  }

  getParamState(key: string): ParamState {
    const bucket = this.paramBucket()
    if (!bucket[key]) {
      const def = this.getParamDefs().find(d => d.key === key)
      bucket[key] = { value: def?.default ?? 0, source: 'none', depth: 0.5 }
    }
    return bucket[key]
  }

  setParamValue(key: string, value: number) {
    const def = this.getParamDefs().find(d => d.key === key)
    if (!def) return
    this.getParamState(key).value = Math.max(def.min, Math.min(def.max, value))
    this.emitState()
  }

  setParamMapping(key: string, source: AudioSource, depth: number, lfoRate?: number) {
    const st = this.getParamState(key)
    st.source = source
    st.depth = Math.max(-1, Math.min(1, depth))
    if (typeof lfoRate === 'number') st.lfoRate = Math.max(0.25, Math.min(64, lfoRate))
    this.emitState()
  }

  /** Live param value: slider base + audio/LFO modulation over the full range */
  private effParamValue(def: EffectParam): number {
    const st = this.paramBucket()[def.key]
    const base = st?.value ?? def.default
    if (!st || st.source === 'none' || st.depth === 0) return base

    let mod: number
    if (st.source.startsWith('lfo-')) {
      // Tempo-synced LFO: lfoRate beats per cycle, phase from the beat clock
      const phase = (this.beatClock / (st.lfoRate || 4)) % 1
      mod = st.source === 'lfo-sine' ? 0.5 + 0.5 * Math.sin(phase * Math.PI * 2)
          : st.source === 'lfo-saw' ? phase
          : phase < 0.5 ? 1 : 0 // lfo-square
    } else {
      const audio: Record<string, number> = {
        bass: this.smoothBass, mid: this.smoothMid, high: this.smoothHigh,
        energy: this.smoothEnergy, beat: this.beatPulse,
      }
      mod = audio[st.source] ?? 0
    }
    const v = base + mod * st.depth * (def.max - def.min)
    return Math.max(def.min, Math.min(def.max, v))
  }

  // ---- Deck B / crossfader ----

  setDeckBEffect(id: EffectId) {
    this.deckBEffect = id
    this.deckBMaterial?.dispose()
    this.deckBMaterial = this.createEffectMaterial(id)
    this.emitState()
  }
  getDeckBEffect(): EffectId { return this.deckBEffect }

  setCrossfade(v: number) {
    this.crossfade = Math.max(0, Math.min(1, v))
    if (this.crossfade > 0 && !this.deckBMaterial) {
      this.deckBMaterial = this.createEffectMaterial(this.deckBEffect)
    }
    this.emitState()
  }
  getCrossfade(): number { return this.crossfade }

  setBlendMode(mode: BlendMode) { this.blendMode = mode; this.emitState() }
  getBlendMode(): BlendMode { return this.blendMode }

  // ---- Master ----

  setBrightness(v: number) { this.brightness = Math.max(0, Math.min(1, v)); this.emitState() }
  getBrightness(): number { return this.brightness }

  setBlackout(on: boolean) { this.blackout = on; this.emitState() }
  isBlackout(): boolean { return this.blackout }

  setFreeze(on: boolean) {
    if (on && !this.frozen) this.freezeRequested = true
    this.frozen = on
    this.emitState()
  }
  isFrozen(): boolean { return this.frozen }

  setMotionBlur(v: number) { this.motionBlur = Math.max(0, Math.min(0.95, v)); this.emitState() }
  getMotionBlur(): number { return this.motionBlur }

  setGrade(grade: Partial<Grade>) {
    this.grade = { ...this.grade, ...grade }
    const u = this.masterMaterial.uniforms
    u.uContrast.value = this.grade.contrast
    u.uSaturation.value = this.grade.saturation
    u.uVignette.value = this.grade.vignette
    u.uLift.value = this.grade.lift
    this.renderer.toneMappingExposure = this.grade.exposure
    this.emitState()
  }
  getGrade(): Grade { return { ...this.grade } }

  /** Restore a saved settings snapshot (same shape as EngineState). */
  applySettings(state: Partial<EngineState>) {
    const duration = this.transitionDuration
    this.transitionDuration = 0 // switch instantly while restoring
    if (state.customShader) this.setCustomShader(state.customShader, state.customParams || [])
    else if (state.activeEffect) this.setEffect(state.activeEffect)
    if (state.activePost) this.setActivePosts(state.activePost, state.postAmounts)
    if (state.colors) {
      this.setColors(state.colors[0], state.colors[1], state.colors[2])
      // jump, don't lerp, on boot
      for (let i = 0; i < 3; i++) this.colors[i].copy(this.targetColors[i])
    }
    if (state.deckBEffect) this.setDeckBEffect(state.deckBEffect)
    if (typeof state.crossfade === 'number') this.setCrossfade(state.crossfade)
    if (state.blendMode) this.blendMode = state.blendMode
    if (typeof state.brightness === 'number') this.brightness = state.brightness
    if (typeof state.motionBlur === 'number') this.motionBlur = state.motionBlur
    if (state.grade) this.setGrade(state.grade)
    if (state.effectParams) this.paramState = state.effectParams
    if (state.transitionType) this.transitionType = state.transitionType
    if (typeof state.transitionBeatSync === 'boolean') this.transitionBeatSync = state.transitionBeatSync
    if (typeof state.colorSpeed === 'number') this.setColorTransitionSpeed(state.colorSpeed)
    if (state.cycle) {
      this.cyclePalettes = state.cycle.palettes || []
      this.cycleIntervalMs = state.cycle.intervalMs
      this.cycleBeatSync = state.cycle.beatSync
      this.cycleBeatsPerSwitch = state.cycle.beatsPerSwitch
      this.setCycleEnabled(state.cycle.enabled)
    }
    // blackout/frozen are deliberately NOT restored — booting into a black
    // screen looks like a crash
    this.transitionDuration = typeof state.transitionDuration === 'number'
      ? state.transitionDuration : duration
  }

  // ---- Remote (output window) API ----

  /** Feed audio received over IPC. Beats are latched so each one is consumed exactly once. */
  setAudioData(data: { bass: number; mid: number; high: number; energy: number; beatPulse: number; bpm: number; beatDetected: boolean; beatPhase?: number; barPhase?: number; sub?: number; presence?: number; bassHit?: number; midHit?: number; highHit?: number }) {
    this.smoothBass = data.bass || 0
    this.smoothMid = data.mid || 0
    this.smoothHigh = data.high || 0
    this.smoothEnergy = data.energy || 0
    this.smoothSub = data.sub || 0
    this.smoothPresence = data.presence || 0
    this.bassHit = data.bassHit || 0
    this.midHit = data.midHit || 0
    this.highHit = data.highHit || 0
    this.beatPulse = data.beatPulse || 0
    this.remoteBpm = data.bpm || 128
    this.beatPhase = data.beatPhase || 0
    this.barPhase = data.barPhase || 0
    if (data.beatDetected) this.pendingBeat = true
  }

  /** Apply engine state received over IPC (output window) */
  applyRemoteState(state: EngineState) {
    if (state.effectParams) this.paramState = state.effectParams
    if (state.customShader) {
      // Recompile only when the source actually changed — the shader now
      // rides every snapshot, and validation renders are not free
      if (!this.usingCustom || state.customShader !== this.customShaderSource) {
        this.setCustomShader(state.customShader, state.customParams || [])
      }
    } else {
      // Transition params always come from the control window
      if (state.transition) this.transitionType = state.transition.type
      this.transitionDuration = state.transition ? state.transition.duration : 0
      if (state.activeEffect) this.setEffect(state.activeEffect)
    }
    if (typeof state.colorSpeed === 'number') this.setColorTransitionSpeed(state.colorSpeed)
    if (state.activePost) this.setActivePosts(state.activePost, state.postAmounts)
    if (state.colors) this.setColors(state.colors[0], state.colors[1], state.colors[2])

    if (state.deckBEffect && state.deckBEffect !== this.deckBEffect) this.setDeckBEffect(state.deckBEffect)
    if (typeof state.crossfade === 'number') this.setCrossfade(state.crossfade)
    if (state.blendMode) this.blendMode = state.blendMode
    if (typeof state.brightness === 'number') this.brightness = state.brightness
    if (typeof state.blackout === 'boolean') this.blackout = state.blackout
    if (typeof state.motionBlur === 'number') this.motionBlur = state.motionBlur
    if (typeof state.frozen === 'boolean' && state.frozen !== this.frozen) this.setFreeze(state.frozen)
    if (state.grade) this.setGrade(state.grade)
  }

  setColors(c1: string, c2: string, c3: string) {
    this.targetColors[0].set(c1)
    this.targetColors[1].set(c2)
    this.targetColors[2].set(c3)
    this.emitState()
  }

  /** Set transition speed: 0 = instant, 1 = very slow */
  setColorTransitionSpeed(speed: number) {
    // speed 0..1 → lerpSpeed 1.0 (instant) .. 0.005 (~3s)
    this.colorLerpSpeed = speed <= 0 ? 1.0 : 0.005 + (1.0 - speed) * 0.995
  }

  getColorTransitionSpeed(): number {
    if (this.colorLerpSpeed >= 1.0) return 0
    return 1.0 - (this.colorLerpSpeed - 0.005) / 0.995
  }

  // ---- Palette Cycling ----

  setCycleEnabled(enabled: boolean) {
    this.cycleEnabled = enabled
    if (enabled) {
      this.cycleLastSwitch = performance.now()
      this.cycleBeatCount = 0
    }
  }

  isCycleEnabled(): boolean { return this.cycleEnabled }

  setCyclePalettes(palettes: [string, string, string][]) {
    this.cyclePalettes = palettes
    this.cycleIndex = 0
  }

  setCycleInterval(ms: number) {
    this.cycleIntervalMs = Math.max(1000, ms)
  }

  getCycleInterval(): number { return this.cycleIntervalMs }

  setCycleBeatSync(enabled: boolean) {
    this.cycleBeatSync = enabled
    this.cycleBeatCount = 0
  }

  isCycleBeatSync(): boolean { return this.cycleBeatSync }

  setCycleBeatsPerSwitch(beats: number) {
    this.cycleBeatsPerSwitch = Math.max(1, beats)
  }

  getCycleBeatsPerSwitch(): number { return this.cycleBeatsPerSwitch }

  private advanceCycle() {
    if (this.cyclePalettes.length < 2) return
    this.cycleIndex = (this.cycleIndex + 1) % this.cyclePalettes.length
    const next = this.cyclePalettes[this.cycleIndex]
    this.targetColors[0].set(next[0])
    this.targetColors[1].set(next[1])
    this.targetColors[2].set(next[2])
    this.cycleLastSwitch = performance.now()
    this.cycleBeatCount = 0
    this.emitState()
  }

  // ---- Overlay API ----

  async addOverlay(name: string, dataUrl: string, existingId?: string): Promise<OverlayItem> {
    const id = existingId || `overlay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const isGif = dataUrl.includes('image/gif')

    const canvas = document.createElement('canvas')
    let texture: THREE.CanvasTexture
    let gifFrames: GifFrame[] | undefined

    if (isGif) {
      const decoder = new GifDecoder()
      await decoder.decode(dataUrl)
      gifFrames = decoder.frames
      canvas.width = decoder.width
      canvas.height = decoder.height

      // Draw first frame
      if (gifFrames.length > 0) {
        const ctx = canvas.getContext('2d')!
        ctx.putImageData(gifFrames[0].imageData, 0, 0)
      }

      texture = new THREE.CanvasTexture(canvas)
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
    } else {
      const img = new Image()
      img.src = dataUrl
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('immagine non valida: ' + name))
      })
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      texture = new THREE.CanvasTexture(canvas)
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
    }

    const overlay: OverlayItem = {
      id,
      name,
      dataUrl,
      opacity: 1.0,
      scale: 0.3,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      gifSync: 'beat',
      displace: 0,
      _texture: texture,
      _canvas: canvas,
      _isGif: isGif,
      _gifFrames: gifFrames,
      _gifFrameIndex: 0,
      _gifLastAdvance: performance.now(),
    }

    this.overlays.push(overlay)

    // Sync to output window
    if (!this.remote) {
      try {
        window.api?.sendOverlayAdd({
          id, name, dataUrl, opacity: overlay.opacity,
          scale: overlay.scale, offsetX: overlay.offsetX, offsetY: overlay.offsetY,
          visible: overlay.visible, gifSync: overlay.gifSync, displace: overlay.displace,
        })
      } catch (_) {}
    }

    return overlay
  }

  /**
   * Add a video file or webcam as an overlay layer. Both windows create their
   * own element from the same source descriptor — no giant blobs over IPC.
   */
  async addVideoOverlay(
    name: string,
    source: { kind: 'video'; path: string } | { kind: 'webcam'; deviceId?: string },
    existingId?: string
  ): Promise<OverlayItem> {
    const id = existingId || `overlay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.loop = true

    if (source.kind === 'webcam') {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: source.deviceId ? { deviceId: { exact: source.deviceId } } : true,
        audio: false,
      })
      video.srcObject = stream
    } else {
      const bytes: ArrayBuffer = await window.api.readFile(source.path)
      const blob = new Blob([bytes])
      video.src = URL.createObjectURL(blob)
    }

    await video.play().catch(err => console.error('[Engine] video play failed:', err))

    const texture = new THREE.VideoTexture(video)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    const overlay: OverlayItem = {
      id, name, dataUrl: '',
      opacity: 1.0, scale: 1.0, offsetX: 0, offsetY: 0,
      visible: true, gifSync: 'free', displace: 0,
      source,
      _texture: texture,
      _isVideo: true,
      _video: video,
    }
    this.overlays.push(overlay)

    if (!this.remote) {
      try {
        window.api?.sendOverlayAdd({
          id, name, dataUrl: '', opacity: overlay.opacity, scale: overlay.scale,
          offsetX: overlay.offsetX, offsetY: overlay.offsetY, visible: overlay.visible,
          gifSync: overlay.gifSync, displace: overlay.displace, source,
        })
      } catch (_) {}
    }

    return overlay
  }

  /** Full media teardown — leaked webcam tracks keep the camera hot all night */
  private teardownOverlay(overlay: OverlayItem) {
    const video = overlay._video
    if (video) {
      video.pause()
      const stream = video.srcObject as MediaStream | null
      stream?.getTracks().forEach(t => t.stop())
      video.srcObject = null
      if (video.src.startsWith('blob:')) URL.revokeObjectURL(video.src)
      video.removeAttribute('src')
    }
    overlay._texture?.dispose()
  }

  removeOverlay(id: string) {
    const idx = this.overlays.findIndex(o => o.id === id)
    if (idx >= 0) {
      this.teardownOverlay(this.overlays[idx])
      this.overlays.splice(idx, 1)
      if (!this.remote) { try { window.api?.sendOverlayRemove(id) } catch (_) {} }
    }
  }

  getOverlays(): OverlayItem[] {
    return this.overlays
  }

  updateOverlay(id: string, updates: Partial<Pick<OverlayItem, 'opacity' | 'scale' | 'offsetX' | 'offsetY' | 'visible' | 'gifSync' | 'displace'>>) {
    const overlay = this.overlays.find(o => o.id === id)
    if (overlay) {
      Object.assign(overlay, updates)
      if (!this.remote) { try { window.api?.sendOverlayUpdate(id, updates) } catch (_) {} }
    }
  }

  // Legacy API for EffectPanel
  addEffect(id: string) {
    if (id in EFFECT_SHADERS) {
      this.setEffect(id as EffectId)
    } else if (this.postMaterials.has(id as PostId) && !this.isPostActive(id as PostId)) {
      this.togglePost(id as PostId)
    }
  }

  removeEffect(id: string) {
    if (this.isPostActive(id as PostId)) this.togglePost(id as PostId)
  }

  // ---- Preset & Playlist API ----

  createPreset(name: string): Preset {
    const amounts: Partial<Record<PostId, number>> = {}
    for (const p of this.postChain) amounts[p.id] = p.amount
    return {
      name,
      effect: this.currentEffect,
      post: this.postChain.map(p => p.id),
      postAmounts: amounts,
      colors: [
        '#' + this.colors[0].getHexString(),
        '#' + this.colors[1].getHexString(),
        '#' + this.colors[2].getHexString(),
      ],
      grade: { ...this.grade },
      motionBlur: this.motionBlur,
      deckBEffect: this.deckBEffect,
      crossfade: this.crossfade,
      blendMode: this.blendMode,
      effectParams: JSON.parse(JSON.stringify(this.paramState)),
      customShader: this.usingCustom ? this.customShaderSource : undefined,
      customParams: this.usingCustom ? this.customParamDefs : undefined,
    }
  }

  applyPreset(preset: Preset) {
    // Batch: update post and colors without emitting state individually
    this.postChain = preset.post
      .filter(p => this.postMaterials.has(p))
      .map(p => ({ id: p, amount: preset.postAmounts?.[p] ?? 1 }))
    this.targetColors[0].set(preset.colors[0])
    this.targetColors[1].set(preset.colors[1])
    this.targetColors[2].set(preset.colors[2])

    if (preset.grade) this.setGrade(preset.grade)
    if (typeof preset.motionBlur === 'number') this.motionBlur = preset.motionBlur
    if (preset.deckBEffect && preset.deckBEffect !== this.deckBEffect) this.setDeckBEffect(preset.deckBEffect)
    if (typeof preset.crossfade === 'number') this.setCrossfade(preset.crossfade)
    if (preset.blendMode) this.blendMode = preset.blendMode
    if (preset.effectParams) this.paramState = JSON.parse(JSON.stringify(preset.effectParams))

    if (preset.customShader) {
      if (!this.usingCustom || preset.customShader !== this.customShaderSource) {
        this.setCustomShader(preset.customShader, preset.customParams || [])
      } else {
        this.emitState()
      }
      return
    }

    // setEffect handles its own emitState (with transition info)
    // If same effect, just emit state for the post/color changes
    // (unless a custom shader is active — setEffect must exit custom mode)
    if (!this.usingCustom && preset.effect === this.currentEffect && this.transitionProgress < 0) {
      this.emitState()
    } else {
      this.setEffect(preset.effect)
    }
  }

  getCurrentEffect(): EffectId { return this.currentEffect }
  getActivePosts(): PostId[] { return this.postChain.map(p => p.id) }
  getCurrentColors(): [string, string, string] {
    return [
      '#' + this.colors[0].getHexString(),
      '#' + this.colors[1].getHexString(),
      '#' + this.colors[2].getHexString(),
    ]
  }

  /** Full state for the output window — one place, so nothing drifts out of sync */
  private stateSnapshot(): EngineState {
    const amounts: Partial<Record<PostId, number>> = {}
    for (const p of this.postChain) amounts[p.id] = p.amount
    return {
      activeEffect: this.currentEffect,
      activePost: this.postChain.map(p => p.id),
      postAmounts: amounts,
      colors: this.getCurrentColors(),
      beatPulse: this.beatPulse,
      energy: this.smoothEnergy,
      bpm: this.audioAnalyzer.getData().bpm,
      deckBEffect: this.deckBEffect,
      crossfade: this.crossfade,
      blendMode: this.blendMode,
      brightness: this.brightness,
      blackout: this.blackout,
      frozen: this.frozen,
      motionBlur: this.motionBlur,
      grade: { ...this.grade },
      effectParams: this.paramState,
      paramDefs: this.getParamDefs(),
      // Custom shader must ride the snapshot: any emit without it used to
      // revert the output window to the stock effect (show-breaking)
      customShader: this.usingCustom ? this.customShaderSource : undefined,
      customParams: this.usingCustom ? this.customParamDefs : undefined,
      transitionType: this.transitionType,
      transitionDuration: this.transitionDuration,
      transitionBeatSync: this.transitionBeatSync,
      colorSpeed: this.getColorTransitionSpeed(),
      cycle: {
        enabled: this.cycleEnabled,
        palettes: this.cyclePalettes,
        intervalMs: this.cycleIntervalMs,
        beatSync: this.cycleBeatSync,
        beatsPerSwitch: this.cycleBeatsPerSwitch,
      },
    }
  }

  private emitState() {
    if (this.remote) return
    const snap = this.stateSnapshot()
    this.onStateChange?.(snap)
    for (const fn of this.stateListeners) {
      try { fn(snap) } catch (e) { console.error('[Engine] state listener error:', e) }
    }
  }

  start() {
    this.clock.start()
    this.lastFrameTime = 0
    this.loop()
  }

  private loop = () => {
    if (this.disposed) return
    // One bad frame (a broken GIF, a listener throw) must never kill the rAF
    // chain — a frozen projector mid-set is the worst possible failure mode
    try {
      this.renderFrame()
    } catch (e) {
      console.error('[Engine] frame error:', e)
    } finally {
      this.animFrameId = requestAnimationFrame(this.loop)
    }
  }

  private renderFrame() {
    const time = this.clock.getElapsedTime()
    // Frame delta from elapsed time — clock.getDelta() is consumed by getElapsedTime()
    const dt = Math.min(time - this.lastFrameTime, 0.25)
    this.lastFrameTime = time

    let beatDetected: boolean
    let bpm: number

    if (this.remote) {
      // Audio pushed over IPC; latched beat is consumed once
      beatDetected = this.pendingBeat
      this.pendingBeat = false
      bpm = this.remoteBpm
    } else {
      const audio = this.audioAnalyzer.update()
      beatDetected = audio.beatDetected
      bpm = audio.bpm
      this.beatPhase = audio.beatPhase
      this.barPhase = audio.barPhase

      // Envelope follower: fast attack, slow release. Transients stay punchy,
      // decays stay smooth — symmetric smoothing kills both.
      const ATTACK = 0.55
      const RELEASE = 0.09
      const env = (current: number, target: number) =>
        current + (target - current) * (target > current ? ATTACK : RELEASE)
      this.smoothBass = env(this.smoothBass, audio.bass)
      this.smoothMid = env(this.smoothMid, audio.mid)
      this.smoothHigh = env(this.smoothHigh, audio.high)
      this.smoothEnergy = env(this.smoothEnergy, audio.energy)
      this.smoothSub = env(this.smoothSub, audio.sub)
      this.smoothPresence = env(this.smoothPresence, audio.presence)
      this.bassHit = audio.bassHit
      this.midHit = audio.midHit
      this.highHit = audio.highHit

      // Beat pulse with decay
      if (beatDetected) this.beatPulse = 1.0
      this.beatPulse *= 0.88
    }

    // Gated clocks: advance only while the band is actually playing, so a
    // breakdown freezes bass-driven motion and the drop restarts it
    this.bassTime += dt * this.smoothBass
    this.highTime += dt * this.smoothHigh
    // Beat clock for tempo-synced LFOs (works in remote mode too — bpm over IPC)
    this.beatClock += dt * ((bpm || 128) / 60)

    // Per-frame audio listeners (AutoVJ, playlist beat-advance)
    for (const fn of this.audioFrameListeners) {
      fn(beatDetected, this.smoothEnergy, this.smoothBass, this.barPhase)
    }

    // Beat-synced transition: trigger pending effect change on beat — or
    // after 2s without one (dead audio must not swallow effect switches)
    if (this.transitionPending &&
        (beatDetected || performance.now() - this.transitionPendingSince > 2000)) {
      const pending = this.transitionPending
      this.transitionPending = null
      this.startTransition(pending)
    }

    // Palette cycling
    if (this.cycleEnabled && this.cyclePalettes.length >= 2) {
      if (this.cycleBeatSync) {
        if (beatDetected) {
          this.cycleBeatCount++
          if (this.cycleBeatCount >= this.cycleBeatsPerSwitch) {
            this.advanceCycle()
          }
        }
      } else {
        const now = performance.now()
        if (now - this.cycleLastSwitch >= this.cycleIntervalMs) {
          this.advanceCycle()
        }
      }
    }

    // Smooth color transitions (lerp current → target)
    for (let i = 0; i < 3; i++) {
      this.colors[i].lerp(this.targetColors[i], this.colorLerpSpeed)
    }

    // Per-effect params: speed drives the effect clock, reactivity scales the
    // audio uniforms, everything else lands on same-named material uniforms
    let speed = 1
    this.audioScale = 1
    for (const def of this.getParamDefs()) {
      const v = this.effParamValue(def)
      if (def.key === 'speed') speed = v
      else if (def.key === 'reactivity') this.audioScale = v
      else {
        const u = this.mainMaterial.uniforms[def.key]
        if (u) u.value = v
      }
    }
    this.effectTime += dt * speed

    // Update main effect uniforms
    this.applyEffectUniforms(this.mainMaterial, time)

    // Frozen: keep showing the captured frame, skip the whole pipeline
    if (this.frozen && !this.freezeRequested) {
      this.renderMaster(this.rtFreeze.texture)
      this.syncAudioToOutput(bpm, beatDetected)
      return
    }

    // Render deck A → rtA
    this.renderer.setRenderTarget(this.rtA)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    // Effect transition blending
    if (this.transitionProgress >= 0 && this.transitionOldMaterial) {
      this.transitionProgress += dt / Math.max(this.transitionDuration, 0.01)

      if (this.transitionProgress >= 1) {
        // Transition complete
        this.transitionOldMaterial.dispose()
        this.transitionOldMaterial = null
        this.transitionProgress = -1
      } else {
        // Render old effect → rtTransition
        this.quad.material = this.transitionOldMaterial
        this.applyEffectUniforms(this.transitionOldMaterial, time)
        this.renderer.setRenderTarget(this.rtTransition)
        this.renderer.clear()
        this.renderer.render(this.scene, this.camera)

        // Restore new material
        this.quad.material = this.mainMaterial

        // Blend old + new → rtB, then copy back to rtA
        const tu = this.transitionMaterial.uniforms
        tu.tOld.value = this.rtTransition.texture
        tu.tNew.value = this.rtA.texture
        tu.uProgress.value = this.transitionProgress
        tu.uType.value = TRANSITION_TYPE_INDEX[this.transitionType]
        this.renderPass(this.transitionMaterial, this.rtB)
        this.blit(this.rtB.texture, this.rtA)
      }
    }

    // Deck B + crossfader
    if (this.crossfade > 0.001 && this.deckBMaterial) {
      this.quad.material = this.deckBMaterial
      this.applyEffectUniforms(this.deckBMaterial, time)
      this.renderer.setRenderTarget(this.rtDeckB)
      this.renderer.clear()
      this.renderer.render(this.scene, this.camera)
      this.quad.material = this.mainMaterial

      const du = this.deckMixMaterial.uniforms
      du.tDeckA.value = this.rtA.texture
      du.tDeckB.value = this.rtDeckB.texture
      du.uMix.value = this.crossfade
      du.uBlend.value = BLEND_MODES.indexOf(this.blendMode)
      this.renderPass(this.deckMixMaterial, this.rtB)
      this.blit(this.rtB.texture, this.rtA)
    }

    // Render overlays on top of the mixed image
    let hasVisibleOverlays = false
    for (const o of this.overlays) { if (o.visible && o._texture) { hasVisibleOverlays = true; break } }
    if (hasVisibleOverlays) {
      let src = this.rtA
      let dst = this.rtB
      for (const overlay of this.overlays) {
        if (!overlay.visible || !overlay._texture) continue
        // Advance GIF frames based on sync mode
        if (overlay._isGif && overlay._gifFrames && overlay._gifFrames.length > 1 && overlay._canvas) {
          const now = performance.now()
          let advance = false

          if (overlay.gifSync === 'beat') {
            if (beatDetected) advance = true
          } else if (overlay.gifSync === 'bpm') {
            const beatInterval = 60000 / (bpm || 128)
            if (now - (overlay._gifLastAdvance || 0) >= beatInterval) advance = true
          } else {
            const currentFrame = overlay._gifFrames[overlay._gifFrameIndex || 0]
            if (now - (overlay._gifLastAdvance || 0) >= currentFrame.delay) advance = true
          }

          if (advance) {
            overlay._gifFrameIndex = ((overlay._gifFrameIndex || 0) + 1) % overlay._gifFrames.length
            overlay._gifLastAdvance = now
            const ctx2d = overlay._canvas.getContext('2d')!
            ctx2d.putImageData(overlay._gifFrames[overlay._gifFrameIndex].imageData, 0, 0)
            overlay._texture!.needsUpdate = true
          }
        }

        const ou = this.overlayMaterial.uniforms
        ou.tDiffuse.value = src.texture
        ou.tOverlay.value = overlay._texture
        ou.uOpacity.value = overlay.opacity
        ou.uOverlayScale.value.set(overlay.scale, overlay.scale)
        ou.uOverlayOffset.value.set(overlay.offsetX, overlay.offsetY)
        ou.uDisplace.value = overlay.displace || 0

        this.renderPass(this.overlayMaterial, dst)

        // Swap
        const tmp = src; src = dst; dst = tmp
      }
      if (src !== this.rtA) this.blit(src.texture, this.rtA)
    }

    // Post-processing chain — ordered, each with its own wet/dry
    let read = this.rtA
    let write = this.rtB

    for (const entry of this.postChain) {
      const mat = this.postMaterials.get(entry.id)
      if (!mat) continue

      if (entry.id === 'bloom') {
        this.renderBloom(read, write, entry.amount)
      } else {
        const pu = mat.uniforms
        pu.tDiffuse.value = read.texture
        if (pu.uWet) pu.uWet.value = entry.amount
        if (pu.uBass) pu.uBass.value = this.smoothBass
        if (pu.uMid) pu.uMid.value = this.smoothMid
        if (pu.uHigh) pu.uHigh.value = this.smoothHigh
        if (pu.uEnergy) pu.uEnergy.value = this.smoothEnergy
        if (pu.uBeat) pu.uBeat.value = this.beatPulse
        if (pu.uTime) pu.uTime.value = time
        this.renderPass(mat, write)
      }

      const tmp = read; read = write; write = tmp
    }

    // Feedback needs the frame it just produced as next frame's history
    if (this.isPostActive('feedback')) {
      const feedbackMat = this.postMaterials.get('feedback')!
      feedbackMat.uniforms.tPrevFrame.value = this.rtPrev.texture
      this.blit(read.texture, this.rtPrev)
    }

    // Temporal motion blur (ping-pong accumulation)
    let finalTexture = read.texture
    if (this.motionBlur > 0.01) {
      const mu = this.motionBlurMaterial.uniforms
      mu.tDiffuse.value = finalTexture
      mu.tPrev.value = this.rtAccum.texture
      mu.uAmount.value = this.motionBlur
      this.renderPass(this.motionBlurMaterial, this.rtAccum2)
      const tmp = this.rtAccum; this.rtAccum = this.rtAccum2; this.rtAccum2 = tmp
      finalTexture = this.rtAccum.texture
    }

    // Capture the frame the moment freeze is armed
    if (this.freezeRequested) {
      this.blit(finalTexture, this.rtFreeze)
      this.freezeRequested = false
      finalTexture = this.rtFreeze.texture
    }

    // Master stage: grade + brightness → screen
    this.renderMaster(finalTexture)

    this.syncAudioToOutput(bpm, beatDetected)
  }

  /** Feed the shared per-frame uniforms into an effect material */
  private applyEffectUniforms(mat: THREE.ShaderMaterial, _time: number) {
    const u = mat.uniforms
    const k = this.audioScale
    if (u.uTime) u.uTime.value = this.effectTime
    if (u.uBass) u.uBass.value = this.smoothBass * k
    if (u.uMid) u.uMid.value = this.smoothMid * k
    if (u.uHigh) u.uHigh.value = this.smoothHigh * k
    if (u.uEnergy) u.uEnergy.value = this.smoothEnergy * k
    if (u.uBeat) u.uBeat.value = this.beatPulse * k
    if (u.uBeatPhase) u.uBeatPhase.value = this.beatPhase
    if (u.uBarPhase) u.uBarPhase.value = this.barPhase
    if (u.uSub) u.uSub.value = this.smoothSub * k
    if (u.uPresence) u.uPresence.value = this.smoothPresence * k
    if (u.uBassHit) u.uBassHit.value = this.bassHit * k
    if (u.uMidHit) u.uMidHit.value = this.midHit * k
    if (u.uHighHit) u.uHighHit.value = this.highHit * k
    if (u.uBassTime) u.uBassTime.value = this.bassTime
    if (u.uHighTime) u.uHighTime.value = this.highTime
    if (u.uResolution) u.uResolution.value = this.resolution
  }

  /** Render a fullscreen material into a target (null = screen) */
  private renderPass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.postQuad.material = mat
    this.renderer.setRenderTarget(target)
    this.renderer.clear()
    this.renderer.render(this.postScene, this.camera)
  }

  private blit(texture: THREE.Texture, target: THREE.WebGLRenderTarget | null) {
    this.passthroughMaterial.uniforms.tDiffuse.value = texture
    this.renderPass(this.passthroughMaterial, target)
  }

  /** Threshold prefilter → separable blur at half res → composite */
  private renderBloom(read: THREE.WebGLRenderTarget, write: THREE.WebGLRenderTarget, amount: number) {
    this.bloomPrefilterMaterial.uniforms.tDiffuse.value = read.texture
    this.renderPass(this.bloomPrefilterMaterial, this.rtBloomA)

    const bu = this.blurMaterial.uniforms
    bu.tDiffuse.value = this.rtBloomA.texture
    bu.uDirection.value.set(1, 0)
    this.renderPass(this.blurMaterial, this.rtBloomB)

    bu.tDiffuse.value = this.rtBloomB.texture
    bu.uDirection.value.set(0, 1)
    this.renderPass(this.blurMaterial, this.rtBloomA)

    const cu = this.postMaterials.get('bloom')!.uniforms
    cu.tDiffuse.value = read.texture
    cu.tBloom.value = this.rtBloomA.texture
    cu.uEnergy.value = this.smoothEnergy
    cu.uWet.value = amount
    this.renderPass(this.postMaterials.get('bloom')!, write)
  }

  private renderMaster(texture: THREE.Texture) {
    const mu = this.masterMaterial.uniforms
    mu.tDiffuse.value = texture
    mu.uBrightness.value = this.blackout ? 0 : this.brightness
    this.renderPass(this.masterMaterial, null)
    this.renderer.setRenderTarget(null)

    // Screenshot must read the buffer in the same task as the render
    if (this.screenshotCb) {
      const cb = this.screenshotCb
      this.screenshotCb = null
      this.canvas.toBlob(b => cb(b), 'image/png')
    }
  }

  private screenshotCb: ((blob: Blob | null) => void) | null = null

  /** Capture the next rendered frame as a PNG blob */
  screenshot(): Promise<Blob | null> {
    return new Promise(resolve => { this.screenshotCb = resolve })
  }

  /** Throttled audio push to the output window (~30Hz, plus every beat) */
  private syncAudioToOutput(bpm: number, beatDetected: boolean) {
    if (this.remote) return
    const now = performance.now()
    if (now - this.lastIpcTime < 33 && !beatDetected) return
    this.lastIpcTime = now
    try {
      window.api?.sendAudioData({
        bass: this.smoothBass,
        mid: this.smoothMid,
        high: this.smoothHigh,
        energy: this.smoothEnergy,
        sub: this.smoothSub,
        presence: this.smoothPresence,
        bassHit: this.bassHit,
        midHit: this.midHit,
        highHit: this.highHit,
        beatPulse: this.beatPulse,
        beatPhase: this.beatPhase,
        barPhase: this.barPhase,
        bpm,
        beatDetected,
      })
    } catch (_) {}
  }

  dispose() {
    this.disposed = true
    this.audioFrameListeners.clear()
    cancelAnimationFrame(this.animFrameId)
    window.removeEventListener('resize', this.handleResize)
    this.renderer.dispose()
    this.rtA.dispose()
    this.rtB.dispose()
    this.rtPrev.dispose()
    this.rtTransition.dispose()
    this.mainMaterial.dispose()
    this.passthroughMaterial.dispose()
    this.transitionMaterial.dispose()
    this.transitionOldMaterial?.dispose()
    this.overlayMaterial.dispose()
    this.overlays.forEach(o => this.teardownOverlay(o))
    this.overlays = []
    this.postMaterials.forEach(m => m.dispose())
    for (const rt of [this.rtDeckB, this.rtFreeze, this.rtAccum, this.rtAccum2, this.rtBloomA, this.rtBloomB]) rt.dispose()
    this.deckBMaterial?.dispose()
    this.deckMixMaterial.dispose()
    this.masterMaterial.dispose()
    this.motionBlurMaterial.dispose()
    this.bloomPrefilterMaterial.dispose()
    this.blurMaterial.dispose()
  }
}
