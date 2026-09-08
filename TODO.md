# DJtoGraphikz — TODO

Ordinato per priorità il 2026-09-08. In cima quello che rompe o zavorra
qualcosa che già esiste, poi quello che aggiunge valore, in fondo l'archivio.
Le sigle: C = codice, S = serata, P = preparazione, Q = qualità visiva,
I = integrazione.

## 1. ROTTO O ZAVORRA — prima di aggiungere altro

C21, C1, C2, C3 e C5 sono **fatti in v0.27.2-beta** (in archivio in fondo).
Restano queste due.

- [ ] **C4 Snapshot intero su IPC a ogni emit** — `App.tsx:136`: `sendEngineState` parte a ogni `emitState()`, cioè ~60 volte al secondo mentre trascini uno slider, e lo snapshot porta `paramDefs`, `effectParams`, `keystone`, `cycle.palettes` e i `customImages` in base64. Solo la scrittura su localStorage è debounced, l'IPC no. Throttle a 30 Hz con lo schema già usato da `syncAudioToOutput` · **S**
- [ ] **C6 Video overlay caricato tutto in RAM, due volte** — `Engine.ts:1451` legge l'intero file via IPC in un Blob, e `output-main.ts:61` rifà lo stesso nella finestra output. Una clip da 1 GB fa fuori il renderer a metà set. Serve un protocollo custom in main (`protocol.handle('media', …)`) e `video.src = 'media://…'` · **M**

Dopo C1+C2, `yarn check:output`: cambiano il ritmo dei frame sulla finestra output.

## 2. FUNZIONALITÀ — le sei che valgono di più

Nessuna richiede addon nativi. Ordine per rapporto valore/costo, non per gruppo.

- [ ] **I1 MIDI Clock in ingresso** — BPM **esatto** e fase della battuta dal mixer/CDJ/Traktor invece che stimati dall'aria. È il grosso del valore di Ableton Link (parcheggiato perché richiede addon nativo) su un canale già aperto dalla v0.11. Nota tecnica: il clock è un messaggio da 1 byte e oggi viene scartato in `midi.ts` dal controllo `data.length < 2` · **S**
- [ ] **Q1 Camera master** — zoom, rotazione, pan, tiling a specchio e push-in sul kick applicati nel master shader **prima** del sampling: agisce su tutti e 35 gli effetti e sui ~3.700 ISF insieme. Nessun'altra modifica ha questa leva sulla varietà · **S/M**
- [ ] **P1 Prova a secco con un file audio** — trascini un mp3/wav (o la registrazione di un tuo set) e l'app lo analizza al posto del line-in, con play/scrub. Sblocca "Test con musica vera" (Ordine di lavoro n.1): tutto il lavoro su beat e BPM oggi è verificabile solo in serata · **S/M**
- [ ] **S1 FX momentanei (tieni premuto)** — tieni il tasto: l'effetto è attivo; molli: torna com'era. Vale per post-FX, look e note MIDI (note-on/note-off) e per il tap sul telefono. Risolve il classico "ho acceso lo strobe e me lo sono dimenticato". Serve distinguere keydown/keyup, il wet è già animabile · **S**
- [ ] **S3 Macro "Intensità"** — un fader unico (tastiera + MIDI + telefono) che alza insieme densità, velocità, reattività della scena e il wet della catena post, con un peso per parametro. Sotto pressione un comando batte cinque slider · **M**
- [ ] **P2 Profili locale** — display di output, risoluzione, i 4 angoli del mapping, device audio, gain, ArtNet e master salvati come "posto". La seconda serata nello stesso locale torna a un click · **S/M**

- [ ] **Test con musica vera** — set techno in line-in: beat, BPM ×½/×2, envelope, AutoVJ, grade sul proiettore, FPS in 4K. Tara tutto il lavoro audio mai sentito davvero. In mano all'utente, ma **P1 lo rende ripetibile in cinque minuti** invece che una volta a serata · zero codice, 1 serata

## 3. CODICE — il resto dell'audit

Perdite di risorse e robustezza:

