import { Engine } from '@engine/Engine'

// Output window: same Engine as the control window, fed entirely over IPC.
const canvas = document.getElementById('output-canvas') as HTMLCanvasElement
const engine = new Engine(canvas, { remote: true })
engine.start()

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
let lastStateAt = 0
let lastFrames = -1
setInterval(() => {
  if (!noSignal) return
  const h = engine.health()
  const frames = Number((h.match(/frames=(\d+)/) || [])[1] ?? 0)
  const stalled = frames === lastFrames
  lastFrames = frames
  const noState = lastStateAt === 0 && performance.now() > 8000
  noSignal.classList.toggle('on', noState || stalled)
}, 2000)

// Heartbeat: a black projector must be explainable from the log alone
setInterval(() => {
  try {
    const placard = noSignal?.classList.contains('on') ? ' NOSIGNAL' : ''
    window.api?.logToFile?.('output/health', engine.health() + placard)
  } catch { /* no api */ }
}, 5000)

window.api?.onEngineState((state: any) => { lastStateAt = performance.now(); engine.applyRemoteState(state) })
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

window.api?.onOutputResolution((w: number, h: number) => {
  engine.setRenderSize(w, h)
  // the letterbox depends on the output aspect — recompute it
  window.dispatchEvent(new Event('resize'))
})
