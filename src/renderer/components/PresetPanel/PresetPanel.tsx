import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { Engine, Preset, Playlist, EffectId, PostId } from '@engine/Engine'
import { usePanelCollapsed } from '../usePanelCollapsed'

interface PresetPanelProps {
  engine: Engine | null
}

const STORAGE_KEY_PRESETS = 'djtographikz-presets'
const STORAGE_KEY_PLAYLISTS = 'djtographikz-playlists'

function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRESETS)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function savePresetsToStorage(presets: Preset[]) {
  localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets))
}

function loadPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLAYLISTS)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function savePlaylistsToStorage(playlists: Playlist[]) {
  localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(playlists))
}

export function PresetPanel({ engine }: PresetPanelProps) {
  const [collapsed, toggleCollapsed] = usePanelCollapsed('presets', false, 'right')
  const [tab, setTab] = useState<'presets' | 'playlist'>('presets')

  // Presets
  const [presets, setPresets] = useState<Preset[]>(loadPresets)
  const [presetName, setPresetName] = useState('')

  // Playlists
  const [playlists, setPlaylists] = useState<Playlist[]>(loadPlaylists)
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null)
  const [playlistIndex, setPlaylistIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [playlistName, setPlaylistName] = useState('')
  const [advanceMode, setAdvanceMode] = useState<'timer' | 'beats'>('timer')
  const [advanceInterval, setAdvanceInterval] = useState(8)

  // Playlist building
  const [buildingPlaylist, setBuildingPlaylist] = useState<Preset[]>([])

  const timerRef = useRef<number>(0)
  const beatCountRef = useRef(0)

  // Auto-advance timer
  useEffect(() => {
    if (!playing || !activePlaylist || activePlaylist.presets.length === 0) return
    if (activePlaylist.advanceMode !== 'timer') return

    timerRef.current = window.setInterval(() => {
      setPlaylistIndex(prev => {
        const next = prev + 1
        if (next >= activePlaylist.presets.length) {
          if (activePlaylist.loop) return 0
          setPlaying(false)
          return prev
        }
        return next
      })
    }, activePlaylist.advanceInterval * 1000)

    return () => clearInterval(timerRef.current)
  }, [playing, activePlaylist])

  // Apply preset when playlist index changes
  useEffect(() => {
    if (!playing || !activePlaylist || !engine) return
    const preset = activePlaylist.presets[playlistIndex]
    if (preset) engine.applyPreset(preset)
  }, [playlistIndex, playing, activePlaylist, engine])

  // Beat-based advance
  useEffect(() => {
    if (!playing || !activePlaylist || !engine) return
    if (activePlaylist.advanceMode !== 'beats') return

    beatCountRef.current = 0
    // Subscribe to the render loop — polling misses beats (the flag lives one frame)
    return engine.onAudioFrame(beatDetected => {
      if (!beatDetected) return
      beatCountRef.current++
      if (beatCountRef.current < activePlaylist.advanceInterval) return
      beatCountRef.current = 0
      setPlaylistIndex(prev => {
        const next = prev + 1
        if (next >= activePlaylist.presets.length) {
          if (activePlaylist.loop) return 0
          setPlaying(false)
          return prev
        }
        return next
      })
    })
  }, [playing, activePlaylist, engine])

  // Save preset
  const savePreset = useCallback(() => {
    if (!engine || !presetName.trim()) return
    const preset = engine.createPreset(presetName.trim())
    const next = [...presets, preset]
    setPresets(next)
    savePresetsToStorage(next)
    setPresetName('')
  }, [engine, presetName, presets])

  // Apply preset
  const applyPreset = useCallback((preset: Preset) => {
    if (!engine) return
    engine.applyPreset(preset)
  }, [engine])

  // Delete preset
  const deletePreset = useCallback((index: number) => {
    const next = presets.filter((_, i) => i !== index)
    setPresets(next)
    savePresetsToStorage(next)
  }, [presets])

  // Export all presets as JSON file
  const exportPresets = useCallback(() => {
    const json = JSON.stringify(presets, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'djtographikz-presets.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [presets])

  // Import presets from JSON file
  const importPresets = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const imported: Preset[] = JSON.parse(text)
        if (Array.isArray(imported) && imported.length > 0 && imported[0].effect) {
          const merged = [...presets, ...imported]
          setPresets(merged)
          savePresetsToStorage(merged)
        }
      } catch {}
    }
    input.click()
  }, [presets])

  // Save current building playlist
  const savePlaylist = useCallback(() => {
    if (!playlistName.trim() || buildingPlaylist.length === 0) return
    const pl: Playlist = {
      name: playlistName.trim(),
      presets: [...buildingPlaylist],
      loop: true,
      autoAdvance: true,
      advanceMode,
      advanceInterval,
    }
    const next = [...playlists, pl]
    setPlaylists(next)
    savePlaylistsToStorage(next)
    setPlaylistName('')
    setBuildingPlaylist([])
  }, [playlistName, buildingPlaylist, playlists, advanceMode, advanceInterval])

  // Start playlist
  const startPlaylist = useCallback((pl: Playlist) => {
    setActivePlaylist(pl)
    setPlaylistIndex(0)
    setPlaying(true)
    if (engine && pl.presets.length > 0) {
      engine.applyPreset(pl.presets[0])
    }
  }, [engine])

  // Stop playlist
  const stopPlaylist = useCallback(() => {
    setPlaying(false)
    setActivePlaylist(null)
  }, [])

  // Delete playlist
  const deletePlaylist = useCallback((index: number) => {
    const next = playlists.filter((_, i) => i !== index)
    setPlaylists(next)
    savePlaylistsToStorage(next)
    if (activePlaylist === playlists[index]) stopPlaylist()
  }, [playlists, activePlaylist, stopPlaylist])

  // Export playlists
  const exportPlaylists = useCallback(() => {
    const json = JSON.stringify(playlists, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'djtographikz-playlists.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [playlists])

  // Import playlists
  const importPlaylists = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const imported: Playlist[] = JSON.parse(text)
        if (Array.isArray(imported) && imported.length > 0 && imported[0].presets) {
          const merged = [...playlists, ...imported]
          setPlaylists(merged)
          savePlaylistsToStorage(merged)
        }
      } catch {}
    }
    input.click()
  }, [playlists])

  // Prev/Next for active playlist
  const playlistPrev = useCallback(() => {
    if (!activePlaylist) return
    setPlaylistIndex(prev => {
      const next = prev - 1
      return next < 0 ? (activePlaylist.loop ? activePlaylist.presets.length - 1 : 0) : next
    })
  }, [activePlaylist])

  const playlistNext = useCallback(() => {
    if (!activePlaylist) return
    setPlaylistIndex(prev => {
      const next = prev + 1
      return next >= activePlaylist.presets.length
        ? (activePlaylist.loop ? 0 : activePlaylist.presets.length - 1) : next
    })
  }, [activePlaylist])

  return (
    <div className="panel">
      <div
        className="panel-header"
        onClick={toggleCollapsed}
        title={collapsed ? 'Espandi Preset & Playlist' : 'Comprimi Preset & Playlist'}
      >
        <span>Preset & Playlist</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div className="u-col" style={{ gap: '10px' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className={`pill${tab === 'presets' ? ' active' : ''}`} title="Mostra i preset salvati" onClick={() => setTab('presets')}>
              Preset ({presets.length})
            </button>
            <button className={`pill${tab === 'playlist' ? ' active' : ''}`} title="Mostra le playlist" onClick={() => setTab('playlist')}>
              Playlist ({playlists.length})
            </button>
          </div>

          {tab === 'presets' && (
            <div className="u-col">
              {/* Save current as preset */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="text"
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && savePreset()}
                  placeholder="Nome preset…"
                  title="Nome del preset da salvare"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button className="btn btn-secondary" title="Salva lo stato corrente come preset" onClick={savePreset} disabled={!presetName.trim()}>
                  Salva
                </button>
              </div>

              {/* Preset list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '200px', overflowY: 'auto' }}>
                {presets.map((p, i) => (
                  <div key={i} className="row-item" style={{ cursor: 'default' }}>
                    {/* Color dots */}
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      {p.colors.map((c, j) => (
                        <div key={j} style={{
                          width: '8px', height: '8px', borderRadius: '2px', background: c,
                        }} />
                      ))}
                    </div>
                    <span className="row-title" style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </span>
                    <span className="row-sub">{p.effect}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => applyPreset(p)} title="Applica preset">
                      ▶
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                      setBuildingPlaylist(prev => [...prev, p])
                    }} title="Aggiungi alla playlist in costruzione">
                      +
                    </button>
                    <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deletePreset(i)} title="Elimina preset">
                      ×
                    </button>
                  </div>
                ))}
                {presets.length === 0 && (
                  <div className="u-hint" style={{ textAlign: 'center', padding: 'var(--s2)' }}>
                    Nessun preset salvato
                  </div>
                )}
              </div>

              {/* Import / Export */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} title="Importa preset da file JSON" onClick={importPresets}>Importa</button>
                <button className="btn btn-secondary" style={{ flex: 1 }} title="Esporta i preset in un file JSON" onClick={exportPresets} disabled={presets.length === 0}>Esporta</button>
              </div>
            </div>
          )}

          {tab === 'playlist' && (
            <div className="u-col">
              {/* Now playing */}
              {playing && activePlaylist && (
                <div className="active-banner" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="active-banner-label">In riproduzione: {activePlaylist.name}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-primary)', marginTop: '3px' }}>
                    {playlistIndex + 1}/{activePlaylist.presets.length}: {activePlaylist.presets[playlistIndex]?.name}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                    <button className="btn btn-secondary btn-sm" title="Preset precedente" onClick={playlistPrev}>Prec</button>
                    <button className="btn btn-secondary btn-sm" title="Preset successivo" onClick={playlistNext}>Succ</button>
                    <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} title="Ferma la playlist" onClick={stopPlaylist}>Stop</button>
                  </div>
                </div>
              )}

              {/* Playlist builder */}
              <div className="cat-label" style={{ color: 'var(--accent)' }}>Crea playlist</div>

              {buildingPlaylist.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '120px', overflowY: 'auto' }}>
                  {buildingPlaylist.map((p, i) => (
                    <div key={i} className="u-row" style={{
                      gap: '4px', padding: '3px 6px', borderRadius: 'var(--r-sm)',
                      background: 'var(--bg1)',
                      fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)',
                    }}>
                      <span className="u-hint" style={{ width: '16px' }}>{i + 1}.</span>
                      <div style={{ display: 'flex', gap: '1px' }}>
                        {p.colors.map((c, j) => (
                          <div key={j} style={{ width: '6px', height: '6px', borderRadius: '1px', background: c }} />
                        ))}
                      </div>
                      <span style={{ flex: 1 }}>{p.name}</span>
                      <span className="u-hint">{p.effect}</span>
                      {/* Move up */}
                      {i > 0 && (
                        <button className="tiny-btn" title="Sposta su" onClick={() => {
                          const next = [...buildingPlaylist]
                          ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                          setBuildingPlaylist(next)
                        }}>↑</button>
                      )}
                      {/* Move down */}
                      {i < buildingPlaylist.length - 1 && (
                        <button className="tiny-btn" title="Sposta giù" onClick={() => {
                          const next = [...buildingPlaylist]
                          ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
                          setBuildingPlaylist(next)
                        }}>↓</button>
                      )}
                      <button className="tiny-btn danger" title="Togli dalla playlist" onClick={() => {
                        setBuildingPlaylist(prev => prev.filter((_, j) => j !== i))
                      }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {buildingPlaylist.length === 0 && (
                <div className="u-hint" style={{ textAlign: 'center', padding: '4px' }}>
                  Premi + su un preset per aggiungerlo qui
                </div>
              )}

              {/* Advance settings */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button className={`pill${advanceMode === 'timer' ? ' active' : ''}`} title="Avanza a intervalli di tempo" onClick={() => setAdvanceMode('timer')}>
                  Timer
                </button>
                <button className={`pill${advanceMode === 'beats' ? ' active' : ''}`} title="Avanza sincronizzato ai beat" onClick={() => setAdvanceMode('beats')}>
                  Beat Sync
                </button>
              </div>
              <div className="u-row">
                <span className="u-hint" style={{ width: '52px', flexShrink: 0 }}>
                  {advanceMode === 'timer' ? 'Intervallo' : 'Beat'}
                </span>
                <input
                  type="range"
                  min={advanceMode === 'timer' ? 2 : 1}
                  max={advanceMode === 'timer' ? 60 : 64}
                  step={1}
                  value={advanceInterval}
                  title={advanceMode === 'timer' ? 'Secondi tra un preset e il successivo' : 'Beat tra un preset e il successivo'}
                  onChange={e => setAdvanceInterval(parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span className="u-value" style={{ width: '28px', flexShrink: 0 }}>
                  {advanceInterval}{advanceMode === 'timer' ? 's' : 'b'}
                </span>
              </div>

              {/* Save playlist */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="text"
                  value={playlistName}
                  onChange={e => setPlaylistName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && savePlaylist()}
                  placeholder="Nome playlist…"
                  title="Nome della playlist da salvare"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button className="btn btn-secondary" title="Salva la playlist" onClick={savePlaylist} disabled={!playlistName.trim() || buildingPlaylist.length === 0}>
                  Salva
                </button>
              </div>

              {/* Saved playlists */}
              <div className="cat-label" style={{ color: 'var(--accent)', marginTop: '4px' }}>
                Playlist salvate
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '150px', overflowY: 'auto' }}>
                {playlists.map((pl, i) => (
                  <div key={i} className={`row-item${activePlaylist === pl ? ' active' : ''}`} style={{ cursor: 'default' }}>
                    <span className="row-title" style={{ color: 'var(--text-primary)', flex: 1 }}>
                      {pl.name}
                    </span>
                    <span className="row-sub">
                      {pl.presets.length} preset · {pl.advanceMode === 'timer' ? `${pl.advanceInterval}s` : `${pl.advanceInterval}b`}
                    </span>
                    <button className="btn btn-secondary btn-sm" onClick={() => startPlaylist(pl)} title="Avvia playlist">
                      ▶
                    </button>
                    <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deletePlaylist(i)} title="Elimina playlist">
                      ×
                    </button>
                  </div>
                ))}
                {playlists.length === 0 && (
                  <div className="u-hint" style={{ textAlign: 'center', padding: 'var(--s2)' }}>
                    Nessuna playlist salvata
                  </div>
                )}
              </div>

              {/* Import / Export */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} title="Importa playlist da file JSON" onClick={importPlaylists}>Importa</button>
                <button className="btn btn-secondary" style={{ flex: 1 }} title="Esporta le playlist in un file JSON" onClick={exportPlaylists} disabled={playlists.length === 0}>Esporta</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
