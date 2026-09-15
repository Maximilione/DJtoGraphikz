# Evidenze — sistema visivo e stati (agente 2) + verifiche dell'orchestratore

Fonte primaria: `/tmp/djg-ui.png`, pro, zoom 0.5, build 0.47.0-beta. I valori
letti dal sorgente e non dallo stile calcolato sono marcati DEDOTTO.

## Spaziatura

Scala dichiarata a 8 gradini (`global.css:62-69`). **`--s6` (16px) e `--s8`
(32px) non sono referenziati da nessuna parte**: token morti.

**Valori distinti effettivamente disegnati: 14** — 1, 2, 3, 4, 5, 6, 7, 8, 10,
12, 14, 16, 20, 24. Sei vengono dai token, gli altri sono letterali sparsi:
3px in 14 punti, 10px in 7, 5px in 6, 1px in 7, 7px in 3. Nei `.tsx` gli
`style={{gap: 8}}` letterali sono la regola, non l'eccezione — compresi i due
pannelli nuovi (`VenuePanel.tsx:38`, `OutputsPanel.tsx:67,94`).

## Tipografia

Otto token (`global.css:71-87`). **Il CSS e' tokenizzato al 100%**: zero
`font-size` letterali in `global.css` e `features.css`.

I letterali stanno solo nei `.tsx`: `13` (5 punti), `14` usato come testo
(`AudioPanel.tsx:497,568,584,597,607`) mentre il token `--fs-icon` e' dichiarato
per le icone, `12` (2), `8` in un SVG (`MappingPanel.tsx:94`, sotto il minimo
dichiarato), `34` fuori scala (`RemoteModal.tsx:46`).

**Dimensioni distinte disegnate: 10**, due fuori scala.

## Colore

21 valori letterali dietro 29 nomi di token, **piu' 21 valori una-tantum nel
CSS** e ~9 nei `.tsx`: **≈51 colori di interfaccia**. Diciannove dei 21
una-tantum sono lo stesso colore di un token ridigitato a un'alfa diversa,
perche' **sui token non esiste un meccanismo di alfa**: sette alfa del nero,
sette dell'accento, quattro del pericolo.

### VERIFICATO DALL'ORCHESTRATORE — `--warn` non esiste

`OutputsPanel.tsx:73` scrive `color: 'var(--warn, #e0a030)'`. In tutto `src/`
il token e' **`--warning`** (`global.css:42`), `--warn` non e' dichiarato da
nessuna parte: **vince sempre il ripiego `#e0a030`**, un colore che non esiste
altrove nel progetto. L'avviso sui pixel del pannello piu' nuovo e' dipinto
fuori palette. Difetto introdotto in v0.47.0-beta.

## Contrasto — il peggio sta fuori dal controllo automatico

### VERIFICATO DALL'ORCHESTRATORE (aritmetica WCAG rifatta a mano)

| coppia | rapporto | esito |
|---|---:|---|
| `.btn-danger` `#fff` su `--danger` `#ff4455` (`global.css:337-338`) | **3,38:1** | **sotto 4.5** |
| stesso bottone in hover, `#fff` su `--danger-dim` `#e03546` (`global.css:341`) | **4,41:1** | **sotto 4.5** |
| se fosse `#000` sullo stesso rosso | 6,21:1 | passerebbe |
| `.btn-primary` `#000` su `--accent` | 15,66:1 | passa |

`scripts/check-contrast.mjs` mette il testo **solo su `bg0..bg3`**: non prova
mai un testo sopra un **comando pieno**, quindi questa coppia gli e' invisibile
e il controllo resta verde. Il peggio che vede e' 4,67 (`--text-muted` su
`bg3`).

Secondo buco: `.u-error` mette testo `--danger` sulla **propria tinta**
`rgba(255,68,85,0.12)` (`global.css:1364-1371`). Appiattito su `bg1` fa 4,99;
dentro un contesto `bg3` fa **4,29**.

## Stati

