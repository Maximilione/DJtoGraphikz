import { Engine } from '@engine/Engine'
import type { ApiType } from '../preload/index'
import { decodeEvent } from '../shared/obsWire'

// Output window: same Engine as the control window, fed entirely over IPC —
// or, in OBS / a browser on the LAN (I2), over SSE from the remote server.
// Either way the show arrives on the same channels with the same arguments,
// so the transport is the only thing that differs: `api` below is the slice
// of the preload bridge this page listens on, and the browser gets it from
// an EventSource instead of ipcRenderer. One pipeline.
type FeedKeys = 'onEngineState' | 'onAudioData' | 'onOverlayAdd' | 'onOverlayRemove' | 'onOverlayUpdate' |
  'onOutputSlice' | 'onOutputResolution'
// same callbacks as the preload; the unsubscribe handle is never used here
type Feed = { [K in FeedKeys]: (cb: Parameters<ApiType[K]>[0]) => unknown }

function sseFeed(): Feed {
  const q = new URLSearchParams(location.search)
  // `feed=`: the server's origin when the page comes from the vite dev server
  const es = new EventSource(`${q.get('feed') || ''}/events?token=${encodeURIComponent(q.get('token') || '')}`)
  const on = (channel: string, cb: (...args: any[]) => void) => {
    const h = (e: Event) => cb(...decodeEvent((e as MessageEvent).data))
    es.addEventListener(channel, h)
    return () => es.removeEventListener(channel, h)
  }
  return {
    onEngineState: cb => on('engine:state-update', cb),
    onAudioData: cb => on('audio:data', cb),
    onOverlayAdd: cb => on('overlay:add', cb),
    onOverlayRemove: cb => on('overlay:remove', cb),
    onOverlayUpdate: cb => on('overlay:update', cb),
    onOutputSlice: cb => on('output:slice', cb),
    onOutputResolution: cb => on('output:set-resolution', cb),
  }
}

const api: Feed = window.api ?? sseFeed()

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

api.onEngineState((state: any) => engine.applyRemoteState(state))
api.onAudioData((data: any) => engine.setAudioData(data))

api.onOverlayAdd((data: any) => {
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
api.onOverlayRemove((id: string) => engine.removeOverlay(id))
api.onOverlayUpdate((id: string, updates: any) => engine.updateOverlay(id, updates))

// Release gate: present only this rectangle, so the shot proves the crop runs
// instead of the log claiming it does.
if (window.api?.selfTestSlice) {
  try { engine.setSlice({ src: window.api.selfTestSlice.split(',').map(Number) }) }
  catch (err) { console.error('[SelfTest] slice illeggibile:', err) }
}

// Which part of the show this wall presents, and how hard to drive it. Not in
// the engine state on purpose: the state is the show, and every output gets it
// unchanged — this is the only thing that is per-window.
api.onOutputSlice((cfg: any) => {
  // main replays the real config on did-finish-load, i.e. after this module has
  // run — under the gate that would put the pinned crop straight back to full.
  if (window.api?.selfTestSlice) return
  if (cfg) engine.setSlice(cfg)
})

api.onOutputResolution((w: number, h: number) => {
  engine.setRenderSize(w, h)
  // the letterbox depends on the output aspect — recompute it
  window.dispatchEvent(new Event('resize'))
})
