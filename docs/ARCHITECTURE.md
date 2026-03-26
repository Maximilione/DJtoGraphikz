# DJtoGraphikz — Architecture

## Overview

DJtoGraphikz is an Electron desktop app that generates real-time audio-reactive visuals. It uses a dual-window architecture: one window for the operator's control panel (React) and one for fullscreen visual output (Three.js).

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                   ELECTRON MAIN PROCESS              │
│                                                     │
│  ┌─────────────┐    IPC Bridge    ┌──────────────┐  │
│  │   Control    │◄───────────────►│    Output     │  │
│  │   Window     │                 │    Window     │  │
│  │  (React UI)  │  state/audio/   │  (Three.js)   │  │
│  │             │  overlay sync   │  fullscreen   │  │
│  └─────────────┘                 └──────────────┘  │
│                                                     │
│  Permissions: microphone, media                     │
│  File I/O: templates, assets                        │
└─────────────────────────────────────────────────────┘
```

## Audio Pipeline

```
Mic / Line-In
    │
    ▼
getUserMedia (MediaStream)
    │
    ▼
MediaStreamSource
    │
    ├──► GainNode (input amplification)
    │        │
    │        ├──► AnalyserNode (FFT)
    │        │       │
    │        │       ├── getByteFrequencyData() → 7 frequency bands
    │        │       ├── Spectral flux → beat detection
    │        │       └── Energy computation
    │        │
    │        └──► AudioWorkletNode (realtime-bpm-analyzer)
    │                │
    │                ├── 'bpm' event → candidate BPM
    │                └── 'bpmStable' event → confirmed BPM
    │
    └──► (no output to speakers — analysis only)
```

### Frequency Bands

| Band | Range | Use |
|------|-------|-----|
| Sub | 20–60 Hz | Deep bass, sub-bass |
| Bass | 60–250 Hz | Kick drum, bass line |
| Low Mid | 250–500 Hz | Lower harmonics |
| Mid | 500–2000 Hz | Vocals, synths |
| High Mid | 2000–4000 Hz | Presence |
| High | 4000–8000 Hz | Hi-hats, cymbals |
| Presence | 8000–20000 Hz | Air, brilliance |

### Beat Detection Algorithm

**Spectral Flux** measures the frame-to-frame increase in spectral energy:

```
flux = Σ max(0, current[i] - previous[i]) * weight[i]
```

Weights: low bins 3x, low-mid 2x, mid 1x, high 0.5x. This ensures kick drums dominate detection while still working on laptop mics where bass is attenuated.

**Adaptive threshold**: `mean(flux_history) + stddev(flux_history) * sensitivity`

**Cooldown**: time-based, 55% of beat interval at current BPM. Prevents double-triggers while allowing slightly early beats.

### BPM Detection

Delegated to `realtime-bpm-analyzer` v5, which:
1. Runs in an AudioWorklet (off main thread)
2. Applies a low-pass biquad filter to isolate rhythm
3. Detects peaks at multiple threshold levels (0.95 down to 0.2)
4. Builds candidate BPM list with confidence scores
5. Emits `bpm` events continuously and `bpmStable` when confident

Three BPM modes are available:
- **Auto**: uses the library's output, falls back to manual value
- **Tap**: calculates BPM from user tap intervals (rolling 4-second window)
- **Manual**: direct numeric input

## Render Pipeline

### Control Window

```
Engine.start()
    │
    ▼
requestAnimationFrame loop
    │
    ├── AudioAnalyzer.update() → audio uniforms
    │
    ├── Render main effect → rtA
    │       ShaderMaterial with uTime, uBass, uMid, uHigh, uEnergy, uBeat, uColor1-3
    │
    ├── Overlay compositing (per visible overlay)
    │       For each overlay: render overlay shader rtA→rtB or rtB→rtA (ping-pong)
    │       GIF frames advanced based on sync mode (beat/bpm/free)
    │       Copy result back to rtA if needed
    │
    ├── Post-processing chain (ping-pong rtA↔rtB)
    │       Each active post shader reads from read RT, writes to write RT
    │       Last shader writes directly to screen (null render target)
    │
    ├── Feedback: copy current frame to rtPrev for next frame's feedback shader
    │
    └── IPC: send audio data + engine state to output window
