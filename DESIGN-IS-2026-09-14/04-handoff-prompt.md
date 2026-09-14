# 04 — Prompt di passaggio a /make-plan

Copia il blocco qui sotto in una sessione nuova. È autosufficiente: chi lo
riceve non vede questo audit.

````
/make-plan Ridisegna l'interfaccia di controllo di DJtoGraphikz (Electron + React + TypeScript, tutto in src/renderer/). Il design attuale ha totalizzato 11/30 in un audit sui dieci principi di Dieter Rams, con carenze critiche sui principi 10 (meno design possibile, 0/3), 2 (utile, 1/3), 3 (estetico, 1/3), 4 (comprensibile, 1/3), 5 (discreto, 1/3), 6 (onesto, 1/3), 8 (curato, 1/3) e 9 (risorse, 1/3).

Verdetto dell'audit, citato:
> Il motore grafico di DJtoGraphikz è di livello alto e la diagnostica del proiettore è migliore di quella dei concorrenti, ma l'interfaccia che lo guida è cresciuta per accumulo — sei modi per scegliere un effetto, otto per salvare, cinque per aprire un pannello, trenta per disegnare un pulsante — e il costo si paga tutto insieme su comprensibilità, raggiungibilità e coerenza visiva.

Perché redesign e non refine: il principio 10 ha preso 0 per affordance duplicate, e la duplicazione è strutturale — due cataloghi di effetti divergenti (46 contro 21), due percorsi di markup per la stessa griglia, tre meccanismi di apertura pannello che sembrano identici e si comportano diversamente, cinque archivi di persistenza. Inoltre tre principi diversi (2, 4, 8) falliscono sulla stessa singola causa: 30 affordance sono `div` con `onClick` invece di `<button>`.

Utente e compito:
- Utente primario: il VJ che guida i visual dal vivo. Una persona sola, in piedi, al buio, con le mani spesso altrove (mixer, controller MIDI).
- Compito primario: cambiare look a tempo con la musica senza guardare a lungo lo schermo di controllo.
- Compiti secondari: preparare look e scalette prima del set; correggere la proiezione durante; importare shader.
- Vincoli: Electron + React + TypeScript, CSS scritto a mano (nessun design system esterno), interfaccia in italiano, seconda finestra sul proiettore, input da tastiera / MIDI / OSC / telefono.

DA PRESERVARE (non toccare, non riscrivere):
- Tutto `src/engine/**` e i 46 shader in `src/engine/shaders/`. I visual sono il prodotto: 46 effetti, buffer multi-pass persistenti, effetti a geometria, import ISF e Shadertoy. Il redesign non deve rallentarli né cambiarne il comportamento.
- La diagnostica del proiettore, che è la cosa più originale del prodotto: il banner che spiega perché lo schermo è nero (`src/renderer/App.tsx:677-692`) e il placard "in attesa di segnale" sulla finestra di uscita (`src/renderer/output.html:32-35`).
- I token di colore in `src/renderer/styles/global.css:9-44` (26 token, una palette scura coerente) e il token di movimento `--t-fast: 140ms ease-out` (`global.css:66`): una sola durata e una sola curva per ogni transizione dell'app, 12 usi, zero eccezioni. È l'unico pezzo di disciplina già presente — il nuovo sistema ci si appoggia sopra.
- Il blocco `@media (prefers-reduced-motion: reduce)` (`global.css:167-172`).
- Il Look Bank come oggetto primario del live: griglia 4×4, click applica, Shift+cifra richiama (`src/renderer/components/LookBank/LookBank.tsx:88-104`). Il modello è giusto; è la raggiungibilità che non lo è.
- La modalità Live (47 controlli contro i 173 di Pro, `App.tsx:697-702`): è già la prova che la superficie ridotta giusta è nota. Usala come punto di partenza, non come caso limite.

DA BUTTARE (sono queste le cause dei voti bassi):
- I tre modi Simple/Pro/Live come tre alberi di markup separati. `SimplePanel.tsx:91` ridisegna la stessa griglia di 46 effetti di `EffectPanel.tsx:544` con classi diverse. Causa del voto 0 sul principio 10.
- L'elenco a mano di 21 effetti per il deck B (`DeckPanel.tsx:10-14`) che diverge dai 46 di `EFFECT_CATEGORIES` (`EffectPanel.tsx:16-88`): 25 effetti non sono raggiungibili sul deck B. Principio 10.
- L'idioma `<div onClick>` per le affordance, 30 occorrenze. Le peggiori: salvare un look (`LookBank.tsx:184`), accendere/spegnere l'AutoVJ (`AutoVJPanel.tsx:43`, `SimplePanel.tsx:53`), accendere un post-FX (`EffectPanel.tsx:661`), mostrare/nascondere un overlay (`OverlayPanel.tsx:284`) e le otto intestazioni di pannello. Causa dei voti bassi su 2, 4 e 8 insieme.
- I cinque meccanismi diversi per aprire e chiudere un pannello: hook `usePanelCollapsed` persistito (6 pannelli), `useState` locale non persistito con intestazione visivamente identica (`AudioPanel.tsx:40`, `AutoVJPanel.tsx:27`, `LookBank.tsx:7`), `<details>` nativo, barre di schede usate come mostra/nascondi, toggle compatto dell'anteprima. Principio 10.
- Lo stile ad-hoc: 211 spaziature letterali su 262 (80,5%), `6px` fuori scala usato 51 volte mentre `--s4` e `--s6` non sono usati da nessuno, 9 dimensioni di testo contro una scala di 4, 32 colori di interfaccia fuori dai token, ~30 trattamenti visivi distinti per pulsanti e toggle. Principio 3.
- L'overlay a scanline CRT su tutta la finestra a `z-index: 2147483647` (`global.css:96-110`): decorazione sopra ogni contenuto e ogni testo. Principi 5 e 7.
- `ParamControls` montato due volte sulla stessa schermata, con il pulsante Smart map duplicato (`EffectPanel.tsx:465` e `ShaderEditor.tsx:469`). Principio 10.

