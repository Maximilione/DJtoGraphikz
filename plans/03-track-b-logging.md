# Traccia B — Logging strutturato locale + invio remoto opzionale

Tre fasi. **Leggere `plans/00-allowed-apis.md §0.7` prima di ognuna**: contiene
la superficie attuale del logger, i quattro contratti di stringa che il gate di
rilascio legge, e l'elenco di cosa finisce oggi nel log e non può uscire.

Il logger esiste già (`src/main/debug-log.ts`, 109 righe). Queste fasi lo
**estendono**, non lo sostituiscono.

---

## B1 — Logger strutturato locale

### Cosa implementare

Un evento di log diventa un oggetto, non una stringa. Il file di sessione
diventa **JSON Lines**: un oggetto JSON per riga.

Forma dell'evento, da fissare in `src/main/debug-log.ts`:

```ts
interface LogEvent {
  t: string            // ISO 8601 con millisecondi, UTC
  lvl: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  src: 'main' | 'control' | 'output'
  tag: string          // 'display', 'window', 'output', 'health', 'shader', …
  msg: string
  data?: Record<string, unknown>   // campi strutturati, mai concatenati in msg
  err?: { name: string; message: string; stack?: string }
}
```

Lavoro:

1. **Scritture asincrone con buffer.** Sostituire `appendFileSync` +
   `statSync` per riga (`debug-log.ts:27-28`) con una coda in memoria svuotata
   da un `createWriteStream` in append. Lo `statSync` per riga sparisce: la
   dimensione si tiene in una variabile aggiornata sulle scritture.
2. **Rotazione dentro la sessione.** Oggi superati i 5 MB `dropped = true` e il
   log **smette per sempre** (`debug-log.ts:13`, `:16`, `:27`). Sostituire con
   una rotazione a segmenti: `<sessione>.1.jsonl`, `.2.jsonl`, … con un tetto
   totale per sessione. Nessuno stato terminale silenzioso.
3. **Tracce di stack che sopravvivono.** Nel main, smettere di passare gli
   `Error` da `JSON.stringify` (`debug-log.ts:92-96`, che per un Error dà `{}`):
   riconoscere `instanceof Error` e riempire `err`. Nel renderer, aggiungere
   `window.onerror` e `unhandledrejection` che chiamano `logToFile` con lo stack
   vero — oggi le eccezioni non gestite arrivano solo come messaggi di console
   di livello 3, senza oggetto (`[object DOMException]` nel log reale).
4. **Validare `log:renderer`.** Oggi un renderer può scrivere un tag qualsiasi,
   **falsificare un tag `[main/…]`** e iniettare `\n` per forgiare righe intere
   (`debug-log.ts:104`). Il `src` lo decide il main da `event.sender`, non il
   renderer; `tag` va su una lista consentita; `msg` va privato dei newline.
5. **Far loggare anche il renderer di controllo.** Oggi l'unico chiamante di
   `logToFile` in tutto il repo è `output-main.ts:50`.
6. **Togliere il doppione.** Ogni errore del renderer è scritto due volte
   (`index.ts:147-149`, `:226-228` ri-emettono in `console.error` quello che
   `logWindow` ha già scritto). Tenerne una sola — quella con l'URL sorgente
   completo — e cancellare l'altra.
7. **Un livello per `console.info`/`debug`.** Oggi il main non li cattura
   affatto (`debug-log.ts:88` patcha solo `log`/`warn`/`error`) e il renderer li
   scarta (`:36`). Catturarli a livello `debug`, fuori dal file di default.

### ⛔ Il vincolo che decide il disegno

`scripts/check-output.py:72-85` fa parsing **testuale** del log e
`yarn check:output` è obbligatorio prima di ogni tag. I quattro contratti:
`"output/health"`, `"output/health]"` (come delimitatore di split),
`"NOSIGNAL"`, `"frames="` seguito da un intero.

Due strade, **scegliere e dichiarare nel commit**:

- **(a)** Scrivere **due** file per sessione: `<nome>.jsonl` strutturato e
  `<nome>.log` con il formato di oggi per compatibilità. Costa una scrittura in
  più, non tocca il gate.
