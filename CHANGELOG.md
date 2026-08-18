# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/) · versioni [SemVer](https://semver.org/) con suffisso `-beta`.

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
