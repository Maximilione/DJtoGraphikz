# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/) · versioni [SemVer](https://semver.org/) con suffisso `-beta`.

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
