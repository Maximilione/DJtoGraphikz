# 01 — Prove

Raccolte da agenti in parallelo. Nessun punteggio qui: i punteggi stanno in
`02-scorecard.md` e li assegna l'orchestratore. Ogni voce ha una citazione.

---

## D — Peso e attrito

### D1 · Byte JS iniziali (build 0.35.0-beta, `yarn build`)

| File | Raw | Gzip |
|---|---:|---:|
| `out/renderer/assets/Engine-*.js` | 1.119.807 | 227.971 |
| `out/renderer/assets/main-*.js` | 575.946 | 129.781 |
| `out/renderer/assets/main-*.css` | 44.077 | 8.844 |
| `out/renderer/assets/output-*.js` | 2.380 | 1.002 |
| `out/main/index.js` | 70.387 | 20.813 |
| `out/preload/index.js` | 6.191 | 1.695 |

Per finestra, dai due entry HTML (`out/renderer/index.html:7-9`,
`out/renderer/output.html:27-28`):

| Finestra | Raw JS+CSS | Gzip |
|---|---:|---:|
| **Controllo** (`index.html`) | **1.739.830** | 366.596 |
| Uscita (`output.html`) | 1.122.187 | 228.973 |

`Engine-*.js` (1,12 MB raw) è caricato da **entrambe** le finestre: 66,0% del
payload della finestra di controllo, 99,8% di quella di uscita.

### D2 · Richieste di rete, vista primaria

3 asset, tutti relativi, tutti `file://` a runtime
(`out/renderer/index.html:7`, `:8`, `:9`; `src/main/index.ts:139`).
Font richiesti: **0** (`system-ui, sans-serif`, `out/renderer/output.html:18`).
Immagini: **0** (le icone sono SVG inline, `src/renderer/components/Icons/`).
Origini remote da `index.html`: **0**. Analytics/CDN: **0**.

Origini remote raggiunte dall'app ma non dal caricamento della vista:
API release di GitHub, `src/main/update-check.ts:35`, dopo 15 s e poi ogni 6 h
(`:49-50`, `:9`). L'app inoltre **ospita** un server HTTP LAN (`:9666`) e un
listener OSC UDP (`:9700`) dall'avvio.

### D3 · Tempo al primo frame

Metodo: **nessun avvio dell'app**. Letto il log di sessione esistente più
recente, `~/.djtographikz/logs/20260914-150351.log`. Due avvertenze materiali:
il log è **v0.34.0-beta** e in **dev mode** (renderer da `localhost:5173`,
riga `15:03:52.353`), quindi i tempi non sono quelli del bundle di §D1.

| Tappa | Δ da avvio processo |
|---|---:|
| Finestra di controllo creata | +101 ms |
| Finestra di uscita creata | +101 ms |
| Uscita ha finito di caricare (`did-finish-load`) | +744 ms |
| **Primo frame dipinto** (`output:painted`, `frames > 2`) | **+849 ms** |
| Primo output in console del renderer di controllo | +884 ms |
| Errore enumerazione dispositivi audio (`AudioPanel.tsx:63`) | +1.214 ms |
| Primo battito di salute | +5.753 ms |

Derivato dal battito: 291 frame in 5,007 s = **58,1 fps**, `scale=1.00`.
Non ricavabile: un marcatore "renderer di controllo montato" — non viene
loggato nulla di temporizzato al mount.

### D4 · Animazioni a schermo fermo

`@keyframes` nei fogli del renderer: **1** (`toast-in`, 150 ms,
`src/renderer/styles/features.css:70`, `:72`), non infinita.
Animazioni infinite nel renderer: **0**. L'unica `infinite` del repo sta nella
pagina servita al telefono (`src/main/remote-server.ts:393-394`), non nell'app.
`transition:` nei CSS: **6**, tutte legate a hover/focus/active
(`features.css:160`, `:232`; `global.css:159`, `:212`, `:384`, `:1124`).
Due transizioni inline guidate dal beat (250 ms e 180 ms,
`src/renderer/App.tsx:246-258`, `:271`) partono solo con l'audio attivo.

Lavoro per-frame o periodico nella **finestra di controllo**:

| Meccanismo | File:riga | Frequenza |
|---|---|---|
| rAF contatore FPS | `App.tsx:384-400` | ogni frame; `setFps` 1×/s |
| rAF del loop Engine (anteprima WebGL) | `Engine.ts:2182`, avviato in `App.tsx:170` | ogni frame, incondizionato |
| rAF spettro audio su canvas 2D | `AudioPanel.tsx:258` | ogni frame mentre l'audio gira |
| `setInterval` stato analizzatore | `App.tsx:283` | 1.000 ms |
| `setInterval` risincronizzazione BPM | `AudioPanel.tsx:122-135` | 500 ms |
| `setInterval` miniatura video | `OverlayPanel.tsx:419` | 500 ms per overlay |

### D5 · Notifiche, badge, modali al caricamento

| Elemento | File:riga | Condizione senza alcuna interazione |
|---|---|---|
| Modale **Onboarding** a tutto schermo | `App.tsx:497`, stato `:92` | primo avvio o storage pulito |
| Toast aggiornamento + "Scarica" | `App.tsx:236-241` | risposta di GitHub dopo 15 s |
| Banner `⚠ Audio perso — riconnessione in corso…` | `App.tsx:671-673` | `audioStatus === 'reconnecting'` dal poll da 1 s |
| Banner `⬛ PROIETTORE NERO` + "Ripristina" | `App.tsx:677-692` | `blackout \|\| brightness < 0.05`, ripristinato dallo stato salvato |
| Placard `in attesa di segnale` a tutto schermo (uscita) | `out/renderer/output.html:32-35`, `output-main.ts:43` | contatore frame fermo fra due campioni da 2 s |
| Punto del beat (badge sempre presente) | `App.tsx:517-518` | sempre |

Modali/overlay che possono comparire con zero interazione: **3**. Banner: **2**.
Toast automatici: **1** (max 4 impilati, `Toasts.tsx:11`; dismiss 2.500 ms, `:8`).

### D6 · Costo a riposo

`backgroundThrottling: false` su **entrambe** le finestre
(`src/main/index.ts:124`, `:128`, `:181`, `:184`).
Il loop dell'Engine è un rAF incondizionato: l'unica uscita è `this.disposed`
(`src/engine/Engine.ts:2172-2184`). Nessun controllo "dirty", nessuna pausa.
**La finestra di controllo esegue un Engine completo sull'anteprima in
continuazione** (`App.tsx:136`, `:170`, canvas `:730`); l'anteprima non viene
mai messa in pausa, nemmeno in modalità `live` (che toglie solo la barra
laterale, `App.tsx:697-702`). In più gira una seconda catena rAF per il
contatore FPS (`App.tsx:384-400`).
A riposo, senza audio: controllo = 2 catene rAF + 2 timer; uscita = 1 catena
rAF + watchdog da 8 ms (`Engine.ts:2239-2250`) + 2 timer. Nel log l'effetto
`smoke` stava renderizzando a 1920×1080 senza nessuno davanti.

