# Evidenze — testi e onesta' (agente 3) + verifiche dell'orchestratore

## Dark pattern

**Nessuno.** Niente continuita' forzata, costi nascosti, scarsita' finta,
confirmshaming. Nessuna superficie commerciale. Una sola casella pre-spuntata
(`Onboarding.tsx:22`, AutoVJ), non commerciale e reversibile. La cancellazione
distruttiva usa un `confirm` con parole vere ("Questa non si puo' annullare",
`OverlayPanel.tsx:144`) **solo** dove l'annullamento davvero non c'e'.

## Etichetta contro comportamento — VERIFICATE DALL'ORCHESTRATORE

1. **`"Torna al vivo"` non torna al vivo: ferma l'audio.**
   `AudioPanel.tsx:352-356` → `stopAudio` (`:230-234`) →
   `audioAnalyzer.stop()`: grafo smontato, `userStopped = true`, nessuna
   ripartenza sul dispositivo di prima. L'utente resta con "Avvia audio".
2. **La guida rapida dice due cose false in una frase.**
   `QuickGuide.tsx:92-94`: "La **finestra di output** si registra in video
   **dal pannello dedicato**". Il registratore e' un bottone della barra
   (`App.tsx:790`) e cattura `canvasRef` (`App.tsx:394`), cioe' la **preview**
   della finestra di controllo. Il pannello dedicato non esiste. Il tooltip del
   bottone stesso dice la verita' ("Registra la preview in WebM",
   `App.tsx:793`): guida e bottone si contraddicono.
3. **`"Automatico"` come schermo non fa niente su un'uscita gia' aperta.**
   `OutputsPanel.tsx:102` scrive `displayId: null`; `main/index.ts:354`
   `const moved = cfg.displayId !== null && ...` → falso → la finestra non si
   sposta mai. La scelta automatica avviene solo alla creazione
   (`index.ts:222-223`). Introdotto in v0.47.0-beta.
4. **Toast che dichiarano scritture mai verificate.** `storage.ts:50` scrive
   la regola a chiare lettere — *"Callers must not show what they did not
   save"* — e il progetto la rompe in otto punti:
   `LookBank.tsx:64→69` (elimina), `:74` (annulla), `:88` (rinomina), `:98`
   (riordina); `PresetPanel.tsx:319→320` (importa scalette) e `:178-179`
   (importa preset, fallimento **del tutto silenzioso**);
   `OutputsPanel.tsx:16→174`; `App.tsx:464-467` (carica posto: se la scrittura
   fallisce i pannelli rimontati leggono i valori vecchi mentre il toast dice
   che il posto e' caricato). Le prime due sono mie, di oggi.
   Per contrasto, fanno la cosa giusta: `VenuePanel.tsx:31→33`,
   `LookBank.tsx:36→43`, `PresetPanel.tsx:124→127,140→144,248→253,276→277`.
5. **`OverlayPanel.tsx:147-159`**: `libraryDelete(...).catch(() => {})` e poi
   il toast "cancellato dal disco" — il rifiuto e' ingoiato, il toast lo
   dichiara comunque.
6. **`"Scarica"`** (`App.tsx:316`) apre una pagina web
   (`update-check.ts:47 shell.openExternal`), non scarica niente.
7. **L'onboarding promette "8 look di fabbrica pronti"** (`Onboarding.tsx:130`)
   ignorando il risultato di `seedFactoryLooks()` (`:33`), e il wizard non
   torna piu' (`App.tsx:489` timbra la chiave prima di tutto).

## Gonfiature

- `QuickGuide.tsx:117` "panic: torna a uno stato **pulito e sicuro**" — panic
  (`App.tsx:472-481`) non azzera intensita', camera, keystone ne' l'effetto.
- `AutoVJControl.tsx:39` "**Fa tutto da solo**" — tocca effetti, post e
  palette; non parametri, camera, overlay, DMX. La riga `:31` invece e' esatta.
- `App.tsx:744` "un comando invece di **cinque** cursori" — il numero varia per
  effetto (2-5+).

Nessuna occorrenza di "potente", "professionale", "perfetto", "intelligente"
in tutto `src/renderer`.

## Gergo e lingua

Inglese standard da club (si tiene): crossfade, post-FX, look, Learn, ArtNet,
fixture, universo, keystone, blackout, master, tap.

Inglese **inventato dall'app** o da tradurre: `Binding` (`MidiPanel.tsx:31,69`
— e lo stesso pannello dice gia' "assegnazione" a `:49`), `device`
(`MidiPanel.tsx:42`, mentre AudioPanel dice "Dispositivo"), `Displace`,
`GIF Sync`, `Offset X/Y`, `Template`, `Custom`, `Loop`, `Stop`, i valori crudi
`mix/add/screen/multiply/difference`, `SIMPLE/PRO/LIVE`, `PREVIEW`, `flash
beat`, gli 8 nomi dei look di fabbrica (`Tunnel Acid`, `Fire Gabber`…).

Italiano inventato che da solo non si decodifica: **"Tetto"**
(`OutputsPanel.tsx:145`, spiegato solo nella guida), **"Spinta"**
(`CameraPanel.tsx:71`), **"Mosaico"**, **"Prova a secco"** (calco di *dry run*,
e in audio "a secco" vuol dire un'altra cosa), "Preset & Scalette" (una parola
inglese e una italiana per due tipi di stato salvato).

`wet` compare in `App.tsx:734` mentre lo stesso valore altrove e' gia'
tradotto: "Quanto si sente il filtro" (`EffectPanel.tsx:481`).

La guida nomina parametri che nell'interfaccia si chiamano diversamente:
"**Speed e React**" (`QuickGuide.tsx:60`) contro "Velocita'" e "Reazione"
(`EffectParams.ts:29-30`); "bass, mid, high, energy, beat" contro i chip
`BASSI/MEDI/ALTI/VOLUME/BATTITO`.

## Stati disabilitati

Tutti coerenti con la loro etichetta. Unico buco: il `+` delle Uscite si
disabilita a 8 senza dire perche' (`OutputsPanel.tsx:87-88`).
