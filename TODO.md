# DJtoGraphikz — TODO

## COMPLETATI

- [x] **Keyboard shortcuts** — 1-0 effetti, Shift+1-0 effetti 11-20, Q/W/E/R post-FX, B blackout, F freeze, Space tap BPM, frecce brightness/playlist
- [x] **Blackout + Freeze frame** — bottoni e hotkey, blackout rende nero, freeze congela i visual
- [x] **Master brightness/opacity** — fader globale 0-1, shader pass dedicato
- [x] **FPS counter** — in top bar, colorato verde/giallo/rosso
- [x] **Monitor selection GUI** — dropdown per scegliere display di output
- [x] **Screenshot capture** — salva frame come PNG con download automatico
- [x] **Configurable output resolution** — dropdown 720p/1080p/1440p/4K
- [x] **Slider parametri per-effetto** — uniform esposti come slider con definizioni per tutti i 21 effetti
- [x] **Effect parameter modulation** — mapping parametri su bande audio (bass/mid/high/energy/beat) con amount configurabile
- [x] **MIDI input + MIDI learn** — Web MIDI API, learn mode, mapping CC/note, import/export JSON, persistenza localStorage
- [x] **Text overlay** — testo configurabile con font, dimensione, colore, posizione, opacita', animazioni (pulse/scroll/fade), shadow
- [x] **LFO/automation** — 5 waveform (sine/triangle/sawtooth/square/random), frequenza/min/max/target configurabili
- [x] **Beat-quantized effect switching** — cambio effetto aspetta il prossimo beat
- [x] **Effect chain / FX groups** — salva/carica combinazioni post-processing come chain riutilizzabili
- [x] **Video recording** — MediaRecorder API, output WebM 8Mbps, download automatico
- [x] **Import shader custom** — caricare .frag/.glsl da disco a runtime, sync a output window via IPC
- [x] **ISF shader parser** — parser per Interactive Shader Format con conversione automatica a GLSL engine
- [x] **Video clip playback** — caricare MP4/MOV/WebM, play/pause/stop, loop, velocita' 0.25x-4x
- [x] **Webcam/camera input** — selezione device, start/stop, THREE.VideoTexture
- [x] **Ottimizzazione performance Electron** — GPU flags (rasterization, zero-copy, ignore-blocklist, disable-frame-rate-limit)
- [x] **Blend mode shader** — Add, Multiply, Screen, Overlay, Lighten, Darken, Difference
- [x] **Piu' post-effects shader** — Film Grain, CRT, Pixelate, Mirror, Edge Detection, Halftone, Invert, Posterize

## PRIORITA' ALTA (da implementare)

- [ ] **A/B deck mixing** — due canali visual indipendenti con crossfader, preparare su B mentre A e' live
- [ ] **Preview/blind mode** — anteprima effetto prima di mandarlo all'output
- [ ] **Fine-tuning numerico** — click per editare valore numerico diretto, frecce per nudge, scroll wheel

## PRIORITA' MEDIA (da implementare)

- [ ] **Ableton Link** — sync BPM e fase via rete. Richiede native addon npm `abletonlink`
- [ ] **Syphon output (macOS) / Spout output (Windows)** — condivisione texture GPU. Richiede native addon
- [ ] **NDI output** — invio video via rete. Richiede NDI SDK nativo
- [ ] **Multi-monitor output** — contenuto indipendente su piu' display
- [ ] **Resolution scaling** — render a risoluzione bassa e upscale per mantenere 60fps
- [ ] **Audio spectrum display avanzata** — barre frequenza dedicate nel pannello di controllo
- [ ] **Integrare blend mode shader nell'Engine** — attualmente shader creato ma non ancora wired nel post-processing chain
- [ ] **Integrare nuovi post-effect nell'Engine** — film grain, CRT, pixelate, mirror, edge, halftone, invert, posterize creati ma non ancora nel post chain
- [ ] **Integrare LFO nell'Engine render loop** — classe LFO creata ma non ancora connessa ai parametri effetto
- [ ] **Integrare VideoRecorder nell'UI** — classe creata ma manca bottone Record nell'interfaccia

## PRIORITA' BASSA (Nice-to-have)

- [ ] **OSC input** — ricevere messaggi OSC da tablet/telefoni
- [ ] **Shadertoy/ISF shader import UI** — interfaccia per caricare ISF con auto-generazione slider da metadati
- [ ] **Live shader coding** — editor GLSL in-app con hot-reload
- [ ] **3D geometry scenes** — mesh 3D audio-reattive
- [ ] **Piu' transizioni** — push, slide, zoom, spin, glitch-transition, luminance-key
- [ ] **Onset type classification** — distinguere kick vs snare vs hi-hat
- [ ] **Per-band smoothing controls** — regolare smoothing/attack/decay per banda
- [ ] **Projection mapping base** — keystoning/quad-warp
- [ ] **DMX output via ArtNet/sACN** — controllare luci DMX
- [ ] **GIF export** — esportare loop come GIF animate
- [ ] **Media library / content browser** — libreria con search, tag, favoriti
- [ ] **Folder watching hot-reload** — auto-caricare nuovo contenuto da cartella
- [ ] **Crash recovery / auto-save** — salvataggio periodico stato
- [ ] **Web remote control** — UI web da telefono/tablet
- [ ] **Color picker HSL/HSV** — selezione colore intuitiva
- [ ] **Touch-friendly UI** — bottoni grandi per touchscreen
- [ ] **Gamepad/HID support** — mappare controller gaming
- [ ] **Plugin architecture** — sistema plugin per terze parti
- [ ] **AI auto-VJ mode** — selezione automatica basata su analisi audio
- [ ] **Prompt-to-shader** — generare shader GLSL da linguaggio naturale
- [ ] **Undo/redo** — history dei cambiamenti parametri
- [ ] **UI collassabile/modulare** — sezioni nascondibili
- [ ] **Layer compositing multi-livello** — stack di sorgenti con opacita' e blend mode per layer

## NOTE STRATEGICHE

- **Posizionamento**: tool gratuito, open-source, cross-platform, che funziona subito senza coding
- **MIDI e' il gap #1 risolto**: Web MIDI API implementato con learn mode
- **Performance**: flags GPU ottimizzati, target 60fps
- **Native addons** (Ableton Link, Syphon/Spout, NDI) richiedono compilazione nativa — meglio come future PR separate
