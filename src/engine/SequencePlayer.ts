import * as THREE from 'three'
import { keepWindow, cacheCap, SEQ_MAX_CACHED } from '../shared/imageSequence'

const CONCURRENT_LOADS = 4

/**
 * Plays a list of image files on a canvas texture. Frames are fetched over
 * djg-media and decoded to ImageBitmap inside a sliding window (see
 * keepWindow/cacheCap) so a 4K sequence never holds more than the RAM budget;
 * a frame that has not arrived yet leaves the previous one on screen.
 * Alpha survives: the canvas is cleared before every draw.
 */
export class SequencePlayer {
  readonly canvas = document.createElement('canvas')
  /** Created with the first frame, so its size is final (WebGL textures are immutable-sized). */
  texture: THREE.CanvasTexture | null = null
  private ctx = this.canvas.getContext('2d')!
  private cache = new Map<number, ImageBitmap>()
  private pending = new Set<number>()
  private keep: number[] = []
  private keepSet = new Set<number>()
  private cap = SEQ_MAX_CACHED
  private want = -1
  private shown = -1
  private dead = false
  private bad = new Set<number>()   // unreadable frames: skipped, never retried

  constructor(readonly paths: string[]) {}

  get hasFrame(): boolean { return this.texture !== null }
  get count(): number { return this.paths.length }

  /** Resolves once frame 0 is decoded and the texture exists; rejects if it cannot be read. */
  async ready(): Promise<void> {
    const first = await this.decode(0)
    this.cap = cacheCap(first.width, first.height)
    this.canvas.width = first.width
    this.canvas.height = first.height
    this.cache.set(0, first)
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.draw(0)
  }

  /** Per frame: point the player at frame `idx`. Cheap when nothing changed. */
  show(idx: number) {
    if (this.dead || !this.texture) return
    if (idx !== this.want) {
      this.want = idx
      this.keep = keepWindow(idx, this.paths.length, this.cap)
      this.keepSet = new Set(this.keep)
      for (const [i, bmp] of this.cache) if (!this.keepSet.has(i)) { bmp.close(); this.cache.delete(i) }
      this.pump()
    }
    if (this.shown !== idx && this.cache.has(idx)) this.draw(idx)
  }

  private draw(idx: number) {
    const bmp = this.cache.get(idx)
    if (!bmp || !this.texture) return
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.drawImage(bmp, 0, 0, this.canvas.width, this.canvas.height)
    this.texture.needsUpdate = true
    this.shown = idx
  }

  private decode(i: number): Promise<ImageBitmap> {
    return fetch(`djg-media://f/?p=${encodeURIComponent(this.paths[i])}`)
      .then(r => { if (!r.ok) throw new Error(`frame illeggibile: ${this.paths[i]}`); return r.blob() })
      .then(b => createImageBitmap(b))
  }

  /** Start loads for the window, nearest first, a few at a time. */
  private pump() {
    for (const i of this.keep) {
      if (this.pending.size >= CONCURRENT_LOADS) return
      if (this.cache.has(i) || this.pending.has(i) || this.bad.has(i)) continue
      this.pending.add(i)
      this.decode(i).then(bmp => {
        this.pending.delete(i)
        if (this.dead || !this.keepSet.has(i)) bmp.close()
        else this.cache.set(i, bmp)
        this.pump()
      }).catch(err => {
        this.pending.delete(i)
        // a missing frame is skipped once; the picture holds on the previous one
        console.error('[Sequence]', err)
        this.bad.add(i)
        this.pump()
      })
    }
  }

  dispose() {
    this.dead = true
    for (const bmp of this.cache.values()) bmp.close()
    this.cache.clear()
    this.texture?.dispose()
    this.texture = null
  }
}
