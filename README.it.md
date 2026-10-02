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

### Interfaccia

- Tre modalita' — **Semplice**, **Pro**, **Live** — che sono tre viste della stessa app: la stessa griglia di effetti, le stesse palette, lo stesso Auto VJ, con piu' o meno pannelli intorno.
- Ogni pannello ricorda se era aperto o chiuso, e i pannelli della colonna di destra si comportano come una fisarmonica: aprirne uno chiude gli altri.
- Tutta l'app si guida da tastiera, con il focus sempre visibile.

### Motore visivo

- **65 effetti GLSL** in 7 categorie (Geometric, Organic, Motion, Digital, Videogame — le torri della PS2, snowboard alla 1080° — Tekno e Bounce), con transizioni crossfade/wipe/radial/dissolve anche beat-synced.
  - **Bounce** — per la bounce techno: **Balls** (una palla per beat, si schiaccia a terra), **Pump** (quadrati annidati che si abbassano sul kick e gonfiano sull'offbeat: il sidechain disegnato) e **Roll** (corsie di blocchi grigi che rotolano una contro l'altra, gonfiano sull'offbeat dove sta il basso, una corsia d'accento che scende di una corsia a battuta). Piu' il genere Auto VJ **Bounce Techno**: palette scure (mono, sangue, acciaio, ambra), pompa e rullo nel groove, strobo al picco.
  - **Tekno** — 16 visual scuri guidati dal kick, per una stanza nera: **Flash** (strobo a blackout), **Impact** (onde d'urto sul beat), **Spiral** e **Tribal** (ipnotici in bianco e nero, scattano di un dente a battuta), **Xerox** a mezzatinta, **Barcode**, **Hazard** a chevron, **Counter** (contatore di battute a sette segmenti), **Static**, **Radar**, **Cage** (cubi wireframe annidati), **Cracks**, **Bunker** (corridoio di cemento raymarchato con la lampada che sfarfalla), **Rain**, **Eclipse**, **Blinds**. Tutti in rotazione nell'Auto VJ per Hard Tekno, Dark Industrial, Acid Techno e Gabber.
  - **Spectrum** — l'analizzatore per quello che e': barre logaritmiche con i cappelli di picco, specchiate, oscilloscopio sopra. **Smoke** — un pennacchio ad advezione semi-lagrangiana, tre bocchette alimentate ognuna dalla sua banda. **Caustics**, **Gyroid** (superficie minima raymarchata), **Truchet**, **Quasicrystal**, **String art**, **ASCII**.
  - **Pulsar** — le creste di *Unknown Pleasures* disegnate come linescape in prospettiva: un unico terreno tagliato in fette dal vicino al lontano con rimozione delle linee nascoste, e i lati piatti come sulla copertina. Il campo scorre verso la camera agganciato al beat clock, e ogni battuta forte alza una cresta che arriva insieme al terreno.
- **~85 parametri curati** — 2-3 slider veri per effetto (segments, density, zoom, twist…), ognuno **mappabile all'audio** (bass/mid/high/energy/beat, depth ±100%) o a un **LFO** tempo-sync (sine/saw/square, rate 1/4…32 battute).
- **Camera master** — zoom, rotazione, pan, mosaico a specchio e spinta sulla cassa applicati a tutta la scena **prima** dei post-FX: sei cursori che agiscono su tutti i 46 effetti e sui ~3.700 ISF insieme, nessuno dei quali sa che esiste. Fuori dall'inquadratura specchia invece di sbavare o andare in nero. Da pannello, MIDI, OSC `/djg/cam/*` e telefono.
- **Macro Intensità** — un fader solo (tasto **I**, MIDI, OSC, telefono, barra in alto) che alza insieme velocità, reattività, densità e il wet della catena post, con un peso per parametro. **A zero la scena è esattamente quella che hai impostato**: la macro agisce quando i parametri vengono risolti, non li riscrive.
- **Tieni premuto = momentaneo** — un tocco breve lascia acceso, tenere premuto e mollare torna com'era. Vale per blackout, freeze, i post-FX su QWER, gli effetti 1-0, i look su Shift+1-0, i pad MIDI (note-on/note-off) e il dito sul telefono. Nessuna modalita' da ricordare al buio: decide il tasto, in base a quanto lo tieni.
- **Soundcheck** — un pulsante: lista verde/rossa in pochi secondi — ingresso audio, finestra di output che disegna davvero (frame letto dal proiettore, come il gate di release), fps alla risoluzione scelta per entrambe le finestre, pacchetto ArtNet, URL del telefono, spazio disco.
- **Deck video** — il deck B puo' essere una playlist di clip mp4 (H.264)/webm: velocita' agganciata al BPM (rate = BPM live / BPM nativo della clip), cambio clip sul giro di battuta ogni N battute, stessi blend e maschere di un effetto; la finestra di uscita segue via stato condiviso. I pack HAP/ProRes vanno convertiti prima.
- **Maschere fra i deck** — oltre ai 5 blend: split verticale/orizzontale, radiale, luma-key e maschera guidata dall'audio (il bordo segue basso e beat); con una maschera il crossfader e' la posizione del bordo, con regolazione della morbidezza.
- **Beat-roll** — tieni `,` `.` `/` e l'orologio dell'effetto gira in loop su un quarto, un ottavo o un sedicesimo di battuta: il loop roll in immagine. Tocca per bloccarlo, tocca ancora per lasciarlo. Niente buffer di frame: gli shader sono funzioni del tempo, far girare il tempo e' rigiocare i frame.
- **Palette da un'immagine** — trascina il flyer o il logo del locale sull'ultimo slot delle palette: un k-means sulla miniatura prende il colore dominante e i due piu' lontani da lui, e la palette e' tua (tasto destro per toglierla).
- **Scalette con grafica** — ogni passo porta le sue immagini, GIF e testi (dalla libreria media, da file o digitati) che compaiono con il passo e spariscono col successivo; i passi avanzano a secondi, a battute, **a ogni canzone** o a mano (`N` / `Shift+N`); il pulsante Prova mostra un passo senza avviare la scaletta.
- **Rilevamento cambio canzone** — da Pro DJ Link (id della traccia sul lettore master) o, senza CDJ, dall'audio (tempo che si sposta e resta, tonalita' che cambia e resta, pausa lunga seguita dal drop; un minuto di cooldown); il pannello Audio mostra l'ultimo cambio e il motivo.
- **Post sul frame** — Feedback ora deforma (zoom, rotazione, deriva, decay dall'amount: scia in basso, MilkDrop al massimo), piu' **RGB Delay** (canali da frame diversi), **Displace** (onde e noise che spostano i pixel sul basso), **Frame Glitch** (righe che saltano, tear e bleed sui colpi) e **Outline** (contorni neon Sobel nel colore 1); **Mirror** passa per orizzontale / verticale / quad / kaleido 6 / kaleido 8 con l'amount.
- **Look Bank** — griglia 4×4 con thumbnail reali: click su slot vuoto salva il look completo, click applica con transizione, hotkey Shift+1-0.
- **Scalette** — una sequenza di look, ognuno tenuto per il suo tempo: li peschi dal Look Bank o prendi quello che c'è sullo schermo, li riordini trascinando, e a ogni passo dai i suoi secondi o le sue battute e la sua transizione. Le scalette salvate si riaprono nell'editor, girano in loop e si esportano in JSON.
- **Deck A/B + crossfader** — secondo deck con 5 blend mode (mix, add, screen, multiply, difference); il deck B fa da blind mode.
- **Post-FX chain** — 9 effetti riordinabili con wet/dry per effetto (Bloom, RGB Split, Chromatic, Feedback, Grain, Scanlines, Pixelate, Mirror, Invert) + color grade master (exposure/contrast/saturation/lift/vignette), tone mapping ACES, motion blur temporale.
- **16 palette** + editor custom, transizioni colore fluide, cycling a timer o a beat.
- **Auto VJ** — 11 generi con ~28 **scene curate** ciascuno (effetto + parametri accordati + mapping audio + i post-FX che gli stanno bene), e segue il pezzo invece di un timer:
  - **Fasi.** L'escursione del basso grezzo dice se c'e' il kick, l'energia contro la sua media lunga quanto spinge la sala: **pausa / salita / groove / picco**. Ogni scena e' scritta per una fase, quindi il breakdown ha una scena scura e lenta, la salita una scena che cresce con l'energia, e il picco ha gli strobo. Quattro spie sotto lo spettro mostrano quale fase la macchina sente.
  - **Il drop.** Il kick che rientra dopo una pausa taglia la scena su quel primo kick, senza dissolvenza, verso una scena di picco con una palette nuova. Tutto il resto aspetta il battere.
  - **Frasi.** Nel groove una scena dura una frase (8 battute per la techno, 16 per la minimal, 4 per il drum & bass), la meta' al picco, il doppio in pausa. La palette cambia una volta ogni quattro scene.
  - **Coerenza.** Due scene della stessa famiglia visiva (due tunnel, due cose radiali) non si susseguono mai; un effetto non torna per tre cambi. Il silenzio e' una pausa, non una slot machine.
  - **Tonalita' → colore.** Un rilevatore di tonalita' a croma (profili di Krumhansl, finestra 8 s) nomina la tonalita'; quando la palette cambia e' quella del genere piu' vicina alla tonalita' sul cerchio delle quinte, calda per le maggiori, fredda per le minori: lo stesso pezzo ha gli stessi colori ogni sera.
  - **Scene tue.** Salva il look corrente (effetto, parametri, mapping audio, catena post) come scena di un genere e di una fase; entra in rotazione, o la sostituisce per le fasi che hai scritto ("solo le mie").

### Audio

- **Prova a secco con un file** — trascini un mp3 o un wav nel pannello audio (o lo scegli da "Prova a secco con un file…") e l'app analizza quello al posto dell'ingresso, con play/pausa, scorrimento e ripetizione. Tutto il lavoro su beat, BPM ed envelope era verificabile solo in serata: adesso lo e' alla scrivania.
- **MIDI Clock in ingresso** — tempo e posizione nella battuta presi dal cavo invece che stimati dall'aria: 24 tick per movimento, piu' start/stop e puntatore di posizione, dal mixer, dal CDJ o da Traktor. Modalita' **MIDI** nel pannello audio; funziona anche **senza line-in**, con il solo cavo MIDI collegato.
- Beat tracking a spectral flux logaritmico con soglia mediana+MAD, fase agganciata (PLL) e stima BPM propria (griglia timestamp 100Hz, voto kick+spettro pieno, prior dal genere); BPM auto (doppio stimatore), tap, manuale, ×½/×2.
- Envelope follower, auto-gain, noise gate, input gain; auto-recovery se il device audio cade.
- Vocabolario esteso per gli shader: hit per banda (kick/synth/hats), clock gated, sub/presence, beat/bar phase, un beat clock continuo.
- **`uSpectrum`** — lo spettro intero come texture, non cinque numeri: 512 bin logaritmici (20Hz–20kHz) piu' la traccia dell'oscilloscopio, gli stessi dati anche sul proiettore. Vedi `docs/ARCHITECTURE.md`.

### Media

- **Pannello Media unificato**: immagini/GIF, video, **webcam** e **testo** come overlay — stessi controlli (opacity, scale, posizione, displacement) e tutti i post-FX gratis.
- GIF sincronizzate al beat/BPM; libreria persistente in `~/.djtographikz/assets` (ri-aggiunta a un tap dopo il riavvio).

### Controllo remoto

- **Telefono** — server HTTP integrato, pairing via QR + codice a 6 cifre, fino a 4 dispositivi: la pagina mobile controlla tutto (Look Bank, parametri, post chain, grade, deck B, AutoVJ) ed è sempre allineata alla versione dell'app.
- **OSC** — server UDP su `:9700`, indirizzi `/djg/*` (`/djg/effect`, `/djg/look/N`, `/djg/param/<chiave>`, `/djg/crossfade`, blackout/freeze/autovj/tap…). Pronto per TouchOSC.
- **MIDI learn** — pannello MIDI (Pro): armi Learn, muovi un controllo sul controller, binding fatto e persistito. CC = fader, note = trigger.

### Shader e ISF

- **Effetti a geometria** — un effetto puo' disegnare geometria vera invece di un quad fullscreen: nuvole di punti, mesh istanziate, modelli. Il primo: **Swarm**, 36.864 particelle la cui posizione vive in un buffer di simulazione e viene letta dal vertex shader, quindi la CPU non tocca un vertice.
- **Effetti multi-pass con buffer persistenti** — un effetto puo' avere pass di simulazione che rileggono quello che hanno scritto al frame prima: e' quello che serve a reaction-diffusion, fluidi e a qualsiasi simulazione cellulare, e che un singolo pass fullscreen non puo' fare. Il primo: **React**, una reaction-diffusion di Gray-Scott in cui il kick inietta. Vedi `docs/ARCHITECTURE.md`.
- Editor GLSL live con validazione (gli shader rotti vengono respinti con l'errore esatto), **multi-pass**: marca una sezione con `//!DJG_BUFFER A` e quella si prende un buffer persistente tutto suo.
- **Import Shadertoy** — incolla il GLSL per uno shader a un pass, oppure dagli il JSON dell'API di Shadertoy e ti porti dietro anche i **Buffer A-D**; gli `iChannelN` vengono collegati, i canali texture diventano immagini da scegliere.
- **ISF multi-pass** importabili: ogni voce di `PASSES` diventa un buffer persistente.
- **Libreria ISF online** — sfoglia ~3.700 generator di [editor.isf.video](https://editor.isf.video) con thumbnail e ricerca, import con un click; "Importa file…" accetta anche gli `.zip` scaricati dal sito.
- Gli shader in `~/.djtographikz/isf` compaiono come categoria nel pannello Effects, con slider automatici audio-mappabili.
- **⚡ Smart map** (in testa al pannello Parametri, per qualsiasi effetto): un tasto mappa tutti i parametri all'audio analizzando nome e uso reale nel codice dello shader (geometria→bass, colori→LFO lento, soglie→beat), con budget di ruoli per non strobare tutto insieme e Annulla nel toast.
- Shader con **input image**: scegli un'immagine per ogni input e finisce dentro lo shader (anche sull'output).

### Luci e palco

- **Idle sul silenzio** — con l'Auto VJ spento, N secondi senza musica sfumano il muro su un effetto calmo a tua scelta, e la musica riporta da sola il look di prima.
- **DMX via ArtNet** — PAR RGB che seguono la palette e pulsano con energia/bass/beat (flash sul beat opzionale); UDP puro, universo/canale base/numero fixture configurabili.
- **Mapping per uscita** — keystone/quad-warp a 4 angoli, uno per finestra di uscita: scegli l'uscita nel pannello Mapping e trascina i suoi angoli; salvato col profilo del posto.
- **Pro DJ Link** (opzionale) — tempo, battito e lettore master direttamente dai CDJ Pioneer sulla rete del booth (UDP 50000–50002): si sceglie come modo BPM nel pannello Audio; il computer va collegato allo stesso switch dei lettori. Nessuna dipendenza nativa; titolo del brano non ancora disponibile.
- **Uscita OBS / secondo PC** — la pagina del proiettore e' servita anche su `http://<ip>:9666/output?token=…` (pannello Remote → Copia): aprila come Browser Source in OBS o in un browser su un altro computer in rete. E' un secondo render, costa GPU alla macchina che la apre; per la cattura locale resta gratis la window-capture di OBS.
- **Reel** — tiene gli ultimi 30 s dello show in 9:16; `V` (o il drop dell'Auto VJ, a scelta) salva un WebM di 15–30 s dritto in Download, pronto da postare.
- **Pixel mapping** — il frame proiettato campionato alla risoluzione di un pannello o di una striscia LED (qualunque L×A, cablaggio a serpentina), 170 pixel per universo, via **sACN (E1.31) multicast** o ArtNet; lettura GPU asincrona, 1–60 fps, salvato con il profilo del posto.
- **Projection mapping** — trascina i 4 angoli (keystone/quad-warp) per adattare l'immagine a un proiettore storto.
- **Più uscite** — una finestra per muro: scegli lo schermo, scrivi la risoluzione vera del pannello (anche 1536×256) e che pezzo della scena mostra (tutto, metà, una striscia). Gamma e tetto per uscita, perché il LED schiaccia i neri e a bianco pieno è inguardabile. Un muro LED dietro al suo processore è un display come gli altri; il pannello avvisa quando i pixel totali sono più di quanti una GPU ne disegni.
- **Posti** — salva il locale per nome: display e risoluzione di uscita, i 4 angoli del mapping, scheda audio e gain, nodo ArtNet e master. La seconda serata nello stesso posto è un click; se il display salvato non è collegato viene saltato e te lo dice.

### Output e registrazione

- Doppia finestra: controllo + output fullscreen su qualsiasi display, risoluzione 720p-4K; preview riducibile a striscia per dare spazio ai pannelli.
- **Registrazione WebM** (🔴 in top bar, VP9 12Mbps) e **screenshot PNG** (📷).
- **Notifica aggiornamenti** — l'app controlla le release GitHub e ti porta all'installer più recente.
- **Log di sessione** — ogni avvio scrive in `~/.djtographikz/logs/` (programma, finestra di controllo e finestra output, piu' la topologia degli schermi); si apre da **?** -> "Apri log della sessione" e si allega a una segnalazione.

## Sviluppo

```bash
yarn            # dipendenze
yarn dev        # sviluppo (Electron + Vite)
npx tsc -p tsconfig.web.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && yarn build   # verifica minima
yarn check:output   # gate di release: il proiettore mostra davvero un'immagine?
yarn check:ui       # fotografa la finestra di controllo (check:ui simple 0.34)
yarn check:dryrun   # analizza un brano sintetico a 128 BPM e verifica che l'app lo segua
yarn check:phases mix.mp3 --genre hard-tekno --cues mix.cues   # rigioca una registrazione dell'impianto nel rilevatore di fasi dell'Auto VJ, in silenzio: dove ha sentito pause e drop
yarn check:momentary # tocco contro pressione lunga
yarn check:intensity # la macro a zero restituisce la scena identica
yarn package:mac   # .dmg (anche package:win / package:linux)
```

Regole di progetto (versioning, flusso git): [CLAUDE.md](CLAUDE.md).

## Changelog

Le novità di ogni versione sono in [CHANGELOG.md](CHANGELOG.md) (formato Keep a Changelog) e nelle note di ogni [release](https://github.com/Maximilione/DJtoGraphikz/releases).

## Licenza

Proprietario — tutti i diritti riservati. Dalla v0.53.0 il sorgente e' chiuso; le release precedenti sono uscite con licenza MIT e tali restano.
