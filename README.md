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

### Visual engine

- **21 GLSL effects** in 4 categories (Geometric, Organic, Motion, Digital), with crossfade/wipe/radial/dissolve transitions, optionally beat-synced.
- **50 curated parameters** — 2-3 real sliders per effect (segments, density, zoom, twist…), each **mappable to audio** (bass/mid/high/energy/beat, depth ±100%) or to a tempo-synced **LFO** (sine/saw/square, rate 1/4…32 beats).
- **Look Bank** — 4×4 grid with real thumbnails: click an empty slot to save the full look, click to apply with a transition, hotkeys Shift+1-0.
- **Deck A/B + crossfader** — second deck with 5 blend modes (mix, add, screen, multiply, difference); deck B doubles as blind mode.
- **Post-FX chain** — 9 reorderable effects with per-effect wet/dry (Bloom, RGB Split, Chromatic, Feedback, Grain, Scanlines, Pixelate, Mirror, Invert) + master color grade (exposure/contrast/saturation/lift/vignette), ACES tone mapping, temporal motion blur.
- **16 palettes** + custom editor, smooth color transitions, timer- or beat-based cycling.
- **AutoVJ** — 8 genres, no-repeat rotation (bag), switches on the downbeat, adaptive energy.

### Audio

- Spectral-flux beat detection with adaptive threshold; auto BPM (realtime-bpm-analyzer), tap, manual, ×½/×2.
- Envelope follower, auto-gain, noise gate, input gain; auto-recovery if the audio device drops.
- Extended vocabulary for shaders: per-band hits (kick/synth/hats), gated clocks, sub/presence, beat/bar phase.

### Media

- **Unified Media panel**: images/GIFs, video, **webcam** and **text** as overlays — same controls (opacity, scale, position, displacement) and all post-FX for free.
- GIFs synced to beat/BPM; persistent library in `~/.djtographikz/assets` (re-add with one tap after restart).

### Remote control

- **Phone** — built-in HTTP server, pairing via QR + 6-digit code, up to 4 devices: the mobile page controls everything (Look Bank, parameters, post chain, grade, deck B, AutoVJ) and always stays aligned with the app version.
- **OSC** — UDP server on `:9700`, `/djg/*` addresses (`/djg/effect`, `/djg/look/N`, `/djg/param/<key>`, `/djg/crossfade`, blackout/freeze/autovj/tap…). TouchOSC-ready.
- **MIDI learn** — MIDI panel (Pro): arm Learn, move a control on your controller, binding made and persisted. CC = fader, notes = triggers.

### Shaders and ISF

- Live GLSL editor with validation (broken shaders are rejected with the exact error).
- **Online ISF library** — browse ~3,700 generators from [editor.isf.video](https://editor.isf.video) with thumbnails and search, one-click import; "Import file…" also accepts the `.zip` downloaded from the site.
- Shaders in `~/.djtographikz/isf` show up as a category in the Effects panel, with automatic audio-mappable sliders; **Smart map** hooks them to the audio in one shot based on parameter names.
- Shaders with **image inputs**: pick a picture for each input and it feeds the shader (on the output window too).

### Output and recording

- Dual window: control + fullscreen output on any display, 720p-4K resolution.
- **WebM recording** (🔴 in the top bar, VP9 12Mbps) and **PNG screenshots** (📷).

## Development

```bash
yarn            # dependencies
yarn dev        # development (Electron + Vite)
npx tsc -p tsconfig.web.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && yarn build   # minimal check
yarn package:mac   # .dmg (also package:win / package:linux)
```

Project rules (versioning, git flow): [CLAUDE.md](CLAUDE.md).

## Changelog

What changed in each version is in [CHANGELOG.md](CHANGELOG.md) (Keep a Changelog format) and in the notes of each [release](https://github.com/Maximilione/DJtoGraphikz/releases).

## License

MIT
