# 04 — Prompt per /make-plan

Copiabile di peso. E' autosufficiente: la sessione successiva non vede questo
audit.

````
/make-plan Redesign della finestra di controllo di DJtoGraphikz (v0.47.0-beta,
`src/renderer/App.tsx` + `src/renderer/components/**` + `src/renderer/styles/**`).
Il design attuale ha totalizzato 15/30 in un audit sui dieci principi di Dieter
Rams, con lacune critiche sui principi #6 onesto (1/3), #4 comprensibile (1/3),
#3 estetico (1/3), #8 curato (1/3), #10 meno design possibile (1/3).

Verdetto dell'audit, testuale:
> La finestra di controllo sta a 15/30 e cade su due dimensioni portanti —
> comprensibile (1) e onesto (1) — perche' sette release in un giorno hanno
> appoggiato le funzioni nuove accanto alla superficie invece che dentro: il
> risultato non e' brutto, e' incoerente, e dice all'operatore cose che non
> sono vere.

Perche' redesign e non refine: il principio #6 e' sceso da 3/3 (audit del 14
settembre, v0.40.0) a 1/3 in sette release, e i difetti non stanno nei pixel ma
nella grammatica — tre modi di intestare una sezione, cinque modi di "scegli
uno fra N", tre archivi per lo stesso gesto di salvataggio, uno stato di
caricamento che di fatto non esiste. Sono decisioni di struttura: rifinirle una
per una significa rifarle una per una fra due release.

ATTENZIONE ALL'AMBITO: e' il redesign del **sistema di superficie** della
finestra di controllo, non del prodotto. Il motore, la pipeline di rendering,
i gate di release e la resa visiva non sono in discussione.

Utente primario: un VJ (spesso il DJ stesso) che guida le visuali dal vivo, al
buio, sotto pressione, a volte con una mano sola.
Compito primario: far cambiare l'immagine a tempo con la musica.
Vincoli: Electron + React + three.js, nessun framework di UI, CSS proprio;
interfaccia in **solo italiano**; contrasto minimo 4.5:1 sul testo e 3:1 sui
bordi (`yarn check:contrast`); ratchet sulle classi dei bottoni a 4
(`yarn check:buttons`); ogni batch esce come release firmata con bump di
versione, CHANGELOG, README bilingue e `yarn check:output` verde prima del tag.

DA PRESERVARE (non si tocca):
- I token di design in `src/renderer/styles/global.css:7-99` — palette, scala
  tipografica, scala di spaziatura. Il principio #7 (duraturo) sta a 3/3 e il
  linguaggio visivo non e' il problema.
- Il meccanismo unico di ripiegamento dei pannelli, `Panel.tsx:16-30`, e il suo
  commento che vieta la terza via.
- La tastiera e il momentaneo: `src/renderer/hotkeys.ts`, `src/renderer/momentary.ts`,
  `App.tsx:525-596`, `LookBank.tsx:118-143`. Tap = resta, tieni premuto =
  torna com'era, su tastiera, MIDI e telefono.
- L'anello di fuoco globale `global.css:183-192` (misurato 5.84–6.45:1) e i
  tre `outline:none` gia' sostituiti.
- La porta unica di `src/renderer/storage.ts` e il catalogo unico
  `src/renderer/catalog.ts`.
- La striscia di scorciatoie in fondo (`App.tsx:991`) e il rapporto
  cromo/preview (~19%/81%).
- Tutto `src/engine/**` e `src/main/**` salvo i punti nominati sotto.