```

### Output Window

Mirrors the control window's render pipeline but:
- Receives audio data via IPC instead of running its own AudioAnalyzer
- Receives effect/post/color state changes via IPC
- Receives overlay add/remove/update commands via IPC
- Runs at full output resolution (typically 1920x1080)
- No UI elements, cursor hidden

### Render Targets

| Target | Purpose |
|--------|---------|
| `rtA` | Primary render target, main effect output |
| `rtB` | Secondary target for ping-pong post-processing |
| `rtPrev` | Previous frame storage for feedback effect |

## Shader Uniforms

All effect shaders receive these uniforms:

| Uniform | Type | Description |
|---------|------|-------------|
| `uTime` | float | Elapsed time in seconds |
| `uBass` | float | Bass energy 0–1 |
| `uMid` | float | Mid energy 0–1 |
| `uHigh` | float | High energy 0–1 |
| `uEnergy` | float | Overall energy 0–1 |
| `uBeat` | float | Beat pulse 0–1 (decays after each beat) |
| `uColor1` | vec3 | Primary palette color |
| `uColor2` | vec3 | Secondary palette color |
| `uColor3` | vec3 | Tertiary palette color |
| `uResolution` | vec2 | Viewport resolution |

Post-processing shaders receive `tDiffuse` (input texture) plus relevant audio uniforms.

## IPC Communication

### Control → Main → Output

| Channel | Direction | Data |
|---------|-----------|------|
| `engine:state-update` | control → output | `{ activeEffect, activePost, colors, beatPulse, energy, bpm }` |
| `audio:data` | control → output | `{ bass, mid, high, energy, beatPulse, bpm, beatDetected }` |
| `overlay:add` | control → output | `{ id, name, dataUrl, opacity, scale, offsetX, offsetY, visible }` |
| `overlay:remove` | control → output | overlay id |
| `overlay:update` | control → output | `{ id, ...updates }` |
| `output:toggle-fullscreen` | control → output | — |
| `output:move-to-display` | control → output | display id |

### Invoke (request/response)

| Channel | Description |
|---------|-------------|
| `displays:list` | Returns available displays |
| `template:save/load/list/delete` | Template persistence |
| `asset:import` | Opens file dialog, returns base64 data URLs |

## GIF Overlay System

1. User imports a file via the file dialog (`asset:import`)
2. Main process reads the file, returns a base64 data URL
3. Control window's Engine creates an overlay:
   - Static images: drawn to canvas, wrapped in `CanvasTexture`
   - GIFs: decoded frame-by-frame via `gifuct-js`, frames stored as `ImageData[]`
4. Each render frame, GIF overlays check their sync mode:
   - **Beat**: advance on `beatDetected`
   - **BPM**: advance when `60000/bpm` ms have elapsed
   - **Free**: advance using original GIF frame delay
5. Current frame is drawn to canvas, texture marked `needsUpdate`
6. Overlay shader composites the texture onto the main effect using alpha blending

## File Structure Conventions

- `src/main/` — Electron main process (Node.js)
- `src/preload/` — Context bridge (exposes safe API to renderer)
- `src/renderer/` — React app (control window) + output window entry
- `src/engine/` — Shared rendering engine (imported by both windows)
- `src/engine/shaders/` — GLSL fragment shaders (imported as raw strings via Vite `?raw`)

## Build System

- **electron-vite**: Vite-based build for main, preload, and renderer
- **Three separate Vite builds**: main (SSR/Node), preload (SSR/Node), renderer (client)
- **Renderer has two entry points**: `index.html` (control) and `output.html` (output)
- **Path aliases**: `@engine` → `src/engine/`, `@renderer` → `src/renderer/`
- **electron-builder**: packages the built output into platform installers
