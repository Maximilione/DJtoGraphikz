# DJtoGraphikz

[![Ultima release](https://img.shields.io/github/v/release/Maximilione/DJtoGraphikz?label=ultima%20versione&color=00cc6a)](https://github.com/Maximilione/DJtoGraphikz/releases/latest)

[English](README.md) · **Italiano**

Generatore di visual audio-reattivi in tempo reale per serate tekno. Ascolta il mixer (o qualsiasi ingresso audio) e proietta grafica animata a tempo su un secondo schermo o proiettore. App desktop Electron, offline, macOS/Windows/Linux.

<!-- screenshot -->

## Download

**[⬇ Scarica l'ultima versione](https://github.com/Maximilione/DJtoGraphikz/releases/latest)** — installer generati automaticamente a ogni release. Scarica solo il file per il tuo sistema (i `.blockmap` e i `.yml` servono all'auto-update, ignorali):

| Sistema | File | Installazione |
| --------- | ------ | --------------- |
| macOS (Apple Silicon) | `DJtoGraphikz-X.Y.Z-arm64.dmg` | Apri il `.dmg` e trascina l'app in **Applicazioni** |
| Windows | `DJtoGraphikz-Setup-X.Y.Z.exe` | Doppio click sull'installer e segui la procedura |
| Linux | `DJtoGraphikz-X.Y.Z.AppImage` | `chmod +x` sul file e avvialo direttamente (nessuna installazione) |

Le build non sono firmate/notarizzate, quindi al primo avvio il sistema mostra un avviso:

- **macOS** — se compare "app danneggiata" o "sviluppatore non verificato": tasto destro sull'app → **Apri** → **Apri** di nuovo nel popup. Se non basta: `xattr -cr /Applications/DJtoGraphikz.app` nel Terminale, poi riapri.
- **Windows** — SmartScreen blocca l'installer: **Ulteriori informazioni** → **Esegui comunque**.
- **Linux** — nessun avviso; se il doppio click non funziona, avvia da terminale: `./DJtoGraphikz-X.Y.Z.AppImage`.

Al primo avvio l'app chiede accesso a **microfono/ingresso audio** (serve per ascoltare il mixer) e, solo se usi la webcam come sorgente, alla **camera**.

## Quick start (prima serata, senza aiuto)

1. Installa dal `.dmg` (trascina l'app in Applicazioni) e aprila.
2. Al primo avvio parte l'onboarding: scegli l'**ingresso audio** (line-in dal mixer o microfono) e il **genere** musicale.
3. Fatto: l'**AutoVJ** parte da solo e cambia effetti, post-FX e palette a tempo di musica.
4. Tasti da sapere subito: **B** blackout · **F** freeze · **Space** tap BPM · **Shift+1-0** richiama i look salvati.
5. Collega il telefono: bottone **📱** in top bar → inquadra il **QR** → inserisci il **codice** a 6 cifre. Il telefono (stessa wifi) controlla tutto.
6. Manda l'output sul proiettore: scegli il display dal **selettore monitor** e premi **Fullscreen**.
7. Se qualcosa non torna, il bottone **?** rilancia la configurazione.

## Funzioni

### Motore visivo

- **21 effetti GLSL** in 4 categorie (Geometric, Organic, Motion, Digital), con transizioni crossfade/wipe/radial/dissolve anche beat-synced.
- **50 parametri curati** — 2-3 slider veri per effetto (segments, density, zoom, twist…), ognuno **mappabile all'audio** (bass/mid/high/energy/beat, depth ±100%) o a un **LFO** tempo-sync (sine/saw/square, rate 1/4…32 battute).
- **Look Bank** — griglia 4×4 con thumbnail reali: click su slot vuoto salva il look completo, click applica con transizione, hotkey Shift+1-0.
- **Deck A/B + crossfader** — secondo deck con 5 blend mode (mix, add, screen, multiply, difference); il deck B fa da blind mode.
- **Post-FX chain** — 9 effetti riordinabili con wet/dry per effetto (Bloom, RGB Split, Chromatic, Feedback, Grain, Scanlines, Pixelate, Mirror, Invert) + color grade master (exposure/contrast/saturation/lift/vignette), tone mapping ACES, motion blur temporale.
- **16 palette** + editor custom, transizioni colore fluide, cycling a timer o a beat.
- **AutoVJ** — 8 generi, rotazione senza ripetizioni (bag), switch sul downbeat, energia adattiva.

### Audio

- Beat detection a spectral flux con soglia adattiva; BPM auto (realtime-bpm-analyzer), tap, manuale, ×½/×2.
- Envelope follower, auto-gain, noise gate, input gain; auto-recovery se il device audio cade.
- Vocabolario esteso per gli shader: hit per banda (kick/synth/hats), clock gated, sub/presence, beat/bar phase.

### Media

- **Pannello Media unificato**: immagini/GIF, video, **webcam** e **testo** come overlay — stessi controlli (opacity, scale, posizione, displacement) e tutti i post-FX gratis.
- GIF sincronizzate al beat/BPM; libreria persistente in `~/.djtographikz/assets` (ri-aggiunta a un tap dopo il riavvio).

### Controllo remoto

- **Telefono** — server HTTP integrato, pairing via QR + codice a 6 cifre, fino a 4 dispositivi: la pagina mobile controlla tutto (Look Bank, parametri, post chain, grade, deck B, AutoVJ) ed è sempre allineata alla versione dell'app.
- **OSC** — server UDP su `:9700`, indirizzi `/djg/*` (`/djg/effect`, `/djg/look/N`, `/djg/param/<chiave>`, `/djg/crossfade`, blackout/freeze/autovj/tap…). Pronto per TouchOSC.
- **MIDI learn** — pannello MIDI (Pro): armi Learn, muovi un controllo sul controller, binding fatto e persistito. CC = fader, note = trigger.

### Shader e ISF

- Editor GLSL live con validazione (gli shader rotti vengono respinti con l'errore esatto).
- **Libreria ISF online** — sfoglia ~3.700 generator di [editor.isf.video](https://editor.isf.video) con thumbnail e ricerca, import con un click; "Importa file…" accetta anche gli `.zip` scaricati dal sito.
- Gli shader in `~/.djtographikz/isf` compaiono come categoria nel pannello Effects, con slider automatici audio-mappabili; **Smart map** li aggancia all'audio in un colpo solo in base al nome.
- Shader con **input image**: scegli un'immagine per ogni input e finisce dentro lo shader (anche sull'output).

### Output e registrazione

- Doppia finestra: controllo + output fullscreen su qualsiasi display, risoluzione 720p-4K.
- **Registrazione WebM** (🔴 in top bar, VP9 12Mbps) e **screenshot PNG** (📷).

## Sviluppo

```bash
yarn            # dipendenze
yarn dev        # sviluppo (Electron + Vite)
npx tsc -p tsconfig.web.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && yarn build   # verifica minima
yarn package:mac   # .dmg (anche package:win / package:linux)
```

Regole di progetto (versioning, flusso git): [CLAUDE.md](CLAUDE.md).

## Changelog

Le novità di ogni versione sono in [CHANGELOG.md](CHANGELOG.md) (formato Keep a Changelog) e nelle note di ogni [release](https://github.com/Maximilione/DJtoGraphikz/releases).

## Licenza

MIT