DA BUTTARE (sono le cause delle bocciature):
- Il toast che dichiara una scrittura senza verificarla. `storage.ts:50` scrive
  la regola ("Callers must not show what they did not save") e otto punti la
  rompono: `LookBank.tsx:64→69`, `:74`, `:88`, `:98`; `PresetPanel.tsx:319→320`
  e `:178-179` (quest'ultimo fallisce in silenzio totale); `OutputsPanel.tsx:16→174`;
  `App.tsx:464-467`. Causa la bocciatura del principio #6.
- Le tre grammatiche di intestazione nella colonna sinistra: intestazione di
  `Panel`, barra a schede (`EffectPanel.tsx:310-326`, unico blocco senza
  wrapper e unico non richiudibile, `EffectPanel.tsx:308`), titoli di sezione
  nudi. Causa #3 e #4.
- Le cinque implementazioni di "scegli uno fra N": `.mode-switch`
  (`App.tsx:708-730`), `.tab-bar` (`EffectPanel.tsx:310-326`), `.pill`
  (`PresetPanel.tsx:336`), `.media-seg` (`OverlayPanel.tsx:316-327`),
  bottoni primary/secondary (`OutputsPanel.tsx:80-88`). Causa #10.
- I tre archivi paralleli per lo stesso gesto "salva quello che vedo":
  `djtographikz-looks` (`LookBank.tsx:220-227`), `djtographikz-presets`
  (`PresetPanel.tsx:357`), `djtographikz-playlists` (`PresetPanel.tsx:517`) —
  tutti e tre chiamano `engine.createPreset()` e producono lo stesso oggetto.
  Causa #10.
- Gli stati vuoti e di successo scritti a mano pannello per pannello, senza
  trattamento condiviso. Causa #8.
- La striscia rigata sotto ogni pannello chiuso: `.panel-header` tiene
  `padding-bottom` + `margin-bottom` + `border-bottom` (`global.css:253-255`)
  mentre il corpo non si disegna (`Panel.tsx:45`) — otto pannelli chiusi,
  ~170px di colonna che sono vuoto sotto titoli che non dividono niente.
  Causa #3.

LE CINQUE MOSSE DELL'AUDIT, testuali:
1. #6 onesto — un toast si guadagna il diritto di esistere: nessun messaggio di
   conferma senza il ritorno verificato della scrittura; `"Torna al vivo"`
   torna al vivo o cambia nome; la guida dice quello che il bottone fa;
   `"Automatico"` sposta la finestra o sparisce.
   Evidenze: `storage.ts:50` contro `LookBank.tsx:64,69`,
   `PresetPanel.tsx:319-320`, `OutputsPanel.tsx:16,174`, `App.tsx:464-467`;
   `AudioPanel.tsx:352-356` (il bottone chiama `stopAudio`, che smonta il grafo
   e non riapre nulla); `QuickGuide.tsx:92-94` dice "la finestra di output si
   registra dal pannello dedicato" mentre `App.tsx:394` cattura la preview da
   un bottone di barra e `App.tsx:793` lo ammette; `OutputsPanel.tsx:102`
   scrive `displayId: null` e `main/index.ts:354` non sposta mai su null.
2. #3/#10 estetico e meno design — una grammatica sola per "qui comincia una
   cosa" e una per "scegli uno fra N"; la striscia rigata sotto i pannelli
   chiusi sparisce.
   Evidenze: `EffectPanel.tsx:308-326`, `App.tsx:708-730`,
   `PresetPanel.tsx:336`, `OverlayPanel.tsx:316-327`, `OutputsPanel.tsx:80-88`;
   `global.css:253-255` + `Panel.tsx:45`.
3. #8 curato — stati condivisi invece che scritti a mano: un trattamento solo
   per vuoto, caricamento, errore e successo, e i due pannelli nuovi che lo
   usano.
   Evidenze: `OutputsPanel.tsx:18` ingoia l'errore IPC con `catch {}` e lascia
   il pannello a mostrare una configurazione che il proiettore non ha ricevuto;
   `OutputsPanel.tsx:174` e `VenuePanel.tsx:33` emettono il successo al livello
   di default, quindi il trattamento `toast-ok` di `features.css:74` non li
   raggiunge; `IsfBrowser.tsx:91` e `OverlayPanel.tsx:222` sono gli unici due
   stati di caricamento esistenti in tutta l'app.
4. #2/#4 utile e comprensibile — i comandi tagliati e quelli civetta: il quinto
   bottone di TRANSIZIONE e la barra dei deck si vedono per intero; la
   sovrascrittura di un look ha un percorso da tastiera; le etichette inventate
   dicono cosa fanno.
   Evidenze: fotografia `/tmp/djg-ui.png` (TRANSIZIONE tagliata a meta' parola
   a y≈529, barra deck tagliata in altezza a y≈1122, con deck A e deck B che
   non mostrano gli stessi comandi); `LookBank.tsx:122` esce su slot pieno e
   `:180` richiede Shift+click; "Tetto" (`OutputsPanel.tsx:145`), "Spinta"
   (`CameraPanel.tsx:71`), "Prova a secco" (`AudioPanel.tsx:436`), "Binding"
   e "device" (`MidiPanel.tsx:31,42`) mentre gli stessi pannelli dicono gia'
   "assegnazione" e "Dispositivo".
5. #3 estetico — il contrasto che il controllo automatico non vede:
   `.btn-danger` scrive `#fff` su `#ff4455`, **3,38:1** a riposo e **4,41:1**
   in hover, sotto la soglia che il progetto si e' dato; `#000` sullo stesso
   rosso darebbe 6,21. `scripts/check-contrast.mjs:17` legge solo `global.css`
   e `:54` prova il testo solo su `bg0..bg3`, mai sopra un comando pieno:
   va esteso ai riempimenti e a `features.css`. Inoltre
   `OutputsPanel.tsx:73` usa il token inesistente `--warn` (il vero token e'
   `--warning`, `global.css:42`) e dipinge `#e0a030`, un colore che non esiste
   altrove.

PRINCIPI DEL REDESIGN, in ordine di priorita':
1. #6 onesto — successo che si vede solo quando c'e' stato; nessuna etichetta
   che promette un'azione diversa da quella che esegue; la documentazione in
   app descrive i comandi come si chiamano davvero.
2. #4 comprensibile — un VJ alla prima serata nomina correttamente ogni
   comando primario senza aprire la guida.
3. #8 curato — vuoto, caricamento, errore, successo, fuoco e disabilitato
   esistono una volta sola e valgono per tutti i pannelli.
4. #10 meno design possibile — una grammatica per gesto; togliere un elemento
   rompe un compito, altrimenti si toglie.

CONSEGNE DEL PIANO:
- Architettura dell'informazione nuova per le tre modalita' (simple/pro/live),
  non derivata da quella attuale, con il conto dei controlli per modalita' come
  vincolo dichiarato (oggi: 115 / 150 / 37, contati dal DOM vivo da
  `scripts/check-ui.py`).
- Flusso primario a bassa fedelta', etichettato, messo a confronto con quello
  attuale.
- Checklist degli stati (vuoto, caricamento, errore, successo, fuoco,
  disabilitato) con il componente unico che li implementa.
- Percorso di migrazione per chi ha gia' look, preset, scalette e Posti
  salvati: le chiavi di archivio esistenti non si possono perdere.
- Criterio di dismissione: quando la superficie vecchia sparisce (nessuna
  convivenza dietro un flag oltre una release).
- Per ogni mossa: file bersaglio, modifica esatta, passo di verifica.
- Estensione di `yarn check:contrast` ai comandi pieni e a `features.css`, piu'
  un controllo che nessun toast di conferma parta senza il ritorno della
  scrittura.
- Checklist di regressione sui principi che stanno gia' a 3: #7 duraturo (i
  token e l'assenza di marcatori di moda) e la tastiera del #2.

ANTI-PATTERN DA EVITARE:
- Portare la struttura vecchia sotto uno stile nuovo.
- Tenere le due superfici dietro un flag a tempo indeterminato.
- Redesign per inseguire una moda invece dei principi qui sopra: il #7 sta a
  3/3 e un redesign che lo abbassa e' un redesign fallito.
- Trattare la lista "DA PRESERVARE" come facoltativa.
- Allargare al principio #9 (payload da 1,71 MiB, due loop a 60 Hz): e' lavoro
  sul motore, dichiarato fuori ambito in questo giro.
````
