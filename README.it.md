# DJtoGraphikz

[![Ultima release](https://img.shields.io/github/v/release/Maximilione/DJtoGraphikz?label=ultima%20versione&color=00cc6a)](https://github.com/Maximilione/DJtoGraphikz/releases/latest)

[English](README.md) · **Italiano**

Visual generativi in tempo reale per serate techno: ascolta il mixer e segue la musica da solo, su un secondo schermo o un proiettore. App desktop Electron, offline, macOS/Windows/Linux.

<!-- screenshot -->

## Download

**[⬇ Scarica l'ultima versione](https://github.com/Maximilione/DJtoGraphikz/releases/latest)** — gli installer vengono generati automaticamente a ogni release. Prendi solo il file per il tuo sistema (`.blockmap` e `.yml` servono all'auto-update, ignorali).

| Sistema | File | Installazione |
| --- | --- | --- |
| macOS (Apple Silicon) | `DJtoGraphikz-X.Y.Z-arm64.dmg` | Apri il `.dmg`, trascina l'app in **Applicazioni** |
| Windows | `DJtoGraphikz-Setup-X.Y.Z.exe` | Avvia l'installer |
| Linux | `DJtoGraphikz-X.Y.Z.AppImage` | `chmod +x` e avvialo, nessuna installazione |

Le build non sono firmate, quindi al primo avvio il sistema avvisa:

- **macOS** — "app danneggiata" o "sviluppatore non verificato": tasto destro sull'app → **Apri** → **Apri** di nuovo. Se non basta: `xattr -cr /Applications/DJtoGraphikz.app` nel Terminale.
- **Windows** — SmartScreen: **Ulteriori informazioni** → **Esegui comunque**.
- **Linux** — se il doppio click non fa niente, avvialo da terminale.

Al primo avvio l'app chiede accesso a **microfono/ingresso audio** (per ascoltare il mixer) e, solo se usi la webcam come sorgente, alla **camera**.

## Prima serata in 5 passi

1. **Ingresso audio** — l'onboarding chiede l'ingresso: line-in dal mixer, o il microfono. Niente cavo? Trascina un mp3 sul pannello Audio e prova su quello.
2. **Uscita** — scegli il proiettore nel selettore monitor e premi **Fullscreen**. Salva la sala come **posto**: la prossima volta è un click.
3. **Genere** — scegli il genere dell'Auto VJ. Da qui l'app manda avanti la serata da sola.
4. **Soundcheck** — un pulsante nella barra in alto: lista verde/rossa in pochi secondi (ingresso audio, uscita che disegna davvero, fps, ArtNet, telefono, disco).
5. **Tasti di emergenza** — **B** blackout, **F** freeze, **P** panic. Tenuti sono momentanei, toccati restano. **?** apre le scorciatoie.

Opzionale: **📱** nella barra in alto → inquadra il QR → codice a 6 cifre, e il telefono sulla stessa wifi controlla tutto.

## Cosa fa

### Motore visivo

**64 effetti in 7 categorie** — Geometrici (Tunnel, Kaleido, Truchet), Organici (Fluid, Smoke, Space Ghost), Movimento (Swarm, Pulsar, Shatter), Digitali (Matrix, Lasers, Spectrum), Videogame (le torri della PS2, snowboard alla 1080°), Tekno (16 visual scuri guidati dal kick: Flash, Spiral, Bunker…) e Bounce (Balls, Pump, Roll). Ognuno ha 2-3 parametri veri, mappabili all'audio (bass/mid/high/energy/beat) o a un LFO a tempo; **Smart map** fa la mappatura per te con un click, e ogni effetto ha un **mapping consigliato** applicato quando lo scegli (pulsante "Auto", annulla in un click). Una **camera master** (zoom, rotazione, pan, mosaico a specchio, spinta sulla cassa) e la macro **Intensità** agiscono su tutta la scena.

**Post sul frame** — 13 post-FX riordinabili con wet/dry per effetto: Bloom, Chromatic, RGB Split, RGB Delay, Invert, Feedback (scia in basso, MilkDrop al massimo), Mirror (da orizzontale a kaleido), Pixelate, Displace, Film Grain, Scanlines, Frame Glitch, Outline. Più color grade master, tone mapping ACES e motion blur. **16 palette**, un editor, e una palette da qualunque immagine: trascina il flyer del locale sull'ultimo slot.

**Shader** — editor GLSL live con validazione e buffer multi-pass; import da **Shadertoy** (incolla il codice, o il JSON dell'API con i Buffer A-D) e **ISF** (file locali o ~3.700 generator sfogliabili online con le thumbnail). Gli shader importati hanno slider mappabili all'audio e input immagine come ogni altro effetto.

### Auto VJ

**11 generi** — Acid Techno, Hard Tekno, Dark Industrial, Minimal, Trance, Drum & Bass, Ambient, Gabber, Tech House, Psytrance, Bounce Techno — circa **350 scene curate** in tutto (effetto, parametri accordati, mapping audio e i post-FX che ci stanno). Segue il pezzo, non un timer: sente **pausa / salita / groove / picco**, sul primo kick del **drop** taglia su una scena di picco, nel groove tiene una scena per una frase. La **tonalità sceglie la palette** (calda per le maggiori, fredda per le minori), così lo stesso pezzo ha gli stessi colori ogni sera. Salva i tuoi look come scene di un genere e di una fase: entrano in rotazione, o la sostituiscono.

### Tempo e audio

Un beat tracker fatto per la musica da club (spectral flux, aggancio di fase, prior di tempo dal genere) con tap, manuale, ×½/×2, **MIDI Clock** e **Pro DJ Link** (tempo, battito e lettore master dai CDJ Pioneer sulla rete del booth) come alternative. Auto-gain, noise gate, ripresa se il device audio cade. Il **rilevamento del cambio canzone**, dal CDJ o dall'audio stesso, fa avanzare le scalette. Con l'Auto VJ spento, il **silenzio** sfuma il muro su un effetto calmo e la musica riporta il look.

### Controllo dal vivo

Tutto è sulla tastiera (tabella sotto) e **tieni premuto = momentaneo**: un tocco resta, tenere e mollare torna com'era — blackout, freeze, post-FX, effetti, look, pad MIDI, il dito sul telefono. Il **beat-roll** (`,` `.` `/`) fa girare il visual in loop su un quarto, un ottavo o un sedicesimo di battuta. **Look Bank**: 4×4 slot con thumbnail, Shift+1-0 per richiamarli. **MIDI learn** per qualsiasi controller, **telefono** (fino a 4 dispositivi, pairing via QR), **OSC** su UDP `:9700` (`/djg/*`, pronto per TouchOSC).

### Scalette e media

**Scalette**: una sequenza di look, ognuno con la sua durata (secondi, battute, a ogni canzone, o a mano con `N` / `Shift+N`) e la sua transizione, e la sua grafica per passo: immagini, GIF e testi che compaiono con il passo e spariscono col successivo. Tre scalette pronte da 80 minuti (hard tekno, bounce techno, techno) in `docs/scalette/live-4h.json` (Scalette > Importa). Pannello **Media**: immagini/GIF (a tempo), video, webcam e testo come overlay con tutta la catena post. **Deck B** con crossfader: un secondo effetto (5 blend, **maschere** split/radiale/luma/audio) o un **deck video**, una playlist di clip mp4/webm agganciate al BPM.

### Uscite

Finestra di controllo + uscita fullscreen su qualsiasi display, 720p-4K. **Più uscite**, una finestra per muro, ognuna con la sua risoluzione, la sua fetta di scena, gamma/tetto e **keystone** a 4 angoli. La pagina di uscita è servita anche a **OBS** o a un secondo PC in rete (`:9666/output`). **Registrazione** in WebM, screenshot PNG e un **reel**: `V` salva gli ultimi 15-30 s in 9:16, pronti da postare.

### Luci

**DMX via ArtNet**: PAR RGB che seguono la palette e pulsano con energia/basso/beat. **Pixel mapping**: il frame campionato alla risoluzione di un pannello o di una striscia LED (qualunque L×A, cablaggio a serpentina) via sACN (E1.31) o ArtNet, 1-60 fps.

### Posti e soundcheck

Un **profilo del posto** salva la sala per nome: display e risoluzioni di uscita, angoli del keystone, pixel mapping, scheda audio e gain, nodo ArtNet. Il **soundcheck** verifica in pochi secondi che tutto funzioni davvero, compreso un frame riletto dal proiettore. Ogni avvio scrive un **log di sessione** (`?` → apri log) da allegare a una segnalazione, e l'app avvisa quando esce una release nuova.

## Tasti

| Tasto | Fa |
| --- | --- |
| `B` / `F` / `P` | blackout / freeze / panic |
| `[` `]` | master giù / su |
| `Space` | tap BPM |
| `1-0` | effetti |
| `Q` `W` `E` `R` | post-FX |
| `I` | macro intensità |
| `,` `.` `/` | beat-roll 1/4 · 1/8 · 1/16 |
| `Shift+1-0` | look (Shift+click su uno slot lo sovrascrive) |
| `V` | reel: salva gli ultimi 15-30 s |
| `N` / `Shift+N` | scaletta: passo avanti / indietro |
| `?` | scorciatoie |

Tenuto, ognuno è momentaneo: molli e torna com'era.

## Sviluppo

```bash
yarn                 # dipendenze
yarn dev             # Electron + Vite
yarn build           # build di produzione
yarn check:output    # gate di release: il proiettore disegna davvero? (avvia l'app)
yarn check:dryrun    # il beat tracker segue un brano sintetico a 128 BPM
yarn check:sweep     # sweep in-app di ogni effetto e post: fallisce su frame bianco, nero o piatto (avvia l'app)
yarn check:phases    # rigioca una registrazione nel rilevatore di fasi dell'Auto VJ
yarn check:ui        # fotografa la finestra di controllo
yarn package:mac     # .dmg (anche package:win / package:linux)
```

Verifica minima prima di un commit: `npx tsc -p tsconfig.web.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && yarn build`. Regole di progetto (versioning, flusso git, gate di release): [CLAUDE.md](CLAUDE.md). Interni del motore: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Changelog

[CHANGELOG.md](CHANGELOG.md) (Keep a Changelog) e le note di ogni [release](https://github.com/Maximilione/DJtoGraphikz/releases).

## Licenza

Proprietario — tutti i diritti riservati. Dalla v0.53.0 il sorgente è chiuso; le release precedenti sono uscite con licenza MIT e tali restano.
