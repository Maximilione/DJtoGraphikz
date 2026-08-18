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
- Fine batch: commit `chore(release): vX.Y.Z-beta`, merge su main con `--no-ff` (il merge commit delimita il batch), tag annotato `vX.Y.Z-beta` sul merge, push di main + tag.
- Il branch feature si cancella dopo il merge; il prossimo batch riparte da main con un branch nuovo.

## Convenzioni

- Commit: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- La finestra di output riusa `Engine` in modalità `remote` — mai duplicare pipeline tra le due finestre.
- Stato condiviso finestre: sempre attraverso `stateSnapshot()` / `applyRemoteState()`, mai campi ad-hoc.
- Verifica minima prima di committare: `npx tsc -p tsconfig.web.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && yarn build`.
