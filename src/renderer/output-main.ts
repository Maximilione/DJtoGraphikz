import * as THREE from 'three'
import type { EffectId, PostId } from '@engine/Engine'

import tunnelFrag from '@engine/shaders/tunnel.frag?raw'
import kaleidoscopeFrag from '@engine/shaders/kaleidoscope.frag?raw'
import warpFrag from '@engine/shaders/warp.frag?raw'
import plasmaFrag from '@engine/shaders/plasma.frag?raw'
import matrixFrag from '@engine/shaders/matrix.frag?raw'
import voronoiFrag from '@engine/shaders/voronoi.frag?raw'
import sacredFrag from '@engine/shaders/sacred.frag?raw'
import fractalFrag from '@engine/shaders/fractal.frag?raw'
import particlesFrag from '@engine/shaders/particles.frag?raw'
import starfieldFrag from '@engine/shaders/starfield.frag?raw'
import metaballsFrag from '@engine/shaders/metaballs.frag?raw'
import mandalaFrag from '@engine/shaders/mandala.frag?raw'
import gridFrag from '@engine/shaders/grid.frag?raw'
import wavesFrag from '@engine/shaders/waves.frag?raw'
import lissajousFrag from '@engine/shaders/lissajous.frag?raw'
import fluidFrag from '@engine/shaders/fluid.frag?raw'
import glitchFrag from '@engine/shaders/glitch.frag?raw'
import ringsFrag from '@engine/shaders/rings.frag?raw'
import fireFrag from '@engine/shaders/fire.frag?raw'
import hexagonsFrag from '@engine/shaders/hexagons.frag?raw'
import dnaFrag from '@engine/shaders/dna.frag?raw'
import rgbsplitFrag from '@engine/shaders/rgbsplit.frag?raw'
import bloomFrag from '@engine/shaders/bloom.frag?raw'
import feedbackFrag from '@engine/shaders/feedback.frag?raw'
import chromaticFrag from '@engine/shaders/chromatic.frag?raw'
import filmgrainFrag from '@engine/shaders/filmgrain.frag?raw'
import scanlinesFrag from '@engine/shaders/scanlines.frag?raw'
import pixelateFrag from '@engine/shaders/pixelate.frag?raw'
import mirrorFrag from '@engine/shaders/mirror.frag?raw'
import invertFrag from '@engine/shaders/invert.frag?raw'
import transitionFrag from '@engine/shaders/transition.frag?raw'
import overlayFrag from '@engine/shaders/overlay.frag?raw'
import { GifDecoder, GifFrame } from '@engine/GifDecoder'