### D7 · Limiti dichiarati

TTI del bundle di produzione non misurato (il log disponibile è dev mode e
0.34.0-beta); nessun marcatore di mount del renderer di controllo; nessun
battito di salute per la finestra di controllo, quindi il suo fps reale non è
registrato; nessuna misura di CPU/GPU a riposo (richiederebbe lanciare l'app).

---

## B — Prove visive

Niente è stato osservato **renderizzato**: non c'è dev server e il gate che
avvia l'app va lanciato una volta per release. Ogni valore calcolato qui è
**INFERITO** dal sorgente (cascata, specificità, blend di opacità).

### B1 · Scala di spaziatura

262 dichiarazioni di `padding`/`margin`/`gap`. **22 valori distinti.**
Nessun `rem`/`em` per la spaziatura, mai.

| | n | % |
|---|---:|---:|
| Che usano `var(--sN)` | 51 | 19,5% |
| Letterali | 211 | **80,5%** |
| Misti nello stesso shorthand | 4 | 1,5% |

Scala dichiarata: `--s1:4px --s2:8px --s3:12px --s4:16px --s5:24px --s6:32px`
(`global.css:47-52`). **`--s4` e `--s6` hanno zero riferimenti in tutto il
repo.** Usati: `--s1` 24 volte, `--s2` 21, `--s3` 6, `--s5` 1.

Letterali fuori scala: `1, 2, 3, 5, 6, 7, 10, 14, 20, -6` px. **`6px` compare
51 volte — più di qualsiasi token.** `12px` (che *è* `--s3`) scritto a mano 5
volte; `4`/`8` senza unità scritti a mano 10 volte.
Outlier: `-6px` `global.css:207`; `20px` `global.css:834`,
`QuickGuide.tsx:12`; `7px` `global.css:329`, `:683`, `:1430`; `14px`
`global.css:717`, `CheatSheet.tsx:35`, `HelpMenu.tsx:14`.

### B2 · Scala tipografica

Token: `--fs-xs:11 --fs-sm:12 --fs-md:13 --fs-lg:15` (`global.css:55-58`).
Dimensioni distinte effettivamente renderizzate: **9** → 10, 11, 12, 13, 14,
15, 18, 24, 34 px.
`--fs-xs` usato 61 volte, `--fs-sm` 10, `--fs-md` 5, `--fs-lg` **1**.
Duplicati letterali di token esistenti: `12px` 5×, `13px`/`13` 6×, `11px` 1×.
**`10px` (5 volte, `features.css:185`, `:223`, `:256`, `:272`, `:281`) è sotto
il pavimento di 11px dichiarato nel commento a `global.css:55`.**
Outlier: `34px` `RemoteModal.tsx:38`; `24px` `features.css:176`; `18px`
`global.css:120`, `:721`.

Famiglie: **2**, entrambe token (`global.css:69-70`), zero stack ad-hoc, zero
`@font-face`. Pesi usati: 700 (23×), 600 (11×), 400 (2×), 500 (1×) — nessun
token per il peso.

### B3 · Conteggio colori

**Token:** 26 in un unico `:root` (`global.css:7`) — 14 letterali + 12 alias.
Alias con **zero riferimenti**: `--bg-secondary`, `--bg-tertiary`,
`--border-light`, `--slider-fill`.
Un solo `:root`, nessun `[data-theme]`, nessun `prefers-color-scheme`: tema
scuro fisso.

**Ad-hoc fuori dal sistema:** 86 distinti / 116 occorrenze, in due popolazioni:
- **chrome dell'interfaccia: 32 distinti, 62 occorrenze** — questi sono il
  problema. Fra cui `#000` 9×, `rgba(232,232,240,0.025)` 4×, `#ffffff` 3×,
  `#fff` 2×, `#e03546` 2× (`global.css:324-325`), `#c8d0e0`
  (`global.css:1565`), `#16161c`+`#2a2a33` (`features.css:155-156`), sei
  colori di sorgente in `features.css:235-240`.
- contenuto: 54 valori sono i 16 preset di palette VJ
  (`EffectPanel.tsx:127-144`) — payload, non interfaccia.

**Quattro token riscritti a mano come letterali in 12 punti**: `#00ff88`,
`#0a0a0e`, `#e8e8f0`, `#ff4455`.
Rapporto sul chrome: 14 token contro 32 letterali distinti = **1 : 2,3**.

### B4 · Contrasti peggiori (calcolati a mano, INFERITI)

| Rapporto | Testo | Fondo | Riga |
|---:|---|---|---|
| **1,80** | `.tiny-btn:disabled`, `--text-secondary` a opacità 0,35 | `--bg1` | `global.css:1520`, `:1526` |
| **1,81** | `.pm-chip.none`, `--text-muted` a opacità 0,6 | `--bg2` | `features.css:230`, `:241` |
| **2,63** | `--text-muted` | `--bg3` | `global.css:30` / `:12` |
| **2,87** | `--text-muted` | `--bg2` | `global.css:30` / `:11` |
| **2,94** | `.btn-panic` a riposo, `--danger` a opacità 0,65 | `--bg1` | `features.css:7-8` |
| 3,02 | **`.u-hint` 11px** | `--bg1` (pannello) | `global.css:1382` / `:226` |
| 3,15 | `--text-muted` | `--bg0` | `global.css:30` / `:9` |
| 3,88 | `.btn:disabled` a opacità 0,45 | `--bg2` | `global.css:295-297` |

**`--text-muted` è il colore dei suggerimenti dell'app e non supera mai 3,15:1
su nessuna delle quattro superfici definite. È referenziato 37 volte.**
Tutte le righe sopra falliscono AA a 4,5:1; le prime cinque falliscono anche
la soglia 3:1 per testo grande e componenti.
Contrasto non-testuale: `--line` su `--bg0` = **1,23**; `--line-strong` su
`--bg1` = **1,42** (la soglia WCAG 1.4.11 per i bordi dei componenti è 3,0).

Sopra tutto c'è un overlay a scanline a tutto schermo
(`body::before`, `global.css:96-110`, `rgba(232,232,240,0.025)` su una riga di
pixel su quattro, `z-index: 2147483647`); il suo effetto sui rapporti non è
quantificato.

### B5 · Stati

| Stato | Esito | Prova |
|---|---|---|
| Vuoto | **PRESENTE** | `.media-empty` `global.css:1082`, `.look-slot.empty` `:960`, testi in `PresetPanel.tsx:390`, `:545`, `IsfBrowser.tsx:101`, `MidiPanel.tsx:48` |
| Caricamento | **PARZIALE** | esiste **solo** in `IsfBrowser` (`:20`, `:42-50`, `:91` "Scarico…"); nessuno spinner, nessuno skeleton, nessun `aria-busy` in tutto `src/renderer`; nessun altro pannello ha uno stato di attesa |
| Errore | **PRESENTE** | `.u-error` `global.css:1390`, `.media-error` `:1074`, `.onboarding-error` `:731`, `.code-edit.error` `:1576`, `.black-banner` `features.css:289` |
| Successo | **ASSENTE come stato distinto** | nessun selettore `.success`/`.ok`/`.is-valid` nei CSS (grep: 0). Il solo riscontro positivo è il toast generico, e `.toast` ha `border-left: 3px solid var(--accent)` **identico per ogni esito** (`features.css:64`); `pushToast()` non accetta una severità (`Toasts.tsx:27`). I messaggi di fallimento viaggiano sullo stesso toast neutro (`OverlayPanel.tsx:71`, `PresetPanel.tsx:311`) |
| Focus | **PRESENTE con 3 buchi** | anello generale su `button, select, input, a, [tabindex]` (`global.css:174-181`) |
| Disabilitato | **PRESENTE** | `global.css:295-298`, `:1268`, `:1526`, `features.css:163` |
| Hover | **PRESENTE** | 37 regole |

Copertura del focus: **153 elementi interattivi su 163 (93,9%)** hanno lo
stile esplicito; **10 no**. `role=` compare **0 volte** in tutto il renderer;
`tabIndex` **1 volta**.
Click su `div`/`span` senza `tabIndex` né `role` — non raggiungibili da
tastiera: 9, di cui sei sono sfondi di modali, ma tre sono azioni vere:
`OverlayPanel.tsx:394` (elemento della libreria media), **`DmxPanel.tsx:104` e
`MidiPanel.tsx:40`, che sono le intestazioni con cui si aprono e chiudono i
pannelli**.

`outline: none` compare 6 volte; **3 non hanno sostituto**:
`global.css:1554` (`input[type="color"]`), `global.css:1570` (`.code-edit`, il
`<textarea>` dell'editor shader — e `textarea` non è nella lista del
`:focus-visible`), `global.css:1598` (`.look-rename`, che mette pure
`box-shadow: none !important`).

### B6 · Movimento

**Una sola durata e una sola curva per ogni transizione CSS dell'app**:
`--t-fast: 140ms ease-out` (`global.css:66`), 12 riferimenti, zero altre
durate. Un solo `@keyframes` in tutto il renderer (`toast-in`, 150 ms,
`features.css:70-75`).
Due animazioni inline guidate dal beat, le uniche due durate non tokenizzate:
250 ms sul punto del beat (`App.tsx:251-256`) e 180 ms sul lampo dell'anteprima
(`App.tsx:268-272`), fino a ~2 Hz a 120 BPM.

`prefers-reduced-motion` **presente**, un blocco (`global.css:167-172`) che
azzera durate di transizione e animazione con `!important`. Copre anche le
transizioni inline. **Non neutralizza però i salti istantanei**: `scale(1.5)`,
il box-shadow e `opacity:1` vengono comunque scritti a ogni beat e riportati
indietro in 0,01 ms — il lampo diventa uno stroboscopio da un frame invece di
sparire. Nessun `matchMedia('(prefers-reduced-motion: reduce)')` lato JS
(grep: 0).

### B7 · Limiti dichiarati

Nessuna osservazione renderizzata; gli abbinamenti testo↔fondo di B4 sono
inferenze strutturali (un `.u-hint` può cadere su `--bg0`, `--bg2` o `--bg3` a
seconda dell'annidamento, e il rapporto oscilla fra 2,63 e 3,15); l'effetto
dell'overlay a scanline non è quantificato; le conclusioni su quale
dichiarazione `outline` vince sono aritmetica di specificità, non DevTools.
Nessun `@media` diverso da `prefers-reduced-motion` esiste nei due fogli:
il comportamento al ridimensionamento della finestra non è valutabile dal CSS.

---

## A — Prove strutturali

Analisi statica del sorgente: l'app non è stata avviata (regola del repo, il
gate apre finestre sulla macchina dell'utente).

### A1 · Elementi interattivi

Metodo: ogni nodo JSX che è un controllo nativo (`button`, `input`, `select`,
`textarea`, `details`/`summary`) o che porta un handler utente
(`onClick`/`onChange`/`onDoubleClick`/`onPointerDown`/`onDragStart`/`onDrop`/
`draggable`). Esclusi i cinque `onClick={e => e.stopPropagation()}`, che
sopprimono e non offrono.

**192 dichiarazioni** nel sorgente. Le più dense:

| File | n |
|---|---:|
| `PresetPanel.tsx` | 36 |
| `EffectPanel.tsx` | 29 |
| `App.tsx` | 18 |
| `OverlayPanel.tsx` | 16 |
| `AudioPanel.tsx` | 15 |

Espandendo i cicli, **istanze effettivamente a schermo**:

| Modalità | Controlli visibili |
|---|---:|
| **Pro**, un pannello destro aperto | **≈173** |
| **Pro**, tutti i pannelli destri aperti | **≈244** |
| **Simple** | **≈125** |
| **Live** | **≈47** |
| MidiPanel con tutte le associazioni | 75 (37 "Learn" + 37 "azzera") |

**Schermata più densa: Pro / scheda Effetti = 60 controlli in una sola colonna
che scorre**, di cui 46 sono la griglia degli effetti (`EffectPanel.tsx:544`).

Nota: **Simple ha 125 controlli.** La differenza rispetto a Pro non è una
riduzione di densità, è la rimozione dei pannelli di destra: la griglia da 46
effetti e le 16 palette ci sono identiche (`SimplePanel.tsx:91`, `:111`).

### A2 · Profondità dell'albero

Massima profondità di **componenti: 4**, per tre percorsi:
`App > EffectPanel > ParamControls > NumberInput` (`App.tsx:714` →
`EffectPanel.tsx:465` → `ParamControls.tsx:85`), lo stesso via `ShaderEditor`
(`App.tsx:758` → `ShaderEditor.tsx:469`), e
`App > OverlayPanel > SliderRow > NumberInput` (`OverlayPanel.tsx:325`, `:443`).
Tutti gli altri 14 pannelli sono figli diretti di `App`.
Massima profondità **DOM: 11**.

L'albero è piatto. La densità non viene dall'annidamento: viene dal numero di
cose sullo stesso piano.

### A3 · Pattern ripetuti — **11**

**R1 · Scegliere un effetto: 6 superfici, 2 cataloghi.**
Griglia Pro (`EffectPanel.tsx:544`), griglia Simple con markup separato
(`SimplePanel.tsx:91`), griglia ISF (`EffectPanel.tsx:577`), hotkey 1–0
(`App.tsx:425-428`), telefono/OSC (`App.tsx:448`), `<select>` del deck B
(`DeckPanel.tsx:60`). **Il deck B ha un catalogo a mano di 21 effetti
(`DeckPanel.tsx:10-14`) contro i 46 di `EFFECT_CATEGORIES`**: 25 effetti non
sono raggiungibili sul deck B. Anche le etichette post-FX sono duplicate
(`App.tsx:38` contro `EffectPanel.tsx:100`).

**R2 · Salvare o richiamare: 8 punti, 5 archivi.**
Look Bank (`LookBank.tsx:188`, `:140`, `:135` → chiave `-looks`), preset
(`PresetPanel.tsx:346` → `-presets`), scalette (`:588` → `-playlists`),
import/export JSON preset (`:399`, `:400`), import/export JSON scalette
(`:637`, `:638`), import/export `.frag` (`ShaderEditor.tsx:473`, `:489`),
e un auto-salvataggio silenzioso dell'intero stato (`App.tsx:165-168` →
`-settings`). **13 chiavi di localStorage distinte.**
`App.tsx:467-475` rilegge `-looks` direttamente invece di passare da
`looks.ts`.

**R3 · Aprire e chiudere un pannello: 5 meccanismi.**
Hook `usePanelCollapsed` con accordion persistito (6 pannelli); `useState`
locale con la stessa identica intestazione ma **senza persistenza**
(`AudioPanel.tsx:40`, `AutoVJPanel.tsx:27`, `LookBank.tsx:7`);
`<details>` nativo (`AutoVJPanel.tsx:86`, `ShaderEditor.tsx:528`); barre di
schede usate come mostra/nascondi (`EffectPanel.tsx:426`,
`PresetPanel.tsx:333`); toggle compatto dell'anteprima (`App.tsx:732`).
**Tre pannelli visivamente identici a quelli dell'accordion non ne fanno parte
e perdono lo stato a ogni riavvio.**

**R4 · Slider con numero: 3 implementazioni.**
`input[type=range]` + `<NumberInput>` (7 punti); wrapper `SliderRow` locale a
un file (`OverlayPanel.tsx:426-450`, 5 usi); range + `<span class="u-value">`
senza NumberInput (`PresetPanel.tsx:477`, `:565`, `ParamControls.tsx:118`,
`DmxPanel.tsx:117/123/131/140`).

**R5 · Dire qualcosa all'utente: 4 meccanismi.**
Bus `pushToast` (19 chiamanti); div di errore inline (6 punti); banner di
pagina (`App.tsx:672`, `:678`); pastiglie di stato (`App.tsx:602`, `:515`,
`MidiPanel.tsx:46`).

**R6 · Stessa azione da pannello + hotkey + remoto + MIDI.**
14 azioni hanno da 2 a 4 superfici. Blackout: pannello, `B`, OSC, MIDI.
Richiamo look: pannello, Shift+1-0, OSC, 16 note MIDI.
**Quattro azioni hanno l'hotkey ma nessun modo di scoprirlo dal pannello**
e cinque hanno il MIDI ma non l'hotkey — la matrice è piena di buchi
asimmetrici.

**R7 · Scelta del genere: 3 interfacce, 2 cataloghi.**
`<select>` (`SimplePanel.tsx:70`), lista con descrizioni
(`AutoVJPanel.tsx:65-81`), griglia di pulsanti (`Onboarding.tsx:82-95`). Due
leggono `GENRE_CONFIGS`, la terza un secondo array scritto a mano
(`AutoVJPanel.tsx:13-24`).

**R8 · Importare uno shader: 5 punti d'ingresso, 2 sfogliatori.**
`EffectPanel.tsx:565`, `:566`, `ShaderEditor.tsx:489`, `:509`, `:517`; e due
superfici di scelta ISF (griglia nel pannello `EffectPanel.tsx:577`, schede
nel modale `IsfBrowser.tsx:81`).

**R9 · `ParamControls` montato due volte.**
`EffectPanel.tsx:465` e `ShaderEditor.tsx:469`. In Pro con entrambi aperti lo
stesso blocco "Parametri", **con il suo pulsante ⚡ Smart map**, compare due
volte sullo schermo.

**R10 · Cinque modali, tre comportamenti di chiusura diversi.**
Stesso guscio `.onboarding-backdrop` + `.onboarding-card` in
`Onboarding.tsx:41`, `RemoteModal.tsx:25`, `CheatSheet.tsx:61`,
`QuickGuide.tsx:36`, `IsfBrowser.tsx:55`. Ma: Onboarding **non** si chiude
cliccando fuori; **CheatSheet si chiude cliccando dentro** (manca lo
`stopPropagation`, `:62`); gli altri tre si chiudono solo fuori.

**R11 · ~30 trattamenti visivi distinti per pulsanti e toggle** nei due CSS
(`.btn` e cinque varianti, `.pill`, `.tab`, `.tiny-btn`, `.fx-btn`,
`.fx-btn-isf`, `.simple-fx`, `.pal-btn`, `.simple-palette`, `.pm-chip`,
`.pm-src`, `.pm-rate`, `.isfb-card`, `.isfb-more`, `.media-add button`,
`.media-device-pick button`, `.media-seg button`, `.media-text-row button`,
`.media-remove`, `.media-lib-item`, `.look-slot`, `.look-del`,
`.mode-switch button`, `.onboarding-genre`, `.onboarding-start`,
`.preview-toggle`, `.output-reopen`, `.toast-undo`, `.row-item`,
`.simple-autovj`, `.toggle`, `.media-toggle`, `.status-dot`).

### A4 · Codice morto

`tsconfig.web.json` ha `strict: true` ma **`noUnusedLocals` e
`noUnusedParameters` non sono impostati da nessuna parte**; `tsc --noEmit`
esce 0 senza diagnostiche. Riattivandoli: **16 dichiarazioni morte**.

- **1 prop morta**: `label` in `NumberInputProps`
  (`NumberInput.tsx:9`, destrutturata a `:22`) — dichiarata, destrutturata,
  mai renderizzata, e nessuno degli 8 chiamanti la passa.
- 11 import `React` inutilizzati (`jsx: react-jsx`), 4 import di tipo
  inutilizzati (`LookBank.tsx:2`, `:4`, `PresetPanel.tsx:2` ×2).
- `width` in `NumberInput.tsx:11` viene letta (`:100`) ma **nessuno degli 8
  chiamanti la passa**: è una costante travestita da prop.
- Nessun `useState` scritto e mai letto, nessun handler definito e mai
  collegato.

### A5 · Inventario dei pannelli

**Cromo sempre presente**: barra superiore in 5 gruppi (identità + punto del
beat, `SIMPLE`/`PRO`/`LIVE`, `MASTER`/`BLACK`/`FREEZE`/`PANIC`, gruppo uscita,
aiuto), due banner condizionali, anteprima con toggle compatto, barra inferiore
(FPS, risoluzione, `BLACKOUT`, `FROZEN`, `flash beat`, legenda hotkey), pila
dei toast.

**Pannelli laterali — 12**, con tre regimi di apertura diversi:

| Pannello | Etichetta | Modalità | Apertura |
|---|---|---|---|
| Audio | **Ingresso audio** | Simple + Pro | locale, **non persistita** |
| Simple | *(nessuna intestazione)* | Simple | **sempre aperto** |
| Effetti | *(nessuna intestazione)*, 3 schede | Pro | **sempre aperto** |
| Auto VJ | **Auto VJ** | Pro | locale, **non persistita** |
| Crossfader | *(nessuna intestazione)* | Pro | **sempre aperto** |
| Look Bank | **Look Bank** | tutte e tre | locale, **non persistita** |
| Media | **Media** | Pro | accordion persistito, aperto |
| Preset | **Preset & Scalette** | Pro | accordion persistito, aperto |
| Shader Editor | **Shader Editor** | Pro | accordion persistito, chiuso |
| Mapping | **Mapping** | Pro | accordion persistito, chiuso |
| DMX | **Luci DMX** | Pro | accordion persistito, chiuso |
| MIDI | **MIDI** | Pro | accordion persistito, chiuso |

**Modali — 6**: Onboarding, Remote dal telefono, menu Aiuto, Scorciatoie,
Guida rapida, Libreria ISF online.

**Sotto-sezioni dentro i pannelli**: la sola scheda Effetti ne ha 8
(Transizione, cinque categorie, ISF, Parametri); la scheda Colori 3; Post FX 4;
AudioPanel 4; ShaderEditor 3; OverlayPanel 3; MidiPanel 5.

### A6 · Limiti dichiarati

Nessuna esecuzione dell'app; i conteggi per modalità assumono uno stato di
default dichiarato (8 look di fabbrica, 1 post in catena, 4 parametri, liste
preset/scalette/media/ISF vuote, nessuna associazione MIDI). Nessuna analisi
di CSS morto (richiede un DOM renderizzato). L'interfaccia del telefono
(`src/main/remote-server.ts`, 935 righe) non è stata auditata: sta fuori da
`src/renderer`.

---

## E — Prove di accessibilità

`g:` = `styles/global.css`, `f:` = `styles/features.css`. Nessuna verifica a
runtime: tutto derivato dal sorgente.

### E1 · Contrasto per token di testo

Tutta la scala tipografica sta fra 11 e 15 px: **solo due testi in tutta
l'interfaccia raggiungono la soglia "testo grande"** (`.isfb-noimg` 24px
`f:176` e il codice di accoppiamento 34px `RemoteModal.tsx:38`). Per tutto il
resto vale 4,5:1.

