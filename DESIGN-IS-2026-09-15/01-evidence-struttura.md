# Evidenze — struttura (agente 1)

## Conteggio controlli

Dal DOM vivo: **SIMPLE 115 · PRO 150 · LIVE 37**. Ricostruiti staticamente e
riconciliati esatti su tutte e tre le modalita'.

Pro, chi pesa: **EffectGrid 46 (31% da solo)**, LookBank 20, cromo di App 17,
EffectPanel 13, intestazioni di Panel 12, AudioPanel 12. EffectGrid + LookBank
+ App = **55% dei controlli**.

## Profondita' dell'albero

Massimo **5 componenti**: `App > EffectPanel > ParamControls > SliderRow >
NumberInput`. Nessuna catena piu' profonda. Non e' un problema.

## Affordance ripetute: 20 verificate

Stesso stato (canali d'ingresso diversi, non copie — gia' accettato
dall'audit precedente): scegliere effetto (5 superfici), palette (3), shader
(5), post (4), blackout (4), master (4), intensita' (4), tap (2), look (6),
AutoVJ (2), display di uscita (2), risoluzione (3), tutto schermo (2).

**Ma tre sono divergenze vere, non canali:**

1. **Scegliere un effetto spegne l'AutoVJ ovunque tranne che nel pannello
   pro**: `SimplePanel.tsx:44`, `App.tsx:572`, `App.tsx:630` lo spengono,
   `EffectPanel.tsx:184-188` no.
2. **La risoluzione dalla barra chiama anche `engine.setRenderSize`
   (`App.tsx:835`), dal pannello Uscite no** (`OutputsPanel.tsx:111-122`):
   stessa impostazione, due effetti diversi sul render locale.
3. **Scegliere l'ingresso audio: due superfici, due archivi.** L'onboarding
   (`Onboarding.tsx:79-90` → `App.tsx:495`) fa partire l'analizzatore ma **non
   scrive mai `AUDIO_STORE_KEY`**; `AudioPanel` non rilegge mai il dispositivo
   vero dall'analizzatore. I due possono mostrare cose diverse.

**Stesso gesto, tre archivi diversi**: "salva quello che vedo" esiste come
slot del Look Bank (`djtographikz-looks`), come "Salva" del PresetPanel
(`djtographikz-presets`) e come "+ look corrente" di una scaletta
(`djtographikz-playlists`) — tutti e tre chiamano `engine.createPreset()` e
producono lo stesso oggetto, con tre interfacce.

**Cinque implementazioni diverse di "scegli uno fra N"**: `.mode-switch`,
`.tab-bar`, `.pill`, `.media-seg`, e bottoni `btn-primary/secondary` nel
pannello Uscite. Il ripiegamento dei pannelli, al contrario, e' **un
meccanismo solo** (`Panel.tsx:16-30`).

**Due coppie Importa/Esporta nello stesso pannello**, due archivi
(`PresetPanel.tsx:401-402` e `:630-631`).

## Codice morto

**23 import inutilizzati** (12 sostanziali + 11 `React`), fra cui i residui
delle miniature in `EffectPanel.tsx:7` e `SimplePanel.tsx:8` (ora le possiede
`EffectGrid`), `SLOTS` in `LookBank.tsx:6`, `OutputCfg` in `App.tsx:33`.
**7 export mai importati altrove.** **Prop morte: 0** — tutte e 128 lette.

## Inventario pannelli (pro)

Sinistra: Ingresso audio (`audio`, aperto), **EffectPanel senza wrapper Panel**
(`EffectPanel.tsx:308`, barra a schede, **non richiudibile**), Auto VJ
(`autovj`, aperto).

Destra, dieci: Look Bank (aperto, **fuori dalla fisarmonica**), Media,
Preset & Scalette, Shader Editor, Camera, Mapping, Luci DMX, **Uscite**,
**Posti**, MIDI. Nove su dieci con `group="right"`: aprirne uno chiude gli
altri otto. La fisarmonica vale solo al click, non al montaggio, quindi su un
profilo nuovo restano aperti Media + Preset + Look Bank insieme.

## Buco dichiarato

Il conteggio statico arriva a 149 su 150: l'ultimo dipende da quanti shader ISF
ci sono nella cartella dell'utente. Non ho rilanciato il gate per chiuderlo
(regola: l'app si avvia una volta per release).
