# 02 — Pagella

Regole applicate: **si giudica l'istanza peggiore, non la media**; nel dubbio
**si prende il punteggio piu' basso**; nessun bonus, nessun peso, dieci
principi uguali.

---

**1. Buon design e' innovativo — 2/3**
Evidenze: camera master che ricampiona la scena **prima** del sampling, quindi
agisce su tutti e 46 gli effetti e sugli ISF insieme (`camera.frag`, pass prima
dei post-FX); tap/tieni-premuto identico su tastiera, MIDI e telefono
(`momentary.ts`); profili di locale; uscite a fette.
Perche' 2 e non 3: la camera e' un avanzamento vero rispetto ai pari, il resto
e' grammatica VJ standard rifinita bene. Non c'e' un secondo gesto che i
concorrenti non abbiano.
Perche' non 1: non e' imitazione con variazione minima.

**2. Buon design rende utile il prodotto — 2/3**
Evidenze: il compito primario (cambiare immagine a tempo) si fa da tastiera in
un gesto — 1-0, QWER, Shift+cifra, tutti con momentaneo. Ma **sovrascrivere un
look non ha percorso da tastiera** (`LookBank.tsx:122` esce, la sovrascrittura
e' solo Shift+click a `:180`); crossfade, camera, AutoVJ e tutto schermo non
hanno tasto; la fisarmonica impedisce di avere Uscite e Posti nel percorso di
tabulazione insieme (`Panel.tsx:10-11`); **"Automatico" e' un comando civetta
che non fa niente** (`OutputsPanel.tsx:102` + `main/index.ts:354`).
Perche' 2: il compito primario si completa, la superficie adiacente aggiunge
passi. Perche' non 3: esistono comandi che non portano da nessuna parte.

**3. Buon design e' estetico — 1/3**
Evidenze: **14 valori di spaziatura** disegnati su 8 token dichiarati (due dei
quali, `--s6` e `--s8`, mai referenziati); **10 dimensioni di testo**, due fuori
scala (`MappingPanel.tsx:94` a 8px, `RemoteModal.tsx:46` a 34px); **~51 colori
di interfaccia** contro 29 nomi di token, 19 dei quali sono un token ridigitato
a un'alfa diversa; **striscia orfana di ~21px sotto ognuno degli otto pannelli
chiusi** (`global.css:253-255` + `Panel.tsx:45`), ~170px di colonna che sono
vuoto rigato sotto titoli che non dividono niente; **due comandi tagliati**: il
quinto bottone di TRANSIZIONE a meta' parola e la barra dei deck tagliata in
altezza, con i due deck che non mostrano gli stessi comandi.
Perche' 1 e non 2: molto oltre le due incoerenze minori, e i comandi tagliati
sono una violazione che si vede a occhio nudo nella prima schermata.
Perche' non 0: un sistema visibile c'e' — token, un solo meccanismo di
ripiegamento, CSS tokenizzato al 100% sulla tipografia.

**4. Buon design rende comprensibile il prodotto — 1/3**
Evidenze: **"Tetto"** (`OutputsPanel.tsx:145`) e **"Spinta"**
(`CameraPanel.tsx:71`) non si decodificano dall'etichetta, la spiegazione sta
solo nella guida o nel tooltip; **"Prova a secco"** in un'app audio vuol dire
un'altra cosa; **"Binding"/"device"** convivono con "assegnazione" e
"Dispositivo" negli stessi pannelli; la guida **nomina parametri che
nell'interfaccia hanno altri nomi** ("Speed e React" contro "Velocita'" e
"Reazione", `QuickGuide.tsx:60` contro `EffectParams.ts:29-30`); **tre
grammatiche di intestazione** nella stessa colonna sinistra.
Perche' 1: piu' di tre comandi restano oscuri senza tooltip e il gergo e'
presente. Perche' non 0: l'azione primaria e' identificabile e la striscia
in basso insegna la tastiera senza tutorial.

