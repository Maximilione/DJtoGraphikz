# 03 — Verdetto

## REDESIGN

**DJtoGraphikz v0.75.1-beta chiude a 15/30 sui dieci principi di Rams,
identico al totale di settembre (v0.47.0-beta) ma con un principio nuovo a
zero (#9, rispetto delle risorse) mentre il difetto critico che aveva
innescato il REDESIGN di settembre — principio #6, onestà — resta intatto:
"Torna al vivo" etichetta ancora come "ritorno al vivo" un pulsante che si
limita a fermare l'audio, lo stesso identico bug trovato un mese fa, e lo
stesso tipo di difetto (toast di successo senza verifica della scrittura)
si è ripresentato due volte in codice scritto *dopo* quell'audit — non è un
residuo dimenticato, è un pattern che continua a infiltrarsi perché niente
nel codice lo impedisce strutturalmente.**

## Perché REDESIGN e non REFINE

Il totale (15) è sotto soglia (20) e il principio #9 è a 0 — una delle due
condizioni della regola basta da sola. Ma il dato più importante non è il
numero: è che in 28 release e un mese di lavoro — incluse due passate
esplicite di sistema di design (`feat/ui-sistema`, `feat/ui-destra`,
2026-10-06) — il totale non si è mosso di un punto. Dei cinque interventi
ad alta leva prescritti a settembre, due sono fatti (unificazione delle
intestazioni, estensione del controllo di contrasto ai token testo), uno è
fatto a metà (verifica prima del toast: rispettata nella maggior parte dei
casi vecchi, ma non imposta per i casi nuovi), e due non sono stati toccati
affatto (unificazione del pattern di scelta, componenti di stato
condivisi). Nel frattempo è arrivato un problema non previsto: il JS
iniziale è quasi raddoppiato (1,71 → 3,17 MiB) e i poll a intervallo fisso
sono aumentati, nessuno legato alla visibilità della finestra.

## Le cinque mosse ad alta leva

1. **#6 Onestà — "Torna al vivo" deve davvero tornare al vivo.**
   `AudioPanel.tsx:487-490`: `onClick={stopAudio}` deve diventare
   `onClick={returnToLive}`, una funzione nuova che ferma l'analisi del
   file E riavvia l'ascolto dal device selezionato (la stessa logica già
   in `AudioPanel.tsx:552`, "Avvia audio"), invece di lasciare l'utente a
   premere un secondo bottone. È il singolo difetto più visibile di tutto
   l'audit, intoccato da un mese.

2. **#6 Onestà — chiudere il buco strutturale, non le singole istanze.**
   `PresetPanel.tsx:312-313` e `OutputsPanel.tsx:29/195-198` dimostrano che
   il pattern "toast senza verificare la scrittura" continua a nascere in
   codice nuovo nonostante la regola documentata in `storage.ts:50`. Un
   helper condiviso (`saveAndToast(key, value, msg)` che internamente
   chiama `writeJson` e toasta solo su `true`) tolto di mezzo come scelta
   manuale ad ogni chiamante è l'unico modo per smettere di scoprirne uno
   nuovo a ogni audit.

3. **#9 Risorse — i quattro `setInterval` vanno legati alla visibilità
   della finestra.** `App.tsx:460,885` e `AudioPanel.tsx:216,89` girano
   per sempre, anche a finestra di controllo minimizzata o in background
   (il gamepad e lo spettro audio già si fermano in casi simili — serve lo
   stesso trattamento con `document.visibilityState`). Non risolve da
   solo il peso del bundle, ma è la parte a costo quasi zero della
   regressione su #9.

4. **#10 Il meno design possibile — un solo pattern "chip".**
   Quattro implementazioni indipendenti (`pm-chip`, `seq-chip`,
   `output-chip`, chip Reel) sono la stessa affordance con quattro CSS
   diversi — 01-evidenza.md §Strutturale. Consolidarle nella stessa
   component libera anche la strada per #3 (meno colori letterali, uno
   per sistema invece di quattro).

5. **#4 Comprensibile — l'ultimo termine gergale.** "Tetto"
   (`OutputsPanel.tsx:157`) è l'unico dei tre termini flaggati a settembre
   senza tooltip sul controllo stesso — la frase già scritta in
   `QuickGuide.tsx:102` può diventare il `title` di `SliderRow` in una
   riga.
