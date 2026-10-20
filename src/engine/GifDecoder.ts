import { parseGIF, decompressFrames } from 'gifuct-js'

export interface GifFrame {
  imageData: ImageData
  delay: number // ms
}

// Memory caps: a 500-frame 800x600 GIF is ~1GB of RGBA, decoded in BOTH windows.
const MAX_DIMENSION = 720 // longest side; overlay texture, VJ res doesn't need more
const MAX_FRAMES = 240

export class GifDecoder {
  frames: GifFrame[] = []
  width = 0
  height = 0

  async decode(dataUrl: string): Promise<void> {
    // Convert data URL to ArrayBuffer
    const base64 = dataUrl.split(',')[1]
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    const gif = parseGIF(bytes.buffer as ArrayBuffer)
    const rawFrames = decompressFrames(gif, true)

    if (rawFrames.length === 0) return

    // Native size — compositing must happen here (patch offsets/disposal use it)
    const nativeW = gif.lsd.width
    const nativeH = gif.lsd.height
    const scale = Math.min(1, MAX_DIMENSION / Math.max(nativeW, nativeH))
    this.width = Math.max(1, Math.round(nativeW * scale))
    this.height = Math.max(1, Math.round(nativeH * scale))
    this.frames = []

    // Composite canvas — GIF frames can be partial patches
    const canvas = document.createElement('canvas')
    canvas.width = nativeW
    canvas.height = nativeH
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!

    // Downscale pass: composite at native size, capture at capped size
    let outCtx = ctx
    if (scale < 1) {
      const outCanvas = document.createElement('canvas')
      outCanvas.width = this.width
      outCanvas.height = this.height
      outCtx = outCanvas.getContext('2d', { willReadFrequently: true })!
    }

    // One patch canvas for the whole decode, resized only when the patch size changes
    const patchCanvas = document.createElement('canvas')
    const pctx = patchCanvas.getContext('2d')!
    // A frame's disposalType says what happens AFTER it was shown, within its
    // own rect: 2 clears that rect to background, 3 restores what was there
    // before the frame. Both apply before the NEXT frame is drawn.
    let prevDisposal = 0
    let prevDims: { left: number; top: number; width: number; height: number } | null = null
    let saved: ImageData | null = null

    for (const frame of rawFrames) {
      if (this.frames.length >= MAX_FRAMES) {
        console.warn(
          `GifDecoder: frame cap hit — keeping ${MAX_FRAMES} of ${rawFrames.length} frames`
        )
        break
      }
      if (prevDisposal === 2 && prevDims) ctx.clearRect(prevDims.left, prevDims.top, prevDims.width, prevDims.height)
      else if (prevDisposal === 3 && saved) ctx.putImageData(saved, 0, 0)
      saved = frame.disposalType === 3 ? ctx.getImageData(0, 0, nativeW, nativeH) : null

      // Draw patch onto composite: putImageData overwrites the whole patch rect
      // (transparent texels included), drawImage then composites it with alpha
      if (patchCanvas.width !== frame.dims.width || patchCanvas.height !== frame.dims.height) {
        patchCanvas.width = frame.dims.width
        patchCanvas.height = frame.dims.height
      }
      // gifuct-js builds the patch over a plain ArrayBuffer; the cast only narrows the lib's ArrayBufferLike typing
      pctx.putImageData(new ImageData(frame.patch as Uint8ClampedArray<ArrayBuffer>, frame.dims.width, frame.dims.height), 0, 0)
      ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top)

      // Capture full composited frame (downscaled when over the dimension cap).
      // getImageData already hands back a fresh buffer — no second copy.
      if (scale < 1) {
        outCtx.clearRect(0, 0, this.width, this.height)
        outCtx.drawImage(canvas, 0, 0, this.width, this.height)
      }
      this.frames.push({
        imageData: outCtx.getImageData(0, 0, this.width, this.height),
        delay: frame.delay || 100,
      })
      prevDisposal = frame.disposalType
      prevDims = frame.dims
    }
    patchCanvas.width = patchCanvas.height = 0

    const estBytes = this.frames.length * this.width * this.height * 4
    if (estBytes > 100 * 1024 * 1024) {
      console.warn(
        `GifDecoder: decoded GIF uses ~${Math.round(estBytes / (1024 * 1024))}MB ` +
          `(${this.frames.length} frames @ ${this.width}x${this.height}) even after caps`
      )
    }
  }
}