Promossi: `--text-primary` 13,5–16,2 · `--text-secondary` 5,6–6,4 ·
`--accent` 13,4–14,7 · `--danger` 5,0–5,6 · `--warning` 8,7–9,9 · le sei
pastiglie di sorgente `f:235-240` 5,3–15,8.

Bocciati:

| Regola | Rapporto | 4,5:1 | 3:1 |
|---|---:|---|---|
| `--text-muted` su `--bg3` (hover) | **2,63** | FAIL | **FAIL** |
| `--text-muted` su `--bg2` | **2,87** | FAIL | **FAIL** |
| `--text-muted` su `--bg1` (pannello) | 3,02 | FAIL | pass |
| `--text-muted` su `--bg0` | 3,15 | FAIL | pass |
| `#fff` su `.btn-danger` | **3,38** | FAIL | pass |
| `#fff` su `.btn-panic:hover` | **3,38** | FAIL | pass |
| `#fff` su `.btn-danger:hover` | 4,41 | FAIL | pass |
| `.preview-label` su overlay nero | 3,35 | FAIL | pass |
| `.btn:disabled` (opacità 0,45) | 3,88 | FAIL | pass |
| `.btn-panic` a riposo (opacità 0,65) | **2,94** | FAIL | **FAIL** |
| `.tab-count` (opacità 0,7) | **2,02** | FAIL | **FAIL** |
| `.pm-chip.none` (opacità 0,6) | **1,81** | FAIL | **FAIL** |
| `.tiny-btn:disabled` (opacità 0,35) | **1,80** | FAIL | **FAIL** |

