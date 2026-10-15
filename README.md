# DJtoGraphikz

[![Latest release](https://img.shields.io/github/v/release/Maximilione/DJtoGraphikz?label=latest%20version&color=00cc6a)](https://github.com/Maximilione/DJtoGraphikz/releases/latest)

**English** · [Italiano](README.it.md)

Real-time generative visuals for techno nights: it listens to the mixer and follows the music on its own, on a second screen or a projector. Electron desktop app, offline, macOS/Windows/Linux.

<!-- screenshot -->

## Download

**[⬇ Download the latest version](https://github.com/Maximilione/DJtoGraphikz/releases/latest)** — installers are built automatically on every release. Take only the file for your system (`.blockmap` and `.yml` are for auto-update, ignore them).

| System | File | Install |
| --- | --- | --- |
| macOS (Apple Silicon) | `DJtoGraphikz-X.Y.Z-arm64.dmg` | Open the `.dmg`, drag the app into **Applications** |
| Windows | `DJtoGraphikz-Setup-X.Y.Z.exe` | Run the installer |
| Linux | `DJtoGraphikz-X.Y.Z.AppImage` | `chmod +x` and run it, no install |

Builds are not signed, so the OS warns on first launch:

- **macOS** — "damaged" or "unidentified developer": right-click the app → **Open** → **Open** again. If that is not enough: `xattr -cr /Applications/DJtoGraphikz.app` in Terminal.
- **Windows** — SmartScreen: **More info** → **Run anyway**.
- **Linux** — if double-click does nothing, run it from a terminal.

On first launch the app asks for **microphone/audio input** access (to listen to the mixer) and, only if you use the webcam as a source, for the **camera**.

## First night in 5 steps

1. **Audio in** — the onboarding asks for the input: line-in from the mixer, or the microphone. No cable? Drop an mp3 on the Audio panel and rehearse on that.
2. **Output** — pick the projector in the monitor selector and press **Fullscreen**. Save the room as a **venue**: next time it is one click.
3. **Genre** — choose the Auto VJ genre. From here the app runs the night on its own.
4. **Soundcheck** — one button in the top bar: a green/red list in a few seconds (audio in, output really drawing, fps, ArtNet, phone, disk).
5. **Emergency keys** — **B** blackout, **F** freeze, **P** panic. Hold any of them for a momentary, tap to latch. **?** opens the cheat sheet.

Optional: **📱** in the top bar → scan the QR → 6-digit code, and the phone on the same wifi controls everything.

## What it does

### Visual engine

**86 effects in 7 categories** — Geometric (Tunnel, Kaleido, Truchet, Vaultdoor, Hypercube, Turbine, Reactor, Pipes), Organic (Fluid, Smoke, Space Ghost), Motion (Swarm, Pulsar, Shatter), Digital (Matrix, Lasers, Spectrum), Videogame (PS2 towers, 1080° snowboarding), Tekno (dark kick-driven visuals: Flash, Spiral, Bunker, Pistons, Datacenter, Chainfence…) and Bounce (Balls, Pump, Roll). 3D models (GLB, OBJ, STL, PLY, FBX) can be loaded into the Mesh effect (chrome, hologram, particle-dissolve looks), and an Anyma-style chrome android bust is built in. Each has 2-3 real parameters, mappable to audio (bass/mid/high/energy/beat) or to a tempo-synced LFO; **✨ Magic Mapping** connects every parameter in one click — a hand-tuned preset where one exists for the effect, a usage-aware heuristic for the rest — and every effect also gets a recommended mapping applied when you pick it (one-click undo on both). A **master camera** (zoom, rotation, pan, mirrored tiling, push-in on the kick) and an **Intensity** macro act on the whole scene; a global **line thickness** control keeps thin lines readable through haze and room lights; the **Impact** layer adds kick shake, elastic beat punch-zoom and drop flash.

**Post on the frame** — 18 reorderable post-FX with per-effect wet/dry: Bloom, Chromatic, RGB Split, RGB Delay, Invert, Feedback (trail at low, MilkDrop at full), Mirror (horizontal → kaleido), Pixelate, Displace, Film Grain, Scanlines, Frame Glitch, Outline, plus the Cinema set (anamorphic flare, halation, god rays, cine grade, tilt-shift). Plus master color grade, ACES tone mapping and motion blur. **16 palettes**, a custom editor, and a palette from any picture: drop the club's flyer on the last slot.

**Shaders** — live GLSL editor with validation and multi-pass buffers; import from **Shadertoy** (paste the code, or the API JSON with Buffer A-D) and **ISF** (local files or ~3,700 generators browsed online with thumbnails). Imported shaders get audio-mappable sliders and image inputs like any other effect.

### Auto VJ

**11 genres** — Acid Techno, Hard Tekno, Dark Industrial, Minimal, Trance, Drum & Bass, Ambient, Gabber, Tech House, Psytrance, Bounce Techno — about **370 curated scenes** in all (effect, tuned parameters, audio mappings and the post-FX that fit). It follows the track, not a timer: it hears **break / build / groove / peak**, cuts to a peak scene on the first kick of a **drop**, and in the groove holds a scene for a phrase. The track's **key picks the palette** (warm for major, cool for minor), so the same track gets the same colours every night. Save your own looks as scenes of a genre and a phase: they join the rotation, or replace it. The **"Hold here"** button pins the current look without turning the automation off — phase and palette keep following the music underneath.

### Tempo and audio

A beat tracker built for club music (spectral flux, phase-locked loop, genre-aware tempo prior) with tap, manual, ×½/×2, **MIDI Clock** and **Pro DJ Link** (tempo, beat and master deck from Pioneer CDJs on the booth LAN) as alternatives. Auto-gain, noise gate, recovery if the audio device drops. **Track-change detection** from the CDJ or from the audio itself drives setlists. With the Auto VJ off, **silence** fades the wall to a calm effect and the music brings the look back.

### Live control

Everything is on the keyboard (table below) and **hold = momentary**: a tap latches, holding and releasing puts it back — blackout, freeze, post-FX, effects, looks, MIDI pads, a thumb on the phone. **Beat-roll** (`,` `.` `/`) loops the visual over a quarter, an eighth or a sixteenth of a beat. **GIF export** (3–8 s or N beats, looping), a declarative **plugin** folder (ISF shaders, palettes, looks, setlists, no code), **gamepad** learn and a graphical dmg installer. **Look Bank**: 4×4 slots with thumbnails, Shift+1-0 to recall. **MIDI learn** for any controller, **phone** (up to 4 devices, QR pairing), **OSC** on UDP `:9700` (`/djg/*`, TouchOSC-ready).

### Setlists and media

**Setlists**: an ordered list of looks, each with its own duration (seconds, beats, per song, or by hand with `N` / `Shift+N`) and transition, and its own graphics per step: images, GIFs and text that appear with the step and leave with the next. Ready-made 80-minute sets for hard tekno, bounce techno and techno are in `docs/scalette/live-4h.json` (Setlists > Import). **Media** panel: images (PNG, JPEG, GIF/APNG, WebP, AVIF, SVG, BMP, ICO; on macOS also HEIC, TIFF, PSD, RAW, JPEG 2000), video (mp4, mov, webm, mkv, ogv, 3gp), webcam, image sequences (a folder of numbered frames, e.g. a TouchDesigner render) and text as overlays with the full post chain. **Deck B** with crossfader: a second effect (5 blend modes, split/radial/luma/audio **masks**) or a **video deck**, a playlist of mp4/webm/**HAP** (Hap1/Hap5, the common VJ-pack codec — decoded straight to GPU, no conversion needed) clips locked to the BPM.

### Outputs

Control window + fullscreen output on any display, 720p-4K. **Multiple outputs**, one window per wall, each with its own resolution, slice of the scene, gamma/ceiling and 4-corner **keystone**. The output page is also served to **OBS** or a second PC over the LAN (`:9666/output`). **Recording** to WebM, PNG screenshots, and a **reel**: `V` saves the last 15-30 s in 9:16, ready to post.

### Lights

**ArtNet DMX**: RGB PARs follow the palette and pulse with energy/bass/beat. **Pixel mapping**: the frame sampled at a LED panel's or strip's resolution (any W×H, snake wiring) over sACN (E1.31) or ArtNet, 1-60 fps.

### Venues and soundcheck

A **venue profile** saves the room by name: output displays and resolutions, keystone corners, pixel mapping, audio device and gain, ArtNet node. The **soundcheck** checks in a few seconds that everything is really working — including a frame read back from the projector. Every run writes a **session log** (`?` → open log) to attach to a bug report, and the app tells you when a newer release is out.

## Keys

| Key | Does |
| --- | --- |
| `B` / `F` / `P` | blackout / freeze / panic |
| `[` `]` | master down / up |
| `Space` | tap BPM |
| `1-0` | effects |
| `Q` `W` `E` `R` | post-FX |
| `I` | intensity macro |
| `,` `.` `/` | beat-roll 1/4 · 1/8 · 1/16 |
| `Shift+1-0` | looks (Shift+click a slot overwrites it) |
| `V` | reel: save the last 15-30 s |
| `N` / `Shift+N` | setlist: next / previous step |
| `?` | cheat sheet |

Hold any of them = momentary: release and it goes back as it was.

## Development

```bash
yarn                 # dependencies
yarn dev             # Electron + Vite
yarn build           # production build
yarn check:output    # release gate: is the projector really drawing? (launches the app)
yarn check:dryrun    # the beat tracker follows a synthetic 128 BPM track
yarn check:sweep     # in-app sweep of every effect and post: fails on a white, black or flat frame (launches the app)
yarn check:phases    # replay a recording through the Auto VJ phase detector
yarn check:ui        # photograph the control window
yarn package:mac     # .dmg (also package:win / package:linux)
```

Minimal check before a commit: `npx tsc -p tsconfig.web.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && yarn build`. Project rules (versioning, git flow, release gate): [CLAUDE.md](CLAUDE.md). Engine internals: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Changelog

[CHANGELOG.md](CHANGELOG.md) (Keep a Changelog) and the notes of each [release](https://github.com/Maximilione/DJtoGraphikz/releases).

## License

Proprietary — all rights reserved. Since v0.53.0 the source is closed; earlier releases were published under MIT and stay so.
