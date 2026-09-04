import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Media library (persistent under ~/.djtographikz/assets)
  librarySave: (name: string, dataUrl: string): Promise<{ name: string; path: string }> =>
    ipcRenderer.invoke('library:save', name, dataUrl),
  librarySaveCopy: (name: string, sourcePath: string): Promise<{ name: string; path: string }> =>
    ipcRenderer.invoke('library:save-copy', name, sourcePath),
  libraryList: (): Promise<{ name: string; path: string }[]> => ipcRenderer.invoke('library:list'),
  libraryDelete: (name: string): Promise<void> => ipcRenderer.invoke('library:delete', name),

  // ISF folder (~/.djtographikz/isf)
  listIsf: (): Promise<{ name: string; source: string }[]> => ipcRenderer.invoke('isf:list'),
  browseIsf: (force?: boolean): Promise<{ id: string; title: string; user: string; thumb: string; stars: number }[]> =>
    ipcRenderer.invoke('isf:browse', force),
  importIsfOnline: (id: string, title: string): Promise<{ name: string; source: string }> =>
    ipcRenderer.invoke('isf:import-online', id, title),
  importIsfFile: (): Promise<{ name: string; source: string }[]> => ipcRenderer.invoke('isf:import-file'),

  // Asset operations
  importAssets: () => ipcRenderer.invoke('asset:import'),
  pickVideos: (): Promise<{ name: string; path: string }[]> => ipcRenderer.invoke('asset:pick-video'),
  readFile: (path: string): Promise<ArrayBuffer> => ipcRenderer.invoke('asset:read-file', path),

  // Web remote
  getRemoteInfo: (): Promise<{ url: string; code: string }> => ipcRenderer.invoke('remote:info'),
  resetRemote: (): Promise<{ code: string }> => ipcRenderer.invoke('remote:reset'),
  onRemoteCommand: (callback: (cmd: { type: string; value?: unknown; source?: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, cmd: any) => callback(cmd)
    ipcRenderer.on('remote:cmd', handler)
    return () => { ipcRenderer.removeListener('remote:cmd', handler) }
  },
  // Catalogs + look bank pushed to the remote server (served at GET /defs)
  sendRemoteDefs: (defs: unknown) => ipcRenderer.send('remote:defs', defs),
  sendRemoteLooks: (looks: { index: number; name: string; thumb: string }[]) =>
    ipcRenderer.send('remote:looks', looks),
  // AutoVJ status pushed by the renderer so the phone stays in sync
  sendRemoteVj: (vj: { enabled: boolean; genre: string }) => ipcRenderer.send('remote:vj', vj),

  // Output window status (U1.3)
  getOutputInfo: (): Promise<{ open: boolean; fullscreen: boolean; display: string }> =>
    ipcRenderer.invoke('output:info'),
  reopenOutput: () => ipcRenderer.send('output:reopen'),
  onOutputChanged: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('output:changed', handler)
    return () => { ipcRenderer.removeListener('output:changed', handler) }
  },

  // Display operations
  listDisplays: () => ipcRenderer.invoke('displays:list'),
  moveOutputToDisplay: (displayId: number) => ipcRenderer.send('output:move-to-display', displayId),
  toggleOutputFullscreen: () => ipcRenderer.send('output:toggle-fullscreen'),
  setOutputResolution: (w: number, h: number) => ipcRenderer.send('output:set-resolution', w, h),
  onOutputResolution: (callback: (w: number, h: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, w: number, h: number) => callback(w, h)
    ipcRenderer.on('output:set-resolution', handler)
    return () => ipcRenderer.removeListener('output:set-resolution', handler)
  },

  // Engine state sync (control → output)
  sendEngineState: (state: unknown) => ipcRenderer.send('engine:state-update', state),
  onEngineState: (callback: (state: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state)
    ipcRenderer.on('engine:state-update', handler)
    return () => ipcRenderer.removeListener('engine:state-update', handler)
  },

  // Audio data sync (control → output)
  sendAudioData: (data: unknown) => ipcRenderer.send('audio:data', data),
  onAudioData: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on('audio:data', handler)
    return () => ipcRenderer.removeListener('audio:data', handler)
  },

  // Overlay sync (control → output)
  sendOverlayAdd: (data: { id: string; name: string; dataUrl: string; opacity: number; scale: number; offsetX: number; offsetY: number; visible: boolean; gifSync: string; displace: number; source?: unknown }) =>
    ipcRenderer.send('overlay:add', data),
  sendOverlayRemove: (id: string) => ipcRenderer.send('overlay:remove', id),
  sendOverlayUpdate: (id: string, updates: Record<string, unknown>) => ipcRenderer.send('overlay:update', id, updates),
  onOverlayAdd: (callback: (data: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('overlay:add', handler)
    return () => ipcRenderer.removeListener('overlay:add', handler)
  },
  onOverlayRemove: (callback: (id: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, id: string) => callback(id)
    ipcRenderer.on('overlay:remove', handler)
    return () => ipcRenderer.removeListener('overlay:remove', handler)
  },
  onOverlayUpdate: (callback: (id: string, updates: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, id: string, updates: any) => callback(id, updates)
    ipcRenderer.on('overlay:update', handler)
    return () => ipcRenderer.removeListener('overlay:update', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ApiType = typeof api
