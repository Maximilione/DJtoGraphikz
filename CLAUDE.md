# DJtoGraphikz — regole di progetto

## Versioning (obbligatorio)

Ad ogni batch di modifiche committato:

1. **Bump `version` in `package.json`** (SemVer, suffisso `-beta` finché in beta):
   - `patch` (0.x.Y) — solo bugfix
   - `minor` (0.X.0) — feature nuove
2. **Aggiungi la voce in `CHANGELOG.md`** (formato Keep a Changelog, sezioni Added/Changed/Fixed, hash commit tra parentesi).
3. Bump + changelog vanno nello stesso commit del lavoro, o in un commit `chore(release): vX.Y.Z-beta` a fine batch.

## Flusso git (obbligatorio)

- `main` = sempre stabile e rilasciabile. Mai commit diretti su main (unica eccezione: docs banali — TODO/README/CHANGELOG typo).
- Ogni batch di lavoro su un branch `feat/<tema>` o `fix/<tema>`; un commit per task logico (Conventional Commits), niente commit "wip".
- Fine batch: commit `chore(release): vX.Y.Z-beta`, merge su main con `--no-ff` (il merge commit delimita il batch), push di main. **Niente tag a ogni batch.**
- Il branch feature si cancella dopo il merge; il prossimo batch riparte da main con un branch nuovo.
- **Release (tag + installer) solo ogni 5 versioni o a fine giornata di lavoro, la prima delle due** (regola dal 2026-10-01: una release per batch produceva 3 build CI e un lancio dell'app per ogni mezz'ora di lavoro). La release e' il tag annotato `vX.Y.Z-beta` sull'ultimo merge di main, con nel messaggio l'elenco delle versioni che comprende (es. `v0.58.0-beta — comprende 0.54…0.58`), seguito da `yarn check:output` verde e `git push origin <tag>`. Le versioni intermedie restano nel CHANGELOG e in `package.json`, senza tag: la storia non si perde, gli installer escono una volta.
- A fine sessione di lavoro, se main e' avanti rispetto all'ultimo tag, si rilascia comunque: nessun lavoro resta senza installer per piu' di un giorno.

## README (obbligatorio)

- Il README va tenuto **sempre allineato** allo stato dell'app: ogni batch che aggiunge/cambia funzionalità visibili all'utente aggiorna anche la sezione Funzioni e, se serve, il Quick start.
- Il README è bilingue: `README.md` (inglese, principale) + `README.it.md` (italiano). Ogni modifica va applicata a **entrambi**.
- Le release sono automatiche: il push di un tag `v*` fa partire la GitHub Action che compila mac/win/linux e pubblica gli installer — il link "ultima versione" nel README punta a `releases/latest` e non va mai cambiato a mano.

## Convenzioni

- Commit: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- La finestra di output riusa `Engine` in modalità `remote` — mai duplicare pipeline tra le due finestre.
- Stato condiviso finestre: sempre attraverso `stateSnapshot()` / `applyRemoteState()`, mai campi ad-hoc.
- Verifica minima prima di committare: `npx tsc -p tsconfig.web.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && yarn build`.
- **Prima di ogni release, cioe' prima di ogni tag (obbligatorio): `yarn check:output`** — sul pacchetto costruito (`DJG_GATE_PREVIEW=1`) o impacchettato (`DJG_GATE_CMD=<binario>`), non solo sul dev server, da quando il main e' bytecode e il renderer offuscato. Per i batch intermedi (merge su main senza tag) basta la verifica minima piu' le suite `check:*` offline. Avvia l'app, cattura il frame che la finestra output sta davvero dipingendo e fallisce se e' nero, uniforme o fermo. Log e contatori di frame non bastano: una release e' uscita con il proiettore nero mentre i numeri erano sani. Nessun tag senza questo controllo verde. Da 0.29.1 non ruba il fuoco (niente Dock, finestre inattive), ma **avvia comunque l'app sulla macchina dell'utente: lanciarlo una volta per release, non a ripetizione per diagnosi.**
