# DJtoGraphikz — regole di progetto

## Versioning (obbligatorio)

Ad ogni batch di modifiche committato:

1. **Bump `version` in `package.json`** (SemVer, suffisso `-beta` finché in beta):
   - `patch` (0.x.Y) — solo bugfix
   - `minor` (0.X.0) — feature nuove
2. **Aggiungi la voce in `CHANGELOG.md`** (formato Keep a Changelog, sezioni Added/Changed/Fixed, hash commit tra parentesi).
3. Bump + changelog vanno nello stesso commit del lavoro, o in un commit `chore(release): vX.Y.Z-beta` a fine batch.

## Convenzioni

- Commit: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- La finestra di output riusa `Engine` in modalità `remote` — mai duplicare pipeline tra le due finestre.
- Stato condiviso finestre: sempre attraverso `stateSnapshot()` / `applyRemoteState()`, mai campi ad-hoc.
- Verifica minima prima di committare: `npx tsc -p tsconfig.web.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && yarn build`.