- [ ] **C7 `dispose()` incompleto** — `Engine.ts:2229`: restano fuori le due `PlaneGeometry`, il materiale passthrough iniziale di `postQuad`, `whiteTexture`, le `customTextures` e lo svuotamento di `stateListeners`. Ogni ricreazione dell'Engine perde VRAM · **S**
- [ ] **C8 Import media senza try/catch** — `OverlayPanel.tsx:59`: `addOverlay`/`addVideoOverlay` rigettano su file corrotto o disco staccato → unhandled rejection e nessun messaggio. `addFromLibrary` (riga 100) e `importIsfFiles` il try/catch ce l'hanno già · **S**
- [ ] **C9 `localStorage.setItem` scoperto sui preset** — `PresetPanel.tsx:19,30`: unici punti del progetto senza try/catch (App, LookBank, DmxPanel e midi.ts ce l'hanno). Superata la quota l'utente vede il preset in lista e non lo ritrova al riavvio · **S**
- [ ] **C10 LFO fuori fase fra preview e proiettore** — `beatClock` ed `effectTime` sono accumulatori locali di ogni finestra e non stanno in `stateSnapshot()`: dopo qualche minuto le due finestre mostrano fasi diverse degli stessi parametri modulati. È lo stato duplicato che diverge, quello che il progetto vuole evitare. Metterlo nel payload audio già inviato a 30 Hz · **S**

Costo per frame e traffico:

- [ ] **C11 Allocazioni nel render loop** — `Engine.ts:1937` chiama `getParamDefs()` a ogni frame (due array con spread) e `effParamValue` (riga 1129) alloca un `Record` `audio` nuovo per ogni parametro mappato: ~500 oggetti/s di pressione GC gratuita. Memoizzare i def per effetto, `switch` al posto della mappa · **S**
- [ ] **C12 Re-render totale del pannello effetti** — `EffectPanel.tsx:186`: il listener ricostruisce `new Set(...)` e `getPostChain()` (identità sempre nuove) e ridisegna 832 righe con 35 bottoni e thumbnail. Un cambio scena AutoVJ emette ~10 stati nello stesso frame → 10 render completi. Un `applyScene` in Engine con un solo `emitState()` finale · **S/M**
- [ ] **C13 IPC overlay non throttlato** — `OverlayPanel.tsx:187`: ogni `input` di slider manda subito `sendOverlayUpdate` (60 msg/s), mentre gli stessi slider dal telefono sono throttlati a 90 ms in `remote-server.ts:531`. Allineare le due superfici · **S**
- [ ] **C14 `/state` serve lo snapshot integrale** — `remote-server.ts:121`: ogni telefono accoppiato scarica tutto ogni 1,5 s, `customImages` in base64 compresi, fino a 4 sessioni. Filtrare i campi che il remote non usa quando si popola la cache · **S**
- [ ] **C15 Doppio invio dello shader custom** — `ShaderEditor.tsx:289,304,337`: `setCustomShader` fa già `emitState()` e lo snapshot contiene `customShader`; `sendCustomShaderToOutput` ricostruisce e rispedisce lo stesso stato. Tre chiamate da cancellare, più la funzione · **S**
- [ ] **C16 Spettro: closure stale e doppia lettura** — `AudioPanel.tsx:198`: `drawSpectrum` si ri-schedula da sé con la closure del primo render, quindi `displayBpm` e `confidence` restano congelati e le guardie non servono a niente; e rilegge `getByteFrequencyData` sullo stesso buffer già letto da `update()` nello stesso frame · **S**

Pulizia:

- [ ] **C17 Codice morto** — verificato a grep (una sola occorrenza = solo la definizione): `Engine.addEffect`/`removeEffect`, `getActiveEffect`, `isTransitioning`, `getPostAmount`, `getCustomImageInputs`/`getCustomImages`; `AudioAnalyzer.getBeatPulse` col suo `beatDecay` aggiornato **ogni frame**, `data.spectrum`, `EMPTY_SPECTRUM`, e `data.lowMid`/`highMid` — due `bandAvg()` calcolate per frame senza un solo lettore. ~40 righe e due scansioni di banda per frame · **S**
- [ ] **C18 Contatore effetti sbagliato** — `EffectPanel.tsx:403`: il badge dice `count: 21`, gli effetti sono 35. Derivarlo da `EFFECT_CATEGORIES` · **una riga**
- [ ] **C19 Catena no-op a 30 Hz nel DMX** — `DmxPanel.tsx:60`: costruisce tre terne, ne scarta due e applica una `map` identità sulla terza, per usare solo il colore 1 · **una riga**
- [ ] **C20 Spiccioli** — `BeatTracker.ts:190` chiama `median()` due volte per frame, e `median` fa `[...a].sort()` → 3 array da 80 e 2 sort a ogni frame; `App.tsx:86` legge il mode da localStorage senza validarlo contro `['simple','pro','live']` e la scrittura alla riga 330 è l'unica del file senza try/catch; `Engine.ts:596` non ha la guardia `> 1` sulle dimensioni che invece il ramo remote ha (riga 580) · **S**

## 4. FUNZIONALITÀ — il resto della roadmap

Serata — servono mentre si suona, al buio, sotto pressione:

- [ ] **S2 Beat-roll (stutter a tempo)** — tenendo un tasto l'immagine viene ripetuta ogni 1/4, 1/8, 1/16 di battuta usando la fase del PLL già disponibile: l'equivalente visivo del loop roll del DJ. Un solo buffer in più oltre al freeze esistente · **S/M**
- [ ] **S4 Struttura del pezzo: breakdown / build / drop** — tre indicatori lenti sopra il BeatTracker (sparizione del kick, salita di energia senza cassa, rientro del kick). L'AutoVJ smette di cambiare a caso nel build e piazza il cambio scena **sul drop**, che oggi è l'unico momento che sbaglia · **M/L**
- [ ] **S5 Idle sicuro sul silenzio** — se l'audio manca per N secondi, dissolvenza su un look calmo o sul logo invece di lasciare un fermo immagine o un pattern impazzito; rientra da solo. Noise gate e recovery esistono già, manca la politica · **S**

Preparazione — per arrivare pronti alla serata:

- [ ] **P3 Soundcheck a un tasto** — lista verde/rossa in 15 secondi: livello in ingresso, finestra output presente e che sta davvero disegnando (la logica di `yarn check:output` esiste già, va portata in-app), fps alla risoluzione scelta, pacchetto ArtNet, URL del telefono, spazio disco · **S/M**
- [ ] **P4 Scene AutoVJ mie** — "aggiungi alle scene AutoVJ" dal look corrente, con genere ed energia: entra nella rotazione insieme alle 136 di fabbrica, con toggle "solo le mie / tutte" · **M**
- [ ] **P5 Scaletta della serata** — momenti ordinati (Apertura / Salita / Peak / Chiusura), ognuno con la sua pagina di Look Bank, genere e intensità. Supera il limite dei 16 slot senza una seconda interfaccia · **M**

Qualità visiva:

- [ ] **Q2 Palette da un'immagine** — trascini flyer o logo del locale, k-means su una miniatura estrae 5 colori ordinati e li salva come palette · **S**
- [ ] **Q3 Maschere fra i deck** — oltre ai 5 blend attuali: split con bordo morbido, radiale, luma-key, e maschera guidata dall'audio. Il crossfader diventa la posizione del bordo, non solo la quantità · **M**
- [ ] **Q4 Loop video come sorgente di deck** — una playlist di clip al posto di un effetto, con velocità agganciata al BPM e cambio sul giro di battuta. *Limite onesto: Chromium legge mp4/webm ma non HAP né ProRes (i formati dei pack VJ commerciali), servirebbe conversione a monte* · **M/L**

Integrazione:

- [ ] **I2 Uscita per OBS / secondo PC** — la stessa pagina di output esposta su una route del server già in piedi, da aprire come Browser Source in OBS anche da un altro computer in rete: è il caso d'uso per cui si voleva NDI, senza SDK. *Limite: è un secondo render, costa GPU; per la sola cattura locale la window-capture di OBS resta gratis* · **M**
- [ ] **I3 Pro DJ Link / StagelinQ** — titolo del brano e BPM autorevole direttamente dai lettori Pioneer/Denon (protocolli UDP con implementazioni JS pure). Da tenere opzionale e disattivabile: è reverse engineering e richiede il cavo verso lo switch del booth · **L**
- [ ] **I4 Reel automatico** — buffer circolare degli ultimi 30 secondi: un tasto (o il rilevamento drop di S4) salva una clip 9:16 già pronta da postare · **M**

- [ ] **GIF export** — retrocesso: il recording WebM (v0.8.0) copre quasi tutti gli usi · ½g

## PARCHEGGIO — native addon veri, restano parcheggiati

- [ ] **Syphon/Spout output** — condivisione texture GPU (native addon macOS/Win)
- [ ] **NDI output** — video via rete (SDK nativo). Vedi **I2 uscita OBS**: copre lo stesso uso senza SDK
- [ ] **Ableton Link** — sync BPM via rete (native addon). Vedi **I1 MIDI Clock**: stessa resa su un canale già aperto
- [ ] **3D geometry scenes** — mesh audio-reattive
- [ ] **Plugin architecture** — sistema plugin terze parti
- [ ] **Gamepad/HID support** — Web Gamepad API (facile) ma MIDI learn copre l'uso reale

Studio completo con confronto Resolume/Synesthesia/VDMX: artifact "DJtoGraphikz — Studio di sistema v0.5.2".

## ARCHIVIO — fatto

### Correzioni v0.27.2-beta (2026-09-08)

- [x] **C21 Cambiare la risoluzione di uscita zooma la preview** — segnalato dall'utente 2026-09-08. `Engine.ts:606-617`: `setRenderSize` mette in `uResolution` la risoluzione **logica** (es. 3840×2160) ma disegna in un buffer capato (`cap = 1920` in preview) e moltiplicato per `perfScale`. Gli shader calcolano `uv = (gl_FragCoord.xy - uResolution*0.5) / uResolution.y` (`tunnel.frag:31`, stesso schema ovunque): con buffer 1920 e `uResolution` 3840 le coordinate arrivano a metà del range e il centro dichiarato cade sul bordo → si vede il **quadrante in basso a sinistra ingrandito 2×**. A 1440p il fattore è 1,33×, a 720p/1080p `scale = 1` e non si nota: per questo è sfuggito.
- [x] **C1 Watchdog che raddoppia i frame del proiettore** — `Engine.ts:1792`: il timer rende un frame se sono passati ≥14 ms, ma il periodo rAF a 60 Hz è 16,7 ms → scatta **ogni frame**. La finestra output disegna circa il doppio del necessario. Soglia a ~40 ms: interviene solo quando rAF è davvero sospeso, che è il motivo per cui esiste · **una riga**
- [x] **C2 Risoluzione dinamica di fatto spenta** — `Engine.ts:1740` aggiorna `perfLastNow` *prima* del `return` su `!rafDriven` (riga 1745): il frame rAF successivo misura ~0,7 ms invece di 16,7 e l'EMA converge verso il nulla, così il ramo `perfEmaMs > 24` non scatta mai. Un raymarch a 15 fps non viene mai scalato. Spostare l'assegnazione dopo il controllo. Va con C1, **dopo C21**, poi `yarn check:output` · **una riga**
- [x] **C3 Id effetto sconosciuto = proiettore rosso** — `Engine.ts:628`: `EFFECT_SHADERS[id]` con id ignoto passa `undefined` e three ripiega sul `default_fragment`, che è rosso pieno. Raggiungibile da preset importati (`PresetPanel.tsx:153`), comando remote/OSC (`App.tsx:411`) e restore delle impostazioni dopo la rimozione di un effetto. Una guardia in `setEffect` copre tutti e tre · **una riga**
- [x] **C5 `screenshot()` con un solo slot** — `Engine.ts:2196`: `screenshotCb` è una variabile singola, quindi due richieste ravvicinate (salvataggio look + cattura thumbnail) lasciano la prima promise appesa per sempre e il look non viene mai salvato. Lista di callback · **tre righe**

### Funzioni in app

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

### Batch 2026-09-04 (v0.13 → v0.22) — tutto fatto

- [x] **Release automatiche multi-OS** — GitHub Action su tag `v*`: .dmg/.exe/.AppImage pubblicati da soli (v0.13.0)
- [x] **README bilingue** — inglese principale + italiano, istruzioni installazione per OS, changelog linkato
- [x] **Telefono: banner disconnessione** — overlay fullscreen quando l'app non risponde (v0.13.1)
- [x] **Libreria ISF online** — browser di ~3.700 generator da editor.isf.video, thumbnail, ricerca, import 1 click; import file .fs/.zip (v0.14.0)
- [x] **Compatibilità ISF estesa** — 97% dei generator del sito carica: hoist init globali (GLSL ES), input color/point2D/long/event/image, macro IMG_*, mouse animato (v0.15-0.16.1)
- [x] **Input image negli ISF** — picker immagine per input, texture sincronizzata sull'output (v0.14.0)
- [x] **Smart map v2** — mappa i parametri all'audio analizzando nome + uso reale nel sorgente GLSL, budget di ruoli, undo (v0.16.0)
- [x] **Motore audio BeatTracker** — SuperFlux, soglia mediana+MAD, fase PLL con anti-fase, downbeat stimato, BPM proprio ad autocorrelazione banda kick con comb+Rayleigh; harness sintetico 90-174 BPM ±2 (v0.18-0.19)
- [x] **Mappatura parametri a chip** — chip colorate per sorgente, editor a bersagli grandi (v0.18.0)
- [x] **Risoluzione dinamica** — gli shader pesanti (raymarcher ISF) scalano i buffer invece di laggare, floor 30%, spike-proof (v0.20-0.21)
- [x] **Pass performance** — depth/clear eliminati, blackout a costo zero, dry-post skip, high-performance GPU (v0.21.0)
- [x] **Fix crash fullscreen macOS** — output decentrato/crash in _NSEnterFullScreenTransition: fullscreen dopo ready-to-show (v0.21.1)
- [x] **Fire rifatto** — domain warping, rampa temperatura, braci, scintille (v0.22.0)
- [x] **Preview riducibile**, nomi ISF completi, errori di link leggibili (v0.17.0)

### Roadmap usabilità (2026-08-28) — obiettivo: intuitivo da usare al buio, sotto pressione, da chiunque

Il software è feature-complete; ora il collo di bottiglia è la UX. Principio guida: durante un live
l'utente ha 2 secondi di attenzione, poca luce e le mani occupate — ogni azione deve essere visibile,
reversibile e trovabile senza manuale.

#### U1 — Sicurezza live & feedback (prima di tutto: fiducia)

- [x] **U1.1 Panic button** — un tasto (P) e un bottone sempre visibile: torna a stato sicuro (effetto pulito, niente post, brightness 1, blackout/freeze off, AutoVJ off). Quando qualcosa va storto sul palco serve UN gesto, non dieci · S
- [x] **U1.2 Indicatore audio globale** — pallino che pulsa col beat in top bar (visibile da ogni vista) + banner giallo "Audio perso — riconnessione…" quando l'analyzer sta ritentando (esporre lo stato di recovery da AudioAnalyzer): oggi il recovery è silenzioso e l'utente non sa se l'app sente la musica · S/M
- [x] **U1.3 Stato output in top bar** — chip "Output · Display 2 · fullscreen" / "Output chiusa" + bottone Riapri (ensureOutputWindow esiste già, manca solo la UI): il proiettore è la cosa più importante e oggi non ha indicatore · S
- [x] **U1.4 Toast azioni esterne** — notifica discreta 2s quando un comando arriva da telefono/OSC/MIDI ("Look 3 · telefono"): con più superfici attive l'operatore al laptop deve capire perché lo schermo è cambiato da solo · M

#### U2 — Scoperta e apprendimento (la feature che non trovi non esiste)

- [x] **U2.1 Cheat-sheet scorciatoie** — overlay col tasto ? : hotkey, Shift+click, gesti del remote; oggi le scorciatoie vivono in una riga di testo nella bottom bar · S
- [x] **U2.2 Menu aiuto unico** — il bottone "?" apre un menu (Scorciatoie / Guida rapida / Rifai configurazione) invece di rilanciare l'onboarding a sorpresa · S
- [x] **U2.3 Onboarding v2 + look di fabbrica** — passo finale guidato "salva il tuo primo look" + 8 look precaricati curati per genere: il Look Bank vuoto al primo avvio è un muro, pieno è un invito · M
- [x] **U2.4 Tooltip sistematici** — passata su OGNI controllo: title in italiano, coerente, con l'hotkey tra parentesi dove esiste · M

#### U3 — Riduzione carico cognitivo

- [x] **U3.1 Lingua unica** — UI tutta in italiano (oggi metà inglese metà italiano: "Effects/Wet/Master" vs "Libreria/Testo overlay") · M
- [x] **U3.2 Sidebar destra ad accordion** — 6 pannelli impilati sono una soup: uno aperto alla volta, stato aperto/chiuso persistito tra i riavvii · S/M
- [x] **U3.3 Look Bank pro** — rinomina con doppio click, riordino drag&drop, hint sullo slot vuoto ("click = salva il look corrente") · M
- [x] **U3.4 Undo leggero** — cancellazioni (look, media, binding) con toast "Annulla" 5s invece di distruzione immediata · M

#### U4 — Modalità performance

- [x] **U4.1 Performance mode** — tasto/toggle: preview grande + Look Bank + master/blackout/freeze e basta; tutto il resto sparisce. La vista da usare QUANDO si suona, Simple/Pro sono viste da preparazione · M/L
- [x] **U4.2 Beat flash sul bordo preview** — conferma visiva del beat anche a pannello audio chiuso (toggle, off di default) · S
- [x] **U4.3 Remote: haptics + landscape** — vibrazione sul tap (navigator.vibrate), layout orizzontale per tablet · S/M

#### U5 — Carta

- [x] **U5.1 README quick-start** — per chi apre l'app la prima volta senza di te: 10 righe, screenshot, dal .dmg alla prima visual · S
- [x] **U5.2 Guida rapida in-app** — pannello scrollabile in italiano raggiungibile dal menu aiuto (U2.2) · M

#### D — Redesign visivo (lo stato attuale è "dev-UI": font 10px, slider nativi, emoji come icone, inline-style ovunque)

- [x] **D1 Design system foundation** — token unici in CSS custom properties: scala spaziature (4/8/12/16/24), scala tipografica (min 12px, oggi si scende a 8px), raggi, elevazioni (bg0/bg1/bg2 stratificati), disciplina dell'accent (#00ff88 SOLO per stati attivi/vivi, non decorazione); eliminare la soup di inline-style dai componenti → classi · M
- [x] **D2 Tipografia** — font vero impacchettato in locale (UI + mono per i dati, niente CDN in Electron), gerarchia label/valori/sezioni, uppercase micro-label con letterspacing coerente, tabular-nums su BPM/valori · S/M
- [x] **D3 Kit controlli custom** — slider con track/fill/thumb disegnati (i range nativi macOS stonano sul dark), select, toggle switch riusabile (quello del Media panel promosso a componente), bottoni con stati hover/active/focus visibili, focus keyboard visibile ovunque · M
- [x] **D4 Layout & densità** — preview come protagonista (cornice, più respiro), top bar riorganizzata in gruppi logici (trasporto · look · output · utility) invece della fila piatta di 12 controlli, ritmo verticale nei pannelli con divisori e intestazioni vere · M
- [x] **D5 Identità dentro l'app** — il logo occhio in top bar con l'iride che pulsa col beat (identità + indicatore audio U1.2 in un colpo solo), micro-texture scanline/grain a bassissima opacità sulle superfici, coerente col mondo tekno senza sporcare la leggibilità · S/M
- [x] **D6 Icone vere** — set SVG inline coerente al posto delle emoji (📷🔴📱?) nei bottoni: stroke uniforme, stesso peso del logo · S/M
- [x] **D7 Micro-motion** — transizioni 120-180ms su hover/apertura pannelli/tab, glow solo sugli stati attivi, rispetto di prefers-reduced-motion; NIENTE animazioni decorative continue (la festa è sul proiettore, non sulla UI) · S
- [x] **D8 Remote allineato** — stessi token/tipografia/controlli sulla pagina mobile, così telefono e desktop sembrano lo stesso software · M

Intreccio consigliato con la UX: U1 (piccolo, subito) → **D1-D3 fondamenta** → U2/U3 costruiti già sul kit nuovo → D4-D6 → U4.1 performance mode (nasce direttamente col design nuovo) → D7-D8.

Ordine consigliato: U1 intero → U2.1+U2.2 → U3.2 → U2.3 → resto. U1+U2 ≈ 2 giorni.

### Ordine di lavoro storico — lista unica riconciliata (storico + studio 2026-08-06)

Ogni voce: [origine] · effort. Riclassificati rispetto al vecchio TODO: LFO e Text overlay
promossi (costo crollato con ParamControls/pipeline overlay), Packaging anticipato (gate
della serata), OSC spostato fuori dal parcheggio (niente native addon), GIF export retrocesso
(coperto dal recording WebM).

1. → spostato in cima: **Test con musica vera** [studio S4]
2. [x] **Packaging verificato** — fatto in v0.7.1: .dmg buildato e avviato (doppia finestra ✓, remote server ✓), entitlement mic+camera nel bundle firmato, author fixato. Manca solo icona custom (opzionale) e notarization (solo per distribuire ad altri Mac)
3. [x] **Look Bank** — fatto in v0.7.0: griglia 4×4 con thumbnail, click/Shift+1-0, transizione inclusa
4. [x] **Vocabolario audio esteso** — fatto in v0.7.0: uBassHit/uMidHit/uHighHit, uBassTime/uHighTime, uSub/uPresence su tutti gli effetti (anche ISF); starfield/glitch/fire li usano già
5. [x] **AutoVJ Bag + downbeat** — fatto in v0.7.0: bag per effetti/post/palette, switch sul giro di battuta
6. [x] **Parametri curati per i 21 effetti** — fatto in v0.7.0: 50 uniform veri, slider + audio mapping automatici
7. [x] **LFO come sorgente parametri** — fatto in v0.8.0: sine/saw/square tempo-sync, rate 1/4…32 battute, anche dal telefono
8. [x] **MIDI learn** — fatto in v0.11.0: pannello MIDI in Pro, learn su master/crossfade/motion blur/wet dei 9 post/grade/trigger (tap, blackout, freeze, autovj) e 16 slot Look Bank; binding persistiti
9. [x] **Video recording WebM** — fatto in v0.8.0: 🔴 in top bar, VP9 12Mbps, salva alla pressione di ⏹
10. [x] **Media library persistente** — fatto in v0.10.0: asset copiati in ~/.djtographikz/assets, sezione Libreria nel pannello Media, ri-aggiunta a un tap
11. [x] **OSC input** — fatto in v0.10.0: UDP :9700, /djg/* per tutti i comandi del remote, throttle 33ms, TouchOSC pronto
12. [x] **Thumbnail effetti** — fatto in v0.10.0: cattura lazy dal vivo (frame pulito), griglie come scene card
13. [x] **Libreria ISF su cartella** — fatto in v0.10.0: categoria ISF nel pannello Effects, errori GLSL inline
14. [x] **Text overlay** — fatto in v0.10.0: testo + colore nel pannello Media, tutti i controlli overlay e i post-FX gratis
15. → spostato in fondo alla roadmap: **GIF export**, coperto dal recording WebM (punto 9)
16. [x] **Web remote control** — fatto in v0.6.0, portato a parità completa in v0.7.0: data-driven (/defs + versione), tab LIVE/FX/MIX/COLORI/SETUP, Look Bank e parametri sul telefono

### Candidati prossimo batch (riclassificati 2026-09-07)

Rilettura del parcheggio: due voci NON richiedono native addon, e manca l'auto-update.

- [x] **Notifica aggiornamenti** — fatto in v0.23.0: check GitHub releases ogni 6h, toast "Scarica" con link (build non firmate = niente auto-install, notifica onesta)
- [x] **DMX via ArtNet** — fatto in v0.23.0: pannello Luci DMX, PAR RGB su palette + energia/bass/beat, UDP :6454, zero native addon
- [x] **Projection mapping** — fatto in v0.23.0: pannello Mapping, 4 angoli trascinabili, omografia su CPU + warp nel master shader, stato persistito

### Rimossi (fatti o coperti da altro)

- ~~AI auto-VJ~~ — AutoVJ rule-based copre il caso; versione ML non vale l'effort
- ~~Layer compositing~~ — overlay stack + deck A/B con blend mode coprono l'uso reale
- ~~Preview/blind mode~~ — il deck B è il blind mode: prepari e porti dentro col crossfader
- ~~Monitor selection~~ / ~~Screenshot~~ / ~~Fine-tuning numerico~~ / ~~Live shader coding~~ — implementati
