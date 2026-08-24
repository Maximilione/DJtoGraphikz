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

    for (const frame of rawFrames) {
      if (this.frames.length >= MAX_FRAMES) {
        console.warn(
          `GifDecoder: frame cap hit — keeping ${MAX_FRAMES} of ${rawFrames.length} frames`
        )
        break
      }
      // Draw patch onto composite
      const patch = new ImageData(
        new Uint8ClampedArray(frame.patch),
        frame.dims.width,
        frame.dims.height
      )

      // Create temp canvas for the patch
      const patchCanvas = document.createElement('canvas')
      patchCanvas.width = frame.dims.width
      patchCanvas.height = frame.dims.height
      const pctx = patchCanvas.getContext('2d')!
      pctx.putImageData(patch, 0, 0)

      // Handle disposal
      if (frame.disposalType === 2) {
        ctx.clearRect(0, 0, nativeW, nativeH)
      }

      ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top)

      // Capture full composited frame (downscaled when over the dimension cap)
      if (scale < 1) {
        outCtx.clearRect(0, 0, this.width, this.height)
        outCtx.drawImage(canvas, 0, 0, this.width, this.height)
      }
      const composited = outCtx.getImageData(0, 0, this.width, this.height)
      this.frames.push({
        imageData: new ImageData(
          new Uint8ClampedArray(composited.data),
          this.width,
          this.height
        ),
        delay: frame.delay || 100,
      })
    }

    const estBytes = this.frames.length * this.width * this.height * 4
    if (estBytes > 100 * 1024 * 1024) {
      console.warn(
        `GifDecoder: decoded GIF uses ~${Math.round(estBytes / (1024 * 1024))}MB ` +
          `(${this.frames.length} frames @ ${this.width}x${this.height}) even after caps`
      )
    }
  }
}
