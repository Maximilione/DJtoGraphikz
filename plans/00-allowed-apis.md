# Fase 0 — API consentite (scoperta della documentazione)

Output consolidato di tre agenti di scoperta sul codice a `88074e9` (v0.35.0-beta).
**Ogni fase successiva cita questo file.** Se una API non è qui, non esiste:
non inventarla, cercala e aggiungila qui prima di usarla.

---

## 0.1 — Engine: cosa la UI può chiamare

`src/engine/Engine.ts`. Firme esatte, con riga.

### Selezione effetto
`setEffect(id: EffectId): void` :1097 · `getCurrentEffect(): EffectId` :2078

### Post-FX
`togglePost(id: PostId): void` :1414 · `isPostActive(id): boolean` :1421 ·
`setActivePosts(ids: PostId[], amounts?: Partial<Record<PostId, number>>): void` :1426 ·
`setPostAmount(id, amount): void` :1434 (clamp 0..1; no-op se l'id non è in catena) ·
`movePost(id, delta): void` :1442 (`-1` su, `+1` giù) ·
`getPostChain(): { id: PostId; amount: number }[]` :1451 (copie) · `getActivePosts(): PostId[]` :2079

### Palette, colore, grade
`setColors(c1, c2, c3): void` :1694 · `getCurrentColors(): [string,string,string]` :2085 ·
`setColorTransitionSpeed(speed): void` :1702 (**non** emette stato) · `getColorTransitionSpeed()` :1707 ·
`setCycleEnabled(enabled)` :1714 (**non** emette stato) · `isCycleEnabled()` :1722 ·
`setCyclePalettes(palettes)` :1724 · `setCycleInterval(ms)` :1729 (min 1000) · `getCycleInterval()` :1733 ·
`setCycleBeatSync(enabled)` :1735 · `isCycleBeatSync()` :1740 ·
`setCycleBeatsPerSwitch(beats)` :1742 (min 1) · `getCycleBeatsPerSwitch()` :1746 ·
`setGrade(grade: Partial<Grade>): void` :1581 · `getGrade(): Grade` :1591 (copia)

### Deck e crossfade
`setDeckBEffect(id)` :1542 · `getDeckBEffect()` :1549 · `setCrossfade(v)` :1551 (clamp 0..1) ·
`getCrossfade()` :1558 · `setBlendMode(mode)` :1560 · `getBlendMode()` :1561

### Transport
`setBrightness(v)` :1565 (clamp 0..1) · `getBrightness()` :1566 · `setBlackout(on)` :1568 ·
`isBlackout()` :1569 · `setFreeze(on)` :1571 · `isFrozen()` :1576 ·
`setMotionBlur(v)` :1578 (clamp 0..0.95) · `getMotionBlur()` :1579

### Parametri
`getParamDefs(): EffectParam[]` :1463 · `getParamState(key): ParamState` :1489 ·
`setParamValue(key, value): void` :1498 (no-op su chiave ignota, clamp a min/max) ·
`setParamMapping(key, source, depth, lfoRate?): void` :1505 (depth clamp −1..1, lfoRate clamp 0.25..64)

### Transizioni
`setTransitionType(type)` :1404 · `getTransitionType()` :1405 · `setTransitionDuration(s)` :1407 ·
`getTransitionDuration()` :1408 · `setTransitionBeatSync(on)` :1410 · `isTransitionBeatSync()` :1411

### Overlay
`addOverlay(name, dataUrl, existingId?): Promise<OverlayItem>` :1762 ·
`addVideoOverlay(name, source, existingId?): Promise<OverlayItem>` :1841 ·
`addTextOverlay(text, opts?, existingId?): OverlayItem` :1902 · `removeOverlay(id)` :1969 ·
`getOverlays(): OverlayItem[]` :1978 · `updateOverlay(id, updates)` :1982

### Shader custom
`setCustomShader(frag, params?, imageInputs?): boolean` :1240 (false = compilazione fallita, il
motore tiene lo shader precedente) · `getLastShaderError(): string | null` :1166 ·
`isUsingCustomShader(): boolean` :1480 · `getCustomShaderSource(): string` :1481 ·
`setCustomImage(name, dataUrl)` :1383

### Keystone, uscita, cattura
`setKeystone(corners: number[])` :1291 (esattamente 8 numeri, clamp −0.5..1.5) ·
`getKeystone(): number[]` :1298 · `isKeystoneActive(): boolean` :1300 ·
`setRenderSize(w, h)` :753 · `screenshot(): Promise<Blob | null>` :2686

### Stato, preset, ciclo di vita
`onState(fn): () => void` :540 · `onAudioFrame(fn): () => void` :549 · `batch(fn)` :2141 ·
`applySettings(state: Partial<EngineState>)` :1594 · `applyRemoteState(state: EngineState)` :1659 ·
`createPreset(name): Preset` :2014 · `applyPreset(preset)` :2038 ·
`start()` :2165 · `dispose()` :2724 · `health(): string` :2279 ·
campi pubblici: `onStateChange` :533, `audioAnalyzer` :501

### ⛔ ANTI-PATTERN — cose che sembrano esistere e non vanno usate

| Errore | Realtà |
|---|---|
| `engine.panic()` | **Non esiste.** Il panic è composto nella UI: `App.tsx:356-357` = `setActivePosts([])` + `setCrossfade(0)` |
| `engine.stateSnapshot()` | **`private`**, Engine.ts:2094. La UI lo *riceve* da `onState()`/`onStateChange`, non lo chiama |
| `engine.emitState()` | `private` :2155 |
| `engine.startTransition()` / `cancelCurrentTransition()` | `private` :1127 / :1117. Passa da `setEffect()` |
| `engine.setAudioData()` | :1635, **solo finestra di uscita**, alimentato da IPC. Una UI di controllo non lo chiama mai |
| `engine.getParamState(k)` come copia | Restituisce **l'oggetto vivo** :1489. Mutarlo salta i clamp e gli emit |
| `engine.getOverlays()` come copia | Restituisce **l'array vivo** :1978 |
| Un'API di registrazione video sull'Engine | Non c'è. È `canvas.captureStream(60)` + `MediaRecorder` in `App.tsx:307-332` |
| Rinominare `speed` o `reactivity` | `applyParams` li salta **per stringa letterale** (Engine.ts:2578). Un rename li rompe in silenzio |

### Tipi da usare (verbatim)

`EffectId` Engine.ts:119-128 (46 id) · `PostId` :129 (9) · `TransitionType` :131 ·
`BlendMode` :136 + `BLEND_MODES` :137 · `Grade` :139-145 ·
`EngineState` :149-191 · `Preset` :194-209 · `OverlayItem` :91-117 · `GifSyncMode` :89 ·
`EffectParam` EffectParams.ts:9-15 · `ParamState` :17-24 · `AudioSource` + `AUDIO_SOURCES` :1-7

### Contratto dei parametri

1. `EFFECT_PARAMS[effectId]` definisce `EffectParam[]`; `key` **è** il nome dell'uniform GLSL.
2. La UI legge l'elenco con `getParamDefs()` = `[...COMMON_PARAMS, ...EFFECT_PARAMS[attivo]]`.
   `COMMON_PARAMS` (EffectParams.ts:28-31) è sempre in testa: `speed` (0..3, def 1) e
   `reactivity` (0..2, def 1).
3. Valore corrente: `getParamState(key)` — crea al volo `{value: def.default, source:'none', depth:0.5}`.
4. Scrittura: `setParamValue` / `setParamMapping`.
5. Modulazione per frame: `base + mod * depth * (max - min)`, Engine.ts:1514-1538.
6. `lfoRate` = **battute per ciclo**, default 4 = una battuta di 4/4. `phase = beatClock / lfoRate % 1`.
7. **Tutti gli shader custom condividono un unico secchio `'__custom__'`** (Engine.ts:1464, :1484):
   caricare un secondo ISF eredita i valori del primo per le chiavi omonime, e le chiavi vecchie
   restano. `setCustomShader` chiama `invalidateParamDefs()` :1280 per la cache, non per i valori.

### Contratto dello stato — asimmetrie da non nascondere

`applySettings()` (Engine.ts:1594-1630) **ignora deliberatamente `blackout` e `frozen`**
(commento :1626 — "avviarsi su uno schermo nero sembra un crash") e ignora `beatPulse`,
`energy`, `bpm`, `paramDefs`, `transition`.
`applyRemoteState()` (:1659-1692) **ripristina invece `blackout` e `frozen`** ma **non** legge
`cycle` né i `transitionType/Duration/BeatSync` di primo livello (solo l'oggetto annidato
`transition`).
`stateSnapshot()` non popola mai `transition`: quel campo viene aggiunto solo da
`startTransition()` sul suo percorso diretto (:1151-1160).

---

## 0.2 — Persistenza: cosa c'è e dove si perde

### Le 13 chiavi

| Chiave | Definita | Contenuto |
|---|---|---|
| `djtographikz-looks` | `looks.ts:15` (+ **duplicata** in `factoryLooks.ts:10` e **inline** in `App.tsx:470`) | `(SavedLook \| null)[]`, lunghezza fissa 16 |
| `djtographikz-presets` | `PresetPanel.tsx:15` | `Preset[]` |
| `djtographikz-playlists` | `PresetPanel.tsx:16` | `Sequence[]` (nome legacy) |
| `djtographikz-settings` | `App.tsx:29` | `EngineState` completo, riscritto ogni 400 ms |
| `djtographikz-ui-mode` | `App.tsx:27` | `'simple'\|'pro'\|'live'` |
| `djtographikz-onboarded` | `App.tsx:28` | `'1'` |
| `djtographikz-beatflash` | `App.tsx:30` | `'1'\|'0'` |
| `djtographikz-preview-compact` | inline `App.tsx:100` | `'1'\|'0'` |
| `djtographikz-panels` | `usePanelCollapsed.ts:8` | `Record<panelId, boolean>` |
| `djtographikz-midi` | `midi.ts:44` | `Record<targetId, MidiBinding>` |
| `djtographikz-fx-thumbs` | `fxThumbs.ts:10` | `Record<effectId, jpegDataURL>` |
| `djtographikz-audio` | `AudioPanel.tsx:17` | `SavedAudioSettings` |
| `djtographikz-dmx` | `DmxPanel.tsx:23` | `DmxConfig` |

**Nessuna chiave ha un campo di versione.** Grep di `schemaVersion|storageVersion` in
`src/renderer`: zero.

### Forme (verbatim)

`SavedLook` `looks.ts:9-13`: `{ name: string; preset: Preset; thumb: string }`
`Sequence` / `SequenceStep` `sequences.ts:11-28`.
`MidiBinding` `midi.ts:6`: `{ kind: 'cc'|'note'; ch: number; num: number }`.
`SavedAudioSettings` `AudioPanel.tsx:19-26` · `DmxConfig` `DmxPanel.tsx:12-21`.

### ⛔ Gli 11 punti dove i dati dell'utente spariscono in silenzio

| # | Punto | Cosa si perde |
|---|---|---|
| 1 | `looks.ts:23-25` `} catch { return Array(SLOTS).fill(null) }` | **Tutti e 16 i look**, per un byte sbagliato, senza toast né log. Il salvataggio successivo sovrascrive il valore corrotto |
| 2 | `looks.ts:22` `Array.from({ length: SLOTS }, ...)` | **Troncamento duro a 16.** Se il redesign allarga il banco, un vecchio percorso di lettura cancella gli slot in più |
| 3 | `PresetPanel.tsx:22` `} catch { return [] }` | Tutti i preset |
| 4 | `PresetPanel.tsx:41` + `sequences.ts:66` | Tutte le scalette, se il valore non è un array |
| 5 | `sequences.ts:56-62` `migrate()` | **Ricostruisce l'oggetto con esattamente 5 campi: ogni campo nuovo di primo livello viene cancellato** alla prima lettura+salvataggio |
| 6 | `midi.ts:64` | Tutte le associazioni MIDI |
| 7 | `looks.ts:29` `try { setItem } catch {}` | **Quota piena = look perso in totale silenzio** (i preset invece avvisano) |
| 8 | `App.tsx:167` | Idem, ed è **il più grande scrittore** (base64 di `customImages` ogni 400 ms): è la chiave che fa scoppiare la quota e quindi innesca il punto 7 |
| 9 | 8 altri `catch {}` muti | `usePanelCollapsed.ts:18`, `fxThumbs.ts:60`, `AudioPanel.tsx:116`, `DmxPanel.tsx:44`, `App.tsx:103/367/780`, `midi.ts:171` |
| 10 | `PresetPanel.tsx:174-180` | L'import valida con `imported[0].effect` e scarta senza messaggio |
| 11 | `App.tsx:470` | Rilegge `'djtographikz-looks'` **con la chiave scritta a mano**, scavalcando `loadLooks()`. Cambiare chiave o forma rompe in silenzio i trigger look da telefono e MIDI |

### Dati su disco
`~/.djtographikz/assets` (scrive `ipc-handlers.ts:66`, cancella `:84`) ·
`~/.djtographikz/isf` (scrive `:138`, `:156` — **nessun handler di cancellazione**) ·
`~/.djtographikz/isf-index.json` (cache 24 h, `:48`) ·
`~/.djtographikz/logs` (`debug-log.ts:11`, potato a `KEEP_SESSIONS = 10`).
I video sono **referenziati per percorso, non copiati** (`ipc-handlers.ts:171-178`): un look che
usa un video dipende da un file fuori da `~/.djtographikz`.

### Look di fabbrica
`seedFactoryLooks()` `factoryLooks.ts:96-111` scrive 8 preset negli slot 0–7 con `thumb: ''`.
**Un solo chiamante**: `Onboarding.tsx:150`, il pulsante `▶ INIZIA`. **Non** il pulsante `Salta`
(`:134`). Guardia `factoryLooks.ts:97-102`: semina solo se il banco è assente o tutto `null`.

---

## 0.3 — Primitive riusabili

### `NumberInput` — `NumberInput.tsx:3-12`
```ts
interface NumberInputProps {
  value: number; min: number; max: number; step: number
  onChange: (value: number) => void
  label?: string; suffix?: string; width?: number
}
```
8 chiamanti. **`label` e `width` sono morte**: nessun chiamante le passa, e `label` non è nemmeno
letta nel corpo. Doppio click = modifica testuale; frecce = passo (×10 con Shift); **la rotella
funziona solo se il contenitore ha il focus DOM** (`:77`).

### `Toasts` / `pushToast` — `Toasts.tsx:28`
`pushToast(msg: string, key = msg, action?: { label: string; fn: () => void })`.
`DISMISS_MS = 2500`, `ACTION_DISMISS_MS = 5000`, `MAX_TOASTS = 4`.
⛔ **Bus con un solo slot di ascolto** (`:15`): **può esistere un solo `<Toasts />` montato**.
⛔ `pushToast` **non accetta una severità**: successo ed errore hanno lo stesso bordo verde.

### `Icons` — `Icons.tsx:5`
9 icone, `viewBox 0 0 16 16`, `stroke="currentColor"`, **`aria-hidden="true"` (`:17`)** — il nome
accessibile deve venire da fuori. Importate **solo** da `App.tsx`.
⛔ `IconPanic` (`:69`) è esportata e non usata da nessuno.

### `usePanelCollapsed` — `usePanelCollapsed.ts:22-26`
`(id: string, defaultCollapsed = false, group?: string) => [boolean, () => void]`.
Accordion via evento `window` `'djg-panel-open'` (`:33-35`). Sei chiamanti, **tutti con
`group: 'right'`**: il percorso multi-gruppo non è mai stato esercitato.

### `ParamControls` — `ParamControls.tsx:8-10`
Prop unica `engine`. Due montaggi (`EffectPanel.tsx:465`, `ShaderEditor.tsx:469`), entrambi con
`key` per forzare il remount. Contiene `draggingRef` (`:36-51`) che sopprime il re-render da
`onState()` mentre il puntatore è giù: **da conservare, è la ragione per cui gli slider non
saltano.**

### `smartMap` — `smartMap.ts:69`
`smartMap(engine): { count: number; undo: () => void }`.
Tocca **solo** `setParamValue` (`:117`, `:126`) e `setParamMapping` (`:119`, `:127`).
⛔ Oltre a mappare, **riscrive il valore** di ogni parametro sopra il 65% della corsa portandolo
al 35% (`:116-118`) — è il mismatch etichetta/comportamento dell'audit.
Salta `speed` e `reactivity` (`:28`). 10 regole per nome (`:14-25`), 6 sonde sul sorgente
(`:31-44`), budget di 2 parametri per banda (`:97-109`).

---

## 0.4 — Token: quali sono vivi

Unica sorgente di verità: `:root` in `global.css:7-72`. `features.css` **non** dichiara token.

**Token con ZERO riferimenti** (verificati uno a uno): `--bg-secondary` :16 · `--bg-tertiary` :17 ·
`--border-light` :25 · `--slider-fill` :43 · `--s4` :50 · `--s6` :52.

Più usati: `--accent` 83 · `--fs-xs` 64 · `--line` 41 · `--text-muted` **37** · `--r-sm` 32 ·
`--text-primary` 32 · `--bg2` 31 · `--font-mono` 23.
`--t-fast: 140ms ease-out` :67, **12 riferimenti, nessuna altra durata di transizione nell'app**.

⛔ `--accent`, `--danger`, `--warning` sono referenziati anche da **JS inline** (`App.tsx:253`,
`:493`, `:771`, `:772`): un rename deve passare anche dai `.tsx`, non solo dai `.css`.

---

## 0.5 — Vocabolario dei comandi

Ogni azione e le sue superfici. `disp` = caso di `dispatchCmd` in `App.tsx`.

| Azione | Hotkey | `dispatchCmd` | MIDI | OSC |
|---|---|---|---|---|
| Blackout | `b` :412 | `'blackout'` :454 | `blackout` midi:35 | `/djg/blackout` :104 |
| Freeze | `f` :414 | `'freeze'` :455 | `freeze` midi:36 | `/djg/freeze` :105 |
| PANIC | `p` :416 | `'panic'` :447 | — | — |
| Luminosità ± | `[` :421 / `]` :424 | `'brightness'` :453 | `master` midi:20 | `/djg/brightness` :101 |
| Effetto | `1`–`0` :425 (**primi 10 su 46**) | `'effect'` :448 | — | `/djg/effect`, `/djg/effect/<n>` :108,:112 |
| Post-FX | `q w e r` :429 (**4 su 9**) | `'post'` :449 | — | `/djg/post` :109 |
| Tap BPM | `Space` :431 | `'tap'` :476 | `tap` midi:34 | `/djg/tap` :107 |
| Richiama look | `Shift`+cifra **in `LookBank.tsx:89-104`** | `'look'` :467 | `look:0..15` midi:38-41 | `/djg/look/<n>` :119 |
| Crossfade | — | `'crossfade'` :451 | `crossfade` midi:21 | `/djg/crossfade` :102 |
| Motion blur | — | `'motionBlur'` :461 | `motionblur` midi:22 | `/djg/motionblur` :103 |
| AutoVJ | — | `'autovj'` :456 | `autovj` midi:37 | `/djg/autovj` :106 |
| Genere | — | `'genre'` :457 | — | — |
| Palette | — | `'palette'` :450 | — | — |
| Deck B | — | `'deckB'` :452 | — | — |
| Wet post-FX | — | `'postAmount'` :458 | `wet:<post>` ×9 midi:23-26 | — |
| Riordina post | — | `'postMove'` :459 | — | — |
| Grade ×5 | — | `'grade'` :460 | `grade:*` midi:28-32 | `/djg/grade/*` :122 |
| Blend mode | — | `'blendMode'` :462 | — | — |
| Valore parametro | — | `'param'` :463 | — | `/djg/param/<key>` :125 |
| Mappatura parametro | — | `'paramMap'` :464 | — | — |
| Tipo/durata transizione | — | `'transitionType'` :465 / `'transitionDuration'` :466 | — | — |

Convenzioni di scala: MIDI e OSC consegnano 0..1; i grade riscalano in linea
(`midi.ts:28-32`, `osc-server.ts:87-93`). I pulsanti OSC considerano acceso `> 0.5` (`:98`).
Feedback: `App.tsx:484` emette un toast **solo se `cmd.source` è presente** — il MIDI non lo
imposta e resta muto, l'OSC marca `source: 'osc'`.

### ⛔ Anti-pattern sui comandi

| Errore | Realtà |
|---|---|
| "Le hotkey stanno in `App.tsx`" | **Ci sono cinque listener `keydown` globali.** `LookBank.tsx:89-104` possiede `Shift`+cifra, fuori da App. `CheatSheet.tsx:52`, `QuickGuide.tsx:26`, `IsfBrowser.tsx:29` aggiungono `Escape` |
| La guardia sugli input basta | Esclude `INPUT/TEXTAREA/SELECT` (`App.tsx:407-408`) ma **non** `<button>` (`Space` ruba il tap BPM), **non** il `div tabIndex={0}` di `NumberInput`, e non controlla `isContentEditable` |
| `case 'panic'` è raggiungibile | **No.** Nessun indirizzo OSC, nessun target MIDI, nessun emettitore remoto: è raggiungibile solo da `App.tsx:417` e `:578` |
| `?` è gestito una volta | È gestito **due volte** mentre la cheat sheet è aperta (`App.tsx:418` e `CheatSheet.tsx:52`): funziona per ordine di esecuzione, non per disegno |

---

## 0.6 — Lacune dichiarate dalla scoperta

- `AudioAnalyzer` letto solo per indice di metodi: i tipi `AudioData` e `BpmMode` **non** sono
  stati letti. Se una fase tocca il pannello audio, leggere prima `src/engine/audio/AudioAnalyzer.ts`.
- `src/preload/index.ts` non è stato ispezionato: la superficie `window.api` (fra cui
  `setOutputResolution`) va verificata prima di usarla.
- Non è stato verificato in modo esaustivo che la UI attuale non chiami già un metodo privato.
- La forma reale di `djtographikz-settings` su disco (in particolare se `paramDefs` e
  `customImages` finiscono davvero nel JSON salvato) non è stata verificata a runtime.

---

## 0.7 — Logging: cosa esiste già

`src/main/debug-log.ts`, 109 righe. **È l'unico logger dell'app**: nessun
`electron-log`, `winston`, `pino` da nessuna parte.

### Superficie pubblica
`logLine(tag: string, message: string)` :24 · `logWindow(win, name)` :33 ·
`logDisplayState(label, control, output)` :48 · `setupDebugLog()` :69 ·
`getLogPath(): string` :109 — **senza nessun chiamante in tutto il repo**.

Cartella `join(homedir(), '.djtographikz', 'logs')` :11 · nome file
`YYYYMMDD-HHMMSS.log` (ora locale) :77-80 · riga
`` `${stamp()} [${tag}] ${message}\n` `` :28 → `HH:MM:SS.mmm [tag] messaggio`.
Intestazione: `DJtoGraphikz <versione> — <platform> <arch> — <ISO>` :81.
Potatura a `KEEP_SESSIONS = 10` :12, :72-76.

### Tre canali IPC, e basta
`log:path` :102 (nessun chiamante) · `log:open` :103 (usato dal menu Aiuto) ·
`log:renderer` :104.

### ⛔ Difetti da correggere, non da replicare

| Difetto | Riga | Perché conta |
|---|---|---|
| **Scritture sincrone** con uno `statSync` **per riga** | :27-28 | Un `appendFileSync` per evento sul processo principale, durante uno show |
| **Tetto duro a 5 MB, poi `dropped = true` per sempre** | :13, :16, :27 | Niente rotazione dentro la sessione: superati i 5 MB il log **smette di esistere** e nessuno lo dice |
| **Le tracce di stack si perdono** | :92-96 | Nel main un `Error` passa da `JSON.stringify` che per un Error dà `{}`. Nel renderer `console-message` consegna solo una stringa: nel log reale si legge `[object DOMException]` |
| **Verbose e info scartati dal renderer** | :36 `if (level < 2) return` | Solo warn ed error arrivano |
| **Ogni errore del renderer è loggato due volte** | `index.ts:147-149`, `:226-228` | La copia in `main/error` ha l'URL completo, quella in `control/error` solo il basename |
| **`log:renderer` non è validato** | :104 | Un renderer può scrivere un tag qualsiasi, **falsificare un tag `[main/…]`** e iniettare `\n` per forgiare righe intere |
| **Il renderer di controllo non logga mai** | — | L'unico chiamante di `logToFile` in tutto il repo è `output-main.ts:50` |
| **Nessuna redazione, di niente** | — | Vedi sotto |

### ⛔ I QUATTRO CONTRATTI DI STRINGA CHE IL GATE DI RILASCIO LEGGE

`scripts/check-output.py:72-85` fa parsing testuale del log. **Cambiare il formato
senza preservarli rompe `yarn check:output`, che CLAUDE.md rende obbligatorio
prima di ogni tag.**

| Letterale | Da dove viene | Riga del gate |
|---|---|---|
| `"output/health"` come sottostringa | tag in `output-main.ts:50` | `:74` |
| `"output/health]"` — il tag **seguito da parentesi chiusa**, usato come delimitatore di split | il wrapper `[${tag}]` in `debug-log.ts:28` | `:78` |
| `"NOSIGNAL"` | suffisso in `output-main.ts:49` | `:79` |
| `"frames="` seguito da un intero terminato da spazio | primo campo di `Engine.health()`, `Engine.ts:2282` | `:81` |

Dipende inoltre dal glob `*.log`, dall'ordinamento per `mtime` (**non** dal nome
del file) e da **una riga per battito** (`splitlines()`).

