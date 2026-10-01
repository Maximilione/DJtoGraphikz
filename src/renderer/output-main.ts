import { Engine } from '@engine/Engine'
import { frameStats } from './soundcheck'

// Output window: same Engine as the control window, fed entirely over IPC.
const canvas = document.getElementById('output-canvas') as HTMLCanvasElement
const engine = new Engine(canvas, { remote: true })
engine.start()

// Release gate: hand back the real projector frame on request
window.api?.onSelfTestShot?.(() => {
  engine.screenshot().then(blob => {
    if (!blob) return
    blob.arrayBuffer().then(buf => window.api?.sendSelfTestData?.(buf))
  })
})

// Soundcheck (P3): one second of frames plus the luma of a reduced frame, the
// same numbers the release gate reads off the projector shot.
window.api?.onOutputProbe?.(async (id: number) => {
  const f0 = engine.frames
  const t0 = performance.now()
  // a frozen renderer never resolves a screenshot: that is the finding, not a hang
  const blob = await Promise.race([engine.screenshot(), new Promise<null>(r => setTimeout(() => r(null), 2000))])
  await new Promise(r => setTimeout(r, 1000))
  const fps = (engine.frames - f0) / ((performance.now() - t0) / 1000)
  let stats = { mean: 0, std: 0, bright: 0 }
  if (blob) {
    try {
      const bmp = await createImageBitmap(blob)
      const small = new OffscreenCanvas(64, 36)
      const ctx = small.getContext('2d')!
      ctx.drawImage(bmp, 0, 0, 64, 36)
      stats = frameStats(ctx.getImageData(0, 0, 64, 36).data)
      bmp.close()
    } catch (err) { console.error('[Soundcheck] frame illeggibile:', err) }
  }
  window.api?.sendOutputProbe?.(id, { ...stats, fps, canvas: `${canvas.width}x${canvas.height}` })
})

// Tell main we are actually painting, so it can enter fullscreen safely
{
  let announced = false
  const announce = () => {
    if (announced) return
    announced = true
    window.api?.notifyOutputPainted?.()
  }
  const started = performance.now()
  const poll = setInterval(() => {
    const frames = Number((engine.health().match(/frames=(\d+)/) || [])[1] ?? 0)
    if (frames > 2 || performance.now() - started > 2000) { clearInterval(poll); announce() }
  }, 100)
}

// "No signal" placard: distinguishes a window that is present but idle from a
// window that never made it onto the projector at all.
const noSignal = document.getElementById('nosignal')
let lastFrames = -1
setInterval(() => {
  if (!noSignal) return
  const frames = Number((engine.health().match(/frames=(\d+)/) || [])[1] ?? 0)
  // Only a stalled renderer is a real "no signal": a projector painting the
  // current look receives no state updates at all when nothing changes, and
  // flagging that would put the placard on top of a working visual.
  const stalled = lastFrames >= 0 && frames === lastFrames
  lastFrames = frames
  noSignal.classList.toggle('on', stalled)
}, 2000)

// Heartbeat: a black projector must be explainable from the log alone
setInterval(() => {
  try {
    const placard = noSignal?.classList.contains('on') ? ' NOSIGNAL' : ''
    window.api?.logToFile?.('output/health', engine.health() + placard)
  } catch { /* no api */ }
}, 5000)

window.api?.onEngineState((state: any) => engine.applyRemoteState(state))
window.api?.onAudioData((data: any) => engine.setAudioData(data))

window.api?.onOverlayAdd((data: any) => {
  const added = data.source?.kind === 'text'
    ? Promise.resolve(engine.addTextOverlay(data.source.text, data.source, data.id))
    : data.source
      ? engine.addVideoOverlay(data.name, data.source, data.id)
      : engine.addOverlay(data.name, data.dataUrl, data.id)
  added.then(overlay => {
    engine.updateOverlay(overlay.id, {
      opacity: data.opacity, scale: data.scale,
      offsetX: data.offsetX, offsetY: data.offsetY,
      visible: data.visible, gifSync: data.gifSync ?? 'beat',
      displace: data.displace ?? 0,
    })
  }).catch(err => console.error('[Output] overlay add failed:', err))
})
window.api?.onOverlayRemove((id: string) => engine.removeOverlay(id))
window.api?.onOverlayUpdate((id: string, updates: any) => engine.updateOverlay(id, updates))

// Release gate: present only this rectangle, so the shot proves the crop runs
// instead of the log claiming it does.
if (window.api?.selfTestSlice) {
  try { engine.setSlice({ src: window.api.selfTestSlice.split(',').map(Number) }) }
  catch (err) { console.error('[SelfTest] slice illeggibile:', err) }
}

// Which part of the show this wall presents, and how hard to drive it. Not in
// the engine state on purpose: the state is the show, and every output gets it
// unchanged — this is the only thing that is per-window.
window.api?.onOutputSlice?.((cfg: any) => {
  // main replays the real config on did-finish-load, i.e. after this module has
  // run — under the gate that would put the pinned crop straight back to full.
  if (window.api?.selfTestSlice) return
  if (cfg) engine.setSlice(cfg)
})

window.api?.onOutputResolution((w: number, h: number) => {
  engine.setRenderSize(w, h)
  // the letterbox depends on the output aspect — recompute it
  window.dispatchEvent(new Event('resize'))
})
