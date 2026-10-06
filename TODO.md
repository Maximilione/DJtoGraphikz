# DJtoGraphikz — TODO

Ordinato per priorità il 2026-09-08. In cima quello che rompe o zavorra
qualcosa che già esiste, poi quello che aggiunge valore, in fondo l'archivio.
Le sigle: C = codice, S = serata, P = preparazione, Q = qualità visiva,
I = integrazione.

## 1. ROTTO O ZAVORRA — vuota

Tutte e sette le voci sono fatte: C21, C1, C2, C3, C5 in v0.27.2-beta,
C4 e C6 in v0.27.3-beta. In archivio in fondo. Quello che resta aperto
non rompe niente: aggiunge.

## 2. FUNZIONALITÀ — le cinque che valgono di più

Nessuna richiede addon nativi. Ordine per rapporto valore/costo, non per gruppo.

- [x] **I1 MIDI Clock in ingresso** — BPM **esatto** e fase della battuta dal mixer/CDJ/Traktor invece che stimati dall'aria. È il grosso del valore di Ableton Link (parcheggiato perché richiede addon nativo) su un canale già aperto dalla v0.11. Nota tecnica: il clock è un messaggio da 1 byte e oggi viene scartato in `midi.ts` dal controllo `data.length < 2` · **S** — **fatto in v0.41.0-beta**
- [x] **Q1 Camera master** — zoom, rotazione, pan, tiling a specchio e push-in sul kick applicati nel master shader **prima** del sampling: agisce su tutti e 35 gli effetti e sui ~3.700 ISF insieme. Nessun'altra modifica ha questa leva sulla varietà · **S/M** — **fatto in v0.45.0-beta**
- [x] **P1 Prova a secco con un file audio** — trascini un mp3/wav (o la registrazione di un tuo set) e l'app lo analizza al posto del line-in, con play/scrub. Sblocca "Test con musica vera" (Ordine di lavoro n.1): tutto il lavoro su beat e BPM oggi è verificabile solo in serata · **S/M** — **fatto in v0.42.0-beta**
- [x] **S1 FX momentanei (tieni premuto)** — tieni il tasto: l'effetto è attivo; molli: torna com'era. Vale per post-FX, look e note MIDI (note-on/note-off) e per il tap sul telefono. Risolve il classico "ho acceso lo strobe e me lo sono dimenticato". Serve distinguere keydown/keyup, il wet è già animabile · **S** — **fatto in v0.43.0-beta**
- [x] **S3 Macro "Intensità"** — un fader unico (tastiera + MIDI + telefono) che alza insieme densità, velocità, reattività della scena e il wet della catena post, con un peso per parametro. Sotto pressione un comando batte cinque slider · **M** — **fatto in v0.44.0-beta**
  Il pezzo che cambia davvero l'uso in serata e' la **durata per passo**: oggi `advanceInterval` sta sulla playlist (`Engine.ts:193`), uno solo per tutti, quindi non puoi dire "questo per 16 battute, il prossimo per 64". Spostarlo sul singolo passo, con la durata della playlist come valore di partenza, e per passo anche il tipo di transizione (i tipi esistono gia').
  Sovrapposizione con **P5 scaletta**: P5 e' la stessa idea un piano sopra (momenti della serata, ognuno con una pagina di Look Bank). P6 e' il pezzo piccolo e concreto, e va fatto prima: se le playlist diventano modificabili con durate per passo, P5 potrebbe non servire piu' · **S/M**
- [x] **P2 Profili locale** — display di output, risoluzione, i 4 angoli del mapping, device audio, gain, ArtNet e master salvati come "posto". La seconda serata nello stesso locale torna a un click · **S/M** — **fatto in v0.46.0-beta**

- [ ] **Test con musica vera** — set techno in line-in: beat, BPM ×½/×2, envelope, AutoVJ, grade sul proiettore, FPS in 4K. Tara tutto il lavoro audio mai sentito davvero. In mano all'utente, ma **P1 lo rende ripetibile in cinque minuti** invece che una volta a serata · zero codice, 1 serata

## 3. CODICE — vuota

Tutte le voci dell'audit sono chiuse: C21, C1, C2, C3, C5 in v0.27.2-beta,
C4 e C6 in v0.27.3-beta, C7..C20 in v0.28.0-beta. In archivio in fondo.

## 4. FUNZIONALITÀ — il resto della roadmap

Lo studio di mercato del 2026-10-01 (doc "Auto VJ: studio di mercato e confronto") e' tutto fatto: S6, S7, S8 (v0.50–0.51), Q5, P4, I6 (v0.52); I8 verificato e parcheggiato.

Serata — servono mentre si suona, al buio, sotto pressione:

- [x] **S9 Scaletta completa con grafica e cambio canzone** — fatto in v0.57.0: passi con immagini/GIF/testo, modi Canzone e Manuale, rilevatore di cambio canzone (Pro DJ Link + audio), `check:sequences`, `check:trackchange`. Aperto: priorita' del drop nel cooldown, grafica di passo esportabile con le immagini dentro · **M**

- [x] **S2 Beat-roll (stutter a tempo)** — fatto in v0.53.0: `, . /` = 1/4 1/8 1/16, `Engine.setBeatRoll` fa girare in loop i clock dal frame a schermo; niente buffer, gli shader sono funzioni del tempo · **S**
- [x] **S4 Struttura del pezzo: breakdown / build / drop** — fatto in v0.49.0 dentro l'Auto VJ (`AutoVJ.ts`: fasi pausa/groove/picco dagli inviluppi di basso ed energia, cambio **sul drop** con taglio secco, tenuta nel breakdown). Manca solo la parte visibile: i tre indicatori sopra il BeatTracker e un `onPhaseChange` per I4 · **S**
- [x] **S6 Taratura delle fasi sull'impianto vero** — fatto in v0.50.0 per quanto si puo' a tavolino: `yarn check:phases` rigioca una registrazione nel rilevatore senza app ne' audio; su un mix hard tekno 3 drop su 3, 2 pause su 3, 1 falso drop. **Da rifare con una registrazione dall'impianto della serata**: 10 minuti dal mixer, cue a mano (`m:ss drop|break`), `yarn check:phases rec.wav --genre hard-tekno --cues rec.cues`, poi ritoccare `PHASE` in `AutoVJ.ts` · **S**
- [x] **S7 Spie di fase** — fatto in v0.51.0: pausa / salita / groove / picco sotto lo spettro, `onPhaseChange` nell'Auto VJ · **S**
- [x] **S8 Build-up come quarta fase** — fatto in v0.51.0: `build` = pausa con energia in salita e niente kick, scene dedicate per genere mappate all'energia; sul mix tekno compare nei 20 s prima di ogni drop · **M**
- [x] **S5 Idle sicuro sul silenzio** — fatto in v0.53.0: `idle.ts`, N s sotto il gate → dissolvenza su un effetto calmo, rientro da solo; solo con Auto VJ spento; `check:idle` · **S**

Preparazione — per arrivare pronti alla serata:

- [x] **P3 Soundcheck a un tasto** — fatto in v0.54.0: pulsante in toolbar, sonde `output:probe`/`dmx:probe`/`disk:free`, `check:soundcheck` · **S/M**
- [x] **P4 Scene AutoVJ mie** — fatto in v0.52.0: `userScenes.ts`, "+ Look corrente come scena" con fase, lista e rimozione, "solo le mie (dove ne ho)" · **M**

Qualità visiva:

Post-effetti sul frame — dallo studio "Effetti VJ: i preset migliori altrove" (2026-10-02): sulle scene generative siamo pari con Resolume/Synesthesia/MilkDrop, sulla manipolazione del frame no (9 post contro 100+). Tutti un pass nella `postChain`, verificabili con `shader-preview.py` su texture sintetica; poi nei `postSets` delle scene Auto VJ (warp nel groove ipnotico, glitch e outline al picco):

- [x] **F1 Feedback warp** — il post Feedback impara zoom, rotazione, offset per frame e decay: zoom 1.02 + 0.3° è MilkDrop. L'effetto che da solo cambia di più l'impressione "generativo". Parametri: zoom, rotazione, decay, mix. ~1 giorno · **M** — **fatto in v0.59.0**
- [x] **F2 Displace procedurale** — noise/onde/griglia che spostano i pixel del frame, ampiezza sul basso: il "Displace" di Resolume senza mappa (oggi c'è solo l'overlay-come-mappa). Parametri: tipo (noise/onde/griglia), scala, ampiezza, velocità. ~mezza giornata · **S** — **fatto in v0.59.0**
- [x] **F3 Frame glitch** — block shift a righe, tear, color bleed, hold su `uHighHit`/beat: glitch su QUALUNQUE effetto, non solo quello generativo. Parametri: blocchi, intensità, tenuta. ~mezza giornata · **S** — **fatto in v0.59.0**
- [x] **F4 Outline neon** — Sobel sul frame, contorno colorato, originale attenuabile: strobo + outline dei pack rave. Parametri: spessore, soglia, mix originale. ~mezza giornata · **S** — **fatto in v0.59.0**
- [x] **F5 Mirror esteso** — verticale, quad, kaleido-post (N spicchi sul frame), slide/tile, dentro il post Mirror. ~2 ore · **S** — **fatto in v0.59.0**
- [x] **F6 RGB delay** — i tre canali da frame diversi (ring di 3 target piccoli): la scia a colori temporale dei video anni 2000, oltre allo split spaziale. ~2 ore · **S** — **fatto in v0.59.0**
- Pixel sorting: rimandato, costoso e di nicchia. Aperto dopo F1–F6: metterli nei `postSets` delle scene Auto VJ (warp nel groove ipnotico, glitch e outline al picco) dopo una serata a mano.


- [x] **Q5 Tonalita' → palette** — fatto in v0.52.0: `KeyDetector.ts` (croma + Krumhansl, 8 s), palette del genere piu' vicina sul cerchio delle quinte, calde/fredde per modo; `check:key` · **M**
- [x] **Q2 Palette da un'immagine** — fatto in v0.53.0: k-means++ su miniatura, dominante + due piu' lontani, slot nella griglia, palette tue in un solo spazio di indici; `check:palette` · **S**
- [x] **Q3 Maschere fra i deck** — fatto in v0.54.0: split/radiale/luma/audio in `deckmix.frag`, crossfader = bordo, SOFT, `check:deckmix` · **M**
- [x] **Q4 Loop video come sorgente di deck** — fatto in v0.56.0: `videoDeck.ts`, deck B = playlist a tempo, `check:videodeck`. Solo formati Chromium (niente HAP/ProRes) · **M/L**

Integrazione:

- [x] **I5 Più uscite (muri LED, due proiettori)** — una finestra per uscita, ognuna con schermo, risoluzione libera, ritaglio della scena, gamma e tetto propri. Il muro LED dietro al processore e' un display come gli altri, quindi non serve niente di LED-specifico · **M** — **fatto in v0.47.0-beta**
- [x] **I6 Pixel mapping ArtNet/sACN** — fatto in v0.52.0: render target `cols×rows` + `readRenderTargetPixelsAsync`, 170 pixel per universo, sACN E1.31 multicast o ArtNet, nel pannello Luci DMX e nel profilo del posto; `check:pixelmap`. **Non ancora provato su un pannello vero** · **M**
- [x] **I7 Keystone per uscita** — fatto in v0.54.0: angoli per uscita in `outputs.ts`, selettore nel pannello Mapping, migrazione del keystone globale sull'uscita 1 · **S/M**
- [x] **I2 Uscita per OBS / secondo PC** — fatto in v0.54.0: `/output?token=…` + SSE `/events`, adattatore di trasporto in `output-main.ts`, `check:obs`. Da provare in OBS a mano · **M**
- [ ] **I8 Ableton Link** — verificato il 2026-10-01: **non esiste un'implementazione JS pura**; `abletonlink` (0.2.0-beta, 2023) e `@ktamas77/abletonlink` (1.2.3, 2025) sono entrambi addon nativi (`node-addon-api`, `gypfile`) che vanno ricompilati per l'ABI di Electron a ogni aggiornamento. Resta parcheggiato con gli altri addon nativi; la resa equivalente c'e' gia' con I1 MIDI Clock. Se mai: processo ponte separato (binario Link → OSC/UDP verso l'app) invece dell'addon dentro Electron · **L**
- [x] **I3 Pro DJ Link / StagelinQ** — Pioneer fatto in v0.55.0 (`prodjlink.ts`, `ProDjLinkClock.ts`, modo BPM, `check:prodjlink`), **mai provato su CDJ vero**; StagelinQ Denon e titolo del brano (dbserver TCP) restano aperti · **L**
- [x] **I4 Reel automatico** — fatto in v0.54.0: due MediaRecorder sfalsati, tasto `V` o drop, 9:16 in Download, `check:reel` · **M**

