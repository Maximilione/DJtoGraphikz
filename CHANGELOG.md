# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/) · versioni [SemVer](https://semver.org/) con suffisso `-beta`.

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
