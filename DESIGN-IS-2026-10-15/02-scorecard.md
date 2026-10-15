# 02 — Pagella

Punteggio dell'orchestratore, non dei subagent (vedi regola della skill).
Peggiore istanza, non media. In dubbio fra due punteggi → il più basso.

```
1. Innovativa — Voto: 2/3
   Evidenza: Magic Mapping, FX momentanei, Camera master, macro Intensità
   — tutti perfezionamenti reali di pattern già visti nei VJ tool di
   categoria (studio di mercato 2026-10-01), non un pattern assente in
   5+ prodotti pari.
   Motivazione: migliora un pattern esistente con un vantaggio chiaro, non
   lo inventa né lo copia senza variazione.

2. Utile — Voto: 2/3
   Evidenza: il compito primario (cambiare effetto a tempo) resta un
   gesto da tastiera; ma DeckPanel.tsx:91 (selezione clip deck B) è
   irraggiungibile da tastiera, senza scorciatoia alternativa — 01-evidenza.md §Accessibilità.
   Motivazione: il compito primario funziona in un gesto, ma una
   superficie adiacente (deck B) aggiunge un vicolo cieco.

3. Estetica — Voto: 1/3
   Evidenza: tipografia ora tutta a token (vero miglioramento), ma
   spaziatura (11 letterali su 8 token) e colore (45 letterali su 21
   token) restano inconsistenti, più l'eccezione EffectPanel che rompe
   l'intestazione unificata — 01-evidenza.md §Visivo.
   Motivazione: 3-5 inconsistenze reali, nessun miglioramento netto sul
   totale rispetto a settembre (un sistema migliora, due no).

4. Comprensibile — Voto: 2/3
   Evidenza: "Spinta" e "Prova a secco" ora hanno tooltip; resta solo
   "Tetto" senza spiegazione sul controllo (solo nella guida) —
   01-evidenza.md §Copia e onestà. Intestazioni unificate da 3 stili a 1.
   Motivazione: un solo controllo primario resta poco chiaro — soglia
   esatta del 2/3, miglioramento reale rispetto a settembre (due termini
   su tre risolti).

5. Discreta — Voto: 2/3
   Evidenza: zero animazioni incondizionate a riposo, `prefers-reduced-motion`
   rispettato — 01-evidenza.md §Peso. Nessuna nuova decorazione trovata.
   Motivazione: il chrome resta quieto, nessuna prova di peggioramento o
   di salto a un sistema dove il contenuto è integralmente la figura.

6. Onesta — Voto: 1/3
   Evidenza: "Torna al vivo" **ancora** etichetta "torna al vivo" un
   pulsante che si limita a fermarsi — confermato da due letture
   indipendenti del codice, stesso bug di settembre, un mese e 28 release
   dopo, intoccato. Più due violazioni fresche della regola
   "non mostrare ciò che non hai verificato" (`PresetPanel.tsx:312-313`,
   `OutputsPanel.tsx:29/195-198`) — non residui, istanze nuove dello
   stesso difetto in codice scritto dopo l'audit di settembre —
   01-evidenza.md §Copia e onestà.
   Motivazione: 2+ scollamenti etichetta↔comportamento, nessun pattern
   ingannevole strutturato (niente dark pattern) — ma il difetto critico
   che ha innescato il REDESIGN di settembre è ancora lì, e lo stesso
   difetto si sta ripresentando in codice nuovo: non è un caso isolato,
   è l'assenza di una barriera (helper condiviso, lint) che lo impedisca.

7. Duratura — Voto: 3/3
   Evidenza: nessun marcatore di moda datato trovato, estetica scura
   utilitaria invariata, `prefers-reduced-motion` rispettato.
   Motivazione: stabile, nessuna prova di tendenza passeggera introdotta.

8. Accurata nei dettagli — Voto: 1/3
   Evidenza: disabled/focus/error ora condivisi e verificati a dovere, ma
   empty/loading/success restano senza alcun componente condiviso —
   nessuno dei tre trovato in `src/renderer/components/**`
   — 01-evidenza.md §Visivo.
   Motivazione: 3 stati su 6 restano non pensati come sistema (invariato
   da settembre: il guadagno su `error` è reale ma lo stesso numero di
   stati — 3 — resta scoperto).

9. Rispettosa delle risorse — Voto: 0/3
   Evidenza: JS iniziale passato da 1,71 MiB a **3,17 MiB** (+85% in 28
   release, oltre la soglia di 2 MB della scala); 4 `setInterval`
   incondizionati + 2 RAF, **nessuno** legato a `visibilitychange`/focus
   finestra — confermato peggiore di settembre, non uguale
   — 01-evidenza.md §Peso.
   Motivazione: il peso supera 2 MB (soglia esplicita per lo 0 nella
   scala) ed è una misura diretta, non una stima — non più "stabile a
   1/3" come a settembre, un vero peggioramento quantificato.

10. Il meno design possibile — Voto: 1/3
    Evidenza: pattern "chip" ancora in 4 implementazioni indipendenti,
    salva-poi-toast ancora duplicato per pannello senza helper condiviso,
    EffectPanel resta l'unico blocco non collassabile — più 14
    import/tipi morti sostanziali (in crescita, non in calo rispetto ai
    "2 token morti" di settembre) — 01-evidenza.md §Strutturale.
    Motivazione: 3-5+ elementi rimovibili, nessuna delle tre cose
    segnalate a settembre è stata davvero consolidata.
```

**Totale: 15/30** (invariato rispetto a settembre, ma composizione diversa:
#4 migliorato 1→2, #9 peggiorato 1→0 — il miglioramento sulla
comprensibilità è stato esattamente compensato dal peggioramento sul peso).
