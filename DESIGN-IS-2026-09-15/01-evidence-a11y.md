# Evidenze — accessibilita' e tastiera (agente 5)

Tutto verificato a codice sulla v0.47.0-beta. Nessun punteggio: fatti.

## Contrasto (`yarn check:contrast`, uscita reale, exit 0)

28 coppie di testo su 4 superfici: **tutte passano 4.5:1**. 4 coppie di anello
di fuoco: **tutte passano 3:1**. Margini piu' stretti: `--text-muted` su `bg3`
a **4.67** (`scripts/check-contrast.mjs:54`, token `styles/global.css:30`) e
`--danger` su `bg3` a **4.88** (`global.css:40`).

`yarn check:buttons`: 4 trattamenti autonomi su un tetto di 4, 17 classi
costruite su `.btn`. Verde, ma al limite del ratchet.

### Cosa il controllo NON guarda (buco di copertura)

- **`styles/features.css` non viene letto affatto** (`check-contrast.mjs:17`
  legge solo `global.css`). Restano fuori: `#fff` a `features.css:13`; la
  fascia d'avviso audio `rgba(255,170,0,0.12)` (`features.css:29`); e la
  **fascia PROIETTORE NERO** `rgba(255,68,85,0.14)` con `color: var(--danger)`
  (`features.css:296,298`) — danger su tinta danger, esattamente la coppia che
  lo script non puo' vedere, sull'avviso piu' importante che l'app dia.
- **Testo su riempimento accento o pericolo mai misurato**: `.btn-primary`
  `#000` su `--accent` (`global.css:317-321`), `.btn-danger` `#fff` su
  `--danger` (`global.css:335-338`).
- **Sei token di banda usati come colore di testo** sui chip
  (`global.css:48-52` → `features.css:242-246`): mai testati.
- **Gli stati disattivati non sono modellati**: `.btn:disabled{opacity:.45}`
  (`global.css:312`), `.btn-ghost:disabled{opacity:.35}` (`global.css:363`),
  `.pal-btn:not(.active){opacity:.4}` (`global.css:1502`). Un'etichetta muted
  disattivata scende ben sotto 4.5:1 e lo script continua a dire 4.67.
- **Contrasto non testuale solo sull'anello di fuoco**: `--line` `#20202c` e
  `--line-strong` `#2e2e3e` (`global.css:20-21`) sono i bordi di ogni
  `.btn-secondary`, `select` e campo di testo e **non arrivano a 3:1** su
  `#0a0a0e` (WCAG 1.4.11 non coperto).
- Testo sopra la preview viva (`.preview-toggle`, `features.css:213-216`) ha
  uno sfondo che cambia a ogni frame: nessun controllo statico lo copre.

## Ordine di fuoco (modalita' pro)

Nessun `tabIndex` positivo in tutto il renderer (unico `tabIndex={0}`:
`NumberInput.tsx:97`). Ordine = ordine DOM. I primi 15: SIMPLE, PRO, LIVE
(`App.tsx:709,716,723`), INTENS. (`735`), MASTER (`750`), BLACK (`761`),
FREEZE (`768`), PANIC (`775`), screenshot (`787`), registra (`790`), telefono
(`797`), riapri output (`807`, solo se chiusa), schermo (`817`, solo con piu'
display), risoluzione (`831`), tutto schermo (`849`).

Fuori posto rispetto a dove si vedono:

- **Il bottone "annulla" del toast e' l'ultimo nodo dell'app**
  (`App.tsx:994`, bottone `Toasts.tsx:83`) ma si vede fisso in basso a destra
  (`features.css:50-58`); il toast si distrugge dopo 5000 ms
  (`Toasts.tsx:31`), quindi **con la tastiera non lo raggiungi mai in tempo**.
- **Nessuno dei cinque modali prende il fuoco**: onboarding, remote, menu
  aiuto, scorciatoie, guida (`App.tsx:681-692`). Nessun `.focus()`, nessun
  `autoFocus`, nessuna trappola, nessun ripristino alla chiusura. Aprire
  l'aiuto lascia il fuoco sul bottone dietro al modale. Tutti e cinque
  chiudono con Escape.

## Raggiungibilita' da tastiera, azione per azione

Con tasto dedicato: effetto (1-0), post (QWER), look (Shift+1..0), blackout
(B), freeze (F), panic (P), master ([ ]), intensita' (I), tap (Space) — tutti
con tap/tieni-premuto (`momentary.ts`, `App.tsx:533,588-592`).

Senza tasto: **crossfade A/B**, **camera**, **AutoVJ**, **tutto schermo
uscita**, i controlli di **Uscite** e **Posti**.

Due cose operative:

- **Sovrascrivere un look non ha percorso da tastiera**: `Shift+digit` su uno
  slot pieno richiama e basta (`LookBank.tsx:122`), la sovrascrittura e' solo
  Shift+**click** (`LookBank.tsx:180`). Salvare su slot vuoto invece si fa
  (Tab + Invio).
- `group="right"` rende la colonna destra una fisarmonica (`Panel.tsx:10-11`):
  aprire Uscite chiude Posti, quindi **un operatore da tastiera non puo' avere
  i due pannelli nel percorso di tabulazione insieme**.

## ARIA

`role=` **0**. `aria-live` **0**. `aria-controls` **0**. `aria-label` 27,
`aria-pressed` 7, `aria-expanded` 1, `aria-hidden` 1.

- **Zero punti di riferimento**: niente banner/main/complementary/contentinfo
  (`App.tsx:695,898,901,957,973`), tutti `<div>`.
- **I toast non vengono annunciati** (`Toasts.tsx:78`, nessun `role="status"`).
- **Le due fasce di allarme non vengono annunciate**: audio perso
  (`App.tsx:875`) e **PROIETTORE NERO** (`App.tsx:881`). Sono le due condizioni
  che l'operatore deve sapere subito.
- Semantica di disclosure a meta': `aria-expanded` sul `Panel` (`Panel.tsx:38`)
  senza `aria-controls` e senza id sul corpo (`Panel.tsx:45`).
- Il selettore di modalita' non e' un gruppo: tre bottoni esclusivi senza
  `role="radio"` ne' `aria-current`, lo stato attivo e' solo una classe CSS.
- **I due cursori piu' usati non hanno nome accessibile**: INTENS. e MASTER
  hanno solo `title=` (`App.tsx:735,750`).
- A credito: `aria-pressed` su tutti e sette i veri interruttori, `aria-label`
  su ogni bottone a sola icona, icone `aria-hidden`.

## Skip link

**No.** Nessun meccanismo di salto, e senza punti di riferimento l'unico modo
di arrivare a un pannello della barra laterale e' **16 Tab**.

## Visibilita' del fuoco

Regola globale `:focus-visible` con anello 2px su ogni tipo interattivo
(`global.css:183-192`), misurato 5.84–6.45:1. I tre `outline: none`
(`global.css:157,162,1203`) sono tutti sostituiti. Incoerenza minore: campi e
select sommano anche un `box-shadow` su `:focus` semplice
(`global.css:857-860,877-880,893-896`), quindi il peso visivo del fuoco cambia
fra bottone e campo.

## Buchi dichiarati

Contrasto reale sopra la preview viva; albero di accessibilita' vero (l'ordine
e' dedotto dal sorgente); comportamento con uno screen reader; conteggio esatto
dei focusabili prima dello stack dei toast.