### ⛔ SUPERFICIE DI PRIVACY — decide cosa NON può uscire dalla macchina

| # | Cosa finisce nel log oggi | Riga |
|---|---|---|
| 1 | **Indirizzo IP LAN + porta** | `remote-server.ts:168` |
| 2 | **Il codice di accoppiamento vivo — un segreto a 6 cifre** | `remote-server.ts:168`, **stessa riga del punto 1** |
| 3 | **Nome utente del sistema**, via percorso assoluto della home | `debug-log.ts:106` |
| 4 | Porta UDP OSC aperta e non autenticata | `osc-server.ts:194` |
| 5 | **Impronta della macchina**: id, bounds esatti, fattore di scala, flag internal/primary di ogni schermo | `debug-log.ts:50-54` |
| 6 | Posizione delle finestre sulla scrivania | `debug-log.ts:58-62` |
| 7 | Versione, piattaforma, architettura, orologio assoluto | `debug-log.ts:81` |
| 8 | Orologio locale su **ogni** riga (quando l'utente suona) | `debug-log.ts:21` |
| 9 | Stato del permesso microfono | `index.ts:324`, `:327` |
| 10 | Percorsi sorgente completi nella copia duplicata degli errori | `index.ts:148`, `:227` |
| 11 | **Testo arbitrario scritto da un renderer, con tag non validato** | `debug-log.ts:104` |
| 12 | Nomi dei file multimediali scelti dall'utente, dentro i messaggi d'errore | `OverlayPanel.tsx:70`, `:88`, `:114`, `output-main.ts:70` |
| 13 | **Sorgente GLSL scritta dall'utente**, dentro gli errori del compilatore | `Engine.ts:1262`, `:1285` |
| 14 | **Cronologia della performance**: quale effetto, luminosità, blackout, ogni 5 secondi — e `effect=` porta il **nome scelto dall'utente** per uno shader custom | `output-main.ts:50` + `Engine.ts:2279-2301` |

**Il punto più grave: i punti 1 e 2 stanno sulla stessa riga.** Indirizzo
instradabile, porta e segreto vivo insieme: tutto quello che serve a prendere il
controllo dello show da dentro la stessa rete. Una riga del genere non può
lasciare la macchina.

Nota della scoperta: i punti 12–14 sono **una categoria, non un elenco chiuso**.
Ogni `console.warn`/`console.error` di livello ≥ 2 in `src/renderer` e
`src/engine` diventa una riga di log. Una redazione che si voglia dire completa
deve partire da un'enumerazione esaustiva, che non è stata fatta.

### Il modello di chiamata di rete di questa base di codice
`src/main/update-check.ts:33-45` — `net.fetch` di Electron (non `fetch` di Node,
non `https`), header `{ 'User-Agent': 'DJtoGraphikz' }` :35, `if (!res.ok) return`
muto :36, `catch {}` muto :44 (commento: *"offline in a club — retry at the next
interval"*), `setTimeout(check, 15_000)` + `setInterval(check, 6h)` :49-50,
**nessuna pulizia dei timer**, e opt-out per le build di sviluppo :28-29.
Gli altri tre `net.fetch` (`ipc-handlers.ts:103`, `:133`, `index.ts:295`) non
impostano nessun header.

### Consumatori attuali
Menu Aiuto → `HelpMenu.tsx:69` → `log:open` → `shell.showItemInFolder` ·
**`scripts/check-output.py`, il gate di rilascio** · README.md:94 la documenta
all'utente. `api.getLogPath` e `getLogPath()` non li chiama nessuno.
