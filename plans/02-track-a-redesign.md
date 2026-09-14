# Traccia A — Redesign dell'interfaccia di controllo

Quattro fasi più la verifica. **Leggere `plans/00-allowed-apis.md` prima di
ognuna** — è la lista delle API che esistono davvero. Il verdetto e le prove
stanno in `DESIGN-IS-2026-09-14/` (`03-verdict.md` per il perché,
`01-evidence.md` per ogni numero citato qui).

Verdetto: **REDESIGN, 11/30**, zero sul principio 10 per affordance duplicate.

---

## A1 — Fondamenta: un catalogo, token vivi, primitive corrette

Le fasi A2–A4 appoggiano su questa. Farla per prima.

### Cosa implementare

1. **Un solo catalogo di effetti.** `EFFECT_CATEGORIES` (`EffectPanel.tsx:16-88`,
   46 effetti) diventa l'unica sorgente. **Cancellare** l'elenco a mano di 21
   effetti del deck B (`DeckPanel.tsx:10-14`): oggi 25 effetti non sono
   raggiungibili sul deck B. Cancellare anche il doppione delle etichette
   post-FX (`App.tsx:38` contro `EffectPanel.tsx:100`).
2. **Un componente griglia solo.** `SimplePanel.tsx:91` ridisegna la stessa
   griglia di `EffectPanel.tsx:544` con classi diverse. Uno dei due sparisce;
   l'altro prende una prop per la densità.
3. **Niente id grezzi all'utente** — la parte strutturale, il resto in A3. I tre
   punti: `EffectPanel.tsx:461` (banner dell'effetto attivo), `:636-638` (righe
   della catena post), `DeckPanel.tsx:60-61` (il `<select>` del deck B).
4. **Token: togliere i sei morti, smettere di scrivere letterali.**
   Senza riferimenti: `--bg-secondary`, `--bg-tertiary`, `--border-light`,
   `--slider-fill`, `--s4`, `--s6`. Nel frattempo 211 spaziature su 262 (80,5%)
   sono letterali e `6px`, fuori scala, compare 51 volte.
   Decidere la scala e poi **farla rispettare**: o si aggiunge `6px` alla scala,
   o si convertono le 51 occorrenze. Non lasciarle entrambe.
5. **Contrasto — è accessibilità, non estetica.** `--text-muted`
   (`global.css:30`, **37 usi**) non passa 4,5:1 su nessuna delle quattro
   superfici: 3,15 / 3,02 / 2,87 / 2,63. L'anello di focus
   (`global.css:37`) sta a **2,62:1**, sotto la soglia di 3:1. Entrambi vanno
   schiariti finché passano, e i valori vanno verificati con l'aritmetica, non a
   occhio.
6. **Primitive: togliere il morto e aggiungere quello che manca.**
   - `NumberInput`: `label` (`:9`) e `width` (`:11`) non le passa nessuno degli
     8 chiamanti, e `label` non è nemmeno letta. Via.
   - `pushToast` (`Toasts.tsx:28`) prende una **severità**. Oggi un salvataggio
     riuscito e uno fallito hanno lo stesso bordo verde (`features.css:64`).
   - `IconPanic` (`Icons.tsx:69`) è esportata e non usata. O la si usa sul
     pulsante PANIC, o via.
7. ~~**Tetto ai trattamenti di pulsante.**~~ **RIMANDATO ad A2** (deciso il
   2026-09-14, v0.36.0-beta). Ne esistono ~30, ma A2 riscrive proprio come si
   dichiara un'affordance — i 30 `div onClick` diventano pulsanti — quindi
   fissare il tetto adesso vorrebbe dire rifarlo subito dopo. Va fatto **alla
   fine di A2**, quando l'insieme dei pulsanti e' quello definitivo.

### Riferimenti da copiare
- Riga di slider canonica: `EffectPanel.tsx:776-786` (blocco Grade).
- Pannello con intestazione richiudibile: `MidiPanel.tsx:14` + `:38-42`.
- Toast con annulla: `LookBank.tsx:46-57`.
- Blocco token verbatim e conteggi d'uso: `00-allowed-apis.md §0.4`.

