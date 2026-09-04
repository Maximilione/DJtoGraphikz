import React, { useState, useCallback } from 'react'
import type { Engine, EffectId, PostId, TransitionType, Grade } from '@engine/Engine'
import type { EffectParam, AudioSource } from '@engine/EffectParams'
import { loadISF } from '@engine/IsfLoader'
import { NumberInput } from '../NumberInput/NumberInput'
import { ParamControls } from '../ParamControls/ParamControls'
import { getThumb, useFxThumbs, thumbBackground } from '../../fxThumbs'
import { IsfBrowser } from './IsfBrowser'
import { pushToast } from '../Toasts/Toasts'

interface EffectPanelProps {
  engine: Engine | null
}

// Effects organized by category
export const EFFECT_CATEGORIES: { name: string; effects: { id: EffectId; label: string; icon: string }[] }[] = [
  {
    name: 'Geometrici',
    effects: [
      { id: 'tunnel', label: 'Tunnel', icon: '◎' },
      { id: 'kaleidoscope', label: 'Kaleido', icon: '✦' },
      { id: 'voronoi', label: 'Voronoi', icon: '⬡' },
      { id: 'sacred', label: 'Sacred', icon: '✡' },
      { id: 'mandala', label: 'Mandala', icon: '❋' },
      { id: 'hexagons', label: 'Hex', icon: '⏣' },
      { id: 'rings', label: 'Rings', icon: '◉' },
    ],
  },
  {
    name: 'Organici',
    effects: [
      { id: 'fluid', label: 'Fluid', icon: '≋' },
      { id: 'plasma', label: 'Plasma', icon: '◈' },
      { id: 'warp', label: 'Warp', icon: '∿' },
      { id: 'metaballs', label: 'Meta', icon: '●' },
      { id: 'fire', label: 'Fire', icon: '△' },
      { id: 'fractal', label: 'Fractal', icon: '✻' },
    ],
  },
  {
    name: 'Movimento',
    effects: [
      { id: 'particles', label: 'Particle', icon: '⁂' },
      { id: 'starfield', label: 'Stars', icon: '✧' },
      { id: 'waves', label: 'Waves', icon: '〰' },
      { id: 'lissajous', label: 'Lissaj', icon: '∞' },
      { id: 'dna', label: 'DNA', icon: '⧖' },
    ],
  },
  {
    name: 'Digitali',
    effects: [
      { id: 'matrix', label: 'Matrix', icon: '▤' },
      { id: 'grid', label: 'Grid', icon: '⊞' },
      { id: 'glitch', label: 'Glitch', icon: '⚡' },
    ],
  },
]

const POST_CATEGORIES: { name: string; effects: { id: PostId; label: string; icon: string; desc: string }[] }[] = [
  {
    name: 'Glow & Colore',
    effects: [
      { id: 'bloom', label: 'Bloom', icon: '✦', desc: 'Diffusione del glow' },
      { id: 'chromatic', label: 'Chromatic', icon: '◐', desc: 'Aberrazione prismatica' },
      { id: 'rgb-split', label: 'RGB Split', icon: '▥', desc: 'Offset canali colore' },
      { id: 'invert', label: 'Invert', icon: '◑', desc: 'Colori in negativo' },
    ],
  },
  {
    name: 'Distorsione',
    effects: [
      { id: 'feedback', label: 'Feedback', icon: '↻', desc: 'Scia in feedback' },
      { id: 'mirror', label: 'Mirror', icon: '⎸', desc: 'Simmetria orizzontale' },
      { id: 'pixelate', label: 'Pixelate', icon: '▦', desc: 'Pixel retrò' },
    ],
  },
  {
    name: 'Pellicola & Texture',
    effects: [
      { id: 'filmgrain', label: 'Film Grain', icon: '⁘', desc: 'Grana analogica' },
      { id: 'scanlines', label: 'Scanlines', icon: '≡', desc: 'Righe CRT' },
    ],
  },
]

