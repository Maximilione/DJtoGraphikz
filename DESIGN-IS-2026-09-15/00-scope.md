# 00 — Ambito dell'audit

Data: 2026-09-15 · versione auditata: **v0.47.0-beta** (commit di merge `2127f13`)

## Cosa viene auditato

La **finestra di controllo** di DJtoGraphikz, per intero e in tutte e tre le
modalita': `simple`, `pro`, `live`.

- Codice: `src/renderer/App.tsx` e `src/renderer/components/**`
- Stili: `src/renderer/styles/**`
- Fotografia reale della superficie: `/tmp/djg-ui.png`, modalita' pro, zoom 0.5,
  catturata da `yarn check:ui pro 0.5` sulla build 0.47.0-beta
- Conteggio dei controlli nel DOM vivo, dalla stessa esecuzione:
  **SIMPLE 115 · PRO 150 · LIVE 37**

Fuori ambito: la finestra di uscita (non ha interfaccia: e' il proiettore), il
telefono remoto, la pagina OSC/MIDI come protocolli.

## Chi la usa e per cosa

Utente primario: un VJ (spesso il DJ stesso) che guida le visuali **dal vivo, al
buio, sotto pressione**, a volte con una mano sola perche' l'altra e' sul mixer.

Compito primario: **far cambiare l'immagine a tempo con la musica** — scegliere
un effetto o un look, spingerlo sul drop, tornare indietro senza pensarci.

Compito secondario, ma che decide la serata: **arrivare pronti** — ingresso
audio, finestra di uscita sul proiettore giusto, mapping, luci.

## Vincoli

- Stack: Electron + React + three.js, nessun framework di UI, CSS proprio
- Lingua: **solo italiano** nell'interfaccia (obiettivo di design della fase A3)
- Pavimento di accessibilita' gia' fissato: contrasto 4.5:1 sul testo, 3:1 sui
  bordi (`yarn check:contrast`), ratchet sulle classi dei bottoni
  (`yarn check:buttons`)
- Il progetto e' in beta pubblica: ogni batch esce come release firmata

## Termine di paragone

L'audit del **14 set 2026** (`DESIGN-IS-2026-09-14/05-controaudit.md`), sulla
v0.40.0-beta, chiuso a **21/30** con verdetto REFINE. Da allora sono uscite
sette release che hanno **aggiunto funzioni** (I1 MIDI Clock, P1 file audio,
S1 momentanei, S3 intensita', Q1 camera, P2 Posti, I5 piu' uscite): questo
audit misura se la superficie ha retto l'aggiunta.

Pagella precedente, per principio: 1:2 · 2:2 · 3:2 · 4:2 · 5:2 · 6:3 · 7:3 ·
8:2 · 9:1 · 10:2.

## Materiali in ingresso

- La pagella e il contro-audit del 14 set
- `TODO.md` (cosa e' dichiarato aperto di proposito)
- `CHANGELOG.md` v0.41.0 → v0.47.0 (cosa e' entrato dopo il 21/30)
