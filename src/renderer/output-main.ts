import * as THREE from 'three'
import type { EffectId, PostId } from '@engine/Engine'

import tunnelFrag from '@engine/shaders/tunnel.frag?raw'
import kaleidoscopeFrag from '@engine/shaders/kaleidoscope.frag?raw'
import warpFrag from '@engine/shaders/warp.frag?raw'
import plasmaFrag from '@engine/shaders/plasma.frag?raw'
import matrixFrag from '@engine/shaders/matrix.frag?raw'
import voronoiFrag from '@engine/shaders/voronoi.frag?raw'
import rgbsplitFrag from '@engine/shaders/rgbsplit.frag?raw'
import bloomFrag from '@engine/shaders/bloom.frag?raw'
import feedbackFrag from '@engine/shaders/feedback.frag?raw'
import chromaticFrag from '@engine/shaders/chromatic.frag?raw'
import overlayFrag from '@engine/shaders/overlay.frag?raw'
import { GifDecoder, GifFrame } from '@engine/GifDecoder'

const VERT = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}`
const PASS = `precision highp float;uniform sampler2D tDiffuse;varying vec2 vUv;void main(){gl_FragColor=texture2D(tDiffuse,vUv);}`

const SHADERS: Record<EffectId, string> = {
  tunnel: tunnelFrag, kaleidoscope: kaleidoscopeFrag, warp: warpFrag,
  plasma: plasmaFrag, matrix: matrixFrag, voronoi: voronoiFrag,
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
window.api?.onEngineState((state: any) => {
  if (state.activeEffect && state.activeEffect !== currentEffect) {
    currentEffect = state.activeEffect
    mainMat.dispose()
    mainMat = createMat(currentEffect)
    quad.material = mainMat
  }
  if (state.activePost) {
    activePosts = new Set(state.activePost)
  }
  if (state.colors) {
    colors[0].set(state.colors[0])
    colors[1].set(state.colors[1])
    colors[2].set(state.colors[2])
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

// Resize
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  resolution.set(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', resize)
resize()

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

  // Render overlays on top of main effect
  const visOverlays = outputOverlays.filter(o => o.visible)
  if (visOverlays.length > 0) {
    let src = rtA, dst = rtB
    for (const ov of visOverlays) {
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
      const copyMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: PASS,
        uniforms: { tDiffuse: { value: src.texture } }
      })
      postQuad.material = copyMat
      renderer.setRenderTarget(rtA)
      renderer.clear()
      renderer.render(postScene, camera)
      copyMat.dispose()
    }
  }

  // Post chain
  let read = rtA, write = rtB
  const posts = Array.from(activePosts).filter(id => postMats.has(id))

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
