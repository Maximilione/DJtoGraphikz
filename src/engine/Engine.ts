import * as THREE from 'three'
import type { Key } from './audio/KeyDetector'
import { AudioAnalyzer } from './audio/AudioAnalyzer'
import { TrackChangeDetector, type TrackChangeEvent } from './audio/TrackChange'
import type { Phase } from './AutoVJ'
import { COMMON_PARAMS, EFFECT_PARAMS, type EffectParam, type ParamState, type AudioSource, intensityValue, intensityWet } from './EffectParams'
import { recommendedFor } from './recommendedMappings'
import { GifDecoder, GifFrame } from './GifDecoder'
import { splitCustomPasses } from './customPasses'
import { type VideoDeck, VIDEO_DECK_DEFAULT, playbackRate, barWrapped, onBar, clipTime, loopDrift, clampClip } from './videoDeck'

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
import lasersFrag from './shaders/lasers.frag?raw'
import strobegridFrag from './shaders/strobegrid.frag?raw'
import vortexFrag from './shaders/vortex.frag?raw'
import terrainFrag from './shaders/terrain.frag?raw'
import orbitsFrag from './shaders/orbits.frag?raw'
import shatterFrag from './shaders/shatter.frag?raw'
import moireFrag from './shaders/moire.frag?raw'
import pulsecityFrag from './shaders/pulsecity.frag?raw'
import neonpolyFrag from './shaders/neonpoly.frag?raw'
import inkflowFrag from './shaders/inkflow.frag?raw'
import raymarchFrag from './shaders/raymarch.frag?raw'
import ripplesFrag from './shaders/ripples.frag?raw'
import ps2towersFrag from './shaders/ps2towers.frag?raw'
import snowrideFrag from './shaders/snowride.frag?raw'
import pulsarFrag from './shaders/pulsar.frag?raw'
import reactionFrag from './shaders/reaction.frag?raw'
import reactionSimFrag from './shaders/reaction.sim.frag?raw'
import swarmSimFrag from './shaders/swarm.sim.frag?raw'
import swarmVert from './shaders/swarm.vert?raw'
import swarmFrag from './shaders/swarm.frag?raw'
import spectrumFrag from './shaders/spectrum.frag?raw'
import truchetFrag from './shaders/truchet.frag?raw'
import causticsFrag from './shaders/caustics.frag?raw'
import quasicrystalFrag from './shaders/quasicrystal.frag?raw'
import gyroidFrag from './shaders/gyroid.frag?raw'
import stringartFrag from './shaders/stringart.frag?raw'
import asciiFrag from './shaders/ascii.frag?raw'
import smokeFrag from './shaders/smoke.frag?raw'
import smokeSimFrag from './shaders/smoke.sim.frag?raw'
import flashFrag from './shaders/flash.frag?raw'
import halftoneFrag from './shaders/halftone.frag?raw'
import spiralFrag from './shaders/spiral.frag?raw'
import warehouseFrag from './shaders/warehouse.frag?raw'
import impactFrag from './shaders/impact.frag?raw'
import barcodeFrag from './shaders/barcode.frag?raw'
import staticFrag from './shaders/static.frag?raw'
import cageFrag from './shaders/cage.frag?raw'
import downpourFrag from './shaders/downpour.frag?raw'
import cracksFrag from './shaders/cracks.frag?raw'
import tribalFrag from './shaders/tribal.frag?raw'
import chevronsFrag from './shaders/chevrons.frag?raw'
import eclipseFrag from './shaders/eclipse.frag?raw'
import blindsFrag from './shaders/blinds.frag?raw'
import bounceballFrag from './shaders/bounceball.frag?raw'
import pumpFrag from './shaders/pump.frag?raw'
import rollFrag from './shaders/roll.frag?raw'
import spaceghostFrag from './shaders/spaceghost.frag?raw'
import rgbsplitFrag from './shaders/rgbsplit.frag?raw'
import bloomFrag from './shaders/bloom.frag?raw'
import feedbackFrag from './shaders/feedback.frag?raw'
import rgbdelayFrag from './shaders/rgbdelay.frag?raw'
import chromaticFrag from './shaders/chromatic.frag?raw'
import filmgrainFrag from './shaders/filmgrain.frag?raw'
import scanlinesFrag from './shaders/scanlines.frag?raw'
import pixelateFrag from './shaders/pixelate.frag?raw'
import mirrorFrag from './shaders/mirror.frag?raw'
import invertFrag from './shaders/invert.frag?raw'
import displaceFrag from './shaders/displace.frag?raw'
import frameglitchFrag from './shaders/frameglitch.frag?raw'
import outlineFrag from './shaders/outline.frag?raw'
import transitionFrag from './shaders/transition.frag?raw'
import overlayFrag from './shaders/overlay.frag?raw'
import bloomPrefilterFrag from './shaders/bloomPrefilter.frag?raw'
import blurFrag from './shaders/blur.frag?raw'
import masterFrag from './shaders/master.frag?raw'
import deckmixFrag from './shaders/deckmix.frag?raw'
import motionblurFrag from './shaders/motionblur.frag?raw'
import cameraFrag from './shaders/camera.frag?raw'

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

/**
 * The master camera: zoom, rotation, pan, mirrored tiling and a push-in on the
 * kick, applied to the whole scene before anything else samples it.
 *
 * It resamples what the effect drew instead of asking the effect to move, so
 * one set of controls acts on all 46 built-in effects and every imported ISF
 * at once — none of which know it exists. `CAMERA_NEUTRAL` is the identity,
 * and the pass is skipped entirely when the camera is sitting on it.
 */
export interface CameraState {
  zoom: number
  /** degrees, because that is what the UI shows and what a preset should read like */
  rotation: number
  panX: number
  panY: number
  /** 1 = off; 2 and up mirror-tile the frame that many times across */
  tile: number
  /** how far a kick pushes the camera in, 0 = never */
  push: number
}

export const CAMERA_NEUTRAL: CameraState = {
  zoom: 1, rotation: 0, panX: 0, panY: 0, tile: 1, push: 0,
}

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
  /** Set for video/webcam/text overlays so the output window can recreate them */
  source?:
    | { kind: 'video'; path: string }
    | { kind: 'webcam'; deviceId?: string }
    | { kind: 'text'; text: string; font?: string; color?: string; size?: number }
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
  | 'lasers' | 'strobegrid' | 'vortex' | 'terrain' | 'orbits' | 'shatter'
  | 'moire' | 'pulsecity' | 'neonpoly' | 'inkflow' | 'raymarch' | 'ripples'
  | 'ps2towers' | 'snowride' | 'pulsar' | 'reaction' | 'swarm'
  | 'spectrum' | 'truchet' | 'caustics' | 'quasicrystal' | 'gyroid'
  | 'stringart' | 'ascii' | 'smoke'
  | 'flash' | 'halftone' | 'spiral' | 'warehouse' | 'impact' | 'barcode'
  | 'static' | 'cage' | 'downpour' | 'cracks' | 'tribal'
  | 'chevrons' | 'eclipse' | 'blinds'
  | 'bounceball' | 'pump' | 'roll'
  | 'spaceghost'
export type PostId = 'bloom' | 'rgb-split' | 'chromatic' | 'feedback' | 'filmgrain' | 'scanlines' | 'pixelate' | 'mirror' | 'invert'
  | 'rgb-delay' | 'displace' | 'frame-glitch' | 'outline'

export type TransitionType = 'crossfade' | 'wipe-left' | 'wipe-down' | 'radial' | 'dissolve'
const TRANSITION_TYPE_INDEX: Record<TransitionType, number> = {
  'crossfade': 0, 'wipe-left': 1, 'wipe-down': 2, 'radial': 3, 'dissolve': 4,
}

export type BlendMode = 'mix' | 'add' | 'screen' | 'multiply' | 'difference'
  | 'split-v' | 'split-h' | 'radial' | 'luma' | 'audio'
/** Five blends, then the masks: with a mask the crossfader is the edge position. */
export const BLEND_MODES: BlendMode[] = ['mix', 'add', 'screen', 'multiply', 'difference',
  'split-v', 'split-h', 'radial', 'luma', 'audio']
const MASK_FIRST = BLEND_MODES.indexOf('split-v')

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
  customImageInputs?: string[]
  customImages?: Record<string, string>
  effectParams?: Record<string, Record<string, ParamState>>
  /** Param defs of the ACTIVE effect — read-only, for remote UIs */
  paramDefs?: EffectParam[]
  // Transition + palette-cycling preferences (persisted, synced to remote UIs)
  transitionType?: TransitionType
  transitionDuration?: number
  transitionBeatSync?: boolean
  colorSpeed?: number
  /** Intensity macro, 0..1 — resolved per-frame, so it has to reach the projector. */
  intensity?: number
  /** Master camera. The projector applies it itself, on its own resolution. */
  camera?: CameraState
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
  /** Mask edge softness 0..1 (only matters for the mask blend modes) */
  maskSoft?: number
  /** Deck B as a video playlist (Q4): the output mirrors clip + clipStartBeat */
  videoDeck?: VideoDeck
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
  /** Mask edge softness 0..1 (only matters for the mask blend modes) */
  maskSoft?: number
  /** Per-effect param values + audio mappings — a look isn't a look without them */
  effectParams?: Record<string, Record<string, ParamState>>
  customShader?: string
  customParams?: EffectParam[]
}

/**
 * An effect is normally one fullscreen fragment pass. A multi-pass effect adds
 * simulation passes that run first, each writing into its own persistent
 * ping-pong buffer, so a shader can read what it wrote last frame — which is
 * what reaction-diffusion, fluids and any other cellular simulation need and
 * what a single pass structurally cannot do. `main` is the visible pass and
 * behaves exactly like a single-pass effect (transitions, deck B, params).
 */
export interface MultiPassEffect {
  /**
   * `rows` fixes the buffer height in texels (width follows the output
   * aspect), `scale` makes it a fraction of the render size. Prefer `rows`
   * for a simulation: its feature size is set by the grid, so a fraction of
   * the screen means the pattern gets finer on a bigger projector.
   */
  passes: EffectPass[]
  main: string
}

export interface EffectPass {
  frag: string
  buffer: string
  scale?: number
  rows?: number
  /** with `rows`, pins the buffer to an exact grid — a particle buffer must
   *  keep its texel count, not follow the projector's aspect */
  cols?: number
  /**
   * Point-sample the buffer. Mandatory when its texels are DATA (one particle
   * per texel) rather than an image: with linear filtering a sample at a texel
   * centre can still blend in a neighbour, and one bad value then spreads
   * across the whole grid a frame at a time.
   */
  nearest?: boolean
}

/**
 * An effect that draws real geometry instead of a fullscreen quad: point
 * clouds, instanced meshes, loaded models. `build` returns the material that
 * carries the effect uniforms (so params, audio and transitions work as
 * usual) and the object to draw.
 */
export interface GeometryEffect {
  passes?: EffectPass[]
  build(uniforms: Record<string, THREE.IUniform>): {
    material: THREE.ShaderMaterial
    object: THREE.Object3D
  }
}

/** Simulation buffers of one effect instance, ping-ponged once per frame */
interface PassChain {
  defs: EffectPass[]
  materials: THREE.ShaderMaterial[]
  sizes: THREE.Vector2[]
  buffers: Map<string, { read: THREE.WebGLRenderTarget; write: THREE.WebGLRenderTarget; scale: number; rows: number; cols: number }>
  frames: number
}

/**
 * A grid of points whose positions live in a simulation buffer. The vertex
 * shader fetches each particle's position from the texture, so the CPU never
 * touches a vertex and the count costs nothing per frame.
 */
