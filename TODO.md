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
2. [ ] **Packaging verificato** — `yarn package:mac`: doppia finestra, entitlements webcam/mic, .dmg pulito fuori da dev. Gate di qualsiasi uscita dal laptop. [studio B12, anticipato] · ½g
3. [x] **Look Bank** — fatto in v0.7.0: griglia 4×4 con thumbnail, click/Shift+1-0, transizione inclusa
4. [x] **Vocabolario audio esteso** — fatto in v0.7.0: uBassHit/uMidHit/uHighHit, uBassTime/uHighTime, uSub/uPresence su tutti gli effetti (anche ISF); starfield/glitch/fire li usano già
5. [x] **AutoVJ Bag + downbeat** — fatto in v0.7.0: bag per effetti/post/palette, switch sul giro di battuta
6. [x] **Parametri curati per i 21 effetti** — fatto in v0.7.0: 50 uniform veri, slider + audio mapping automatici
7. [ ] **LFO come sorgente parametri** — sine/saw/square accanto a bass/mid/high in ParamControls, rate in beat. Era "se avanza tempo": con ParamControls costa ½ giornata. [storico, riclassificato ↑] · ½g
8. [ ] **MIDI learn** — Web MIDI nativa; learn su crossfader, master, wet/dry, trigger Look Bank. [storico + studio A5] · 1-2g
9. [ ] **Video recording WebM** — canvas.captureStream + MediaRecorder, zero dipendenze; serve anche a documentare i test. [storico + studio A6] · ½g
10. [ ] **Media library persistente** — oggi gli overlay muoiono al riavvio: copia in ~/.djtographikz/assets, ricarico all'avvio, pannello con anteprime. [studio A7] · 1g
11. [ ] **OSC input** — dgram UDP built-in nel main, parser ~80 righe, stessi target del MIDI. Apre TouchOSC dal telefono. [storico, riclassificato ↑ dal parcheggio] · 1g
12. [ ] **Thumbnail effetti** — render offline 1 frame per effetto, cache su disco: griglia visiva come le scene card. [studio B10] · ½g
13. [ ] **Libreria ISF su cartella** — ~/.djtographikz/isf scansionata all'avvio, ogni generator valido diventa un effetto coi suoi slider. [storico ISF + studio B11] · 1g
14. [ ] **Text overlay** — testo su CanvasTexture nella pipeline overlay esistente (nome evento, logo serata). [storico, riclassificato ↑] · ½g
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
