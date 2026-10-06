# Plugin

Un plugin e' una cartella in `~/.djtographikz/plugins/<nome>/` con un `plugin.json`. Contribuisce **solo dati**: nessun codice JavaScript viene caricato o eseguito. Gli shader girano sulla GPU come gli ISF di `~/.djtographikz/isf`.

Esempio completo e funzionante: [`docs/plugin-example/neon-pack/`](plugin-example/neon-pack) (copialo in `~/.djtographikz/plugins/`).

Dal pannello **Preset & Scalette > Plugin**: elenco, attiva/spegni (un plugin nuovo parte spento), errori di validazione, "Apri cartella plugin", "Ricarica". Le palette dei plugin attivi compaiono nella griglia colori; gli effetti, i preset e le scalette si usano dal pannello stesso.

## plugin.json

| campo | tipo | note |
|---|---|---|
| `id` | string | `[a-z0-9-]`, 1-32 caratteri, unico fra i plugin (il secondo con lo stesso id e' rifiutato) |
| `name`, `author` | string | 1-60 caratteri |
| `version` | string | `X.Y.Z` |
| `description` | string | opzionale, max 300 |
| `effects` | lista | `{ id, name, file, description? }` — `file`: `.fs` `.frag` `.glsl`, ISF (generator) con header `/*{...}*/` che dichiara i parametri |
| `palettes` | lista | `{ id, name (max 14), colors: [3 x "#rrggbb"] }` |
| `presets` | lista | `{ id, file }` — JSON di un preset, stesso formato dell'export Preset |
| `sequences` | lista | `{ id, file }` — JSON di una scaletta (o lista: la prima), come `docs/scalette/live-4h.json` |
| `mappings` | lista | `{ effect, params: { <param>: { source, depth, lfoRate?, value? } } }` — mapping consigliati, applicati quando scegli l'effetto. `effect` e' l'id locale di un effetto dello stesso plugin; `source`: `none bass mid high energy beat lfo-sine lfo-saw lfo-square`; `depth` -1..1 |

Ogni elemento ha un `id` locale (stessa regola dell'id plugin, unico nel plugin); l'id globale e' `plugin:<id-plugin>/<id>`.

## Limiti e sicurezza

Validati dal main process (`src/shared/plugins.ts`, testato da `yarn check:plugins`):

- percorsi relativi con `/`, niente `..`, niente percorsi assoluti, niente `\`;
- niente symlink (ne' file, ne' la cartella del plugin), il file reale deve restare dentro la cartella del plugin;
- estensioni ammesse: `.fs .frag .glsl` (shader), `.json` (dati);
- dimensioni: `plugin.json` 64 KB, shader 256 KB, JSON 1 MB; max 64 elementi per lista;
- un elemento non valido viene ignorato con un messaggio leggibile, il resto del plugin si carica; un plugin non valido non rompe l'app ne' gli altri plugin.

Un preset o una scaletta possono contenere uno shader (`customShader`): e' GLSL, compilato e validato dal motore come qualsiasi shader importato.
