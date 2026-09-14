# 00 — Scope

**Data:** 2026-09-14 · **Versione auditata:** v0.35.0-beta (`88074e9`)

## Cosa viene auditato

Tutta la superficie utente del renderer Electron — l'utente ha detto "tutto".

- **Finestra di controllo**: `src/renderer/App.tsx` (791 righe) e i 24 componenti
  in `src/renderer/components/` — Effetti, Parametri, Post-FX, Deck/crossfader,
  AutoVJ, Playlist/Look Bank, Overlay, Audio, MIDI, DMX, Mapping, Shader editor,
  Asset manager, Remote.
- **Modo semplificato**: `SimplePanel/SimplePanel.tsx` (123 righe).
- **Primo avvio**: `Onboarding/Onboarding.tsx` (159) + `Help/QuickGuide.tsx` (109)
  + `Help/CheatSheet.tsx` (77).
- **Feedback**: `Toasts/Toasts.tsx` (71), `RemoteModal`.
- **Fogli di stile**: `styles/global.css` (1615), `styles/features.css` (296).
- **Finestra di uscita (proiettore)**: `output.html` + `output-main.ts` — solo per
  quello che l'utente vede (placard "nessun segnale", banner blackout). I visual
  in sé NON sono oggetto di questo audit: sono il contenuto, non l'interfaccia.

Totale superficie: 8.481 righe fra TSX/TS/CSS del renderer.

## Utente e task

- **Utente primario**: il VJ che guida i visual dal vivo. Una persona sola, in
  piedi, al buio, con le mani anche altrove (mixer, controller MIDI).
- **Task primario**: cambiare look a tempo con la musica senza perdere il beat —
  quindi senza guardare a lungo lo schermo di controllo.
- **Task secondari**: preparare look e scalette prima del set; correggere la
  proiezione (keystone, luminosità) durante; importare shader.

## Contesto e vincoli

- **Ambiente**: club buio, proiettore su secondo display, rumore, niente mouse
  di precisione. Lo schermo di controllo è spesso l'unica fonte di luce sul viso.
- **Stack**: Electron + React + TypeScript, CSS a mano (nessun design system
  esterno, nessuna libreria di componenti).
- **Lingua**: interfaccia in italiano, codice e documentazione in inglese.
- **Input**: tastiera (hotkey), MIDI, OSC, controllo remoto via browser.

## Materiali di riferimento

Nessun competitor indicato dall'utente. Riferimenti impliciti del dominio:
Resolume, VDMX, Magic Music Visuals, TouchDesigner.

## Limiti noti dell'audit

L'app non è raggiungibile come URL e non ha un dev server ispezionabile da
browser: le prove visive vengono da CSS/token/sorgente e vanno marcate
**INFERRED**, non misurate a schermo.