- [x] **Installer .dmg con grafica personalizzata** — oggi `electron-builder` (`package.json` > `build.mac`, target `dmg`) produce il dmg di default: sfondo bianco, icona e cartella Applicazioni senza stile. Da fare: immagine di sfondo del dmg col logo e la freccia "trascina in Applicazioni", posizione delle icone, dimensione finestra, icona del volume e del dmg (`build.dmg`: `background`, `contents`, `window`, `icon`), asset in `build/`; stessa identita' visiva anche per l'installer Windows (nsis: header/sidebar) se serve. Va provato su un pacchetto vero, non solo in CI · **S** — fatto: `build.dmg` + `scripts/make-dmg-background.py` (sfondo 1x/@2x in `build/`); verificato dmg locale montato (finestra 660x400, tiff 1x+2x, icona volume). Resta da vedere in Finder; nsis non toccato

- [ ] **GIF export** — retrocesso: il recording WebM (v0.8.0) copre quasi tutti gli usi · ½g

## PARCHEGGIO — native addon veri, restano parcheggiati

- [ ] **Syphon/Spout output** — condivisione texture GPU (native addon macOS/Win)
- [ ] **NDI output** — video via rete (SDK nativo). Vedi **I2 uscita OBS**: copre lo stesso uso senza SDK
- [ ] **Ableton Link** — sync BPM via rete (native addon). Vedi **I1 MIDI Clock**: stessa resa su un canale già aperto
- [x] **3D geometry scenes** — mesh audio-reattive — fatto in v0.67.0: effetto `mesh` (GLB/OBJ/STL/PLY/FBX, look filo/punti/metallo/ologramma/dissolvenza), piu' `galaxy`, `mandelbulb`, `android`
- [x] **Plugin architecture** — sistema plugin terze parti — fatto: plugin dichiarativi in `~/.djtographikz/plugins/` (effetti shader, palette, preset, scalette, mapping consigliati), **solo contributi dichiarativi, niente codice**. Vedi `docs/PLUGINS.md`
- [x] **Gamepad/HID support** — Web Gamepad API (facile) ma MIDI learn copre l'uso reale

