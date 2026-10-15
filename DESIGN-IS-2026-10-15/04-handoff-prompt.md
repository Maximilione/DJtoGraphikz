/make-plan Redesign la grammatica di superficie della finestra di controllo di DJtoGraphikz (non il prodotto: motore, pipeline, gate, tastiera, linguaggio visivo restano stabili — vedi verdetto di settembre, stessa diagnosi). Audit attuale fallito a 15/30 con gap critici nei principi 6 (onestà), 9 (risorse), 3 (estetica), 8 (dettaglio), 10 (il meno design possibile).

Verdetto (citato da 03-verdict.md):
> DJtoGraphikz v0.75.1-beta chiude a 15/30 sui dieci principi di Rams, identico al totale di settembre (v0.47.0-beta) ma con un principio nuovo a zero (#9, rispetto delle risorse) mentre il difetto critico che aveva innescato il REDESIGN di settembre — principio #6, onestà — resta intatto: "Torna al vivo" etichetta ancora come "ritorno al vivo" un pulsante che si limita a fermare l'audio, lo stesso identico bug trovato un mese fa, e lo stesso tipo di difetto (toast di successo senza verifica della scrittura) si è ripresentato due volte in codice scritto *dopo* quell'audit — non è un residuo dimenticato, è un pattern che continua a infiltrarsi perché niente nel codice lo impedisce strutturalmente.

Perché redesign e non refine: totale sotto soglia (15 < 20) e il principio #9 è a 0 — superata anche solo una delle due condizioni basta. Il dato più pesante: un mese e 28 release, incluse due passate esplicite di sistema di design, non hanno mosso il totale di un punto — i difetti che non sono stati toccati sono quelli strutturali (nessuna barriera che impedisca al pattern "toast senza verifica" di ripresentarsi, nessun componente di stato condiviso, nessuna unificazione del pattern di scelta), non quelli cosmetici.

Preservare dal design attuale:
- Token di tipografia, completamente consolidati (8 scale, zero `font-size` letterale) — `src/renderer/styles/global.css:78-86`
- Componente `Panel.tsx` unificato per le intestazioni, usato in 12 file su 13 — `src/renderer/components/Panel/Panel.tsx:32-48`
- Pavimento di contrasto testo/bordo (4.5:1 / 3:1), verificato e verde — `scripts/check-contrast.mjs`
- Ratchet sulle classi dei bottoni (21 classi su `.btn`, tetto 4/4) — `scripts/check-button-classes.mjs`
- Regola di onestà già documentata (anche se non ancora imposta strutturalmente) — `src/renderer/storage.ts:50`
- Zero animazioni incondizionate a riposo, `prefers-reduced-motion` rispettato — `src/renderer/styles/global.css:177-182`
- Palette e brand tokens (21 colori nominati)

Scartare (i pattern strutturali che causano i fallimenti):
- **Toast call-site manuale per ogni pannello, nessun helper che imponga la verifica**. Evidenza: `PresetPanel.tsx:312-313`, `OutputsPanel.tsx:29/195-198` — due istanze NUOVE (non residue) dello stesso difetto. Causa il fallimento sul principio #6.
- **"Torna al vivo" come alias diretto di "ferma"**. Evidenza: `AudioPanel.tsx:487-490`, `onClick={stopAudio}` senza alcuna chiamata di riavvio. Causa il fallimento sul principio #6.
- **Quattro implementazioni indipendenti dello stesso pattern "chip"**. Evidenza: `ParamControls.tsx:145`, `PresetPanel.tsx:525`, `App.tsx:1198`, `OutputsPanel.tsx:173`. Causa il fallimento sul principio #10.
- **Poll a `setInterval` fisso, mai legati alla visibilità della finestra**. Evidenza: `App.tsx:460,885`, `AudioPanel.tsx:216,89` — zero occorrenze di `visibilitychange` in tutto `src/`. Causa il fallimento sul principio #9 insieme alla crescita del bundle.
- **Stati vuoto/caricamento/successo reinventati per pannello, mai condivisi**. Evidenza: nessun componente `EmptyState`/`LoadingState`/`SuccessState` esiste in `src/renderer/components/**`. Causa il fallimento sul principio #8.

Le cinque mosse ad alta leva dall'audit (verbatim):

1. **#6 Onestà — "Torna al vivo" deve tornare davvero al vivo.** `AudioPanel.tsx:487-490`: sostituire `onClick={stopAudio}` con una funzione nuova che ferma l'analisi del file E riavvia l'ascolto dal device selezionato (stessa logica già in `AudioPanel.tsx:552`), invece di lasciare un secondo passo manuale.
2. **#6 Onestà — un helper condiviso, non un'altra correzione isolata.** Un `saveAndToast(key, value, msg)` che chiama `writeJson` internamente e toasta solo su `true`, da far diventare l'unico modo per salvare+confermare — così il difetto smette di poter rinascere in codice nuovo.
3. **#9 Risorse — i quattro `setInterval` legati a `document.visibilityState`.** `App.tsx:460,885`, `AudioPanel.tsx:216,89` — stesso trattamento già usato per il loop del gamepad e dello spettro audio.
4. **#10 Il meno design possibile — un solo componente "chip".** Consolidare `pm-chip`/`seq-chip`/`output-chip`/chip Reel in un componente, libera anche margine sul principio #3 (meno colori letterali).
5. **#4 Comprensibile — tooltip su "Tetto".** `OutputsPanel.tsx:157`, `SliderRow` ha già un prop `title?` opzionale inutilizzato lì; la frase è già scritta in `QuickGuide.tsx:102`.

Principi guida per il redesign, in ordine di priorità:
1. **Onesto (#6)** — ogni label mappa 1:1 col comportamento reale, e nessuna scrittura si dichiara riuscita senza una verifica che lo garantisca strutturalmente, non per disciplina del singolo sviluppatore
2. **Rispettoso delle risorse (#9)** — nessun loop o poll gira quando la finestra di controllo non è visibile
3. **Il meno design possibile (#10)** — un'unica implementazione per ogni pattern ripetuto (chip, salva-poi-conferma, stato vuoto/caricamento/successo)

Consegne per il piano:
- Per ogni fix: file target, cambio esatto, passo di verifica (gli script `check:contrast`/`check:buttons` restano verdi, più un nuovo `check:honesty` o estensione di `check:mappings`-style che grep-a ogni chiamata `writeJson`/`persist` e fallisce se non è seguita da un controllo del booleano prima del prossimo `pushToast`)
- Checklist di stato (vuoto, caricamento, errore, successo, focus, disabled) consolidata in componenti condivisi, con regressione verificata sui 3 stati già a posto (disabled, focus, error)
- Nessuna nuova dipendenza: tutto qui è spostamento/consolidamento di codice già scritto, zero stack nuovo

Anti-pattern da evitare (specifici per questo REDESIGN):
- Riscrivere lo stile invece di imporre la struttura — il problema non è com'è disegnato un bottone, è se la sua label dice la verità
- Un'altra correzione una tantum di "Torna al vivo" senza l'helper condiviso — il pattern si ripresenterà all'audit successivo, come ha già fatto due volte
- Toccare il motore/pipeline/tastiera: sono stabili, fuori da questo scope (lo era anche a settembre)
- Trattare la lista "Scartare" come facoltativa: è la causa dei fallimenti, non decorazione
