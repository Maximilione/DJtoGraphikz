# 02 — Pagella

Dieci principi, 0–3 ciascuno, stesso peso, massimo 30. Regole applicate:
**in dubbio fra due punteggi si prende il più basso**; quando un principio ha
più istanze si giudica **la peggiore, non la media**; nessun bonus.

---

**1. Il buon design è innovativo — 2/3**
Prove: architettura a due finestre con diagnostica del proiettore che nessun
concorrente ha — banner che spiega *perché* lo schermo è nero (`App.tsx:677-692`)
e placard "in attesa di segnale" sull'uscita (`out/renderer/output.html:32-35`);
Look Bank 4×4 con richiamo da `Shift`+cifra (`LookBank.tsx:88-104`); tre
superfici di comando remoto (telefono, OSC, MIDI).
Perché 2 e non 3: l'impianto — colonne laterali, anteprima al centro, transport
in alto — è quello di Resolume e VDMX, rinfrescato ma non nuovo. Il banner
diagnostico è un miglioramento vero, ma è un elemento, non un impianto.
Perché 2 e non 1: non è imitazione con variazione minima; la coppia
banner + placard è una risposta onesta a un problema che gli altri lasciano
all'utente.

**2. Il buon design rende il prodotto utile — 1/3**
Prove: **30 elementi cliccabili non raggiungibili da tastiera** (§E3), fra cui
**salvare un look** (`LookBank.tsx:184`), **accendere e spegnere l'AutoVJ**
(`AutoVJPanel.tsx:43`, `SimplePanel.tsx:53`) e **accendere un post-FX**
(`EffectPanel.tsx:661`); 5 post-FX su 9 non si accendono da tastiera; fermare
l'AutoVJ richiede `P` (panic), che azzera anche post, crossfade, motion blur,
luminosità, blackout e freeze (`App.tsx:354-363`); **`Space` con un pulsante a
fuoco batte il BPM invece di premerlo** (`App.tsx:431-434`) — al buio, tabulare
fino a PANIC e premere Spazio non fa panic; il deck B espone 21 effetti su 46
(`DeckPanel.tsx:10-14`).
Perché 1 e non 2: il compito primario — richiamare un look a tempo — funziona
via `Shift`+cifra per 10 slot su 16, ma il suo gemello (salvarne uno a metà set)
è solo col mouse, e l'azione d'emergenza si comporta male da tastiera. Sono
deviazioni non necessarie sulla superficie primaria, non su una adiacente.
Perché 1 e non 0: il compito primario **è** supportato su questa schermata.

**3. Il buon design è estetico — 1/3**
Prove: **80,5% delle spaziature sono letterali** (211 su 262), 22 valori
distinti, `6px` fuori scala usato 51 volte — più di qualunque token — mentre
`--s4` e `--s6` non sono usati da nessuno (§B1); 9 dimensioni di testo
renderizzate contro una scala di 4, con `10px` sotto il pavimento di 11px
dichiarato nel commento accanto (§B2); 32 colori ad-hoc di interfaccia contro
14 token, e 4 token riscritti a mano come letterali in 12 punti (§B3);
**~30 trattamenti visivi distinti per pulsanti e toggle** (§A3 R11).
Perché 1 e non 2: le incoerenze sono ben oltre le due dell'ancoraggio.
Perché 1 e non 0: un sistema visibile c'è — una sola palette scura, un solo
accento, due famiglie di caratteri senza nessuno stack ad-hoc, e **una sola
durata e una sola curva per ogni transizione dell'app** (`--t-fast`, 12 usi,
zero eccezioni). Quella disciplina esiste e si vede.

**4. Il buon design rende il prodotto comprensibile — 1/3**
Prove: ~50 voci di gergo con proposta di sostituzione (§C6); **91 etichette di
parametro tutte in inglese dentro un'interfaccia italiana**
(`EffectParams.ts:29-258`) fra cui `Falloff`, `Feed`, `Kill`, `Sheen`, `Piste`;
le velocità LFO `1/4 1/2 1 2 4 8 16 32` senza dire mai di che unità si tratti
(`ParamControls.tsx:138`); **tre punti mostrano identificatori interni grezzi**
(`EffectPanel.tsx:461`, `:636-638`, `DeckPanel.tsx:60-61`); le stesse cinque
transizioni hanno nomi inglesi in un pannello e italiani in un altro (§C5).
Perché 1 e non 2: i controlli poco chiari sono decine, non uno.
Perché 1 e non 0: l'azione primaria resta identificabile — la griglia degli
effetti ha le miniature dal vivo e il Look Bank si legge da solo.

**5. Il buon design è discreto — 1/3**
Prove: **173 controlli a schermo in Pro con un solo pannello destro aperto, 244
con tutti aperti** (§A1); la schermata più densa mette **60 controlli in una
sola colonna che scorre**; sopra tutto, a `z-index: 2147483647`, c'è un
**overlay a scanline che copre l'intera finestra** (`global.css:96-110`) — pura
decorazione sopra ogni contenuto e ogni testo.
Perché 1 e non 2: la decorazione compete col contenuto, letteralmente sopra di
esso.
Perché 1 e non 0: la modalità Live scende a 47 controlli e lascia l'anteprima
protagonista — il cromo non domina dappertutto.