**5. Buon design e' discreto — 2/3**
Evidenze: il cromo e' ~19% della superficie, la preview l'81%; zero animazioni
CSS in ciclo (un solo `@keyframes`, l'entrata del toast); niente decorazione;
la striscia di aiuto in basso e' permanente e silenziosa. Contro: **150
controlli in pro**, e ~170px di colonna destra occupati da nulla rigato.
Perche' 2: il cromo si vede ma sta zitto. Perche' non 3: in pro non recede.

**6. Buon design e' onesto — 1/3**
Evidenze (tutte riverificate a mano): **`"Torna al vivo"` ferma l'audio invece
di tornare all'ingresso** (`AudioPanel.tsx:352-356` → `:230-234`); **la guida
dice che si registra la finestra di output da un pannello dedicato** mentre il
registratore e' un bottone di barra che cattura la preview
(`QuickGuide.tsx:92-94` contro `App.tsx:394`), tanto che il tooltip del bottone
la smentisce; **"Automatico" non sposta niente**; **otto toast dichiarano
scritture mai verificate**, mentre `storage.ts:50` scrive la regola
("Callers must not show what they did not save") — due di quegli otto sono
entrati oggi; `OverlayPanel.tsx:147-159` annuncia una cancellazione dopo aver
ingoiato il rifiuto; **"Scarica" apre una pagina web**.
Perche' 1: ben oltre le due gonfiature — sono scostamenti fra etichetta e
comportamento, che e' peggio. Perche' non 0: **nessun dark pattern, nessun
flusso ingannevole**, nessuna superficie commerciale; gli errori veri sono
detti per intero ("Accesso audio negato: …") e la cancellazione senza ritorno
lo dichiara.

**7. Buon design e' duraturo — 3/3**
Evidenze: nessun marcatore di moda — niente vetro, niente gradienti, niente
ombre morbide, niente tipografia di tendenza; scuro utilitario, monospace sui
numeri, `prefers-reduced-motion` rispettato globalmente
(`global.css:176-181`). Perche' 3: e' la stessa lingua di un mixer, e fra tre
anni si legge uguale.

**8. Buon design e' curato fino all'ultimo dettaglio — 1/3**
Evidenze: **lo stato di caricamento non esiste quasi** — due soli scambi di
etichetta in tutta l'app (`IsfBrowser.tsx:91`, `OverlayPanel.tsx:222`), nessuno
`aria-busy`, niente per avvio motore, elenco dispositivi, import preset,
compilazione shader; nel pannello **Uscite l'errore e' assente e ingoiato**
(`OutputsPanel.tsx:18`, `catch {}`): l'IPC fallisce e il pannello mostra una
configurazione che il proiettore non ha mai ricevuto; **entrambi i pannelli
nuovi emettono il successo al livello sbagliato**, quindi il trattamento
`toast-ok` non li raggiunge, e la cancellazione di un Posto non da' riscontro;
stati vuoti scritti a mano uno per pannello, nessun componente condiviso.
Perche' 1: due stati su sei mancano o sono rotti (caricamento ovunque, errore
nel pannello piu' nuovo) e il successo e' degradato. Perche' non 0: fuoco,
disabilitato, errore ed empty esistono e sono curati.

**9. Buon design rispetta le risorse — 1/3**
Evidenze: **1,71 MiB di payload iniziale, 1,66 MiB dei quali JS, non compresso
(file://), zero chunk lazy**; **due loop WebGL completi a 60 Hz** (preview +
uscita) che ridisegnano anche a schermo fermo; ~240 chiamate/s di listener; un
poll a 1 Hz e uno a 500 ms che **non si fermano nemmeno a pannello chiuso**
(`AudioPanel.tsx:145`); uno scrittore sincrono in localStorage ogni 400 ms con
le immagini in base64.
Perche' 1: il payload sta nella fascia 500KB-2MB e il motore gira sempre.
Perche' non 0: sotto i 2 MB, zero animazioni in ciclo, `prefers-reduced-motion`
rispettato, nessun video in autoplay, nessuna rete sul percorso critico.

**10. Buon design e' il meno design possibile — 1/3**
Evidenze: **tre bottoni "salva quello che vedo" su tre archivi diversi**
(`looks`, `presets`, `playlists`) che chiamano tutti `engine.createPreset()`;
**cinque implementazioni diverse di "scegli uno fra N"**; due coppie
Importa/Esporta nello stesso pannello; **23 import inutilizzati**, 7 export mai
importati, **2 token di spaziatura morti**; l'unico blocco che occupa piu'
spazio di tutti (EffectPanel) e' anche **l'unico che non si puo' chiudere**.
Perche' 1: gli elementi rimovibili sono ben piu' di cinque. Perche' non 0: la
pagina non e' dominata da decorazione — le superfici ripetute sono per lo piu'
canali d'ingresso diversi (tastiera, telefono, OSC), non copie, e il
ripiegamento dei pannelli e' gia' un meccanismo solo.

---

## Totale

| # | Principio | 14 set (v0.40.0) | oggi (v0.47.0) |
|---|---|---:|---:|
| 1 | innovativo | 2 | 2 |
| 2 | utile | 2 | 2 |
| 3 | estetico | 2 | **1** |
| 4 | comprensibile | 2 | **1** |
| 5 | discreto | 2 | 2 |
| 6 | onesto | 3 | **1** |
| 7 | duraturo | 3 | 3 |
| 8 | curato | 2 | **1** |
| 9 | rispettoso delle risorse | 1 | 1 |
| 10 | meno design possibile | 2 | **1** |
| | **Totale** | **21 / 30** | **15 / 30** |

Sette release in un giorno hanno aggiunto funzioni; la superficie non le ha
seguite. Le cinque cadute sono tutte della stessa famiglia: **roba nuova
appoggiata accanto a quella vecchia invece che dentro**.