LE CINQUE MOSSE, in ordine di leva (verbatim dall'audit):

1. #10 — Un catalogo, un componente, una griglia. Le sei superfici per scegliere un effetto diventano una sorgente sola. Si cancella l'elenco a mano di 21 effetti del deck B (`DeckPanel.tsx:10-14`) e la seconda griglia di `SimplePanel.tsx:91`.

2. #2 — Ogni affordance è un `<button>`. I 30 `div onClick` diventano controlli veri, a partire da: salvare un look (`LookBank.tsx:184`), accendere e spegnere l'AutoVJ (`AutoVJPanel.tsx:43`, `SimplePanel.tsx:53`), accendere un post-FX (`EffectPanel.tsx:661`) e le otto intestazioni di pannello. E la guardia sulle hotkey smette di rubare `Space` ai pulsanti (`App.tsx:407-408`, `:431-434`).

3. #4 — Una lingua sola. Si traducono le 91 etichette di parametro (`src/engine/EffectParams.ts:29-258`), i 46 nomi di effetto, le 16 palette e i 9 post-FX; si smette di mostrare identificatori interni all'utente (`EffectPanel.tsx:461`, `:636-638`, `DeckPanel.tsx:60-61`); le cinque transizioni hanno gli stessi cinque nomi nei due pannelli dove appaiono.

4. #6 e #8 — Dire la verità su cosa è successo. `pushToast()` prende una severità e nasce uno stato di successo distinto (`Toasts.tsx:27`, `features.css:64`); `savePreset` scrive su disco prima di dire che ha salvato (`PresetPanel.tsx:129-136`); ogni cancellazione ha conferma o annulla, con la stessa regola per immagini e video; e `seedFactoryLooks()` parte anche premendo `Salta`, o la guida smette di promettere otto look (`QuickGuide.tsx:55` contro `Onboarding.tsx:150`).

5. #3 — Il testo si legge, il focus si vede. `--text-muted` viene ritirato o schiarito finché non passa 4,5:1 su tutte e quattro le superfici (`global.css:30`, 37 usi, oggi fra 2,63 e 3,15); l'anello di focus arriva almeno a 3:1 (`global.css:37`, oggi 2,62); spariscono i tre `outline:none` senza sostituto (`global.css:1554`, `:1570`, `:1598`) e l'`outline:'none'` inline di `NumberInput.tsx:101`.

PRINCIPI DEL REDESIGN, in ordine di priorità:
1. #10 meno design possibile — successo significa: una sola superficie per ogni azione, un solo catalogo per ogni elenco, un solo meccanismo per aprire un pannello, un solo archivio di persistenza. Se un'affordance esiste in due posti, uno dei due sparisce.
2. #2 utile — successo significa: ogni azione che un VJ compie durante un set è raggiungibile senza mouse, e il compito primario (richiamare e salvare un look a tempo) non richiede mai di guardare lo schermo. Oggi salvare un look non è raggiungibile né da tastiera né da tab.
3. #4 comprensibile — successo significa: un VJ che apre l'app per la prima volta sa nominare ogni controllo primario nella propria lingua, e non vede mai un identificatore interno.

CONSEGNE DEL PIANO:
- Nuova architettura dell'informazione, non derivata da quella attuale: quali superfici esistono, cosa sta su ciascuna, e perché quella e non un'altra.
- Flusso primario in wireframe a bassa fedeltà, etichettato, messo accanto a quello di oggi per confronto — in particolare: richiamare un look, salvarne uno, fermare l'AutoVJ.
- Decisione sui modi: uno, due o tre? Se restano più modi, devono essere viste sullo stesso albero di componenti, non alberi separati.
- Decisioni sui token: scala tipografica, scala di spaziatura, tetto al numero di colori, e **numero massimo di trattamenti di pulsante** (oggi ~30).
- Elenco degli stati, con chi li implementa: vuoto, caricamento, errore, **successo**, focus, disabilitato. Successo e caricamento oggi non esistono.
- Bilancio di raggiungibilità da tastiera: per ogni azione primaria, hotkey o tab, e la verifica che `Space` e le cifre non vengano rubate ai controlli a fuoco.
- Percorso di migrazione: le 13 chiavi di localStorage esistenti (`-audio -beatflash -dmx -fx-thumbs -looks -midi -onboarded -panels -playlists -presets -preview-compact -settings -ui-mode`) contengono i look e i preset dell'utente. Vanno letti dal nuovo design, non persi.
- Criterio di taglio: quando il vecchio design va in pensione, e come si verifica che il nuovo non ha perso funzioni.

ANTI-PATTERN DA EVITARE:
- Portare la vecchia struttura sotto uno stile nuovo. Se alla fine ci sono ancora sei modi per scegliere un effetto, il redesign non è avvenuto.
- Tenere vecchio e nuovo dietro un flag a tempo indeterminato.
- Ridisegnare inseguendo una tendenza invece dei principi qui sopra. Il verde neon su nero è la lingua del dominio e va bene; la scanline CRT sopra ogni cosa no.
- Trattare l'elenco DA PRESERVARE come facoltativo. Il motore grafico e la diagnostica del proiettore sono la parte che funziona.
- Aggiungere un'astrazione dove basta cancellare una copia.
````
