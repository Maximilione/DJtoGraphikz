# 05 — Contro-audit (fase V)

Stessa rubrica di `02-scorecard.md`, stesse regole: **in dubbio si prende il
punteggio più basso**, si giudica **l'istanza peggiore e non la media**,
nessun bonus, massimo 30.

Misurato su **v0.39.1-beta + fase V**, dopo A1 (fondamenta), A2 (tastiera),
A3 (lingua e onestà), A4 (una superficie sola).

---

## Le misure, prima e dopo

| Misura | Audit (0.35) | Ora | Come |
|---|---:|---:|---|
| Controlli a schermo — Pro | ≈173 | **139** | `yarn check:ui`, contati nel DOM vero |
| Controlli a schermo — Semplice | ≈125 | **111** | idem |
| Controlli a schermo — Live | ≈47 | **36** | idem |
| Trattamenti di pulsante autonomi | ~30 | **4** | `yarn check:buttons` |
| Affordance ripetute | 11 | **2 aperte** | vedi sotto |
| Chiavi di `localStorage` con una porta sola | 0 su 13 | **tutte** | `storage.ts` |
| Versione di schema salvata | nessuna | **1** | `stampSchemaVersion()` |
| Spaziature letterali | 80,5% (22 valori) | **56% (19 valori)** | script in questo file |
| `font-size` letterali | 9 dimensioni rese | **0** | tutte a token |
| Colori ad-hoc nei CSS | 32 | **2** (`#000`, `#fff`) | il resto sono token |
| Contrasto testo / bordi | 2,87:1 / 1,42:1 | **≥4,5:1 / ≥3:1** | `yarn check:contrast` |
| Elementi cliccabili non raggiungibili da tastiera | 30 | **0** | solo fondali di modale |
| Peso JS della finestra di controllo | 1,74 MB | **1,65 MB** | `out/renderer/assets` |
| Catene rAF nella finestra di controllo | 2 | **1** | il contatore FPS conta i frame del motore |

## Le undici affordance ripetute, una per una

| | Pattern | Stato |
|---|---|---|
| R1 | Scegliere un effetto: 6 superfici, **2 cataloghi** | **chiuso sul catalogo**: uno solo (`catalog.ts`), il deck B è passato da 21 effetti a 46. Le superfici restano, ma sono canali d'ingresso diversi (griglia, tasti, telefono, OSC), non copie |
| R2 | Salvare o richiamare: 8 punti, 5 archivi, 13 chiavi | **chiuso**: una porta sola, nessuna chiave scritta a mano, una versione di schema |
| R3 | Aprire un pannello: 5 meccanismi | **chiuso**: `<Panel>` per i pannelli, `<details>` nativo per un suggerimento dentro un pannello, nient'altro si piega. La regola sta scritta in `Panel.tsx` |
| R4 | Slider con numero: 3 implementazioni | **chiuso**: `<SliderRow>` |
| R5 | Dire qualcosa all'utente: 4 meccanismi | **non è duplicazione**: sono quattro lavori diversi (evento passato / condizione che blocca la serata / condizione di un pannello / stato dal vivo). Il confine è scritto in `Toasts.tsx` perché non ne nasca un quinto |
| R6 | Stessa azione da pannello + tasto + remoto + MIDI, **con buchi asimmetrici** | **aperto**. Quattro azioni hanno il tasto e nessun modo di scoprirlo dal pannello, cinque hanno il MIDI e non il tasto |
| R7 | Genere: 3 interfacce, 2 cataloghi | **chiuso sul catalogo** (`GENRES`), e le interfacce sono 2: il controllo dell'app e la griglia del wizard, che si vede una volta sola |
| R8 | Importare uno shader: 5 punti d'ingresso, 2 sfogliatori | **aperto** |
| R9 | `ParamControls` montato due volte | **chiuso** |
| R10 | 5 modali, 3 comportamenti di chiusura | **chiuso** in A2 |
| R11 | ~30 trattamenti di pulsante | **chiuso**: 4, e sono il vocabolario |

Aperte e davvero rimovibili: **R6 e R8**.

---

## Pagella

**1. Innovativo — 2/3** (era 2)
La forma non è cambiata: colonne ai lati, anteprima al centro, transport in
alto. Resta l'architettura a due finestre con la diagnostica del proiettore,
che era già il punto di merito. Niente in A1–A4 ha toccato l'impianto, quindi
il punteggio non si muove. Perché non 3: l'impianto è ancora quello di
Resolume e VDMX.

**2. Utile — 2/3** (era 1)
I 30 elementi non raggiungibili da tastiera sono zero: `grep` su `onClick` di
`div`/`span` restituisce solo fondali di modale e i due `stopPropagation` delle
card. `Space` su un pulsante a fuoco lo preme invece di battere il BPM
(`hotkeys.ts`). Il deck B espone tutti e 46 gli effetti invece di 21.
Perché 2 e non 3: la matrice azione × superficie è ancora piena di buchi (R6) —
quattro azioni hanno un tasto che il pannello non nomina.

