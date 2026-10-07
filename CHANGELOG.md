# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/) · versioni [SemVer](https://semver.org/) con suffisso `-beta`.

## [0.72.0-beta] — 2026-10-07

### Added
- **Deck video: supporto HAP (Hap1/Hap5)**: il formato dei pacchetti VJ professionali (Resolume, TouchDesigner, Millumin) ora si riproduce senza conversione — bypassa `<video>`, decodifica i blocchi DXT1/DXT5 (con decode-instructions multi-chunk, Snappy via `snappyjs`) e li carica direttamente in GPU con `compressedTexImage2D`, zero decode CPU. Il fourcc viene letto dal file (non dall'estensione): `.mov` H.264 e `.mov` HAP convivono nello stesso deck. Demux via `mp4box`, Range request per frame (nessun file intero in RAM). Le altre varianti HAP (HapY/HapM/HapA/Hap7/HapH) e ProRes restano non supportate, con errore esplicito invece di un frame nero o corrotto. Richiede `WEBGL_compressed_texture_s3tc` sulla GPU (errore chiaro se assente). `check:hap` (decoder puro, fixture costruite a mano: sezione raw, Snappy, decode-instructions multi-chunk, varianti fuori scope, type byte corrotto).

## [0.71.1-beta] — 2026-10-07

### Fixed
- **Sezione Media**: lo slider di scala delle immagini/video/sequenze/testo deformava le sorgenti non quadrate (uOverlayScale uguale su entrambi gli assi, ignorando l'aspect ratio reale e quello dello schermo). Ora la larghezza segue l'aspect ratio della sorgente. (`659f516`)
- **imgbeat**: il picker immagini accettava solo i formati nativi Chromium; ora converte HEIC/TIFF/PSD/RAW con `sips` su macOS come il resto della libreria. (`bb9de0a`)

## [0.71.0-beta] — 2026-10-06

### Added
- **Maschere** (`faces`): lanterna di volti di porcellana fusi attorno a un asse, su un pavimento di lamelle radiali di rame e una parete di teste di vetro con occhi incandescenti (raymarch con ripetizione polare). Kick = la struttura pulsa e le lamelle si illuminano a onda dal mozzo; parametri `faces`, `spin`, `glow`.
- **Presenza proiettore**: macro 0–1 (pannello Camera, telefono, OSC `/djg/presence`) che alza i dettagli scuri, la saturazione e il bloom morbido sulle alte luci, con tetto a 0.96, per fumo e luci di sala. A 0 l'output e' identico. `check:presence`.
- **GIF export**: pulsante «GIF» accanto alla registrazione WebM; 3/5/8 secondi o loop a N battute esatte, larghezza 320/480/640. Encoder in TypeScript puro, senza dipendenze. `check:gif` (round-trip col decoder dell'app).
- **Plugin dichiarativi**: cartelle in `~/.djtographikz/plugins/` con `plugin.json` che portano shader ISF, palette, look, scalette e mapping, mai codice. Manifest validato (path traversal, symlink, id duplicati, dimensioni). Tab «Plugin» in Preset & Scalette, `docs/PLUGINS.md`, esempio in `docs/plugin-example/`. `check:plugins`.
- **Gamepad**: pulsanti e assi di un controller assegnabili con learn agli stessi comandi del MIDI (tap = latch, hold = momentaneo), sezione «Gamepad» nel pannello MIDI. `check:gamepad`.
- **Installer dmg con grafica**: sfondo con titolo e freccia, icone posizionate, titolo del volume (`scripts/make-dmg-background.py`).
- `check:glsl`: compila tutti gli shader con glslang come fa three su WebGL2 (serve `brew install glslang`, altrimenti salta).

### Changed
- **Effetti rifatti su feedback**: `downpour` (Rain: 5 strati di pioggia, lampioni, suolo bagnato, ripple), `snowride` (Snow: discesa stilizzata con pista, abeti, porte da slalom), `ps2towers` (torri di vetro sul blu notte, come lo schermo di avvio), `static` (curvatura CRT, barre SMPTE, volto fantasma, glitch a blocchi), `cage` (reattivita' su kick, medi e alti; raymarch a 64 step), `warehouse` (Bunker: lampade, neon e fasci, piu' contrastato), `android` (forme organiche, normali lisce), `hexagons` (mai scuro in silenzio).
- **Pannello effetti**: tab Effetti/Post FX/Colori sempre visibili in cima mentre si scorre, e nel Pro il pannello passa sotto il Look Bank con griglia a piu' colonne e parametri in una colonna a lato (sotto 1100 px torna nella sidebar). Il Look Bank mostra le due righe da 8 slot.
- **Scalette live** rigenerate con i nuovi effetti (galaxy, cathedral, chrome, crystals, mandelbulb, storm, ribbons, beamfield, android, monolith, mesh) e i post Cinema per fase; l'Anyma pesa soprattutto nel Live 3.
- **Audio piu' robusto**: se l'id del dispositivo sparisce il riavvio riprova con la scheda esterna; il pannello mostra il dispositivo realmente attivo e propone «Usa <scheda>» se si ascolta quello integrato; backoff con log meno rumoroso. Le schede integrate di Windows (Realtek) e le cuffie Bluetooth non vengono piu' scambiate per schede esterne. `check:audiorecovery`.
- Slider INTENS., MASTER e del deck con traccia riempita.

### Fixed
- `camera.frag` non compilava (`c` dichiarata due volte): con la camera o l'Impatto attivi il passaggio falliva e lo schermo andava nero.
- Lo slider «Spessore linee» non aveva effetto sulle `scanlines` (la uniform era sul materiale `filmgrain`).
- Audio: due `start()` sovrapposti lasciavano due `AudioContext`; uno Stop premuto durante l'avvio o un retry veniva annullato; un permesso microfono negato veniva ritentato all'infinito.

## [0.70.0-beta] — 2026-10-06

### Added
- **Immagine a tempo** (`imgbeat`): fino a 8 immagini tue (logo, flyer, foto) che entrano a scatti a ritmo di musica e si alternano a uno sfondo generativo. Ritmo (ogni beat, 2 beat, battuta, 3-3-2, solo kick) e 7 stili (pulso, negativo, duotone, glitch a fette, specchio, tunnel, strobo). Senza immagini mostra un glifo procedurale.
- **Spessore linee**: controllo globale (pannello Camera, telefono, OSC `/djg/lineboost`) che ispessisce le linee di 21 effetti e dei post `outline` e `scanlines`, con un minimo in pixel e alone, per restare leggibili su proiettore con luci e fumo. `check:lineboost`.

### Changed
- **UI di controllo rifatta**: slider a tutta larghezza con traccia riempita, cursore da 18 px e area da 28 px; preview piccola con il rapporto d'aspetto dell'uscita (letterbox, prima veniva stirata); Look Bank sotto la preview, in tutte le modalita'; sidebar piu' larghe; font minimi 11-13 px; bottoni da 28 px; focus, scrollbar e toggle piu' visibili; griglia effetti a 2 colonne con categorie comprimibili; barra superiore responsiva con BPM sempre visibile, BLACK e PANIC distinguibili; Live con controlli grandi; messaggi d'errore audio con istruzioni e «Riprova». La finestra di controllo si apre quasi a schermo intero.
- **Test headless**: sotto self-test le finestre sono trasparenti, click-through e senza focus (`DJG_VISIBLE=1` per vederle). Sweep: tempo massimo 20 minuti.

### Fixed
- `galaxy` (590k punti) quasi nera in silenzio: l'hash dell'indice in float32 collassava la nuvola a circa 10k stelle. `storm`: ora un fulmine ogni ~2 s anche senza bassi.
- `strobegrid` e `outline` non vanno piu' a nero in silenzio.

## [0.69.0-beta] — 2026-10-06

### Changed
- **Piu' cazzima su 19 effetti non aggiornati di recente**, ognuno riscritto da un agente e controllato da un secondo agente indipendente: mandala, sacred, tunnel, moire, voronoi, neonpoly, orbits, pulsecity, caustics, quasicrystal, reaction, truchet, pulsar, particles, dna, terrain, grid, cracks, spaceghost. Piu' livelli e profondita', aloni per il bloom, kick come evento fisico (onde d'urto, flash, zoom), tone-map morbido e fondo sempre vivo. Id, parametri e uniform invariati: preset e scalette salvate restano validi.
- `check-sweep.py`: tempo massimo portato a 20 minuti (lo sweep ora ha oltre 150 misure).

### Fixed
- `caustics`: usava `uBassHit` e `uBeatClock` senza dichiararle (errore di compilazione), e il nucleo caldo spingeva troppi pixel oltre 0.95.
- `spaceghost`: il vignette diventava negativo sugli schermi molto larghi (striscia LED, ultrawide) e restava solo il pavimento scuro.

### Added
- Test headless: sotto `DJG_SELFTEST` le finestre sono trasparenti, click-through e senza focus (`DJG_VISIBLE=1` per vederle).

## [0.68.0-beta] — 2026-10-05

### Added
- **Stile Anyma**: effetto `android` (busto umanoide cromato procedurale con pannelli biomeccanici, visiera luminosa, dissolvenza in particelle sul kick), effetto `monolith` (portale monumentale con fessura di luce, nebbia volumetrica, pavimento a specchio), look `hologram` e `dissolve` per `mesh` (caricando un modello umanoide ottieni lo stesso stile), Look di fabbrica "Anyma" (si semina solo a Look Bank vuoto) e palette dedicata nell'Auto VJ.

## [0.67.0-beta] — 2026-10-05

### Added
- **Mesh 3D**: effetto `mesh` che carica modelli GLB/GLTF, OBJ, STL, PLY, FBX (dialog dal pannello parametri o dalla libreria Media). Tre look (filo neon, punti, metallo con riflessi), kick = esplosione dei vertici, bassi = scala, alti = scintillio. Senza modello mostra un toro-nodo procedurale. Il modello viaggia nello snapshot, la finestra output lo rilegge. I `.gltf` funzionano solo con buffer incorporati.
- **Sequenze di immagini**: cartella di frame numerati (PNG, JPG, WebP, AVIF; EXR/DPX/TIFF convertiti in PNG a 8 bit con `sips` su macOS) come overlay animato (fps o loop da 1–32 battute) e come clip del Deck B agganciata al BPM. Finestra scorrevole con tetto di RAM per le sequenze 4K. `check:sequenza`.
- **4 effetti**: `mandelbulb` (frattale 3D con dive ciclico), `storm` (fulmini ramificati su cielo di nuvole), `ribbons` (nastri tipo aurora), `beamfield` (rig laser da palco nella nebbia). Inseriti nelle scene dell'Auto VJ.

## [0.66.0-beta] — 2026-10-05

### Added
- **4 effetti 3D**: `galaxy` (590k particelle GPU a bracci di spirale, onda d'urto sul kick), `cathedral` (navata gotica raymarched con god rays veri), `chrome` (goccia di mercurio liquido con riflessi e iridescenza), `crystals` (tunnel di cristalli con rifrazione e dispersione). Inseriti nelle scene dell'Auto VJ.
- **5 post cinema** (categoria Cinema): `anamorphic` (streak orizzontale), `halation`, `godrays`, `cinegrade` (curva S, split-toning dalla palette, vignette), `tiltshift` (bokeh). Tre catene pronte C1–C3 per le scalette.
- **Strato Impatto** (pannello sotto Camera): shake sul kick, punch-zoom elastico sul beat, flash su colpi alti e sul drop, risposta per banda (bassi shake/zoom, medi distorsione, alti chromatic/scintillio), inseguitore d'energia per fase. Logica pura in `src/engine/impact.ts`, `check:reactivity`.

### Fixed
- `camera.frag`: `mirrorFold` ribaltava l'immagine di 180 gradi (mancava `1.0 -`).

## [0.65.0-beta] — 2026-10-05

### Added
- **Molti piu' formati nel pannello Media**: immagini PNG, APNG, JPEG, GIF, WebP, AVIF, SVG, BMP, ICO; su macOS anche HEIC/HEIF, TIFF, PSD, JPEG 2000, TGA, ICNS e RAW (DNG, CR2, NEF, ARW), convertiti in PNG all'import con `sips`. Video mp4, m4v, mov, webm, mkv, ogv, 3gp. Un solo elenco in `src/shared/mediaFormats.ts` per dialoghi, libreria e protocollo `djg-media`.

## [0.64.2-beta] — 2026-10-05

### Fixed
- **Audio fermo dopo lo scollegamento della scheda**: se l'id del dispositivo salvato spariva (scheda ricollegata, id nuovo), il riavvio automatico riprovava all'infinito con `OverconstrainedError`. Ora `AudioAnalyzer` ricade sull'ingresso predefinito e dimentica l'id; il pannello poi riporta la scheda esterna.

## [0.64.1-beta] — 2026-10-02

### Fixed
- **L'audio arrivava dal microfono invece che dalla scheda esterna della console**: l'app sceglieva il primo dispositivo della lista, cioe' il predefinito di sistema (il microfono del portatile), e all'avvio ripartiva dal dispositivo salvato, che dopo le prove era il microfono. Ora la scheda esterna ha la precedenza sul microfono integrato (all'avvio, nell'onboarding, e quando la scheda viene collegata ad app aperta, anche mentre l'audio gira); una scelta salvata che non c'e' piu' ricade sul migliore disponibile. `check:audiodevice`

## [0.64.0-beta] — 2026-10-02

### Changed
- **Scalette dei live piu' pesanti**: 100 passi da 30-60 secondi per live (80 minuti), piu' picchi, catene di post pesanti per fase (`livePostSets.ts`, misurate anche da `check:sweep`), velocita' e reattivita' alzate nei picchi, 36 effetti, palette ogni due passi
- **Sette effetti potenziati** (erano "tristini"), ognuno riscritto a piu' livelli, con parametri invariati: **Impact** (onde d'urto spesse con fronte luminoso e scintille), **Flash** (raggi di luce e griglia di led, resta scuro tra i colpi), **Spiral** (piu' strati di spirali con parallasse e inversione ogni 4 battute), **Static** (segnale perso con immagine fantasma sul kick, aberrazione cromatica, colori dalle palette), **Rain** (tempesta su una citta' con riflessi, pioggia su 4 profondita', raffiche a battuta, cerchi sul kick), **Pump** (anelli e geometrie in controtempo) e **Roll** (corsie in prospettiva con blocchi di luce sull'offbeat). Mai bianco o nero, reattivi all'audio, a posto su striscia LED e verticale

## [0.63.0-beta] — 2026-10-02

**Il telefono conduce la serata.** Senza tag.

### Added
- **Scalette in qualsiasi modalita'** (Live e Pro): lo stato di riproduzione vive in un hook a livello App (`useSequencePlayer`), il pannello Scalette e' solo l'editor
- **Telefono**: PANIC sempre visibile; modo BPM (auto/tap/manuale), meta'/doppio/±1; palette avanti/indietro e ciclo palette (a tempo o a secondi); Auto VJ con scena utente (SCENA, SOLO LE MIE), fase e conteggio scene; video deck (effetto/video, clip); overlay gia' caricati on/off e opacita'
- **OSC**: `/djg/panic`, `/djg/bpm/half|double|set`, `/djg/palette/next|prev`, `/djg/cycle`
- **Validazione dei comandi esterni** (`phoneCmd.ts`) per telefono, OSC e MIDI: numeri clampati, NaN e id ignoti scartati (prima un master NaN dal telefono poteva dare proiettore nero); `check:phone`

### Fixed
- **Pannello sinistro che usciva dal riquadro** (modalita' Pro): la riga "Silenzio dopo N s", l'intestazione Parametri (al cambio / Auto / Collega all'audio) e la riga delle transizioni ora vanno a capo

### Noto
- Resta sul computer cio' che richiede file o hardware: caricare immagini/GIF/video, editor di scalette e shader, import ISF/Shadertoy, MIDI learn, DMX, uscite, audio device. Non provato con un telefono vero

## [0.62.0-beta] — 2026-10-02

### Added
- **Scalette dal telefono**: tab LIVE > Scalette. Elenco, avvio, passo corrente (N/TOT e nome), AVANTI / INDIETRO a bottoni grandi, STOP a doppio tocco; comandi OSC `/djg/seq/next|prev|stop|start/N`. Anti doppio avvio e indici validati. Per ora solo con il pannello Scalette montato (modalita' Pro)

### Fixed
- **Colori diversi tra anteprima e output**: lo snapshot di stato mandava i colori a meta' lerp invece della palette di destinazione, quindi dopo un cambio palette (preset, ciclo, Auto VJ) l'output restava sulla palette vecchia fino al prossimo evento. Ora manda la destinazione; `check:colorsync`

## [0.61.2-beta] — 2026-10-02

### Changed
- **Radar rimosso** dall'app, dall'Auto VJ (scene e famiglie) e dal mapping consigliato: 64 effetti. I preset salvati che lo citano restano caricabili. Scalette dei live rigenerate senza Radar

## [0.61.1-beta] — 2026-10-02

### Changed
- **Counter (sevenseg) rimosso** dall'app, dall'Auto VJ (scene e famiglie) e dal mapping consigliato: 65 effetti. Gabber riprende una scena di build con Blinds. I preset salvati che lo citano restano caricabili: l'engine ignora l'id
- **Scalette dei live**: transizioni varie e ben visibili (wipe, radiale, dissolve) invece di quasi tutte dissolvenze; senza Counter

## [0.61.0-beta] — 2026-10-02

**Tre scalette per i live: 4 ore in tutto.** Senza tag.

### Added
- `docs/scalette/live-4h.json`: tre scalette da ~80 minuti (Hard Tekno, Bounce Techno, Techno), da importare da Scalette > Importa. 49 passi a tempo ciascuna, composti con le scene dell'Auto VJ del genere: apertura calma, tre ondate build > groove > picco > pausa, chiusura. Mai lo stesso effetto ne' la stessa famiglia due volte di fila, palette che cambia ogni quattro passi, transizioni dissolve/radiale sui picchi
- `scripts/gen-scalette.mjs`: rigenera il file (durate, genere e arco sono in testa allo script)

### Noto
- Il tempo scorre da solo e non segue la musica: se un brano si allunga, `N` / `Shift+N` avanza o torna indietro di un passo. Senza CDJ il cambio brano non e' esatto, per questo i passi sono a tempo

## [0.60.0-beta] — 2026-10-02

**Niente schermo bianco o nero, e una revisione di tutti gli effetti.** Sweep in-app, pavimenti di luce, quattro riscritture chieste a voce, mapping consigliato per ogni effetto. Senza tag.

### Added
- **Space Ghost** (Organici): nebulosa frattale raymarch scritta da zero (kali-fold, parametri Pieghe/Bagliore/Deriva)
- **Mapping consigliato** per ognuno dei 66 effetti (`recommendedMappings.ts`): applicato al cambio effetto se non ci sono mapping tuoi, pulsante "Auto" con annulla, impostazione on/off; `check:mappings`
- **`check:sweep`**: percorre in-app tutti gli effetti, ogni post e ogni set di post dell'Auto VJ, con tre sonde per misura sul frame dell'output; segnala BIANCO, NERO, PIATTO; `--audio` con un 128 BPM sintetico

### Changed
- **Vortex riscritto** (era rotto: cucitura radiale con `arms` non interi, scatto di 90 gradi ogni quattro battiti): spirale logaritmica, foro nero al centro, calcio che tira verso l'interno
- **Spiral riscritta**: tunnel a spirale logaritmica con bracci sottili antialias, direzione senza salti; `twist` minimo 3
- **Tribal e' ora un occhio stile Sharingan**: pupilla, iride, tomoe orbitanti, contrazione sul calcio
- **Counter (sevenseg) riscritto**: segmenti a 45°, cifre grandi, bagliore, scorrimento sui colpi di hat
- Revisione di tutti gli effetti, Geometrici compresi (kaleidoscope non va piu' al bianco, rings e hexagons con pavimento di luce): orologi del basso senza teletrasporto a t grande, vignette in unita' del quadro (striscia LED e verticale), niente guadagni che portano al bianco, antialiasing, valori che crescono senza limite avvolti. Reaction: range feed/kill ristretti alla zona viva
- Pavimento di luce in silenzio su undici effetti, static e starfield; Outline non e' piu' nero a amount 1

### Noto
- Radar, particles e stringart sulla striscia LED restano scuri in silenzio ma con struttura visibile. Sweep e anteprime usano audio sintetico: non ancora provato con musica vera in sala

## [0.59.0-beta] — 2026-10-02

**F1–F6: la manipolazione del frame che mancava** (dallo studio sui preset altrui). Due branch in parallelo. Senza tag.

### Added
- **Feedback warp** (F1): il frame precedente campionato zoomato (1.003–1.02 per frame, piu' basso e beat), ruotato (0.11–0.3°), traslato in orbita lenta, con decay 0.80–0.97 e curl noise, tutto derivato dall'amount; sotto 0.25 e' la scia di prima, a 1 e' MilkDrop. I post non hanno sotto-parametri: l'amount e' la manopola
- **RGB Delay** (F6, Luce & Colore): rosso dal frame corrente, verde e blu da un ring di tre target a meta' risoluzione, ritardo 1–8 frame dall'amount; all'accensione i tre slot si riempiono col frame corrente, niente flash di scene vecchie
- **Displace** (F2, Distorsione): onde morbide a amount basso, value-noise a due assi sopra 0.8, ampiezza = amount × (0.5 + basso) × 6 % del frame, bordi ripiegati
- **Frame Glitch** (F3, riga "Frame"): block shift su 24 righe a 15 fps, tear sopra una linea mobile, color bleed proporzionale, righe tenute solo sui colpi alti; identita' esatta ad amount 0 senza colpi
- **Outline** (F4, "Frame"): Sobel sul frame, contorni nel colore 1 con glow sul beat, originale × (1 − amount)
- **Mirror esteso** (F5): l'amount sceglie il modo a scaglioni — (0.8,1] orizzontale (default, com'era), (0.6,0.8] verticale, (0.4,0.6] quad, (0.2,0.4] kaleido 6, [0,0.2] kaleido 8 — tramite `uLevel`, l'amount grezzo senza la macro Intensita', cosi' il fader non cambia modo
- I quattro post nuovi sono nelle liste del MIDI learn (`wet:<id>`) e dei post del telefono

### Noto
- Mirror non ha piu' il mix parziale: sotto 0.01 viene saltato, sopra e' pieno nel modo scelto. Frame Glitch ad amount 1 su un colpo alto forte e' molto aggressivo: e' un picco, si dosa. Nessuno dei sei e' ancora nei `postSets` delle scene Auto VJ: prima una serata a mano

## [0.58.1-beta] — 2026-10-02

**Bounce e' techno.** La 0.58.0 l'aveva letta come Melbourne bounce: coriandoli e palette da festa. Corretto prima della serata; questo e' il tag che va in sala.

### Changed
- Genere **Bounce Techno**: groove rotolante e scuro, basso che pompa sull'offbeat. Scene riscritte: pausa eclipse/bunker/radar/smoke/static, salita eclipse/pump/blinds/impact, groove **Roll**, **Pump**, Balls, tunnel, spiral, tribal, chevrons, cage, rings, cracks, barcode, lattice, city; picco flash, impact, strobo, lasers, shatter, vortex, glitch, pump a tutta, neon. Palette mono / sangue / acciaio / ambra, crossfade 0.25 s, 145 BPM
- **Roll** al posto di Confetti (rimosso): corsie di blocchi grigi che rotolano una contro l'altra, ogni blocco gonfia sull'offbeat e si ritira sul kick (il sidechain al contrario), una corsia d'accento scende di una corsia per battuta, un blocco caldo per corsia cambia ogni 4 battute. Grigio su nero, un colore solo di palette
- Balls nel groove va con la grana, non col bloom: palle bianche su nero, non neon

## [0.58.0-beta] — 2026-10-02

**Bounce, per la serata di stasera.** Tag di release: comprende 0.57 e 0.58.

### Added
- Categoria **Bounce** con tre effetti: **Balls** (fino a 8 palle, una parabola per beat sul beat clock sfalsata per palla, squash a terra e stretch in aria, ombra e pavimento che lampeggia sul kick), **Pump** (quadrati arrotondati annidati con l'inviluppo sidechain: si abbassano sul beat e gonfiano sull'offbeat, dove la bounce ha il basso), **Confetti** (cannone ogni due battute, pezzi con velocita' e rotazione proprie, gravita' misurata in battute cosi' l'arco e' uguale a ogni tempo, due spari in aria insieme). Tre parametri ciascuno
- Genere Auto VJ **Bounce**: 32 scene nelle quattro fasi (pausa caustics/orbits/fluid/eclipse/radar, salita eclipse/spiral/blinds/pump, groove palle/pump/kaleido/neon/hex/rings/truchet/meta/chevron/cage/tribal/city, picco confetti/impact/strobe/lasers/tunnel/shatter/vortex/stars/flash), palette Neon/Cyber/Fuoco/Aurora/Vapore, frase 8 battute, dissolvenza 0.3 s, 140 BPM

## [0.57.0-beta] — 2026-10-01

**La playlist completa: scalette con grafica per passo, che avanzano al cambio canzone.** Due branch in parallelo (`feat/scaletta-grafica`, `feat/track-change`), interfaccia fissata prima: `Engine.onTrackChange`.

### Added
- **Scalette con grafica.** Ogni passo porta `overlays`: immagini, GIF e testi dalla libreria media, da file (copiato in libreria, il passo punta al percorso) o digitati, con opacita'/scala/posizione/gifSync ("usa come e' ora" se quell'overlay e' gia' a schermo). Il player, all'ingresso del passo, toglie tutte le grafiche di scaletta (id `seq:*`) e mette quelle del passo; gli overlay dell'utente non si toccano; Stop pulisce. Pulsante **Prova** per passo. Modi: Secondi, Beat, **Canzone** (un passo per traccia), **Manuale** (Succ/Prec, tasti `N` / `Shift+N`). `sequencePlayer.ts` puro; `readLibraryImage` estratto da `OverlayPanel` (era duplicato); `check:sequences` esteso
- **Rilevatore di cambio canzone** (`TrackChange.ts`, puro). Da Pro DJ Link: `prolink:track` quando cambia l'id rekordbox del lettore seguito (master, o il primo sentito battere). Dall'audio senza CDJ: tempo che si sposta di piu' dell'1,5 % e resta 20 s dopo essere stato stabile 30 s (salti di ottava ignorati), tonalita' con confidenza ≥ 0,5 che cambia e resta 20 s, pausa di almeno 20 s seguita dal drop; cooldown 60 s, e dopo un evento Pro DJ Link l'audio tace 30 s. `Engine.onTrackChange(fn)`, `getLastTrackChange()`; pannello Audio: "Ultimo cambio canzone: N min fa (motivo)". `check:trackchange` 11 controlli; `check-phases` stampa i cambi trovati e accetta `--keyHoldMs` ecc.
- Taratura sul mix hard tekno di 15 minuti: con le soglie da 8/10 s uscivano 8 eventi (tre erano lo stimatore di tempo che oscillava fra due lag); a 20 s ne restano 5, uno ogni 3 minuti, e i tre drop dopo pausa lunga (1:38, 7:23, 14:29) ci sono tutti. Su tekno a tempo fisso il segnale affidabile e' la pausa + drop

### Changed
- L'Auto VJ segue la fase (pausa/salita/groove/picco) anche da spento, cosi' il rilevatore ha il drop con la Scaletta al posto dell'Auto VJ; scene e palette si muovono solo da acceso

### Noto
- Le immagini di passo sono riferite per percorso nella libreria locale: una scaletta portata su un'altra macchina perde le immagini, non i testi. Il primo id Pro DJ Link visto ad app aperta a set in corso conta come cambio. Il cooldown non ha priorita': un evento tonalita' puo' assorbire un drop vero pochi secondi dopo

## [0.56.0-beta] — 2026-10-01

**Q4 — loop video come sorgente di deck.** Chiude la sezione 4 del TODO. Ultima versione prima del tag di fine giornata.

### Added
- **Deck B come playlist di clip video.** Pill "Effetto / Video" nella deck-bar; ＋ sceglie mp4 (H.264), webm, mov-H.264; ogni clip entra con BPM nativo = BPM che suona ora (rate 1), correggibile per clip; `playbackRate` = BPM live / BPM nativo (clamp 0.0625–16, i limiti di Chromium); cambio clip sul giro di battuta ogni N battute (1–16, default 4), loop. `src/engine/videoDeck.ts` e' la logica pura (`playbackRate`, `barWrapped`, `onBar`, `clipTime` dal solo `beatClock` cosi' le due finestre concordano); nell'Engine un `<video>` + `VideoTexture` per finestra, la texture viene blittata in `rtDeckB` e blend/maschere restano com'erano: nessun pass in piu'. Playlist in `stateSnapshot()`, l'uscita carica la stessa clip e fa seek a `clipTime()`; deriva di qualche frame fra controllo e proiettore, riallineo automatico sopra 0.25 s. `yarn check:videodeck`
- Limiti dichiarati: solo i formati che Chromium decodifica (niente HAP/ProRes dei pack VJ: `ffmpeg -c:v libx264` a monte); al cambio clip 100–300 ms con l'ultimo frame fermo; la clip viene stirata all'aspetto del deck

## [0.55.0-beta] — 2026-10-01

**I3 — Pro DJ Link** (solo Pioneer; StagelinQ Denon rimandato). Senza tag: esce con la release di fine giornata.

### Added
- Modalita' BPM **Pro DJ Link**: tempo, battito nella battuta e lettore master dai CDJ Pioneer sulla rete del booth, esatti come il MIDI clock. `src/main/prodjlink-packets.ts` (parser puro: beat 0x28, keep-alive 0x06, status 0x0a, ogni offset commentato con la fonte Beat Link / dysentery), `src/main/prodjlink.ts` (tre socket UDP 50000–50002 aperti **solo** quando il modo e' scelto, keep-alive come lettore virtuale #7 che sale fino a 15 se il numero e' occupato: i numeri 1–6 dei lettori veri non si toccano mai; inoltra `prolink:beat` e `prolink:devices`), `ProDjLinkClock.ts` (puro, modellato su `MidiClock`: segue il master, senza flag il primo lettore sentito finche' non tace 2,5 s; scarta BPM fuori 40–300). `AudioAnalyzer`: `applyMidiClock` generalizzato in `applyClock`. Pannello Audio: pill "Pro DJ Link" e stato (agganciato a / lettori in rete / nessun lettore visto). `prolink-connect` scartato: trascina `better-sqlite3` nativo e Sentry; zero dipendenze
- `yarn check:prodjlink`: 15 controlli su fixture esadecimali del parser e sul clock

### Noto
- **Mai provato su un CDJ vero**: le fixture sono costruite dagli offset documentati, non catture. Il primo test si fa guardando i log `[ProDJLink]`. Se i lettori ignorano il nostro annuncio il flag master non arriva e il clock segue il primo deck sentito. Titolo del brano non disponibile (serve la sessione dbserver TCP)

## [0.54.0-beta] — 2026-10-01

**Cinque voci del TODO in parallelo** (P3, I7, I2, I4, Q3), ognuna sul suo branch, integrate in `feat/integrazione-2026-10-01`. Prima versione senza tag: la release esce a fine giornata.

### Added
- **P3 — Soundcheck a un tasto.** Pulsante nella barra in alto: in 6–7 s una lista verde/gialla/rossa di ingresso audio (≥3 s di segnale su 6), finestra di output che disegna davvero (sonda `output:probe`: 1 s di frame + luma di un frame ridotto, le stesse soglie di `check-output.py`: nera < 0.008, uniforme std < 0.01), fps alla risoluzione scelta per entrambe le finestre (≥50 ok, ≥30 attenzione), pacchetto ArtNet (`dmx:probe`, un ArtPoll: prova rete e socket senza far lampeggiare i fari), URL del telefono, spazio disco (`disk:free`, soglia 2 GB). Logica pura in `soundcheck.ts`, `yarn check:soundcheck`
- **I7 — Keystone per uscita.** Ogni finestra di uscita ha i suoi 4 angoli in `outputs.ts`; il pannello Mapping ha il selettore "Uscita" quando ce n'e' piu' di una e "Azzera" agisce sulla scelta; i profili dei posti li salvano con le uscite. Il keystone globale delle versioni precedenti migra una volta sola come mapping dell'uscita 1, cosi' la taratura della serata prima non si perde; lo snapshot non porta piu' `keystone`, viaggia con `output:slice`. `check:outputs` 10, `check:venues` 6
- **I2 — Uscita per OBS / secondo PC.** La pagina di output e' servita dal server del remote su `/output?token=…` e riceve lo stesso stato+audio della finestra Electron via **SSE** (`/events`; spettro in base64, codec puro in `src/shared/obsWire.ts`); `output-main.ts` ha un adattatore di trasporto (`window.api` oppure `EventSource`) sugli stessi canali: una pipeline. Il browser che si collega a serata iniziata riceve lo stesso handshake della finestra (`replayShow`). Indirizzo con pulsante Copia nel pannello Remote; "Nuovo codice" lo rigenera e scollega i browser. Limiti: secondo render, overlay video da file e webcam non arrivano nel browser, risoluzione replayata solo alla connessione. `yarn check:obs`
- **I4 — Reel automatico.** Gli ultimi 15–30 s della preview, ritagliati 9:16, in WebM pronti da postare: tasto `V`, chip "Reel" in toolbar, o il drop dell'Auto VJ (a scelta, 8 s dopo il colpo cosi' la clip contiene salita e drop). Due `MediaRecorder` sfalsati di 15 s che ripartono ogni 30 s, perche' i chunk WebM dopo il primo non sono decodificabili da soli; `Engine.onFrameRendered` copia il frame nello stesso task del render. Default spento, 720×1280 (due encoder VP9 software: 10–20% di un core ciascuno); i file `djtographikz-reel-*` vanno dritti in Download senza dialog. `yarn check:reel`
- **Q3 — Maschere fra i deck.** Oltre ai 5 blend: split verticale/orizzontale, radiale, luma-key e maschera audio (il raggio respira col basso e scatta sul beat), tutto in `deckmix.frag` con `uMaskMode`/`uMaskSoft`, nessun pass in piu'. Con una maschera il crossfader e' la posizione del bordo (0 = tutto A, 1 = tutto B) e SOFT la morbidezza; `maskSoft` in stato, preset e telefono (slider "Bordo"). `yarn check:deckmix`: contact sheet e probe pixel senza aprire l'app, ha trovato un bordo invertito nella prima versione

### Changed
- Regola di rilascio (CLAUDE.md): tag e installer ogni 5 versioni o a fine giornata, non a ogni batch; il gate `check:output` gira sul pacchetto costruito/impacchettato prima del tag

## [0.53.0-beta] — 2026-10-01

**Sorgente chiuso, e tre cose per la serata: beat-roll, idle sul silenzio, palette dal flyer.**

### Changed
- **Il pacchetto non espone piu' il sorgente.** Il main compila in **bytecode V8** (`bytecodePlugin` di electron-vite: `.jsc`, non JavaScript leggibile); il preload no, perche' i renderer sono sandboxed e un preload sandboxed non puo' caricare il bytecode (provato: `module not found: ./bytecode-loader.cjs`, finestre mute) — e' il ponte IPC, quaranta righe di nomi di canale. Il renderer, che non puo' essere bytecode senza node integration, passa da `scripts/obfuscate.mjs` dopo la build: identificatori rinominati, stringhe (GLSL compreso) in un array codificato; **niente control-flow flattening ne' dead code**, costano frame time e il motore va a 60 fps. Solo i nostri chunk: `three` e `vendor` (React) sono in chunk propri e restano com'erano. `scripts/afterPack.cjs` gira i **fuse di Electron** sul binario impacchettato: `RunAsNode` spento (niente `ELECTRON_RUN_AS_NODE=1` per usare l'app come Node con il nostro asar), `--inspect` e `NODE_OPTIONS` spenti, `OnlyLoadAppFromAsar`, e su macOS la validazione d'integrita' dell'asar (su Windows e Linux electron-builder 25 non scrive l'hash, e il fuse rifiuterebbe il nostro stesso asar). `package.json`: `private`, `license: UNLICENSED`; README: proprietario dalla 0.53, le release precedenti restano MIT
- `yarn build` include l'offuscamento; `DJG_GATE_PREVIEW=1 yarn check:output` fa il gate sull'output **costruito** (bytecode + offuscato) e `DJG_GATE_CMD=<binario> yarn check:output` sull'**app impacchettata** (fuse e integrita' dell'asar compresi). Il gate ha trovato subito che un `await import('fs')` nel main non gira in bytecode (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`): ora e' un import statico, e nel main non ce ne sono altri
- Il tasto `I` e gli altri momentanei non cambiano; la cheat sheet elenca i tasti del beat-roll

### Added
- **S2 — beat-roll.** `,` `.` `/` = un quarto, un ottavo, un sedicesimo di battuta: `Engine.setBeatRoll` fa girare in loop `effectTime` e `beatClock` dal frame che era a schermo. Tenuto e' momentaneo, toccato si blocca, lo stesso tasto lo sblocca. Nessun buffer di frame: gli shader sono funzioni del tempo, le simulazioni (reaction, smoke, swarm) continuano a correre. La finestra di uscita lo riceve con i clock gia' sincronizzati via IPC
- **S5 — idle sul silenzio.** `idle.ts` (puro, `check:idle`): con l'Auto VJ spento, dopo N secondi sotto il noise gate (default 12) l'uscita sfuma in 3 s su un effetto calmo (default Caustics), e quando la musica torna per piu' di 0.6 s rientra in 1.5 s sul look di prima — solo se nessuno l'ha cambiato nel frattempo. Impostazioni nel pannello audio (attivo, secondi, effetto). Con l'Auto VJ acceso non interviene: li' il silenzio e' gia' una pausa
- **Q2 — palette da un'immagine.** `paletteFromImage.ts` (puro, `check:palette`): k-means++ su una miniatura 64×64, sei cluster, il dominante poi i due piu' lontani, scartando neri e bianchi quando c'e' tinta. `palettes.ts`: le tue palette dopo le sedici di fabbrica, **un solo spazio di indici** per griglia, ciclo e telefono (prima il campione "custom" del pannello Effetti occupava l'indice 16: ora e' −1). L'ultimo slot della griglia prende il drop o apre il file; tasto destro rimuove

## [0.52.0-beta] — 2026-10-01

**Il resto della roadmap dello studio: Q5, P4, I6.** I8 verificato e parcheggiato.

### Added
- **Q5 — tonalita' → palette.** `KeyDetector.ts` (puro): croma a 12 classi dallo spettro in byte (55 Hz–4.2 kHz, peso per vicinanza al semitono e per risoluzione del bin), finestra di 8 s, correlazione di Pearson con i profili di Krumhansl-Kessler nelle 24 rotazioni; confidenza = distacco dal secondo. `AudioData.key`, inoltrato dall'Engine all'Auto VJ. Quando la palette cambia (blocco o drop) e la confidenza e' almeno 0.35, e' la palette del genere **piu' vicina alla tonalita' sul cerchio delle quinte** (Do rosso, Sol arancio, Re giallo…; la minore prende la tinta della relativa maggiore), mai quella corrente, con una spinta verso le palette calde per le maggiori e fredde per le minori; le palette grigie non vengono mai scelte dalla tonalita'. Il pannello audio mostra `Key: Am 72%`. `yarn check:key`: scale e triadi sintetiche, silenzio, scelta della palette
- **P4 — scene mie.** `userScenes.ts`: il look corrente (effetto, tutti i parametri curati con i mapping audio/LFO, catena post) salvato come scena di un genere e di una fase, in `localStorage`. Nel pannello Auto VJ: "+ Look corrente come scena" con la fase (default: quella che la macchina sente adesso), la lista delle scene del genere con rimozione, e **"Solo le mie (dove ne ho)"**: per le fasi in cui hai scritto almeno una scena la rotazione e' solo tua, le altre restano di fabbrica. `check:autovj` lo verifica
- **I6 — pixel mapping ArtNet/sACN.** L'Engine ripete il pass master in un render target di `cols×rows` (filtro lineare: ogni LED e' la media della sua pezza di frame, non un texel) e lo legge con `readRenderTargetPixelsAsync` (three 0.170, nessuno stallo), a 1–60 fps. `pixelmap.ts` (puro) taglia in universi da **170 pixel** (510 canali, mai un pixel a cavallo), in alto a sinistra per primo, serpentina opzionale. `sacn.ts` (puro) costruisce il pacchetto **E1.31**: root/framing/DMP, CID fisso, nome sorgente, priorita' 100, sequenza, multicast `239.255.hi.lo:5568`; ArtNet resta per chi lo vuole. Configurazione nel pannello Luci DMX, nello stesso store del DMX cosi' il profilo del posto la porta con se'. `yarn check:pixelmap`: taglio, serpentina, byte del pacchetto, sanitizzazione
- Il TODO per **I8 Ableton Link** riporta la verifica: nessuna implementazione JS pura, i due pacchetti npm sono addon nativi da ricompilare per l'ABI di Electron; resta parcheggiato, I1 MIDI Clock copre la resa

### Changed
- `Engine.onAudioFrame` passa anche la tonalita'; `AutoVJ.update` la legge dal frame

## [0.51.0-beta] — 2026-10-01

**Il beat tracker su musica vera, e le fasi complete.** Chiude S7 e S8 del TODO.

### Fixed
- **Il beat tracker correva a 4/3 del tempo.** Su una demo house a 128 BPM dichiarava 128 e sparava 158 beat al minuto: il 71% degli intervalli era 3/4 di battuta. Causa: il ramo "hard resync" (`onset > 3× mediana` → fase a zero) scattava su ogni stab in sincope, 341 beat su 443. Ora riancora solo a **griglia persa** (nessun beat accettato da 4 battute: una pausa, un cambio traccia), e il prossimo onset forte e' l'ancora — cioe' il drop
- **La griglia resta sul kick.** L'evidenza di controfase e' in banda kick, non a banda piena (uno stab piu' forte del kick la girava); il ribaltamento richiede una serie di tre colpi fuori griglia, non uno; e ogni 16 onset un istogramma di fase in ottavi (`phaseBins`, banda kick) sposta la griglia dove i kick ricorrono davvero — l'anti-fase sapeva solo di mezza battuta, una griglia ancorata su uno stab a un quarto di battuta non vedeva piu' un kick nella finestra di accettazione
- **Il tempo sopravvive alla pausa**: quando la confidenza ACF cala il PLL tiene l'ultimo tempo fidato (`heldBpm`) invece di tornare al rilevamento libero, che sparava su ogni hat (23% dei beat a mezza battuta su un mix tekno)
- Misurato con `check:phases` (istogramma degli intervalli fra beat, in periodi del tempo stimato, dopo l'aggancio): demo house 128 BPM da 21% a **98%** sulla griglia; mix hard tekno da 48% a **87%**; demo 2 da 55% a 76%

### Added
- **S8 — la salita** (`build`), quarta fase dell'Auto VJ: in pausa, energia di almeno 1.6 dB sopra quella d'inizio pausa e ancora niente kick. Scene dedicate per ogni genere, parametri mappati all'energia cosi' crescono con il build (eclipse che si allarga, radar che accelera, veneziana che si apre); il drop dalla salita taglia come dalla pausa. Sul mix tekno la salita compare esattamente nei 20 s prima di ogni drop
- **S7 — spie di fase**: pausa / salita / groove / picco sotto lo spettro del pannello audio, accese dall'`onPhaseChange` dell'Auto VJ (che I4 potra' usare per il reel sul drop)
- `check:beat` misura dopo l'aggancio del tempo, con lo spettro in scala 0..1 come lo passa l'app (la vecchia scala 0..40 metteva il rumore nel tratto ripido di `log1p` e la soglia inseguiva il rumore), e con un test di **sincope**: stab a ogni 3/16, il 100% dei kick deve avere il suo beat e nessun beat fuori dal kick
- `check:phases`: istogramma degli intervalli fra beat, log del tempo ACF ogni 10 s, conteggio dei beat per ramo di accettazione (`anchor / grid / flip / resync / free / recentre`), `--bpm` per simulare il tempo esterno, `--debug <s>` per 8 s di kick, beat e fase

## [0.50.0-beta] — 2026-10-01

**S6 — le fasi tarate su musica vera.** Il rilevatore di v0.49.0 era tarato su una traccia sintetica e su musica vera non funzionava: dieci minuti di mix hard tekno leggevano "picco" dall'inizio alla fine, zero pause, zero drop.

### Fixed
- **Il basso normalizzato e' inchiodato a 1.0 su qualunque traccia masterizzata.** L'analizzatore scala ogni banda contro un unico picco lento dell'intero spettro, e la banda dei bassi sta ben sopra quel picco: `bass` satura e un breakdown e' invisibile. Lo stesso vale per `energy`. Nessuno se n'era accorto perche' gli shader usano `uBass` in somma, non in soglia
- Il rilevatore di fasi ora legge i livelli **grezzi** (`bassRaw`, `energyRaw`: byte/255 dello spettro in dB, mai tagliati), nuovi campi di `AudioData` che `Engine.onAudioFrame` inoltra. Nessun uniform degli shader cambia
- **Il kick e' un'escursione, non un livello**: una pausa spesso tiene il basso e perde solo il transiente. Presenza del kick = escursione (max−min) del basso grezzo lisciato in mezzo secondo: 15–25 dB con il kick, meno di 5 senza. La prima versione usava la rugosita' frame per frame, dominata dal jitter a 60 fps
- Il drop e' un salto del basso grezzo di almeno 0.18 (circa 14 dB) in 50 ms durante una pausa di almeno 4 s; una pausa e' 3.2 s senza kick (un fill dura 1–2 s, un break 8 battute). Picco = energia grezza sopra la sua media lunga di 0.03 (2.4 dB)

### Added
- `yarn check:phases <audio> [--genre] [--cues] [--from] [--to] [--breakKick x] …`: rigioca una registrazione nel rilevatore **senza avviare l'app e senza audio in sala** — ffmpeg, FFT come l'AnalyserNode (Blackman, 2048, smoothing 0.4, −90…−10 dB), stesse bande, `BeatTracker` e `AutoVJ` veri. Stampa le fasi a strisce (2 s per carattere), l'escursione del basso, l'energia sopra la media, e con un file di cue a mano (`1:36 drop`) dice quali ha colto e con quanto ritardo
- Soglie in un oggetto `PHASE` esportato e mutabile, cosi' il tool le spazza da riga di comando
- `BandHits.ts`: la logica degli impulsi per banda (`bassHit`…) estratta da `AudioAnalyzer`, invariata, per riusarla nel tool

### Taratura
- Mix hard tekno di 10 minuti, cue segnate a occhio sull'inviluppo del basso: **3 drop su 3 colti** (+0.8, +1.9, +1.2 s), 2 pause su 3 (la terza con 30 s di ritardo: in quel punto l'escursione e' uguale a quella delle sezioni con kick debole), 1 falso drop. Due demo house: nessuna falsa pausa. Resta da rifare con una registrazione dell'impianto vero, e' il motivo per cui il tool esiste

## [0.49.0-beta] — 2026-09-29

**Auto VJ rifatto: un set, non una slot machine.** Chiude S4 (struttura del pezzo) del TODO.

Prima: tre sacchetti indipendenti (scene, post-FX, palette) pescati a caso ogni N beat, quindi una mezzatinta fotocopiata poteva finire sotto una palette pastello con l'RGB split; `transitionStyle` non era letto da nessuno; e nel breakdown — niente kick, niente beat — scattava un cambio a caso ogni cinque secondi, cioe' proprio quando un VJ sta fermo.

### Added
- **Fasi del pezzo** in `AutoVJ.ts`: l'inviluppo del basso (60–250 Hz, lento) dice se c'e' il kick, quello dell'energia quanto spinge — `break` / `groove` / `peak`, con isteresi e tempo di tenuta. Ogni scena e' scritta per una fase
- **Il drop**: il kick che rientra dopo una pausa taglia la scena **su quel primo kick**, senza dissolvenza (`DROP_CUT`), verso una scena di picco, con una palette nuova. Unico cambio che non aspetta il battere
- **La pausa**: dissolvenza lenta di 2.5 s su una scena di pausa (`BREAK_CUT`) e poi si tiene; la rotazione fra le scene di pausa e' a frase doppia. Il silenzio totale e' una pausa: niente piu' cambi ogni cinque secondi
- **Frasi**: nel groove una scena dura `phraseBars` battute (8 techno, 16 minimal/ambient, 4 DnB/gabber), la meta' al picco, il doppio in pausa; il cambio cade sul battere. Senza beat rilevati la frase avanza al BPM del genere
- **Palette a blocchi**: cambia ogni quattro scene di groove/picco, mai in pausa, sempre sul drop
- **Famiglie visive** (`FAMILY`, una per effetto, `Record<EffectId, Family>` cosi' il compilatore pretende che ogni effetto ne abbia una): due scene della stessa famiglia non si susseguono, un effetto non torna per tre cambi
- **Post-FX per scena**: ogni scena porta i suoi (`flash` senza bloom, `halftone` con la grana, `barcode` con le scanline…); niente piu' combo a caso
- Le dieci tabelle riscritte: 10 generi, 288 scene, ogni scena classificata per fase, con i valori gia' tarati delle vecchie tabelle dove c'erano. Hard Tekno, Gabber e Dark Industrial ora hanno palette bianco/rosso/nero e le sedici scene Tekno distribuite per fase
- `yarn check:autovj`: simula una traccia sintetica a 60 fps e verifica groove sul battere e a frase, pausa lenta e tenuta, drop entro 250 ms con taglio secco e palette, picco a mezza frase, palette ogni quattro, avanzamento senza beat, silenzio come pausa; e che **ogni parametro di ogni scena esista e stia nel range dello slider** (ha trovato subito `starfield.density=0.8` su un massimo di 0.6)

### Changed
- `onSceneChange(scene, cut, phase)`: l'Auto VJ decide come entrare nella scena; `App` applica il taglio e ripristina subito la transizione dell'utente
- La riga di stato dell'Auto VJ mostra la fase (`pausa · groove · picco`); il pannello Pro elenca le scene per fase, la lunghezza di frase e i tagli
- Rimossi `postSets`, `switchBeats`, `transitionStyle`, `energyThreshold` da `GenreConfig`

## [0.48.0-beta] — 2026-09-29

**Tekno.** Sedici visual scuri per una serata in una stanza nera: 46 → 62 effetti.

### Added
- Categoria **Tekno** nel catalogo, con 16 effetti nuovi, tutti a schermo nero e guidati dal kick (`uBassHit`) e dal beat clock, monocromi con un tocco di palette:
  - **Flash** — strobo a blackout: il frame e' nero, il kick lo dipinge di bianco per un istante e la coda decade; una riga di scansione per battuta tiene vivo lo schermo nel buio
  - **Impact** — onde d'urto: ogni beat lascia cadere un anello al centro che si allarga e muore, gli ultimi beat sono ancora in volo
  - **Spiral** — spirale logaritmica bianco/nero, inverte il verso a ogni battuta, il kick ingrassa i bracci
  - **Tribal** — sole tribale a fasce di lame controrotanti, scatta di una lama per beat come un ingranaggio
  - **Xerox** — mezzatinta da volantino fotocopiato: un campo scuro campionato una volta per punto su un retino a 45°
  - **Barcode** — barre verticali rigenerate a ogni beat, tre bande che si strappano sugli hi-hat
  - **Hazard** — corsie di chevron a strisce, verso alternato, un dente in avanti a ogni beat
  - **Counter** — contatore delle battute suonate a sette segmenti, con i segmenti spenti in fantasma e il punto che lampeggia sul beat
  - **Static** — canale morto: neve TV tenuta scura, scorrimento verticale guidato dal basso, righe che strappano sugli hi-hat
  - **Radar** — un giro per battuta, i contatti si accendono al passaggio del fascio e si spengono fino al prossimo
  - **Cage** — due cubi wireframe annidati e controrotanti, solo i bordi brillano
  - **Cracks** — cemento crepato: rete di bordi Voronoi, un impulso di luce per beat corre lungo le crepe dal centro
  - **Bunker** — corridoio di cemento raymarchato, pilastri e travi ripetuti, una lampada davanti alla camera che sfarfalla come un reattore rotto
  - **Rain** — pioggia su nero in tre strati, il basso la fa cadere, il kick e' il lampo
  - **Eclipse** — un disco nero con la sola corona visibile, i raggi si allungano sul basso
  - **Blinds** — veneziana con un faro dietro: si vede solo la luce nelle fessure, che si aprono sul basso
- Le sedici scene sono in rotazione nell'AutoVJ: Hard Tekno e Dark Industrial ne prendono otto ciascuno, Acid Techno e Gabber tre
- Ogni effetto ha 3 parametri curati in `EffectParams.ts`, mappabili ad audio e LFO come gli altri

## [0.47.0-beta] — 2026-09-15

**I5 — piu' uscite.** Uno spettacolo, molti muri.

### Added
- Pannello **Uscite**: fino a 8 finestre di uscita, ognuna con **schermo, risoluzione libera** (anche 1536×256, quella vera del pannello LED), **ritaglio della scena** (tutto, meta', striscia), **gamma** e **tetto** propri. Un muro LED dietro al suo processore e' un display come gli altri: non serve niente di LED-specifico, serve una seconda finestra
- Il ritaglio, la gamma e il tetto vivono nel pass master (`master.frag`), **dopo** il grade: il voto e' lo spettacolo, questi sono il muro
- **Avviso sui pixel totali**: ogni uscita e' un render completo sulla stessa GPU, e 1080p + 4K non li disegna un portatile
- `yarn check:outputs` — 7 controlli sulle regole che proteggono il muro: ritaglio mai vuoto, risoluzione dentro quello che una GPU disegna, archivio modificato a mano che non apre cinquanta finestre
- Prova visiva del ritaglio sotto il gate (`DJG_SELFTEST_SLICE`): il frame tagliato a meta' coincide con la meta' destra della scena intera (0,4/255) contro 6,07 sulla scena piena

### Changed
- In main la finestra di uscita **non e' piu' una sola**: `outputs` e' una mappa, lo stato del motore, l'audio e gli overlay vanno in broadcast, e il display a cui una finestra appartiene e' **per uscita** (era globale: la seconda ereditava lo schermo della prima e finivano sullo stesso muro)
- L'handshake "sto dipingendo" prima usava `ipcMain.once`, che con due uscite veniva consumato dalla prima: ora si riconosce il mittente
- La lista delle uscite ce l'ha il renderer e main ci si adegua (`outputs:set`), invece di aggiungi/rimuovi/aggiorna separati: una modifica applicata a meta' non puo' lasciare una finestra che nessuno traccia
- Il menu risoluzione e il menu schermo della barra in alto scrivono nella **stessa lista** del pannello, non in uno stato loro
- I **Posti** salvano tutte le uscite, non solo il proiettore; i profili salvati prima continuano a caricarsi (il campo vecchio diventa una lista da uno)

### Note
- **Il keystone e' ancora uno solo** e vale per tutte le uscite: con due proiettori storti ne serve uno per finestra (**I7**, prossimo)
- Sync e tearing fra due uscite non si risolvono in Electron: non c'e' genlock, e dirlo e' piu' onesto che prometterlo

## [0.46.1-beta] — 2026-09-15

### Fixed
- **Caricare un posto non cambiava la scheda audio.** Il pannello Audio riparte solo "se non sta girando" (`AudioPanel.tsx`), e in serata sta sempre girando: il posto portava gain, sensibilita' e modo BPM, ma lasciava l'ingresso del locale precedente. La condizione ora e' **"non su quella scheda"**, non "non in funzione" — cosi' l'unica cosa per cui il profilo esiste, da dove entra la musica, e' anche quella che ripristina. Vale pure per il ritorno di una scheda cambiata da fuori il pannello
- `AudioAnalyzer.currentDeviceId`: da `isRunning` non si poteva sapere **su quale** ingresso stesse girando

### Note
- Se sta analizzando un **file** (prova a secco P1) il posto non tocca l'ingresso: strappare il brano sotto al test non e' quello che si chiede caricando un profilo

## [0.46.0-beta] — 2026-09-15

**P2 — profili locale ("Posti").** La seconda serata nello stesso posto torna a un click.

### Added
- Pannello **Posti**: salva con un nome **display e risoluzione di uscita, i 4 angoli del mapping, scheda audio e gain, nodo ArtNet e universo, master**. Non e' un preset dello spettacolo — e' la stanza, l'altra meta' che lo snapshot di sessione non copriva
- Risalvare con lo stesso nome **sostituisce** il posto invece di accodarne un secondo
- `yarn check:venues` — 5 controlli sulle regole che proteggono il proiettore: una risoluzione che non e' una risoluzione, un mapping con meno di 8 valori o un archivio modificato a mano non arrivano mai al motore

### Changed
- Il menu "Output su…" ora **ricorda il display scelto**: prima era `defaultValue=""` e la scelta si perdeva, quindi non c'era niente da salvare
- Le chiavi di archivio di audio e DMX vivono in `venues.ts`: un posto riscrive proprio quegli archivi, e due stringhe uguali in tre file sono due stringhe che divergono

### Note
- Se il display salvato **non e' collegato** stasera, il resto del posto si applica lo stesso e il toast lo dice: spostare l'uscita su un id che non c'e' piu' vuol dire mandare lo spettacolo sul nulla
- Caricare un posto **rimonta** i pannelli Audio e Luci DMX, che leggono il loro archivio all'avvio: e' il modo piu' corto per farglielo rileggere

## [0.45.0-beta] — 2026-09-15

**Q1 — camera master.** Nessun'altra modifica ha questa leva sulla varieta'.

### Added
- **Zoom, rotazione, pan, mosaico a specchio e spinta sulla cassa**, applicati a tutta la scena **prima** della catena post. Ricampiona quello che l'effetto ha disegnato invece di chiedere all'effetto di muoversi, quindi sei cursori agiscono su tutti i 46 effetti di serie e su ogni ISF importato insieme — e nessuno di loro sa che la camera esiste
- Pannello **Camera** nella colonna di destra, piu' MIDI (sei target + azzera), OSC `/djg/cam/zoom|rotation|panx|pany|tile|push|reset` e i cursori sul telefono
- La **rotazione avviene in spazio quadrato**: su un fotogramma 16:9 ruotare direttamente nello spazio UV inclina l'immagine invece di girarla

### Changed
- Fuori dall'inquadratura la camera **specchia**, invece di aggrapparsi al bordo o andare in nero: un bordo sbavato si legge come un difetto e il nero si legge come proiettore rotto, mentre lo specchio si legge come una scelta — ed e' anche quello che fa funzionare il mosaico senza una riga in piu'
- Il pass **non gira affatto** quando la camera e' ferma sull'identita': a riposo non costa niente
- La camera viaggia nello snapshot di stato e la finestra di uscita la applica sulla **propria** risoluzione

### Note
- La camera **non entra nei look**: e' un comando master dal vivo, come la luminosita', e richiamare un look non ti sposta l'inquadratura sotto le mani

## [0.44.0-beta] — 2026-09-15

**S3 — macro Intensità.** Sotto pressione un comando batte cinque cursori.

### Added
- **Un fader solo** alza insieme **velocità**, **reattività**, la **densità** di ogni effetto che ne ha una e il **wet della catena post**, con un peso per parametro (`INTENSITY_WEIGHTS`, dichiarati in un posto solo). Raggiungibile da **tasto I**, MIDI, OSC `/djg/intensity`, telefono e barra in alto
- **Il tasto I segue la regola di S1**: tenuto e' momentaneo, toccato resta
- `yarn check:intensity` — 10 controlli sull'aritmetica, fra cui che ogni peso dichiarato corrisponde davvero a un parametro esistente, che a zero ogni valore torna identico, e che la macro e' monotona e non sfora mai i limiti

### Changed
- La macro agisce **quando i parametri vengono risolti**, e non riscrive mai i valori salvati: mollare il fader restituisce esatta la scena impostata a mano. Una macro che lascia i parametri qualche punto piu' in la' a ogni passata e' peggio che non averla — riscrive una serata di regolazioni, un poco per volta
- I pesi non sono un'euristica sui nomi: sono una tabella esplicita, e un parametro non elencato **non si muove**. Per la soglia il peso e' negativo, perche' li' "piu' intensita'" vuol dire abbassarla
- L'intensita' viaggia nello snapshot di stato: la finestra di uscita risolve i parametri per conto suo, e senza non mostrerebbe la spinta

## [0.43.0-beta] — 2026-09-15

**S1 — FX momentanei.** "Ho acceso lo strobe e me lo sono dimenticato" e' il
modo classico di rovinare una stanza.

### Added
- **Un tocco breve lascia acceso, tenere premuto e mollare torna com'era.** Sotto i 250 ms e' un tocco e si comporta come prima; oltre, al rilascio si annulla. Vale per **blackout**, **freeze**, i **post-FX** su QWER, gli **effetti** 1-0, i **look** su Shift+1-0, i **pad MIDI** e il **dito sul telefono**
- Niente seconda fila di comandi e nessuna modalita' da ricordare al buio: decide il tasto, in base a quanto lo tieni. Una pressione nervosa non puo' lasciare niente appeso
- `yarn check:momentary` — 7 controlli sulla soglia: tocco, pressione lunga, due tasti insieme, ripetizione automatica, doppio rilascio, perdita di fuoco

### Fixed
- **Il note-off MIDI veniva ignorato del tutto**: tenere un pad e mollarlo lasciava tutto acceso. Adesso rilascia, e anche un CC usato come pulsante rilascia quando riscende sotto meta' corsa
- Un `keyup` che non arriva mai — la finestra perde il fuoco mentre tieni un tasto — lasciava il tasto logicamente premuto per sempre e la pressione successiva veniva scartata come ripetizione

### Changed
- L'annullamento e' **catturato alla pressione**, non dedotto: un look tenuto torna al look che c'era a schermo, che non e' la stessa cosa che richiamarne un altro
- Sul telefono i look e i post-FX rispondono a `pointerdown`/`pointerup` invece che al click
- La ripetizione automatica non rifa' piu' partire una scorciatoia: tenere premuto **B** non fa lampeggiare il blackout

## [0.42.0-beta] — 2026-09-15

**P1 — prova a secco con un file audio.** Tutto il lavoro su beat, BPM ed
envelope era verificabile **solo in serata**, perche' l'analisi apriva il
microfono e basta. Adesso analizza anche un file, e un file si riavvolge.

### Added
- **Trascina un brano sul pannello audio** (o "Prova a secco con un file…") e l'app lo analizza al posto dell'ingresso: play/pausa, scorrimento, ripetizione, durata. Lo senti anche in cuffia — e' una prova, non una misura
- `yarn check:dryrun` — **genera** un brano di 30s a un tempo noto, lo fa analizzare all'app e verifica quello che ne esce: tempo, numero di battiti ed energia. Provato a 128 e a 174 BPM, entrambi letti esatti. Il wav non sta nel repo: due megabyte committati per verificare un numero sono un cattivo scambio, e generarlo tiene il segnale e il tempo atteso nello stesso posto
- `scripts/check-dryrun.py mio.wav` accetta anche un file tuo (riporta e basta, senza attese sul tempo)

### Fixed
- **Chromium sospende un AudioContext creato senza un click**, e un contesto sospeso da all'analisi silenzio mentre l'elemento audio continua a suonare: si legge esattamente come "il rilevamento del beat e' rotto". Ora l'app dichiara `autoplay-policy: no-user-gesture-required` — qui il proiettore *e'* il prodotto, non una pagina web che deve stare zitta finche' non la tocchi
- L'errore del microfono restava a schermo mentre suonava un file: l'analisi sta girando, solo non sull'ingresso

### Changed
- Il grafo audio (gain → analyser → libreria BPM) e' scritto una volta sola e condiviso fra ingresso e file
- Lo scorrimento nel brano **azzera la stima del tempo**: quello che l'analisi ha sentito prima del salto non e' quello che suona dopo
- Una sorgente-file non fa scattare la riconnessione automatica: non c'e' nessun dispositivo che possa tornare

## [0.41.0-beta] — 2026-09-15

**I1 — MIDI Clock in ingresso.** Il tempo che il mixer gia' conosce.

### Added
- **Modalita' BPM `MIDI`**: tempo e posizione nella battuta arrivano dal MIDI clock (24 tick per movimento) invece che da flusso spettrale, autocorrelazione e PLL. Gestiti anche **Start**, **Stop**, **Continue** e il **puntatore di posizione**, che dice in che punto della battuta siamo
- Funziona **senza audio in ingresso**: un cavo MIDI e nessun line-in e' un modo vero di lavorare, e tutto cio' che e' guidato dal beat continua a girare
- Il pannello audio dice cosa sta facendo il clock — agganciato, fermo, mai arrivato — e se un clock arriva mentre sei in un'altra modalita' te lo segnala
- `yarn check:midiclock` — 14 controlli su un transport sintetico: tempo a 92/128/174, fase sul battito e a meta' battito, fase che scorre fra un tick e l'altro, Start come downbeat, battito segnalato una volta sola, quattro movimenti per battuta, puntatore di posizione, Stop/Continue, clock che sparisce, messaggio in ritardo, buco nel cavo

### Fixed
- **Il MIDI clock veniva buttato via prima di essere guardato.** `midi.ts` scartava ogni messaggio con `data.length < 2`, e il clock e' un messaggio da **un byte solo**

### Changed
- Il clock **non** alimenta il PLL di `BeatTracker`: una griglia esatta non va tirata del 35% verso quello che hanno appena fatto gli hi-hat. Quando il clock e' agganciato possiede la fase, e il tracker continua a fare il lavoro che solo lui puo' fare, gli onset per banda
- Un clock che si ferma **tiene l'ultimo tempo ricevuto** invece di far ricadere le visuali su 128

## [0.40.0-beta] — 2026-09-14

Fase V del redesign: **il contro-audit**. Stessa rubrica di
`DESIGN-IS-2026-09-14/02-scorecard.md`, stesse regole (in dubbio il punteggio
piu' basso, si giudica l'istanza peggiore). **Da 11/30 a 21/30**, nessun
principio a 0: il verdetto passa da REDESIGN a REFINE. Il documento sta in
`DESIGN-IS-2026-09-14/05-controaudit.md`, con le misure prima/dopo e le
undici affordance ripetute una per una.

### Changed
- **Un sistema visivo solo.** Zero `font-size` letterali: le tre dimensioni che l'interfaccia rende davvero e che non avevano un nome ora ce l'hanno (`--fs-2xs`, `--fs-xl`, `--fs-2xl`, `--fs-icon`). Due soli colori ad-hoc rimasti (`#000` e `#fff`): tutto il resto e' un token, comprese le sei tinte delle bande audio, che erano un secondo sistema di colore scritto a mano in due selettori ciascuna. Spariti i `var(--bg2, #16161c)` con la scorciatoia gia' scaduta rispetto al token che coprivano
- **Tre implementazioni della riga "etichetta · cursore · numero" diventano una** (`<SliderRow>`, 11 punti d'uso). Erano tre markup con **due larghezze di etichetta diverse**: lo stesso controllo era 74px di etichetta in un pannello e 52px in un altro, sullo stesso schermo
- Il confine fra i **quattro modi di dire qualcosa all'utente** e' scritto in `Toasts.tsx`: non sono duplicati, sono quattro lavori diversi, e un evento passato non e' mai un banner

### Removed
- **La texture a scanline.** Decorazione a `z-index: 2147483647` sopra ogni pixel dell'app, testo compreso. L'audit la citava due volte: come cromo che compete col contenuto e come l'unico marcatore datato in un linguaggio visivo altrimenti senza tempo

### Fixed
- **I numeri dei parametri erano tagliati**: `1.00` si leggeva `1.`. Il campo numerico stava accanto a un cursore `flex: 1` e veniva compresso sotto la sua stessa larghezza. Sistemato quello, il cursore a sua volta non voleva stringersi — un `input[type=range]` ha una larghezza minima intrinseca di ~129px — e spingeva il numero **fuori** dalla colonna da 260px
- `check:ui` rimette a posto la modalita' quando ha finito di contare i controlli: contava cliccando, e cliccare una modalita' la salva

### Added
- `DESIGN-IS-2026-09-14/05-controaudit.md`

## [0.39.1-beta] — 2026-09-14

### Added
- **`yarn check:ui` — una fotografia della finestra di controllo.** Il gate di release guarda il proiettore: dimostra che il motore e' vivo e non dice niente dell'interfaccia, che e' la meta' che un refactor di CSS rompe in silenzio, nell'unica finestra che nessuno fotografa. Riusa lo stesso avvio del gate, quindi costa un avvio solo. `check:ui simple 0.34` apre in una modalita' e rimpicciolisce quanto serve per far stare un'intera colonna nell'inquadratura

### Fixed
- **Le righe di elenco leggevano dal centro.** Il testo di un pulsante il browser lo centra, e `.row-item` non ha mai detto il contrario: ogni riga con interruttore aveva il titolo in mezzo e l'interruttore isolato a sinistra. Trovato fotografando, non leggendo

## [0.39.0-beta] — 2026-09-14

Fase A4 del redesign: **una superficie sola**. Non tre alberi di
componenti, non cinque modi di piegare un pannello, non venticinque modi
di disegnare un pulsante, non tredici porte sul salvataggio.

### Changed
- **Venticinque trattamenti di pulsante diventano quattro.** `.btn` esisteva come sistema e quasi nessuno lo usava: ogni pulsante si portava la sua classe, quasi tutte a ridichiarare le stesse quattro righe che `.btn` e la regola base `button` gia' dicevano. Ora sono `.btn` piu' una variante. Sei regole per un pulsante senza superficie (`.tiny-btn`, `.media-remove`, `.media-device-cancel`, `.look-del`, `.look-edit`, `.toast-undo`) diventano `.btn-ghost`. I quattro che restano sono il vocabolario: `.panel-header`, `.pill`, `.tab`, `.row-item`
- **Tre modi di piegare un pannello diventano uno.** Sei pannelli usavano `usePanelCollapsed`, tre un `useState` locale con un'intestazione identica ma senza persistenza, e due avevano un `<details>` dentro. I tre locali dimenticavano tutto a ogni riavvio e non partecipavano alla fisarmonica: la stessa intestazione, cliccata in due punti, faceva due cose diverse. Ora tutti montano `<Panel>`, e **Ingresso audio, Look Bank e Auto VJ ricordano** se erano aperti
- **Tre griglie di palette diventano una.** Le stesse sedici in tre markup — col nome sotto, piccole e sbiadite nel ciclo, grandi in modalita' Semplice
- **Due Auto VJ diventano uno.** Semplice aveva un pulsante grande e un `<select>` di soli nomi; il pannello aveva un toggle e **dieci** pulsanti di genere con le descrizioni che il select non aveva. Ora e' un controllo solo, e le descrizioni stanno nel select: Pro spende **un** controllo dove ne spendeva dieci
- **Il contatore FPS misurava la finestra sbagliata.** Girava su una seconda catena rAF tutta sua, accanto a quella del motore, quindi contava i frame del renderer e non quelli del motore — che e' esattamente la differenza che conta quando il motore arranca. Ora conta i frame del motore, e la catena e' una sola
- `GENRES` entra nel catalogo accanto a `EFFECT_CATEGORIES`, `COLOR_PRESETS` e `TRANSITIONS`

### Fixed
- **I parametri dello shader personalizzato comparivano due volte.** In Pro i due pannelli sono a schermo insieme e montavano entrambi `ParamControls`, che legge la stessa lista: due cursori per ogni parametro, in due pannelli, sullo stesso valore
- **Un byte sbagliato nel salvataggio cancellava i look per sempre.** L'errore di parsing tornava la lista vuota e il salvataggio successivo **sovrascriveva** il valore corrotto, senza toast e senza log. Ora un valore illeggibile viene spostato in `<chiave>.rotto` prima di rispondere, e resta li' da recuperare
- **`loadLooks()` troncava a 16 slot a ogni lettura**: un banco cresciuto perdeva gli slot in piu' alla prima lettura+salvataggio. Ora riempie, non taglia
- **La quota esaurita era muta.** Tredici chiavi con tredici `catch {}`: chi scriveva non sapeva se aveva scritto. Ora la scrittura risponde, e il primo fallimento lo dice

### Added
- `src/renderer/storage.ts` — una porta sola su `localStorage`, con **una versione di schema**: prima nessuna chiave ne aveva una
- `yarn check:storage` — 10 controlli che fanno girare il modulo vero su un `localStorage` finto caricato con un dump di 0.35: giro completo, quarantena, cache buttata, scritture fallite, slot riempiti, versione

## [0.38.0-beta] — 2026-09-14

Fase A3 del redesign: **una lingua sola, e smettere di dichiarare cose
non vere**.

### Fixed
- **Il salvataggio diceva di essere riuscito prima di provarci.** `setPresets()` girava **prima** della scrittura su disco, dentro un `try/catch`: a quota esaurita il preset compariva nell'elenco come salvato mentre su disco non arrivava niente, e l'utente lo scopriva al lancio successivo. Il commento nel codice lo diceva gia'. Ora si scrive prima e si mostra dopo — preset, scalette e look
- **Un look perso restava perso in silenzio.** `persistLooks()` inghiottiva l'eccezione senza toast, senza log, senza niente, mentre i preset almeno avvisavano
- **"8 look di fabbrica" era una promessa che l'app non poteva mantenere.** `seedFactoryLooks()` aveva un solo chiamante: il pulsante finale INIZIA. Premendo **Salta** il Look Bank restava vuoto per sempre — il wizard non torna piu' — mentre la guida rapida continuava a prometterli. Ora semina ogni uscita dal wizard
- **Smart map riscriveva i valori, non solo le mappature**: ogni parametro sopra il 65% della corsa veniva tirato al 35%. Ora l'etichetta lo dice, e il pulsante si chiama "Collega all'audio"
- **`×½` e `×2` facevano uscire da Auto in silenzio**, fermando il rilevamento del BPM per tutto il resto del set
- **Sovrascrivere un look era l'unico percorso distruttivo senza rete**, mentre *cancellare* un look l'annulla ce l'aveva da sempre. Ora ce l'hanno anche preset, scalette e sovrascrittura
- **La libreria media diceva "Rimosso dalla libreria" con lo stesso identico testo** per le immagini, che si recuperano, e per i video, che vengono cancellati dal disco: non si poteva sapere quale cancellazione fosse reversibile. Ora i due casi dicono cose diverse e quello irreversibile chiede conferma

### Changed
- **Tradotte le 91 etichette di parametro.** Sono il vero problema di comprensione: `Falloff`, `Feed`, `Kill`, `Sheen`, `Shell`, `Piste`, `Stutter` non sono indovinabili, e sono i cursori che si toccano di piu'. Qualche scelta: `Gates` → `Porte` (sono le porte dello slalom), `Table` → `Tabellina` (e' la tavola pitagorica del string art), `Feed`/`Kill` → `Nutrimento`/`Consumo`, che si tengono in coppia come nell'originale
- Tradotte le 16 palette, i termini di correzione colore e le sorgenti audio. **NON tradotti** i 46 nomi di effetto e i 9 post-FX: sono nomi, arrivano con un'icona e una miniatura dal vivo, e tradurre `Matrix` o `PS2` sarebbe peggio
- **Le cinque transizioni avevano due nomi diversi** nei due pannelli che le mostrano, con `crossfade` lasciato inglese pure nel gruppo italiano. Ora stanno nel catalogo, una volta sola
- **Le velocita' LFO erano `1/4 1/2 1 2 4 8 16 32` senza che l'unita' fosse scritta da nessuna parte.** Ora l'etichetta dice "Ogni · battute" e ogni pulsante ha il suo tooltip
- La colonna delle etichette di parametro era larga 56px e tagliava gia' "Turbulence" e "Iterations" prima di qualunque traduzione
- Stato di caricamento sui due import di media, che sono il percorso lento visibile

## [0.37.0-beta] — 2026-09-14

Fase A2 del redesign: **l'app si guida da tastiera**. Trenta elementi
cliccabili erano `<div onClick>` — niente ruolo, niente stato premuto,
niente attivazione da tastiera — e da quella singola scelta strutturale
discendevano tre voti bassi dell'audit insieme.

### Fixed
- **Salvare un look e accendere l'AutoVJ non avevano NESSUNA strada da tastiera.** Erano le due azioni che l'audit ha trovato irraggiungibili sia da hotkey sia da tab. Ora sono pulsanti
- **Un pannello chiuso era chiuso per sempre.** Le 9 intestazioni erano `div`, e un pannello chiuso **smonta i figli**: l'intestazione che lo riaprirebbe non era raggiungibile. Ora sono pulsanti con `aria-expanded`
- **`Space` con un pulsante a fuoco batteva il BPM invece di premerlo.** La guardia sulle hotkey non escludeva `<button>`, e il tap chiama `preventDefault()`. Al buio, tabulare fino a PANIC e premere Spazio non faceva panic. Stesso buco sul `div tabIndex` di `NumberInput`, dove — usandolo nel modo documentato — una cifra cambiava l'effetto in diretta e `B` faceva il blackout. La guardia era scritta due volte con gli stessi tre buchi: ora sta in `src/renderer/hotkeys.ts`
- **L'editor GLSL era una trappola.** Intercettava `Tab` senza controllare `shiftKey`, quindi `Tab` e `Shift+Tab` inserivano entrambi spazi, e non c'era `Escape`: entrato il focus, si usciva solo col mouse. Ora `Shift+Tab` esce
- **Cinque post-FX su nove** non si potevano accendere da tastiera: la riga della lista era un `div`
- **Le azioni sullo slot del Look Bank erano `display: none` fino a `:hover`**, quindi fuori dall'ordine di tabulazione: senza mouse non esistevano. Ora sono nascoste con `opacity` e si rivelano anche su `:focus-within`
- **`RemoteModal`, `HelpMenu` e `Onboarding` non avevano nessun gestore di `Escape`**; la cheat sheet si chiudeva cliccandoci **dentro**, per uno `stopPropagation` mancante
- `textarea` mancava dalla lista del `:focus-visible`; tre `outline: none` non avevano sostituto, fra cui quello inline di `NumberInput` che vinceva sulla regola globale perche' quella non e' `!important`
- **I toast non erano annunciati** (`role="status"`, `aria-live`), pur essendo l'unico riscontro dei comandi che arrivano da telefono, OSC e MIDI

### Changed
- Cliccabili non-`<button>`: **da 30 a 11**. Gli undici che restano sono legittimi: dieci fondali di modale — cliccare fuori e' una comodita' del mouse, non l'unica uscita, ora che tutti e cinque rispondono a `Escape` — e il doppio-click di `NumberInput`, che ha il suo gemello in `Invio`
- **Rinominare un look passa da doppio-click a un pulsante ✎.** Il doppio-click non ha un equivalente da tastiera, e tenerlo *in piu'* sarebbe stata la duplicazione che l'audit penalizza. Guida rapida e scorciatoie aggiornate
- 14 pulsanti di sola icona o solo glifo hanno un nome accessibile: avevano solo `title`, che e' la fonte piu' debole e inesistente al tocco, mentre ogni SVG e' `aria-hidden`. Etichettati **soltanto** quelli senza testo visibile: un `aria-label` diverso dal nome visibile viola WCAG 2.5.3

### Added
- **`yarn check:buttons`**: conta i trattamenti di pulsante distinti. Il numero vero e' **25 autonomi contro 2 costruiti su `.btn`** — il sistema esiste e non lo usa quasi nessuno. Unirli e' una decisione di superficie e passa alla fase A4; intanto il controllo e' una cricca, il numero puo' solo scendere

## [0.36.0-beta] — 2026-09-14

Prima fase del redesign dell'interfaccia (fase A1 di `plans/`), nata
dall'audit sui dieci principi di Dieter Rams in `DESIGN-IS-2026-09-14/`:
11/30, verdetto REDESIGN, zero sul principio "meno design possibile" per
affordance duplicate.

### Added
- **I toast dicono se e' andata bene o male.** `.toast` aveva lo stesso bordo verde per ogni esito e `pushToast()` non accettava nemmeno una severita': un preset salvato e uno **non** salvato per quota esaurita davano lo stesso messaggio verde. Ora il default e' neutro, il verde e' riservato a cio' che e' riuscito, il rosso a cio' che non e' riuscito. Tredici chiamanti etichettati
- **`yarn check:contrast`**: legge i token da `global.css`, segue un livello di alias `var()`, compone i colori traslucidi sul fondo reale e calcola i rapporti WCAG. Riproduce i numeri dell'audit sui valori vecchi, che e' il motivo per cui gli si puo' credere sui nuovi

### Changed
- **Il deck B espone tutti e 46 gli effetti.** Aveva un elenco di 21 scritto a mano che divergeva dal catalogo vero: **25 effetti non si potevano mettere sul deck B**, e non c'era modo di accorgersene se non cercandoli. I tre cataloghi (effetti, post-FX, palette) escono dal pannello che li disegna e vanno in `src/renderer/catalog.ts`, con le ricerche derivate; il telecomando prende le sue etichette dalla stessa fonte invece di riscriverle
- **Niente piu' identificatori interni a schermo**: il banner dell'effetto attivo, le righe della catena post-FX e il selettore del deck B mostravano `rgb-split`, `tunnel`, `filmgrain`. Ora mostrano il nome
- **Una griglia di effetti sola.** Il pannello Pro disegnava i 46 effetti con `.fx-btn`, quello Simple gli stessi 46 con `.simple-fx`: due alberi di markup, due famiglie di classi, e due nomi a una lettera di distanza (`.fx-ico` contro `.fx-icon`). Erano gia' divergenti — solo una mostrava le miniature dal vivo. Ora c'e' `<EffectGrid>` con una prop per la densita'
- **La scala di spaziatura diventa quella che l'app usa davvero.** Era dichiarata 4/8/12/16/24/32 con `--s4` e `--s6` senza un solo riferimento, mentre `6px` compariva 51 volte — piu' di qualunque token. Ribasata su 2px; gli usi esistenti rimappati preservando il pixel reso, quindi a schermo non cambia niente; 86 letterali convertiti, i riferimenti passano da 52 a 138
- Via il codice morto che il tsconfig non segnalava (`noUnusedLocals` non e' attivo): le prop `label` e `width` di `NumberInput`, mai passate da nessuno degli 8 chiamanti; l'icona `IconPanic`, esportata e mai usata; quattro alias di colore senza riferimenti

### Fixed
- **Il testo dei suggerimenti non si leggeva.** `--text-muted` stava a **2,63:1** su `--bg3` e non superava 3,15:1 su nessuna superficie, mentre lo ereditano **32 classi**, tutte testo normale fra 11 e 15px: in questa interfaccia niente e' "testo grande", quindi vale 4,5:1 per tutto. Ora 4,67–5,59
- **L'anello di focus stava a 2,62:1**, sotto la soglia di 3:1 per i bordi dei componenti. E' l'unica cosa che dice dove sei quando navighi da tastiera, in una stanza buia. Ora 5,84–6,45
- Un toast nominava un concetto che nell'interfaccia non esiste: "playlist" dove il pannello dice "scaletta"

## [0.35.0-beta] — 2026-09-14

Otto effetti nuovi: 38 → 46.

### Added
- **Spectrum** (Digitali) — l'analizzatore per quello che e'. Barre logaritmiche da `uSpectrum` con i cappelli di picco, specchiate sulla mediana, e la traccia dell'oscilloscopio sopra. Tutto il resto nell'app reagisce a cinque numeri; questo mostra tutti i 512 bin. A segnale assente le barre restano vive su uno sweep basso: un analizzatore muto e' uno schermo nero onesto e un visual inutile
- **Smoke** (Organici) — pennacchio ad **advezione semi-lagrangiana**: ogni texel chiede dov'era il suo fumo un passo fa e copia da li'. All'indietro, non in avanti — spingere la densita' in avanti vorrebbe scatter, che un fragment shader non sa fare. Velocita' = galleggiamento + due ottave di curl; tre bocchette sul fondo, ognuna alimentata dalla sua banda di spettro, e il kick le spara
- **Caustics** (Organici) — il loop classico delle caustiche: un punto viene spostato di continuo dal campo in cui si trova, e si accumula la distanza reciproca alle linee coordinate piegate. La potenza finale e' l'effetto: senza, e' plasma
- **Gyroid** (Digitali) — la superficie minima `sin(x)cos(y)+sin(y)cos(z)+sin(z)cos(x)` raymarchata e ridotta a parete sottile, con un tunnel scavato lungo il percorso della camera. Senza il tunnel la camera passa la maggior parte del tempo **dentro** la parete e il frame diventa un colore piatto — la stessa trappola gia' vista con Lattice
- **Truchet** (Geometrici) — piastrelle di Truchet: ogni cella tiene uno di due archi e la scelta si ribalta sul beat. Le curve continue escono da un lancio di moneta per cella; nessuno disegna un percorso, i percorsi emergono
- **Quasicrystal** (Geometrici) — N onde piane a angoli equispaziati, sommate: da cinque in su il risultato ha simmetria rotazionale e non si ripete mai. Le frange vengono da un seno applicato alla somma, altrimenti le onde coprono due periodi scarsi e resta una macchia
- **String art** (Geometrici) — tavola pitagorica su un cerchio: il nodo i si unisce al nodo (i·m) mod N. Mentre m deriva le corde spazzano cardioide, nefroide e oltre; la forma e' l'inviluppo, nessuna curva viene mai disegnata
- **ASCII** (Digitali) — un campo procedurale campionato una volta per cella e stampato con il glifo la cui copertura d'inchiostro corrisponde alla luminosita'. I glifi sono bitmap 5x5 impacchettate in float, quindi sembra un terminale invece del solito mosaico a blocchi
- Tutti e otto sono in rotazione nell'AutoVJ, distribuiti per genere

## [0.34.0-beta] — 2026-09-14

Il pezzo che mancava dello sblocco multi-pass: adesso ce l'hanno anche gli
shader che scrivi tu e quelli che importi.

### Added
- **Shader custom multi-pass**. I pass si separano **dentro il sorgente**, con righe marcatore, cosi' uno shader custom resta una stringa sola e preset, snapshot IPC verso il proiettore ed editor continuano a funzionare senza toccare niente:
  ```glsl
  // quello che sta qui sopra e' condiviso da tutti i pass
  //!DJG_BUFFER A
  void main() { /* scrive il buffer A, e con tBufferA rilegge il frame prima */ }
  //!DJG_MAIN
  void main() { /* il pass visibile */ }
  ```
  Se dichiari solo buffer, viene aggiunto un blit dell'ultimo: qualcosa deve arrivare sullo schermo. **Tutti i pass vengono compilati e validati prima di sostituire quello che c'era**: un buffer rotto non deve lasciare il proiettore a metà
- **ISF multi-pass**: cade il rifiuto `'ISF multi-pass non supportato'`. Il corpo viene emesso una volta per pass con il suo `PASSINDEX` — e' esattamente cosi' che uno shader ISF distingue i pass — e ogni `TARGET` viene aliasato sull'uniform che l'engine collega davvero. I filtri (`inputImage`) restano rifiutati, con la ragione
- **Import Shadertoy** (`ShadertoyLoader.ts`, bottone nell'editor). Accetta due cose, perche' due sono tutto quello che esiste: il GLSL con `mainImage` (un pass, quello che ti da' un copia-incolla dal sito) oppure il **JSON dell'API**, che e' l'unico modo di portarsi dietro i **Buffer A-D**. I buffer diventano buffer dell'engine in ordine, `iChannelN` viene collegato a quello che quel pass legge davvero, il codice `common` finisce in tutti i pass, e un canale texture diventa un'immagine che scegli tu. `iResolution` e `iMouse` sono `#define`: GLSL ES vieta di inizializzare un globale da una uniform, e senza mouse la posizione deriva lenta in una Lissajous
- **`yarn check:loaders`**: 11 controlli sui due importatori e sullo splitter dei pass. Un parser che produce GLSL *quasi* giusto non si vede finche' non e' un proiettore nero dieci minuti dopo
- `scripts/check-output.py` accetta anche un **file shader**: `python3 scripts/check-output.py scripts/fixtures/trail.multipass.frag` verifica un multi-pass custom sul proiettore vero. La fixture e' una scia che decade, quindi un buffer che in realta' non e' persistente lascia un puntino solo e fa fallire il gate

### Changed
- `splitCustomPasses()` vive in `src/engine/customPasses.ts`: e' logica pura e va provata senza tirarsi dietro three
- Un'immagine assegnata a uno shader custom arriva anche ai suoi pass di buffer, non solo a quello visibile

## [0.33.0-beta] — 2026-09-14

Terzo e ultimo passo: un effetto non e' piu' obbligato a essere un quad.

### Added
- **Effetti a geometria**: un effetto puo' dichiarare un `build(uniforms)` che restituisce il materiale con gli uniform dell'effetto (audio, palette, parametri e transizioni continuano a funzionare come sempre) e l'oggetto da disegnare — nuvole di punti, mesh istanziate, modelli caricati
  - Tutto cio' che disegna un effetto passa ora per `renderEffect()`: pass di simulazione, poi il quad oppure la scena dell'effetto. Il target di un effetto a geometria viene pulito, perche' la geometria lascia buchi dove un quad fullscreen avrebbe riscritto ogni pixel
- **Swarm** (Movimento), il primo: **36.864 particelle** la cui posizione e velocita' vivono in un buffer di simulazione half-float (lo sblocco precedente) e vengono lette dal **vertex shader**, indicizzate con `gl_VertexID`. La CPU non tocca un vertice e il numero di particelle non costa niente per frame
  - Il campo e' curl + gradiente di rumore: il curl fa girare, il gradiente fa ammassare. Solo curl e' a divergenza nulla e 36k particelle diventano polvere uniforme; la struttura — vortici e filamenti — viene dalla parte di gradiente
  - Vite finite e sfalsate: le particelle rinascono su un disco il cui raggio segue la banda di spettro assegnata a ciascuna. Senza, lo sciame diffonde finche' copre il frame in modo uniforme e smette di sembrare uno sciame
  - Il kick le spara in fuori, i medi decidono quanto il campo ammassa, l'energia quanto e' veloce. Parametri Turbulence, Drag, Burst, Dots
  - In rotazione nell'AutoVJ di drum-n-bass, psytrance e minimal-hypnotic
- I buffer di simulazione possono essere **point-sampled** (`nearest`). Obbligatorio quando i texel sono dati e non un'immagine: con il filtro lineare un campione al centro di un texel puo' comunque mescolare il vicino, e un valore sbagliato si propaga a tutta la griglia un frame alla volta

### Changed
- `scripts/shader-preview.py` disegna anche gli effetti a geometria: se esiste `<effetto>.vert` costruisce la nuvola di punti, la compone in additivo dentro un buffer float e fa **un solo passaggio di tone mapping alla fine**, come lo stadio master dell'app (tonemappare ogni sprite slava tutto lo sciame). `DJG_W`/`DJG_H` scelgono la risoluzione: la densita' di un sistema particellare e' il suo aspetto, e a 960x540 si giudica male quello che esce a 1080p

### Fixed
- **Swarm era invisibile a sala muta** e lo ha detto solo il proiettore: l'ampiezza del campo e la dimensione degli sprite erano quasi tutte moltiplicate per l'energia audio, quindi senza musica lo sciame stava fermo e minuscolo. Ora l'audio si somma a un pavimento invece di esserne l'unico termine
- La dimensione degli sprite scala con la **radice** della risoluzione, non con la risoluzione: la luminosita' di uno sprite va con l'area, e a risoluzione dimezzata lo sciame diventava quattro volte piu' scuro

## [0.32.0-beta] — 2026-09-14

Secondo dei tre passi: un effetto non e' piu' obbligato a essere un solo pass.

### Added
- **Effetti multi-pass con buffer persistenti**. Un effetto puo' dichiarare dei pass di simulazione che girano prima di quello visibile, ognuno con il suo buffer ping-pong: lo shader rilegge quello che ha scritto al frame precedente. E' la cosa che serve a reaction-diffusion, fluidi, automi cellulari e in generale a ogni simulazione, ed e' strutturalmente impossibile con un solo pass fullscreen (il post-FX `feedback` e' globale, non per effetto)
  - Il pass visibile (`main`) resta un effetto normale: transizioni, deck B e parametri funzionano senza modifiche
  - Ogni pass riceve `tBuffer<nome>` e `uBuffer<nome>Size` per ogni buffer, piu' `uFrame` (0 al primo frame di quell'istanza, serve per il seed)
  - Il buffer viene scambiato **subito dopo il pass che lo scrive**: elencare lo stesso pass N volte esegue N iterazioni vere. Gray-Scott a un passo per frame striscia; React ne fa otto
  - Buffer in **half-float**: una simulazione che si rialimenta attraverso target a 8 bit quantizza un po' a ogni frame e l'errore si accumula finche' il pattern muore
  - La dimensione si dichiara con `rows` (altezza fissa in texel, larghezza dall'aspect dell'uscita) invece che con una frazione dello schermo: la scala delle forme di una reaction-diffusion la decide la griglia, quindi su un proiettore piu' grande lo stesso effetto non sembrerebbe piu' se stesso
  - I buffer appartengono al **materiale** dell'effetto, non all'engine: l'effetto uscente continua a simulare durante una transizione e il deck B ha la sua copia
- **React** (Organici), la prima simulazione: Gray-Scott. Membrane che crescono, si dividono e si riorganizzano; medi e alti spostano il punto feed/kill (corallo → vermi → macchie) e **il kick inietta** reagente in tre punti che cambiano a ogni battuta. Parametri Feed, Kill, Inject. In rotazione nell'AutoVJ di acid-techno, psytrance e ambient

### Changed
- `scripts/shader-preview.py` riscritto: se esiste `<effetto>.sim.frag` lo tratta come pass di simulazione e lo ping-ponga in un buffer half-float per `t*60` frame prima di disegnare il pass visibile, come fa l'Engine. Senza, un effetto multi-pass si poteva solo guardare dentro l'app
- `scripts/check-output.py` accetta un effetto: `yarn check:output` oppure `python3 scripts/check-output.py reaction` fissa quell'effetto sul proiettore invece di verificare quello che c'era salvato. L'id arriva al renderer leggendo l'ambiente nel preload — via IPC arrivava prima che React montasse, e non lo riceveva nessuno
- `scripts/audit-shaders.py` leggeva gli id degli effetti con un'indentazione qualsiasi, e una voce multi-pass gli faceva scambiare per effetti anche le sue chiavi annidate
- Il battito di salute del proiettore riporta i buffer di simulazione dell'effetto attivo (`sim=A:640x360@f283`). Una simulazione che gira in silenzio sulla griglia sbagliata sembra un altro effetto, e nel log non ci sarebbe stato niente a dirlo

### Fixed
- **React nasceva da un seme troppo piccolo**: trovato dal gate, non a occhio. La simulazione girava ma partiva da una macchia al centro e ci metteva quasi un minuto a coprire il proiettore. Ora il seme e' sparso su tutto il frame e l'immagine e' piena in un secondo

## [0.31.0-beta] — 2026-09-14

Primo dei tre passi verso grafiche piu' complesse: gli shader non vedevano
l'audio, ne vedevano cinque numeri. Ora vedono lo spettro.

### Added
- **`uSpectrum`**: lo spettro audio come texture disponibile a ogni shader (inclusi quelli scritti nell'editor e gli ISF importati). Una riga, 512 texel, filtrata lineare — `texture2D(uSpectrum, vec2(u, 0.5))`
  - `.r` = magnitudine, con **u logaritmico**: `u=0` e' 20Hz, `u=1` e' 20kHz. I bin lineari sprecherebbero nove decimi della larghezza su frequenze che nessun pezzo usa e schiaccerebbero tutto il basso nei primi texel; il pack mappa per ottave e prende il **massimo** di ogni intervallo, cosi' un picco stretto sopravvive invece di essere mediato via
  - `.g` = campione nel tempo, centrato su 0.5: la traccia dell'oscilloscopio
  - La texture viene impacchettata una volta sola nella finestra di controllo e **i byte gia' impacchettati viaggiano nel messaggio audio IPC**: il proiettore disegna esattamente dagli stessi dati, senza un secondo pack che potrebbe divergere
- `AudioAnalyzer` espone anche la forma d'onda (`getByteTimeDomainData`) e l'ampiezza in Hz di un bin — prima l'FFT c'era ma non usciva dall'analizzatore

### Changed
- **Pulsar** usa lo spettro vero: le creste in primo piano prendono la forma dello spettro live e si sciolgono nel terreno procedurale qualche fetta piu' indietro. Lo spettro si campiona **una volta per pixel** (la colonna dipende solo dalla x sullo schermo, che il loop delle fette non cambia), quindi cinque fetch invece di cinque per fetta
- **Pulsar**: le fasce del kick tornano una per battuta invece che una per battuta forte — a una per battuta forte quasi tutto il primo piano cadeva fra due fasce e restava piatto
- `docs/ARCHITECTURE.md`: la tabella degli uniform era ferma a sei voci, ora e' completa (hit per banda, fasi, `uBeatClock`, clock gated, `uSpectrum`)
- `scripts/shader-preview.py` costruisce una texture spettro sintetica (tilt rosa, qualche parziale, un po' di rumore) cosi' l'anteprima headless non mente sugli effetti che la leggono

## [0.30.0-beta] — 2026-09-14

### Added
- **Pulsar**, l'effetto delle creste dei Joy Division, fatto come si deve: non uno stack piatto di righe ma un *linescape* in prospettiva. Un unico terreno continuo viene tagliato in fette dal vicino al lontano e disegnato con rimozione delle linee nascoste vera (ogni cresta mangia quelle dietro), con i lati tenuti piatti da una finestra gaussiana — la firma della copertina. Le fette avanzano a passo costante in 1/z, cosi' le righe restano equidistanti sullo schermo e non si impastano in una barra all'orizzonte
  - **Agganciato al tempo**: il campo scorre verso la camera a `flow` unita' per battuta usando il beat clock, e ogni battuta forte alza una fascia di creste che poi arriva addosso insieme al terreno. Il kick alza le creste, gli alti assottigliano il tratto, la camera respira sul beat
  - Parametri: `Lines` (numero di fette), `Peaks` (altezza), `Flow` (scorrimento per battuta; a 0 il terreno si ferma e resta la copertina)
  - In rotazione nell'AutoVJ di dark-industrial, minimal-hypnotic e ambient

### Changed
- Gli shader ricevono un nuovo uniform **`uBeatClock`**, il contatore di battute continuo che l'engine gia' teneva per gli LFO tempo-sincronizzati. Serviva a Pulsar per far scorrere il terreno a tempo invece che a orologio, ed e' disponibile a tutti gli effetti
- `scripts/shader-preview.py` alimenta anche `uBeatClock`, `uSub` e `uPresence`, cosi' l'anteprima headless non mente piu' sugli effetti che li usano

### Fixed
- **`yarn check:output` falliva a proiettore sano**: il colpo di scena partiva 14 secondi dopo l'avvio dell'app, ma su macOS la richiesta del microfono si mangia una decina di secondi prima ancora che le finestre si aprano. La foto arrivava quando la finestra di uscita era viva da un secondo, cioe' prima del primo battito di salute (che e' ogni 5s), e il gate leggeva "nessun battito" su un'immagine perfetta. Ora il conto parte da quando il proiettore dipinge davvero

## [0.29.2-beta] — 2026-09-08

Passata di caccia ai bug sul codice degli ultimi rilasci. Quattro trovati, tutti
introdotti oggi.

### Fixed
- **Cancellare una scaletta poteva farne sovrascrivere un'altra**: se stavi modificando una scaletta e ne cancellavi una che veniva prima nell'elenco, il salvataggio successivo finiva sulla scaletta sbagliata. Perdita di lavoro silenziosa
- **La fine di una scaletta senza loop dipendeva da quante volte React rieseguiva un aggiornamento**: lo stop era dentro un aggiornamento di stato, dove non deve stare
- **Un preset con un effetto che non esiste piu' cambiava post-FX e colori senza dirlo a nessuno**: il proiettore restava con quelli vecchi. Effetto collaterale della protezione dallo schermo rosso aggiunta in 0.27.2
- **Un video mancante o illeggibile non avvisava piu'**: da quando i video scorrono da disco (0.27.3) l'errore era muto, mentre l'avviso era appena stato aggiunto in 0.28.0. Ora un file che non si apre torna a segnalarsi

## [0.29.1-beta] — 2026-09-08

### Fixed
- **Il controllo di rilascio non ruba piu' il computer**: `yarn check:output` avvia l'app intera, e su macOS questo portava le finestre davanti a tutto e si prendeva la tastiera, piu' volte per ogni release, mentre l'utente stava lavorando. Sotto il controllo l'app non compare nel Dock e le finestre si aprono senza fuoco. La finestra di uscita copre il proiettore come sempre: quello che viene verificato non cambia

## [0.29.0-beta] — 2026-09-08

### Added
- **Scalette** — la scheda Playlist diventa un editor vero. Una scaletta e' una sequenza di look, e **ogni passo ha la sua durata**: puoi tenerne uno 16 battute e il successivo 64, cosa che prima era impossibile perche' l'intervallo era uno solo per tutta la lista. Ogni passo ha anche la sua transizione, se vuoi.
  - **Si riaprono**: fino a ieri una playlist salvata non si poteva piu' toccare — per spostare un passo la si rifaceva da capo. Ora il tasto ✎ la carica nell'editor, e Salva la aggiorna (oppure "Salva come nuova" per tenerne due versioni)
  - **Si costruiscono da dove vuoi**: dal look sullo schermo (con la sua miniatura), dai look salvati nel Look Bank, o dai preset
  - Riordino trascinando, duplica passo, anteprima di un passo singolo, durata totale sempre in vista, loop, import/export JSON
- `yarn check:sequences` — verifica che le playlist salvate con le versioni vecchie continuino a caricarsi, e che l'avanzamento della scaletta sia corretto

### Changed
- **Look Bank e scalette leggono lo stesso archivio di look**: erano due idee parallele, il Look Bank con nomi e miniature e le playlist con copie dei preset senza ne' l'uno ne' l'altro
- Le playlist salvate in precedenza si aprono come scalette: ogni passo eredita l'intervallo unico che aveva la lista. Niente da rifare

## [0.28.0-beta] — 2026-09-08

Passata di ottimizzazione su tutto il codice: niente di visibile cambia, l'app fa
meno lavoro per lo stesso risultato e smette di perdere memoria fra una sessione
e l'altra.

### Added
- `yarn check:beat` — controllo del rilevamento dei beat su un segnale sintetico a 120/128/140/174 BPM. Serve perche' la soglia adattiva puo' rompersi in silenzio: l'app continua a girare e semplicemente smette di trovare i beat

### Fixed
- **Gli LFO andavano fuori fase fra preview e proiettore**: il contatore delle battute e l'orologio degli effetti erano accumulati da ogni finestra per conto proprio, quindi dopo qualche minuto i parametri modulati mostravano fasi diverse sui due schermi. Ora viaggiano col resto dei dati audio, 30 volte al secondo
- **Import di media senza rete di sicurezza**: un'immagine corrotta o un video su un disco scollegato fallivano in silenzio; ora compare un avviso
- **Preset e playlist non salvati a spazio esaurito**: la scrittura falliva dopo che l'elenco era gia' aggiornato a schermo, e l'utente se ne accorgeva al riavvio successivo
- **Il contatore degli effetti diceva 21**: sono 35, ora e' derivato dall'elenco vero
- **La preview poteva restare nera** se il pannello veniva misurato a larghezza zero (schermo appena risvegliato): stessa guardia che la finestra di uscita aveva gia'
- **Modalita' dell'interfaccia non validata** al caricamento: un valore corrotto entrava direttamente nel layout

### Changed
- **Memoria rilasciata davvero alla chiusura del motore**: geometrie, texture bianca, texture degli ISF e ascoltatori restavano appesi a ogni ricreazione
- **Meno lavoro per fotogramma**: l'elenco dei parametri dell'effetto attivo non viene piu' ricostruito ogni volta, la modulazione audio non alloca piu' un oggetto per parametro, la mediana della soglia dei beat lavora su un buffer riusato invece di creare tre array e due ordinamenti a ogni fotogramma, e due bande di frequenza calcolate per nessuno sono state tolte
- **Un cambio scena dell'AutoVJ e' un solo aggiornamento di stato** invece di una decina nello stesso fotogramma, e il pannello effetti non si ridisegna piu' quando non e' cambiato niente
- **Gli slider degli overlay non mandano piu' un messaggio per fotogramma** alla finestra di uscita: raggruppati a 30 volte al secondo, come gia' facevano quelli del telefono
- **Il telefono non scarica piu' le immagini degli ISF** (in base64) e il mapping a ogni interrogazione: non li usa
- **Lo shader personalizzato non viene piu' inviato due volte** a ogni modifica
- Tolto codice mai chiamato: API legacy del motore, accessori duplicati, un impulso di beat calcolato a ogni fotogramma senza lettori

## [0.27.3-beta] — 2026-09-08

### Changed
- **I video overlay scorrono da disco invece di essere caricati in memoria**: ogni finestra costruisce il proprio elemento video dallo stesso file, e prima ognuna ne leggeva l'intero contenuto in RAM — due copie complete, con una clip da 1 GB il renderer moriva a meta' set. Ora il processo principale espone il file su un protocollo interno (`djg-media://`) e il video viene letto man mano che serve. Accetta solo percorsi con estensione video
- **Lo stato non viene piu' spedito alle altre finestre a ogni fotogramma**: trascinando uno slider l'app inviava lo snapshot completo (parametri di tutti gli effetti, mapping, angoli del mapping, immagini degli ISF in base64) 60 volte al secondo al processo principale e da li' alla finestra di uscita e al telefono. Ora al massimo 30 volte al secondo, con invio immediato al primo cambio e invio finale garantito: stessa reattivita', meta' traffico e nessun picco durante i trascinamenti

## [0.27.2-beta] — 2026-09-08

### Fixed
- **La preview zoomava cambiando la risoluzione di uscita** (segnalato dall'utente): scegliendo 1440p o 4K il pannello mostrava il quadrante in basso a sinistra ingrandito. `uResolution` riportava la risoluzione scelta mentre il buffer della preview e' limitato a 1080p, e tutti gli effetti calcolano le coordinate come `(gl_FragCoord.xy - uResolution*0.5) / uResolution.y`: con il centro dichiarato fuori dal buffer si vedeva un angolo. Ora `uResolution` riporta la dimensione reale del buffer; l'inquadratura resta identica perche' gli effetti normalizzano gia' su `uResolution.y`. **Lo stesso calcolo usa la scala della risoluzione dinamica: senza questa correzione il proiettore si sarebbe zoomato da solo sugli shader pesanti**
- **Il proiettore disegnava il doppio dei frame necessari**: il watchdog che tiene viva la finestra output quando il sistema sospende `requestAnimationFrame` scattava a 14 ms, sotto il periodo di un frame a 60 Hz (16,7 ms), quindi interveniva fra un frame e l'altro invece che solo in emergenza. Soglia portata a 40 ms, sopra anche il periodo di un proiettore 4K a 30 Hz
- **La risoluzione dinamica non interveniva mai**: i frame del watchdog spostavano il riferimento temporale usato per misurare il carico, quindi il frame successivo risultava sempre velocissimo e la media non superava mai la soglia. Uno shader pesante restava a frame rate basso invece di scalare i buffer
- **Schermo rosso con un effetto sconosciuto**: un id non valido (preset importato, comando dal telefono o da OSC, impostazioni salvate prima della rimozione di un effetto) arrivava a three.js come shader vuoto e faceva ripiegare sul suo materiale di default, che e' rosso pieno. Ora l'id viene validato e in ultima istanza si ripiega su un effetto vero
- **Salvataggio di un look che non si completava**: due richieste di cattura ravvicinate (salvare un look mentre l'app genera una miniatura) lasciavano la prima appesa per sempre

## [0.27.1-beta] — 2026-09-08

### Added
- `yarn check:shaders` — renderizza tutti e 35 gli effetti in headless a due istanti diversi e segnala compile error, immagini bruciate, vuote, piatte o statiche
- `yarn shader:preview <file.frag>` — anteprima headless di un singolo shader con la pipeline vera dell'app (GLSL ES 3.00, tone mapping ACES, esposizione), errori di compilazione stampati nella pagina invece di una schermata bianca

### Changed
- Gli strumenti di verifica vivono nel repo sotto `scripts/` invece che in una cartella temporanea: erano gia' stati persi una volta dalla pulizia di `/tmp`
- TODO riscritto: roadmap funzionalita' 2026-09-08 (18 voci in Serata / Preparazione / Qualita' visiva / Integrazione) e nuova sezione "Codice — miglioramenti" con 20 voci verificate file:riga dall'audit del codice
- Rimossa la dipendenza `zustand`, mai importata da nessun file

## [0.27.0-beta] — 2026-09-07

### Fixed
- **PROIETTORE NERO — risolto alla radice**: l'app non usa piu' il fullscreen di macOS per la finestra di output. macOS realizza il fullscreen con gli Spaces e su setup multi-monitor la superficie della finestra puo' restare congelata o finire su uno Space non mostrato: il motore continuava a disegnare (i log lo provano, migliaia di frame al secondo) mentre il proiettore restava nero, a volte con un lampo iniziale di immagine. Ora il proiettore e' una finestra senza bordi grande esattamente quanto lo schermo, portata sopra la barra dei menu: stesso risultato visivo, nessuna transizione che possa congelarla. E' il problema noto di Electron [#39572](https://github.com/electron/electron/issues/39572) / [#6036](https://github.com/electron/electron/issues/6036)
- La proiezione copre l'intero schermo: prima restavano 30px di scrivania in alto (macOS riserva lo spazio della barra dei menu su ogni display)
- Niente piu' lampo all'avvio: la finestra non viene piu' ri-mostrata ne' ridimensionata dopo il primo frame

## [0.26.7-beta] — 2026-09-07

### Fixed
- **"In attesa di segnale" appariva sopra un visual funzionante** — il cartello introdotto nella 0.26.5 si accendeva quando la finestra di controllo non aveva aggiornamenti da inviare, anche con il proiettore che disegnava correttamente. Ora compare solo se il rendering e' davvero fermo

### Added
- **Controllo del proiettore prima delle release** (`yarn check:output`) — avvia l'app, cattura il frame che la finestra output sta realmente dipingendo e boccia la build se e' nero, uniforme o congelato: i contatori di frame da soli non bastavano a garantire che sullo schermo ci fosse qualcosa

## [0.26.6-beta] — 2026-09-07

### Fixed
- **Proiettore nero quando l'app parte gia' in fullscreen** — il fullscreen veniva applicato prima che la finestra di output avesse disegnato il primo frame: la transizione di macOS coglieva una finestra non ancora attiva e restava nera. Ora si va a schermo intero solo dopo che il proiettore ha davvero disegnato (con timeout di sicurezza)
- **Microfono chiesto due volte al primo avvio** — l'onboarding e il pannello audio chiedevano l'accesso contemporaneamente per leggere i nomi dei dispositivi. Ora la richiesta e' una sola, condivisa

## [0.26.5-beta] — 2026-09-07

### Added
- **Cartello "in attesa di segnale" sul proiettore** — se la finestra di output e' sullo schermo ma non riceve contenuto (o il rendering si e' fermato), lo scrive sul proiettore invece di restare nera: cosi' si distingue subito una finestra assente da una finestra presente ma senza segnale. Sparisce da sola appena il contenuto arriva

## [0.26.4-beta] — 2026-09-07

### Fixed
- **Proiettore che finiva sul portatile** — con qualche entrata/uscita dal fullscreen la finestra di output migrava sullo schermo del computer (macOS risolve il fullscreen sullo schermo corrente) e il secondo schermo restava nero. Ora l'output e' ancorato al suo display: ogni fullscreen lo riporta li', e un controllo periodico lo rimette a posto se il sistema lo sposta
- **Schermo nero silenzioso** — un blackout dimenticato o il master a zero rendevano il proiettore nero senza spiegazioni. Ora compare un avviso rosso "PROIETTORE NERO" con il motivo e un bottone Ripristina

### Added
- **Battito del proiettore nel log** — ogni 5 secondi il log di sessione registra frame, dimensioni, effetto, master, blackout e quanti aggiornamenti di stato sono arrivati: un proiettore nero adesso si spiega dal file

## [0.26.3-beta] — 2026-09-07

### Fixed
Rassegna di tutti i 35 effetti con render reali: quattro erano difettosi.
- **Matrix** — era rumore statico, non pioggia di codice: la scia era calcolata da un valore identico per tutta la colonna, quindi nessun gradiente verticale. Ora sono colonne che cadono con testa luminosa e scia che sfuma
- **Lattice (raymarch)** — la camera finiva dentro la struttura e riempiva lo schermo con una faccia gigante. Ora c'è un tunnel scavato lungo il percorso: si vola dentro il reticolo
- **Lissajous** — puntini sparsi invece della curva: campionava punti troppo distanti fra loro. Ora la curva è continua (distanza dai segmenti)
- **Fractal** — tinte piatte dentro e fuori: quasi tutti i punti esterni ricevevano lo stesso colore. Ora scala espansa e orbit trap, con struttura interna e filamenti

## [0.26.2-beta] — 2026-09-07

### Added
- **Log di sessione su file** — ogni avvio scrive in `~/.djtographikz/logs/`: errori del programma, della finestra di controllo **e della finestra output**, piu' la topologia degli schermi e dove finiscono le finestre. Si apre dal menu **?** -> "Apri log della sessione": per segnalare un problema basta allegare il file (restano le ultime 10 sessioni)

### Fixed
- **Effetto Vortex rifatto** — disegnava una macchia piatta invece della spirale: la funzione dei bracci era invertita e copriva quasi tutto lo schermo. Ora sono spire sottili che confluiscono in un cuore luminoso
- **Proiettore su Space diverso (macOS)** — la finestra output viene ora fissata su tutti gli Space: uno dei modi in cui il secondo schermo resta nero pur risultando "visibile" al sistema
- La risoluzione non crolla piu' al 30% quando il watchdog di rendering subentra: i frame temporizzati non vengono piu' scambiati per GPU in affanno

## [0.26.1-beta] — 2026-09-07

### Fixed
- **Secondo schermo nero — causa trovata e risolta**: macOS sospende `requestAnimationFrame` quando considera la finestra del proiettore non visibile (coperta da un'app a schermo intero, occlusa, display in stand-by). Il loop di rendering moriva **dopo il primo frame**, quindi il proiettore restava congelato sul nero iniziale, prima ancora di ricevere lo stato. Ora un watchdog tiene vivo il frame anche quando rAF tace (verificato: prima si fermava al frame 1, ora prosegue)
- Il letterbox non può più produrre un buffer 0×0 (finestra non ancora impaginata) e la dimensione viene ricontrollata a ogni frame, così il proiettore si riprende da solo se la finestra cambia senza emettere eventi
- **Errori della finestra output ora visibili nel log** — prima venivano ingoiati in silenzio: è il motivo per cui questo bug è rimasto invisibile così a lungo

## [0.26.0-beta] — 2026-09-07

### Changed
- **BPM v4** — envelope degli onset su **griglia fissa a 100Hz con timestamp reali** (il jitter del frame rate e la risoluzione dinamica non spostano più il tempo: errore max ±0.5%, prima ~±1.5%), **voto a doppia banda** (kick + spettro pieno: il tempo regge anche nei breakdown senza cassa), e **prior di genere**: il genere scelto nell'AutoVJ centra la ricerca del tempo (dnb cerca intorno a 174, ambient a 95 — gli errori d'ottava spariscono). 10 casi di test sintetici tutti verdi, incluso frame timing casuale 12-24ms

## [0.25.1-beta] — 2026-09-07

### Fixed
- **PS2 e Snow rifatti da zero** (il primo tentativo era piatto e brutto — verificato con render reali stavolta): le torri PS2 sono ora **prismi 3D veri** (raycast a colonne con facce, occlusione, corridoio di camera, riflessi e lucciole nella nebbia blu); la pista da snowboard ha **camera che banka in curva**, alberi e porte slalom proiettati in 3D con bandierine, tavola in campo, spray e salto sul kick

## [0.25.0-beta] — 2026-09-07

### Added
- **Categoria Videogame** — 2 effetti nuovi (35 totali): **PS2** (le torri della boot screen PlayStation 2: prismi luminosi nella nebbia blu, camera orbitante, il kick alza torri nuove) e **Snow** (gameplay snowboard alla 1080°: pista pseudo-3D che serpeggia, porte slalom, spray di neve, salto sul kick, velocità dai bassi)
- **2 generi AutoVJ nuovi** — Tech House (groove caldo, geometrie morbide) e Psytrance (frattali e caleidoscopi acidi): 10 generi totali

### Changed
- **Preset AutoVJ ampliati** — ogni genere passa da ~9 a ~14 scene curate: 136 scene totali, 126 mapping audio, con varianti accordate degli stessi effetti e i nuovi effetti videogame distribuiti dove hanno senso (PS2 in ambient/trance/minimal, Snow in trance/dnb)

## [0.24.0-beta] — 2026-09-07

### Added
- **12 effetti nuovi (la libreria passa a 33)** — Lasers (fasci con sweep), Strobe (LED wall a pattern sul kick), Vortex (spirale ipnotica), Terrain (synthwave), Orbits (sistemi orbitali con scie), Shatter (voronoi che esplode sul kick), Moiré (op-art), City (skyline-equalizer), Neon (poligoni nested), Ink (inchiostro marmorizzato), Lattice (raymarch 3D infinito), Ripples (acqua con onde dai colpi) — tutti col vocabolario audio esteso e 2-3 parametri curati

### Changed
- **AutoVJ a scene curate** — ogni genere ora ruota su ~9 scene complete (effetto + parametri accordati + mapping audio/LFO scelti musicalmente) invece di soli nomi di effetto: 73 scene, 70 mapping. Il cambio non eredita più i parametri rimasti dalla sessione — ogni switch è un look che funziona

## [0.23.0-beta] — 2026-09-07

### Added
- **Notifica aggiornamenti** — l'app controlla le release GitHub ogni 6 ore e mostra un toast "Nuova versione X — Scarica" che apre la pagina di download (le build non firmate non possono auto-installarsi, quindi il flusso onesto è notifica + link)
- **Projection mapping (keystone/quad-warp)** — pannello Mapping: trascina i 4 angoli per adattare l'immagine a un proiettore storto; omografia calcolata su CPU, warp nel master shader, nero fuori dal quad, stato sincronizzato sull'output e persistito, reset con Annulla
- **Luci DMX via ArtNet** — pannello Luci DMX: PAR RGB che seguono la palette e pulsano con energia/bass/beat, flash sul beat opzionale; UDP :6454 broadcast o verso un nodo specifico, universo/canale base/numero fixture configurabili — nessun hardware richiesto oltre a un'interfaccia ArtNet

## [0.22.1-beta] — 2026-09-07

### Fixed
- **Finestra output ridimensionata: niente più video deformato** — il canvas mantiene il rateo della risoluzione di output con letterbox (bande nere) invece di stirarsi alla forma della finestra; verificato con cattura reale a 800×700

## [0.22.0-beta] — 2026-09-04

### Changed
- **Effetto Fire rifatto** — domain-warped fbm (le fiamme leccano e si arricciano invece di scorrere rumore statico), rampa di temperatura tinta dalla palette (glow → corpo → caldo → cuore bianco), letto di braci sul fondo, scintille con sfarfallio; il kick fa balzare la fiamma, i bassi ne alimentano il vigore, gli alti accendono le scintille

## [0.21.1-beta] — 2026-09-04

### Fixed
- **Finestra output decentrata**: il fullscreen veniva applicato prima che la finestra fosse pronta (regressione 0.14.0) — ora aspetta `ready-to-show` e riapplica i bounds del display
- La risoluzione dinamica non scatta più durante l'avvio (warmup portato a ~5 secondi: lo spawn della finestra output rallenta i primi frame)

## [0.21.0-beta] — 2026-09-04

### Changed
- **Pass di performance sul motore**: niente depth/stencil buffer (pipeline a quad fullscreen, non servono — meno memoria e banda), clear rimossi prima dei pass opachi (12+ per frame risparmiati), `powerPreference: high-performance` (su laptop dual-GPU usa la discreta)
- **Blackout a costo zero** — a schermo nero la GPU riposa invece di renderizzare frame moltiplicati per zero
- **Post FX con wet a 0 saltati** — un effetto in catena col fader a zero non costa più nulla
- La risoluzione dinamica ignora gli spike isolati (compilazione shader, GC): il cambio effetto non fa più scalare la risoluzione

## [0.20.1-beta] — 2026-09-04

### Fixed
- Risoluzione dinamica più aggressiva per i raymarcher volumetrici (es. "Cloudy Shapes": 32 step × 8 shadow step per pixel) — passo di riduzione proporzionale al ritardo (da 15fps converge a fluido in ~1s invece di 12), pavimento al 30% invece del 50%

## [0.20.0-beta] — 2026-09-04

### Added
- **Risoluzione dinamica** — gli shader pesanti (raymarcher ISF) non fanno più laggare tutto: se il frame rate scende sotto ~42fps i buffer di rendering scalano automaticamente (fino al 50%) e risalgono da soli quando c'è margine; mai durante una transizione, warmup all'avvio, ogni finestra si adatta per conto suo. `uResolution` resta quella di output, quindi l'inquadratura non cambia.

## [0.19.0-beta] — 2026-09-04

### Changed
- **Lettura BPM di nuova generazione** (tecniche da BTrack/aubio/Mixxx): onset **SuperFlux** (flux contro il massimo locale del frame precedente — i glissato e i pad non contano più come colpi), tempo via **comb filterbank a 4 armoniche** sull'autocorrelazione con **prior di Rayleigh** a 126 BPM (gli errori d'ottava si risolvono verso il range club), interpolazione parabolica per precisione sub-frame, mediana degli ultimi 5 candidati (una finestra sporca non strappa il tempo). Test: 90/124/130/150/174 BPM entro ±2, cambio tempo 130→140 riagganciato in 5 secondi.

## [0.18.0-beta] — 2026-09-04

### Changed
- **Motore audio riscritto (BeatTracker)** — onset in scala logaritmica (indipendente dal volume), soglia mediana+MAD (regge i build-up), peak-picking anti doppi trigger, **fase agganciata con PLL** (correzione morbida, mai strappi sui falsi beat), rilevamento anti-fase (se si aggancia sugli hats si corregge da solo), **stima BPM propria** ad autocorrelazione sulla banda kick (niente alias 3:2 dagli hats) che copre i buchi della libreria, downbeat stimato dall'energia dei 4 slot. Verificato con pattern sintetici: 130/174/124 BPM entro ±2, 100% dei beat allineati, zero doppi, silenzio muto.
- **Mappatura parametri rifatta** — ogni parametro ha una **chip colorata** (verde=bass, ambra=mid, azzurro=high, rosso=beat, viola=LFO) che mostra sorgente e profondità; tocca la chip e si apre un editor con griglia di sorgenti a bersagli grandi, slider profondità e velocità LFO a bottoni. Niente più menu a tendina microscopici.

## [0.17.0-beta] — 2026-09-04

### Added
- **Preview riducibile** — bottone "▾ riduci" sulla preview: diventa una striscia da 150px e i pannelli prendono lo spazio; persistito, disattivo in modalità LIVE

### Changed
- Nomi degli shader ISF su due righe invece dell'ellissi — si legge il nome completo
- Errori shader dettagliati anche per i fallimenti di **link** (varying mancanti, ecc.): niente più "unknown GLSL error"

## [0.16.1-beta] — 2026-09-04

### Fixed
- Hoisting degli init globali ISF più robusto: dichiarazioni multiple sulla stessa riga (`float a = 1., b = TIME;`) gestite senza corrompere il codice, `true`/`false` riconosciuti come costanti, commenti a blocco ignorati nel conteggio delle graffe — verificato su tutti i 3.722 generator del sito

## [0.16.0-beta] — 2026-09-04

### Changed
- **Smart map v2** — non più solo nomi: analizza il sorgente GLSL per capire cosa fa davvero ogni parametro (scala le coordinate → bass, alimenta i colori → LFO lento, dentro sin/cos col tempo → LFO saw, soglie/branch → beat), pesa la profondità sull'impatto (uniform usate ovunque = modulazione più gentile) e applica un budget di ruoli (max 2 parametri per banda audio, gli altri su LFO sfalsati) così il risultato respira invece di strobare tutto insieme

## [0.15.0-beta] — 2026-09-04

### Changed
- **Smart map spostato e potenziato** — ora è in testa al pannello **Parametri** (visibile per qualsiasi effetto, non solo ISF): euristica più ricca (beat/strobe, hue/palette su LFO lento, phase/wave su saw, bool pulsati sul beat), abbassa la base dei parametri troppo alti per dare headroom alla modulazione, e il toast ha **Annulla** che ripristina valori e mapping precedenti

### Fixed
- **Shader ISF che non compilavano** ("global variable initializers must be constant expressions", "l-value required"): gli inizializzatori globali non costanti (legali su GL desktop, vietati in WebGL) vengono spostati automaticamente in cima a `main()`, e gli input color/point2D sono ora variabili vere (assegnabili) invece di `#define`

## [0.14.0-beta] — 2026-09-04

### Added
- **Libreria ISF online** — "Sfoglia online…" nel pannello Effects: cerca tra ~3.700 generator di editor.isf.video (con thumbnail, ordinati per stelle) e importali con un click in `~/.djtographikz/isf`
- **Import file ISF** — "Importa file…" accetta `.fs`/`.frag`/`.glsl` e gli **.zip scaricati dal sito** (estrae il `.fs`, il `.vs` non serve); errore di parsing mostrato subito nel toast
- **Smart map** — un tasto mappa automaticamente i parametri dello shader ISF attivo sull'audio (bass/mid/high/energy/beat/LFO) in base al nome del parametro
- **Input image negli ISF** — gli shader con input `image` ora caricano: un bottone per input permette di scegliere l'immagine, che arriva anche alla finestra output
- Compatibilità ISF estesa: input `color`/`point2D` fissati al default, `long` come slider, `event` mappato sul beat, input "mouse" animato con drift automatico, macro `IMG_*`/`PASSINDEX`/`TIMEDELTA`/`DATE`

### Fixed
- **Fullscreen output**: avanti/indietro ripetuto poteva lasciare lo schermo nero — colpa del mix tra fullscreen nativo e `simpleFullScreen` su macOS, ora si usa solo il secondo ovunque (toggle, creazione finestra, cambio display)
- Nome app nei menu: `app.setName('DJtoGraphikz')` — in sviluppo la barra macOS mostra comunque "Electron" (è l'Info.plist del binario dev), l'app pacchettizzata mostra il nome giusto

## [0.13.1-beta] — 2026-09-04

### Fixed
- **Telefono: rilevamento app chiusa** — se l'app si chiude (o cade il wifi) la pagina mobile mostra un banner a schermo intero "App non raggiungibile" dopo 2 poll falliti, invece di restare con i controlli congelati; sparisce da solo al ritorno della connessione

## [0.13.0-beta] — 2026-09-04

### Added
- **Release automatiche multi-piattaforma** — GitHub Action su ogni tag `v*`: compila e pubblica gli installer per macOS (.dmg), Windows (.exe) e Linux (.AppImage) nella release GitHub; badge e sezione Download nel README puntano sempre all'ultima versione
- Icona anche per le build Windows/Linux (build/icon.png dall'SVG sorgente)

### Changed
- Regola di progetto in CLAUDE.md: README sempre allineato allo stato dell'app

## [0.12.0-beta] — 2026-08-28

Batch usabilità + redesign: l'intera roadmap U1-U5 e D1-D8 in una release.

### Added
- **PANIC** (tasto P + bottone) — un gesto riporta a stato sicuro: post azzerati, crossfade/motion blur 0, master 1, blackout/freeze off, AutoVJ off
- **Indicatori live in top bar** — pallino che pulsa col beat (grigio se l'audio non gira), banner ambra durante la riconnessione audio, chip stato finestra output (display + fullscreen) con bottone Riapri
- **Toast azioni esterne** — quando un comando arriva da telefono o OSC l'operatore vede cosa è successo ("Look 3 · telefono"); gli stream degli slider si compattano
- **Menu aiuto vero** — "?" apre Scorciatoie (cheat-sheet, anche col tasto ?), Guida rapida in italiano, Rifai configurazione
- **Onboarding v2 + 8 look di fabbrica** — il Look Bank non parte mai vuoto: Tunnel Acid, Kaleido Trance, Dark Grid, Fluid Ambient, Strobo Glitch, Sacred Minimal, Fire Gabber, Starfield Chill (alcuni già con mappature audio/LFO)
- **Modalità LIVE** — terza vista accanto a Simple/Pro: preview massima + striscia Look Bank, nient'altro; beat flash opzionale sul bordo preview
- **Look Bank pro** — rinomina col doppio click, riordino drag&drop
- **Undo leggero** — cancellazioni (look, media, binding MIDI) con toast "Annulla" 5s
- **Remote**: vibrazione al tap, layout landscape con rail laterale, favicon occhio

### Changed
- **Redesign completo** — design system a token (spaziature, tipo min 11px, elevazioni stratificate, accent verde solo per stati attivi), slider/select/campi/bottoni custom con focus visibile, scrollbar custom, micro-motion 140ms con rispetto di prefers-reduced-motion, grana scanline impercettibile sul fondo
- **Top bar a gruppi logici** (brand · modalità · trasporto · cattura/output · aiuto) con icone SVG coerenti al posto delle emoji, mini-logo occhio
- **UI tutta in italiano** — termini tecnici DJ/VJ restano in inglese (wet, beat, crossfader…); tooltip sistematici con hotkey su ogni controllo
- **Sidebar destra ad accordion** — un pannello aperto alla volta (Media/Preset/Shader/MIDI), stato persistito; il Look Bank resta sempre disponibile
- README riscritto in italiano: quick-start in 7 passi per la prima serata

## [0.11.0-beta] — 2026-08-28

### Added
- **MIDI learn** — pannello MIDI (Pro, sidebar destra) su Web MIDI nativa: armi Learn su un target, muovi un controllo sul controller e il binding è fatto (persistito). Target: master, crossfade A/B, motion blur, wet/dry dei 9 post, i 5 controlli grade, trigger tap/blackout/freeze/AutoVJ e i 16 slot del Look Bank. CC = fader (o bottone con soglia), note = trigger; i comandi passano dallo stesso dispatch di telefono e OSC

### Changed
- Dispatch comandi unificato in App: telefono, OSC e MIDI guidano l'engine dallo stesso switch

## [0.10.0-beta] — 2026-08-28

### Added
- **Media library persistente** — immagini/GIF/video importati vengono copiati in `~/.djtographikz/assets` e compaiono nella sezione Libreria del pannello Media: dopo un riavvio si ri-aggiungono con un tap (la webcam è un device, non si persiste)
- **Text overlay** — testo con color picker nel pannello Media, renderizzato su canvas trasparente nella pipeline overlay: opacity/scale/offset/displace e tutti i post-FX si applicano gratis, sincronizzato alla finestra di output
- **OSC input** — server UDP su :9700 (TouchOSC e qualsiasi controller OSC): `/djg/brightness`, `/djg/crossfade`, `/djg/effect` (per nome o `/djg/effect/N`), `/djg/post`, `/djg/look/N`, `/djg/grade/*`, `/djg/param/<chiave>` (scalato al range reale), blackout/freeze/autovj/tap/motionblur; throttle per address, parser OSC 1.0 con bundle
- **Thumbnail effetti** — le griglie diventano scene card visive: cattura automatica dal vivo quando l'effetto è pulito a schermo (niente custom shader/crossfade/blackout), cache locale, l'AutoVJ popola la banca da solo
- **Libreria ISF su cartella** — i generator in `~/.djtographikz/isf` compaiono come categoria ISF nel pannello Effects; quelli rotti o non-generator sono elencati come ignorati con l'errore GLSL esatto alla selezione

## [0.9.0-beta] — 2026-08-28

### Added
- **Logo e icona app** — marchio vettoriale disegnato a mano (occhio con cuffie DJ sopra e bozza di console sotto, verde neon su dark come l'identità dell'app): `build/icon.svg` sorgente, `build/icon.icns` generata con margini Apple standard e collegata a electron-builder — il .dmg non usa più l'icona default di Electron

## [0.8.0-beta] — 2026-08-28

### Added
- **LFO come sorgente parametri** — sine/saw/square accanto a bass/mid/high in ogni mappatura, sincronizzati al tempo (rate in battute: 1/4…32, default 4 = una battuta); funzionano anche sull'output window e dal telefono (le sorgenti arrivano da /defs)
- **Registrazione WebM** — bottone 🔴 in top bar: registra la preview (VP9, 12Mbps, chunk da 1s), ⏹ salva il file. Zero dipendenze

### Removed
- Dead code: API template IPC mai usata (save/load/list/delete) e componente TemplateManager orfano

## [0.7.2-beta] — 2026-08-18

Batch di hardening da audit completo (24 finding verificati nel codice).

### Fixed
- **Loop di render protetto** — un'eccezione in un frame (GIF rotta, listener) non congela più il proiettore per il resto della serata: rAF in `finally`
- **Custom shader sul proiettore** — ora viaggia nello snapshot di stato: qualsiasi slider toccato non fa più tornare l'output all'effetto stock; lo shader sopravvive anche al riavvio; l'output ricompila solo se il sorgente cambia
- **Look/preset ora salvano i parametri** — valori + mappature audio + shader custom: richiamare un look riproduce ciò che mostra la thumbnail
- **Audio recovery con backoff** — dopo un retry fallito riprova con backoff esponenziale (1s→30s) invece di arrendersi per sempre
- **Finestra output ricreabile** — handshake all'avvio (stato + overlay replayati al caricamento), ricreazione automatica su crash del render process e su richiesta dopo una chiusura accidentale
- **Teardown media completo** — rimuovere una webcam spegne la camera (track.stop), rimuovere un video libera il blob (revokeObjectURL)
- **Cambio risoluzione col freeze attivo** non svuota più il frame congelato
- **Beat-sync senza beat** — i cambi effetto in coda partono comunque dopo 2s senza beat
- **Pannelli sempre sincronizzati** — effetto/chain/grade/crossfade/parametri seguono i cambi da telefono, AutoVJ, hotkey e preset (prima si aggiornavano solo al mount; SimplePanel partiva sempre da tunnel)
- **BPM live sul telefono** — /state ora porta bpm/energy dal canale audio (prima si aggiornava solo alle azioni utente)
- **AutoVJ sincronizzato col telefono** — toggle e genere confermati via stato, inclusi gli spegnimenti silenziosi da hotkey
- **Multi-telefono** — fino a 4 dispositivi abbinati; il secondo non slogga più il primo
- **Parametri sul telefono con shader custom** — usava i valori dell'ultimo effetto stock
- **Transizione `wipe-down`** mancava dal pannello desktop (solo da telefono)
- **GIF: cap memoria** — max 720px lato lungo e 240 frame (~1GB → ~350MB caso peggiore, GIF tipiche intatte)
- **Gestione WebGL context loss** (preventDefault + resetState su restore)
- Immagini corrotte: errore invece di promise appesa

### Added
- **Preferenze persistenti**: transizioni (tipo/durata/beat-sync), velocità colori, config palette-cycling, e impostazioni audio (device, gain, sensitivity, BPM mode) con riavvio automatico dell'analisi se era attiva

## [0.7.1-beta] — 2026-08-18

### Fixed
- **Webcam nell'app pacchettizzata**: mancava l'entitlement `com.apple.security.device.camera` — con l'hardened runtime la webcam veniva rifiutata nel .dmg (in dev funzionava); descrizione d'uso in italiano
- `author` in package.json (warning di electron-builder rimosso)

## [0.7.0-beta] — 2026-08-18

### Added
- **Look Bank** — griglia 4×4 di look con thumbnail reale (screenshot al salvataggio): click su slot vuoto = salva il look completo, click = applica con transizione, Shift+click = sovrascrivi, hotkey Shift+1..0 per i primi 10 slot (`e4c4572`)
- **Vocabolario audio esteso** — nuovi uniform su tutti gli effetti (anche custom/ISF): `uBassHit`/`uMidHit`/`uHighHit` (onset per banda: kick / synth / hats, soglia adattiva), `uBassTime`/`uHighTime` (clock gated: avanzano solo quando la banda suona — il breakdown congela, il drop riparte), `uSub`/`uPresence` (`f74525c`)
- **50 parametri curati sui 21 effetti** — 2-3 uniform veri per effetto (segments, density, zoom, iterations, twist…), tutti con slider + mappatura audio (source + depth) già nel pannello e sul telefono; default identici al look precedente; starfield/glitch/fire usano già il nuovo vocabolario (`95a6c27`)
- **Remote mobile a parità completa** — la pagina del telefono controlla tutto: Look Bank con thumbnail, parametri dell'effetto attivo con mappatura audio, catena post con wet/riordino/rimozione, grade, motion blur, blend mode, transizioni, deck B. Redesign touch-first: striscia BLACK/FREEZE/TAP+master+BPM sempre visibile, tab LIVE/FX/MIX/COLORI/SETUP, target ≥48px (`8dc6a79`)
- **Remote sempre allineato** — la pagina si costruisce dai dati: cataloghi (effetti, post, palette, generi, blend, transizioni) inviati dal renderer e serviti da `GET /defs` insieme alla versione dell'app; i cataloghi in App.tsx sono vincolati ai tipi dell'engine, quindi aggiungere un effetto senza esporlo al remote non compila (`8dc6a79`)
- **Pannello Media unificato** — immagini/GIF, video e webcam in un solo flusso con card identiche (stessi slider, stessi filtri — la pipeline era già comune); thumbnail live 2fps per video/webcam, scelta della camera quando ce n'è più di una, errori inline in italiano (`e9909ee`)

### Changed
- **AutoVJ: Bag + downbeat** — effetti/post/palette pescati senza ripetizioni finché il sacchetto non si svuota (stile Resolume) e switch eseguiti sul downbeat (aggancio al barPhase, timeout di sicurezza ~2 battute); il bias per energia resta sul ritmo degli switch (`023c316`)
- Flusso git documentato in CLAUDE.md: main sempre stabile, branch per batch, merge `--no-ff` + tag di release

### Fixed
- Riapplicato il debounce della persistenza andato perso da `f299622` (il commit lo dichiarava ma App.tsx non era stato staged) (`833215b`)

## [0.6.1-beta] — 2026-08-18

### Fixed
- **Ingresso audio che moriva** (spesso notato collegando il remote): l'AudioContext di Chromium può morire da solo ("The AudioContext encountered an error from the audio device") — ora niente più `sampleRate: 44100` forzato (resampling su hardware 48k, causa nota dell'errore) e **auto-recovery**: context sospeso → resume, context chiuso o track del mic terminata → restart automatico dell'analisi entro 1s sullo stesso device
- **Lag col remote**: `localStorage.setItem` sincrono girava ad ogni stato emesso (~16 scritture/s trascinando uno slider dal telefono) — ora debounce 400ms; gli slider della pagina mobile mandano il valore finale al rilascio e `/state` è `no-store`

## [0.6.0-beta] — 2026-08-18

### Added
- **Web remote dal telefono** — server HTTP nel main process (zero framework, porta 9666+): bottone 📱 mostra QR + codice di abbinamento a 6 cifre; il telefono sulla stessa wifi apre il pannello mobile e controlla tutto — blackout/freeze/tap BPM, master, effetti, crossfader A/B, deck B, post-FX, palette, AutoVJ e genere
- **Sicurezza pairing** — codice per sessione, token via crypto.randomBytes, confronto timing-safe, lockout 60s dopo 8 tentativi, "Nuovo codice" revoca i telefoni collegati
- Stato live sul telefono: polling di /state evidenzia effetto/post/blackout attivi

## [0.5.2-beta] — 2026-08-06

### Fixed
- Sidebar davvero non scrollabile (lista effetti tagliata dopo Organic): i pannelli sono flex children con `flex-shrink:1` — quello con `overflow:hidden` (EffectPanel) ha `min-height:0` e veniva schiacciato all'altezza del viewport invece di far overfloware la sidebar. Ora `flex-shrink:0` su tutti i figli delle sidebar

## [0.5.1-beta] — 2026-08-06

### Fixed
- Shader custom/ISF rotti venivano accettati e spammavano `useProgram: program not valid` + feedback-loop GL ogni frame: three.js compila solo al primo render, ora `setCustomShader` valida con un render di prova via `renderer.debug.onShaderError` e respinge mostrando l'errore GLSL esatto nell'editor
- Pannello Effects non scrollabile: rimosso il box di scroll annidato (60vh) — scrolla la sidebar
- Scroll difficile in modalità Pro: la rotella sui valori numerici catturava sempre l'evento; ora regola il valore solo dopo un click sul campo

## [0.5.0-beta] — 2026-08-06

### Added
- **Parametri per effetto** — Speed e Reactivity su tutti i 21 effetti; ogni parametro mappabile a bass/mid/high/energy/beat con depth ±100% (`8d3108b`)
- **ISF generator import** — header JSON → slider automatici audio-mappabili, transpile a convenzioni interne; generator-only con errori chiari per filtri/multi-pass (`453b382`)
- **Onboarding primo avvio** — device → genere → via, rilanciabile dal bottone "?" (`3b633a0`)
- **Modalità Simple / Pro** — vista minimale di default (Auto VJ, griglia effetti grande, palette), tutto il resto dietro il toggle Pro (`3b633a0`)
- **Hotkey estesi** — 1-0 effetti, Q/W/E/R post-FX, Space tap BPM (`c5ddf48`)
- **Persistenza impostazioni** — look completo (effetto, chain, colori, deck, grade, parametri) ripristinato all'avvio (`c5ddf48`)
- **Selettore monitor** per la finestra di output (`c5ddf48`)
- **BPM ×½ / ×2** — correzione rapida half/double tempo (`c5ddf48`)
- **Screenshot PNG** dal bottone 📷 (`c5ddf48`)

### Fixed
- Webcam/video overlay renderizzato capovolto — doppio flip Y rimosso (`2fc4662`)

## [0.4.0-beta] — 2026-08-06

### Added
- **Tone mapping ACES + output sRGB** — i neon saturi non clippano più a bianco sul proiettore (`dd7ba36`)
- **Bloom con threshold** — prefiltro luminanza + blur separabile a mezza risoluzione (`dd7ba36`)
- **Color grade master** — exposure, contrast, saturation, lift, vignette come pass finale sempre attivo (`dd7ba36`, `1ab911a`)
- **Deck A/B + crossfader** — 5 blend mode: mix, add, screen, multiply, difference (`1ab911a`)
- **Post-FX chain riordinabile** con wet/dry per effetto (`1ab911a`)
- **Motion blur temporale** — accumulo frame (`dd7ba36`)
- **Feedback con displacement** — trail che si arriccia su campo di noise, stile TouchDesigner (`dd7ba36`)
- **Video clip + webcam** come layer overlay o displacement map (`1ab911a`)
- **Blackout, Freeze, Master brightness** con hotkey B / F / [ ] (`a0955ee`)
- **Beat phase / bar phase** — rampe continue 0-1 per anticipare il beat negli shader (`40242fa`)
- **Envelope follower** attack veloce / release lento, **auto-gain** e **noise gate** (`40242fa`)
- **Antialiasing procedurale** — larghezza bordi da `fwidth()` sugli shader geometrici (`dd7ba36`)
- Preview allineata all'output: `uResolution` segue la risoluzione di uscita (`1ab911a`)

## [0.3.1-beta] — 2026-08-06

### Fixed
- Transizioni tra effetti molto più lente della durata impostata (`getDelta()` consumato da `getElapsedTime()`)
- Pipeline duplicata (~500 righe) tra finestra di controllo e output — l'output ora riusa `Engine` in modalità remote
- Avanzamento playlist a beat perdeva la maggior parte dei beat (polling 20Hz su un flag che vive un frame)
- `gifSync` non sincronizzato alla finestra di output
- Nome file asset rotto su Windows (split su `/`)
- Componenti morti rimossi (Sidebar, OutputPreview)

## [0.3.0-beta]

Baseline: 21 effetti GLSL, 9 post-FX, 16 palette, beat/BPM detection, overlay immagini/GIF, preset e playlist, dual window, AutoVJ 8 generi, shader editor live.