function buildPointCloud(uniforms: Record<string, THREE.IUniform>, side: number,
                         vert: string, frag: string) {
  const geometry = new THREE.BufferGeometry()
  // three counts the vertices of a Points from `position`, and draws nothing at
  // all without it. The coordinates come from the simulation buffer in the
  // vertex shader, indexed by gl_VertexID, so this attribute carries no data —
  // it only says how many particles there are.
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(side * side * 3), 3))
  // every particle is placed by the vertex shader, so the bounding sphere three
  // would compute from aIndex is meaningless — frustum culling must be off
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
  const material = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, uniforms,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
  })
  const object = new THREE.Points(geometry, material)
  object.frustumCulled = false
  return { material, object }
}

const EFFECT_SHADERS: Record<EffectId, string | MultiPassEffect | GeometryEffect> = {
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
  lasers: lasersFrag,
  strobegrid: strobegridFrag,
  vortex: vortexFrag,
  terrain: terrainFrag,
  orbits: orbitsFrag,
  shatter: shatterFrag,
  moire: moireFrag,
  pulsecity: pulsecityFrag,
  neonpoly: neonpolyFrag,
  inkflow: inkflowFrag,
  raymarch: raymarchFrag,
  ripples: ripplesFrag,
  ps2towers: ps2towersFrag,
  snowride: snowrideFrag,
  pulsar: pulsarFrag,
  // The simulation pass is listed 8 times: Gray-Scott at one step per frame
  // crawls. ITERS in reaction.sim.frag must match this count.
  reaction: {
    // 360 rows regardless of the projector: the pattern's feature size is set
    // by the grid, so a fraction of the screen would make it finer on a bigger
    // output — the same effect would not look like itself on a 4K wall
    passes: Array.from({ length: 8 }, () => ({ frag: reactionSimFrag, buffer: 'A', rows: 360 })),
    main: reactionFrag,
  },
  spectrum: spectrumFrag,
  truchet: truchetFrag,
  caustics: causticsFrag,
  quasicrystal: quasicrystalFrag,
  gyroid: gyroidFrag,
  stringart: stringartFrag,
  ascii: asciiFrag,
  smoke: {
    // one advection step per frame at a fixed grid: a plume's scale is set by
    // the grid, exactly like the reaction-diffusion one
    passes: [{ frag: smokeSimFrag, buffer: 'S', rows: 320 }],
    main: smokeFrag,
  },
  flash: flashFrag,
  halftone: halftoneFrag,
  spiral: spiralFrag,
  warehouse: warehouseFrag,
  impact: impactFrag,
  barcode: barcodeFrag,
  static: staticFrag,
  cage: cageFrag,
  downpour: downpourFrag,
  cracks: cracksFrag,
  tribal: tribalFrag,
  chevrons: chevronsFrag,
  eclipse: eclipseFrag,
  blinds: blindsFrag,
  bounceball: bounceballFrag,
  pump: pumpFrag,
  roll: rollFrag,
  spaceghost: spaceghostFrag,
  swarm: {
    // 192x192 texels = 36,864 particles on a fixed grid: the count must not
    // change with the projector's aspect ratio. 65k turned the frame into even
    // dust at 1080p — the density is the look, not the number.
    passes: [{ frag: swarmSimFrag, buffer: 'P', rows: 192, cols: 192, nearest: true }],
    build: (u) => buildPointCloud(u, 192, swarmVert, swarmFrag),
  },
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
  // rgb-delay history: three half-res slots advanced every `stride` frames
  private rtDelay: THREE.WebGLRenderTarget[] = []
  private rgbDelayHead = 0
  private rgbDelayTick = 0
  private rgbDelayLastFrame = -2

  // Post processing
  private postScene: THREE.Scene
  private postQuad: THREE.Mesh

  // Reusable passthrough material (avoid per-frame allocations)
  private passthroughMaterial: THREE.ShaderMaterial
  private cameraMaterial: THREE.ShaderMaterial
  /** Master camera. Neutral means the pass does not run at all. */
  private cameraState: CameraState = { ...CAMERA_NEUTRAL }

  // Current state
  private currentEffect: EffectId = 'tunnel'
  private mainMaterial: THREE.ShaderMaterial
  private postMaterials: Map<PostId, THREE.ShaderMaterial> = new Map()
  /** Ordered post-FX chain — order matters as much as which effects are on */
  private postChain: { id: PostId; amount: number }[] = [{ id: 'bloom', amount: 1 }]

  // Projection mapping: 4 corners (TL,TR,BR,BL) in 0..1 output space.
  // Per window, like the slice: it reaches an output with its OutputCfg, never
  // in the state snapshot — the snapshot is the show, the corners are the wall.
  private keystone: number[] = [0, 0, 1, 0, 1, 1, 0, 1]

  // Dynamic resolution: heavy shaders (ISF raymarchers) drop the render-target
  // scale until the frame rate holds, then climb back when there's headroom
  private perfScale = 1
  private perfEmaMs = 16.7
  private perfLastNow = 0
  private perfCooldown = 300 // ~5s warmup: boot + output-window spawn jank must not downscale
  private perfSpikeLast = false

  // Deck B + crossfader
  private deckBEffect: EffectId = 'plasma'
  private deckBMaterial: THREE.ShaderMaterial | null = null
  private crossfade = 0            // 0 = deck A only, 1 = full B
  private blendMode: BlendMode = 'mix'
  private maskSoft = 0.25
  private deckMixMaterial!: THREE.ShaderMaterial
  // Deck B as video (Q4). One <video> per window; the control decides the clip,
  // the output mirrors it from the snapshot and seeks to the beat grid.
  private videoDeck: VideoDeck = { ...VIDEO_DECK_DEFAULT }
  private deckVideo: HTMLVideoElement | null = null
  private deckVideoTex: THREE.VideoTexture | null = null
  private deckVideoPath = ''        // what the <video> is loading/playing
  private deckVideoSeek = false     // clipStartBeat changed: seek on the next ready frame
  private prevBarPhase = 0

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
  private customImageInputs: string[] = []
  /** dataURL per image input — rides the snapshot so the output window matches */
  private customImages: Record<string, string> = {}
  private quadGeometry: THREE.PlaneGeometry
  private postGeometry: THREE.PlaneGeometry
  private customTextures: Record<string, THREE.Texture> = {}
  private whiteTexture: THREE.DataTexture | null = null
  /** Simulation buffers, keyed by the effect material that owns them */
  private chains = new Map<THREE.ShaderMaterial, PassChain>()
  /** Scene of an effect that draws geometry instead of a fullscreen quad */
  private geometries = new Map<THREE.ShaderMaterial, { scene: THREE.Scene; object: THREE.Object3D }>()

  // Audio spectrum as a texture: the scalars (uBass/uMid/uHigh) are five
  // numbers, this is the whole picture. 512 log-spaced bins in .r and the
  // oscilloscope trace in .g, one row, so uSpectrum is sampled as
  // texture2D(uSpectrum, vec2(u, 0.5)) with u = 0..1 = 20Hz..20kHz.
  private static readonly SPECTRUM_BINS = 512
  private spectrumPixels = new Uint8Array(Engine.SPECTRUM_BINS * 4)
  private spectrumTex: THREE.DataTexture | null = null
  private usingCustom = false
  private customShaderSource = ''
  private effectTime = 0     // param-speed-driven clock for effect shaders
  // Beat-roll (S2): the clocks loop over a fraction of a beat. Procedural
  // shaders are functions of time, so looping the time IS replaying the
  // frames — no frame buffer, no second pipeline. Simulations (reaction,
  // smoke, swarm) keep running: there is no time to rewind in a buffer.
  private rollDivision = 0   // 0 = off; 4, 8, 16 = quarter, eighth, sixteenth of a beat
  private rollWallStart = 0
  private rollEffectBase = 0
  private rollBeatBase = 0
  private audioScale = 1     // reactivity multiplier applied to audio uniforms

  /**
   * The Intensity macro, 0..1. Zero is neutral — the scene is exactly what was
   * set by hand — and raising it pulls the params in INTENSITY_WEIGHTS towards
   * their limit, and the post chain towards fully wet.
   *
   * It is applied where params are *resolved*, never written back, so letting
   * the fader go restores the hand-set values exactly. Under pressure one
   * command beats five sliders, and it must not cost you the five sliders.
   */
  private intensity = 0
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
  private audioFrameListeners = new Set<(beatDetected: boolean, energy: number, bass: number, barPhase: number, bassRaw: number, energyRaw: number, key: Key | null) => void>()
  private bassRaw = 0
  private energyRaw = 0
  private key: Key | null = null

  /** Subscribe to per-frame audio. Returns an unsubscribe function. */
  onAudioFrame(fn: (beatDetected: boolean, energy: number, bass: number, barPhase: number, bassRaw: number, energyRaw: number, key: Key | null) => void): () => void {
    this.audioFrameListeners.add(fn)
    return () => { this.audioFrameListeners.delete(fn) }
  }

  // Track change (Pro DJ Link id or audio heuristics) — the playlist turns its page on it
  private trackChange = new TrackChangeDetector()
  private trackChangeListeners = new Set<(e: TrackChangeEvent) => void>()
  /** the Auto VJ's phase, pushed by App every frame (the Auto VJ lives there) */
  private phase: Phase = 'groove'

  /** Subscribe to track changes. Returns an unsubscribe function. */
  onTrackChange(fn: (e: TrackChangeEvent) => void): () => void {
    this.trackChangeListeners.add(fn)
    return () => { this.trackChangeListeners.delete(fn) }
  }
  getLastTrackChange(): TrackChangeEvent | null { return this.trackChange.last }
  notePhase(phase: Phase): void { this.phase = phase }
  /** A Pro DJ Link status named this rekordbox id on the followed deck. */
  noteProLinkTrack(trackId: number): void {
    const ev = this.trackChange.feedProLink(trackId, performance.now())
    if (ev) this.emitTrackChange(ev)
  }
  private emitTrackChange(ev: TrackChangeEvent): void {
    for (const fn of this.trackChangeListeners) { try { fn(ev) } catch (_) {} }
  }

  constructor(private canvas: HTMLCanvasElement, options: { remote?: boolean } = {}) {
    this.remote = !!options.remote
    this.audioAnalyzer = new AudioAnalyzer()
    this.clock = new THREE.Clock()

    // Fullscreen-quad pipeline: no depth, no stencil, no MSAA — pure fill rate
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(1)
    this.renderer.autoClear = false
    // Filmic tone mapping + sRGB output: saturated neons stop clipping to white on a projector
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = this.grade.exposure

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.quadGeometry = new THREE.PlaneGeometry(2, 2)
    this.postGeometry = new THREE.PlaneGeometry(2, 2)

    // Main scene
    this.scene = new THREE.Scene()
    this.mainMaterial = this.createEffectMaterial('tunnel')
    this.quad = new THREE.Mesh(this.quadGeometry, this.mainMaterial)
    this.scene.add(this.quad)

    this.cameraMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: cameraFrag,
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uZoom: { value: 1 },
        uRotation: { value: 0 },
        uPan: { value: new THREE.Vector2(0, 0) },
        uTile: { value: 1 },
        uPushAmt: { value: 0 },
        uBeat: { value: 0 },
      },
    })

    // Reusable passthrough (never allocate in render loop)
    this.passthroughMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: PASSTHROUGH_FRAG,
      uniforms: { tDiffuse: { value: null } }
    })

    // Post scene. renderPass() swaps postQuad.material on every pass, so it
    // starts on the shared passthrough: a throwaway material here would be
    // replaced on the first frame and never be reachable to dispose again.
    this.postScene = new THREE.Scene()
    this.postQuad = new THREE.Mesh(this.postGeometry, this.passthroughMaterial)
    this.postScene.add(this.postQuad)

    // Render targets
    const opts: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: false, // fullscreen quads never depth-test — saves memory + clear bandwidth on every pass
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
    this.rtDelay = [0, 1, 2].map(() => new THREE.WebGLRenderTarget(960, 540, opts))

    // Deck crossfader
    this.deckMixMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: deckmixFrag,
      uniforms: {
        tDeckA: { value: null }, tDeckB: { value: null },
        uMix: { value: 0 }, uBlend: { value: 0 },
        uMaskMode: { value: 0 }, uMaskSoft: { value: 0.25 },
        uResolution: { value: this.resolution }, uBass: { value: 0 }, uBeat: { value: 0 },
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
        uWarpOn: { value: false },
        uWarpInv: { value: new THREE.Matrix3() },
        uSrcOff: { value: new THREE.Vector2(0, 0) },
        uSrcScale: { value: new THREE.Vector2(1, 1) },
        uGamma: { value: 1 },
        uOutBright: { value: 1 },
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
      // Letterbox: biggest rect with the OUTPUT aspect that fits the window —
      // a resized/windowed output shows black bars instead of stretching.
      // Degenerate sizes MUST NOT reach setSize(): a 0x0 drawing buffer is a
      // permanently black projector if no further resize event ever fires.
      const winW = window.innerWidth
      const winH = window.innerHeight
      // A rAF retry here is NOT reliable: scheduled from the constructor it
      // can be dropped before the render loop exists. renderFrame() re-checks
      // the size every frame instead — see ensureRemoteSize().
      if (!(winW > 1) || !(winH > 1)) return
      const outAspect = this.outputWidth > 0 && this.outputHeight > 0
        ? this.outputWidth / this.outputHeight
        : winW / winH
      let w = winW
      let h = winH
      if (w / h > outAspect) w = Math.round(h * outAspect)
      else h = Math.round(w / outAspect)
      w = Math.max(2, w || winW)
      h = Math.max(2, h || winH)
      this.renderer.setSize(w, h)
      this.setRenderSize(this.outputWidth, this.outputHeight)
      return
    }
    const parent = this.canvas.parentElement
    if (!parent) return
    // Same guard as the output branch: a 0-wide container (panel still laid
    // out, display just woken) would set a 0x0 drawing buffer and the preview
    // stays black until some later resize event happens to fire
    if (!(parent.clientWidth > 1) || !(parent.clientHeight > 1)) return
    this.renderer.setSize(parent.clientWidth, parent.clientHeight)
    // Preview keeps the OUTPUT resolution in uResolution, so what you see on the
    // preview is the same framing/scale that goes to the projector.
    this.setRenderSize(this.outputWidth, this.outputHeight)
  }

  /**
   * Set the output resolution. The buffers are capped in preview and scaled by
   * perfScale, so `uResolution` must report the size actually being drawn into:
   * effects read `(gl_FragCoord.xy - uResolution * 0.5) / uResolution.y`, and a
   * uResolution larger than the buffer puts the centre off-screen and shows a
   * zoomed corner. Feature scale is unaffected — every effect normalises by
   * uResolution.y, so the framing is identical at any buffer size.
   * ponytail: pixelate and film grain now follow the buffer (grain becomes
   * genuinely per-pixel, blocks track render scale). If the block size must
   * stay locked to the projector, give those two a logical-resolution uniform.
   */
  setRenderSize(w: number, h: number) {
    this.outputWidth = w
    this.outputHeight = h

    // Preview renders at most 1080p worth of pixels — same look, less GPU.
    // perfScale kicks in when the GPU can't hold the frame rate.
    const cap = this.remote ? 3840 : 1920
    const scale = Math.min(1, cap / w) * this.perfScale
    const bw = Math.max(2, Math.round(w * scale))
    const bh = Math.max(2, Math.round(h * scale))
    this.resolution.set(bw, bh)

    for (const rt of [this.rtA, this.rtB, this.rtPrev, this.rtTransition, this.rtDeckB, this.rtFreeze, this.rtAccum, this.rtAccum2]) {
      // Resizing an RT discards its contents — the freeze frame must survive
      if (rt === this.rtFreeze && this.frozen) continue
      rt.setSize(bw, bh)
    }
    this.rtBloomA.setSize(Math.max(2, bw >> 1), Math.max(2, bh >> 1))
    this.rtBloomB.setSize(Math.max(2, bw >> 1), Math.max(2, bh >> 1))
    for (const rt of this.rtDelay) rt.setSize(Math.max(2, bw >> 1), Math.max(2, bh >> 1))
    this.bloomResolution.set(bw >> 1, bh >> 1)

    // Simulation buffers follow the render size. Resizing discards them, so a
    // running simulation restarts — better than sampling a stale aspect ratio,
    // and a resize only happens on an output/display change.
    for (const chain of this.chains.values()) {
      let changed = false
      for (const buf of chain.buffers.values()) {
        const [sw, sh] = this.simSize(buf.scale, buf.rows, buf.cols)
        if (sw === buf.read.width && sh === buf.read.height) continue
        buf.read.setSize(sw, sh)
        buf.write.setSize(sw, sh)
        changed = true
      }
      if (!changed) continue    // a fixed grid survives an output change intact
      for (let i = 0; i < chain.defs.length; i++) {
        const b = chain.buffers.get(chain.defs[i].buffer)!
        chain.sizes[i].set(b.read.width, b.read.height)
      }
      chain.frames = 0
    }
  }

  /** Common uniform block of an effect pass — audio, palette, size, params */
  private effectUniforms(id: EffectId, buffers: string[], size: THREE.Vector2): Record<string, THREE.IUniform> {
    // Curated per-effect uniforms start at their defaults; the render loop
    // drives the ACTIVE effect's ones from param state every frame
    const paramUniforms: Record<string, THREE.IUniform> = {}
    for (const d of EFFECT_PARAMS[id] ?? []) paramUniforms[d.key] = { value: d.default }
    // Simulation buffers: every pass of the effect can read every buffer, and
    // always sees last frame's contents (the write target is a different one)
    for (const name of buffers) {
      paramUniforms[`tBuffer${name}`] = { value: null }
      // a buffer is usually smaller than the screen; its texel size is what a
      // laplacian or a gradient needs, not uResolution
      paramUniforms[`uBuffer${name}Size`] = { value: new THREE.Vector2(1, 1) }
    }
    return {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uEnergy: { value: 0 },
        uBeat: { value: 0 },
        uBeatPhase: { value: 0 },
        uBarPhase: { value: 0 },
        uBeatClock: { value: 0 },
        uSpectrum: { value: this.getSpectrumTexture() },
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
      uResolution: { value: size },
      uFrame: { value: 0 },
      ...paramUniforms,
    }
  }

  private createEffectMaterial(id: EffectId): THREE.ShaderMaterial {
    // An unknown id passes `undefined` as fragmentShader and three keeps its
    // default_fragment — a full red screen on the projector. Imported presets,
    // remote/OSC commands and restored settings can all carry a stale id.
    if (!EFFECT_SHADERS[id]) id = 'tunnel'
    const def = EFFECT_SHADERS[id]
    const geometry = typeof def === 'object' && 'build' in def ? def : null
    const multi = typeof def === 'object' && 'main' in def ? def : null
    const passes = geometry?.passes ?? multi?.passes ?? []
    const uniforms = this.effectUniforms(id, passes.map(p => p.buffer), this.resolution)

    let mat: THREE.ShaderMaterial
    if (geometry) {
      const built = geometry.build(uniforms)
      mat = built.material
      const scene = new THREE.Scene()
      scene.add(built.object)
      this.geometries.set(mat, { scene, object: built.object })
    } else {
      mat = new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: multi ? multi.main : (def as string),
        uniforms,
      })
    }
    if (passes.length) {
      this.chains.set(mat, this.createPassChain(passes, (b, size) => this.effectUniforms(id, b, size)))
    }
    return mat
  }

  /** Allocate the simulation buffers and pass materials of a multi-pass effect */
  private createPassChain(
    defs: EffectPass[],
    makeUniforms: (buffers: string[], size: THREE.Vector2) => Record<string, THREE.IUniform>,
  ): PassChain {
    const bufNames = defs.map(p => p.buffer)
    const chain: PassChain = { defs, materials: [], sizes: [], buffers: new Map(), frames: 0 }

    for (const pass of defs) {
      if (chain.buffers.has(pass.buffer)) continue
      const scale = pass.scale ?? 1
      const rows = pass.rows ?? 0
      const cols = pass.cols ?? 0
      const near = pass.nearest ?? false
      chain.buffers.set(pass.buffer, {
        read: this.createSimTarget(scale, rows, cols, near),
        write: this.createSimTarget(scale, rows, cols, near),
        scale, rows, cols,
      })
    }
    for (const pass of defs) {
      const buf = chain.buffers.get(pass.buffer)!
      const size = new THREE.Vector2(buf.read.width, buf.read.height)
      chain.sizes.push(size)
      chain.materials.push(new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: pass.frag,
        uniforms: makeUniforms(bufNames, size),
      }))
    }
    return chain
  }

  /**
   * Simulation buffers are half-float: a cellular simulation feeding itself
   * through 8-bit targets quantises a little every frame, and the error
   * compounds until the pattern dies or explodes.
   */
  private createSimTarget(scale: number, rows: number, cols: number, nearest: boolean): THREE.WebGLRenderTarget {
    const [w, h] = this.simSize(scale, rows, cols)
    const filter = nearest ? THREE.NearestFilter : THREE.LinearFilter
    return new THREE.WebGLRenderTarget(w, h, {
      minFilter: filter,
      magFilter: filter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      depthBuffer: false,
    })
  }

  /**
   * Run the simulation passes of `mat`'s effect (if any) and bind the buffers
   * onto it, so the visible pass reads what the simulation just wrote. Called
   * for every effect material before it is drawn — main deck, deck B, and the
   * outgoing effect during a transition.
   */
  private simSize(scale: number, rows: number, cols: number): [number, number] {
    if (rows > 0 && cols > 0) return [Math.max(2, cols), Math.max(2, rows)]
    if (rows > 0) {
      const aspect = this.resolution.x / Math.max(1, this.resolution.y)
      return [Math.max(2, Math.round(rows * aspect)), Math.max(2, Math.round(rows))]
    }
    return [Math.max(2, Math.round(this.resolution.x * scale)),
            Math.max(2, Math.round(this.resolution.y * scale))]
  }

  private runChain(mat: THREE.ShaderMaterial) {
    const chain = this.chains.get(mat)
    if (!chain) return

    for (let i = 0; i < chain.defs.length; i++) {
      const pm = chain.materials[i]
      this.applyEffectUniforms(pm, 0)
      this.applyParams(pm)
      pm.uniforms.uResolution.value = chain.sizes[i]   // the buffer's size, not the screen's
      pm.uniforms.uFrame.value = chain.frames
      for (const [name, buf] of chain.buffers) {
        const u = pm.uniforms[`tBuffer${name}`]
        if (u) u.value = buf.read.texture
        const us = pm.uniforms[`uBuffer${name}Size`]
        if (us) us.value.set(buf.read.width, buf.read.height)
      }
      const b = chain.buffers.get(chain.defs[i].buffer)!
      this.renderPass(pm, b.write)
      // Swap straight after the pass that wrote it: a pass never reads the
      // target it is writing (undefined behaviour), and listing the same pass
      // twice then runs two real iterations instead of recomputing the first.
      const t = b.read; b.read = b.write; b.write = t
    }
    chain.frames++

    for (const [name, buf] of chain.buffers) {
      const u = mat.uniforms[`tBuffer${name}`]
      if (u) u.value = buf.read.texture
      const us = mat.uniforms[`uBuffer${name}Size`]
      if (us) us.value.set(buf.read.width, buf.read.height)
    }
  }

  /** Dispose an effect material together with the simulation buffers it owns */
  private disposeEffectMaterial(mat: THREE.ShaderMaterial | null) {
    if (!mat) return
    const chain = this.chains.get(mat)
    if (chain) {
      for (const m of chain.materials) m.dispose()
      for (const b of chain.buffers.values()) { b.read.dispose(); b.write.dispose() }
      this.chains.delete(mat)
    }
    const geo = this.geometries.get(mat)
    if (geo) {
      geo.scene.remove(geo.object)
      geo.object.traverse(o => (o as THREE.Mesh).geometry?.dispose())
      this.geometries.delete(mat)
    }
    mat.dispose()
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
        uBass: { value: 0 },
        uBeat: { value: 0 },
        uTime: { value: 0 },
      }
    }))

    this.postMaterials.set('rgb-delay', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: rgbdelayFrag,
      uniforms: {
        tDiffuse: { value: null },
        tDelay1: { value: null },
        tDelay2: { value: null },
        uWet: { value: 1 },
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
        uLevel: { value: 1 },
        uResolution: { value: this.resolution },
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

    this.postMaterials.set('displace', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: displaceFrag,
      uniforms: {
        tDiffuse: { value: null },
        uWet: { value: 1 },
        uBass: { value: 0 },
        uTime: { value: 0 },
        uResolution: { value: this.resolution },
      }
    }))

    this.postMaterials.set('frame-glitch', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: frameglitchFrag,
      uniforms: {
        tDiffuse: { value: null },
        uWet: { value: 1 },
        uBeat: { value: 0 },
        uHighHit: { value: 0 },
        uTime: { value: 0 },
      }
    }))

    this.postMaterials.set('outline', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: outlineFrag,
      uniforms: {
        tDiffuse: { value: null },
        uWet: { value: 1 },
        uBeat: { value: 0 },
        uColor1: { value: this.colors[0] },
        uResolution: { value: this.resolution },
      }
    }))
  }

  // ---- Public API ----

  setEffect(id: EffectId) {
    if (!EFFECT_SHADERS[id]) return   // stale id from a preset/remote/settings
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
      this.disposeEffectMaterial(this.transitionOldMaterial)
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
      this.disposeEffectMaterial(this.mainMaterial)
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
    this.renderer.debug.onShaderError = (gl, program, vs, fs) => {
      // the failure can live in the fragment, the vertex, or the LINK stage —
      // "unknown GLSL error" hid every link failure (e.g. varying mismatches)
      const fsLog = (gl.getShaderInfoLog(fs) || '').trim()
      const vsLog = (gl.getShaderInfoLog(vs) || '').trim()
      const progLog = (gl.getProgramInfoLog(program) || '').trim()
      error = fsLog || vsLog || (progLog ? `link: ${progLog}` : 'unknown GLSL error')
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

  /** Uniform block of a custom shader pass */
  private customUniforms(defs: EffectParam[], imgs: string[], buffers: string[],
                         size: THREE.Vector2): Record<string, THREE.IUniform> {
    const uniforms: Record<string, THREE.IUniform> = {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uEnergy: { value: 0 },
        uBeat: { value: 0 },
        uBeatPhase: { value: 0 },
        uBarPhase: { value: 0 },
        uBeatClock: { value: 0 },
        uSpectrum: { value: this.getSpectrumTexture() },
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
      uResolution: { value: size },
      uFrame: { value: 0 },
    }
    // Custom shader params (e.g. from ISF INPUTS) become uniforms driven per-frame
    for (const d of defs) uniforms[d.key] = { value: d.default }
    // Image inputs: previously loaded texture or 1x1 white until the user picks one
    for (const n of imgs) uniforms[n] = { value: this.customTextures[n] ?? this.getWhiteTexture() }
    for (const n of buffers) {
      uniforms[`tBuffer${n}`] = { value: null }
      uniforms[`uBuffer${n}Size`] = { value: new THREE.Vector2(1, 1) }
    }
    return uniforms
  }

  /** Load a custom GLSL fragment shader as the active effect */
  setCustomShader(fragSource: string, params?: EffectParam[], imageInputs?: string[]): boolean {
    try {
      const defs = params ?? this.customParamDefs
      const imgs = imageInputs ?? this.customImageInputs
      const parts = splitCustomPasses(fragSource)
      const bufPasses: EffectPass[] = parts.slice(0, -1).map(p => ({ frag: p.frag, buffer: p.buffer }))
      const bufNames = bufPasses.map(p => p.buffer)

      const mat = new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: parts[parts.length - 1].frag,
        uniforms: this.customUniforms(defs, imgs, bufNames, this.resolution),
      })

      // Every pass is compiled and validated BEFORE anything is swapped in: a
      // broken buffer pass must leave the projector on the shader it had
      const chain = bufPasses.length
        ? this.createPassChain(bufPasses, (b, size) => this.customUniforms(defs, imgs, b, size))
        : null
      this.lastShaderError = this.validateMaterial(mat)
        || (chain ? chain.materials.map(m => this.validateMaterial(m)).find(e => e) ?? null : null)
      if (this.lastShaderError) {
        console.error('[Engine] Custom shader rejected:', this.lastShaderError)
        mat.dispose()
        if (chain) {
          for (const m of chain.materials) m.dispose()
          for (const b of chain.buffers.values()) { b.read.dispose(); b.write.dispose() }
        }
        return false
      }

      // Cancel any in-progress transition
      this.cancelCurrentTransition()
      this.disposeEffectMaterial(this.mainMaterial)
      this.mainMaterial = mat
      if (chain) this.chains.set(mat, chain)
      this.quad.material = this.mainMaterial
      this.customParamDefs = defs
      this.customImageInputs = imgs
      this.usingCustom = true
      this.invalidateParamDefs()   // same '__custom__' key, different params
      this.customShaderSource = fragSource
      this.emitState()
      return true
    } catch (e) {
      console.error('[Engine] Custom shader compile error:', e)
      return false
    }
  }

  /**
   * Projection mapping — 8 values (TL,TR,BR,BL as x,y in 0..1). In the control
   * window this is the preview of the output being aligned; an output window
   * gets its own through setSlice. No emit: it is not part of the snapshot.
   */
  setKeystone(corners: number[]) {
    if (!Array.isArray(corners) || corners.length !== 8) return
    this.keystone = corners.map(v => Math.max(-0.5, Math.min(1.5, v)))
    this.applyKeystone()
  }

  /**
   * Which rectangle of the composition this window presents, and how hard.
   *
   * One show, many outputs: the state snapshot stays the show, and this is the
   * part that is about the *wall* — so it never travels in the snapshot, or
   * every output would end up with the last window's crop.
   *
   * src is x,y,w,h in 0..1 with y measured from the bottom, like uv.
   */
  setSlice(s: { src?: number[]; gamma?: number; brightness?: number; keystone?: number[] }) {
    const u = this.masterMaterial.uniforms
    if (s.keystone) this.setKeystone(s.keystone)
    if (s.src && s.src.length === 4) {
      const [x, y, w, h] = s.src
      // A zero-width slice is a black output that looks exactly like a dead
      // projector: refuse it rather than present it.
      if (w > 0.001 && h > 0.001) {
        u.uSrcOff.value.set(x, y)
        u.uSrcScale.value.set(w, h)
      }
    }
    if (typeof s.gamma === 'number') u.uGamma.value = Math.max(0.2, Math.min(4, s.gamma))
    if (typeof s.brightness === 'number') u.uOutBright.value = Math.max(0, Math.min(1, s.brightness))
  }

  isKeystoneActive(): boolean {
    const def = [0, 0, 1, 0, 1, 1, 0, 1]
    return this.keystone.some((v, i) => Math.abs(v - def[i]) > 0.0005)
  }

  private applyKeystone() {
    const u = this.masterMaterial.uniforms
    if (!this.isKeystoneActive()) { u.uWarpOn.value = false; return }
    // Heckbert: unit square (0,0)(1,0)(1,1)(0,1) → quad TL,TR,BR,BL.
    // vUv has y=0 at the BOTTOM, so map BL,BR,TR,TL in that order.
    const [tlx, tly, trx, try_, brx, bry, blx, bly] = this.keystone
    // corners in uv space (flip y: screen top = uv y 1)
    const x0 = blx, y0 = 1 - bly   // uv (0,0)
    const x1 = brx, y1 = 1 - bry   // uv (1,0)
    const x2 = trx, y2 = 1 - try_  // uv (1,1)
    const x3 = tlx, y3 = 1 - tly   // uv (0,1)
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2
    const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3
    const den = dx1 * dy2 - dx2 * dy1
    if (Math.abs(den) < 1e-9) { u.uWarpOn.value = false; return }
    const g = (sx * dy2 - dx2 * sy) / den
    const h = (dx1 * sy - sx * dy1) / den
    const a = x1 - x0 + g * x1
    const b = x3 - x0 + h * x3
    const c = x0
    const d = y1 - y0 + g * y1
    const e = y3 - y0 + h * y3
    const f = y0
    // H maps source uv → warped position; the shader needs the inverse
    const H = new THREE.Matrix3().set(a, b, c, d, e, f, g, h, 1)
    u.uWarpInv.value.copy(H).invert()
    u.uWarpOn.value = true
  }

  private getWhiteTexture(): THREE.DataTexture {
    if (!this.whiteTexture) {
      this.whiteTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
      this.whiteTexture.needsUpdate = true
    }
    return this.whiteTexture
  }


  private getSpectrumTexture(): THREE.DataTexture {
    if (!this.spectrumTex) {
      const tex = new THREE.DataTexture(this.spectrumPixels, Engine.SPECTRUM_BINS, 1)
      tex.minFilter = tex.magFilter = THREE.LinearFilter
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
      tex.needsUpdate = true
      this.spectrumTex = tex
    }
    return this.spectrumTex
  }

  /**
   * Pack the analyser's raw bins into the texture. The x axis is logarithmic
   * (20Hz → 20kHz): linear bins waste nine tenths of the width on frequencies
   * no club track uses, and squash the whole bass into the first pixels.
   * Each output bin takes the max of the input bins it covers, so a narrow
   * peak survives instead of being averaged away.
   */
  private packSpectrum(freq: Uint8Array, wave: Uint8Array, binHz: number) {
    const N = Engine.SPECTRUM_BINS
    const px = this.spectrumPixels
    const bins = freq.length
    if (!bins || !binHz) return
    for (let i = 0; i < N; i++) {
      const f0 = 20 * Math.pow(1000, i / N)
      const f1 = 20 * Math.pow(1000, (i + 1) / N)
      let b0 = Math.floor(f0 / binHz)
      const b1 = Math.min(bins - 1, Math.max(b0, Math.floor(f1 / binHz)))
      if (b0 >= bins) b0 = bins - 1
      let peak = 0
      for (let b = b0; b <= b1; b++) if (freq[b] > peak) peak = freq[b]
      px[i * 4] = peak
      // waveform: one sample per output bin, centred on 128
      px[i * 4 + 1] = wave.length ? wave[Math.floor((i / N) * wave.length)] : 128
      px[i * 4 + 3] = 255
    }
    if (this.spectrumTex) this.spectrumTex.needsUpdate = true
  }

  /** Assign a picture (dataURL) to an ISF image input of the active custom shader */
  setCustomImage(name: string, dataUrl: string) {
    if (!this.customImageInputs.includes(name)) return
    this.customImages[name] = dataUrl
    new THREE.TextureLoader().load(dataUrl, tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      this.customTextures[name]?.dispose()
      this.customTextures[name] = tex
      if (this.usingCustom) {
        // a multi-pass custom shader reads the picture in its buffer passes too
        const chain = this.chains.get(this.mainMaterial)
        for (const m of chain?.materials ?? []) {
          const cu = m.uniforms[name]
          if (cu) cu.value = tex
        }
        const u = (this.mainMaterial as THREE.ShaderMaterial).uniforms[name]
        if (u) u.value = tex
      }
    })
    this.emitState()
  }

  setTransitionType(type: TransitionType) { this.transitionType = type; this.emitState() }
  getTransitionType(): TransitionType { return this.transitionType }

  setTransitionDuration(seconds: number) { this.transitionDuration = Math.max(0, seconds); this.emitState() }
  getTransitionDuration(): number { return this.transitionDuration }

  setTransitionBeatSync(enabled: boolean) { this.transitionBeatSync = enabled; this.emitState() }
  isTransitionBeatSync(): boolean { return this.transitionBeatSync }


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

  /**
   * Params of the ACTIVE effect: common engine params + curated/custom uniforms.
   * Cached: the render loop walks this every frame and the two spreads were
   * allocating a pair of arrays per frame for a list that only changes when the
   * effect (or the custom shader) does.
   */
  getParamDefs(): EffectParam[] {
    const key = this.usingCustom ? '__custom__' : this.currentEffect
    if (this.paramDefsKey !== key) {
      this.paramDefsKey = key
      this.paramDefsCache = this.usingCustom
        ? [...COMMON_PARAMS, ...this.customParamDefs]
        : [...COMMON_PARAMS, ...(EFFECT_PARAMS[this.currentEffect] ?? [])]
    }
    return this.paramDefsCache
  }

  private paramDefsKey = ''
  private paramDefsCache: EffectParam[] = []

  /** The cached list is keyed by effect id — a new custom shader keeps the key */
  private invalidateParamDefs() { this.paramDefsKey = '' }

  isUsingCustomShader(): boolean { return this.usingCustom }
  getCustomShaderSource(): string { return this.usingCustom ? this.customShaderSource : '' }

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

  /**
   * Il mapping consigliato di `effect` (recommendedMappings.ts), sui suoi
   * parametri. Scrive nel bucket di quell'effetto e non in quello attivo: con
   * la transizione a tempo l'effetto scelto diventa attivo solo al prossimo
   * beat, e il mapping deve gia' esserci quando arriva.
   *
   * `onlyUnmapped` (il cambio effetto a mano): tocca solo i parametri con
   * sorgente `none`. Un parametro che l'utente, una scena o un look hanno gia'
   * mappato in sessione resta com'e' — il consiglio riempie i vuoti, non
   * sovrascrive. Il pulsante Auto passa `false` e riapplica tutto.
   * Ritorna quanti parametri ha toccato.
   */
  applyRecommendedMapping(effect: string, onlyUnmapped = true): number {
    const defs = [...COMMON_PARAMS, ...(EFFECT_PARAMS[effect] ?? [])]
    const bucket = (this.paramState[effect] ??= {})
    let n = 0
    for (const [key, rec] of Object.entries(recommendedFor(effect))) {
      const def = defs.find(d => d.key === key)
      if (!def) continue
      const st = (bucket[key] ??= { value: def.default, source: 'none', depth: 0.5 })
      if (onlyUnmapped && st.source !== 'none') continue
      st.source = rec.source
      st.depth = rec.depth
      if (rec.lfoRate) st.lfoRate = rec.lfoRate
      if (typeof rec.value === 'number') st.value = Math.max(def.min, Math.min(def.max, rec.value))
      n++
    }
    if (n) this.emitState()
    return n
  }

  /** Live param value: slider base + Intensity macro + audio/LFO modulation */
  private effParamValue(def: EffectParam): number {
    const st = this.paramBucket()[def.key]
    const base = this.withIntensity(def, st?.value ?? def.default)
    if (!st || st.source === 'none' || st.depth === 0) return base

    let mod: number
    if (st.source.startsWith('lfo-')) {
      // Tempo-synced LFO: lfoRate beats per cycle, phase from the beat clock
      const phase = (this.beatClock / (st.lfoRate || 4)) % 1
      mod = st.source === 'lfo-sine' ? 0.5 + 0.5 * Math.sin(phase * Math.PI * 2)
          : st.source === 'lfo-saw' ? phase
          : phase < 0.5 ? 1 : 0 // lfo-square
    } else {
      // switch, not a lookup object: this runs once per mapped param per frame
      // and the object literal was allocating ~500 times a second
      mod = st.source === 'bass' ? this.smoothBass
          : st.source === 'mid' ? this.smoothMid
          : st.source === 'high' ? this.smoothHigh
          : st.source === 'energy' ? this.smoothEnergy
          : st.source === 'beat' ? this.beatPulse
          : 0
    }
    const v = base + mod * st.depth * (def.max - def.min)
    return Math.max(def.min, Math.min(def.max, v))
  }

  /**
   * Pull one param towards its limit by the macro. A positive weight heads for
   * the maximum, a negative one for the minimum; unlisted params do not move.
   */
  private withIntensity(def: EffectParam, base: number): number {
    return intensityValue(def, base, this.intensity)
  }

  /** Wet of one post effect, pulled towards fully wet by the macro. */
  private wetWithIntensity(amount: number): number {
    return intensityWet(amount, this.intensity)
  }

  /** The Intensity macro, 0..1. 0 = the scene exactly as it was set by hand. */
  setIntensity(v: number) {
    const next = Math.max(0, Math.min(1, v))
    if (next === this.intensity) return
    this.intensity = next
    this.emitState()
  }

  getIntensity(): number { return this.intensity }

  /** Is the camera doing anything? A neutral camera costs nothing at all. */
  private cameraActive(): boolean {
    const c = this.cameraState
    return c.zoom !== 1 || c.rotation !== 0 || c.panX !== 0 || c.panY !== 0
      || c.tile > 1 || c.push !== 0
  }

  setCamera(patch: Partial<CameraState>) {
    const c = this.cameraState
    if (typeof patch.zoom === 'number') c.zoom = Math.max(0.2, Math.min(4, patch.zoom))
    if (typeof patch.rotation === 'number') c.rotation = patch.rotation
    if (typeof patch.panX === 'number') c.panX = Math.max(-1, Math.min(1, patch.panX))
    if (typeof patch.panY === 'number') c.panY = Math.max(-1, Math.min(1, patch.panY))
    if (typeof patch.tile === 'number') c.tile = Math.max(1, Math.min(8, Math.round(patch.tile)))
    if (typeof patch.push === 'number') c.push = Math.max(0, Math.min(1, patch.push))
    this.emitState()
  }

  getCamera(): CameraState { return { ...this.cameraState } }

  /** Back to the identity — the camera's own panic. */
  resetCamera() {
    this.cameraState = { ...CAMERA_NEUTRAL }
    this.emitState()
  }

  // ---- Deck B / crossfader ----

  setDeckBEffect(id: EffectId) {
    if (!EFFECT_SHADERS[id]) return   // stale id from a preset/remote/settings
    this.deckBEffect = id
    this.disposeEffectMaterial(this.deckBMaterial)
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

  setBlendMode(mode: BlendMode) {
    if (!BLEND_MODES.includes(mode)) return   // stale id from a preset/remote/settings
    this.blendMode = mode; this.emitState()
  }
  getBlendMode(): BlendMode { return this.blendMode }
  setMaskSoft(v: number) { this.maskSoft = Math.max(0, Math.min(1, v)); this.emitState() }
  getMaskSoft(): number { return this.maskSoft }

  // ---- Deck B as video playlist (Q4) ----

  getVideoDeck(): VideoDeck { return this.videoDeck }

  /**
   * Patch the playlist; the render loop reconciles the <video> with it.
   * A bare `clip` (UI jump) starts that clip now, on the current beat.
   */
  setVideoDeck(patch: Partial<VideoDeck>) {
    if (patch.clip !== undefined && patch.clipStartBeat === undefined) patch = { ...patch, clipStartBeat: this.beatClock, bars: 0 }
    const next = clampClip({ ...this.videoDeck, ...patch })
    if (next.clip !== this.videoDeck.clip || next.clipStartBeat !== this.videoDeck.clipStartBeat) this.deckVideoSeek = true
    this.videoDeck = next
    this.emitState()
  }

  /** Native BPM defaults to the BPM playing now, so a clip added live runs at rate 1. */
  addVideoClips(files: { name: string; path: string }[]) {
    const bpm = Math.round(this.audioAnalyzer.getData().bpm || 128)
    const clips = [...this.videoDeck.clips, ...files.map(f => ({ path: f.path, name: f.name, bpm }))]
    this.setVideoDeck({ clips, enabled: true })
  }

  private syncDeckVideo(state: VideoDeck) {
    const wasStart = this.videoDeck.clipStartBeat
    this.videoDeck = state
    if (state.clipStartBeat !== wasStart) this.deckVideoSeek = true
  }

  /** The <video> lives as long as the deck is in video mode; clips swap its src. */
  private loadDeckClip(path: string) {
    this.deckVideoPath = path
    if (!this.deckVideo) {
      const v = document.createElement('video')
      v.muted = true; v.playsInline = true; v.loop = true
      this.deckVideo = v
      this.deckVideoTex = new THREE.VideoTexture(v)
      this.deckVideoTex.minFilter = THREE.LinearFilter
      this.deckVideoTex.magFilter = THREE.LinearFilter
    }
    const v = this.deckVideo
    // Same streaming protocol as the video overlays (see addVideoOverlay).
    // HAP/ProRes clips fail here: Chromium has no decoder, see videoDeck.ts.
    v.onerror = () => console.error('[Engine] deck video illeggibile (mp4 H.264 / webm):', path)
    v.src = `djg-media://f/?p=${encodeURIComponent(path)}`
    this.deckVideoSeek = true
    v.play().catch(err => console.error('[Engine] deck video play failed:', err))
  }

  /**
   * Per frame: load the clip the deck wants, pin playbackRate to the BPM and
   * keep currentTime on the beat grid. Both windows run this on their own
   * <video>; the output's beatClock arrives over IPC a frame late, and seeks
   * land on a keyframe, so a drift of a few frames between control and
   * projector is expected — anything past a quarter second gets re-seeked.
   */
  private tickDeckVideo(bpm: number): THREE.Texture | null {
    const d = this.videoDeck
    const clip = d.enabled ? d.clips[d.clip] : undefined
    if (!clip) {
      if (this.deckVideo && this.deckVideoPath) { this.deckVideo.pause(); this.deckVideo.removeAttribute('src'); this.deckVideoPath = '' }
      return null
    }
    if (clip.path !== this.deckVideoPath) this.loadDeckClip(clip.path)
    const v = this.deckVideo!
    const rate = playbackRate(bpm, clip.bpm)
    if (Math.abs(v.playbackRate - rate) > 0.01) v.playbackRate = rate
    if (v.readyState >= 1 && v.duration > 0) {
      const want = clipTime(this.beatClock, d.clipStartBeat, clip.bpm, v.duration)
      if (this.deckVideoSeek || loopDrift(v.currentTime, want, v.duration) > 0.25) {
        v.currentTime = want
        this.deckVideoSeek = false
      }
      if (v.paused) v.play().catch(() => {})
    }
    return v.readyState >= 2 ? this.deckVideoTex : null
  }

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

  /** Beat-roll: 4, 8 or 16 loops the effect clock over that fraction of a beat; 0 lets it run. */
  setBeatRoll(division: 0 | 4 | 8 | 16) {
    if (division === this.rollDivision) return
    if (division > 0 && this.rollDivision === 0) {
      // the loop starts from the frame on screen now, so the roll stutters
      // on what the room was looking at
      this.rollWallStart = performance.now()
      this.rollEffectBase = this.effectTime
      this.rollBeatBase = this.beatClock
    } else if (division > 0) {
      // changing the division mid-roll keeps the same start
    }
    this.rollDivision = division
    this.emitState()
  }
  getBeatRoll(): number { return this.rollDivision }

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
    if (state.customShader) {
      this.setCustomShader(state.customShader, state.customParams || [], state.customImageInputs || [])
      for (const [n, d] of Object.entries(state.customImages || {})) this.setCustomImage(n, d)
    }
    else if (state.activeEffect) this.setEffect(state.activeEffect)
    if (state.activePost) this.setActivePosts(state.activePost, state.postAmounts)
    if (state.colors) {
      this.setColors(state.colors[0], state.colors[1], state.colors[2])
      // jump, don't lerp, on boot
      for (let i = 0; i < 3; i++) this.colors[i].copy(this.targetColors[i])
    }
    if (state.deckBEffect) this.setDeckBEffect(state.deckBEffect)
    if (typeof state.crossfade === 'number') this.setCrossfade(state.crossfade)
    if (state.blendMode && BLEND_MODES.includes(state.blendMode)) this.blendMode = state.blendMode
    if (typeof state.maskSoft === 'number') this.maskSoft = state.maskSoft
    if (state.videoDeck) this.videoDeck = clampClip({ ...VIDEO_DECK_DEFAULT, ...state.videoDeck, clip: 0, clipStartBeat: 0, bars: 0 })
    if (typeof state.brightness === 'number') this.brightness = state.brightness
    if (typeof state.motionBlur === 'number') this.motionBlur = state.motionBlur
    if (state.grade) this.setGrade(state.grade)
    if (state.effectParams) this.paramState = state.effectParams
    if (state.transitionType) this.transitionType = state.transitionType
    if (typeof state.transitionBeatSync === 'boolean') this.transitionBeatSync = state.transitionBeatSync
    if (typeof state.colorSpeed === 'number') this.setColorTransitionSpeed(state.colorSpeed)
    if (typeof state.intensity === 'number') this.intensity = state.intensity
    if (state.camera) this.cameraState = { ...CAMERA_NEUTRAL, ...state.camera }
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
  setAudioData(data: { bass: number; mid: number; high: number; energy: number; beatPulse: number; bpm: number; beatDetected: boolean; beatPhase?: number; barPhase?: number; sub?: number; presence?: number; bassHit?: number; midHit?: number; highHit?: number; beatClock?: number; effectTime?: number; spectrum?: Uint8Array }) {
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
    if (typeof data.beatClock === 'number') this.beatClock = data.beatClock
    if (data.spectrum && data.spectrum.length === this.spectrumPixels.length) {
      this.spectrumPixels.set(data.spectrum)
      if (this.spectrumTex) this.spectrumTex.needsUpdate = true
    }
    if (typeof data.effectTime === 'number') this.effectTime = data.effectTime
    if (data.beatDetected) this.pendingBeat = true
  }

  /** Apply engine state received over IPC (output window) */
  applyRemoteState(state: EngineState) {
    this.remoteStateCount++
    if (state.effectParams) this.paramState = state.effectParams
    if (state.customShader) {
      // Recompile only when the source actually changed — the shader now
      // rides every snapshot, and validation renders are not free
      if (!this.usingCustom || state.customShader !== this.customShaderSource) {
        this.setCustomShader(state.customShader, state.customParams || [], state.customImageInputs || [])
      }
      if (state.customImages) {
        for (const [n, d] of Object.entries(state.customImages)) {
          if (this.customImages[n] !== d) this.setCustomImage(n, d)
        }
      }
    } else {
      // Transition params always come from the control window
      if (state.transition) this.transitionType = state.transition.type
      this.transitionDuration = state.transition ? state.transition.duration : 0
      if (state.activeEffect) this.setEffect(state.activeEffect)
    }
    if (typeof state.colorSpeed === 'number') this.setColorTransitionSpeed(state.colorSpeed)
    if (typeof state.intensity === 'number') this.intensity = state.intensity
    if (state.camera) this.cameraState = { ...CAMERA_NEUTRAL, ...state.camera }
    if (state.activePost) this.setActivePosts(state.activePost, state.postAmounts)
    if (state.colors) this.setColors(state.colors[0], state.colors[1], state.colors[2])

    if (state.deckBEffect && state.deckBEffect !== this.deckBEffect) this.setDeckBEffect(state.deckBEffect)
    if (typeof state.crossfade === 'number') this.setCrossfade(state.crossfade)
    if (state.blendMode && BLEND_MODES.includes(state.blendMode)) this.blendMode = state.blendMode
    if (typeof state.maskSoft === 'number') this.maskSoft = state.maskSoft
    if (state.videoDeck) this.syncDeckVideo(state.videoDeck)
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
      // Streamed by main over djg-media:// — reading the file into a Blob meant
      // a full copy in RAM per window (see src/main/index.ts).
      // Reading it also used to REJECT on a missing file, which is what told the
      // caller to warn the user; a src that streams fails silently instead, so
      // wait for the metadata and turn an error back into a rejection.
      video.src = `djg-media://f/?p=${encodeURIComponent(source.path)}`
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error(`video illeggibile: ${source.path}`))
      })
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

  /** Text rendered to a canvas, then straight into the normal overlay pipeline. */
  addTextOverlay(
    text: string,
    opts?: { font?: string; color?: string; size?: number },
    existingId?: string
  ): OverlayItem {
    const id = existingId || `overlay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const size = opts?.size ?? 120
    const font = `bold ${size}px ${opts?.font ?? 'sans-serif'}`
    const color = opts?.color ?? '#ffffff'
    const letterSpacing = `${Math.round(size * 0.04)}px`

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    ctx.font = font
    ctx.letterSpacing = letterSpacing
    const pad = Math.round(size * 0.25)
    canvas.width = Math.max(2, Math.ceil(ctx.measureText(text).width) + pad * 2)
    canvas.height = Math.ceil(size * 1.4)
    // resizing the canvas resets the context state
    ctx.font = font
    ctx.letterSpacing = letterSpacing
    ctx.fillStyle = color
    ctx.textBaseline = 'middle'
    ctx.fillText(text, pad, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    const source = { kind: 'text' as const, text, font: opts?.font, color, size }
    const overlay: OverlayItem = {
      id, name: text, dataUrl: '',
      opacity: 1.0, scale: 0.3, offsetX: 0, offsetY: 0,
      visible: true, gifSync: 'free', displace: 0,
      source,
      _texture: texture,
      _canvas: canvas,
    }
    this.overlays.push(overlay)

    if (!this.remote) {
      try {
        window.api?.sendOverlayAdd({
          id, name: text, dataUrl: '', opacity: overlay.opacity, scale: overlay.scale,
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
      if (!this.remote) this.queueOverlayIpc(id, updates)
    }
  }

  private overlayIpcPending = new Map<string, Record<string, unknown>>()
  private overlayIpcTimer = 0

  /**
   * Dragging an overlay slider fires one input event per frame; sending each
   * one straight over IPC was 60 messages a second per slider. The same
   * sliders on the phone were already throttled server-side — this brings the
   * desktop in line. Merged per overlay, flushed at ~30Hz.
   */
  private queueOverlayIpc(id: string, updates: Record<string, unknown>) {
    const prev = this.overlayIpcPending.get(id)
    this.overlayIpcPending.set(id, prev ? { ...prev, ...updates } : { ...updates })
    if (this.overlayIpcTimer) return
    this.overlayIpcTimer = window.setTimeout(() => {
      this.overlayIpcTimer = 0
      for (const [oid, u] of this.overlayIpcPending) {
        try { window.api?.sendOverlayUpdate(oid, u) } catch (_) {}
      }
      this.overlayIpcPending.clear()
    }, 33)
  }

  // ---- Preset API ----

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
      maskSoft: this.maskSoft,
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
    if (preset.blendMode && BLEND_MODES.includes(preset.blendMode)) this.blendMode = preset.blendMode
    if (typeof preset.maskSoft === 'number') this.maskSoft = preset.maskSoft
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
      // An id this build doesn't have (preset from an older version, effect
      // since removed) makes setEffect a no-op — but the post chain and the
      // colours above already changed, and without this nobody hears about it:
      // the projector would keep the old post FX.
      if (!EFFECT_SHADERS[preset.effect]) this.emitState()
    }
  }

  getCurrentEffect(): EffectId { return this.currentEffect }
  getActivePosts(): PostId[] { return this.postChain.map(p => p.id) }
  /** Live smoothed audio levels (already envelope-followed) — for DMX etc. */
  getAudioLevels(): { bass: number; mid: number; high: number; energy: number; beatPulse: number } {
    return { bass: this.smoothBass, mid: this.smoothMid, high: this.smoothHigh, energy: this.smoothEnergy, beatPulse: this.beatPulse }
  }

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
      // TARGET palette, not the mid-lerp colours: the snapshot is event-driven
      // (emitted at setColors/advanceCycle time, before any lerp ran), so the
      // current colours were the OLD palette and the output window, which lerps
      // on its own, stayed on it until the next unrelated emit.
      colors: this.targetColors.map(c => '#' + c.getHexString()) as [string, string, string],
      beatPulse: this.beatPulse,
      energy: this.smoothEnergy,
      bpm: this.audioAnalyzer.getData().bpm,
      deckBEffect: this.deckBEffect,
      crossfade: this.crossfade,
      blendMode: this.blendMode,
      maskSoft: this.maskSoft,
      videoDeck: this.videoDeck,
      brightness: this.brightness,
      blackout: this.blackout,
      frozen: this.frozen,
      motionBlur: this.motionBlur,
      grade: { ...this.grade },
      effectParams: this.paramState,
      paramDefs: this.getParamDefs(),
      // The output window resolves params with its own audio, so the macro has
      // to travel: without it the projector shows the un-boosted scene.
      intensity: this.intensity,
      camera: { ...this.cameraState },
      // Custom shader must ride the snapshot: any emit without it used to
      // revert the output window to the stock effect (show-breaking)
      customShader: this.usingCustom ? this.customShaderSource : undefined,
      customParams: this.usingCustom ? this.customParamDefs : undefined,
      customImageInputs: this.usingCustom ? this.customImageInputs : undefined,
      customImages: this.usingCustom ? this.customImages : undefined,
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

  /**
   * Run several setters as a single state change. Applying an AutoVJ scene
   * calls setEffect plus a setter per param, and each one emitted a full
   * snapshot — every panel listening rebuilt itself ten times in one frame.
   */
  batch(fn: () => void) {
    this.emitDepth++
    try { fn() } finally {
      this.emitDepth--
      if (this.emitDepth === 0 && this.emitPending) {
        this.emitPending = false
        this.emitState()
      }
    }
  }

  private emitDepth = 0
  private emitPending = false

  private emitState() {
    if (this.remote) return
    if (this.emitDepth > 0) { this.emitPending = true; return }
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
    if (!this.watchdogId) this.startWatchdog()
    this.rafDriven = true
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

  private updatePerfScale() {
    const nowMs = performance.now()
    // Timer-driven frames (rAF suspended by the OS) are paced by the watchdog,
    // not by the GPU: measuring them would read as overload and collapse the
    // projector's resolution for no reason. They must not move perfLastNow
    // either — the next rAF frame would then measure the gap to the timer frame
    // (sub-millisecond) instead of the real frame time, dragging the EMA to
    // zero and disabling dynamic resolution entirely.
    if (!this.rafDriven) return
    const last = this.perfLastNow
    this.perfLastNow = nowMs
    if (!last) return
    const d = Math.min(nowMs - last, 100)
    // a lone spike is a shader compile or a GC pause, not GPU load — skip it
    // (only one in a row: sustained slowness must still raise the EMA)
    if (d > Math.max(40, this.perfEmaMs * 3) && !this.perfSpikeLast) {
      this.perfSpikeLast = true
      return
    }
    this.perfSpikeLast = false
    this.perfEmaMs = this.perfEmaMs * 0.9 + d * 0.1
    if (--this.perfCooldown > 0) return
    // resizing render targets discards them — never mid-transition
    if (this.transitionProgress >= 0) return
    if (this.perfEmaMs > 24 && this.perfScale > 0.3) {
      // under ~42fps: step proportional to how late we are, so a volumetric
      // raymarcher at 15fps converges in 2 steps instead of crawling down.
      // (a 30Hz display lands here too — softer buffers there are invisible)
      const step = Math.max(0.55, Math.min(0.9, Math.sqrt(16.7 / this.perfEmaMs)))
      this.perfScale = Math.max(0.3, this.perfScale * step)
      this.perfCooldown = this.perfEmaMs > 40 ? 20 : 45
      this.setRenderSize(this.outputWidth, this.outputHeight)
      console.warn(`[Engine] perf: render scale ${Math.round(this.perfScale * 100)}% (frame ${this.perfEmaMs.toFixed(1)}ms)`)
    } else if (this.perfEmaMs < 17 && this.perfScale < 1) {
      // headroom: climb back slowly, long cooldown so it can't oscillate
      this.perfScale = Math.min(1, this.perfScale / 0.85)
      this.perfCooldown = 300
      this.setRenderSize(this.outputWidth, this.outputHeight)
    }
  }

  private lastFrameAt = 0
  private watchdogId = 0
  private rafDriven = true

  /**
   * The projector must never stop painting. macOS/Chromium suspends
   * requestAnimationFrame for a window it considers not visible (covered by a
   * fullscreen app, occluded, display asleep): the rAF chain dies and the
   * projector stays frozen on whatever it drew last — usually black, because
   * the freeze happens before the first state arrives over IPC.
   * A timer keeps the frame going whenever rAF goes quiet.
   */
  private startWatchdog() {
    if (this.watchdogId || !this.remote) return
    this.watchdogId = window.setInterval(() => {
      if (this.disposed) return
      // rAF healthy → nothing to do (this is just a timestamp compare).
      // The threshold must clear a whole rAF period or the timer fires between
      // every pair of rAF frames and the projector draws twice the frames it
      // needs: 16.7ms at 60Hz, 33.3ms on a 4K projector running at 30Hz.
      if (performance.now() - this.lastFrameAt < 40) return
      this.rafDriven = false   // timer frames must not be read as GPU overload
      try { this.renderFrame() } catch (e) { console.error('[Engine] watchdog frame error:', e) }
    }, 8)
  }

  /**
   * The projector's drawing buffer must match the letterbox even when no
   * resize event ever fires (window laid out late, macOS fullscreen
   * transitions on a secondary display). The render loop is the only thing
   * guaranteed to run, so it owns the last word on sizing.
   */
  private ensureRemoteSize() {
    const winW = window.innerWidth
    const winH = window.innerHeight
    if (!(winW > 1) || !(winH > 1)) return
    const outAspect = this.outputWidth > 0 && this.outputHeight > 0
      ? this.outputWidth / this.outputHeight
      : winW / winH
    let w = winW
    let h = winH
    if (w / h > outAspect) w = Math.round(h * outAspect)
    else h = Math.round(w / outAspect)
    w = Math.max(2, w)
    h = Math.max(2, h)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.renderer.setSize(w, h)
      this.setRenderSize(this.outputWidth, this.outputHeight)
    }
  }

  /** One-line health summary: what a black projector needs to explain itself */
  health(): string {
    const u = this.masterMaterial?.uniforms
    return [
      `frames=${this.frameCounter}`,
      `canvas=${this.canvas.width}x${this.canvas.height}`,
      `out=${this.outputWidth}x${this.outputHeight}`,
      `scale=${this.perfScale.toFixed(2)}`,
      `effect=${this.currentEffect}${this.usingCustom ? '(custom)' : ''}`,
      `brightness=${this.brightness.toFixed(2)}`,
      `blackout=${this.blackout}`,
      `frozen=${this.frozen}`,
      `masterBrightness=${u?.uBrightness?.value ?? '?'}`,
      `lastFrameAgo=${Math.round(performance.now() - this.lastFrameAt)}ms`,
      `stateReceived=${this.remoteStateCount}`,
      // a simulation that silently runs at the wrong grid size looks like a
      // different effect, and nothing else in the log would say so
      ...(() => {
        const c = this.chains.get(this.mainMaterial)
        if (!c) return []
        return [`sim=${[...c.buffers].map(([n, b]) => `${n}:${b.read.width}x${b.read.height}`).join(',')}@f${c.frames}`]
      })(),
    ].join(' ')
  }

  private frameCounter = 0
  private remoteStateCount = 0

  /** Frames rendered so far; two reads a second apart give the real fps */
  get frames(): number { return this.frameCounter }

  private renderFrame() {
    this.frameCounter++
    this.lastFrameAt = performance.now()
    if (this.remote) this.ensureRemoteSize()
    this.updatePerfScale()
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
      this.bassRaw = audio.bassRaw
      this.energyRaw = audio.energyRaw
      this.key = audio.key
      this.bassHit = audio.bassHit
      this.midHit = audio.midHit
      this.highHit = audio.highHit
      this.packSpectrum(audio.spectrum, audio.waveform, audio.binHz)

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

    // Deck B video: change clip on the bar, every N bars (control decides, output mirrors)
    if (!this.remote && this.videoDeck.enabled && barWrapped(this.prevBarPhase, this.barPhase)) {
      const next = onBar(this.videoDeck, this.beatClock)
      if (next.clipStartBeat !== this.videoDeck.clipStartBeat) { this.videoDeck = next; this.deckVideoSeek = true; this.emitState() }
      else this.videoDeck = next
    }
    this.prevBarPhase = this.barPhase

    // Per-frame audio listeners (AutoVJ, playlist beat-advance)
    for (const fn of this.audioFrameListeners) {
      fn(beatDetected, this.smoothEnergy, this.smoothBass, this.barPhase, this.bassRaw, this.energyRaw, this.key)
    }
    // after the listeners: App has just pushed this frame's phase
    if (!this.remote) {
      const a = this.audioAnalyzer
      const ev = this.trackChange.update({
        t: this.lastFrameAt, bpm, phase: this.phase, key: this.key,
        bpmConfidence: a.getBpmMode() === 'auto' ? a.getBpmConfidence() : 1,
      })
      if (ev) this.emitTrackChange(ev)
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
      if (def.key === 'speed') speed = this.effParamValue(def)
      else if (def.key === 'reactivity') this.audioScale = this.effParamValue(def)
    }
    this.applyParams(this.mainMaterial)
    if (this.rollDivision > 0) {
      // division 4 = a quarter of a beat (a sixteenth note), 8 an eighth, 16 a sixteenth
      const loopSec = (60 / (bpm || 128)) / this.rollDivision
      const into = ((performance.now() - this.rollWallStart) / 1000) % loopSec
      this.effectTime = this.rollEffectBase + into * speed
      this.beatClock = this.rollBeatBase + into * ((bpm || 128) / 60)
    } else {
      this.effectTime += dt * speed
    }

    // Update main effect uniforms
    this.applyEffectUniforms(this.mainMaterial, time)

    // Blackout: paint black, skip the whole pipeline — the GPU idles while
    // the room is dark instead of rendering frames multiplied by zero
    if (this.blackout && !this.freezeRequested) {
      this.renderMaster(this.rtA.texture) // masterMaterial outputs black when blackout
      this.syncAudioToOutput(bpm, beatDetected)
      return
    }

    // Frozen: keep showing the captured frame, skip the whole pipeline
    if (this.frozen && !this.freezeRequested) {
      this.renderMaster(this.rtFreeze.texture)
      this.syncAudioToOutput(bpm, beatDetected)
      return
    }

    // Deck A → rtA (simulation passes first, then the quad or the geometry)
    this.renderEffect(this.mainMaterial, this.rtA)

    // Effect transition blending
    if (this.transitionProgress >= 0 && this.transitionOldMaterial) {
      this.transitionProgress += dt / Math.max(this.transitionDuration, 0.01)

      if (this.transitionProgress >= 1) {
        // Transition complete
        this.disposeEffectMaterial(this.transitionOldMaterial)
        this.transitionOldMaterial = null
        this.transitionProgress = -1
      } else {
        // Render old effect → rtTransition
        this.applyEffectUniforms(this.transitionOldMaterial, time)
        this.renderEffect(this.transitionOldMaterial, this.rtTransition)

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

    // Deck B + crossfader. In video mode the clip is blitted into the same
    // target, so blends and masks see no difference between effect and video.
    // ponytail: the blit stretches to the deck's aspect; a 9:16 clip on a 16:9
    // output gets squashed — add a cover-fit UV in passthrough if it matters.
    const videoMode = this.videoDeck.enabled && this.videoDeck.clips.length > 0
    const deckVideoTex = (this.crossfade > 0.001 || videoMode) ? this.tickDeckVideo(bpm) : null
    if (this.crossfade > 0.001 && (this.deckBMaterial || videoMode)) {
      if (deckVideoTex) this.blit(deckVideoTex, this.rtDeckB)
      else if (!videoMode) {
        this.applyEffectUniforms(this.deckBMaterial!, time)
        this.renderEffect(this.deckBMaterial!, this.rtDeckB)
      }
      // video mode with no frame yet (src just swapped): rtDeckB keeps the last
      // frame, so a clip change holds the picture instead of flashing the effect.
      // ponytail: that hold is ~100-300 ms on a local file; preload the next clip
      // in a second <video> if it reads as a hiccup.

      const du = this.deckMixMaterial.uniforms
      du.tDeckA.value = this.rtA.texture
      du.tDeckB.value = this.rtDeckB.texture
      du.uMix.value = this.crossfade
      const bi = Math.max(0, BLEND_MODES.indexOf(this.blendMode))
      du.uBlend.value = bi < MASK_FIRST ? bi : 0
      du.uMaskMode.value = bi < MASK_FIRST ? 0 : bi - MASK_FIRST + 1
      du.uMaskSoft.value = this.maskSoft
      this.applyEffectUniforms(this.deckMixMaterial, time)   // uBass/uBeat/uResolution for the masks
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

    // Master camera — before the post chain, so everything downstream sees
    // the framing the VJ chose, and skipped completely when it is neutral.
    if (this.cameraActive()) {
      const cu = this.cameraMaterial.uniforms
      cu.tDiffuse.value = this.rtA.texture
      cu.uResolution.value.copy(this.resolution)
      cu.uZoom.value = this.cameraState.zoom
      cu.uRotation.value = this.cameraState.rotation * Math.PI / 180
      cu.uPan.value.set(this.cameraState.panX, this.cameraState.panY)
      cu.uTile.value = this.cameraState.tile
      cu.uPushAmt.value = this.cameraState.push
      cu.uBeat.value = this.beatPulse
      this.renderPass(this.cameraMaterial, this.rtB)
      this.blit(this.rtB.texture, this.rtA)
    }

    // Post-processing chain — ordered, each with its own wet/dry
    let read = this.rtA
    let write = this.rtB

    for (const entry of this.postChain) {
      const mat = this.postMaterials.get(entry.id)
      if (!mat) continue
      // The macro reads here and not on entry.amount itself, so letting the
      // fader go gives back the wet the user dialled in.
      const wet = this.wetWithIntensity(entry.amount)
      if (wet < 0.01) continue // dry pass: full GPU cost, zero visible effect

      if (entry.id === 'bloom') {
        this.renderBloom(read, write, wet)
      } else {
        const pu = mat.uniforms
        pu.tDiffuse.value = read.texture
        if (pu.uWet) pu.uWet.value = wet
        if (pu.uBass) pu.uBass.value = this.smoothBass
        if (pu.uMid) pu.uMid.value = this.smoothMid
        if (pu.uHigh) pu.uHigh.value = this.smoothHigh
        if (pu.uEnergy) pu.uEnergy.value = this.smoothEnergy
        if (pu.uBeat) pu.uBeat.value = this.beatPulse
        if (pu.uHighHit) pu.uHighHit.value = this.highHit
        if (pu.uTime) pu.uTime.value = time
        if (entry.id === 'rgb-delay') this.feedRgbDelay(read, wet)
        // amount grezzo, senza la macro intensita': chi lo legge sceglie un
        // modo a scaglioni (mirror), e il fader non deve cambiargli modo
        if (pu.uLevel) pu.uLevel.value = entry.amount
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
  /** Push the active effect's param values onto one of its pass materials */
  private applyParams(mat: THREE.ShaderMaterial) {
    for (const def of this.getParamDefs()) {
      if (def.key === 'speed' || def.key === 'reactivity') continue
      const u = mat.uniforms[def.key]
      if (u) u.value = this.effParamValue(def)
    }
  }

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
    if (u.uBeatClock) u.uBeatClock.value = this.beatClock
    if (u.uSpectrum) u.uSpectrum.value = this.getSpectrumTexture()
    if (u.uSub) u.uSub.value = this.smoothSub * k
    if (u.uPresence) u.uPresence.value = this.smoothPresence * k
    if (u.uBassHit) u.uBassHit.value = this.bassHit * k
    if (u.uMidHit) u.uMidHit.value = this.midHit * k
    if (u.uHighHit) u.uHighHit.value = this.highHit * k
    if (u.uBassTime) u.uBassTime.value = this.bassTime
    if (u.uHighTime) u.uHighTime.value = this.highTime
    if (u.uResolution) u.uResolution.value = this.resolution
    if (u.uFrame) u.uFrame.value = this.frameCounter
  }

  /**
   * Draw one effect into a target: its simulation passes first, then either the
   * fullscreen quad or, for a geometry effect, its own scene. Every place that
   * renders an effect goes through here — main deck, deck B, and the outgoing
   * effect during a transition.
   */
  private renderEffect(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget) {
    this.runChain(mat)
    const geo = this.geometries.get(mat)
    this.renderer.setRenderTarget(target)
    if (geo) {
      // geometry leaves gaps where a fullscreen quad would have overwritten
      // every pixel, so this one does need a clear
      this.renderer.setClearColor(0x000000, 1)
      this.renderer.clear(true, false, false)
      this.renderer.render(geo.scene, this.camera)
    } else {
      this.quad.material = mat
      this.renderer.render(this.scene, this.camera)
      this.quad.material = this.mainMaterial
    }
  }

  /**
   * rgb-delay history. Three half-res slots advanced every `stride` frames:
   * G reads the slot one step back, B two steps back, so at 60 fps G lags
   * `stride` frames and B `2*stride` (stride 1..4 from amount, B up to 8).
   * ponytail: a slot held for `stride` frames steps instead of sliding; a
   * ring of 2*stride+1 slots advanced every frame would slide.
   */
  private feedRgbDelay(read: THREE.WebGLRenderTarget, amount: number) {
    const stride = 1 + Math.round(amount * 3)
    // Not fed last frame (just switched on, or a dry pass): the slots hold
    // whatever was on screen when it went off — prime all three with now.
    const stale = this.frameCounter - this.rgbDelayLastFrame > 1
    this.rgbDelayLastFrame = this.frameCounter
    if (stale || ++this.rgbDelayTick >= stride) {
      this.rgbDelayTick = 0
      this.rgbDelayHead = (this.rgbDelayHead + 1) % 3
      for (const [i, rt] of this.rtDelay.entries()) {
        if (stale || i === this.rgbDelayHead) this.blit(read.texture, rt)
      }
    }
    const u = this.postMaterials.get('rgb-delay')!.uniforms
    u.tDelay1.value = this.rtDelay[(this.rgbDelayHead + 2) % 3].texture
    u.tDelay2.value = this.rtDelay[(this.rgbDelayHead + 1) % 3].texture
  }

  /** Render a fullscreen material into a target (null = screen) */
  private renderPass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.postQuad.material = mat
    this.renderer.setRenderTarget(target)
    // no clear: the opaque fullscreen quad overwrites every pixel
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
    this.samplePixelMap()

    // Screenshot must read the buffer in the same task as the render.
    // A list, not a slot: saving a look and capturing an effect thumbnail can
    // both be pending, and with one slot the first promise never resolves.
    if (this.screenshotCbs.length) {
      const cbs = this.screenshotCbs
      this.screenshotCbs = []
      this.canvas.toBlob(b => { for (const cb of cbs) cb(b) }, 'image/png')
    }
    // Same rule for anyone copying the frame elsewhere (the reel's 9:16 canvas):
    // after this task the drawing buffer is gone.
    for (const fn of this.frameRenderedListeners) fn(this.canvas)
  }

  private screenshotCbs: ((blob: Blob | null) => void)[] = []
  private frameRenderedListeners = new Set<(canvas: HTMLCanvasElement) => void>()

  /** Called right after each frame hits the canvas, while its pixels are still readable. */
  onFrameRendered(fn: (canvas: HTMLCanvasElement) => void): () => void {
    this.frameRenderedListeners.add(fn)
    return () => { this.frameRenderedListeners.delete(fn) }
  }

  // ---- Pixel map (I6): the master frame at the LED panel's resolution ----
  private pixelRT: THREE.WebGLRenderTarget | null = null
  private pixelBuf: Uint8Array | null = null
  private pixelCfg: { cols: number; rows: number; fps: number } | null = null
  private pixelLastAt = 0
  private pixelBusy = false
  /** rgba, GL row order (bottom first); the renderer packs it into universes */
  public onPixelFrame: ((rgba: Uint8Array, cols: number, rows: number) => void) | null = null

  /** null turns it off and frees the target */
  setPixelMap(cfg: { cols: number; rows: number; fps: number } | null) {
    if (this.remote) return
    if (!cfg) {
      this.pixelRT?.dispose(); this.pixelRT = null; this.pixelBuf = null; this.pixelCfg = null
      return
    }
    if (!this.pixelRT || this.pixelRT.width !== cfg.cols || this.pixelRT.height !== cfg.rows) {
      this.pixelRT?.dispose()
      // linear filtering: each LED is the average of its patch of the frame, not one texel
      this.pixelRT = new THREE.WebGLRenderTarget(cfg.cols, cfg.rows, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false,
      })
      this.pixelBuf = new Uint8Array(cfg.cols * cfg.rows * 4)
    }
    this.pixelCfg = cfg
  }

  private samplePixelMap() {
    const cfg = this.pixelCfg
    if (!cfg || !this.pixelRT || !this.pixelBuf || this.pixelBusy || !this.onPixelFrame) return
    const now = performance.now()
    if (now - this.pixelLastAt < 1000 / cfg.fps) return
    this.pixelLastAt = now
    // the master pass again, into the small target: same brightness, same
    // blackout, same grade the projector shows. The texture is still bound.
    this.renderPass(this.masterMaterial, this.pixelRT)
    this.renderer.setRenderTarget(null)
    this.pixelBusy = true
    // async readback: no GPU stall on the render thread (three 0.170)
    this.renderer.readRenderTargetPixelsAsync(this.pixelRT, 0, 0, cfg.cols, cfg.rows, this.pixelBuf)
      .then(() => { this.onPixelFrame?.(this.pixelBuf!, cfg.cols, cfg.rows) })
      .catch(() => { /* a lost context; the next frame tries again */ })
      .finally(() => { this.pixelBusy = false })
  }

  /** Capture the next rendered frame as a PNG blob */
  screenshot(): Promise<Blob | null> {
    return new Promise(resolve => { this.screenshotCbs.push(resolve) })
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
        // Both windows accumulated these on their own, so the LFO phase and the
        // effect clock drifted apart within minutes — the control window's
        // value is the authority, local accumulation just fills the gaps
        beatClock: this.beatClock,
        effectTime: this.effectTime,
        // the packed texture bytes, not the raw bins: the projector gets
        // exactly the picture the control window is drawing, no second pack
        spectrum: this.spectrumPixels,
        bpm,
        beatDetected,
      })
    } catch (_) {}
  }

  dispose() {
    this.disposed = true
    this.audioFrameListeners.clear()
    this.trackChangeListeners.clear()
    this.frameRenderedListeners.clear()
    cancelAnimationFrame(this.animFrameId)
    if (this.watchdogId) { clearInterval(this.watchdogId); this.watchdogId = 0 }
    if (this.overlayIpcTimer) { clearTimeout(this.overlayIpcTimer); this.overlayIpcTimer = 0 }
    window.removeEventListener('resize', this.handleResize)
    this.renderer.dispose()
    this.rtA.dispose()
    this.rtB.dispose()
    this.rtPrev.dispose()
    this.rtTransition.dispose()
    this.disposeEffectMaterial(this.mainMaterial)
    this.passthroughMaterial.dispose()
    this.cameraMaterial.dispose()
    this.transitionMaterial.dispose()
    this.disposeEffectMaterial(this.transitionOldMaterial)
    this.overlayMaterial.dispose()
    this.overlays.forEach(o => this.teardownOverlay(o))
    this.overlays = []
    this.postMaterials.forEach(m => m.dispose())
    for (const rt of [this.rtDeckB, this.rtFreeze, this.rtAccum, this.rtAccum2, this.rtBloomA, this.rtBloomB, ...this.rtDelay]) rt.dispose()
    this.disposeEffectMaterial(this.deckBMaterial)
    this.deckMixMaterial.dispose()
    if (this.deckVideo) { this.deckVideo.pause(); this.deckVideo.removeAttribute('src'); this.deckVideo = null }
    this.deckVideoTex?.dispose(); this.deckVideoTex = null
    this.masterMaterial.dispose()
    this.pixelRT?.dispose()
    this.motionBlurMaterial.dispose()
    this.bloomPrefilterMaterial.dispose()
    this.blurMaterial.dispose()
    this.quadGeometry.dispose()
    this.postGeometry.dispose()
    this.whiteTexture?.dispose()
    this.spectrumTex?.dispose()
    for (const t of Object.values(this.customTextures)) t.dispose()
    this.customTextures = {}
    this.stateListeners.clear()
  }
}