Finestra intera: vuoto PRESENTE (ma ogni pannello se lo scrive da solo, nessun
componente condiviso), **caricamento QUASI ASSENTE** (due soli scambi di
etichetta, `IsfBrowser.tsx:91`, `OverlayPanel.tsx:222`; nessuno spinner, nessun
`aria-busy`, niente per avvio motore, elenco dispositivi, import preset,
compilazione shader), errore PRESENTE su tre livelli, successo PRESENTE
(`toast-ok`), fuoco PRESENTE, disattivato PRESENTE.

### I due pannelli nuovi

**Uscite**: vuoto N/A per costruzione, ma **se non c'e' nessun display il menu
non lo dice** (`:102-106`, solo "Automatico"); **caricamento assente**;
**errore assente e, peggio, ingoiato**: `:18`
`try { window.api?.setOutputs?.(clean) } catch {}` — se l'IPC fallisce il
pannello mostra una configurazione che il proiettore non ha mai ricevuto;
successo PARZIALE (`:187` toast senza livello → neutro, non `toast-ok`, e solo
se le uscite sono piu' di una).

**Posti**: vuoto PRESENTE (`:44`), caricamento assente, errore PRESENTE
(`:31`), successo PARZIALE (`:35` toast neutro invece di `ok`; **la
cancellazione non da' alcun riscontro**).

Trasversale: entrambi i pannelli nuovi emettono il successo al livello di
default, quindi il trattamento `toast-ok` — aggiunto apposta e motivato in
`Toasts.tsx:23-27` ("uno stato di successo che non si distingue da un
fallimento non e' uno stato di successo") — **non li raggiunge**.

## Dalla fotografia

- **Il cromo e' il ~19% della superficie**, la preview l'81%. Dodici superfici
  di pannello visibili, due aperte per colonna.
- **Striscia orfana sotto ogni pannello chiuso**: l'intestazione tiene
  `padding-bottom` + `margin-bottom` + `border-bottom` (`global.css:253-255`)
  mentre il corpo non viene disegnato (`Panel.tsx:45`). Otto pannelli chiusi ×
  ~21px ≈ **170px della colonna** sono vuoto rigato, e ogni titolo chiuso ha
  sotto una linea che non divide niente. VERIFICATO nel CSS.
- **Le due colonne non hanno lo stesso ritmo**: a sinistra il contenuto arriva
  fino al bordo inferiore, a destra finisce a y≈900 e restano ~230px di fondo
  nudo.
- **Due comandi tagliati**: la riga TRANSIZIONE taglia il quinto bottone a
  meta' parola ("Gra"), senza ellissi ne' scorrimento; la barra dei deck in
  basso e' **tagliata a meta' in altezza**, e i due deck non mostrano gli
  stessi comandi (A ha solo un cursore, B ne ha quattro).
- **Tre grammatiche di intestazione** nella colonna sinistra: intestazione di
  Panel, barra a schede (EFFETTI/POST FX/COLORI — l'unico blocco che **non si
  puo' chiudere**, ed e' quello che occupa piu' spazio), titoli di sezione
  nudi. Dentro lo stesso pannello, PARAMETRI e TRANSIZIONE sono riquadrati,
  GEOMETRICI/ORGANICI/MOVIMENTO no.
- **Le miniature sugli effetti coprono un sottoinsieme arbitrario** e dove ci
  sono l'etichetta ci finisce sopra: Voronoi, Truchet, Quasi, String, Fire,
  Ink, React, Smoke, Ripples sono nettamente meno leggibili dei vicini piatti
  nella stessa griglia.
- **Lo stesso tipo di comando ha due taglie a 180px di distanza**: i cursori
  dei parametri hanno ~45px di corsa utile, quello della sensibilita' beat ne
  ha ~150.
- In PRESET & SCALETTE, `Salva` non ha bordo ne' riempimento e si legge come
  un'etichetta; `Importa` ed `Esporta`, coppia di pari funzione, hanno due
  luminosita' di testo diverse.

## Buchi dichiarati

Nessuno stile calcolato letto (niente browser): tutti i px e i colori sono
dedotti dal sorgente. Gli **otto pannelli chiusi**, fra cui **Uscite e Posti**,
non danno evidenza visiva: i loro stati sono giudicati solo a codice. Hover,
trascinamento e anello di fuoco non compaiono nella fotografia.