Studio completo con confronto Resolume/Synesthesia/VDMX: artifact "DJtoGraphikz — Studio di sistema v0.5.2".

## ARCHIVIO — fatto

### Scalette v0.29.0-beta (2026-09-08)

- [x] **P6 Editor di playlist vero** — chiesto 2026-09-08. Oggi il costruttore di playlist funziona una volta sola: `savePlaylist` (`PresetPanel.tsx:187`) aggiunge sempre in coda, quindi una playlist salvata **non si riapre e non si modifica** — per spostare un passo la si rifà da capo. Serve: caricare una playlist esistente nell'editor, salvarla sopra o come copia, riordinare trascinando invece che con ↑↓, e le thumbnail dei preset come già fa il Look Bank.
- [x] **P5 Scaletta della serata** *(da rivedere dopo P6: se le playlist diventano modificabili con durata per passo, questa potrebbe non servire)* — momenti ordinati (Apertura / Salita / Peak / Chiusura), ognuno con la sua pagina di Look Bank, genere e intensità. Supera il limite dei 16 slot senza una seconda interfaccia · **M**

P5 e P6 sono state fatte insieme, come una cosa sola: le playlist sono
diventate scalette con durata e transizione per passo, riapribili nell'editor.
La "scaletta della serata" di P5 e' una scaletta lunga — non serviva un secondo
livello. Il Look Bank e le scalette ora leggono lo stesso archivio di look
(`src/renderer/looks.ts`), invece di tenere due copie parallele.

