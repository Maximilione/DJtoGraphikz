# DJtoGraphikz — TODO

## IMPLEMENTATO

- [x] **21 effetti visivi** — Tunnel, Kaleidoscope, Warp, Plasma, Matrix, Voronoi, Sacred, Fractal, Particles, Starfield, Metaballs, Mandala, Grid, Waves, Lissajous, Fluid, Glitch, Rings, Fire, Hexagons, DNA
- [x] **9 post-processing** — Bloom, RGB Split, Chromatic, Feedback, Film Grain, Scanlines, Pixelate, Mirror, Invert
- [x] **16 palette colori** + custom, smooth transitions, palette cycling (timer/beat)
- [x] **Audio input** — device, gain, sensitivity, spectrum visualizer
- [x] **BPM detection** — auto (realtime-bpm-analyzer), tap, manual, ×½/×2, Space tap hotkey
- [x] **Beat detection** — spectral flux con threshold adattivo
- [x] **Beat phase / bar phase** — uniform continui per anticipare il beat
- [x] **Audio envelope follower** — attack veloce / release lento, noise gate, auto-gain
- [x] **Image/GIF overlay** — import, opacity, scale, position, GIF beat sync
- [x] **Video clip + webcam** — layer o displacement map
- [x] **Preset + playlist system** — save/load/export/import, auto-advance timer/beat
- [x] **Output resolution** 720p-4K, fullscreen, multi-monitor con selettore display
- [x] **Transizioni tra effetti** — crossfade, wipe, radial, dissolve, beat-synced
- [x] **A/B deck mixing** — deck B, crossfader, 5 blend mode
- [x] **Post-FX chain riordinabile** — ordine + wet/dry per effetto
- [x] **Color grading master** — exposure/contrast/saturation/lift/vignette + ACES tone mapping
- [x] **Bloom con threshold** — prefiltro + blur separabile a mezza risoluzione
- [x] **Motion blur temporale**
- [x] **Blackout + Freeze + Master brightness** — con hotkey B / F / [ ]
- [x] **Hotkey performance** — 1-0 effetti, QWER post-FX, Space tap BPM
- [x] **Live shader coding** — editor GLSL con live mode, template, import/export
- [x] **Fine-tuning numerico** — doppio-click, frecce, scroll su ogni valore
- [x] **Onboarding guidato** — device → genere → via, rilanciabile con "?"
- [x] **Modalità Simple / Pro** — vista minimale di default, tutto il resto dietro un toggle
- [x] **AutoVJ** — 8 generi, switch effetti/post/palette a tempo, energia adattiva
- [x] **Persistenza impostazioni** — look completo ripristinato all'avvio (preset a parte)
- [x] **Screenshot PNG** — bottone 📷 in top bar
- [x] **Antialiasing procedurale** — fwidth() sugli shader geometrici

## PRIMA DI TUTTO

- [ ] **Test con audio vero** — una serata (o un set registrato): beat phase, envelope, AutoVJ e transizioni non li ha ancora sentiti nessuno

## ALTA UTILITÀ / EFFORT MEDIO

- [ ] **Video recording** — cattura output come WebM (canvas.captureStream + MediaRecorder, no native)
- [ ] **MIDI input + MIDI learn** — Web MIDI API, mapping su crossfader/master/effetti
- [ ] **Per-effect parameter sliders** — uniform esposti con audio mapping (la feature grossa rimasta)

## SE AVANZA TEMPO

- [ ] **Text overlay** — testo su CanvasTexture, pipeline overlay già pronta
- [ ] **LFO automation** — oscillatori per modulare parametri
- [ ] **GIF export** — esportare loop come GIF

## PARCHEGGIO (native addon / da prodotto maturo)

- [ ] **Ableton Link** — sync BPM via rete
- [ ] **Syphon/Spout output** — condivisione texture GPU
- [ ] **NDI output** — video via rete
- [ ] **OSC input** — messaggi da tablet/telefoni
- [ ] **Projection mapping** — keystoning/quad-warp
- [ ] **3D geometry scenes** — mesh audio-reattive
- [ ] **ISF shader import**
- [ ] **DMX output via ArtNet**
- [ ] **Plugin architecture**
- [ ] **Web remote control** — UI web da telefono
- [ ] **Gamepad/HID support**

## RIMOSSI (fatti o coperti da altro)

- ~~AI auto-VJ~~ — AutoVJ rule-based copre il caso; versione ML non vale l'effort
- ~~Layer compositing~~ — overlay stack + deck A/B con blend mode coprono l'uso reale
- ~~Preview/blind mode~~ — il deck B è il blind mode: prepari e porti dentro col crossfader
- ~~Monitor selection~~ / ~~Screenshot~~ / ~~Fine-tuning numerico~~ / ~~Live shader coding~~ — implementati
