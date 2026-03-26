import { parseGIF, decompressFrames } from 'gifuct-js'

export interface GifFrame {
  imageData: ImageData
  delay: number // ms
}

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

    this.width = gif.lsd.width
    this.height = gif.lsd.height
    this.frames = []

    // Composite canvas — GIF frames can be partial patches
    const canvas = document.createElement('canvas')
    canvas.width = this.width
    canvas.height = this.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!

    for (const frame of rawFrames) {
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
        ctx.clearRect(0, 0, this.width, this.height)
      }

      ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top)

      // Capture full composited frame
      const composited = ctx.getImageData(0, 0, this.width, this.height)
      this.frames.push({
        imageData: new ImageData(
          new Uint8ClampedArray(composited.data),
          this.width,
          this.height
        ),
        delay: frame.delay || 100,
      })
    }
  }
}
