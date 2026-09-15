# Evidenze — peso, attrito, costo a riposo (agente 4)

Misurato su `out/` gia' compilato. App non lanciata, non ricompilata.

## Payload iniziale

| file | byte |
|---|---:|
| `Engine-BESAkKrl.js` | 1.138.452 |
| `main-DpDKwVN-.js` | 605.213 |
| `main-Cek0S8Ph.css` | 46.947 |
| `index.html` | 453 |

**Totale iniziale reale: 1.791.065 B (1,71 MiB)**, di cui **1,66 MiB di JS**.
Su `file://` viaggia **non compresso**: il gzip non c'entra.

**Chunk lazy: zero.** `Engine` non e' diviso: riga 1 di `main` e' un import
statico. E' un chunk condiviso solo perche' `index.html` e `output.html` sono
due entry Vite. Nessun `import()` dinamico in tutto il bundle.

Cosa pesa dentro Engine: **67 import `?raw` di shader** (`Engine.ts:7`+),
155.819 B di GLSL inline, piu' `three@0.170`.

## Rete

**4 caricamenti `file://`** per la vista principale. Zero font (nessun
`@font-face`, nessun `url()`), zero immagini all'avvio, zero `data:` nel CSS.

Rete in uscita: **niente sul percorso critico**. Una richiesta a GitHub a
**T+15 s**, solo nelle build impacchettate (`update-check.ts:30,49`). Il server
del telefono invece **apre la porta su 0.0.0.0 da T+0 senza interruttore**
(`remote-server.ts:165`, chiamato da `index.ts:518`).

## Time to interactive

**Non misurato, stimato.** Nessun `performance.mark`/`measure` in tutto `src/`,
e `debug-log.ts` timbra le righe ma non scrive mai un marcatore di avvio
completato: non c'e' un TTI da recuperare nemmeno dai log vecchi. Base della
stima: 1,66 MiB di JS da analizzare, piu' il costruttore di `Engine`
(`Engine.ts:598-618`) che crea sincronicamente renderer e 22 materiali prima
del primo frame.

## Costo a riposo (modalita' di default: `simple`)

| # | dove | ritmo | cosa fa | si ferma? |
|---|---|---|---|---|
| 1 | `Engine.ts:2326` | ~60 Hz | `renderFrame()` completo **anche se non e' cambiato niente** | mai (solo la sospensione rAF di Chromium) |
| 2 | `Engine.ts:2505` | ~60 Hz × 4 | fan-out ai listener audio: AutoVJ, punto beat, flash, FPS ≈ **240 chiamate/s** | mai |
| 3 | `App.tsx:361` | 1000 ms | `setState` dello stato audio | mai |
| 4 | `AudioPanel.tsx:145` | 500 ms | 6 getter + fino a 5 `setState` | **no, nemmeno a pannello chiuso** |
| 5 | `AudioPanel.tsx:325` | ~60 Hz | disegno spettro | si ferma a pannello chiuso **per caso** (`:271` esce senza ri-schedularsi) e **non riparte alla riapertura** |
| 6 | `App.tsx:189` | 30 Hz | IPC dello snapshot intero | guidato dagli eventi |
| 7 | `App.tsx:192` | 400 ms | scrittura sincrona in localStorage dello snapshot **con le immagini base64** | guidato dagli eventi |
| 9 | `OverlayPanel.tsx:424` | 500 ms per miniatura | `drawImage` 114×64 | solo pro, scala con la libreria dell'utente |

Correzioni all'ipotesi di partenza: il **watchdog a 125 Hz e' solo della
finestra di uscita** (`Engine.ts:2384` esce se non `remote`); il **polling
/state a 1500 ms gira nel browser del telefono**, non qui; il **sender DMX non
e' un timer** e a riposo e' una chiamata che esce subito.

Nel main, sempre acceso: `setInterval(keepOutputOnItsDisplay, 4000)`
(`index.ts:512`).

**Riga di fondo:** due loop WebGL completi a 60 Hz (preview + uscita) che
ridisegnano incondizionatamente anche a schermo fermo, piu' ~240 chiamate/s di
listener, piu' due poll React che nessuno stato di chiusura pannello ferma.

## Animazioni a riposo

**Animazioni CSS infinite: zero.** Un solo `@keyframes` in tutto il progetto
(`features.css:77`, entrata del toast, 0,15 s una volta). Sei transizioni, tutte
a 140 ms.

**`prefers-reduced-motion` rispettato globalmente** (`global.css:176-181`,
selettore universale). Non arriva pero' ai due loop rAF ne' al flash sul beat
(`App.tsx:343-351`, muta `style.opacity` a mano).

## Cosa copre l'interfaccia all'avvio

- **Primo avvio: 1 modale bloccante** — onboarding a piu' passi
  (`App.tsx:681`, condizione `:110`), finche' non lo completi.
- **T+15 s**: toast aggiornamento disponibile (solo build impacchettate).
- Condizionali: toast di quota esaurita (`storage.ts:58` — realistico, visto lo
  scrittore ogni 400 ms), toast di comando remoto (il server ascolta da T+0).
- **Avvio successivo: 0 modali.**

Quattro overlay (remote, menu aiuto, scorciatoie, guida) sono solo su richiesta.

## Buchi dichiarati

TTI non misurato; nessuna cifra di CPU/GPU a riposo (servirebbe lanciare
l'app); la sospensione rAF a finestra coperta e' dedotta da un commento, non
verificata; su schermo a 120 Hz il conto del punto 2 raddoppia.