- **(b)** Scrivere solo JSON Lines e **aggiornare `check-output.py`** a leggere
  il JSON, cercando `lvl`/`tag`/`data.frames` invece delle sottostringhe. Più
  pulito, ma il gate va modificato e riprovato **nello stesso batch**.

Preferire **(b)**: due formati paralleli divergono. Ma se si sceglie (b), la
riga `frames=` la produce `Engine.health()` (`Engine.ts:2279-2301`), che va
allora affiancata da un `healthData(): Record<string, unknown>` — senza toccare
`health()`, che resta per la retrocompatibilità.

### Riferimenti da copiare
- Formato riga e stampa del tempo: `debug-log.ts:18-28`.
- Ciclo di potatura delle sessioni: `debug-log.ts:72-76` (va conservato).
- Registrazione IPC: `debug-log.ts:102-104`; ponte nel preload `preload/index.ts:33-37`.
- Cosa contiene oggi un log: `00-allowed-apis.md §0.7`, tabella degli eventi.

### Lista di verifica
- [ ] `yarn check:output` verde. Se si è scelta la strada (b), il gate è stato
      modificato **e** riprovato nello stesso batch.
- [ ] Una sessione nuova produce un file dove **ogni riga è JSON valido**:
      `node -e "require('fs').readFileSync(f,'utf8').split('\n').filter(Boolean).forEach(JSON.parse)"`
- [ ] Un errore lanciato apposta nel renderer di controllo compare nel log
      **con lo stack**, non come `[object Object]`.
- [ ] Superata la soglia di rotazione, la sessione **continua** a loggare su un
      nuovo segmento. Verificare abbassando il tetto a 64 KB per la prova.
- [ ] `grep -c "RENDERER ERROR" <log>` = 0: il doppione è sparito.
- [ ] Un renderer che chiama `logToFile('main/log', 'x\ny')` **non** produce due
      righe né un evento con `src: 'main'`.

### ⛔ Guardie contro gli anti-pattern
- Non aggiungere una dipendenza di logging. `update-check.ts` mostra che questa
  base di codice fa rete e I/O con quello che Electron e Node già danno.
- Non rendere `logLine` asincrona nella firma: 17 chiamanti la usano come
  fire-and-forget. Il buffer sta dentro, non nel contratto.
- Non toccare `Engine.health()`. Affiancarla, semmai.
- Non spostare la cartella dei log: `README.md:94` la documenta all'utente e il
  gate la trova per glob.

---

## B2 — Redazione e pacchetto diagnostico

### Cosa implementare

1. **Una funzione di redazione, applicata alla scrittura**, non alla lettura.
   Deve coprire almeno i 14 punti di `00-allowed-apis.md §0.7`, e in particolare:
   - **`remote-server.ts:168` mette indirizzo IP LAN, porta e codice di
     accoppiamento vivo sulla stessa riga.** È la riga più grave del log: da
     sola basta a prendere il controllo dello show da dentro la rete. Il codice
     va sostituito con `••••••` **alla sorgente**, non redatto dopo.
   - Percorsi assoluti sotto `homedir()` → `~/…`, così sparisce il nome utente
     (`debug-log.ts:106` lo scrive a ogni sessione).
   - Indirizzi IPv4/IPv6 → forma mascherata.
2. **Due livelli di severità**, perché la redazione utile per un allegato a una
   segnalazione non è quella che serve per uscire dalla macchina:
   - *file locale*: redatto in modo leggero (il codice di accoppiamento sparisce
     comunque; i percorsi restano, servono a diagnosticare).
   - *destinato a uscire*: redazione piena, più l'esclusione dei campi
     `data` che portano contenuto dell'utente — nomi di file multimediali
     (`OverlayPanel.tsx:70`, `:88`, `:114`), sorgente GLSL negli errori del
     compilatore (`Engine.ts:1262`, `:1285`), e il nome scelto dall'utente per
     uno shader custom dentro `effect=` (`Engine.ts:2286`).
3. **Pacchetto diagnostico**: un comando nel menu Aiuto accanto a "Apri log
   della sessione" (`HelpMenu.tsx:69`) che produce **un file zip** con gli
   ultimi N segmenti già redatti al livello "destinato a uscire", più un
   riepilogo di ambiente. È quello che l'utente allega a una segnalazione, al
   posto di frugare in una cartella.
