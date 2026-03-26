import * as THREE from 'three'
import { AudioAnalyzer } from './audio/AudioAnalyzer'
import { GifDecoder, GifFrame } from './GifDecoder'

import tunnelFrag from './shaders/tunnel.frag?raw'
import kaleidoscopeFrag from './shaders/kaleidoscope.frag?raw'
import warpFrag from './shaders/warp.frag?raw'
import plasmaFrag from './shaders/plasma.frag?raw'
import matrixFrag from './shaders/matrix.frag?raw'
import voronoiFrag from './shaders/voronoi.frag?raw'
import rgbsplitFrag from './shaders/rgbsplit.frag?raw'
import bloomFrag from './shaders/bloom.frag?raw'
import feedbackFrag from './shaders/feedback.frag?raw'
import chromaticFrag from './shaders/chromatic.frag?raw'
import overlayFrag from './shaders/overlay.frag?raw'

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
  // Internal — managed by engine
  _texture?: THREE.Texture
  _canvas?: HTMLCanvasElement
  _isGif?: boolean
  _gifFrames?: GifFrame[]
  _gifFrameIndex?: number
  _gifLastAdvance?: number
}

export type EffectId = 'tunnel' | 'kaleidoscope' | 'warp' | 'plasma' | 'matrix' | 'voronoi'
export type PostId = 'bloom' | 'rgb-split' | 'chromatic' | 'feedback'

export interface EngineState {
  activeEffect: EffectId
  activePost: PostId[]
  colors: [string, string, string]
  beatPulse: number
  energy: number
  bpm: number
}

