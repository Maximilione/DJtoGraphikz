# 03 — Verdetto

## REDESIGN

**11/30, con uno zero sul principio 10.** La regola di Phase 3 dice REDESIGN
sotto 20; qui il totale è poco più di un terzo del massimo, e la ragione non è
che una schermata è brutta: è che la stessa cosa è stata costruita più volte in
posti diversi, e ogni copia ha preso decisioni leggermente diverse.

**Una frase**: il motore grafico di DJtoGraphikz è di livello alto e la
diagnostica del proiettore è migliore di quella dei concorrenti, ma
l'interfaccia che lo guida è cresciuta per accumulo — sei modi per scegliere un
effetto, otto per salvare, cinque per aprire un pannello, trenta per disegnare
un pulsante — e il costo si paga tutto insieme su comprensibilità,
raggiungibilità e coerenza visiva.

## Perché redesign e non refine

Non per il totale in sé, ma perché **il principio 10 ha preso 0 per affordance
duplicate**, e la duplicazione è strutturale, non cosmetica: due cataloghi di
effetti divergenti (46 contro 21), due percorsi di markup per la stessa griglia
(`EffectPanel.tsx:544` e `SimplePanel.tsx:91`), tre meccanismi di apertura
pannello che sembrano identici e si comportano diversamente, cinque archivi di
persistenza. Sistemare questo *dentro* la struttura attuale significa toccare
ogni pannello: è una ristrutturazione, e chiamarla "refine" servirebbe solo a
darsi il permesso di non farla.

Il secondo motivo è che tre principi diversi — 2 (utile), 4 (comprensibile) e
8 (curato) — falliscono **sulla stessa causa**: l'affordance è un `div` con
`onClick` invece di un pulsante, 30 volte. Da lì discendono l'irraggiungibilità
da tastiera, l'assenza di nome accessibile, l'assenza di stato di focus e
l'assenza di stato premuto. Una sola decisione strutturale sbagliata produce tre
voti bassi.

## Cosa NON è in discussione

L'audit riguarda l'interfaccia di controllo. **I visual sono il prodotto e sono
fuori discussione**: 46 effetti, buffer persistenti, effetti a geometria,
import ISF e Shadertoy, e un gate di rilascio che fotografa il proiettore vero.
Niente di tutto questo va toccato, e il redesign non deve rallentarlo.

## Le cinque mosse a maggior leva

1. **#10 — Un catalogo, un componente, una griglia.** Le sei superfici per
   scegliere un effetto diventano una sorgente sola. Si cancella l'elenco a
   mano di 21 effetti del deck B (`DeckPanel.tsx:10-14`) e la seconda griglia di
   `SimplePanel.tsx:91`. Prova: §A3 R1.

2. **#2 — Ogni affordance è un `<button>`.** I 30 `div onClick` di §E3
   diventano controlli veri, a partire da: salvare un look
   (`LookBank.tsx:184`), accendere e spegnere l'AutoVJ (`AutoVJPanel.tsx:43`,
   `SimplePanel.tsx:53`), accendere un post-FX (`EffectPanel.tsx:661`) e le
   otto intestazioni di pannello. E la guardia sulle hotkey smette di rubare
   `Space` ai pulsanti (`App.tsx:407-408`, `:431-434`). Prova: §E3, §E4, §E7d.

3. **#4 — Una lingua sola.** Si traducono le 91 etichette di parametro
   (`EffectParams.ts:29-258`), i 46 nomi di effetto, le 16 palette e i 9
   post-FX; si smette di mostrare identificatori interni all'utente
   (`EffectPanel.tsx:461`, `:636-638`, `DeckPanel.tsx:60-61`); le cinque
   transizioni hanno **gli stessi cinque nomi** nei due pannelli dove appaiono.
   Prova: §C5.

4. **#6 e #8 — Dire la verità su cosa è successo.** `pushToast()` prende una
   severità e nasce uno stato di successo distinto (`Toasts.tsx:27`,
   `features.css:64`); `savePreset` scrive su disco **prima** di dire che ha
   salvato (`PresetPanel.tsx:129-136`); ogni cancellazione ha conferma o
   annulla, con la stessa regola per immagini e video; e `seedFactoryLooks()`
   parte anche premendo `Salta`, o la guida smette di promettere otto look
   (`QuickGuide.tsx:55` contro `Onboarding.tsx:150`). Prova: §C3, §C4, §B5.

5. **#3 — Il testo si legge, il focus si vede.** `--text-muted` viene ritirato
   o schiarito finché non passa 4,5:1 su tutte e quattro le superfici
   (`global.css:30`, 37 usi, oggi fra 2,63 e 3,15); l'anello di focus arriva
   almeno a 3:1 (`global.css:37`, oggi 2,62); spariscono i tre `outline:none`
   senza sostituto e l'`outline:'none'` inline di `NumberInput.tsx:101`. Prova:
   §E1, §B5.