### Lista di verifica
- [ ] `grep -rn "EFFECTS" src/renderer/components/DeckPanel/` → nessun elenco a mano.
- [ ] Il `<select>` del deck B mostra **46** voci con le etichette umane.
- [ ] `grep -rn -- "--s4\|--s6\|--bg-secondary\|--bg-tertiary\|--border-light\|--slider-fill" src/renderer` → solo le dichiarazioni, oppure zero.
- [ ] Aritmetica del contrasto allegata al commit: ogni coppia testo/fondo ≥ 4,5:1, anello di focus ≥ 3:1.
- [ ] `grep -rn "label\|width" src/renderer/components/NumberInput/` → le prop morte non ci sono più.
- [x] ~~Conteggio delle classi di pulsante~~ → rimandato ad A2, vedi sopra.
- [ ] `tsc` web + node, `yarn build`, `yarn check:output` verde.

### ⛔ Guardie
- Non rinominare `speed` o `reactivity`: `applyParams` li salta **per stringa
  letterale** (`Engine.ts:2578`) e un rename li rompe in silenzio.
- `--accent`, `--danger`, `--warning` sono referenziati anche da **JS inline**
  (`App.tsx:253`, `:493`, `:771`, `:772`): un rename deve passare dai `.tsx`.
- Non introdurre un design system esterno. Il vincolo è CSS scritto a mano.

---

## A2 — Ogni affordance è un pulsante

**È la fase che vale di più.** Una sola decisione strutturale sbagliata — 30
`div onClick` — fa fallire insieme i principi 2 (utile), 4 (comprensibile) e 8
(curato).

### Cosa implementare

0. ~~**Tetto ai trattamenti di pulsante**~~ **FATTO A META', il resto passa ad
   A4** (v0.37.0-beta). Il conteggio vero: **25 trattamenti autonomi** e solo
   **2** costruiti su `.btn` — cioe' il sistema esiste e non lo usa quasi
   nessuno. Il tetto e' ora un controllo eseguibile, `yarn check:buttons`, che
   fallisce se il numero cresce. **Unirli davvero e' una decisione di
   superficie e appartiene ad A4**: quali sono i tipi di pulsante di questa
   app si decide insieme a quante superfici esistono, non prima.
1. **I 30 `div` cliccabili diventano `<button>`.** Elenco completo in
   `00-allowed-apis.md` e `DESIGN-IS-2026-09-14/01-evidence.md §E3`. In ordine
   di gravità:
   - **salvare un look** `LookBank.tsx:184` — oggi né hotkey né tab
   - **caricare/sovrascrivere un look** `LookBank.tsx:136`
   - **accendere e spegnere l'AutoVJ** `AutoVJPanel.tsx:43`, `SimplePanel.tsx:53`
     — oggi né hotkey né tab
   - **accendere un post-FX** `EffectPanel.tsx:661` — 5 post-FX su 9 non si
     accendono da tastiera
   - **scegliere il genere** `AutoVJPanel.tsx:68`
   - **mostrare/nascondere un overlay** `OverlayPanel.tsx:284`
   - **le 8 intestazioni di pannello**. Composta: un pannello chiuso **smonta i
     figli** (`LookBank.tsx:133`) e l'intestazione che lo riaprirebbe non è
     raggiungibile: da tastiera, un pannello chiuso è chiuso per sempre.
2. **Chiudere i tre buchi della guardia sulle hotkey** (`App.tsx:407-408`):
   - `<button>` non è escluso: **`Space` con un pulsante a fuoco batte il BPM
     invece di premerlo** (`App.tsx:431-434`). Al buio, tabulare fino a PANIC e
     premere Spazio non fa panic.
   - Il `div tabIndex={0}` di `NumberInput` non è escluso: con quello a fuoco —
     **che è il modo documentato di usarlo** (`NumberInput.tsx:76-77`) — una
     cifra cambia l'effetto in diretta, `B` fa il blackout, `F` congela.
   - `isContentEditable` non è controllato.
   La stessa guardia, con gli stessi buchi, è duplicata in `LookBank.tsx:90-93`.
3. **Consolidare i cinque listener `keydown` globali.** Non sono in `App.tsx`:
   `LookBank.tsx:89-104` possiede `Shift`+cifra, e `CheatSheet.tsx:52`,
   `QuickGuide.tsx:26`, `IsfBrowser.tsx:29` aggiungono `Escape`. Una sola
   registrazione, una sola guardia, una sola tabella.
