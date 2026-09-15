# DJtoGraphikz

[![Latest release](https://img.shields.io/github/v/release/Maximilione/DJtoGraphikz?label=latest%20version&color=00cc6a)](https://github.com/Maximilione/DJtoGraphikz/releases/latest)

**English** · [Italiano](README.it.md)

Real-time audio-reactive visual generator for tekno nights. It listens to the mixer (or any audio input) and projects animated graphics in sync with the music on a second screen or projector. Electron desktop app, offline, macOS/Windows/Linux.

<!-- screenshot -->

## Download

**[⬇ Download the latest version](https://github.com/Maximilione/DJtoGraphikz/releases/latest)** — installers are built automatically on every release. Download only the file for your system (the `.blockmap` and `.yml` files are used by auto-update, ignore them):

| System | File | Install |
| --------- | ------ | --------------- |
| macOS (Apple Silicon) | `DJtoGraphikz-X.Y.Z-arm64.dmg` | Open the `.dmg` and drag the app into **Applications** |
| Windows | `DJtoGraphikz-Setup-X.Y.Z.exe` | Double-click the installer and follow the steps |
| Linux | `DJtoGraphikz-X.Y.Z.AppImage` | `chmod +x` the file and run it directly (no install) |

Builds are not signed/notarized, so the OS shows a warning on first launch:

- **macOS** — if you see "app is damaged" or "unidentified developer": right-click the app → **Open** → **Open** again in the popup. If that's not enough: `xattr -cr /Applications/DJtoGraphikz.app` in Terminal, then reopen.
- **Windows** — SmartScreen blocks the installer: **More info** → **Run anyway**.
- **Linux** — no warning; if double-click doesn't work, run from a terminal: `./DJtoGraphikz-X.Y.Z.AppImage`.

On first launch the app asks for **microphone/audio input** access (needed to listen to the mixer) and, only if you use the webcam as a source, for the **camera**.

## Quick start (first night, no help needed)

1. Install from the `.dmg` (drag the app into Applications) and open it.
2. On first launch the onboarding starts: pick the **audio input** (line-in from the mixer or microphone) and the music **genre**.
3. Done: **AutoVJ** starts on its own and switches effects, post-FX and palettes in time with the music.
4. Keys to know right away: **B** blackout · **F** freeze · **Space** tap BPM · **Shift+1-0** recalls saved looks.
5. Connect your phone: **📱** button in the top bar → scan the **QR** → enter the 6-digit **code**. The phone (same wifi) controls everything.
6. Send the output to the projector: pick the display from the **monitor selector** and press **Fullscreen**.
7. If something's off, the **?** button relaunches the setup.

## Features

### Interface

- Three modes — **Simple**, **Pro**, **Live** — that are three views of one app: the same effect grid, the same palettes, the same Auto VJ, with more or fewer panels around them.
- Every panel remembers whether it was open, and the right-hand column behaves as an accordion: opening one closes the others.
- The whole app is keyboard-driven, with focus always visible.

### Visual engine

- **46 GLSL effects** in 5 categories (Geometric, Organic, Motion, Digital, Videogame — PS2 boot towers, 1080°-style snowboarding), with crossfade/wipe/radial/dissolve transitions, optionally beat-synced.
  - **Spectrum** — the analyser's own picture: log-spaced bars with peak caps, mirrored, oscilloscope over the top. **Smoke** — a semi-Lagrangian advection plume, three vents each fed by its own band. **Caustics**, **Gyroid** (raymarched minimal surface), **Truchet**, **Quasicrystal**, **String art**, **ASCII** terminal readout.
  - **Pulsar** — the *Unknown Pleasures* ridge plot rendered as a perspective linescape: one continuous terrain sliced front to back with hidden-line removal, sides kept dead flat like the sleeve. The field scrolls toward the camera locked to the beat clock, and every downbeat raises a ridge band that rides in with it.
- **~85 curated parameters** — 2-3 real sliders per effect (segments, density, zoom, twist…), each **mappable to audio** (bass/mid/high/energy/beat, depth ±100%) or to a tempo-synced **LFO** (sine/saw/square, rate 1/4…32 beats).
- **Hold = momentary** — a quick tap latches, holding and letting go puts it back. Blackout, freeze, the QWER post-FX, effects 1-0, looks on Shift+1-0, MIDI pads (note-on/note-off) and a thumb on the phone. No mode to remember in the dark: the key decides, by how long you hold it.
- **Look Bank** — 4×4 grid with real thumbnails: click an empty slot to save the full look, click to apply with a transition, hotkeys Shift+1-0.
- **Sequences** — an ordered list of looks, each held for its own time: pick them from the Look Bank or grab whatever is on screen, drag to reorder, set every step to its own number of seconds or beats and its own transition. Saved sequences reopen in the editor, run on a loop, and export to JSON.
- **Deck A/B + crossfader** — second deck with 5 blend modes (mix, add, screen, multiply, difference); deck B doubles as blind mode.
- **Post-FX chain** — 9 reorderable effects with per-effect wet/dry (Bloom, RGB Split, Chromatic, Feedback, Grain, Scanlines, Pixelate, Mirror, Invert) + master color grade (exposure/contrast/saturation/lift/vignette), ACES tone mapping, temporal motion blur.
- **16 palettes** + custom editor, smooth color transitions, timer- or beat-based cycling.
- **AutoVJ** — 10 genres, ~14 **curated scenes** each (136 total) (effect + tuned params + audio mappings), no-repeat rotation, switches on the downbeat, adaptive energy.

### Audio

- **Dry run on a file** — drop an mp3 or a wav on the audio panel (or pick one with "Prova a secco con un file…") and the app analyses that instead of the input, with play/pause, scrubbing and looping. All the beat, BPM and envelope work used to be testable only at a gig; now it is testable at a desk.
- **MIDI Clock input** — tempo and bar position taken off the cable instead of guessed from the air: 24 ticks per beat, plus start/stop and song-position pointer, from the mixer, the CDJ or Traktor. **MIDI** mode in the audio panel; works with **no line-in at all**, on the MIDI cable alone.
- Log-scale spectral-flux beat tracking with median+MAD threshold, phase-locked loop and its own BPM estimator (100Hz timestamp grid, kick+full-band voting, genre-aware prior); auto BPM (dual estimator), tap, manual, ×½/×2.
- Envelope follower, auto-gain, noise gate, input gain; auto-recovery if the audio device drops.
- Extended vocabulary for shaders: per-band hits (kick/synth/hats), gated clocks, sub/presence, beat/bar phase, a continuous beat clock.
- **`uSpectrum`** — the whole spectrum as a texture, not five numbers: 512 log-spaced bins (20Hz–20kHz) plus the oscilloscope trace, same data on the projector. See `docs/ARCHITECTURE.md`.

### Media

- **Unified Media panel**: images/GIFs, video, **webcam** and **text** as overlays — same controls (opacity, scale, position, displacement) and all post-FX for free.
- GIFs synced to beat/BPM; persistent library in `~/.djtographikz/assets` (re-add with one tap after restart).

### Remote control

- **Phone** — built-in HTTP server, pairing via QR + 6-digit code, up to 4 devices: the mobile page controls everything (Look Bank, parameters, post chain, grade, deck B, AutoVJ) and always stays aligned with the app version.
- **OSC** — UDP server on `:9700`, `/djg/*` addresses (`/djg/effect`, `/djg/look/N`, `/djg/param/<key>`, `/djg/crossfade`, blackout/freeze/autovj/tap…). TouchOSC-ready.
- **MIDI learn** — MIDI panel (Pro): arm Learn, move a control on your controller, binding made and persisted. CC = fader, notes = triggers.

### Shaders and ISF

- **Geometry effects** — an effect can draw real geometry instead of a fullscreen quad: point clouds, instanced meshes, models. First one shipped: **Swarm**, 36,864 particles whose positions live in a simulation buffer and are read by the *vertex* shader, so the CPU never touches a vertex.
- **Multi-pass effects with persistent buffers** — an effect can run simulation passes that read what they wrote last frame, which is what reaction-diffusion, fluids and any cellular simulation need and what a single fullscreen pass cannot do. First one shipped: **React**, a Gray-Scott reaction-diffusion the kick injects into. See `docs/ARCHITECTURE.md`.
- Live GLSL editor with validation (broken shaders are rejected with the exact error), **multi-pass**: mark a section `//!DJG_BUFFER A` and it gets a persistent buffer of its own.
- **Shadertoy import** — paste the GLSL for a single-pass shader, or hand it the JSON from the Shadertoy API to get **Buffer A–D** as well; `iChannelN` is wired up, texture channels become picture inputs.
- **ISF multi-pass** imports: each `PASSES` entry becomes a persistent buffer.
- **Online ISF library** — browse ~3,700 generators from [editor.isf.video](https://editor.isf.video) with thumbnails and search, one-click import; "Import file…" also accepts the `.zip` downloaded from the site.
- Shaders in `~/.djtographikz/isf` show up as a category in the Effects panel, with automatic audio-mappable sliders.
- **⚡ Smart map** (at the top of the Parameters panel, for any effect): one button maps every parameter to the audio by analyzing its name and its actual use in the shader code (geometry→bass, colors→slow LFO, thresholds→beat), with a role budget so everything doesn't strobe together and Undo in the toast.
- Shaders with **image inputs**: pick a picture for each input and it feeds the shader (on the output window too).

### Lights and stage

- **ArtNet DMX** — RGB PARs follow the palette and pulse with energy/bass/beat (optional beat flash); plain UDP, universe/base channel/fixture count configurable.
- **Projection mapping** — drag the 4 corners (keystone/quad-warp) to fit a skewed projector.

### Output and recording

- Dual window: control + fullscreen output on any display, 720p-4K resolution; the preview can shrink to a strip to give panels more room.
- **WebM recording** (🔴 in the top bar, VP9 12Mbps) and **PNG screenshots** (📷).
- **Update notifications** — the app checks GitHub releases and links you to the newest installer.
- **Session log** — every run writes to `~/.djtographikz/logs/` (app, control window and projector window, plus display topology); open it from **?** -> "Apri log della sessione" and attach it to a bug report.

## Development

```bash
yarn            # dependencies
yarn dev        # development (Electron + Vite)
npx tsc -p tsconfig.web.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && yarn build   # minimal check
yarn check:output   # release gate: is the projector really showing an image?
yarn check:ui       # photograph the control window (check:ui simple 0.34)
yarn check:dryrun   # analyse a synthetic 128 BPM track and assert the app follows it
yarn check:momentary # tap versus hold
yarn package:mac   # .dmg (also package:win / package:linux)
```

Project rules (versioning, git flow): [CLAUDE.md](CLAUDE.md).

## Changelog

What changed in each version is in [CHANGELOG.md](CHANGELOG.md) (Keep a Changelog format) and in the notes of each [release](https://github.com/Maximilione/DJtoGraphikz/releases).

## License

MIT