const EFFECT_SHADERS: Record<EffectId, string> = {
  tunnel: tunnelFrag,
  kaleidoscope: kaleidoscopeFrag,
  warp: warpFrag,
  plasma: plasmaFrag,
  matrix: matrixFrag,
  voronoi: voronoiFrag,
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

  // Post processing
  private postScene: THREE.Scene
  private postQuad: THREE.Mesh

  // Current state
  private currentEffect: EffectId = 'tunnel'
  private mainMaterial: THREE.ShaderMaterial
  private postMaterials: Map<PostId, THREE.ShaderMaterial> = new Map()
  private activePostEffects: Set<PostId> = new Set(['bloom'])

  private colors: THREE.Color[] = [
    new THREE.Color(DEFAULT_COLORS[0]),
    new THREE.Color(DEFAULT_COLORS[1]),
    new THREE.Color(DEFAULT_COLORS[2]),
  ]

  // Overlays
  private overlays: OverlayItem[] = []
  private overlayMaterial: THREE.ShaderMaterial

  public audioAnalyzer: AudioAnalyzer
  private animFrameId = 0
  private disposed = false
  private resolution = new THREE.Vector2(1920, 1080)

  // Smoothed audio values for less jitter
  private smoothBass = 0
  private smoothMid = 0
  private smoothHigh = 0
  private smoothEnergy = 0
  private beatPulse = 0

  // State change callback (for syncing to output window)
  public onStateChange: ((state: EngineState) => void) | null = null

  constructor(private canvas: HTMLCanvasElement) {
    this.audioAnalyzer = new AudioAnalyzer()
    this.clock = new THREE.Clock()

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(1)
    this.renderer.autoClear = false

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

    // Render targets
    const opts: THREE.WebGLRenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    }
    this.rtA = new THREE.WebGLRenderTarget(1920, 1080, opts)
    this.rtB = new THREE.WebGLRenderTarget(1920, 1080, opts)
    this.rtPrev = new THREE.WebGLRenderTarget(1920, 1080, opts)

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
      }
    })

    // Init post-processing materials
    this.initPostMaterials()

    this.handleResize()
    window.addEventListener('resize', this.handleResize)
  }

  private handleResize = () => {
    const parent = this.canvas.parentElement
    if (!parent) return
    const w = parent.clientWidth
    const h = parent.clientHeight
    this.renderer.setSize(w, h)
    this.resolution.set(w, h)
  }

  private createEffectMaterial(id: EffectId): THREE.ShaderMaterial {
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
        uColor1: { value: this.colors[0] },
        uColor2: { value: this.colors[1] },
        uColor3: { value: this.colors[2] },
        uResolution: { value: this.resolution },
      }
    })
  }

  private initPostMaterials() {
    this.postMaterials.set('bloom', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: bloomFrag,
      uniforms: {
        tDiffuse: { value: null },
        uStrength: { value: 1.0 },
        uEnergy: { value: 0 },
        uResolution: { value: this.resolution },
      }
    }))

    this.postMaterials.set('rgb-split', new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: rgbsplitFrag,
      uniforms: {
        tDiffuse: { value: null },
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
        tPrevFrame: { value: this.rtPrev.texture },
        uDecay: { value: 0.9 },
        uZoom: { value: 0.003 },
        uRotation: { value: 0.2 },
        uBass: { value: 0 },
      }
    }))
  }

  // ---- Public API ----

  // TODO: Add transitions between effects instead of hard-switching.
  //  - Crossfade: render both old and new effect to separate RTs, blend with a mix uniform over N frames
  //  - Wipe/slide: use a transition shader (radial, linear, dissolve noise) that reads both RTs
  //  - Beat-synced: trigger transition on next beat, complete by the following beat
  //  - Configurable duration (e.g. 0.5s – 2s) and transition type from the UI
  //  - Keep the old material alive during transition, dispose only after completion
  setEffect(id: EffectId) {
    if (id === this.currentEffect) return
    this.currentEffect = id
    this.mainMaterial.dispose()
    this.mainMaterial = this.createEffectMaterial(id)
    this.quad.material = this.mainMaterial
    this.emitState()
  }

  getActiveEffect(): EffectId {
    return this.currentEffect
  }

  togglePost(id: PostId) {
    if (this.activePostEffects.has(id)) {
      this.activePostEffects.delete(id)
    } else {
      this.activePostEffects.add(id)
    }
    this.emitState()
  }

  isPostActive(id: PostId): boolean {
    return this.activePostEffects.has(id)
  }

  // TODO: Add smooth color transitions instead of hard-switching palettes.
  //  - Store target colors alongside current colors
  //  - Each frame, lerp current → target using THREE.Color.lerp()
  //  - Configurable transition duration (e.g. 0.5s – 3s)
  //  - Beat-synced option: start transition on next beat
  //  - Cycle mode: auto-rotate through palettes at a configurable interval
  setColors(c1: string, c2: string, c3: string) {
    this.colors[0].set(c1)
    this.colors[1].set(c2)
    this.colors[2].set(c3)
    this.emitState()
  }

  // ---- Overlay API ----

  async addOverlay(name: string, dataUrl: string): Promise<OverlayItem> {
    const id = `overlay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
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
      await new Promise<void>((resolve) => { img.onload = () => resolve() })
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
      _texture: texture,
      _canvas: canvas,
      _isGif: isGif,
      _gifFrames: gifFrames,
      _gifFrameIndex: 0,
      _gifLastAdvance: performance.now(),
    }

    this.overlays.push(overlay)

    // Sync to output window
    try {
      window.api?.sendOverlayAdd({
        id, name, dataUrl, opacity: overlay.opacity,
        scale: overlay.scale, offsetX: overlay.offsetX, offsetY: overlay.offsetY,
        visible: overlay.visible,
      })
    } catch (_) {}

    return overlay
  }

  removeOverlay(id: string) {
    const idx = this.overlays.findIndex(o => o.id === id)
    if (idx >= 0) {
      const overlay = this.overlays[idx]
      overlay._texture?.dispose()
      this.overlays.splice(idx, 1)
      try { window.api?.sendOverlayRemove(id) } catch (_) {}
    }
  }

  getOverlays(): OverlayItem[] {
    return this.overlays
  }

  updateOverlay(id: string, updates: Partial<Pick<OverlayItem, 'opacity' | 'scale' | 'offsetX' | 'offsetY' | 'visible' | 'gifSync'>>) {
    const overlay = this.overlays.find(o => o.id === id)
    if (overlay) {
      Object.assign(overlay, updates)
      try { window.api?.sendOverlayUpdate(id, updates) } catch (_) {}
    }
  }

  // Legacy API for EffectPanel
  addEffect(id: string) {
    if (id in EFFECT_SHADERS) {
      this.setEffect(id as EffectId)
    } else {
      const postId = id as PostId
      if (this.postMaterials.has(postId) && !this.activePostEffects.has(postId)) {
        this.activePostEffects.add(postId)
        this.emitState()
      }
    }
  }

  removeEffect(id: string) {
    const postId = id as PostId
    if (this.activePostEffects.has(postId)) {
      this.activePostEffects.delete(postId)
      this.emitState()
    }
  }

  private emitState() {
    if (!this.onStateChange) return
    this.onStateChange({
      activeEffect: this.currentEffect,
      activePost: Array.from(this.activePostEffects),
      colors: [
        '#' + this.colors[0].getHexString(),
        '#' + this.colors[1].getHexString(),
        '#' + this.colors[2].getHexString(),
      ],
      beatPulse: this.beatPulse,
      energy: this.smoothEnergy,
      bpm: this.audioAnalyzer.getData().bpm,
    })
  }

  start() {
    this.clock.start()
    this.loop()
  }

  private loop = () => {
    if (this.disposed) return

    const time = this.clock.getElapsedTime()
    const audio = this.audioAnalyzer.update()

    // Smooth audio values
    const lerp = 0.25
    this.smoothBass += (audio.bass - this.smoothBass) * lerp
    this.smoothMid += (audio.mid - this.smoothMid) * lerp
    this.smoothHigh += (audio.high - this.smoothHigh) * lerp
    this.smoothEnergy += (audio.energy - this.smoothEnergy) * lerp

    // Beat pulse with decay
    if (audio.beatDetected) this.beatPulse = 1.0
    this.beatPulse *= 0.88

    // Update main effect uniforms
    const u = this.mainMaterial.uniforms
    u.uTime.value = time
    u.uBass.value = this.smoothBass
    u.uMid.value = this.smoothMid
    u.uHigh.value = this.smoothHigh
    u.uEnergy.value = this.smoothEnergy
    u.uBeat.value = this.beatPulse
    u.uResolution.value = this.resolution

    // Render main effect → rtA
    this.renderer.setRenderTarget(this.rtA)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    // Render overlays on top of main effect
    const visibleOverlays = this.overlays.filter(o => o.visible && o._texture)
    if (visibleOverlays.length > 0) {
      let src = this.rtA
      let dst = this.rtB
      for (const overlay of visibleOverlays) {
        // Advance GIF frames based on sync mode
        if (overlay._isGif && overlay._gifFrames && overlay._gifFrames.length > 1 && overlay._canvas) {
          const now = performance.now()
          let advance = false

          if (overlay.gifSync === 'beat') {
            // Advance one frame on each beat
            if (audio.beatDetected) advance = true
          } else if (overlay.gifSync === 'bpm') {
            // Advance at BPM rate (one frame per beat interval)
            const beatInterval = 60000 / audio.bpm
            if (now - (overlay._gifLastAdvance || 0) >= beatInterval) advance = true
          } else {
            // Free: use original GIF timing
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

        this.postQuad.material = this.overlayMaterial
        this.renderer.setRenderTarget(dst)
        this.renderer.clear()
        this.renderer.render(this.postScene, this.camera)

        // Swap
        const tmp = src; src = dst; dst = tmp
      }
      // If we ended on rtB, copy back to rtA so post-processing chain reads from rtA
      if (src !== this.rtA) {
        const passMat = new THREE.ShaderMaterial({
          vertexShader: FULLSCREEN_VERT,
          fragmentShader: PASSTHROUGH_FRAG,
          uniforms: { tDiffuse: { value: src.texture } }
        })
        this.postQuad.material = passMat
        this.renderer.setRenderTarget(this.rtA)
        this.renderer.clear()
        this.renderer.render(this.postScene, this.camera)
        passMat.dispose()
      }
    }

    // Post-processing chain
    let read = this.rtA
    let write = this.rtB
    const posts = Array.from(this.activePostEffects)
      .filter(id => this.postMaterials.has(id))

    for (let i = 0; i < posts.length; i++) {
      const mat = this.postMaterials.get(posts[i])!
      const pu = mat.uniforms

      // Set input texture
      pu.tDiffuse.value = read.texture

      // Update audio uniforms if present
      if (pu.uBass) pu.uBass.value = this.smoothBass
      if (pu.uMid) pu.uMid.value = this.smoothMid
      if (pu.uHigh) pu.uHigh.value = this.smoothHigh
      if (pu.uEnergy) pu.uEnergy.value = this.smoothEnergy
      if (pu.uBeat) pu.uBeat.value = this.beatPulse

      const isLast = i === posts.length - 1
      this.postQuad.material = mat
      this.renderer.setRenderTarget(isLast ? null : write)
      this.renderer.clear()
      this.renderer.render(this.postScene, this.camera)

      // Swap buffers
      const tmp = read; read = write; write = tmp
    }

    // No post effects — passthrough to screen
    if (posts.length === 0) {
      const passMat = this.postQuad.material as THREE.ShaderMaterial
      if (passMat.uniforms.tDiffuse) {
        passMat.uniforms.tDiffuse.value = read.texture
      } else {
        this.postQuad.material = new THREE.ShaderMaterial({
          vertexShader: FULLSCREEN_VERT,
          fragmentShader: PASSTHROUGH_FRAG,
          uniforms: { tDiffuse: { value: read.texture } }
        })
      }
      this.renderer.setRenderTarget(null)
      this.renderer.clear()
      this.renderer.render(this.postScene, this.camera)
    }

    // Store frame for feedback effect
    if (this.activePostEffects.has('feedback')) {
      const feedbackMat = this.postMaterials.get('feedback')!
      feedbackMat.uniforms.tPrevFrame.value = this.rtPrev.texture

      // Copy current to prev
      const copyMat = new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: PASSTHROUGH_FRAG,
        uniforms: { tDiffuse: { value: this.rtA.texture } }
      })
      this.postQuad.material = copyMat
      this.renderer.setRenderTarget(this.rtPrev)
      this.renderer.clear()
      this.renderer.render(this.postScene, this.camera)
      copyMat.dispose()
    }
    this.renderer.setRenderTarget(null)

    // Sync audio data to output window
    try {
      window.api?.sendAudioData({
        bass: this.smoothBass,
        mid: this.smoothMid,
        high: this.smoothHigh,
        energy: this.smoothEnergy,
        beatPulse: this.beatPulse,
        bpm: audio.bpm,
        beatDetected: audio.beatDetected,
      })
    } catch (_) {}

    this.animFrameId = requestAnimationFrame(this.loop)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.animFrameId)
    window.removeEventListener('resize', this.handleResize)
    this.renderer.dispose()
    this.rtA.dispose()
    this.rtB.dispose()
    this.rtPrev.dispose()
    this.mainMaterial.dispose()
    this.overlayMaterial.dispose()
    this.overlays.forEach(o => o._texture?.dispose())
    this.overlays = []
    this.postMaterials.forEach(m => m.dispose())
  }
}