4. **Focus visibile dappertutto.** Togliere i tre `outline: none` senza
   sostituto (`global.css:1554`, `:1570`, `:1598`) e l'`outline:'none'` inline
   di `NumberInput.tsx:101`, che vince sulla regola globale perché quella non è
   `!important`. Aggiungere `textarea` alla lista del `:focus-visible`
   (`global.css:174-181`): oggi non c'è.
5. **Liberare la trappola dell'editor GLSL.** `ShaderEditor.tsx:373-386`
   intercetta `Tab` **senza controllare `e.shiftKey`**: sia `Tab` sia
   `Shift+Tab` inseriscono spazi, e non c'è `Escape`. Entrato il focus, si esce
   solo col mouse. Servono: `Shift+Tab` che esce, oppure `Escape` che sposta il
   focus fuori, e la scorciatoia va detta nell'interfaccia.
6. **Copertura delle azioni primarie.** Ogni azione della tabella comandi
   (`00-allowed-apis.md §0.5`) deve avere **almeno una** strada da tastiera.
   Oggi mancano del tutto: avviare/fermare l'AutoVJ, salvare un look. E fermare
   l'AutoVJ passa da `P` (panic), che azzera anche post, crossfade, motion blur,
   luminosità, blackout e freeze (`App.tsx:354-363`).
7. **Nomi accessibili.** 21 pulsanti sono solo icona o glifo, tutti con `title`
   e **zero con `aria-label`**; ogni SVG è `aria-hidden` (`Icons.tsx:17`), quindi
   il `title` è l'unica fonte di nome — la più debole, e inesistente al tocco.
   E in tutto il renderer c'è **una sola** occorrenza ARIA.

### Riferimenti da copiare
- Gestore da tastiera con guardia corretta: `LookBank.tsx:89-104` — guardia
  sugli input **più** `e.code` (a prova di layout) **più** `preventDefault()`
  solo sul ramo che gestisce davvero il tasto.
- Pulsante solo icona: `App.tsx:588-590`.

### Lista di verifica
- [x] Cliccabili non-`<button>`: **da 30 a 11** (v0.37.0-beta). Gli undici che
      restano sono legittimi e vanno lasciati: dieci sono i fondali dei cinque
      modali con i loro contenitori `stopPropagation` — cliccare fuori e' una
      comodita' del mouse, non l'unica uscita, perche' ora **tutti e cinque
      rispondono a `Escape`** — e l'undicesimo e' il doppio-click di
      `NumberInput`, che ha il suo gemello da tastiera (`Invio`).
- [ ] Percorso a tastiera provato a mano, **senza toccare il mouse**: avviare l'audio → scegliere un effetto → regolare un parametro → salvare un look → richiamarlo → accendere e spegnere l'AutoVJ → blackout → uscire dall'editor GLSL.
- [ ] Tabulare fino a BLACK/FREEZE/PANIC e premere `Space` **preme il pulsante**, non batte il tempo.
- [ ] Con un `NumberInput` a fuoco, premere `1` non cambia l'effetto.
- [ ] Un pannello chiuso si riapre da tastiera.
- [ ] `grep -rn "outline: *none" src/renderer` → ogni occorrenza ha un sostituto nella stessa regola.
- [ ] `tsc` ×2, `yarn build`, `yarn check:output` verde.

### ⛔ Guardie
- Non aggiungere `tabIndex={0}` a un `div` per farlo raggiungere: serve un
  `<button>`, che porta con sé ruolo, stato premuto e attivazione da tastiera.
- Non copiare i gestori `Escape` dei modali (`CheatSheet.tsx:52`,
  `QuickGuide.tsx:26`, `IsfBrowser.tsx:29`) come modello generale: non hanno la
  guardia sugli input, ed è deliberato perché chiudono soltanto.
- `?` è gestito **due volte** mentre la cheat sheet è aperta (`App.tsx:418` e
  `CheatSheet.tsx:52`): funziona per ordine di esecuzione, non per disegno. Una
  volta consolidati i listener, questo va risolto, non conservato.

---

## A3 — Una lingua sola, e dire la verità su cosa è successo