export const COLOR_PRESETS: { label: string; colors: [string, string, string] }[] = [
  { label: 'Acid', colors: ['#00ff88', '#ff00ff', '#4444ff'] },
  { label: 'Fire', colors: ['#ff4400', '#ffaa00', '#ff0066'] },
  { label: 'Ice', colors: ['#00ccff', '#0044ff', '#88ffff'] },
  { label: 'Toxic', colors: ['#00ff00', '#aaff00', '#00ff88'] },
  { label: 'Neon', colors: ['#ff00ff', '#00ffff', '#ffff00'] },
  { label: 'Blood', colors: ['#ff0000', '#880000', '#ff4444'] },
  { label: 'Vapor', colors: ['#ff71ce', '#01cdfe', '#b967ff'] },
  { label: 'Mono', colors: ['#ffffff', '#888888', '#ffffff'] },
  { label: 'Sunset', colors: ['#ff6b35', '#f7c59f', '#1a535c'] },
  { label: 'Ocean', colors: ['#0077b6', '#00b4d8', '#90e0ef'] },
  { label: 'Forest', colors: ['#2d6a4f', '#52b788', '#95d5b2'] },
  { label: 'Cyber', colors: ['#f72585', '#7209b7', '#3a0ca3'] },
  { label: 'Gold', colors: ['#ffd700', '#daa520', '#b8860b'] },
  { label: 'Pastel', colors: ['#ffc8dd', '#bde0fe', '#a2d2ff'] },
  { label: 'Lava', colors: ['#ff4500', '#ff6347', '#2b0000'] },
  { label: 'Aurora', colors: ['#00ff87', '#60efff', '#ff00e5'] },
]

const CUSTOM_INDEX = COLOR_PRESETS.length

// Sub-sections as tabs
type Section = 'fx' | 'post' | 'color'

