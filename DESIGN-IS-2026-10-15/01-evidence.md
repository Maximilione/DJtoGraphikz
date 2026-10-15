# 01 — Evidenza raccolta

Cinque subagent, in parallelo, ciascuno con citazioni file:line. Consolidato
qui senza punteggi (i punteggi sono nel 02).

## Strutturale (→ #2, #4, #5, #10)

- 239 tag interattivi letterali nel sorgente (`<button>`, `<select>`,
  `<input>`, `<textarea>`, `role="button"`) su `App.tsx` +
  `components/**`; non ri-misurato dal vivo per modalità (richiederebbe
  avviare l'app, evitato — gate di lancio riservato alle release).
- Profondità massima: 6 livelli (`App → PresetPanel → Panel → SliderRow →
  NumberInput → input`).
- **Intestazioni di pannello**: unificate in un solo componente
  `Panel.tsx:32-48` (il suo stesso docstring registra il fix), usato in 12
  file. Eccezione rimasta: `EffectPanel.tsx:312-331` ha ancora il proprio
  `.panel` + `.tab-bar`, non usa `<Panel>` — la stessa eccezione segnalata
  a settembre.
- **Pattern "chip"**: NON unificato — 4 implementazioni indipendenti con
  classi diverse: `pm-chip` (ParamControls.tsx:145), `seq-chip`
  (PresetPanel.tsx:525), `output-chip` (App.tsx:1198), chip Reel
  (OutputsPanel.tsx:173).
- **Salva-poi-toast**: duplicato per pannello, nessun helper condiviso oltre
  `storage.ts` — `PresetPanel.tsx:36`, `VenuePanel.tsx:21`,
  `OutputsPanel.tsx:22,29`, `DmxPanel.tsx:49`, `AutoVJPanel.tsx:51`.
- **Codice morto**: 14 import/tipi sostanzialmente inutilizzati (oltre a 11
  `import React` innocui sotto JSX automatico) — `App.tsx:29,45`,
  `EffectPanel.tsx:6,9,15`, `LookBank.tsx:4,6`, `PresetPanel.tsx:1,4`,
  `SimplePanel.tsx:8`.
- **Regola "verifica prima del toast"**: per lo più rispettata ora, MA
  `OutputsPanel.tsx:29` (`saveOutputs()`) ignora il booleano di ritorno di
  `writeJson`; il chiamante (`OutputsPanel.tsx:195-198`) mostra comunque il
  toast di successo.
- **"Torna al vivo"**: ancora rotto. `AudioPanel.tsx:490` chiama
  `stopAudio` (`AudioPanel.tsx:309-314` → `AudioAnalyzer.ts:440-446,473`),
  che ferma tutto e NON riavvia l'ascolto dal device — l'utente deve poi
  premere "Avvia audio" a parte. Label dice "torna al vivo", il
  comportamento è "fermati e aspetta".
- **"Automatico"** (selezione display in Outputs): ora funzionale —
  `displayId: null` risolto in `main/index.ts:264` al primo display
  esterno disponibile.

## Visivo (→ #3, #5, #8)

- **Spaziatura**: 8 token (`--s1`…`--s8`), ma 11 valori letterali distinti
  convivono ancora (82 occorrenze) — i token sono maggioranza, non hanno
  eliminato i letterali.
- **Tipografia**: **completamente tokenizzata** ora — zero `font-size`
  letterali in CSS o inline nei componenti. Vero miglioramento rispetto a
  settembre. (`--fs-sm`/`--fs-md` duplicano 13px: 7 valori distinti sotto 8
  nomi.)
- **Colore**: 21 token nominati, ma 45 valori esadecimali/rgba letterali
  distinti nei CSS + 10 esadecimali inline nei `.tsx`
  (`EffectPanel.tsx:46`, `AudioPanel.tsx:358,396,412`,
  `OutputsPanel.tsx:90`, `RemoteModal.tsx:20`, `ShaderEditor.tsx:177,213`).
  Sceso dal ~51/29 di settembre, ma i letterali superano ancora i token.
- **Contrasto testo/bordo**: `yarn check:contrast` PASSA (7 token testo
  ≥4.5:1, focus-ring ≥3:1 su tutti gli sfondi). **Ma** il test non copre
  mai l'abbinamento primo-piano/riempimento di un bottone pieno:
  `#fff` su `--danger` (`#ff4455`, `.btn-danger` in
  `global.css:363-367`) = **3.38:1**, calcolato a mano, identico al
  fallimento di settembre, ancora sotto soglia 4.5 e ancora fuori dal gate
  automatico. (Nota: un secondo subagent ha letto la tabella
  danger-come-testo-su-sfondo, 4.88-5.84:1, e l'ha scambiata per la
  stessa cosa — non lo è: quella tabella non testa mai il riempimento del
  bottone. Si usa qui il calcolo diretto, che rifà esattamente la verifica
  di settembre sulla stessa regola CSS.)
- **Stati**: disabled e focus condivisi e verificati; `error` condiviso
  (`.u-error`, 3 file). **empty/loading/success**: nessun componente
  condiviso esiste — ogni pannello li reinventa (o li omette) per conto
  suo.
- **Token `--warn`**: ancora non definito. Unico uso,
  `OutputsPanel.tsx:90`, ricade su un `#e0a030` letterale, mai riconciliato
  col vero `--warning` (`#ffaa00`, `global.css:42`). Stesso difetto di
  settembre.
- **TRANSIZIONE**: non più un bottone isolato — ora una sotto-card con
  `flex-wrap` (`EffectPanel.tsx:364-399`, `global.css:857-866`). Struttura
  risolve il taglio, non verificato a schermo.
- **Intestazioni**: confermato — consolidate da 3 stili a 1
  (`.panel-header`).

## Copia e onestà (→ #6, #4) — la parte che pesa di più

- 40+ punti di toast censiti, coperti tutti i pannelli con persistenza.
- **Zero** iperboli di marketing, **zero** dark pattern (un solo
  `window.confirm`, per una cancellazione irreversibile da disco — avviso
  legittimo, non confirmshaming).
- **Gergo**: "Spinta" **risolto** (tooltip, `CameraPanel.tsx:78`). "Prova a
  secco" **risolto** al punto d'ingresso (tooltip sul bottone che la avvia,
  `AudioPanel.tsx:568-571`). "Tetto" **ancora irrisolto** —
  `OutputsPanel.tsx:157`, nessun tooltip sul controllo, spiegato solo nella
  guida (`QuickGuide.tsx:102`) che sotto pressione nessuno apre.