### Deciso durante l'esecuzione (v0.38.0-beta)

I **46 nomi di effetto e i 9 post-FX NON sono stati tradotti**, contro quanto
diceva questa fase. Sono nomi, non descrizioni: arrivano con un'icona e una
miniatura dal vivo, i post-FX hanno gia' un sottotitolo italiano, e tradurre
`Matrix` o `PS2` sarebbe peggio dell'inglese. Tradotto invece tutto quello che
e' una *descrizione*: le 91 etichette di parametro, le 16 palette, i termini di
correzione colore, le sorgenti audio.

### Cosa implementare

**Lingua** — l'interfaccia è ~268 stringhe italiane contro ~232 inglesi. Quattro
blocchi la fanno quasi tutta, e ognuno è **una decisione sola**:
- 91 etichette di parametro (`EffectParams.ts:29-258`) — `Falloff`, `Feed`,
  `Kill`, `Sheen`, `Piste`, `FOV`…
- 46 nomi di effetto (`EffectPanel.tsx:20-86`)
- 16 palette (`:128-143`) · 9 post-FX (`:104-122`)

Più: le stesse cinque transizioni hanno nomi inglesi in un pannello
(`EffectPanel.tsx:473-477`) e italiani in un altro
(`PresetPanel.tsx:497-501`), con `crossfade` lasciato inglese anche nel gruppo
italiano. E due categorie mescolano le lingue **dentro la stessa stringa**:
`'Glow & Colore'` (`:103`), `'Pellicola & Texture'` (`:119`).

Le ~50 voci di gergo con la proposta di sostituzione stanno in
`DESIGN-IS-2026-09-14/01-evidence.md §C6`.

**Verità** — quattro cose che l'interfaccia oggi dichiara e che non sono vere:

1. **`Salva` elenca il preset come salvato prima che la scrittura su disco possa
   fallire** (`PresetPanel.tsx:129-136`; il commento a `:26-28` lo dice). Prima
   si scrive, poi si dice. E `looks.ts:29` perde un look a quota piena **in
   totale silenzio**, mentre i preset almeno avvisano.
2. **La guida promette "8 look di fabbrica" che premendo `Salta` non arrivano
   mai** (`QuickGuide.tsx:55` contro `Onboarding.tsx:150`, unico chiamante di
   `seedFactoryLooks()`). O `Salta` semina, o la guida smette di prometterlo.
3. **`⚡ Smart map` riscrive i valori**, non solo le mappature: ogni parametro
   sopra il 65% della corsa viene tirato al 35% (`smartMap.ts:116-118`).
   L'etichetta dica cosa fa, o la funzione faccia quello che l'etichetta dice.
4. **`×½`/`×2` fanno uscire da Auto in silenzio** (`AudioPanel.tsx:139-147`
   chiama `setBpmMode('manual')`): il rilevamento si ferma per tutto il set e
   nessuno lo dice.

**Stati** — ne mancano due:
- ~~**Successo: non esiste.**~~ **FATTO in A1** (v0.36.0-beta): `pushToast`
  prende una severità e il verde è riservato a cio' che è riuscito.
- **Caricamento: FATTO A META'** (v0.38.0-beta). Aggiunto sui due import di
  media, che sono il percorso lento visibile (una GIF grande ci mette secondi).
  Resta da fare: compilazione shader, screenshot, avvio registrazione — e
  nessuno di questi ha ancora `aria-busy`.

**Cancellazioni** — regola unica, oggi incoerente:
- preset (`PresetPanel.tsx:385`) e scalette (`:625`): né conferma né annulla
- look sovrascritto con Shift+click (`LookBank.tsx:139-140`): niente, mentre
  *cancellare* un look l'annulla ce l'ha (`:46-54`) — **il percorso più
  distruttivo è quello non protetto**
- video (`OverlayPanel.tsx:401`): niente annulla; le immagini sì, **con
  etichetta identica**, quindi non si può sapere quale cancellazione è reversibile
- `'Rimosso dalla libreria'` mentre il file viene `unlinkSync` dal disco
  (`ipc-handlers.ts:82-85`)
- `confirm()` **non compare in tutto il repo**

