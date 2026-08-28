import { Engine } from '@engine/Engine'

// Output window: same Engine as the control window, fed entirely over IPC.
const canvas = document.getElementById('output-canvas') as HTMLCanvasElement
const engine = new Engine(canvas, { remote: true })
engine.start()

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

window.api?.onOutputResolution((w: number, h: number) => engine.setRenderSize(w, h))