- **"Torna al vivo"**: confermato ancora ingannevole da due letture
  indipendenti del codice (vedi sopra, Strutturale) — stesso bug di
  settembre, intoccato.
- **"Automatico"**: confermato risolto, comportamento reale ora esiste.
- **Nuovo, minore**: `QuickGuide.tsx:46` chiama un pannello "pannello
  Audio", ma il titolo vero è "Ingresso audio" (`AudioPanel.tsx:423`) —
  deriva di nome, non una bugia di posizione come a settembre, ma stesso
  genere di difetto.
- **Regola `storage.ts:50`** ("false = niente è stato scritto. I
  chiamanti non devono mostrare ciò che non hanno salvato"): ancora
  documentata, per lo più rispettata. **Nuova violazione fresca**:
  `PresetPanel.tsx:312-313`, importazione scalette, salta il controllo del
  booleano che ogni chiamata sorella nello stesso file fa, mostra comunque
  "scalette importate" — un'istanza NUOVA dello stesso difetto di
  settembre, non un residuo. Più `OutputsPanel.tsx:29/195-198` (vedi
  Strutturale).

## Peso e attrito (→ #9)

- **JS iniziale**: 3,33 MB (main 620K + vendor 226K + three.js 936K +
  soundcheck 1,54M) ≈ **3,17 MiB**, contro 1,71 MiB di settembre —
  **+85%** in 28 release.
- Round-trip IPC al mount: 3 chiamate async + 6 sottoscrizioni evento — non
  eccessivo.
- Tempo a interattivo: non misurato (nessun benchmark in repo).
- **Animazioni a riposo**: zero incondizionate (solo `toast-in` al montaggio
  di un toast); `prefers-reduced-motion` rispettato globalmente
  (`global.css:177-182`). Punto a favore.
- Nessuna notifica/badge/modale incondizionata all'avvio (onboarding solo
  al primissimo avvio).
- **Poll e loop**: confermato — **peggio** di settembre. Ora 4
  `setInterval` incondizionati (1s, 1s, 1s, 10s: `App.tsx:460,885`,
  `AudioPanel.tsx:216,89`) + 2 loop `requestAnimationFrame`
  (`gamepad.ts`, gated sul gamepad connesso; `AudioPanel.tsx:419`, gated su
  `audioActive`). **Nessuno** dei quattro `setInterval` è legato a
  `visibilitychange`/focus finestra — zero occorrenze nell'intero `src/`.

## Accessibilità (→ #2, #4)

- `yarn check:contrast` e `yarn check:buttons` **passano** entrambi, output
  reale verificato dal vivo (non da memoria).
- **Ordine di focus**: nessun test vivo/forzato esiste; si affida
  interamente all'ordine del DOM.
- **Raggiungibilità da tastiera**: **1 difetto confermato** —
  `DeckPanel.tsx:91`, selettore clip del deck B,
  `<span onClick={...}>` senza `onKeyDown`/`role`/`tabIndex`, nessuna
  scorciatoia alternativa. Azione di performance dal vivo, irraggiungibile
  da tastiera. Tutti i backdrop di modali/menu sono invece a posto (Escape
  gestito ovunque).
- **ARIA**: minimo — 2 `role=`, 40 `aria-label` su 12 file, zero
  `<nav>`/`<main>`/`<header>` semantici.
- **Skip-link**: assente.
- La dichiarazione "zero elementi cliccabili irraggiungibili" del
  contro-audit di settembre risulta essere stata una verifica una tantum,
  non un controllo persistito — e questo passaggio ne ha trovato uno
  nuovo.

## Nota di metodo

Nessun subagent ha avviato l'app o lanciato `yarn check:ui` dal vivo (la
memoria di progetto riserva il lancio alle sole release, non alla
diagnosi ripetuta) — tutto qui è letto dal sorgente o da script
`check:*` offline realmente eseguiti (`check:contrast`, `check:buttons`).
Dove un fatto è letto dal sorgente senza conferma a schermo, è segnato
esplicitamente nel testo sopra.
