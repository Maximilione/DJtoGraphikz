/** Every media format the overlays can load — one list for dialogs, library and renderer. */

/** Decoded natively by Chromium's <img>. */
export const IMAGE_NATIVE = ['png', 'apng', 'jpg', 'jpeg', 'jfif', 'pjpeg', 'pjp', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico', 'cur']

/** Not decodable by Chromium: converted to PNG on import (macOS `sips`). */
export const IMAGE_CONVERT = ['heic', 'heif', 'tif', 'tiff', 'jp2', 'j2k', 'psd', 'tga', 'pict', 'icns', 'dng', 'cr2', 'nef', 'arw']

/** What the <video> element plays (H.264/HEVC-less mp4, webm, mov, ogg, mkv with webm codecs). */
export const VIDEO_EXT = ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'ogv', 'ogg', '3gp', '3g2']

/** 3D models for the `mesh` effect (GLTF only when self-contained: .glb or embedded buffers). */
export const MODEL_EXT = ['glb', 'gltf', 'obj', 'stl', 'ply', 'fbx']

const alt = (l: string[]) => new RegExp(`\\.(${l.join('|')})$`, 'i')
export const IMAGE_RE = alt(IMAGE_NATIVE)
export const VIDEO_RE = alt(VIDEO_EXT)
export const MODEL_RE = alt(MODEL_EXT)
export const CONVERT_RE = alt(IMAGE_CONVERT)

export function imageMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || 'png'
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'jpg' || ext === 'jfif' || ext === 'pjpeg' || ext === 'pjp') return 'image/jpeg'
  if (ext === 'apng') return 'image/apng'
  if (ext === 'ico' || ext === 'cur') return 'image/x-icon'
  if (ext === 'bmp') return 'image/bmp'
  return `image/${ext}`
}