**`--text-muted` è ereditato da 32 classi**, fra cui `.bottom-bar` `g:873`,
`.cat-label` `g:264`, `.u-hint` `g:1382`, `.deck-label` `g:855`,
`.output-chip` `f:38`, `.media-empty` `g:1084`, `.midi-status` `g:1348`. Tutte
testo normale, tutte bocciate a 4,5:1.

Contrasto non testuale (SC 1.4.11, soglia 3,0):

| | Rapporto |
|---|---:|
| **Anello di focus** `rgba(0,255,136,.35)` su `--bg1` | **2,62 — FAIL** |
| `--line` (bordo di ogni pannello e pulsante) su `--bg1` | **1,18 — FAIL** |
| `--line-strong` (bordo in hover) su `--bg1` | **1,42 — FAIL** |

L'anello di focus, cioè l'unica cosa che dice dove sei quando navighi da
tastiera, **non raggiunge la soglia**.

### E2 · Ordine di focus

Nessun `tabindex` positivo: l'unico `tabIndex` di tutto il renderer è
`tabIndex={0}` in `NumberInput.tsx:95`.
Nessun `order:`, `row-reverse`, `float:` o `direction:rtl` nei CSS.

Disallineamenti fra ordine visivo e ordine DOM:

- **Le cinque sovrapposizioni sono renderizzate PRIMA di tutto il cromo**
  (`App.tsx:497-508`) mentre visivamente coprono il centro. Niente dietro di
  loro è `inert` o `aria-hidden`: il focus resta dov'era, sotto un fondale a
  tutto schermo, e si continua a tabulare su controlli invisibili.