### Lista di verifica
- [ ] `grep -rn "label: '" src/engine/EffectParams.ts | grep -cP "[A-Z][a-z]+" ` → zero etichette inglesi rimaste, oppure la decisione contraria scritta nel commit.
- [ ] Le cinque transizioni hanno gli **stessi cinque nomi** in tutti i punti in cui appaiono.
- [ ] Riempire la quota di localStorage a mano e provare a salvare: compare un errore, e il preset **non** compare nell'elenco.
- [ ] Premere `Salta` nell'onboarding: o i look ci sono, o la guida non li promette.
- [ ] Ogni cancellazione ha conferma **o** annulla, con la stessa regola per immagini e video.
- [ ] Un salvataggio riuscito e uno fallito **si distinguono a colpo d'occhio**.
- [ ] `tsc` ×2, `yarn build`, `yarn check:output` verde.

### ⛔ Guardie
- Non tradurre le chiavi dei parametri: `key` **è** il nome dell'uniform GLSL
  (`00-allowed-apis.md §0.1`). Si traduce `label`, mai `key`.
- Non tradurre i nomi propri: `ISF`, `MIDI`, `DMX`, `ArtNet`, `Shadertoy`,
  `GLSL`, `BPM`.
- `sequences.migrate()` (`sequences.ts:56-62`) **ricostruisce l'oggetto con
  esattamente cinque campi**: qualunque campo nuovo di primo livello aggiunto
  qui viene cancellato alla prima lettura+salvataggio.

---

## A4 — Una superficie sola

### Cosa implementare

1. **I tre modi diventano tre viste dello stesso albero**, non tre alberi.
   Oggi Simple ha **125 controlli** contro i 173 di Pro: non è una riduzione di
   densità, è la rimozione dei pannelli di destra. La griglia da 46 effetti e le
   16 palette ci sono identiche.
   **`Live` (47 controlli) è già la prova che la superficie ridotta giusta è
   nota**: partire da lì, non trattarla come caso limite.
2. **Un solo meccanismo per aprire e chiudere un pannello.** Oggi cinque:
   `usePanelCollapsed` persistito (6 pannelli); `useState` locale con
   intestazione **visivamente identica** ma senza persistenza (`AudioPanel.tsx:40`,
   `AutoVJPanel.tsx:27`, `LookBank.tsx:7`) — tre pannelli che perdono lo stato a
   ogni riavvio; `<details>` nativo; barre di schede usate come mostra/nascondi;
   il toggle compatto dell'anteprima.
3. **`ParamControls` una volta sola.** Oggi è montato due volte sulla stessa
   schermata (`EffectPanel.tsx:465`, `ShaderEditor.tsx:469`), con il pulsante
   Smart map duplicato.
4. **Unire i trattamenti di pulsante.** Sono 25 autonomi contro 2 costruiti su
   `.btn` (`yarn check:buttons`). Decidere i tipi di pulsante che questa app ha
   davvero, costruirli come varianti di uno solo, e abbassare il tetto nel
   controllo a ogni fusione.
5. **Un archivio, non cinque.** 13 chiavi di localStorage, e `App.tsx:470`
   rilegge `'djtographikz-looks'` **con la chiave scritta a mano**, scavalcando
   `loadLooks()`. Un solo modulo di persistenza, con **una versione di schema**:
   oggi nessuna chiave ne ha una.
6. **Anteprima che non gira a vuoto.** La finestra di controllo esegue un Engine
   WebGL completo a 58 fps con `backgroundThrottling` disattivato
   (`main/index.ts:124`, `:128`) e nessun controllo "dirty"
   (`Engine.ts:2172-2184`), anche in modalità `live` dove la barra laterale
   non c'è. Più una **seconda** catena rAF solo per il contatore FPS
   (`App.tsx:384-400`).

### ⛔ Il percorso di migrazione — è la parte che può perdere i dati dell'utente

I dettagli stanno in `00-allowed-apis.md §0.2`, che elenca **undici** punti dove
i dati spariscono in silenzio. I tre che vincolano il disegno:

- `looks.ts:22` **tronca a `SLOTS = 16` a ogni lettura.** Se il banco cresce,
  un vecchio percorso di lettura cancella gli slot in più, per sempre.