### Ottimizzazioni v0.28.0-beta (2026-09-08)

- [x] **C7 `dispose()` incompleto** — `Engine.ts:2229`: restano fuori le due `PlaneGeometry`, il materiale passthrough iniziale di `postQuad`, `whiteTexture`, le `customTextures` e lo svuotamento di `stateListeners`. Ogni ricreazione dell'Engine perde VRAM · **S**
- [x] **C8 Import media senza try/catch** — `OverlayPanel.tsx:59`: `addOverlay`/`addVideoOverlay` rigettano su file corrotto o disco staccato → unhandled rejection e nessun messaggio. `addFromLibrary` (riga 100) e `importIsfFiles` il try/catch ce l'hanno già · **S**
- [x] **C9 `localStorage.setItem` scoperto sui preset** — `PresetPanel.tsx:19,30`: unici punti del progetto senza try/catch (App, LookBank, DmxPanel e midi.ts ce l'hanno). Superata la quota l'utente vede il preset in lista e non lo ritrova al riavvio · **S**
- [x] **C10 LFO fuori fase fra preview e proiettore** — `beatClock` ed `effectTime` sono accumulatori locali di ogni finestra e non stanno in `stateSnapshot()`: dopo qualche minuto le due finestre mostrano fasi diverse degli stessi parametri modulati. È lo stato duplicato che diverge, quello che il progetto vuole evitare. Metterlo nel payload audio già inviato a 30 Hz · **S**
- [x] **C11 Allocazioni nel render loop** — `Engine.ts:1937` chiama `getParamDefs()` a ogni frame (due array con spread) e `effParamValue` (riga 1129) alloca un `Record` `audio` nuovo per ogni parametro mappato: ~500 oggetti/s di pressione GC gratuita. Memoizzare i def per effetto, `switch` al posto della mappa · **S**
- [x] **C12 Re-render totale del pannello effetti** — `EffectPanel.tsx:186`: il listener ricostruisce `new Set(...)` e `getPostChain()` (identità sempre nuove) e ridisegna 832 righe con 35 bottoni e thumbnail. Un cambio scena AutoVJ emette ~10 stati nello stesso frame → 10 render completi. Un `applyScene` in Engine con un solo `emitState()` finale · **S/M**
- [x] **C13 IPC overlay non throttlato** — `OverlayPanel.tsx:187`: ogni `input` di slider manda subito `sendOverlayUpdate` (60 msg/s), mentre gli stessi slider dal telefono sono throttlati a 90 ms in `remote-server.ts:531`. Allineare le due superfici · **S**
- [x] **C14 `/state` serve lo snapshot integrale** — `remote-server.ts:121`: ogni telefono accoppiato scarica tutto ogni 1,5 s, `customImages` in base64 compresi, fino a 4 sessioni. Filtrare i campi che il remote non usa quando si popola la cache · **S**
- [x] **C15 Doppio invio dello shader custom** — `ShaderEditor.tsx:289,304,337`: `setCustomShader` fa già `emitState()` e lo snapshot contiene `customShader`; `sendCustomShaderToOutput` ricostruisce e rispedisce lo stesso stato. Tre chiamate da cancellare, più la funzione · **S**
- [x] **C16 Spettro: closure stale e doppia lettura** — `AudioPanel.tsx:198`: `drawSpectrum` si ri-schedula da sé con la closure del primo render, quindi `displayBpm` e `confidence` restano congelati e le guardie non servono a niente; e rilegge `getByteFrequencyData` sullo stesso buffer già letto da `update()` nello stesso frame · **S**
- [x] **C17 Codice morto** — verificato a grep (una sola occorrenza = solo la definizione): `Engine.addEffect`/`removeEffect`, `getActiveEffect`, `isTransitioning`, `getPostAmount`, `getCustomImageInputs`/`getCustomImages`; `AudioAnalyzer.getBeatPulse` col suo `beatDecay` aggiornato **ogni frame**, `data.spectrum`, `EMPTY_SPECTRUM`, e `data.lowMid`/`highMid` — due `bandAvg()` calcolate per frame senza un solo lettore. ~40 righe e due scansioni di banda per frame · **S**
- [x] **C18 Contatore effetti sbagliato** — `EffectPanel.tsx:403`: il badge dice `count: 21`, gli effetti sono 35. Derivarlo da `EFFECT_CATEGORIES` · **una riga**
- [x] **C19 Catena no-op a 30 Hz nel DMX** — `DmxPanel.tsx:60`: costruisce tre terne, ne scarta due e applica una `map` identità sulla terza, per usare solo il colore 1 · **una riga**
- [x] **C20 Spiccioli** — `BeatTracker.ts:190` chiama `median()` due volte per frame, e `median` fa `[...a].sort()` → 3 array da 80 e 2 sort a ogni frame; `App.tsx:86` legge il mode da localStorage senza validarlo contro `['simple','pro','live']` e la scrittura alla riga 330 è l'unica del file senza try/catch; `Engine.ts:596` non ha la guardia `> 1` sulle dimensioni che invece il ramo remote ha (riga 580) · **S**

### Correzioni v0.27.3-beta (2026-09-08)

- [x] **C4 Snapshot intero su IPC a ogni emit** — `App.tsx:136`: `sendEngineState` parte a ogni `emitState()`, cioè ~60 volte al secondo mentre trascini uno slider, e lo snapshot porta `paramDefs`, `effectParams`, `keystone`, `cycle.palettes` e i `customImages` in base64. Solo la scrittura su localStorage è debounced, l'IPC no. Throttle a 30 Hz con lo schema già usato da `syncAudioToOutput` · **S**
- [x] **C6 Video overlay caricato tutto in RAM, due volte** — `Engine.ts:1451` legge l'intero file via IPC in un Blob, e `output-main.ts:61` rifà lo stesso nella finestra output. Una clip da 1 GB fa fuori il renderer a metà set. Serve un protocollo custom in main (`protocol.handle('media', …)`) e `video.src = 'media://…'` · **M**

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