- **Il menu Aiuto** è nel DOM prima dell'intera barra superiore ma è ancorato
  visivamente sotto il pulsante che lo apre, che è l'ultimo focusable della
  barra: **tabulando dal pulsante non si arriva al menu appena aperto**
  (`App.tsx:499-506` contro `:660`).
- `.look-del` è `display:none` finché non c'è `:hover` (`g:1001-1005`):
  **senza mouse non entra mai nell'ordine di tabulazione**.
- I toast sono ultimi nel DOM ma fluttuano sopra la barra di stato: il
  pulsante "annulla" si raggiunge dopo la barra che copre.

### E3 · Trenta elementi cliccabili irraggiungibili da tastiera

`div`/`span` con `onClick`, senza `tabIndex` e senza `role`. Non sono casi
marginali — ci sono dentro azioni primarie:

| Azione | File:riga |
|---|---|
| **Accendere e spegnere l'AutoVJ** (Pro) | `AutoVJPanel.tsx:43` |
| **Accendere e spegnere l'AutoVJ** (Simple) | `SimplePanel.tsx:53` |
| **Scegliere il genere** (una riga per genere) | `AutoVJPanel.tsx:68` |
| **Accendere un post-FX** | `EffectPanel.tsx:661` |
| **Caricare un look** (click) / sovrascriverlo (shift+click) | `LookBank.tsx:136` |
| **Salvare un look** (slot vuoto) | `LookBank.tsx:184` |
| **Mostrare o nascondere un overlay** | `OverlayPanel.tsx:284` |
| Aggiungere un media dalla libreria | `OverlayPanel.tsx:394` |
| Sincronizzazione transizione sul beat | `EffectPanel.tsx:513` |
| Ciclo automatico palette | `EffectPanel.tsx:792` |
| Rinominare un look (doppio click) | `LookBank.tsx:163` |
| Digitare un numero (doppio click) | `NumberInput.tsx:115` |
| **Aprire e chiudere un pannello** — 8 intestazioni | `AudioPanel.tsx:263`, `AutoVJPanel.tsx:32`, `DmxPanel.tsx:104`, `LookBank.tsx:125`, `MappingPanel.tsx:71`, `MidiPanel.tsx:40`, `OverlayPanel.tsx:208`, `PresetPanel.tsx:322`, `ShaderEditor.tsx:397` |

