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
- [x] **Parametri per effetto** — Speed/Reactivity su tutti gli effetti + uniform custom, ogni param mappabile a bass/mid/high/energy/beat con depth
- [x] **ISF generator import** — header JSON → slider automatici, transpile a convenzioni interne
- [x] **Antialiasing procedurale** — fwidth() sugli shader geometrici

## TIER S — trasformano il prodotto (studio 2026-08-06)

- [ ] **S1 Look Bank** — griglia 4×4 preset con thumbnail (screenshot() al salvataggio), trigger 1 click/hotkey con transizione (~1g)
- [ ] **S2 Vocabolario audio esteso** — uBassHits/uMidHits/uHighHits (flux per banda), uBassTime/uHighTime (clock gated), uSub/uPresence già calcolati ma mai esposti; poi pass sugli shader (~1g)
- [ ] **S3 Parametri curati per i 21 effetti** — 2-3 uniform veri ciascuno in tabella, UI ParamControls già pronta (~2-3g)
- [ ] **S4 Test con musica vera** — set techno in line-in: beat, BPM, envelope, AutoVJ, grade su proiettore, FPS 4K (costo zero codice)

## TIER A — credibilità da strumento

- [ ] **A5 MIDI learn** — Web MIDI nativa; crossfader, master, wet/dry, trigger Look Bank (~1-2g)
- [ ] **A6 Video recording WebM** — canvas.captureStream + MediaRecorder (~½g)
- [ ] **A7 Media library persistente** — overlay muoiono al riavvio; copia in ~/.djtographikz/assets + ricarico (~1g)
- [ ] **A8 OSC input** — riclassificato: dgram UDP è built-in, niente native addon; apre TouchOSC (~1g)
- [ ] **A9 AutoVJ Bag + downbeat** — pesca senza ripetizioni (Resolume Bag) e switch quando barPhase→0 (~½g)

## TIER B — dopo i tier sopra

- [ ] **B10 Thumbnail effetti** — render offline 1 frame per effetto, cache su disco (~½g)
- [ ] **B11 Libreria ISF su cartella** — ~/.djtographikz/isf scansionata all'avvio (~1g)
- [ ] **B12 Packaging verificato** — .dmg con doppia finestra + entitlements webcam/mic (~½g)

## TIER C — parcheggio confermato

- [ ] Syphon/Spout · NDI · Ableton Link · DMX/ArtNet · projection mapping · 3D scenes · plugin architecture · web remote · gamepad — native addon o roba da prodotto maturo
- [ ] Text overlay · LFO automation · GIF export — se avanza tempo

Studio completo con confronto Resolume/Synesthesia/VDMX: artifact "DJtoGraphikz — Studio di sistema v0.5.2".

## RIMOSSI (fatti o coperti da altro)

- ~~AI auto-VJ~~ — AutoVJ rule-based copre il caso; versione ML non vale l'effort
- ~~Layer compositing~~ — overlay stack + deck A/B con blend mode coprono l'uso reale
- ~~Preview/blind mode~~ — il deck B è il blind mode: prepari e porti dentro col crossfader
- ~~Monitor selection~~ / ~~Screenshot~~ / ~~Fine-tuning numerico~~ / ~~Live shader coding~~ — implementati
