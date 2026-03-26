# DJtoGraphikz

Real-time audio-reactive visual generator for tekno club nights. Projects animated 1920x1080 graphics onto a second screen or projector, driven by live audio input from a DJ mixer or any audio source.

## Features

- **Dual-window system** — control panel with preview + fullscreen output on a second monitor/projector
- **6 visual effects** — Tunnel, Kaleidoscope, Domain Warp, Plasma, Matrix Rain, Voronoi Cells
- **4 post-processing effects** — Bloom, RGB Split, Chromatic Aberration, Feedback Trail (combinable)
- **8 color palettes** — Acid, Fire, Ice, Toxic, Neon, Blood, Vapor, Mono
- **Audio-reactive** — all visuals respond to bass, mid, high frequencies, energy and beat in real time
- **BPM detection** — automatic via [realtime-bpm-analyzer](https://github.com/dlepaux/realtime-bpm-analyzer), plus manual input and tap tempo
- **Beat detection** — spectral flux algorithm with adaptive threshold, works with both line-in and laptop microphone
- **Image/GIF overlay** — load PNG, JPG, or animated GIF on top of visuals with opacity, scale, position controls
- **GIF beat sync** — animate GIF frames synced to Beat, BPM, or free-running
- **Offline** — no internet required, everything runs locally

## Screenshots

*Coming soon*

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

The app opens two windows: the control panel (with DevTools) and the output window.

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

Select one main effect (radio buttons) and toggle any combination of post-processing effects. Choose a color palette to change the overall look.

### Image Overlay

1. Click **Import Image / GIF** in the Image Overlay panel
2. Adjust opacity, scale, and position with the sliders
3. For animated GIFs, choose the sync mode:
   - **Beat** — advance one frame per detected beat
   - **BPM** — advance at a steady rate matching the BPM
   - **Free** — play at the GIF's original speed

### Output Window

- The output window automatically goes fullscreen on a secondary monitor
- Click **Toggle Fullscreen** in the control panel to toggle
- If no secondary display is detected, it opens as a regular window

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop runtime | Electron 33 |
| Language | TypeScript |
| Rendering | Three.js + GLSL shaders (WebGL2) |
| Audio analysis | Web Audio API + realtime-bpm-analyzer |
| UI | React 18 |
| State | Zustand |
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
│   │   ├── App.tsx            # Main layout + engine init
│   │   ├── main.tsx           # React mount
│   │   ├── output-main.ts    # Output window renderer (standalone)
│   │   ├── components/
│   │   │   ├── AudioPanel/    # Audio device, gain, sensitivity, BPM
│   │   │   ├── EffectPanel/   # Effect selection, post-processing, colors
│   │   │   ├── OverlayPanel/  # Image/GIF overlay management
│   │   │   ├── OutputPreview/ # Miniature preview of the output
│   │   │   └── Sidebar/       # Sidebar layout
│   │   └── styles/
│   │       └── global.css     # Dark theme
│   └── engine/
│       ├── Engine.ts          # Render loop, effects, post-processing, overlay
│       ├── GifDecoder.ts      # GIF frame extraction via gifuct-js
│       ├── audio/
│       │   └── AudioAnalyzer.ts  # FFT, bands, spectral flux beat detection, BPM
│       └── shaders/
│           ├── tunnel.frag
│           ├── kaleidoscope.frag
│           ├── warp.frag
│           ├── plasma.frag
│           ├── matrix.frag
│           ├── voronoi.frag
│           ├── bloom.frag
│           ├── rgbsplit.frag
│           ├── chromatic.frag
│           ├── feedback.frag
│           ├── overlay.frag
│           └── noise.glsl
├── build/
│   └── entitlements.mac.plist # macOS microphone/JIT permissions
├── package.json
├── electron.vite.config.ts
└── tsconfig.json
```

## Architecture

### Dual Window

The **control window** runs a React app with the sidebar (audio, effects, overlays) and a miniature preview canvas. The **output window** runs a standalone Three.js renderer at full resolution with no UI.

Communication flows through Electron IPC: the control window sends engine state, audio data, and overlay commands to the output window via the main process bridge.

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

Uses **spectral flux** — the sum of positive frequency-bin changes frame-to-frame, weighted towards lower frequencies but including all bands. This works with both high-quality line-in signals and weak laptop microphones.

The threshold is adaptive: `mean + stddev * sensitivity` over a rolling window, with a time-based cooldown informed by the current BPM.

### BPM Detection

Powered by [realtime-bpm-analyzer](https://github.com/dlepaux/realtime-bpm-analyzer), which runs in an AudioWorklet (off main thread). It analyzes peaks at multiple threshold levels and reports candidates with confidence scores.

## Roadmap

- [ ] Transitions between effects (crossfade, wipe, dissolve, beat-synced)
- [ ] More effects: Sacred Geometry, Particle System, Wave Field, Fluid Flow
- [ ] Per-effect parameter sliders with audio mapping
- [ ] Template system: save/load presets
- [ ] Text overlay
- [ ] Keyboard shortcuts for live performance
- [ ] Monitor selection from GUI
- [ ] App icon

## License

MIT