**3. Estetico — 2/3** (era 1)
Zero `font-size` letterali, due soli colori ad-hoc (`#000` e `#fff`), quattro
trattamenti di pulsante contro una trentina, una sola griglia di palette e una
sola riga di slider. Perché 2 e non 3: la spaziatura è ancora al 56% di
letterali su 19 valori distinti — un asse del sistema su tre non è a token.
Perché 2 e non 1: è un'incoerenza, non tre.

**4. Comprensibile — 2/3** (era 1)
Le 91 etichette di parametro sono in italiano; le velocità LFO dicono l'unità;
le cinque transizioni hanno un nome solo; nessun identificatore interno arriva
più a schermo. Perché 2 e non 3: qualche etichetta resta corta per forza
(`Trans.`, `Intrvl`) e si capisce dal tooltip.

**5. Discreto — 2/3** (era 1)
L'overlay a scanline su `z-index: 2147483647` non c'è più: era decorazione
sopra ogni pixel dell'app, testo compreso. I controlli scendono da 173 a 139 in
Pro e da 47 a 36 in Live. Perché 2 e non 3: 139 controlli in una colonna che
scorre sono ancora tanti — il cromo è tranquillo ma si vede.

**6. Onesto — 3/3** (era 1)
Le sei gonfiature sono chiuse: Smart map si chiama "Collega all'audio" e dice
cosa fa davvero, si scrive prima e si mostra dopo, i look di fabbrica arrivano
da ogni uscita del wizard, `×½`/`×2` dichiarano che spengono l'automatico, le
cancellazioni distruttive hanno annulla o conferma, e la libreria distingue ciò
che si recupera da ciò che sparisce dal disco. Una scrittura che fallisce lo
dice. Nessun flusso ingannevole, nessuna superficie commerciale.

**7. Duraturo — 3/3** (era 2)
L'unico marcatore datato che l'audit aveva trovato — la texture CRT — non c'è
più. Restano caratteri di sistema, una sola curva di movimento, verde su nero,
che è la lingua del dominio da vent'anni e non la tendenza di quest'anno.

**8. Curato — 2/3** (era 1)
I sei stati ci sono tutti: vuoto, caricamento, errore, **successo** (i toast
hanno una severità, che prima non esisteva), fuoco (anello a 3:1, nessun
`outline: none` senza sostituto) e disabilitato. Perché 2 e non 3: il
caricamento esiste in tre componenti su venticinque — è presente, non curato
dappertutto.

**9. Rispettoso delle risorse — 1/3** (era 1)
1,65 MB contro 1,74: il bundle non è il punto e non si è mosso. Il consumo vero
resta quello che l'audit aveva indicato — la finestra di controllo rende
l'anteprima a pieno regime senza nessun controllo "dirty". Quel controllo sta
dentro `Engine.renderFrame()`, e il motore non si tocca durante il redesign
dell'interfaccia: è rimandato, per scelta, e scritto nel piano. Le due catene
rAF sono diventate una e il carico di attenzione è sceso, ma la banda
500 KB–2 MB con il rendering sempre acceso è ancora quella.

**10. Meno design possibile — 2/3** (era **0**)
Undici affordance ripetute sono diventate due davvero rimovibili (R6, R8): una
griglia di effetti, una di palette, una riga di slider, un modo di piegare un
pannello, un controllo Auto VJ, un `ParamControls`, una porta sul salvataggio,
quattro trattamenti di pulsante. Perché 2 e non 3: due restano.
Perché non 1: due, non tre.

---

## Totale

| # | Principio | Prima | Ora |
|---|---|---:|---:|
| 1 | innovativo | 2 | 2 |
| 2 | utile | 1 | **2** |
| 3 | estetico | 1 | **2** |
| 4 | comprensibile | 1 | **2** |
| 5 | discreto | 1 | **2** |
| 6 | onesto | 1 | **3** |
| 7 | duraturo | 2 | **3** |
| 8 | curato | 1 | **2** |
| 9 | rispettoso delle risorse | 1 | 1 |
| 10 | meno design possibile | **0** | **2** |
| | **Totale** | **11 / 30** | **21 / 30** |

## Verdetto

**REFINE.** Il totale supera 20 e nessun principio sta a 0: la soglia che la
fase V si era data è raggiunta, e il verdetto REDESIGN decade.

Le tre cose che restano, in ordine di leva:

1. **#9 — il controllo "dirty" nel motore** (`Engine.renderFrame()`). È il
   consumo vero e sta fuori dalla traccia UI per scelta dichiarata. Va fatto
   con il resto del lavoro sul motore.
2. **#2/#10 — R6, la matrice azione × superficie.** Quattro azioni hanno un
   tasto che il pannello non nomina, cinque hanno il MIDI e non il tasto.
3. **#10 — R8, i cinque punti d'ingresso per importare uno shader** con due
   sfogliatori ISF.

E, sotto soglia ma misurato: la spaziatura è l'unico asse del sistema visivo
ancora a metà (56% letterali), ed è quello che tiene il principio 3 a 2.