Conseguenza composta: un pannello chiuso **smonta i figli**
(`LookBank.tsx:133`, `AutoVJPanel.tsx:40`), e l'intestazione che lo riaprirebbe
non è raggiungibile da tastiera. Da tastiera, un pannello chiuso è chiuso per
sempre.

### E4 · Raggiungibilità delle azioni primarie

| Azione | Hotkey | Controllo tabulabile | Esito |
|---|---|---|---|
| Cambiare effetto | `1`-`0` (**primi 10 su 46**) | sì | **sì** |
| Cambiare post-FX | `Q W E R` (**4 su 9**) | accendere: **no** (`div`); spegnere: sì | **parziale — 5 post-FX su 9 non si accendono da tastiera** |
| Regolare un parametro | no | sì | sì |
| Crossfade fra i deck | no | solo in Pro | **no in Simple e Live** |
| Blackout | `B` | sì | sì |
| Freeze | `F` | sì | sì |
| **Avviare/fermare l'AutoVJ** | **no** | **no** | **NESSUNO DEI DUE.** Si può solo fermarlo indirettamente con `P` (panic), che però azzera anche post-FX, crossfade, motion blur, luminosità, blackout e freeze (`App.tsx:362`) |
| Caricare un look | `Shift`+`1..0` (**slot 1-10 su 16**) | no | solo hotkey |
| **Salvare un look** | **no** | **no** | **NESSUNO DEI DUE** |
| Fullscreen sul proiettore | no | sì | solo tab |
| Luminosità | `[` `]` | sì | sì |

### E5 · ARIA: **una sola occorrenza in tutto il renderer**

`aria-hidden="true"` sulla fabbrica di icone SVG (`Icons.tsx:17`). E basta.

`role=` **zero**. `aria-label` **zero**. `aria-live` **zero**.
`aria-expanded`, `aria-pressed`, `aria-modal`, `aria-current` **zero**.
`<main>`, `<nav>`, `<header>`, `<section>`, `<footer>`, `<aside>` **zero**.
Nessun `<h1>`: **la finestra di controllo non ha nessuna intestazione** — i
titoli dei pannelli sono `<span>` dentro un `<div class="panel-header">`.
`index.html:2` dichiara `<html lang="en">` mentre tutta l'interfaccia è in
italiano.

### E6 · Nessun link di salto

Zero. Nessun `<a href="#…">`, nessuna classe `.skip-link`, nessun `id` a cui
saltare.

### E7 · Altri fatti

**(a) I toast non vengono annunciati.** `Toasts.tsx:55`, `:57`: nessun
`aria-live`, nessun `role="status"`. Eppure i toast sono l'**unico** riscontro
per ogni comando che arriva da telefono, OSC o MIDI (`App.tsx:484`). Stessa
cosa per i due banner che segnalano il proiettore nero (`App.tsx:672`, `:677`):
compaiono e spariscono in silenzio.

**(b) 21 pulsanti sono solo icona o solo glifo.** Tutti e 21 hanno `title`,
**zero hanno `aria-label`**. Siccome ogni SVG è `aria-hidden` (`Icons.tsx:17`),
il `title` è l'unica fonte di nome — la più debole dell'algoritmo accname, e
inesistente al tocco.

**(c) Una trappola di tastiera vera, e il problema inverso ovunque.**

**La trappola: `ShaderEditor.tsx:373-386`.** Il `onKeyDown` della textarea fa
`if (e.key === 'Tab') { e.preventDefault(); … }` **senza controllare
`e.shiftKey`**. Quindi sia `Tab` sia `Shift+Tab` inseriscono due spazi. Non
c'è né `Escape` né una scorciatoia di uscita: **una volta che il focus entra
nell'editor GLSL non esce più da tastiera.** Serve il mouse.

Il problema inverso sulle cinque sovrapposizioni: nessuna sposta il focus
dentro, nessuna lo trattiene, nessuna rende inerte lo sfondo, nessuna lo
ripristina alla chiusura. Solo tre su sei rispondono a `Escape`
(`CheatSheet.tsx:51`, `QuickGuide.tsx:26`, `IsfBrowser.tsx:29`);
**RemoteModal, Onboarding e HelpMenu non hanno nessun gestore di `Escape`**.

**Anello di focus soppresso**: `NumberInput.tsx:101` mette un `outline:'none'`
inline sul contenitore `tabIndex={0}`. La regola globale `g:179-181` non è
`!important`, quindi lo stile inline vince: **quell'elemento focusabile non
mostra nessun indicatore di focus**.