const VERT = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}`
const PASS = `precision highp float;uniform sampler2D tDiffuse;varying vec2 vUv;void main(){gl_FragColor=texture2D(tDiffuse,vUv);}`

const SHADERS: Record<EffectId, string> = {
  tunnel: tunnelFrag, kaleidoscope: kaleidoscopeFrag, warp: warpFrag,
  plasma: plasmaFrag, matrix: matrixFrag, voronoi: voronoiFrag,
  sacred: sacredFrag, fractal: fractalFrag, particles: particlesFrag,
  starfield: starfieldFrag, metaballs: metaballsFrag, mandala: mandalaFrag,
  grid: gridFrag, waves: wavesFrag, lissajous: lissajousFrag,
  fluid: fluidFrag, glitch: glitchFrag, rings: ringsFrag,
  fire: fireFrag, hexagons: hexagonsFrag, dna: dnaFrag,
}

const canvas = document.getElementById('output-canvas') as HTMLCanvasElement

// State
let currentEffect: EffectId = 'tunnel'
let activePosts = new Set<PostId>(['bloom'])
const colors = [new THREE.Color('#00ff88'), new THREE.Color('#ff00ff'), new THREE.Color('#4444ff')]
const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)

// Audio data received from control window
let audioBass = 0, audioMid = 0, audioHigh = 0, audioEnergy = 0, audioBeatPulse = 0, audioBpm = 128
let audioBeatDetected = false

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
renderer.setPixelRatio(1)
renderer.autoClear = false

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const geom = new THREE.PlaneGeometry(2, 2)

const scene = new THREE.Scene()
let mainMat = createMat(currentEffect)
const quad = new THREE.Mesh(geom, mainMat)
scene.add(quad)

const postScene = new THREE.Scene()
const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: PASS, uniforms: { tDiffuse: { value: null } } }))
postScene.add(postQuad)

// Reusable passthrough material (avoid per-frame allocations)
const passMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: PASS, uniforms: { tDiffuse: { value: null } } })

const opts: THREE.WebGLRenderTargetOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }
const rtA = new THREE.WebGLRenderTarget(1920, 1080, opts)
const rtB = new THREE.WebGLRenderTarget(1920, 1080, opts)
const rtPrev = new THREE.WebGLRenderTarget(1920, 1080, opts)

// Post materials
const postMats = new Map<PostId, THREE.ShaderMaterial>()
postMats.set('bloom', new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: bloomFrag, uniforms: { tDiffuse: { value: null }, uStrength: { value: 1.0 }, uEnergy: { value: 0 }, uResolution: { value: resolution } } }))
postMats.set('rgb-split', new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: rgbsplitFrag, uniforms: { tDiffuse: { value: null }, uAmount: { value: 0.003 }, uAngle: { value: 0 }, uBass: { value: 0 }, uBeat: { value: 0 } } }))
postMats.set('chromatic', new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: chromaticFrag, uniforms: { tDiffuse: { value: null }, uStrength: { value: 0.008 }, uBass: { value: 0 }, uBeat: { value: 0 }, uResolution: { value: resolution } } }))
postMats.set('feedback', new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: feedbackFrag, uniforms: { tDiffuse: { value: null }, tPrevFrame: { value: rtPrev.texture }, uDecay: { value: 0.9 }, uZoom: { value: 0.003 }, uRotation: { value: 0.2 }, uBass: { value: 0 } } }))
postMats.set('filmgrain', new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: filmgrainFrag, uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uEnergy: { value: 0 }, uResolution: { value: resolution } } }))
postMats.set('scanlines', new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: scanlinesFrag, uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uEnergy: { value: 0 }, uResolution: { value: resolution } } }))
postMats.set('pixelate', new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: pixelateFrag, uniforms: { tDiffuse: { value: null }, uEnergy: { value: 0 }, uResolution: { value: resolution } } }))
postMats.set('mirror', new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: mirrorFrag, uniforms: { tDiffuse: { value: null } } }))
postMats.set('invert', new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: invertFrag, uniforms: { tDiffuse: { value: null } } }))

function createMat(id: EffectId): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: SHADERS[id],
    uniforms: {
      uTime: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 },
      uHigh: { value: 0 }, uEnergy: { value: 0 }, uBeat: { value: 0 },
      uColor1: { value: colors[0] }, uColor2: { value: colors[1] }, uColor3: { value: colors[2] },
      uResolution: { value: resolution },
    }
  })
}

// Transition state
const TRANSITION_TYPE_INDEX: Record<string, number> = {
  'crossfade': 0, 'wipe-left': 1, 'wipe-down': 2, 'radial': 3, 'dissolve': 4,
}
let transOldMat: THREE.ShaderMaterial | null = null
let transProgress = -1
let transDuration = 0.8
let transType = 0
const rtTrans = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, opts)
const transMat = new THREE.ShaderMaterial({
  vertexShader: VERT,
  fragmentShader: transitionFrag,
  uniforms: {
    tOld: { value: null },
    tNew: { value: null },
    uProgress: { value: 0 },
    uType: { value: 0 },
    uResolution: { value: resolution },
  }
})

// Overlay material
const overlayMat = new THREE.ShaderMaterial({
  vertexShader: VERT,
  fragmentShader: overlayFrag,
  uniforms: {
    tDiffuse: { value: null },
    tOverlay: { value: null },
    uOpacity: { value: 1.0 },
    uOverlayScale: { value: new THREE.Vector2(1, 1) },
    uOverlayOffset: { value: new THREE.Vector2(0, 0) },
  }
})

// Overlay state
interface OutputOverlay {
  id: string
  opacity: number
  scale: number
  offsetX: number
  offsetY: number
  visible: boolean
  gifSync: string
  texture: THREE.CanvasTexture
  canvas: HTMLCanvasElement
  isGif: boolean
  gifFrames?: GifFrame[]
  gifFrameIndex: number
  gifLastAdvance: number
}
const outputOverlays: OutputOverlay[] = []

window.api?.onOverlayAdd(async (data: any) => {
  const isGif = data.dataUrl.includes('image/gif')
  const canvas = document.createElement('canvas')
  let texture: THREE.CanvasTexture
  let gifFrames: GifFrame[] | undefined

  if (isGif) {
    const decoder = new GifDecoder()
    await decoder.decode(data.dataUrl)
    gifFrames = decoder.frames
    canvas.width = decoder.width
    canvas.height = decoder.height
    if (gifFrames.length > 0) {
      const ctx = canvas.getContext('2d')!
      ctx.putImageData(gifFrames[0].imageData, 0, 0)
    }
    texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
  } else {
    const img = new Image()
    img.src = data.dataUrl
    await new Promise<void>(r => { img.onload = () => r() })
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
  }

  outputOverlays.push({
    id: data.id, opacity: data.opacity, scale: data.scale,
    offsetX: data.offsetX, offsetY: data.offsetY, visible: data.visible,
    gifSync: 'beat', texture, canvas, isGif,
    gifFrames, gifFrameIndex: 0, gifLastAdvance: performance.now(),
  })
})

window.api?.onOverlayRemove((id: string) => {
  const idx = outputOverlays.findIndex(o => o.id === id)
  if (idx >= 0) {
    outputOverlays[idx].texture.dispose()
    outputOverlays.splice(idx, 1)
  }
})

window.api?.onOverlayUpdate((id: string, updates: any) => {
  const overlay = outputOverlays.find(o => o.id === id)
  if (overlay) Object.assign(overlay, updates)
})

// Receive state from control window
function cancelOutputTransition() {
  if (transOldMat) {
    transOldMat.dispose()
    transOldMat = null
  }
  transProgress = -1
}

window.api?.onEngineState((state: any) => {
  if (state.activeEffect && state.activeEffect !== currentEffect) {
    // Always cancel existing transition before starting new one
    cancelOutputTransition()

    if (state.transition && state.transition.duration > 0) {
      // Start transition
      transOldMat = mainMat
      mainMat = createMat(state.activeEffect)
      quad.material = mainMat
      currentEffect = state.activeEffect
      transProgress = 0
      transDuration = state.transition.duration
      transType = TRANSITION_TYPE_INDEX[state.transition.type] || 0
    } else {
      // Instant switch
      currentEffect = state.activeEffect
      mainMat.dispose()
      mainMat = createMat(currentEffect)
      quad.material = mainMat
    }
  }
  if (state.activePost) {
    activePosts = new Set(state.activePost)
  }
  if (state.colors) {
    colors[0].set(state.colors[0])
    colors[1].set(state.colors[1])
    colors[2].set(state.colors[2])
  }
  // Custom shader from editor
  if (state.customShader) {
    try {
      cancelOutputTransition()
      const newMat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: state.customShader,
        uniforms: {
          uTime: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 },
          uHigh: { value: 0 }, uEnergy: { value: 0 }, uBeat: { value: 0 },
          uColor1: { value: colors[0] }, uColor2: { value: colors[1] }, uColor3: { value: colors[2] },
          uResolution: { value: resolution },
        }
      })
      mainMat.dispose()
      mainMat = newMat
      quad.material = mainMat
    } catch (e) {
      console.error('[Output] Custom shader error:', e)
    }
  }
})

// Receive audio data
window.api?.onAudioData((data: any) => {
  audioBass = data.bass || 0
  audioMid = data.mid || 0
  audioHigh = data.high || 0
  audioEnergy = data.energy || 0
  audioBeatPulse = data.beatPulse || 0
  audioBpm = data.bpm || 128
  audioBeatDetected = data.beatDetected || false
})

// Resize — update renderer, render targets, and resolution
function resize() {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h)
  resolution.set(w, h)
  rtA.setSize(w, h)
  rtB.setSize(w, h)
  rtPrev.setSize(w, h)
  rtTrans.setSize(w, h)
}
window.addEventListener('resize', resize)
resize()

// Resolution override from control window
let renderWidth = window.innerWidth
let renderHeight = window.innerHeight
window.api?.onOutputResolution((w: number, h: number) => {
  renderWidth = w
  renderHeight = h
  resolution.set(w, h)
  rtA.setSize(w, h)
  rtB.setSize(w, h)
  rtPrev.setSize(w, h)
  rtTrans.setSize(w, h)
})

// Render loop
const clock = new THREE.Clock()
clock.start()

function loop() {
  const time = clock.getElapsedTime()

  const u = mainMat.uniforms
  u.uTime.value = time
  u.uBass.value = audioBass
  u.uMid.value = audioMid
  u.uHigh.value = audioHigh
  u.uEnergy.value = audioEnergy
  u.uBeat.value = audioBeatPulse

  // Render main → rtA
  renderer.setRenderTarget(rtA)
  renderer.clear()
  renderer.render(scene, camera)

  // Effect transition blending
  if (transProgress >= 0 && transOldMat) {
    const dt = clock.getDelta()
    transProgress += dt / Math.max(transDuration, 0.01)

    if (transProgress >= 1) {
      transOldMat.dispose()
      transOldMat = null
      transProgress = -1
    } else {
      // Render old effect → rtTrans
      quad.material = transOldMat
      const ou = transOldMat.uniforms
      ou.uTime.value = time
      ou.uBass.value = audioBass
      ou.uMid.value = audioMid
      ou.uHigh.value = audioHigh
      ou.uEnergy.value = audioEnergy
      ou.uBeat.value = audioBeatPulse
      renderer.setRenderTarget(rtTrans)
      renderer.clear()
      renderer.render(scene, camera)

      // Restore new material
      quad.material = mainMat

      // Blend old + new → rtB
      transMat.uniforms.tOld.value = rtTrans.texture
      transMat.uniforms.tNew.value = rtA.texture
      transMat.uniforms.uProgress.value = transProgress
      transMat.uniforms.uType.value = transType
      postQuad.material = transMat
      renderer.setRenderTarget(rtB)
      renderer.clear()
      renderer.render(postScene, camera)

      // Copy blended to rtA
      passMat.uniforms.tDiffuse.value = rtB.texture
      postQuad.material = passMat
      renderer.setRenderTarget(rtA)
      renderer.clear()
      renderer.render(postScene, camera)
    }
  }

  // Render overlays on top of main effect
  let hasVisibleOverlays = false
  for (const o of outputOverlays) { if (o.visible) { hasVisibleOverlays = true; break } }
  if (hasVisibleOverlays) {
    let src = rtA, dst = rtB
    for (const ov of outputOverlays) {
      if (!ov.visible) continue
      // Advance GIF frames
      if (ov.isGif && ov.gifFrames && ov.gifFrames.length > 1) {
        const now = performance.now()
        let advance = false
        if (ov.gifSync === 'beat') {
          if (audioBeatDetected) advance = true
        } else if (ov.gifSync === 'bpm') {
          const beatInterval = 60000 / (audioBpm || 128)
          if (now - ov.gifLastAdvance >= beatInterval) advance = true
        } else {
          const currentFrame = ov.gifFrames[ov.gifFrameIndex]
          if (now - ov.gifLastAdvance >= currentFrame.delay) advance = true
        }
        if (advance) {
          ov.gifFrameIndex = (ov.gifFrameIndex + 1) % ov.gifFrames.length
          ov.gifLastAdvance = now
          const ctx2d = ov.canvas.getContext('2d')!
          ctx2d.putImageData(ov.gifFrames[ov.gifFrameIndex].imageData, 0, 0)
          ov.texture.needsUpdate = true
        }
      }
      const ou = overlayMat.uniforms
      ou.tDiffuse.value = src.texture
      ou.tOverlay.value = ov.texture
      ou.uOpacity.value = ov.opacity
      ou.uOverlayScale.value.set(ov.scale, ov.scale)
      ou.uOverlayOffset.value.set(ov.offsetX, ov.offsetY)
      postQuad.material = overlayMat
      renderer.setRenderTarget(dst)
      renderer.clear()
      renderer.render(postScene, camera)
      const tmp = src; src = dst; dst = tmp
    }
    if (src !== rtA) {
      passMat.uniforms.tDiffuse.value = src.texture
      postQuad.material = passMat
      renderer.setRenderTarget(rtA)
      renderer.clear()
      renderer.render(postScene, camera)
    }
  }

  // Post chain
  let read = rtA, write = rtB
  const posts: PostId[] = []
  for (const id of activePosts) { if (postMats.has(id)) posts.push(id) }

  for (let i = 0; i < posts.length; i++) {
    const mat = postMats.get(posts[i])!
    const pu = mat.uniforms
    pu.tDiffuse.value = read.texture
    if (pu.uBass) pu.uBass.value = audioBass
    if (pu.uEnergy) pu.uEnergy.value = audioEnergy
    if (pu.uBeat) pu.uBeat.value = audioBeatPulse

    const isLast = i === posts.length - 1
    postQuad.material = mat
    renderer.setRenderTarget(isLast ? null : write)
    renderer.clear()
    renderer.render(postScene, camera)
    const tmp = read; read = write; write = tmp
  }

  if (posts.length === 0) {
    const pm = postQuad.material as THREE.ShaderMaterial
    if (pm.uniforms.tDiffuse) pm.uniforms.tDiffuse.value = read.texture
    renderer.setRenderTarget(null)
    renderer.clear()
    renderer.render(postScene, camera)
  }

  renderer.setRenderTarget(null)
  requestAnimationFrame(loop)
}

loop()
