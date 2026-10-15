# 00 — Ambito dell'audit

Data: 2026-10-15 · versione auditata: **v0.75.1-beta** (ultimo commit `77f975c`)

## Cosa viene auditato

La **finestra di controllo** di DJtoGraphikz, per intero e in tutte e tre le
modalità: `simple`, `pro`, `live`. Stesso ambito dell'audit precedente, per
confronto diretto.

- Codice: `src/renderer/App.tsx` e `src/renderer/components/**`
- Stili: `src/renderer/styles/**`
- Fotografia reale della superficie: da catturare con `yarn check:ui pro 0.5`
  sulla build corrente
- Conteggio dei controlli nel DOM vivo, dalla stessa esecuzione

Fuori ambito: la finestra di uscita (non ha interfaccia: è il proiettore,
verificata da `yarn check:output`), il telefono remoto, la pagina OSC/MIDI
come protocolli, i singoli shader/effetti (coperti dal passaggio visivo
`check:shaders` + revisione manuale fatta in questa stessa sessione).

## Chi la usa e per cosa

Utente primario: un VJ (spesso il DJ stesso) che guida le visuali **dal vivo,
al buio, sotto pressione**, a volte con una mano sola perché l'altra è sul
mixer.

Compito primario: **far cambiare l'immagine a tempo con la musica** — scegliere
un effetto o un look, spingerlo sul drop, tornare indietro senza pensarci.

Compito secondario, ma che decide la serata: **arrivare pronti** — ingresso
audio, finestra di uscita sul proiettore giusto, mapping, luci.

## Vincoli

- Stack: Electron + React + three.js, nessun framework di UI, CSS proprio
- Lingua: solo italiano nell'interfaccia
- Pavimento di accessibilità già fissato: contrasto 4.5:1 sul testo, 3:1 sui
  bordi (`yarn check:contrast`), ratchet sulle classi dei bottoni
  (`yarn check:buttons`)
- Il progetto è in beta pubblica: ogni batch esce come release firmata

## Termine di paragone

L'audit del **15 set 2026** (`DESIGN-IS-2026-09-15/03-verdict.md`), sulla
v0.47.0-beta, chiuso a **15/30** con verdetto **REDESIGN** — causa critica:
principio #6 (onestà) crollato da 3 a 1 per otto toast non verificati e tre
label che mentivano sul comportamento reale (Torna al vivo non torna,
Automatico non fa nulla, la guida indica un pannello sbagliato).

Da allora sono uscite **28 release** (v0.48.0 → v0.75.1-beta), incluse almeno
due passate esplicitamente di sistema/design (`feat/ui-sistema`,
`feat/ui-destra`, 2026-10-06: tipografia, densità, focus, contrasto
consolidati) oltre a un'ondata di nuove funzioni (Magic Mapping, livello
Impact, 8+ nuovi effetti industrial). Questo audit misura se le cinque mosse
prescritte il 15 settembre sono state fatte, e se la superficie ha retto il
mese di aggiunte successive.

Pagella precedente, per principio: 1:2 · 2:2 · 3:1 · 4:1 · 5:2 · 6:1 · 7:3 ·
8:1 · 9:1 · 10:1 — totale 15/30.

Le cinque mosse ad alta leva prescritte il 15 settembre (da verificare se
fatte):
1. Verificare ogni scrittura prima del toast di conferma (regola
   `storage.ts:50`)
2. Unificare tre stili di intestazione e cinque pattern di scelta in uno
   ciascuno
3. Condividere i componenti di stato vuoto/caricamento/errore/successo fra
   pannelli
4. Mostrare tutti i controlli per intero (bottone TRANSIZIONE tagliato,
   barra deck), rimuovere comandi a vuoto (Automatico, correggere Torna al
   vivo)
5. Estendere il controllo di contrasto ai bottoni pieni (#fff su #ff4455 =
   3.38:1, sotto soglia 4.5) e a `features.css` (allora non auditato),
   correggere il token `--warn` non definito

## Materiali in ingresso

- La pagella e il verdetto del 15 settembre
- `CHANGELOG.md` v0.48.0 → v0.75.1 (cosa è entrato dopo il 15/30)
- `TODO.md` (cosa è dichiarato aperto di proposito), se presente
