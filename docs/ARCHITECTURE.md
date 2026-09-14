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
| `uSub` | float | Sub energy 0–1 (20–60 Hz) |
| `uBass` | float | Bass energy 0–1 |
| `uMid` | float | Mid energy 0–1 |
| `uHigh` | float | High energy 0–1 |
| `uPresence` | float | Presence energy 0–1 (8–20 kHz) |
| `uEnergy` | float | Overall energy 0–1 |
| `uBeat` | float | Beat pulse 0–1 (decays after each beat) |
| `uBassHit` / `uMidHit` / `uHighHit` | float | Per-band onset pulse 0–1 |
| `uBeatPhase` | float | 0–1 position inside the current beat |
| `uBarPhase` | float | 0–1 position inside the current 4-beat bar |
| `uBeatClock` | float | Continuous beat counter — the clock to use for anything tempo-locked |
| `uBassTime` / `uHighTime` | float | Gated clocks: advance only while that band plays |
| `uSpectrum` | sampler2D | 512×1 audio texture, see below |
| `uFrame` | float | Frames since this effect instance started — 0 on the first |
| `uColor1` | vec3 | Primary palette color |
| `uColor2` | vec3 | Secondary palette color |
| `uColor3` | vec3 | Tertiary palette color |
| `uResolution` | vec2 | Viewport resolution |

### `uSpectrum`

One row, 512 texels, linear filtering. Sample it as
`texture2D(uSpectrum, vec2(u, 0.5))`:

- `.r` — magnitude 0–1. **u is logarithmic**: `u = 0` is 20 Hz, `u = 1` is
  20 kHz. Linear bins would spend nine tenths of the width on frequencies no
  track uses and squash the whole bass into the first few texels, so the pack
  step maps them by octave and takes the max of each range (a narrow peak
  survives instead of being averaged away).
- `.g` — time-domain sample, **centred on 0.5**, i.e. the oscilloscope trace.

The raw bins are noisier than they look on a plot: smooth over several taps
before using them as geometry, or the result buzzes. The texture is packed once
in the control window and the packed bytes ride the audio IPC message, so the
projector draws from exactly the same data.

### Multi-pass effects

An effect is normally one fullscreen fragment pass. A multi-pass effect
(`MultiPassEffect` in `Engine.ts`) adds simulation passes that run first, each
writing into its own **persistent ping-pong buffer**, so a shader can read what
it wrote last frame. That is what reaction-diffusion, fluids and any other
cellular simulation need, and what a single pass structurally cannot do.

```ts
reaction: {
  passes: Array.from({ length: 8 }, () => ({ frag: simFrag, buffer: 'A', rows: 360 })),
  main: reactionFrag,
}
```

- `main` is the visible pass and behaves exactly like a single-pass effect —
  transitions, deck B and params all work unchanged.
- Every pass, `main` included, gets `tBuffer<name>` (sampler2D) and
  `uBuffer<name>Size` (vec2) for each buffer, plus `uFrame` (float, 0 on the
  first frame of that effect instance — use it to seed).
- A buffer is swapped immediately after the pass that writes it, so listing the
  same pass N times runs N real iterations. Gray-Scott at one step per frame
  crawls; the effect above runs eight.
- Buffers are **half-float**: a simulation feeding itself through 8-bit targets
  quantises a little every frame and the error compounds until the pattern dies.
- Size a simulation buffer with `rows` (fixed height in texels, width follows
  the output aspect), not `scale`: the feature size of a reaction-diffusion
  pattern is set by the grid, so a fraction of the screen makes the same effect
  look different on a bigger projector.
- Each effect *material* owns its buffers (`Engine.chains`), so the outgoing
  effect keeps simulating through a transition and deck B runs its own copy.
  Disposal goes through `disposeEffectMaterial()`.

### Multi-pass custom shaders, ISF and Shadertoy

A shader written in the editor or imported can be multi-pass too. The passes are
separated **inside the source**, by marker lines, so a custom shader stays one
string — presets, the IPC snapshot to the projector and the editor all keep
working unchanged:

```glsl
// anything up here is shared by every pass
//!DJG_BUFFER A
void main() { /* writes buffer A, reads last frame's via tBufferA */ }
//!DJG_MAIN
void main() { /* the visible pass */ }
```

`splitCustomPasses()` (`src/engine/customPasses.ts`) does the splitting; buffers
are full render size. If the author declares only buffers, a blit of the last
one is appended so something reaches the screen.

- **ISF**: a shader with more than one `PASSES` entry now imports. The body is
  emitted once per pass with its own `PASSINDEX` — which is how ISF itself
  branches — and each `TARGET` is aliased onto the engine's `tBuffer<name>`.
  Filters (`inputImage`) and audio inputs are still refused, with a reason.
- **Shadertoy**: `loadShadertoy()` takes either raw GLSL with `mainImage` (one
  pass, what a copy-paste gives you) or the JSON the Shadertoy API returns,
  which is the only way to get Buffer A–D. Buffers map to engine buffers in
  order, `iChannelN` is wired to whatever that pass reads, and a texture channel
  becomes an image input the VJ picks a picture for. `iResolution` and `iMouse`
  are `#define`s: GLSL ES forbids initialising a global from a uniform.

`yarn check:loaders` runs both importers and the splitter over small inputs and
asserts on the GLSL that comes out. `python3 scripts/check-output.py
scripts/fixtures/trail.multipass.frag` proves a multi-pass custom shader on the
real projector — the fixture is a decaying trail, so a buffer that is not
actually persistent shows a single dot and fails the gate.

### Geometry effects

An effect can draw real geometry instead of a fullscreen quad: point clouds,
instanced meshes, loaded models. It declares a `build(uniforms)` that returns
the material carrying the effect uniforms — so audio, palette, params and
transitions keep working — plus the object to draw.

```ts
swarm: {
  passes: [{ frag: swarmSimFrag, buffer: 'P', rows: 128, cols: 128 }],
  build: (u) => buildPointCloud(u, 128, swarmVert, swarmFrag),
}
```

Everything that renders an effect goes through `renderEffect()`: it runs the
simulation passes, then either draws the quad or the effect's own scene. A
geometry effect's target is cleared first — geometry leaves gaps where a
fullscreen quad would have overwritten every pixel.

`buildPointCloud` is the first user: a grid of points whose positions live in a
simulation buffer, read by the **vertex** shader, so the particle count costs
nothing on the CPU and nothing per frame beyond one texture fetch per vertex.
Frustum culling is off and the bounding sphere is huge on purpose — three would
otherwise cull the whole cloud, because the attribute data says nothing about
where the vertices actually end up.

Two things learned building it, both visible only on the projector:
- Advection, not acceleration. A force model with an inward pull and per-frame
  damping collapses the swarm onto the origin in about a second.
- Density is the look. 65k sprites at 1080p is even dust; 16k with bigger dots
  reads as a swarm. `scripts/shader-preview.py` takes `DJG_W`/`DJG_H` so this
  can be judged at the projector's real resolution instead of guessed.

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