4. **Risuscitare `getLogPath()`**: esiste (`debug-log.ts:109`), è esposto in
   preload (`preload/index.ts:34`) e **non lo chiama nessuno**. Serve al
   pacchetto diagnostico.

### ⛔ Guardia dichiarata, da scrivere nel commit
La scoperta avverte che i punti 12–14 della superficie di privacy sono **una
categoria, non un elenco chiuso**: ogni `console.warn`/`console.error` di
livello ≥ 2 in `src/renderer` e `src/engine` diventa una riga di log. Questa
fase deve **iniziare** con l'enumerazione esaustiva di quelle chiamate, e la
lista va messa nel commit. Senza, la redazione non si può dire completa — e
dirlo lo stesso sarebbe la disonestà che l'audit ha già rilevato altrove.

### Lista di verifica
- [ ] `grep -E "pairing code [0-9]{6}" <log>` = 0 righe, su una sessione nuova.
- [ ] `grep -c "$(whoami)" <log>` = 0 nel file destinato a uscire.
- [ ] Enumerazione completa dei `console.warn|error` di renderer ed engine
      allegata al commit, con la decisione presa per ognuno.
- [ ] Il pacchetto diagnostico si apre, contiene i segmenti attesi, e nessuno
      dei pattern sopra.
- [ ] `yarn check:output` verde.

---

## B3 — Invio remoto, acceso dall'utente

### Cosa implementare

1. **Spento di default. Sempre.** Va acceso in modo esplicito, e l'interfaccia
   deve dire **cosa esce** e **dove va** prima che l'utente accetti — non dopo,
   e non in un tooltip. L'audit ha già trovato un opt-in preselezionato
   (`Onboarding.tsx:22`): non aggiungerne un secondo.
2. **Solo `lvl >= 'error'` e i `fatal`.** Non spedire il battito di salute: sono
   ~2,3 KB/min, e `effect=` ogni 5 secondi è la cronologia di cosa ha suonato
   l'utente e quando (`Engine.ts:2286`).
3. **Coda su disco e invio a lotti.** Un club ha il wifi che cade: la coda
   sopravvive al riavvio, l'invio riprova con backoff, e **quando la rete non
   c'è non succede niente di visibile**. Modello esatto in `update-check.ts:44`:
   `catch {}` con il commento *"offline in a club — retry at the next interval"*.
4. **Endpoint configurabile.** Un URL nelle impostazioni, non compilato dentro.
   Chi self-hosta non deve ricompilare.
5. **Chiamata di rete secondo il modello della casa**: `net.fetch` di Electron
   (non `fetch` di Node, non `https`), header `User-Agent` come
   `update-check.ts:35` — ma **con versione e piattaforma**, che lì mancano e
   qui servono per raggruppare le segnalazioni.
6. **Un interruttore visibile mentre è acceso.** Se qualcosa esce dalla
   macchina, si deve vedere dall'interfaccia senza aprire le impostazioni.

### ⛔ Guardie contro gli anti-pattern
- **Non spedire niente prima che B2 sia in main.** Un invio senza redazione fa
  uscire il codice di accoppiamento. È l'ordine delle fasi, non un suggerimento.
- Non aggiungere un SDK di telemetria che raccoglie da sé: raccoglierebbe anche
  quello che B2 ha deciso di non far uscire.
- Non usare `setInterval` senza conservare l'handle: `update-check.ts:49-50` non
  lo fa e i suoi timer non si fermano mai. Non copiare quel pezzo.
- Nessun identificatore persistente della macchina senza dirlo: l'impronta della
  topologia degli schermi (`debug-log.ts:50-54`) è già abbastanza distintiva.

### Lista di verifica
- [ ] Con l'invio spento — cioè di default — **zero pacchetti** verso l'esterno.
      Verificare con `tcpdump` o un proxy, non leggendo il codice.
- [ ] Con la rete staccata l'app non rallenta e non mostra errori; la coda
      cresce e si svuota al ritorno della rete.
- [ ] Quello che arriva all'endpoint non contiene nessuno dei pattern di B2.
- [ ] I timer si fermano alla chiusura dell'app.
- [ ] `yarn check:output` verde.
