# DJtoGraphikz — TODO

## IMPLEMENTATO

- [x] **21 effetti visivi** — Tunnel, Kaleidoscope, Warp, Plasma, Matrix, Voronoi, Sacred, Fractal, Particles, Starfield, Metaballs, Mandala, Grid, Waves, Lissajous, Fluid, Glitch, Rings, Fire, Hexagons, DNA
- [x] **9 post-processing** — Bloom, RGB Split, Chromatic, Feedback, Film Grain, Scanlines, Pixelate, Mirror, Invert
- [x] **16 palette colori** — Acid, Fire, Ice, Toxic, Neon, Blood, Vapor, Mono, Sunset, Ocean, Forest, Cyber, Gold, Pastel, Lava, Aurora + custom
- [x] **Smooth color transitions** — con velocita' configurabile
- [x] **Palette cycling** — timer o beat sync, selezione palette in rotazione
- [x] **Audio input** — selezione device, gain, sensitivity, spectrum visualizer
- [x] **BPM detection** — auto (realtime-bpm-analyzer), tap, manual
- [x] **Beat detection** — spectral flux con threshold adattivo
- [x] **Image/GIF overlay** — import, opacity, scale, position, GIF beat sync
- [x] **Preset system** — save/load/export/import configurazioni come JSON
- [x] **Playlist system** — builder, auto-advance (timer/beat), loop, export/import
- [x] **Output resolution** — 720p / 1080p / 1440p / 4K selezionabile da UI
- [x] **Fullscreen output** — simpleFullScreen su macOS, resize render target dinamico
- [x] **FPS counter** — colorato verde/giallo/rosso nella status bar
- [x] **Background throttling disabled** — audio e rendering attivi con focus su output
- [x] **UI 3 colonne** — Audio+Effects sinistra, Preview centro, Overlay+Preset destra
- [x] **Pannello effetti categorizzato** — Geometric/Organic/Motion/Digital con ricerca e icone
- [x] **Post-FX categorizzati** — Glow & Color / Distortion / Film & Texture con icone e descrizioni

## PRIORITA' ALTA

- [ ] **Transizioni tra effetti** — crossfade, wipe, dissolve, beat-synced
- [ ] **Keyboard shortcuts** — 1-0 effetti, Q/W/E/R post-FX, B blackout, F freeze, Space tap BPM
- [ ] **Blackout + Freeze frame** — bottoni e hotkey
- [ ] **Master brightness** — fader globale 0-1
- [ ] **Per-effect parameter sliders** — uniform esposti con audio mapping
- [ ] **A/B deck mixing** — due canali visual con crossfader
- [ ] **Preview/blind mode** — anteprima effetto prima di mandarlo all'output

## PRIORITA' MEDIA

- [ ] **MIDI input + MIDI learn** — controller MIDI con learn mode
- [ ] **Text overlay** — testo configurabile con animazioni
- [ ] **LFO automation** — oscillatori per modulare parametri
- [ ] **Video clip playback** — MP4/MOV/WebM con play/pause/loop/speed
- [ ] **Webcam/camera input** — sorgente video come texture
- [ ] **Video recording** — cattura output come WebM
- [ ] **Screenshot capture** — salva frame come PNG
- [ ] **Monitor selection** — dropdown per scegliere display output
- [ ] **Ableton Link** — sync BPM via rete (richiede native addon)
- [ ] **Syphon/Spout output** — condivisione texture GPU (native addon)
- [ ] **NDI output** — video via rete (NDI SDK nativo)
- [ ] **Fine-tuning numerico** — click-to-edit, frecce, scroll wheel

## PRIORITA' BASSA

- [ ] **OSC input** — ricevere messaggi da tablet/telefoni
- [ ] **Live shader coding** — editor GLSL in-app
- [ ] **ISF shader import** — Interactive Shader Format con auto-slider
- [ ] **3D geometry scenes** — mesh audio-reattive
- [ ] **Projection mapping** — keystoning/quad-warp
- [ ] **DMX output via ArtNet** — controllo luci
- [ ] **GIF export** — esportare loop come GIF
- [ ] **AI auto-VJ mode** — selezione automatica basata su analisi audio
- [ ] **Plugin architecture** — sistema plugin per terze parti
- [ ] **Layer compositing** — stack sorgenti con blend mode per layer
- [ ] **Web remote control** — UI web da telefono
- [ ] **Gamepad/HID support** — controller gaming