**(d) La guardia sulle hotkey ha tre buchi.** `App.tsx:407-408` esclude
`INPUT`, `TEXTAREA`, `SELECT` — quindi scrivere GLSL o un nome di preset non
cambia effetto, bene. Ma:

1. Non esclude `<button>`. **Premere `Space` con un pulsante a fuoco esegue il
   tap del BPM** (`App.tsx:431-434`, che chiama `preventDefault()`) invece di
   premere il pulsante. Al buio, tabulare fino a PANIC e premere Spazio batte
   il tempo.
2. Non esclude il contenitore di `NumberInput`, che è un `<div tabIndex={0}>`.
   Con quel div a fuoco — che è **il modo documentato di usarlo**
   (`NumberInput.tsx:76-77`) — premere una cifra cambia l'effetto in diretta,
   `B` fa il blackout del proiettore, `F` lo congela.
3. Non controlla `isContentEditable`.
4. `LookBank.tsx:90-93` ha la stessa guardia con gli stessi buchi: `Shift`+cifra
   su un NumberInput a fuoco carica un look.

### E8 · Limiti dichiarati

Nessuna verifica a runtime di stili calcolati, ordine di tabulazione reale o
resa dell'anello di focus. Il contrasto di `.look-num`/`.look-name` è
indeterminato: stanno su `rgba(0,0,0,.55)` sopra una **miniatura**, i cui pixel
cambiano per ogni look salvato (7,09 è il caso migliore, miniatura nera).
Stessa cosa per le etichette dei pulsanti effetto, che stanno sopra uno
screenshot vivo (`fxThumbs.ts`). Nessun blocco `prefers-contrast` o
`forced-colors` in nessuno dei due fogli.

---

## C — Copy e onestà

### C1 · Inventario

~500 stringhe a schermo distinte, enumerate una per una con file:riga nel
rapporto integrale dell'agente. Riassunto per lingua in C4.

### C2 · Gonfiature — 6

| Testo | File:riga | Cosa fa davvero il codice |
|---|---|---|
| `⚡ Smart map` e *"Mappa automaticamente i parametri all'audio in base a nome e uso nello shader"* | `ParamControls.tsx:60`, `:67` | `smartMap()` è una tabella di 10 pattern regex (`smartMap.ts:14-25`) più sei `RegExp.test()` sul testo dello shader (`:31-44`). Per i **46 effetti di serie** `getCustomShaderSource()` non restituisce niente, quindi `usage` è `null` (`:83`) e ogni parametro cade sul default fisso `{source:'energy', depth:0.45}` (`:87`): **la seconda metà della frase non si applica a nessun effetto di serie** |
| *"Fa tutto da solo, a tempo di musica"* | `SimplePanel.tsx:66`, `AutoVJPanel.tsx:46` | `AutoVJ` scorre una lista fissa di scene per genere su un contatore di battute (`config.switchBeats`). Non fa niente che l'utente non possa fare a mano |
| *"Rileva il BPM automaticamente"* | `AudioPanel.tsx:12` | Nello stesso pannello ci sono `×½` e `×2` i cui tooltip ammettono che il rilevatore aggancia il doppio o il mezzo tempo (`:389`, `:396`), più un `Reset` (`:484`) |
| *"PANIC — reset visuali a uno stato pulito"* | `App.tsx:579`, `QuickGuide.tsx:99` | `panic()` (`App.tsx:354-363`) **non** azzera effetto, palette, grade, keystone, overlay e DMX. "Pulito" è parziale |
| *"B = blackout istantaneo"* | `QuickGuide.tsx:99` | L'app stessa spedisce un banner per il caso in cui il proiettore è nero e l'utente non sa perché (`App.tsx:677-692`) |
| *"la prima volta può volerci qualche secondo"* | `IsfBrowser.tsx:76` | Il commento nel gestore dice *"the full dump is ~40MB"* (`ipc-handlers.ts:95`). Vedi C3 |

Nessuna occorrenza di `potente`, `professionale`, `il migliore`, `perfetto`,
`intelligente` in tutto il sorgente.

### C3 · Pattern scuri e flussi distruttivi

Nessuna continuità forzata, nessun prezzo nascosto, nessuna scarsità finta:
non esiste una superficie commerciale. Quello che c'è riguarda i dati
dell'utente.

| Meccanismo | Controllo | Gestore |
|---|---|---|
| **Preset eliminato senza conferma e senza annulla** — porta con sé l'intero stato del motore, sorgente dello shader compresa | `PresetPanel.tsx:385` | `:145-149`. **`confirm()` non compare in tutto il repo** (grep: 0) |
| **Scaletta eliminata senza conferma e senza annulla**, con tutti i suoi passi | `PresetPanel.tsx:625` | `:267-271` |
| **Look sovrascritto con Shift+click, senza conferma e senza annulla** — mentre *eliminare* un look l'annulla ce l'ha (`LookBank.tsx:46-54`). **Il percorso più distruttivo è quello non protetto**, e il gesto è a un modificatore di distanza da "applica" | `LookBank.tsx:139-140` | `:25-34` |
| **Video cancellato dalla libreria senza annulla; le immagini ce l'hanno.** Etichetta e toast sono identici nei due casi: l'utente non può sapere quale cancellazione è reversibile | `OverlayPanel.tsx:401` | `:118-150`, annulla solo se `IMAGE_RE.test(...)` (`:124`) |
| **"Rimosso dalla libreria" mentre il file viene `unlinkSync`** dal disco | `OverlayPanel.tsx:140`, `:148` | `ipc-handlers.ts:82-85` |
| **"Svuota" butta la bozza di scaletta senza conferma** | `PresetPanel.tsx:605` | `:228-231` |
| **Caricare un template di shader sovrascrive il codice non salvato** | `ShaderEditor.tsx:418` | `:315-318` |
| **Costo nascosto**: *"Sfoglia online…"* scarica un indice da ~40 MB, e può succedere in mezzo a un set | `EffectPanel.tsx:565` | `ipc-handlers.ts:96-129` |
| **Fallimento muto**: l'import di preset con un file illeggibile non dice niente (`catch {}` vuoto). L'import di *scalette*, accanto, dice `'File non leggibile'` | `PresetPanel.tsx:399` | `:164-182`, `catch {}` a `:179` |
| **Fallimento muto**: il ciclo palette con meno di 2 palette si spegne da solo senza spiegare perché | `EffectPanel.tsx:804` | `:368-386` |
| **"Nuovo codice" scollega ogni telefono**, e la conseguenza sta solo nel tooltip | `RemoteModal.tsx:48` | `resetRemote` |
| **Il microfono si riapre da solo al lancio successivo**: avviare l'audio una volta persiste `running:true` e al riavvio `.start()` parte senza prompt e senza avviso | `AudioPanel.tsx:299` | `:91-102`, `:105-116` |
| **Opt-in preselezionato**: Auto VJ è spuntato di default nell'onboarding | `Onboarding.tsx:97-100` | `:22` `useState(true)` |
| **Il selettore del display non mostra mai il display corrente**: `defaultValue=""` non controllato, dopo aver spostato l'uscita legge ancora `Output su…` | `App.tsx:617-629` | — |

