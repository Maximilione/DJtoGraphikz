# Piano — DJtoGraphikz

Due tracce indipendenti, nate da due richieste diverse. Possono procedere in
parallelo: non condividono file.

| Traccia | Da dove viene | Dove sta |
|---|---|---|
| **A — Redesign dell'interfaccia** | Audit Rams, 11/30, verdetto REDESIGN (`DESIGN-IS-2026-09-14/03-verdict.md`) | `plans/02-track-a-redesign.md` |
| **B — Logging strutturato + invio remoto** | Richiesta diretta dell'utente | `plans/03-track-b-logging.md` |

**Prima di ogni fase, di entrambe le tracce: leggere `plans/00-allowed-apis.md`.**
È la lista delle API che esistono davvero, con riga. Se una API non è lì, non
esiste: cercarla e aggiungerla al documento prima di usarla, non inventarla.

## Ordine consigliato

1. **B1** per primo, anche se la traccia A è più urgente. È piccolo, non tocca
   nessun file della UI, e dà osservabilità strutturata proprio mentre la UI
   viene riscritta — cioè quando serve di più.
2. **A1**, **A2**, **A3**, **A4** in ordine: A1 fa le fondamenta su cui le altre
   appoggiano, A2 è la causa singola di tre voti bassi dell'audit.
3. **B2**, **B3** quando conviene.
4. **V** alla fine di ogni traccia.

## Regole di lavorazione (da `CLAUDE.md`, non negoziabili)

- Ogni fase è **un batch**: branch `feat/<tema>` o `fix/<tema>`, un commit per
  task logico, Conventional Commits, niente commit "wip".
- Fine batch: bump di `package.json` (SemVer, suffisso `-beta`), voce in
  `CHANGELOG.md`, commit `chore(release): vX.Y.Z-beta`, merge su `main` con
  `--no-ff`, tag annotato sul merge, push di main + tag.
- README bilingue (`README.md` + `README.it.md`) aggiornato nello stesso batch
  se la fase cambia qualcosa che l'utente vede.
- Verifica minima prima di committare:
  `npx tsc -p tsconfig.web.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && yarn build`
- **Prima di ogni tag: `yarn check:output`.** Avvia l'app sulla macchina
  dell'utente: **una volta per release, non a ripetizione per diagnosi.**

## Cosa non si tocca, in nessuna delle due tracce

`src/engine/**` e i 46 shader in `src/engine/shaders/`. I visual sono il
prodotto. Se una fase si trova a modificare uno shader, la fase è sbagliata.

Eccezione unica e dichiarata: la traccia B tocca `Engine.health()`
(`Engine.ts:2279`) solo se serve, e **solo preservando** i quattro contratti di
stringa del gate elencati in `00-allowed-apis.md §0.7`.
