import React, { useState, useCallback } from 'react'
import type { Engine, EffectId, BlendMode } from '@engine/Engine'
import { BLEND_MODES } from '@engine/Engine'
import { type VideoDeck, VIDEO_DECK_DEFAULT, BARS_PER_CLIP_CHOICES, acceptsVideo } from '@engine/videoDeck'
import { NumberInput } from '../NumberInput/NumberInput'
import { ALL_EFFECTS } from '../../catalog'

const MASK_FIRST = BLEND_MODES.indexOf('split-v')
const MASK_LABELS: Partial<Record<BlendMode, string>> = {
  'split-v': 'split verticale', 'split-h': 'split orizzontale', radial: 'radiale', luma: 'luma-key', audio: 'audio (basso/beat)',
}

interface DeckPanelProps {
  engine: Engine | null
}

export function DeckPanel({ engine }: DeckPanelProps) {
  const [deckB, setDeckB] = useState<EffectId>('plasma')
  const [crossfade, setCrossfade] = useState(0)
  const [blend, setBlend] = useState<BlendMode>('mix')
  const [maskSoft, setMaskSoft] = useState(0.25)
  const [motionBlur, setMotionBlur] = useState(0)
  const [video, setVideo] = useState<VideoDeck>(VIDEO_DECK_DEFAULT)

  // Sync from engine on mount (boot restore may not emit), then subscribe:
  // state changes come from ANY surface (phone remote, AutoVJ, hotkeys, presets)
  React.useEffect(() => {
    if (!engine) return
    setDeckB(engine.getDeckBEffect())
    setCrossfade(engine.getCrossfade())
    setBlend(engine.getBlendMode())
    setMaskSoft(engine.getMaskSoft())
    setMotionBlur(engine.getMotionBlur())
    setVideo(engine.getVideoDeck())
    return engine.onState(state => {
      if (state.deckBEffect) setDeckB(state.deckBEffect)
      if (state.crossfade !== undefined) setCrossfade(state.crossfade)
      if (state.blendMode) setBlend(state.blendMode)
      if (state.maskSoft !== undefined) setMaskSoft(state.maskSoft)
      if (state.motionBlur !== undefined) setMotionBlur(state.motionBlur)
      if (state.videoDeck) setVideo(state.videoDeck)
    })
  }, [engine])

  const isMask = BLEND_MODES.indexOf(blend) >= MASK_FIRST

  const changeDeckB = useCallback((id: EffectId) => {
    setDeckB(id)
    engine?.setDeckBEffect(id)
  }, [engine])

  const changeCrossfade = useCallback((v: number) => {
    setCrossfade(v)
    engine?.setCrossfade(v)
  }, [engine])

  const addClips = useCallback(async () => {
    const files = await window.api?.pickVideos()
    // the dialog also lists mkv: Chromium's <video> does not play it, nor HAP/ProRes (see videoDeck.ts)
    const ok = (files || []).filter(f => acceptsVideo(f.name))
    if (ok.length) engine?.addVideoClips(ok)
  }, [engine])

  const setClipBpm = (i: number, bpm: number) => {
    const clips = video.clips.map((c, j) => j === i ? { ...c, bpm } : c)
    engine?.setVideoDeck({ clips })
  }
  const removeClip = (i: number) => engine?.setVideoDeck({ clips: video.clips.filter((_, j) => j !== i) })

  return (
    <>
      {video.enabled && (
        <div className="deck-clips" title="Playlist del deck B: mp4 (H.264) o webm — HAP e ProRes vanno convertiti prima">
          <span className="deck-label">CLIP</span>
          {video.clips.length === 0 && <span style={{ color: 'var(--text-muted)' }}>nessuna clip — ＋ per aggiungere mp4/webm</span>}
          {video.clips.map((c, i) => (
            <span key={c.path + i} className={`deck-clip${i === video.clip ? ' active' : ''}`} title={c.path}>
              <span onClick={() => engine?.setVideoDeck({ clip: i })} style={{ cursor: 'pointer' }}>{c.name}</span>
              <NumberInput value={c.bpm} min={40} max={300} step={1} suffix="bpm" onChange={v => setClipBpm(i, v)} />
              <button className="btn btn-sm" title="Togli la clip" onClick={() => removeClip(i)}>✕</button>
            </span>
          ))}
          <button className="btn btn-sm" title="Aggiungi clip (mp4 H.264 / webm)" onClick={addClips}>＋</button>
          <span className="deck-label" title="Ogni quante battute cambia clip (sul giro di battuta)">OGNI</span>
          <select
            value={video.barsPerClip}
            onChange={e => engine?.setVideoDeck({ barsPerClip: parseInt(e.target.value, 10) })}
            title="Battute per clip"
          >
            {BARS_PER_CLIP_CHOICES.map(n => <option key={n} value={n}>{n} {n === 1 ? 'battuta' : 'battute'}</option>)}
          </select>
        </div>
      )}
      <div className="deck-bar">
        <span className="deck-label">A</span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={crossfade}
          onChange={e => changeCrossfade(parseFloat(e.target.value))}
          style={{ flex: 1 }}
          title="Crossfader tra deck A e deck B"
        />
        <span className="deck-label">B</span>

        <button className={`pill${video.enabled ? '' : ' active'}`} title="Deck B = effetto GLSL" onClick={() => engine?.setVideoDeck({ enabled: false })}>Effetto</button>
        <button className={`pill${video.enabled ? ' active' : ''}`} title="Deck B = playlist di clip video a tempo" onClick={() => engine?.setVideoDeck({ enabled: true })}>Video</button>

        {!video.enabled && (
          <select value={deckB} onChange={e => changeDeckB(e.target.value as EffectId)} title="Effetto sul deck B">
            {ALL_EFFECTS.map(fx => <option key={fx.id} value={fx.id}>{fx.label}</option>)}
          </select>
        )}

        <select
          value={blend}
          onChange={e => {
            setBlend(e.target.value as BlendMode)
            engine?.setBlendMode(e.target.value as BlendMode)
          }}
          title="Blend o maschera tra i due deck: con una maschera il crossfader è la posizione del bordo"
        >
          <optgroup label="Blend">
            {BLEND_MODES.slice(0, MASK_FIRST).map(m => <option key={m} value={m}>{m}</option>)}
          </optgroup>
          <optgroup label="Maschera">
            {BLEND_MODES.slice(MASK_FIRST).map(m => <option key={m} value={m}>{MASK_LABELS[m] ?? m}</option>)}
          </optgroup>
        </select>
        {isMask && <>
          <span className="deck-label" title="Morbidezza del bordo della maschera">SOFT</span>
          <input
            type="range" min={0} max={1} step={0.01}
            value={maskSoft}
            title="Morbidezza del bordo (0 netto, 1 sfumato)"
            onChange={e => { const v = parseFloat(e.target.value); setMaskSoft(v); engine?.setMaskSoft(v) }}
            style={{ width: '70px' }}
          />
        </>}

        <span className="deck-label" title="Motion blur temporale">BLUR</span>
        <input
          type="range" min={0} max={0.95} step={0.05}
          value={motionBlur}
          title="Intensità del motion blur"
          onChange={e => {
            const v = parseFloat(e.target.value)
            setMotionBlur(v)
            engine?.setMotionBlur(v)
          }}
          style={{ width: '70px' }}
        />
        <NumberInput
          value={motionBlur}
          min={0} max={0.95} step={0.05}
          onChange={v => { setMotionBlur(v); engine?.setMotionBlur(v) }}
        />
      </div>
    </>
  )
}
