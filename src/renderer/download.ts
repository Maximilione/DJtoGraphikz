/**
 * The one way to hand the user a file.
 *
 * Six copies of anchor + click() + revokeObjectURL used to live in App, the
 * preset panel and the shader editor. All of them revoked the URL right after
 * click(): Chromium starts the download asynchronously, so on a big blob (the
 * WebM of a set) the URL could be gone before the download began. The revoke
 * waits long enough for any download to start.
 */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** `djtographikz-<timestamp>.<ext>` — file names that sort by time in a folder */
export function stampedName(ext: string): string {
  return `djtographikz-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`
}
