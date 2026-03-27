# DJtoGraphikz

Real-time audio-reactive visual generator for tekno club nights. Projects animated graphics onto a second screen or projector, driven by live audio input from a DJ mixer or any audio source.

## Features

### Visual Engine
- **21 visual effects** organized in 4 categories:
  - **Geometric**: Tunnel, Kaleidoscope, Voronoi, Sacred Geometry, Mandala, Hexagons, Rings
  - **Organic**: Fluid, Plasma, Domain Warp, Metaballs, Fire, Fractal
  - **Motion**: Particles, Starfield, Waves, Lissajous, DNA Helix
  - **Digital**: Matrix Rain, Cyber Grid, Glitch
- **9 post-processing effects** (combinable):
  - **Glow & Color**: Bloom, Chromatic Aberration, RGB Split, Invert
  - **Distortion**: Feedback Trail, Mirror, Pixelate
  - **Film & Texture**: Film Grain, Scanlines
- **16 color palettes**: Acid, Fire, Ice, Toxic, Neon, Blood, Vapor, Mono, Sunset, Ocean, Forest, Cyber, Gold, Pastel, Lava, Aurora + custom palette editor
- **Smooth color transitions** with configurable speed
- **Palette cycling** with timer or beat-sync modes

### Audio System
- **Audio-reactive** — all visuals respond to bass, mid, high, energy and beat in real time
- **BPM detection** — automatic via [realtime-bpm-analyzer](https://github.com/dlepaux/realtime-bpm-analyzer), manual input, and tap tempo
- **Beat detection** — spectral flux algorithm with adaptive threshold
- **Input gain** — amplify weak signals (e.g. laptop microphone)
- **Configurable sensitivity** — works with line-in and microphone

### Overlay System
- **Image/GIF overlay** — PNG, JPG, SVG, WebP, or animated GIF
- **Per-overlay controls** — opacity, scale, position X/Y
- **GIF beat sync** — advance frames synced to Beat, BPM, or free-running

### Preset & Playlist System
- **Save presets** — capture current effect + post-FX + colors as a named preset
- **Playlist builder** — create ordered playlists from saved presets
- **Auto-advance** — timer-based (2-60s) or beat-synced (1-64 beats)
- **Loop mode** — continuous playlist cycling
- **Export/Import** — save presets and playlists as JSON files
- **Persistent storage** — presets and playlists saved in localStorage

### Output
- **Dual-window system** — control panel with preview + fullscreen output
- **Configurable output resolution** — 720p, 1080p, 1440p, 4K
- **Instant fullscreen** — simpleFullScreen on macOS for zero-delay switching
- **Multi-monitor** — automatically detects external displays
- **Background throttling disabled** — audio and rendering continue when focus is on the output window
- **Offline** — no internet required

## Quick Start

### Requirements

- [Node.js](https://nodejs.org/) 18+
- [Yarn](https://yarnpkg.com/) 1.x

### Development

```bash
git clone https://github.com/Maximilione/DJtoGraphikz.git
cd DJtoGraphikz
yarn install
yarn dev
```

### Build & Package

```bash
yarn build
```

Package as a standalone installer (no Node.js required on the target machine):

```bash
# macOS (.dmg)
yarn package:mac

# Windows (.exe installer) — run from Windows
yarn package:win

# Linux (.AppImage)
yarn package:linux
```

Output goes to the `dist/` folder.

> **Windows note:** run PowerShell as Administrator, or enable Developer Mode (Settings > For developers) to avoid symlink permission errors during packaging.

## Usage

### Audio Input

1. Click **Start Audio** in the Audio Input panel
2. Select your audio device (line-in from mixer, microphone, virtual audio cable, etc.)
3. Adjust **Input Gain** if the signal is weak (e.g. laptop mic)
4. Adjust **Beat Sensitivity** — slide towards High for quieter signals

### BPM Modes

| Mode | Description |
|------|-------------|
| **Auto** | Detects BPM from the audio signal. Press Reset when the track changes. |
| **Tap** | Press the TAP button in rhythm to set BPM manually. |
| **Manual** | Type the exact BPM value or use +/- buttons. |

### Visual Effects

The Effects panel has 3 tabs:
- **Effects** — select one main effect from categorized grid with search filter
- **Post FX** — toggle any combination of post-processing effects
- **Colors** — choose a palette, create custom colors, configure transitions and auto-cycling

### Presets & Playlists

1. Configure your desired effect + post-FX + colors
2. In the **Presets & Playlist** panel, enter a name and click **Save**
3. Click **+** on any preset to add it to the playlist builder
4. Reorder with arrows, set advance mode (Timer/Beat), save the playlist
5. Click play on any saved playlist to start auto-advancing
6. Use **Export/Import** to share presets and playlists as JSON

### Image Overlay

1. Click **Import Image / GIF** in the Overlay panel
2. Adjust opacity, scale, and position with sliders
3. For animated GIFs, choose sync mode: Beat, BPM, or Free

### Output Window

- Automatically goes fullscreen on secondary monitor
- Click **Fullscreen** in the top bar to toggle
- Select output resolution from the dropdown (720p to 4K)
- The render targets resize dynamically with fullscreen toggle

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop runtime | Electron 33 |
| Language | TypeScript |
| Rendering | Three.js + GLSL shaders (WebGL2) |
| Audio analysis | Web Audio API + realtime-bpm-analyzer |
| UI | React 18 |
| Build | Vite + electron-vite |
| Packaging | electron-builder |

## Project Structure

```
DJtoGraphikz/
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.ts           # Window creation, IPC, permissions
│   │   └── ipc-handlers.ts    # File I/O for templates and assets
│   ├── preload/
│   │   └── index.ts           # Context bridge API
│   ├── renderer/              # Control window (React)
│   │   ├── App.tsx            # 3-column layout, FPS counter, resolution
│   │   ├── main.tsx           # React mount
│   │   ├── output-main.ts     # Output window renderer (standalone)
│   │   ├── components/
│   │   │   ├── AudioPanel/    # Audio device, gain, sensitivity, BPM
│   │   │   ├── EffectPanel/   # Effects (3 tabs: FX, Post, Colors)
│   │   │   ├── OverlayPanel/  # Image/GIF overlay management
│   │   │   ├── PresetPanel/   # Presets save/load + playlist builder
│   │   │   └── OutputPreview/ # Canvas preview
│   │   └── styles/
│   │       └── global.css     # Dark theme with CSS variables
│   └── engine/
│       ├── Engine.ts          # Render loop, effects, post-FX, presets
│       ├── GifDecoder.ts      # GIF frame extraction via gifuct-js
│       ├── audio/
│       │   └── AudioAnalyzer.ts  # FFT, bands, spectral flux, BPM
│       └── shaders/
│           ├── # 21 main effect shaders (.frag)
│           ├── # 9 post-processing shaders (.frag)
│           ├── overlay.frag   # Overlay compositing
│           └── noise.glsl     # Shared simplex noise
├── build/
│   └── entitlements.mac.plist # macOS microphone/JIT permissions
├── package.json
├── electron.vite.config.ts
└── tsconfig.json
```

## Architecture

### Dual Window

The **control window** (left sidebar + center preview + right sidebar) runs a React app. The **output window** runs a standalone Three.js renderer at full resolution with no UI.

Communication flows through Electron IPC: the control window sends engine state, audio data, overlay commands, and resolution changes to the output window via the main process bridge.

Both windows have `backgroundThrottling: false` so audio and rendering continue regardless of which window has focus.

### UI Layout

```
┌─────────────────────────────────────────────────────┐
│  DJtoGraphikz          [720p|1080p|1440p|4K] [Full] │
├──────────┬──────────────────────┬───────────────────┤
│ AUDIO    │                      │ OVERLAYS          │
│ INPUT    │                      │                   │
│          │      PREVIEW         │                   │
│ EFFECTS  │      (16:9)          │ PRESETS &         │
│ [FX]     │                      │ PLAYLIST          │
│ [Post]   │                      │                   │
│ [Colors] │                      │                   │
├──────────┴──────────────────────┴───────────────────┤
│ 60 FPS │ 1920x1080                                  │
└─────────────────────────────────────────────────────┘
```

### Render Pipeline

```
Audio Input → AudioAnalyzer (FFT, bands, beat, BPM)
                    ↓
          Main Effect Shader (fullscreen quad)
                    ↓
          Overlay Compositing (per overlay)
                    ↓
          Post-Processing Chain (ping-pong RT)
                    ↓
          Screen Output
```

All shaders receive audio uniforms (`uBass`, `uMid`, `uHigh`, `uEnergy`, `uBeat`) updated every frame.

### Beat Detection

Uses **spectral flux** — the sum of positive frequency-bin changes frame-to-frame, weighted towards lower frequencies but including all bands. Works with both high-quality line-in signals and weak laptop microphones.

The threshold is adaptive: `mean + stddev * sensitivity` over a rolling window, with a time-based cooldown informed by the current BPM.

### BPM Detection

Powered by [realtime-bpm-analyzer](https://github.com/dlepaux/realtime-bpm-analyzer), running in an AudioWorklet (off main thread). Analyzes peaks at multiple threshold levels and reports candidates with confidence scores.

## Roadmap

- [ ] Transitions between effects (crossfade, wipe, dissolve, beat-synced)
- [ ] Keyboard shortcuts for live performance
- [ ] Per-effect parameter sliders with audio mapping
- [ ] MIDI controller support with learn mode
- [ ] Text overlay with animations
- [ ] LFO automation for parameters
- [ ] A/B deck mixing with crossfader
- [ ] Video clip playback
- [ ] Webcam/camera input as texture
- [ ] Ableton Link sync
- [ ] Syphon/Spout video output
- [ ] App icon

## License

MIT
