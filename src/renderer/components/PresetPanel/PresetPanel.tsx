import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { Engine, Preset, Playlist, EffectId, PostId } from '@engine/Engine'

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
  const [collapsed, setCollapsed] = useState(false)
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
    const interval = setInterval(() => {
      const data = engine.audioAnalyzer.getData()
      if (data.beatDetected) {
        beatCountRef.current++
        if (beatCountRef.current >= activePlaylist.advanceInterval) {
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
        }
      }
    }, 50) // check beats at 20Hz

    return () => clearInterval(interval)
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
      <div className="panel-header" onClick={() => setCollapsed(!collapsed)}>
        <span>Presets & Playlist</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => setTab('presets')} style={pillStyle(tab === 'presets')}>
              Presets ({presets.length})
            </button>
            <button onClick={() => setTab('playlist')} style={pillStyle(tab === 'playlist')}>
              Playlist ({playlists.length})
            </button>
          </div>

          {tab === 'presets' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Save current as preset */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="text"
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && savePreset()}
                  placeholder="Preset name..."
                  style={inputStyle}
                />
                <button onClick={savePreset} style={btnStyle} disabled={!presetName.trim()}>
                  Save
                </button>
              </div>

              {/* Preset list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '200px', overflowY: 'auto' }}>
                {presets.map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 6px', borderRadius: '4px',
                    background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                  }}>
                    {/* Color dots */}
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      {p.colors.map((c, j) => (
                        <div key={j} style={{
                          width: '8px', height: '8px', borderRadius: '2px', background: c,
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                      {p.effect}
                    </span>
                    <button onClick={() => applyPreset(p)} style={smallBtnStyle} title="Apply">
                      ▶
                    </button>
                    <button onClick={() => {
                      setBuildingPlaylist(prev => [...prev, p])
                    }} style={smallBtnStyle} title="Add to playlist builder">
                      +
                    </button>
                    <button onClick={() => deletePreset(i)} style={{ ...smallBtnStyle, color: '#ff4444' }} title="Delete">
                      ×
                    </button>
                  </div>
                ))}
                {presets.length === 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
                    No presets saved yet
                  </div>
                )}
              </div>

              {/* Import / Export */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={importPresets} style={{ ...btnStyle, flex: 1 }}>Import</button>
                <button onClick={exportPresets} style={{ ...btnStyle, flex: 1 }} disabled={presets.length === 0}>Export</button>
              </div>
            </div>
          )}

          {tab === 'playlist' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Now playing */}
              {playing && activePlaylist && (
                <div style={{
                  padding: '6px 8px', borderRadius: '4px',
                  background: 'var(--accent-glow)', border: '1px solid var(--accent)',
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                    NOW PLAYING: {activePlaylist.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-primary)', marginTop: '3px' }}>
                    {playlistIndex + 1}/{activePlaylist.presets.length}: {activePlaylist.presets[playlistIndex]?.name}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                    <button onClick={playlistPrev} style={btnStyle}>Prev</button>
                    <button onClick={playlistNext} style={btnStyle}>Next</button>
                    <button onClick={stopPlaylist} style={{ ...btnStyle, color: '#ff4444' }}>Stop</button>
                  </div>
                </div>
              )}

              {/* Playlist builder */}
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Build Playlist
              </div>

              {buildingPlaylist.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '120px', overflowY: 'auto' }}>
                  {buildingPlaylist.map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '3px 6px', borderRadius: '3px',
                      background: 'var(--bg-secondary)',
                      fontSize: '10px', color: 'var(--text-secondary)',
                    }}>
                      <span style={{ color: 'var(--text-muted)', width: '16px' }}>{i + 1}.</span>
                      <div style={{ display: 'flex', gap: '1px' }}>
                        {p.colors.map((c, j) => (
                          <div key={j} style={{ width: '6px', height: '6px', borderRadius: '1px', background: c }} />
                        ))}
                      </div>
                      <span style={{ flex: 1 }}>{p.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{p.effect}</span>
                      {/* Move up */}
                      {i > 0 && (
                        <button onClick={() => {
                          const next = [...buildingPlaylist]
                          ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                          setBuildingPlaylist(next)
                        }} style={tinyBtnStyle}>↑</button>
                      )}
                      {/* Move down */}
                      {i < buildingPlaylist.length - 1 && (
                        <button onClick={() => {
                          const next = [...buildingPlaylist]
                          ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
                          setBuildingPlaylist(next)
                        }} style={tinyBtnStyle}>↓</button>
                      )}
                      <button onClick={() => {
                        setBuildingPlaylist(prev => prev.filter((_, j) => j !== i))
                      }} style={{ ...tinyBtnStyle, color: '#ff4444' }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {buildingPlaylist.length === 0 && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '4px' }}>
                  Click + on presets to add them here
                </div>
              )}

              {/* Advance settings */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => setAdvanceMode('timer')} style={pillStyle(advanceMode === 'timer')}>
                  Timer
                </button>
                <button onClick={() => setAdvanceMode('beats')} style={pillStyle(advanceMode === 'beats')}>
                  Beat Sync
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '52px', flexShrink: 0 }}>
                  {advanceMode === 'timer' ? 'Interval' : 'Beats'}
                </span>
                <input
                  type="range"
                  min={advanceMode === 'timer' ? 2 : 1}
                  max={advanceMode === 'timer' ? 60 : 64}
                  step={1}
                  value={advanceInterval}
                  onChange={e => setAdvanceInterval(parseInt(e.target.value))}
                  style={{ flex: 1, height: '14px' }}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', width: '28px', textAlign: 'right' }}>
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
                  placeholder="Playlist name..."
                  style={inputStyle}
                />
                <button onClick={savePlaylist} style={btnStyle} disabled={!playlistName.trim() || buildingPlaylist.length === 0}>
                  Save
                </button>
              </div>

              {/* Saved playlists */}
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '4px' }}>
                Saved Playlists
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '150px', overflowY: 'auto' }}>
                {playlists.map((pl, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '5px 6px', borderRadius: '4px',
                    background: activePlaylist === pl ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                    border: activePlaylist === pl ? '1px solid var(--accent)' : '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-primary)', flex: 1 }}>
                      {pl.name}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                      {pl.presets.length} presets · {pl.advanceMode === 'timer' ? `${pl.advanceInterval}s` : `${pl.advanceInterval}b`}
                    </span>
                    <button onClick={() => startPlaylist(pl)} style={smallBtnStyle} title="Play">
                      ▶
                    </button>
                    <button onClick={() => deletePlaylist(i)} style={{ ...smallBtnStyle, color: '#ff4444' }} title="Delete">
                      ×
                    </button>
                  </div>
                ))}
                {playlists.length === 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
                    No playlists saved yet
                  </div>
                )}
              </div>

              {/* Import / Export */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={importPlaylists} style={{ ...btnStyle, flex: 1 }}>Import</button>
                <button onClick={exportPlaylists} style={{ ...btnStyle, flex: 1 }} disabled={playlists.length === 0}>Export</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '5px 6px', borderRadius: '4px',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontSize: '11px', fontWeight: active ? 600 : 400, cursor: 'pointer',
  }
}

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '5px 8px', borderRadius: '4px',
  border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)', fontSize: '11px', outline: 'none',
}

const btnStyle: React.CSSProperties = {
  padding: '5px 10px', borderRadius: '4px',
  border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
  color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer',
}

const smallBtnStyle: React.CSSProperties = {
  padding: '2px 6px', borderRadius: '3px',
  border: '1px solid var(--border)', background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)', fontSize: '10px', cursor: 'pointer',
  lineHeight: 1,
}

const tinyBtnStyle: React.CSSProperties = {
  padding: '1px 4px', borderRadius: '2px',
  border: 'none', background: 'transparent',
  color: 'var(--text-muted)', fontSize: '10px', cursor: 'pointer',
}