**6. Il buon design è onesto — 1/3**
Prove: 6 gonfiature (§C2), fra cui uno *Smart map* che per i 46 effetti di
serie non fa niente di quello che il tooltip promette; **`Salva` che elenca il
preset come salvato prima che la scrittura su disco possa fallire**
(`PresetPanel.tsx:129-136`, commento a `:26-28`); **la guida promette "8 look di
fabbrica" che premendo `Salta` non vengono creati mai** (`QuickGuide.tsx:55`
contro `Onboarding.tsx:150`); `'Rimosso dalla libreria'` mentre il file viene
`unlinkSync` dal disco; cancellazioni di preset e scalette senza conferma né
annulla, **mentre la cancellazione di un look l'annulla ce l'ha** — il percorso
più distruttivo è quello non protetto; annulla presente per le immagini e
assente per i video, con etichetta identica.
Perché 1 e non 0: non c'è nessun flusso ingannevole nel senso dell'ancoraggio —
niente continuità forzata, niente costo occulto monetario, niente scarsità
finta. Non esiste una superficie commerciale.
Perché 1 e non 2: due o più gonfiature *e* più di un percorso distruttivo senza
rete. L'ancoraggio dice "2+ gonfiature **oppure** un pattern scuro": ci sono
entrambe le cose.

**7. Il buon design è duraturo — 2/3**
Prove: nessun gradiente di moda, nessun vetro smerigliato, nessun angolo
arrotondato ovunque, caratteri di sistema, una sola curva di movimento. Verde
neon su nero è la lingua madre del dominio da vent'anni (Resolume, VDMX,
TouchDesigner), non una tendenza dell'anno.
Perché 2 e non 3: un marcatore datato c'è ed è deliberato — l'overlay a
scanline CRT su tutta la finestra (`global.css:96-110`).
Perché 2 e non 1: è uno, non due o tre.

**8. Il buon design è curato fin nell'ultimo dettaglio — 1/3**
Prove: **lo stato di successo non esiste** — nessun selettore `.success`/`.ok`
nei CSS, e `.toast` ha lo stesso bordo verde per un salvataggio riuscito e per
uno fallito, perché `pushToast()` non accetta nemmeno una severità
(`Toasts.tsx:27`, `features.css:64`); lo stato di caricamento esiste **in un
solo componente su 24** (`IsfBrowser`), senza spinner, senza skeleton, senza
`aria-busy`; il focus ha **tre `outline:none` senza sostituto**
(`global.css:1554`, `:1570`, `:1598`), un anello soppresso da uno stile inline
(`NumberInput.tsx:101`) e un contrasto di **2,62:1** che non raggiunge la
soglia.
Perché 1 e non 2: mancano due stati e il terzo è rotto in quattro punti.
Perché 1 e non 0: vuoto, errore, disabilitato e hover ci sono e sono curati.

**9. Il buon design rispetta l'ambiente — 1/3**
Prove: **1.739.830 byte** di JS+CSS nella finestra di controllo, di cui 1,12 MB
è l'Engine, caricato **anche** dalla finestra di uscita; la finestra di
controllo esegue **un Engine WebGL completo sull'anteprima in continuazione**,
misurato a 58,1 fps, con `backgroundThrottling` disattivato esplicitamente su
entrambe le finestre (`main/index.ts:124`, `:128`, `:181`, `:184`) e nessun
controllo "dirty" nel loop (`Engine.ts:2172-2184`); più una seconda catena rAF
solo per il contatore FPS. Sul carico di attenzione, che questo principio
include: 173–244 controlli.
Perché 1 e non 2: la banda 500 KB–2 MB è quella, e il consumo vero non è
nemmeno il bundle — è il rendering a pieno regime davanti a una stanza vuota.
Perché 1 e non 0: sotto i 2 MB, nessun video in autoplay, e
`prefers-reduced-motion` **è** rispettato (`global.css:167-172`).

**10. Il buon design è meno design possibile — 0/3**
Prove: **11 affordance ripetute** (§A3). Sei superfici per scegliere un
effetto con **due cataloghi divergenti**; otto punti per salvare o richiamare
con **cinque archivi e 13 chiavi di localStorage**; **cinque meccanismi** per
aprire e chiudere un pannello, tre dei quali visivamente identici all'accordion
ma senza persistenza; tre implementazioni di slider-con-numero; quattro
meccanismi per dire qualcosa all'utente; tre interfacce per scegliere il genere
con due cataloghi; cinque punti d'ingresso per importare uno shader con due
sfogliatori; **`ParamControls` montato due volte sulla stessa schermata**, con
il suo pulsante Smart map duplicato (`EffectPanel.tsx:465` e
`ShaderEditor.tsx:469`); ~30 trattamenti di pulsante; 16 dichiarazioni morte
che il progetto non vede perché `noUnusedLocals` non è attivo.
Perché 0: l'ancoraggio di 0 nomina esattamente questo — *"dominato da
decorazione o affordance duplicate"*. Sono undici, e una di esse mette lo
stesso pannello sullo schermo due volte.

---

## Totale

| # | Principio | Punteggio |
|---|---|---:|
| 1 | innovativo | 2 |
| 2 | utile | 1 |
| 3 | estetico | 1 |
| 4 | comprensibile | 1 |
| 5 | discreto | 1 |
| 6 | onesto | 1 |
| 7 | duraturo | 2 |
| 8 | curato | 1 |
| 9 | rispettoso delle risorse | 1 |
| 10 | meno design possibile | **0** |
| | **Totale** | **11 / 30** |
