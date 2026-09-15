# 03 — Verdetto

## REDESIGN

**La finestra di controllo sta a 15/30 e cade su due dimensioni portanti —
comprensibile (1) e onesto (1) — perche' sette release in un giorno hanno
appoggiato le funzioni nuove accanto alla superficie invece che dentro: il
risultato non e' brutto, e' incoerente, e dice all'operatore cose che non sono
vere.**

## Perche' REDESIGN e non REFINE

La regola e' meccanica: totale sotto 20. Ma il motivo vero e' che **#6 e' sceso
da 3 a 1**, ed e' il principio su cui questo progetto aveva costruito la sua
identita': l'audit del 14 settembre gli aveva dato il pieno, e `storage.ts:50`
porta ancora scritta la regola — *"Callers must not show what they did not
save"*. Otto toast la violano, due dei quali scritti oggi. Non e' una svista
puntuale: e' il modo in cui il codice nuovo entra.

E non e' REFINE perche' i difetti non stanno nei pixel ma nella **grammatica**:
tre modi di intestare una sezione, cinque modi di "scegli uno fra N", tre
archivi per lo stesso gesto di salvataggio, uno stato di caricamento che non
esiste. Sono decisioni di struttura. Rifinirle una per una significa rifarle
una per una fra due release.

**Non e' un REDESIGN del prodotto.** Il motore, la pipeline, i gate, la
tastiera e il linguaggio visivo restano: quello che va rifatto e' il **sistema
di superficie** della finestra di controllo.

## Le cinque mosse a maggior leva

1. **#6 — un toast si guadagna il diritto di esistere.** Nessun messaggio di
   conferma senza il ritorno verificato della scrittura; `"Torna al vivo"`
   torna al vivo o cambia nome; la guida dice quello che il bottone fa;
   `"Automatico"` sposta la finestra o sparisce.
   Evidenze: `storage.ts:50` contro `LookBank.tsx:64,69`,
   `PresetPanel.tsx:319-320`, `OutputsPanel.tsx:16,174`, `App.tsx:464-467`;
   `AudioPanel.tsx:352-356`; `QuickGuide.tsx:92-94` contro `App.tsx:394`;
   `OutputsPanel.tsx:102` contro `main/index.ts:354`.
2. **#3/#10 — una grammatica sola per "qui comincia una cosa" e per "scegli uno
   fra N".** Oggi sono tre e cinque. E la striscia rigata sotto i pannelli
   chiusi sparisce.
   Evidenze: `EffectPanel.tsx:308-326` (unico blocco senza `Panel`, unico non
   richiudibile), `App.tsx:708-730`, `PresetPanel.tsx:336`,
   `OverlayPanel.tsx:316-327`, `OutputsPanel.tsx:80-88`;
   `global.css:253-255` + `Panel.tsx:45`.
3. **#8 — stati condivisi invece che scritti a mano.** Un trattamento solo per
   vuoto, caricamento, errore e successo, e i due pannelli nuovi che lo usano.
   Evidenze: `OutputsPanel.tsx:18` (errore ingoiato), `:174` e
   `VenuePanel.tsx:33` (successo al livello sbagliato), `IsfBrowser.tsx:91` e
   `OverlayPanel.tsx:222` (gli unici due caricamenti dell'app).
4. **#2/#4 — i comandi tagliati e quelli civetta.** Il quinto bottone di
   TRANSIZIONE e la barra dei deck si vedono per intero; la sovrascrittura di
   un look ha un percorso da tastiera; le etichette inventate ("Tetto",
   "Spinta", "Prova a secco", "Binding") dicono cosa fanno.
   Evidenze: fotografia (TRANSIZIONE y≈529, barra deck y≈1122);
   `LookBank.tsx:122,180`; `OutputsPanel.tsx:145`; `CameraPanel.tsx:71`;
   `MidiPanel.tsx:31,42`.
5. **#3 — il contrasto che il controllo automatico non vede.** `.btn-danger`
   scrive `#fff` su `#ff4455`: **3,38:1** a riposo, **4,41:1** in hover, sotto
   la soglia che il progetto si e' dato. `#000` sullo stesso rosso darebbe
   6,21. E `check:contrast` va esteso ai comandi pieni e a `features.css`,
   oggi mai letto. Piu' il token inesistente `--warn`
   (`OutputsPanel.tsx:73`), che dipinge `#e0a030`, colore fuori palette.
   Evidenze: `global.css:337-338,341`; `scripts/check-contrast.mjs:17,54`.

## Cosa NON tocca questo verdetto

Il principio 7 sta a 3 e ci resta: il linguaggio visivo non e' il problema.
Il 9 sta a 1 da due audit di fila ed e' l'unico caso in cui la causa e' nel
motore (due loop a 60 Hz che ridisegnano anche a scena ferma, payload da 1,71
MiB non diviso): resta fuori da questo giro, come lo era nel contro-audit.
