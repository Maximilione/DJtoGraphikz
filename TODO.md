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
- [x] **Look Bank** — griglia 4×4 con thumbnail, trigger click/Shift+1-0 con transizione (v0.7.0)
- [x] **Vocabolario audio esteso** — hit per banda, clock gated, sub/presence su tutti gli effetti (v0.7.0)
- [x] **Parametri curati** — 50 uniform veri sui 21 effetti, tutti audio-mappabili (v0.7.0)
- [x] **AutoVJ Bag + downbeat** — rotazione senza ripetizioni, switch sul giro di battuta (v0.7.0)
- [x] **Pannello Media unificato** — immagini/GIF/video/webcam stesso flusso, thumbnail live, scelta camera (v0.7.0)
- [x] **Remote mobile a parità completa** — data-driven, sempre allineato alla versione dell'app (v0.7.0)

## ORDINE DI LAVORO — lista unica riconciliata (storico + studio 2026-08-06)

Ogni voce: [origine] · effort. Riclassificati rispetto al vecchio TODO: LFO e Text overlay
promossi (costo crollato con ParamControls/pipeline overlay), Packaging anticipato (gate
della serata), OSC spostato fuori dal parcheggio (niente native addon), GIF export retrocesso
(coperto dal recording WebM).

1. [ ] **Test con musica vera** — set techno in line-in: beat, BPM ×½/×2, envelope, AutoVJ, grade su proiettore, FPS 4K. Tara tutto il lavoro audio mai sentito. [studio S4] · zero codice, 1 serata
2. [x] **Packaging verificato** — fatto in v0.7.1: .dmg buildato e avviato (doppia finestra ✓, remote server ✓), entitlement mic+camera nel bundle firmato, author fixato. Manca solo icona custom (opzionale) e notarization (solo per distribuire ad altri Mac)
3. [x] **Look Bank** — fatto in v0.7.0: griglia 4×4 con thumbnail, click/Shift+1-0, transizione inclusa
4. [x] **Vocabolario audio esteso** — fatto in v0.7.0: uBassHit/uMidHit/uHighHit, uBassTime/uHighTime, uSub/uPresence su tutti gli effetti (anche ISF); starfield/glitch/fire li usano già
5. [x] **AutoVJ Bag + downbeat** — fatto in v0.7.0: bag per effetti/post/palette, switch sul giro di battuta
6. [x] **Parametri curati per i 21 effetti** — fatto in v0.7.0: 50 uniform veri, slider + audio mapping automatici
7. [x] **LFO come sorgente parametri** — fatto in v0.8.0: sine/saw/square tempo-sync, rate 1/4…32 battute, anche dal telefono
8. [ ] **MIDI learn** — Web MIDI nativa; learn su crossfader, master, wet/dry, trigger Look Bank. [storico + studio A5] · 1-2g
9. [x] **Video recording WebM** — fatto in v0.8.0: 🔴 in top bar, VP9 12Mbps, salva alla pressione di ⏹
10. [x] **Media library persistente** — fatto in v0.10.0: asset copiati in ~/.djtographikz/assets, sezione Libreria nel pannello Media, ri-aggiunta a un tap
11. [x] **OSC input** — fatto in v0.10.0: UDP :9700, /djg/* per tutti i comandi del remote, throttle 33ms, TouchOSC pronto
12. [x] **Thumbnail effetti** — fatto in v0.10.0: cattura lazy dal vivo (frame pulito), griglie come scene card
13. [x] **Libreria ISF su cartella** — fatto in v0.10.0: categoria ISF nel pannello Effects, errori GLSL inline
14. [x] **Text overlay** — fatto in v0.10.0: testo + colore nel pannello Media, tutti i controlli overlay e i post-FX gratis
15. [ ] **GIF export** — retrocesso: il recording WebM (punto 9) copre quasi tutti gli usi. [storico, riclassificato ↓] · ½g
16. [x] **Web remote control** — fatto in v0.6.0, portato a parità completa in v0.7.0: data-driven (/defs + versione), tab LIVE/FX/MIX/COLORI/SETUP, Look Bank e parametri sul telefono

## PARCHEGGIO — confermato dallo studio

Native addon per piattaforma o feature da prodotto maturo con utenza; nessuno sblocca il salto di livello:

- [ ] **Syphon/Spout output** — condivisione texture GPU (native addon macOS/Win)
- [ ] **NDI output** — video via rete (SDK nativo)
- [ ] **Ableton Link** — sync BPM via rete (native addon)
- [ ] **DMX output via ArtNet** — controllo luci
- [ ] **Projection mapping** — keystone/quad-warp
- [ ] **3D geometry scenes** — mesh audio-reattive
- [ ] **Plugin architecture** — sistema plugin terze parti
- [ ] **Gamepad/HID support**

Studio completo con confronto Resolume/Synesthesia/VDMX: artifact "DJtoGraphikz — Studio di sistema v0.5.2".

## RIMOSSI (fatti o coperti da altro)

- ~~AI auto-VJ~~ — AutoVJ rule-based copre il caso; versione ML non vale l'effort
- ~~Layer compositing~~ — overlay stack + deck A/B con blend mode coprono l'uso reale
- ~~Preview/blind mode~~ — il deck B è il blind mode: prepari e porti dentro col crossfader
- ~~Monitor selection~~ / ~~Screenshot~~ / ~~Fine-tuning numerico~~ / ~~Live shader coding~~ — implementati