### C4 · Etichetta contro comportamento — 15, di cui quattro pesanti

| Etichetta | Gestore | Differenza |
|---|---|---|
| **`Salva`** *"Salva lo stato corrente come preset"* — `PresetPanel.tsx:355` | `:129-136` → `:25-34` | `setPresets(next)` gira **prima** della scrittura su disco, e la scrittura è in un `try/catch`. **A spazio esaurito il preset compare nell'elenco come salvato mentre su disco non è arrivato niente.** Il commento a `:26-28` lo dice |
| **`⚡ Smart map`** — `ParamControls.tsx:67` | `smartMap.ts:112-120` | Oltre a mappare, **riscrive il valore** di ogni parametro sopra il 65% della sua corsa, tirandolo al 35% (`:116-118`). Un pulsante che dice "mappa" cambia i valori impostati a mano |
| **`×½` / `×2`** — `AudioPanel.tsx:386-399` | `:139-147` | Chiama anche `setBpmMode('manual')`: **l'utente esce da Auto in silenzio** e il rilevamento si ferma per tutto il resto del set. Né etichetta né tooltip lo dicono |
| **`Alla prima apertura trovi 8 look di fabbrica`** — `QuickGuide.tsx:55`, `Onboarding.tsx:111` | `seedFactoryLooks()` chiamata **solo** a `Onboarding.tsx:150` | Premere **`Salta`** (`:134`) marca l'utente come già configurato (`App.tsx:371`) e non semina mai. **Il Look Bank resta vuoto per sempre mentre la guida continua a promettere 8 look** |
| `La finestra di output si registra in video dal pannello dedicato` — `QuickGuide.tsx:93` | `App.tsx:308-334` | Registra `canvasRef`, che è **l'anteprima nella finestra di controllo**, non l'uscita. E non esiste nessun "pannello dedicato": il comando è un pulsante nella barra superiore. Il tooltip del pulsante (`:594`) dice la cosa giusta e contraddice la guida |
| `"Sposta la finestra di output su un display"` — `App.tsx:623` | `main/index.ts:432-438` | Sposta **e** forza fullscreen + always-on-top |
| `Shift+1-0` → `look` — `CheatSheet.tsx:15` | `LookBank.tsx:89-104` | Su uno slot vuoto non fa niente e non dà nessun riscontro (`:97`) |
| `'Spazio esaurito: la playlist non è stata salvata'` — `PresetPanel.tsx:48` | — | Il pannello chiama quella cosa **Scalette** dappertutto |

### C5 · Lingua

Interfaccia dichiarata italiana. Conteggio sulle stringhe distinte, esclusi i
nomi propri intraducibili:

| | n |
|---|---:|
| Italiano | ≈ **268** |
| Inglese | ≈ **232** |

Quasi metà dell'interfaccia è in un'altra lingua. Quattro blocchi la fanno
quasi tutta, e ognuno è una decisione sola:

- **91 etichette di parametro**, tutte inglesi (`EffectParams.ts:29-258`) —
  fra cui `Falloff`, `Feed`, `Kill`, `Inject`, `Morph`, `Turbulence`,
  `Threshold`, `Stutter`, `Sheen`, `Shell`, `Scope`, `Table`, `Piste`, `FOV`
- **46 etichette di effetto** (`EffectPanel.tsx:20-86`)
- **16 nomi di palette** (`:128-143`)
- **9 nomi di post-FX** (`:104-122`)

E poi il resto: `MASTER`, `BLACK`, `FREEZE`, `PANIC`, `PREVIEW`, `BLACKOUT`,
`FROZEN`, `flash beat`, `Grade`/`Expos`/`Contr`/`Satur`/`Lift`/`Vign`,
`Wet / dry`, `BASS MID HIGH ENERGY BEAT`, `Timer`/`Beat`/`Intrvl`,
`Offset X`/`Offset Y`/`Displace`, `Learn`, `Look Bank`, `Auto VJ`,
`Shader Editor`, `Template`, `TL TR BR BL`.

Incoerenze interne:
- Due categorie di post-FX mescolano le lingue **dentro la stessa stringa**:
  `'Glow & Colore'` (`:103`), `'Pellicola & Texture'` (`:119`).
- Le **stesse cinque transizioni** hanno nomi inglesi nella scheda Effetti
  (`Fade`, `Wipe←`, `Wipe↓`, `Radial`, `Noise`, `:473-477`) e italiani
  nell'editor delle scalette (`crossfade`, `wipe orizzontale`,
  `wipe verticale`, `radiale`, `dissolvenza`, `PresetPanel.tsx:497-501`) —
  con `crossfade` lasciato inglese anche nel gruppo italiano.
- **Tre punti mostrano all'utente identificatori interni grezzi** invece di
  un'etichetta: il banner dell'effetto attivo (`EffectPanel.tsx:461`), le righe
  della catena post (`:636-638`), e il `<select>` del deck B che elenca
  `tunnel`, `kaleidoscope`, `rgb-split`… (`DeckPanel.tsx:60-61`).

### C6 · Gergo — ~50 voci con proposta di sostituzione

Le peggiori per un VJ alle prime armi: `Wet / dry`, `Catena (alto → basso)`,
`TL/TR/BR/BL`, `keystone/quad-warp`, `Displace`, `Grade`, `Deck B`,
`Combo post-FX`, `Generator pubblici`, `{n} shader ignorati (non-generator o
rotti)`, `Uniform disponibili`, e le velocità LFO `1/4 1/2 1 2 4 8 16 32`
**senza mai dire di che unità si tratti**. Tabella completa con la proposta di
sostituzione nel rapporto dell'agente.

### C7 · Limiti dichiarati

App mai avviata: le stringhe generate solo a runtime da percorsi non tracciati
non sono coperte. `Engine.ts` (2.400+ righe) può contenere altri messaggi
d'errore che arrivano all'interfaccia via `getLastShaderError()`
(`EffectPanel.tsx:594`, `ShaderEditor.tsx:294`): non enumerati. Nessun menu
applicativo è definito in `src/main/**`, quindi la barra dei menu è quella di
default di Electron, in inglese e fuori dal repo. I conteggi di C5 sono a
mano, quindi approssimati (`≈`); l'elenco delle stringhe inglesi è invece
esaustivo per i file letti.