- `looks.ts:23-25` `catch { return Array(SLOTS).fill(null) }`: **un byte
  sbagliato e i 16 look spariscono**, senza toast e senza log. Il salvataggio
  successivo sovrascrive il valore corrotto.
- `App.tsx:167` riscrive l'**intero `EngineState`**, base64 delle immagini
  incluso, **ogni 400 ms**, con `catch {}` muto. È la chiave che fa scoppiare la
  quota, e quando scoppia fa scattare il silenzio di `looks.ts:29`.

Prima di toccare qualunque forma: **fare un backup in una chiave affiancata**,
scrivere la migrazione con versione, e provarla su un dump reale di localStorage
preso da una macchina con dei look dentro.

### Lista di verifica — fatto in v0.39.0-beta
- [x] Un solo componente griglia (`EffectGrid`, A1), un solo `PaletteGrid`, un solo meccanismo di collapse (`Panel`), un solo `ParamControls` a schermo.
- [x] Partendo da un dump di localStorage della versione 0.35, look, preset e scalette sopravvivono: `yarn check:storage` fa girare il modulo vero su un `localStorage` finto caricato con quel dump. Le forme salvate sono identiche a 0.35, quindi non c'è niente da migrare — `stampSchemaVersion()` scrive la versione 1 perché il **prossimo** cambio di forma abbia da dove partire.
- [x] `grep -rn "djtographikz-looks" src/renderer` → una sola definizione (`looks.ts`), nessuna chiave scritta a mano.
- [x] Una sola catena rAF: il contatore FPS conta i frame del motore invece di aprirne una seconda.
- [ ] **Rimandato, fuori fase:** il controllo "dirty" dentro `Engine.renderFrame()`. È lavoro sul motore, e `src/engine` non si tocca durante il redesign. Va fatto insieme al resto del motore, non qui.
- [x] `tsc` ×2, `yarn build`, `yarn check:output` verde.

### Cosa è rimasto standalone, e perché
`yarn check:buttons` scende da 25 a 4. I quattro sono il vocabolario, non
residui: `.panel-header` (la barra di piega, che ora vive solo dentro
`Panel.tsx`), `.pill`, `.tab`, `.row-item`. La regola scritta in `Panel.tsx`
perché non ricresca un terzo modo: un **pannello** si piega con `<Panel>`, un
suggerimento dentro un pannello si piega con un `<details>` nativo, nient'altro
si piega.

### ⛔ Guardie
- **Non portare la vecchia struttura sotto uno stile nuovo.** Se alla fine
  esistono ancora sei superfici per scegliere un effetto, il redesign non è
  avvenuto.
- Non tenere vecchio e nuovo dietro un flag a tempo indeterminato.
- `Toasts` ha un **solo slot di ascolto** (`Toasts.tsx:15`): può esistere un
  solo `<Toasts />` montato. Un albero con più radici lo rompe.
- Conservare `draggingRef` di `ParamControls` (`:36-51`): è la ragione per cui
  gli slider non saltano mentre li si trascina.

---

## V — Verifica finale della traccia

Da fare una volta, alla fine, prima del tag dell'ultima fase.

- [x] **Contro-audit sui dieci principi**: **21/30**, nessun principio a 0 →
      verdetto **REFINE**. Il documento è `DESIGN-IS-2026-09-14/05-controaudit.md`.
- [x] Percorso a tastiera: zero elementi cliccabili non raggiungibili. **Non
      cronometrato al buio** — quello vuole una persona in una stanza buia, non
      uno script, e resta da fare sul campo.
- [x] Aritmetica del contrasto rifatta: `yarn check:contrast` verde, ogni testo
      ≥4,5:1 e ogni bordo ≥3:1.
- [x] Controlli a schermo, contati nel DOM vero da `yarn check:ui`:
      **139 / 111 / 36** contro 173 / 125 / 47.
- [x] Affordance duplicate: **2 aperte** (R6, R8) contro 11.
- [x] `grep -rn "onClick" src/renderer | grep "div\|span"` → solo fondali di
      modale e i due `stopPropagation` delle card.
- [x] Dump di localStorage 0.35 → `yarn check:storage`, 10 asserzioni.
- [x] `yarn check:loaders`, `yarn check:beat`, `yarn check:sequences`,
      `python3 scripts/audit-shaders.py`, `yarn check:output`.