export function EffectPanel({ engine }: EffectPanelProps) {
  const [section, setSection] = useState<Section>('fx')
  const [activeEffect, setActiveEffect] = useState<EffectId>('tunnel')
  const [activePosts, setActivePosts] = useState<Set<PostId>>(new Set(['bloom']))
  const [postChain, setPostChain] = useState<{ id: PostId; amount: number }[]>([{ id: 'bloom', amount: 1 }])
  const [grade, setGradeState] = useState<Grade>({ contrast: 1.05, saturation: 1.1, vignette: 0.25, lift: 0, exposure: 1.1 })
  const [activeColorPreset, setActiveColorPreset] = useState(0)
  const [customColors, setCustomColors] = useState<[string, string, string]>(['#ff0000', '#00ff00', '#0000ff'])
  const [transitionSpeed, setTransitionSpeed] = useState(0.5)
  const [search, setSearch] = useState('')

  // Transition state
  const [transitionType, setTransitionType] = useState<TransitionType>('crossfade')
  const [transitionDuration, setTransitionDuration] = useState(0.8)
  const [transitionBeatSync, setTransitionBeatSync] = useState(false)

  // ISF library (~/.djtographikz/isf)
  const [isfEffects, setIsfEffects] = useState<{ name: string; frag: string; params: EffectParam[]; imageInputs: string[] }[]>([])
  const [isfFailed, setIsfFailed] = useState<string[]>([])
  const [isfActive, setIsfActive] = useState<string | null>(null)
  const [isfError, setIsfError] = useState<string | null>(null)

  // Cycling state
  const [cycleEnabled, setCycleEnabled] = useState(false)
  const [cycleBeatSync, setCycleBeatSync] = useState(false)
  const [cycleInterval, setCycleInterval] = useState(8)
  const [cycleBeats, setCycleBeats] = useState(16)
  const [cycleSelection, setCycleSelection] = useState<Set<number>>(() => new Set(COLOR_PRESETS.map((_, i) => i)))

  // Sync from engine on mount (boot restore may not emit), then subscribe:
  // state changes come from ANY surface (phone remote, AutoVJ, hotkeys, presets)
  React.useEffect(() => {
    if (!engine) return
    const syncColors = (colors: [string, string, string]) => {
      const idx = COLOR_PRESETS.findIndex(p => p.colors.every((c, i) => c === colors[i]))
      if (idx >= 0) {
        setActiveColorPreset(idx)
      } else {
        // ponytail: mid-lerp colors can land here and repaint the custom swatch — cosmetic only
        setActiveColorPreset(CUSTOM_INDEX)
        setCustomColors(colors)
      }
    }
    setActiveEffect(engine.getCurrentEffect())
    setActivePosts(new Set(engine.getActivePosts()))
    setPostChain(engine.getPostChain())
    setGradeState(engine.getGrade())
    syncColors(engine.getCurrentColors())
    setTransitionType(engine.getTransitionType())
    setTransitionDuration(engine.getTransitionDuration())
    setTransitionBeatSync(engine.isTransitionBeatSync())
    setTransitionSpeed(engine.getColorTransitionSpeed())
    setCycleEnabled(engine.isCycleEnabled())
    setCycleBeatSync(engine.isCycleBeatSync())
    setCycleInterval(Math.round(engine.getCycleInterval() / 1000))
    setCycleBeats(engine.getCycleBeatsPerSwitch())
    return engine.onState(state => {
      setActiveEffect(state.activeEffect)
      setActivePosts(new Set(state.activePost))
      setPostChain(engine.getPostChain())
      if (state.grade) setGradeState(state.grade)
      syncColors(state.colors)
      if (state.transitionType) setTransitionType(state.transitionType)
      if (state.transitionDuration !== undefined) setTransitionDuration(state.transitionDuration)
      if (state.transitionBeatSync !== undefined) setTransitionBeatSync(state.transitionBeatSync)
      if (state.colorSpeed !== undefined) setTransitionSpeed(state.colorSpeed)
      if (state.cycle) {
        setCycleEnabled(state.cycle.enabled)
        setCycleBeatSync(state.cycle.beatSync)
        setCycleInterval(Math.round(state.cycle.intervalMs / 1000))
        setCycleBeats(state.cycle.beatsPerSwitch)
      }
      // custom shader dropped (stock effect selected anywhere) → ISF highlight off
      if (!state.customShader) setIsfActive(null)
    })
  }, [engine])

  // Thumbnails: capture from the live engine ~1.5s after each effect change
  useFxThumbs(engine, activeEffect)

  // ISF library: read ~/.djtographikz/isf, parse each file
  const refreshIsf = useCallback(() => {
    window.api?.listIsf?.()
      .then(files => {
        const ok: { name: string; frag: string; params: EffectParam[]; imageInputs: string[] }[] = []
        const failed: string[] = []
        for (const f of files) {
          try {
            const res = loadISF(f.source, f.name)
            if ('error' in res) failed.push(f.name)
            else ok.push({ name: f.name, frag: res.fragment, params: res.params, imageInputs: res.imageInputs })
          } catch {
            failed.push(f.name)
          }
        }
        setIsfEffects(ok)
        setIsfFailed(failed)
      })
      .catch(() => { /* IPC unavailable (old preload) — section stays hidden */ })
  }, [])
  React.useEffect(() => { refreshIsf() }, [refreshIsf])

  // Import result (from file picker or online browser): refresh the list,
  // report parse errors right away instead of a silent "ignorato" at next boot
  const [isfBrowserOpen, setIsfBrowserOpen] = useState(false)
  const onIsfImported = useCallback((name: string, source: string) => {
    const res = loadISF(source, name)
    if ('error' in res) {
      pushToast(`"${name}": ${res.error}`, `isf-err-${name}`)
    } else {
      pushToast(`Shader "${name}" importato`, `isf-ok-${name}`)
    }
    refreshIsf()
  }, [refreshIsf])

  const importIsfFiles = useCallback(async () => {
    try {
      const files = await window.api.importIsfFile()
      if (files.length === 0) return
      for (const f of files) onIsfImported(f.name, f.source)
    } catch (e: any) {
      pushToast(`Import fallito: ${e?.message || e}`, 'isf-import-err')
    }
  }, [onIsfImported])

  // ISF image inputs: pick a picture, feed it to the shader as a texture
  const pickIsfImage = useCallback((inputName: string) => {
    if (!engine) return
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'image/*'
    inp.onchange = () => {
      const file = inp.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        engine.setCustomImage(inputName, String(reader.result))
        pushToast(`Immagine assegnata a "${inputName}"`, `isf-img-${inputName}`)
      }
      reader.readAsDataURL(file)
    }
    inp.click()
  }, [engine])

  // Smart mapping: guess an audio source for each ISF param from its name,
  // round-robin fallback so every param gets something audio-reactive
  const smartMapIsf = useCallback(() => {
    if (!engine) return
    const rules: [RegExp, AudioSource, number, number?][] = [
      [/zoom|scale|size|radius|amp/i, 'bass', 0.5],
      [/bright|intens|glow|light|exposure|gain|amount|alpha|opacity/i, 'energy', 0.6],
      [/glitch|noise|distort|chaos|shake|jitter/i, 'high', 0.6],
      [/detail|iter|count|num|segment|density|complex|freq/i, 'mid', 0.4],
      [/twist|rot|angle|spin|swirl/i, 'lfo-sine', 0.5, 8],
      [/offset|shift|slide|scroll/i, 'lfo-saw', 0.3, 16],
      [/hue|color|sat|tint/i, 'lfo-sine', 0.4, 32],
      [/speed|rate|vel|flow/i, 'energy', 0.4],
      [/beat|pulse|flash|strobe|kick/i, 'beat', 0.8],
    ]
    const fallback: AudioSource[] = ['bass', 'high', 'mid', 'energy']
    let fi = 0, n = 0
    for (const def of engine.getParamDefs()) {
      if (def.key === 'speed' || def.key === 'reactivity') continue
      const rule = rules.find(([re]) => re.test(def.key) || re.test(def.label))
      if (rule) engine.setParamMapping(def.key, rule[1], rule[2], rule[3])
      else engine.setParamMapping(def.key, fallback[fi++ % fallback.length], 0.45)
      n++
    }
    pushToast(n > 0 ? `Smart map: ${n} parametri mappati all'audio` : 'Nessun parametro da mappare', 'isf-smartmap')
  }, [engine])

  const selectEffect = useCallback((id: EffectId) => {
    if (!engine) return
    engine.setEffect(id)
    setActiveEffect(id)
  }, [engine])

  const selectIsf = useCallback((fx: { name: string; frag: string; params: EffectParam[]; imageInputs: string[] }) => {
    if (!engine) return
    if (engine.setCustomShader(fx.frag, fx.params, fx.imageInputs)) {
      setIsfActive(fx.name)
      setIsfError(null)
    } else {
      setIsfError(engine.getLastShaderError() || 'errore sconosciuto')
    }
  }, [engine])

  const togglePost = useCallback((id: PostId) => {
    if (!engine) return
    engine.togglePost(id)
    setActivePosts(new Set(engine.getActivePosts()))
    setPostChain(engine.getPostChain())
  }, [engine])

  const movePost = useCallback((id: PostId, delta: number) => {
    if (!engine) return
    engine.movePost(id, delta)
    setPostChain(engine.getPostChain())
  }, [engine])

  const setPostAmount = useCallback((id: PostId, amount: number) => {
    if (!engine) return
    engine.setPostAmount(id, amount)
    setPostChain(engine.getPostChain())
  }, [engine])

  const updateGrade = useCallback((patch: Partial<Grade>) => {
    if (!engine) return
    engine.setGrade(patch)
    setGradeState(engine.getGrade())
  }, [engine])

  const selectColorPreset = useCallback((idx: number) => {
    if (!engine) return
    if (idx === CUSTOM_INDEX) {
      engine.setColors(...customColors)
    } else {
      engine.setColors(...COLOR_PRESETS[idx].colors)
    }
    setActiveColorPreset(idx)
  }, [engine, customColors])

  const updateCustomColor = useCallback((index: 0 | 1 | 2, color: string) => {
    if (!engine) return
    const next: [string, string, string] = [...customColors]
    next[index] = color
    setCustomColors(next)
    if (activeColorPreset === CUSTOM_INDEX) {
      engine.setColors(...next)
    }
  }, [engine, customColors, activeColorPreset])

  const handleTransitionSpeed = useCallback((val: number) => {
    if (!engine) return
    engine.setColorTransitionSpeed(val)
    setTransitionSpeed(val)
  }, [engine])

  // Cycling handlers
  const toggleCycle = useCallback(() => {
    if (!engine) return
    const next = !cycleEnabled
    setCycleEnabled(next)
    if (next) {
      const palettes = COLOR_PRESETS
        .filter((_, i) => cycleSelection.has(i))
        .map(p => p.colors)
      if (palettes.length < 2) {
        setCycleEnabled(false)
        engine.setCycleEnabled(false)
        return
      }
      engine.setCyclePalettes(palettes)
      engine.setCycleEnabled(true)
    } else {
      engine.setCycleEnabled(false)
    }
  }, [engine, cycleEnabled, cycleSelection])

  const toggleCyclePreset = useCallback((idx: number) => {
    setCycleSelection(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      if (engine && cycleEnabled) {
        const palettes = COLOR_PRESETS
          .filter((_, i) => next.has(i))
          .map(p => p.colors)
        if (palettes.length >= 2) engine.setCyclePalettes(palettes)
      }
      return next
    })
  }, [engine, cycleEnabled])

  const handleCycleBeatSync = useCallback((val: boolean) => {
    if (!engine) return
    setCycleBeatSync(val)
    engine.setCycleBeatSync(val)
  }, [engine])

  const handleCycleInterval = useCallback((val: number) => {
    if (!engine) return
    setCycleInterval(val)
    engine.setCycleInterval(val * 1000)
  }, [engine])

  const handleCycleBeats = useCallback((val: number) => {
    if (!engine) return
    setCycleBeats(val)
    engine.setCycleBeatsPerSwitch(val)
  }, [engine])

  // Filter effects by search
  const searchLower = search.toLowerCase()

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Section tabs — always visible */}
      <div className="tab-bar">
        {[
          { id: 'fx' as Section, label: 'Effetti', count: 21 },
          { id: 'post' as Section, label: `Post FX`, count: activePosts.size },
          { id: 'color' as Section, label: 'Colori', count: null },
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab${section === tab.id ? ' active' : ''}`}
            onClick={() => setSection(tab.id)}
            title={`Mostra sezione ${tab.label}`}
          >
            {tab.label}
            {tab.count !== null && <span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div style={{ padding: 'var(--s2)' }}>
        {/* ====== EFFECTS TAB ====== */}
        {section === 'fx' && (
          <div className="u-col">
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca effetti…"
              title="Filtra gli effetti per nome"
              style={{ width: '100%', fontSize: 'var(--fs-xs)' }}
            />

            {/* Active effect indicator */}
            <div className="active-banner">
              <div className="status-dot on" />
              <span className="active-banner-label">{activeEffect}</span>
            </div>

            {/* Per-effect params + audio mapping */}
            <ParamControls engine={engine} key={activeEffect} />

            {/* Transition settings */}
            <div className="sub-card">
              <div className="cat-label">Transizione</div>
              {/* Type selector */}
              <div style={{ display: 'flex', gap: '2px', marginBottom: '4px' }}>
                {([
                  { id: 'crossfade' as TransitionType, label: 'Fade' },
                  { id: 'wipe-left' as TransitionType, label: 'Wipe←' },
                  { id: 'wipe-down' as TransitionType, label: 'Wipe↓' },
                  { id: 'radial' as TransitionType, label: 'Radial' },
                  { id: 'dissolve' as TransitionType, label: 'Noise' },
                ] as const).map(t => (
                  <button
                    key={t.id}
                    className={`pill${transitionType === t.id ? ' active' : ''}`}
                    title={`Transizione ${t.label} al cambio effetto`}
                    onClick={() => {
                      setTransitionType(t.id)
                      engine?.setTransitionType(t.id)
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {/* Duration */}
              <div className="slider-row">
                <span className="label">Tempo</span>
                <input
                  type="range" min={0} max={3} step={0.1}
                  value={transitionDuration}
                  title="Durata della transizione in secondi"
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    setTransitionDuration(v)
                    engine?.setTransitionDuration(v)
                  }}
                />
                <NumberInput
                  value={transitionDuration}
                  min={0} max={3} step={0.1}
                  suffix="s"
                  onChange={v => { setTransitionDuration(v); engine?.setTransitionDuration(v) }}
                />
              </div>
              {/* Beat sync */}
              <div
                className="u-row"
                onClick={() => {
                  const v = !transitionBeatSync
                  setTransitionBeatSync(v)
                  engine?.setTransitionBeatSync(v)
                }}
                title="La transizione parte sul prossimo beat"
                style={{ padding: '3px 0', cursor: 'pointer', marginTop: '2px' }}
              >
                <div className={`toggle${transitionBeatSync ? ' active' : ''}`} />
                <span className="u-hint" style={transitionBeatSync ? { color: 'var(--text-primary)' } : undefined}>
                  Attendi il beat
                </span>
              </div>
            </div>

            {/* Categories */}
            {EFFECT_CATEGORIES.map(cat => {
              const filtered = cat.effects.filter(fx =>
                !search || fx.label.toLowerCase().includes(searchLower) || fx.id.includes(searchLower)
              )
              if (filtered.length === 0) return null
              return (
                <div key={cat.name}>
                  <div className="cat-label">{cat.name}</div>
                  <div className="fx-grid">
                    {filtered.map(fx => {
                      const isActive = activeEffect === fx.id
                      const thumb = getThumb(fx.id)
                      return (
                        <button
                          key={fx.id}
                          onClick={() => selectEffect(fx.id)}
                          className={`fx-btn${isActive ? ' active' : ''}${thumb ? ' fx-thumb' : ''}`}
                          title={`Effetto ${fx.label}`}
                          style={thumb ? { background: thumbBackground(thumb, isActive) } : undefined}
                        >
                          <span className="fx-ico">{fx.icon}</span>
                          <span className="fx-name">{fx.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* ISF library — shaders from ~/.djtographikz/isf */}
            <div>
              <div className="cat-label">ISF</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => setIsfBrowserOpen(true)}>Sfoglia online…</button>
                <button className="btn" onClick={importIsfFiles}>Importa file…</button>
                <button
                  className="btn"
                  disabled={!isfActive}
                  onClick={smartMapIsf}
                  title="Mappa automaticamente i parametri dello shader ISF attivo su bass/mid/high/energy/LFO in base al nome"
                >
                  ⚡ Smart map
                </button>
              </div>
              {(isfEffects.length > 0 || isfFailed.length > 0) && (
              <div>
                {isfEffects.length > 0 && (
                  <div className="fx-grid">
                    {isfEffects
                      .filter(fx => !search || fx.name.toLowerCase().includes(searchLower))
                      .map(fx => {
                        const isActive = isfActive === fx.name
                        return (
                          <button
                            key={fx.name}
                            onClick={() => selectIsf(fx)}
                            title={`Shader ISF: ${fx.name}`}
                            className={`fx-btn${isActive ? ' active' : ''}`}
                          >
                            <span className="fx-ico">ƒ</span>
                            <span className="fx-name">
                              {fx.name.replace(/\.(fs|frag|glsl)$/i, '')}
                            </span>
                          </button>
                        )
                      })}
                  </div>
                )}
                {isfError && (
                  <div className="u-hint" style={{ color: 'var(--danger)', marginTop: '3px' }}>
                    Shader non valido: {isfError}
                  </div>
                )}
                {isfFailed.length > 0 && (
                  <div className="u-hint" title={isfFailed.join(', ')} style={{ marginTop: '3px' }}>
                    {isfFailed.length} shader ignorati (non-generator o rotti)
                  </div>
                )}
                {isfActive && (isfEffects.find(f => f.name === isfActive)?.imageInputs.length ?? 0) > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {isfEffects.find(f => f.name === isfActive)!.imageInputs.map(inp => (
                      <button key={inp} className="btn" style={{ marginRight: 6, marginBottom: 4 }} onClick={() => pickIsfImage(inp)}>
                        🖼 {inp}…
                      </button>
                    ))}
                  </div>
                )}
                <div className="u-hint" style={{ marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                  Cartella: ~/.djtographikz/isf
                </div>
              </div>
              )}
            </div>
            {isfBrowserOpen && (
              <IsfBrowser onClose={() => setIsfBrowserOpen(false)} onImported={onIsfImported} />
            )}
          </div>
        )}

        {/* ====== POST FX TAB ====== */}
        {section === 'post' && (
          <div className="u-col">
            {/* Active chain — order and wet/dry both change the look a lot */}
            {postChain.length > 0 && (
              <div className="active-banner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '3px' }}>
                <div className="active-banner-label">Catena (alto → basso)</div>
                {postChain.map((entry, i) => (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span className="u-hint" style={{ width: '12px' }}>{i + 1}</span>
                    <span className="u-hint" style={{
                      color: 'var(--accent)', width: '54px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {entry.id}
                    </span>
                    <input
                      type="range" min={0} max={1} step={0.05}
                      value={entry.amount}
                      onChange={e => setPostAmount(entry.id, parseFloat(e.target.value))}
                      style={{ flex: 1 }}
                      title="Wet / dry"
                    />
                    <button className="tiny-btn" title="Sposta su nella catena" onClick={() => movePost(entry.id, -1)} disabled={i === 0}>↑</button>
                    <button className="tiny-btn" title="Sposta giù nella catena" onClick={() => movePost(entry.id, 1)} disabled={i === postChain.length - 1}>↓</button>
                    <button className="tiny-btn danger" title="Disattiva effetto" onClick={() => togglePost(entry.id)}>×</button>
                  </div>
                ))}
              </div>
            )}

            {POST_CATEGORIES.map(cat => (
              <div key={cat.name}>
                <div className="cat-label">{cat.name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {cat.effects.map(fx => {
                    const isActive = activePosts.has(fx.id)
                    return (
                      <div
                        key={fx.id}
                        className={`row-item${isActive ? ' active' : ''}`}
                        onClick={() => togglePost(fx.id)}
                        title={`${isActive ? 'Disattiva' : 'Attiva'} ${fx.label}`}
                      >
                        <span style={{ fontSize: '13px', lineHeight: 1, flexShrink: 0, opacity: isActive ? 1 : 0.4 }}>
                          {fx.icon}
                        </span>
                        <div className={`toggle${isActive ? ' active' : ''}`} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="row-title">{fx.label}</div>
                          <div className="row-sub">{fx.desc}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ====== COLORS TAB ====== */}
        {section === 'color' && (
          <div className="u-col" style={{ gap: '10px' }}>
            {/* Palette grid */}
            <div>
              <div className="cat-label">Palette</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
                {COLOR_PRESETS.map((preset, i) => {
                  const isActive = activeColorPreset === i
                  return (
                    <button
                      key={preset.label}
                      className={`pal-btn${isActive ? ' active' : ''}`}
                      onClick={() => selectColorPreset(i)}
                      title={`Palette ${preset.label}`}
                    >
                      <div style={{ display: 'flex', gap: '1px' }}>
                        {preset.colors.map((c, j) => (
                          <div key={j} style={{
                            width: '12px', height: '12px', borderRadius: '2px',
                            background: c,
                          }} />
                        ))}
                      </div>
                      <span className="pal-name">{preset.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom palette */}
            <div>
              <button
                className={`pill${activeColorPreset === CUSTOM_INDEX ? ' active' : ''}`}
                onClick={() => selectColorPreset(CUSTOM_INDEX)}
                title="Palette personalizzata: scegli i tre colori"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <div style={{ display: 'flex', gap: '2px' }}>
                  {customColors.map((c, j) => (
                    <div key={j} style={{ width: '12px', height: '12px', borderRadius: '2px', background: c }} />
                  ))}
                </div>
                Custom
              </button>
              {activeColorPreset === CUSTOM_INDEX && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  {(['C1', 'C2', 'C3'] as const).map((label, i) => (
                    <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <input
                        type="color"
                        value={customColors[i]}
                        title={`Colore ${i + 1} della palette custom`}
                        onChange={e => updateCustomColor(i as 0 | 1 | 2, e.target.value)}
                      />
                      <span className="u-hint">{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transition speed */}
            <div className="slider-row">
              <span className="label">Trans.</span>
              <input
                type="range" min={0} max={1} step={0.05}
                value={transitionSpeed}
                title="Velocità della transizione colore"
                onChange={e => handleTransitionSpeed(parseFloat(e.target.value))}
              />
              <NumberInput
                value={transitionSpeed}
                min={0} max={1} step={0.05}
                onChange={handleTransitionSpeed}
              />
            </div>

            {/* Master colour grade — the pass that makes it look graded, not raw */}
            <div>
              <div className="cat-label">Grade</div>
              {([
                { key: 'exposure' as const, label: 'Expos', min: 0.2, max: 2, step: 0.05 },
                { key: 'contrast' as const, label: 'Contr', min: 0.5, max: 2, step: 0.05 },
                { key: 'saturation' as const, label: 'Satur', min: 0, max: 2, step: 0.05 },
                { key: 'lift' as const, label: 'Lift', min: 0, max: 0.3, step: 0.01 },
                { key: 'vignette' as const, label: 'Vign', min: 0, max: 1.5, step: 0.05 },
              ]).map(g => (
                <div className="slider-row" key={g.key}>
                  <span className="label">{g.label}</span>
                  <input
                    type="range" min={g.min} max={g.max} step={g.step}
                    value={grade[g.key]}
                    onChange={e => updateGrade({ [g.key]: parseFloat(e.target.value) })}
                  />
                  <NumberInput
                    value={grade[g.key]}
                    min={g.min} max={g.max} step={g.step}
                    onChange={v => updateGrade({ [g.key]: v })}
                  />
                </div>
              ))}
            </div>

            {/* Palette Cycling */}
            <div>
              <div className="cat-label">Ciclo palette</div>
              <div
                className="u-row"
                onClick={toggleCycle}
                title="Cambia palette automaticamente a tempo o a beat"
                style={{
                  padding: '4px 6px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  background: cycleEnabled ? 'var(--accent-glow)' : 'transparent',
                  marginBottom: '4px',
                }}
              >
                <div className={`toggle${cycleEnabled ? ' active' : ''}`} />
                <span className="u-hint" style={cycleEnabled ? { color: 'var(--text-primary)' } : undefined}>
                  {cycleEnabled ? 'Attivo' : 'Attiva'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                <button className={`pill${!cycleBeatSync ? ' active' : ''}`} title="Cambio palette a intervalli di tempo" onClick={() => handleCycleBeatSync(false)}>Timer</button>
                <button className={`pill${cycleBeatSync ? ' active' : ''}`} title="Cambio palette sincronizzato ai beat" onClick={() => handleCycleBeatSync(true)}>Beat</button>
              </div>

              <div className="slider-row" style={{ marginBottom: '4px' }}>
                <span className="label">{cycleBeatSync ? 'Beat' : 'Intrvl'}</span>
                <input
                  type="range"
                  min={cycleBeatSync ? 1 : 2}
                  max={cycleBeatSync ? 64 : 30}
                  step={1}
                  value={cycleBeatSync ? cycleBeats : cycleInterval}
                  onChange={e => cycleBeatSync
                    ? handleCycleBeats(parseInt(e.target.value))
                    : handleCycleInterval(parseInt(e.target.value))
                  }
                />
                <NumberInput
                  value={cycleBeatSync ? cycleBeats : cycleInterval}
                  min={cycleBeatSync ? 1 : 2}
                  max={cycleBeatSync ? 64 : 30}
                  step={1}
                  suffix={cycleBeatSync ? '' : 's'}
                  onChange={v => cycleBeatSync ? handleCycleBeats(v) : handleCycleInterval(v)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px' }}>
                {COLOR_PRESETS.map((preset, i) => (
                  <button
                    key={preset.label}
                    className={`pal-btn${cycleSelection.has(i) ? ' active' : ''}`}
                    onClick={() => toggleCyclePreset(i)}
                    title={`${cycleSelection.has(i) ? 'Escludi' : 'Includi'} ${preset.label} nel ciclo`}
                    style={{ padding: '2px', flexDirection: 'row', opacity: cycleSelection.has(i) ? 1 : 0.4, gap: '1px' }}
                  >
                    {preset.colors.map((c, j) => (
                      <div key={j} style={{ width: '8px', height: '8px', borderRadius: '1px', background: c }} />
                    ))}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
