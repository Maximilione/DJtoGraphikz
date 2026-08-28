import { app, BrowserWindow, ipcMain } from 'electron'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { randomBytes, randomInt, timingSafeEqual } from 'crypto'
import { networkInterfaces } from 'os'
import { AUDIO_SOURCES } from '../engine/EffectParams'

// Web remote: phone on the same wifi opens the QR, enters the pairing code,
// gets a session token and drives the engine over plain HTTP.
// ponytail: HTTP POST + 1.5s state polling, no WebSocket — on a LAN the
// latency is fine; switch to `ws` only if slider feel ever demands it.
//
// The page is fully data-driven: the renderer pushes catalogs (effects, posts,
// palettes, genres, ...) via 'remote:defs' and the look bank via 'remote:looks';
// the server only caches and serves them at /defs. No hardcoded lists here.

const BASE_PORT = 9666
const MAX_PAIR_ATTEMPTS = 8
const LOCKOUT_MS = 60_000

const MAX_SESSIONS = 4

let pairingCode = ''
let sessionTokens: string[] = []   // up to MAX_SESSIONS phones paired at once
let failedAttempts = 0
let lockedUntil = 0
let port = BASE_PORT
let lastEngineState: unknown = null
let lastAudio: { bpm: number; energy: number; beatPulse: number } | null = null
let lastVj: { enabled: boolean; genre: string } | null = null
let remoteDefs: Record<string, unknown> | null = null
let remoteLooks: unknown[] = []
// Bumped on every looks push; the page re-fetches thumbs only when it changes
let looksRev = 0

// osc-server reads the same caches — one source of truth for catalogs/state
export const getRemoteDefs = () => remoteDefs
export const getLastEngineState = () => lastEngineState

function lanIp(): string {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) return a.address
    }
  }
  return '127.0.0.1'
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => {
      data += c
      if (data.length > 4096) { req.destroy(); reject(new Error('too large')) }
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function authorized(req: IncomingMessage): boolean {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (token === '') return false
  // ponytail: linear scan is fine at 4 tokens; each compare stays timing-safe
  let ok = false
  for (const t of sessionTokens) if (safeEqual(token, t)) ok = true
  return ok
}

export function setupRemoteServer(controlWindow: BrowserWindow) {
  pairingCode = String(randomInt(0, 1000000)).padStart(6, '0')

  const server = createServer(async (req, res) => {
    const url = req.url || '/'

    if (req.method === 'GET' && url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(REMOTE_PAGE)
      return
    }

    if (req.method === 'POST' && url === '/pair') {
      const now = Date.now()
      if (now < lockedUntil) {
        json(res, 429, { error: `Troppi tentativi. Riprova tra ${Math.ceil((lockedUntil - now) / 1000)}s` })
        return
      }
      try {
        const { code } = JSON.parse(await readBody(req))
        if (typeof code === 'string' && safeEqual(code, pairingCode)) {
          failedAttempts = 0
          const token = randomBytes(24).toString('hex')
          sessionTokens.push(token)
          if (sessionTokens.length > MAX_SESSIONS) sessionTokens.shift()   // drop oldest
          json(res, 200, { token })
        } else {
          failedAttempts++
          if (failedAttempts >= MAX_PAIR_ATTEMPTS) {
            lockedUntil = now + LOCKOUT_MS
            failedAttempts = 0
          }
          json(res, 401, { error: 'Codice errato' })
        }
      } catch {
        json(res, 400, { error: 'bad request' })
      }
      return
    }

    if (req.method === 'GET' && url === '/state') {
      if (!authorized(req)) { json(res, 401, { error: 'unauthorized' }); return }
      res.setHeader('Cache-Control', 'no-store')
      json(res, 200, { engine: lastEngineState, looksRev, audio: lastAudio, vj: lastVj })
      return
    }

    // Catalogs + looks: fetched once at boot, re-fetched only when looksRev bumps
    if (req.method === 'GET' && url === '/defs') {
      if (!authorized(req)) { json(res, 401, { error: 'unauthorized' }); return }
      res.setHeader('Cache-Control', 'no-store')
      json(res, 200, {
        effects: [], posts: [], palettes: [], genres: [], blendModes: [], transitionTypes: [],
        ...(remoteDefs || {}),
        version: app.getVersion(),
        paramSources: AUDIO_SOURCES,
        looks: remoteLooks,
        looksRev,
      })
      return
    }

    if (req.method === 'POST' && url === '/cmd') {
      if (!authorized(req)) { json(res, 401, { error: 'unauthorized' }); return }
      try {
        const cmd = JSON.parse(await readBody(req))
        if (typeof cmd?.type !== 'string') { json(res, 400, { error: 'bad cmd' }); return }
        controlWindow.webContents.send('remote:cmd', cmd)
        json(res, 200, { ok: true })
      } catch {
        json(res, 400, { error: 'bad request' })
      }
      return
    }

    res.writeHead(404)
    res.end()
  })

  // Port may be taken (second instance, other apps) — walk forward a few
  const tryListen = (p: number) => {
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && p < BASE_PORT + 10) tryListen(p + 1)
      else console.error('[Remote] server failed:', err.message)
    })
    server.listen(p, '0.0.0.0', () => {
      port = p
      console.log(`[Remote] listening on http://${lanIp()}:${port} — pairing code ${pairingCode}`)
    })
  }
  tryListen(BASE_PORT)

  // Engine state already flows through the main process for the output
  // window — cache the latest snapshot for the remote's polling
  ipcMain.on('engine:state-update', (_e, state) => { lastEngineState = state })

  // Audio flows ~30Hz through main for the output window — cache the live
  // bits so /state stays fresh even when the user isn't touching anything
  ipcMain.on('audio:data', (_e, d) => {
    if (d && typeof d === 'object') {
      lastAudio = { bpm: d.bpm ?? 0, energy: d.energy ?? 0, beatPulse: d.beatPulse ?? 0 }
    }
  })

  // AutoVJ status pushed by the renderer (button, hotkeys, auto-disable)
  ipcMain.on('remote:vj', (_e, vj) => {
    if (vj && typeof vj.enabled === 'boolean') {
      lastVj = { enabled: vj.enabled, genre: typeof vj.genre === 'string' ? vj.genre : '' }
    }
  })

  // Catalogs pushed once by the renderer at engine init
  ipcMain.on('remote:defs', (_e, defs) => { remoteDefs = defs })

  // Look bank pushed by LookBank on mount and on every change
  ipcMain.on('remote:looks', (_e, looks) => {
    remoteLooks = Array.isArray(looks) ? looks : []
    looksRev++
  })

  ipcMain.handle('remote:info', () => ({
    url: `http://${lanIp()}:${port}/`,
    code: pairingCode,
  }))

  // Invalidate all sessions and rotate the pairing code
  ipcMain.handle('remote:reset', () => {
    sessionTokens = []
    pairingCode = String(randomInt(0, 1000000)).padStart(6, '0')
    return { code: pairingCode }
  })
}

// ---- Mobile control page (vanilla, no build step) ----
// NOTE: this is a TS template literal — the page must not contain backticks,
// "${" or backslash escapes. All catalogs are built at runtime from /defs.

const REMOTE_PAGE = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>DJtoGraphikz Remote</title>
<style>
  :root {
    --bg:#08080a; --panel:#131318; --panel2:#1a1a21; --line:#26262f;
    --ink:#e8e8f0; --mute:#8888a0; --acc:#00ff88; --danger:#ff4455;
    --s1:4px; --s2:8px; --s3:12px; --s4:16px;
  }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  [hidden] { display:none !important; }
  html { height:100%; }
  body {
    background:var(--bg); color:var(--ink); min-height:100%;
    font-family:-apple-system,system-ui,sans-serif;
    touch-action:manipulation; overscroll-behavior-y:none;
  }
  .mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
  .micro { font-size:10px; letter-spacing:1.5px; text-transform:uppercase;
    color:var(--mute); font-family:ui-monospace,monospace; }
  .sect { font-size:10px; letter-spacing:2px; color:var(--mute); text-transform:uppercase;
    margin:20px 0 10px; font-family:ui-monospace,monospace; }
  .sect:first-child { margin-top:4px; }
  .hint { color:var(--mute); font-size:12px; padding:10px 2px; }
  button {
    font:inherit; color:var(--ink); background:var(--panel);
    border:1px solid var(--line); border-radius:10px; min-height:48px;
    touch-action:manipulation; transition:transform .08s;
  }
  button:active { transform:scale(.96); }
  button.on { border-color:var(--acc); color:var(--acc);
    background:rgba(0,255,136,.08); box-shadow:0 0 12px rgba(0,255,136,.18); }
  button:disabled { opacity:.35; }
  select {
    width:100%; min-height:48px; background:var(--panel); color:var(--ink);
    border:1px solid var(--line); border-radius:10px; padding:10px 12px; font-size:14px;
  }
  input[type=range] {
    width:100%; height:44px; accent-color:var(--acc); background:transparent;
    touch-action:pan-x;
  }
  .row { display:flex; gap:var(--s2); align-items:center; }
  .row > * { flex:1; }

  /* ---- pairing ---- */
  #pair { position:fixed; inset:0; background:var(--bg); z-index:50;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:var(--s4); padding:24px; }
  #pair h1 { font-size:15px; letter-spacing:3px; color:var(--acc); font-family:ui-monospace,monospace; }
  #pair p { color:var(--mute); font-size:13px; text-align:center; }
  #code { background:var(--panel); border:1px solid var(--line); color:var(--ink);
    border-radius:12px; font-size:34px; text-align:center; letter-spacing:12px;
    width:260px; padding:14px 0 14px 12px; font-family:ui-monospace,monospace; }
  #code:focus { outline:none; border-color:var(--acc); }
  #err { color:var(--danger); font-size:13px; min-height:18px; }
  #pairbtn { width:260px; background:var(--acc); color:#000; font-weight:700;
    font-size:15px; letter-spacing:2px; border:0; }

  /* ---- top strip ---- */
  #strip { position:sticky; top:0; z-index:20; background:rgba(8,8,10,.94);
    -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px);
    border-bottom:1px solid var(--line);
    padding:calc(8px + env(safe-area-inset-top)) var(--s3) var(--s2); }
  .srow { display:flex; gap:var(--s2); align-items:stretch; }
  .srow button { flex:1; font-weight:700; font-size:12px; letter-spacing:1px; min-height:48px; }
  #blackout.on { border-color:var(--danger); color:var(--danger);
    background:rgba(255,68,85,.14); box-shadow:0 0 12px rgba(255,68,85,.25); }
  .bpmbox { width:64px; flex:none; display:flex; flex-direction:column; align-items:center;
    justify-content:center; background:var(--panel); border:1px solid var(--line);
    border-radius:10px; gap:1px; }
  #bpm { font-size:16px; font-weight:700; color:var(--acc); }
  .srow2 { display:flex; gap:var(--s2); align-items:center; margin-top:var(--s1); }
  .srow2 input { flex:1; height:36px; }
  #ver { flex:none; opacity:.7; }

  /* ---- layout ---- */
  main { padding:var(--s3) var(--s3) calc(84px + env(safe-area-inset-bottom)); }
  #tabs { position:fixed; bottom:0; left:0; right:0; z-index:20; display:flex; gap:var(--s1);
    background:rgba(8,8,10,.96); border-top:1px solid var(--line);
    padding:6px var(--s2) calc(6px + env(safe-area-inset-bottom)); }
  #tabs button { flex:1; border:0; background:none; border-radius:10px; min-height:52px;
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
    color:var(--mute); font-size:9px; letter-spacing:1px; font-family:ui-monospace,monospace; }
  #tabs button .ti { font-size:17px; line-height:1; }
  #tabs button.on { color:var(--acc); background:rgba(0,255,136,.08); box-shadow:none; border:0; }

  /* ---- LIVE ---- */
  .lookgrid { display:grid; grid-template-columns:repeat(4,1fr); gap:var(--s2); }
  .look { position:relative; aspect-ratio:16/11; border:1px solid var(--line);
    border-radius:10px; overflow:hidden; background:var(--panel);
    transition:transform .08s; }
  .look:active { transform:scale(.94); }
  .look img { width:100%; height:100%; object-fit:cover; display:block; }
  .look .n { position:absolute; top:3px; left:5px; font-size:10px; color:var(--acc);
    font-family:ui-monospace,monospace; text-shadow:0 0 4px #000; }
  .look .nm { position:absolute; bottom:0; left:0; right:0; font-size:9px; padding:2px 4px;
    background:rgba(0,0,0,.6); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .look.empty { opacity:.25; pointer-events:none; display:flex; align-items:center;
    justify-content:center; color:var(--mute); font-size:12px; font-family:ui-monospace,monospace; }
  .look.flash { border-color:var(--acc); box-shadow:0 0 14px rgba(0,255,136,.45); }

  /* ---- FX ---- */
  .grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:var(--s2); }
  .grid3 button { padding:12px 4px; font-size:12px; }
  .prow { display:flex; align-items:center; gap:var(--s3); }
  .plbl { width:78px; flex:none; font-size:10px; letter-spacing:1px; text-transform:uppercase;
    color:var(--mute); font-family:ui-monospace,monospace; }
  .prow input { flex:1; }
  .pval { width:44px; flex:none; text-align:right; font-size:11px;
    font-family:ui-monospace,monospace; }
  .maprow { display:flex; align-items:center; gap:var(--s3); margin:-6px 0 var(--s2) 0;
    padding-left:90px; }
  .maprow select { flex:none; width:96px; min-height:40px; padding:6px 8px; font-size:12px; }
  .maprow input { flex:1; height:38px; accent-color:var(--mute); }

  /* ---- MIX ---- */
  .xrow { display:flex; align-items:center; gap:var(--s3); }
  .xrow .xl { flex:none; width:20px; text-align:center; font-weight:800; font-size:15px;
    color:var(--acc); font-family:ui-monospace,monospace; }
  .xrow input { flex:1; height:56px; }
  .seg { display:flex; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  .seg button { flex:1; border:0; border-radius:0; min-height:46px; font-size:11px;
    font-family:ui-monospace,monospace; box-shadow:none; }
  .seg button.on { background:rgba(0,255,136,.14); box-shadow:none; }
  .seg button + button { border-left:1px solid var(--line); }
  .chainrow { display:flex; align-items:center; gap:var(--s2); background:var(--panel);
    border:1px solid var(--line); border-radius:10px; padding:4px var(--s2);
    margin-bottom:var(--s2); }
  .chainrow .nm { width:66px; flex:none; font-size:11px; font-family:ui-monospace,monospace;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .chainrow input { flex:1; height:40px; }
  .chainrow button { flex:none; min-height:42px; min-width:42px; padding:0;
    background:var(--panel2); font-size:14px; }
  .addgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:var(--s2);
    margin-top:var(--s2); }
  .addgrid button { min-height:44px; font-size:11px; color:var(--mute); }

  /* ---- COLORI ---- */
  .palgrid { display:grid; grid-template-columns:repeat(2,1fr); gap:var(--s2); }
  .palbtn { display:flex; align-items:center; gap:var(--s2); padding:8px 10px; min-height:52px; }
  .palbtn .sw { display:flex; gap:3px; flex:none; }
  .palbtn .sw span { width:18px; height:18px; border-radius:4px; display:block; }
  .palbtn .plabel { font-size:11px; font-family:ui-monospace,monospace; color:var(--mute); }
  .palbtn.on .plabel { color:var(--acc); }

  /* ---- SETUP ---- */
  .setuprow { display:flex; justify-content:space-between; align-items:center;
    background:var(--panel); border:1px solid var(--line); border-radius:10px;
    padding:14px; margin-bottom:var(--s2); font-size:13px; }
  .dot { display:inline-block; width:9px; height:9px; border-radius:50%;
    background:var(--danger); margin-right:6px; }
  .dot.ok { background:var(--acc); }
  #unpair { width:100%; margin-top:var(--s3); color:var(--danger);
    border-color:rgba(255,68,85,.4); font-weight:700; letter-spacing:1px; }
</style>
</head>
<body>

<div id="pair">
  <h1>DJTOGRAPHIKZ</h1>
  <p>Inserisci il codice mostrato nell'app</p>
  <input id="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="------" autocomplete="one-time-code" autofocus>
  <div id="err"></div>
  <button id="pairbtn">COLLEGA</button>
</div>

<div id="app" hidden>
  <header id="strip">
    <div class="srow">
      <button id="blackout">BLACK</button>
      <button id="freeze">FREEZE</button>
      <button id="tap">TAP</button>
      <div class="bpmbox"><span id="bpm" class="mono">--</span><span class="micro">BPM</span></div>
    </div>
    <div class="srow2">
      <span class="micro">MASTER</span>
      <input type="range" id="master" min="0" max="1" step="0.01" value="1">
      <span id="ver" class="micro"></span>
    </div>
  </header>

  <main>
    <section id="tab-live">
      <div class="sect">Look Bank</div>
      <div class="lookgrid" id="looks"></div>
      <div class="sect">Auto VJ</div>
      <div class="row">
        <button id="autovj">AUTO VJ</button>
        <select id="genre" aria-label="Genere"></select>
      </div>
    </section>

    <section id="tab-fx" hidden>
      <div id="fxgroups"></div>
      <div class="sect">Parametri effetto</div>
      <div id="params"></div>
    </section>

    <section id="tab-mix" hidden>
      <div class="sect">Crossfader</div>
      <div class="xrow"><span class="xl">A</span><input type="range" id="xfade" min="0" max="1" step="0.01" value="0"><span class="xl">B</span></div>
      <div class="sect">Effetto Deck B</div>
      <select id="deckb"></select>
      <div class="sect">Blend</div>
      <div class="seg" id="blend"></div>
      <div class="sect">Catena Post FX</div>
      <div id="chain"></div>
      <div class="addgrid" id="postadd"></div>
      <div class="sect">Motion Blur</div>
      <div class="prow"><input type="range" id="mblur" min="0" max="0.95" step="0.01" value="0"><span class="pval" id="mblur_v">0</span></div>
      <div class="sect">Transizione</div>
      <select id="trtype"></select>
      <div class="prow" style="margin-top:8px"><span class="plbl">Durata</span><input type="range" id="trdur" min="0" max="3" step="0.1" value="0.8"><span class="pval" id="trdur_v">0.8</span></div>
    </section>

    <section id="tab-color" hidden>
      <div class="sect">Palette</div>
      <div class="palgrid" id="palgrid"></div>
      <div class="sect">Grade</div>
      <div class="prow"><span class="plbl">Exposure</span><input type="range" id="g_exposure" min="0.2" max="2" step="0.05" value="1.1"><span class="pval" id="gv_exposure"></span></div>
      <div class="prow"><span class="plbl">Contrast</span><input type="range" id="g_contrast" min="0.5" max="2" step="0.05" value="1.05"><span class="pval" id="gv_contrast"></span></div>
      <div class="prow"><span class="plbl">Satur</span><input type="range" id="g_saturation" min="0" max="2" step="0.05" value="1.1"><span class="pval" id="gv_saturation"></span></div>
      <div class="prow"><span class="plbl">Lift</span><input type="range" id="g_lift" min="0" max="0.3" step="0.01" value="0"><span class="pval" id="gv_lift"></span></div>
      <div class="prow"><span class="plbl">Vignette</span><input type="range" id="g_vignette" min="0" max="1.5" step="0.05" value="0.25"><span class="pval" id="gv_vignette"></span></div>
    </section>

    <section id="tab-setup" hidden>
      <div class="sect">Info</div>
      <div class="setuprow"><span class="micro">Versione app</span><span id="sver" class="mono"></span></div>
      <div class="setuprow"><span class="micro">Stato</span><span><i id="conn" class="dot"></i><span id="connt">—</span></span></div>
      <div class="setuprow"><span class="micro">Sync</span><span class="mono" style="font-size:12px">polling 1.5s</span></div>
      <button id="unpair">SCOLLEGA</button>
    </section>
  </main>

  <nav id="tabs">
    <button id="tb_live" class="on"><span class="ti">&#9673;</span>LIVE</button>
    <button id="tb_fx"><span class="ti">&#10022;</span>FX</button>
    <button id="tb_mix"><span class="ti">&#8644;</span>MIX</button>
    <button id="tb_color"><span class="ti">&#9687;</span>COLORI</button>
    <button id="tb_setup"><span class="ti">&#9881;</span>SETUP</button>
  </nav>
</div>

<script>
'use strict'
let token = localStorage.getItem('djg-token') || ''
let defs = null            // catalogs from /defs
let looksRev = -1
const prev = {}            // dirty-check cache for structural updates
let dragging = {}          // range keys currently touched — poll must not move them
const timers = {}, pending = {}
const fxBtns = {}, blendBtns = {}
let paramEls = {}, chainEls = {}
const GRADE_KEYS = ['exposure', 'contrast', 'saturation', 'lift', 'vignette']
const local = { autovj: false }

function $(id){ return document.getElementById(id) }
function auth(){ return { Authorization: 'Bearer ' + token } }
function logout(){ localStorage.removeItem('djg-token'); location.reload() }
function num(v, d){ return typeof v === 'number' ? v : d }
function fmtV(v){ return String(Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 100) / 100) }

function el(tag, cls, txt){
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (txt !== undefined) n.textContent = txt
  return n
}

async function cmd(c){
  try {
    const r = await fetch('/cmd', { method: 'POST', headers: auth(), body: JSON.stringify(c) })
    if (r.status === 401) logout()
  } catch (_) {}
}

// Throttled slider sends: trailing 90ms while sliding, flush on release
function slide(k, c){
  pending[k] = c
  clearTimeout(timers[k])
  timers[k] = setTimeout(function(){ cmd(pending[k]) }, 90)
}
function flush(k, c){ clearTimeout(timers[k]); cmd(c) }

// Wire a range input: throttle + drag-key + optional live value readout
function wireRange(inp, key, make, valEl){
  inp.dataset.dk = key
  inp.addEventListener('input', function(){
    const v = parseFloat(inp.value)
    if (valEl) valEl.textContent = fmtV(v)
    slide(key, make(v))
  }, { passive: true })
  inp.addEventListener('change', function(){ flush(key, make(parseFloat(inp.value))) })
}
// Poll-side updates: never touch a slider the user is dragging
function setRange(inp, v){
  if (!inp || dragging[inp.dataset.dk]) return
  if (Math.abs(parseFloat(inp.value) - v) > 1e-9) inp.value = v
}
function setText(node, t){ if (node && node.textContent !== t) node.textContent = t }
function setOn(node, on){ if (node) node.classList.toggle('on', on) }

document.addEventListener('pointerdown', function(e){
  const t = e.target
  if (t && t.type === 'range' && t.dataset.dk) dragging[t.dataset.dk] = true
}, { passive: true })
document.addEventListener('pointerup', function(){ dragging = {} }, { passive: true })
document.addEventListener('pointercancel', function(){ dragging = {} }, { passive: true })

// ---- pairing ----
async function pair(){
  const code = $('code').value
  if (code.length < 6) return
  try {
    const r = await fetch('/pair', { method: 'POST', body: JSON.stringify({ code: code }) })
    const j = await r.json()
    if (j.token) { token = j.token; localStorage.setItem('djg-token', token); enter() }
    else { $('err').textContent = j.error || 'Errore'; $('code').value = '' }
  } catch (_) { $('err').textContent = 'Connessione fallita' }
}

function enter(){
  $('pair').hidden = true
  $('app').hidden = false
  boot()
}

async function boot(){
  try {
    const r = await fetch('/defs', { headers: auth() })
    if (r.status === 401) return logout()
    defs = await r.json()
  } catch (_) { setTimeout(boot, 1200); return }
  buildStatic()
  renderLooks(defs.looks || [])
  looksRev = defs.looksRev || 0
  setText($('ver'), 'v' + (defs.version || '?'))
  setText($('sver'), 'v' + (defs.version || '?'))
  poll()
  setInterval(poll, 1500)
}

// ---- one-time DOM build from /defs (never rebuilt during polling) ----
function buildStatic(){
  // effects grouped by category
  const wrap = $('fxgroups')
  const cats = [], byCat = {}
  ;(defs.effects || []).forEach(function(e){
    if (!byCat[e.category]) { byCat[e.category] = []; cats.push(e.category) }
    byCat[e.category].push(e)
  })
  cats.forEach(function(c){
    wrap.appendChild(el('div', 'sect', c))
    const g = el('div', 'grid3')
    byCat[c].forEach(function(e){
      const b = el('button', '', e.label)
      b.addEventListener('click', function(){ cmd({ type: 'effect', value: e.id }) })
      fxBtns[e.id] = b
      g.appendChild(b)
    })
    wrap.appendChild(g)
  })

  const db = $('deckb')
  ;(defs.effects || []).forEach(function(e){ db.appendChild(new Option(e.label, e.id)) })
  db.addEventListener('change', function(){ cmd({ type: 'deckB', value: db.value }) })

  const seg = $('blend')
  ;(defs.blendModes || []).forEach(function(m){
    const b = el('button', '', m)
    b.addEventListener('click', function(){ cmd({ type: 'blendMode', value: m }) })
    blendBtns[m] = b
    seg.appendChild(b)
  })

  const tt = $('trtype')
  ;(defs.transitionTypes || []).forEach(function(t){ tt.appendChild(new Option(t, t)) })
  tt.addEventListener('change', function(){ cmd({ type: 'transitionType', value: tt.value }) })

  const gs = $('genre')
  ;(defs.genres || []).forEach(function(g){ gs.appendChild(new Option(g.label, g.id)) })
  gs.addEventListener('change', function(){ cmd({ type: 'genre', value: gs.value }) })

  const pg = $('palgrid')
  ;(defs.palettes || []).forEach(function(p){
    const b = el('button', 'palbtn')
    b.dataset.c = p.colors.join(',')
    const sw = el('span', 'sw')
    p.colors.forEach(function(c){ const s = el('span'); s.style.background = c; sw.appendChild(s) })
    b.appendChild(sw)
    b.appendChild(el('span', 'plabel', p.label))
    b.addEventListener('click', function(){ cmd({ type: 'palette', value: p.colors }) })
    pg.appendChild(b)
  })
}

// ---- look bank (rebuilt only when looksRev changes) ----
function renderLooks(looks){
  const grid = $('looks')
  grid.textContent = ''
  const byIdx = {}
  ;(looks || []).forEach(function(l){ byIdx[l.index] = l })
  for (let i = 0; i < 16; i++){
    const l = byIdx[i]
    if (!l) { grid.appendChild(el('div', 'look empty', String(i + 1))); continue }
    const d = el('div', 'look')
    if (l.thumb) { const img = el('img'); img.src = l.thumb; img.alt = ''; d.appendChild(img) }
    d.appendChild(el('span', 'n', String(i + 1)))
    d.appendChild(el('span', 'nm', l.name))
    d.addEventListener('click', function(){
      cmd({ type: 'look', value: i })
      d.classList.add('flash')
      setTimeout(function(){ d.classList.remove('flash') }, 350)
    })
    grid.appendChild(d)
  }
}

async function refreshLooks(){
  try {
    const r = await fetch('/defs', { headers: auth() })
    if (r.status === 401) return logout()
    const d = await r.json()
    renderLooks(d.looks || [])
  } catch (_) {}
}

// ---- active-effect params (rebuilt only when the def set changes) ----
function rebuildParams(e){
  const wrap = $('params')
  wrap.textContent = ''
  paramEls = {}
  const ds = e.paramDefs || []
  if (!ds.length) { wrap.appendChild(el('div', 'hint', 'Nessun parametro')); return }
  ds.forEach(function(d){
    const row = el('div', 'prow')
    row.appendChild(el('span', 'plbl', d.label))
    const r = document.createElement('input')
    r.type = 'range'; r.min = d.min; r.max = d.max; r.step = (d.max - d.min) / 100
    const val = el('span', 'pval', '')
    wireRange(r, 'p_' + d.key, function(v){ return { type: 'param', value: { key: d.key, value: v } } }, val)
    row.appendChild(r)
    row.appendChild(val)
    wrap.appendChild(row)

    // audio mapping: source select + depth slider
    const map = el('div', 'maprow')
    const sel = document.createElement('select')
    ;(defs.paramSources || []).forEach(function(s){ sel.appendChild(new Option(s, s)) })
    const dep = document.createElement('input')
    dep.type = 'range'; dep.min = -1; dep.max = 1; dep.step = 0.05
    const mapCmd = function(){
      return { type: 'paramMap', value: { key: d.key, source: sel.value, depth: parseFloat(dep.value) } }
    }
    sel.addEventListener('change', function(){ cmd(mapCmd()) })
    wireRange(dep, 'pd_' + d.key, mapCmd)
    map.appendChild(sel)
    map.appendChild(dep)
    wrap.appendChild(map)

    paramEls[d.key] = { range: r, val: val, src: sel, dep: dep }
  })
}

// ---- post chain (rebuilt only when membership/order changes) ----
function rebuildPostUI(e){
  const chain = $('chain')
  chain.textContent = ''
  chainEls = {}
  const active = e.activePost || []
  active.forEach(function(id, idx){
    const row = el('div', 'chainrow')
    row.appendChild(el('span', 'nm', postLabel(id)))
    const r = document.createElement('input')
    r.type = 'range'; r.min = 0; r.max = 1; r.step = 0.01
    r.value = (e.postAmounts && e.postAmounts[id] != null) ? e.postAmounts[id] : 1
    wireRange(r, 'pa_' + id, function(v){ return { type: 'postAmount', value: { id: id, value: v } } })
    row.appendChild(r)
    const up = el('button', '', String.fromCharCode(8593))
    up.disabled = idx === 0
    up.addEventListener('click', function(){ cmd({ type: 'postMove', value: { id: id, delta: -1 } }) })
    const dn = el('button', '', String.fromCharCode(8595))
    dn.disabled = idx === active.length - 1
    dn.addEventListener('click', function(){ cmd({ type: 'postMove', value: { id: id, delta: 1 } }) })
    const rm = el('button', '', String.fromCharCode(10005))
    rm.addEventListener('click', function(){ cmd({ type: 'post', value: id }) })
    row.appendChild(up); row.appendChild(dn); row.appendChild(rm)
    chain.appendChild(row)
    chainEls[id] = r
  })
  if (!active.length) chain.appendChild(el('div', 'hint', 'Nessun post attivo'))

  const add = $('postadd')
  add.textContent = ''
  ;(defs.posts || []).forEach(function(p){
    if (active.indexOf(p.id) !== -1) return
    const b = el('button', '', '+ ' + p.label)
    b.addEventListener('click', function(){ cmd({ type: 'post', value: p.id }) })
    add.appendChild(b)
  })
}

function postLabel(id){
  const list = defs.posts || []
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i].label
  return id
}

// ---- polling: surgical DOM updates, structural rebuilds only on change ----
async function poll(){
  let j
  try {
    const r = await fetch('/state', { headers: auth() })
    if (r.status === 401) return logout()
    j = await r.json()
  } catch (_) { conn(false); return }
  conn(true)

  if (typeof j.looksRev === 'number' && j.looksRev !== looksRev) {
    looksRev = j.looksRev
    refreshLooks()
  }

  const e = j.engine
  if (!e || !defs) return

  // top strip — BPM comes from the live audio cache, not the engine snapshot
  setOn($('blackout'), !!e.blackout)
  setOn($('freeze'), !!e.frozen)
  const bpm = (j.audio && j.audio.bpm) || e.bpm
  setText($('bpm'), bpm ? String(Math.round(bpm)) : '--')
  setRange($('master'), num(e.brightness, 1))

  // AutoVJ: desktop is the source of truth; optimistic tap corrected here
  if (j.vj) {
    local.autovj = !!j.vj.enabled
    setOn($('autovj'), local.autovj)
    const gsel = $('genre')
    if (j.vj.genre && document.activeElement !== gsel && gsel.value !== j.vj.genre) gsel.value = j.vj.genre
  }

  // FX: active effect highlight + params
  if (prev.fx !== e.activeEffect) {
    prev.fx = e.activeEffect
    for (const k in fxBtns) fxBtns[k].classList.toggle('on', k === e.activeEffect)
  }
  const psig = (e.paramDefs || []).map(function(d){ return d.key }).join(',') + '|' + e.activeEffect
  if (prev.psig !== psig) { prev.psig = psig; rebuildParams(e) }
  // Engine buckets params under the effect id ('__custom__' for custom shaders)
  // — when a custom shader is live, its bucket wins over the stale stock one
  const ep = e.effectParams || {}
  const bucket = (e.customShader ? ep['__custom__'] : ep[e.activeEffect]) || ep['__custom__'] || {}
  ;(e.paramDefs || []).forEach(function(d){
    const els = paramEls[d.key]
    if (!els) return
    const st = bucket[d.key] || { value: d.default, source: 'none', depth: 0.5 }
    if (!dragging['p_' + d.key]) {
      setRange(els.range, st.value)
      setText(els.val, fmtV(st.value))
    }
    if (document.activeElement !== els.src && els.src.value !== st.source) els.src.value = st.source
    setRange(els.dep, st.depth)
  })

  // MIX
  setRange($('xfade'), num(e.crossfade, 0))
  const db = $('deckb')
  if (e.deckBEffect && document.activeElement !== db && db.value !== e.deckBEffect) db.value = e.deckBEffect
  if (prev.blend !== e.blendMode) {
    prev.blend = e.blendMode
    for (const m in blendBtns) blendBtns[m].classList.toggle('on', m === e.blendMode)
  }
  const csig = (e.activePost || []).join(',')
  if (prev.chain !== csig) { prev.chain = csig; rebuildPostUI(e) }
  if (e.postAmounts) {
    for (const id in chainEls) {
      if (e.postAmounts[id] != null) setRange(chainEls[id], e.postAmounts[id])
    }
  }
  const mb = num(e.motionBlur, 0)
  if (!dragging['mblur']) { setRange($('mblur'), mb); setText($('mblur_v'), fmtV(mb)) }

  // COLORI
  const g = e.grade
  if (g) {
    GRADE_KEYS.forEach(function(k){
      if (typeof g[k] !== 'number' || dragging['g_' + k]) return
      setRange($('g_' + k), g[k])
      setText($('gv_' + k), fmtV(g[k]))
    })
  }
  const pal = (e.colors || []).join(',')
  if (prev.pal !== pal) {
    prev.pal = pal
    document.querySelectorAll('.palbtn').forEach(function(b){
      b.classList.toggle('on', b.dataset.c === pal)
    })
  }
}

function conn(ok){
  $('conn').classList.toggle('ok', ok)
  setText($('connt'), ok ? 'Connesso' : 'Offline')
}

// ---- static wiring ----
function wireStatic(){
  $('pairbtn').addEventListener('click', pair)
  $('code').addEventListener('input', function(){
    this.value = this.value.replace(/[^0-9]/g, '')
    if (this.value.length === 6) pair()   // auto-submit at 6 digits
  })

  // blackout/freeze: optimistic toggle, next poll confirms
  $('blackout').addEventListener('click', function(){
    const on = !this.classList.contains('on')
    this.classList.toggle('on', on)
    cmd({ type: 'blackout', value: on })
  })
  $('freeze').addEventListener('click', function(){
    const on = !this.classList.contains('on')
    this.classList.toggle('on', on)
    cmd({ type: 'freeze', value: on })
  })
  $('tap').addEventListener('click', function(){ cmd({ type: 'tap' }) })

  // autovj: optimistic toggle, next poll confirms from state.vj
  $('autovj').addEventListener('click', function(){
    local.autovj = !local.autovj
    this.classList.toggle('on', local.autovj)
    cmd({ type: 'autovj', value: local.autovj })
  })

  $('unpair').addEventListener('click', logout)

  wireRange($('master'), 'master', function(v){ return { type: 'brightness', value: v } })
  wireRange($('xfade'), 'xfade', function(v){ return { type: 'crossfade', value: v } })
  wireRange($('mblur'), 'mblur', function(v){ return { type: 'motionBlur', value: v } }, $('mblur_v'))
  wireRange($('trdur'), 'trdur', function(v){ return { type: 'transitionDuration', value: v } }, $('trdur_v'))
  GRADE_KEYS.forEach(function(k){
    wireRange($('g_' + k), 'g_' + k, function(v){ return { type: 'grade', value: { key: k, value: v } } }, $('gv_' + k))
  })

  // bottom tab bar — hidden tabs are display:none, no offscreen work
  const tabs = ['live', 'fx', 'mix', 'color', 'setup']
  tabs.forEach(function(t){
    $('tb_' + t).addEventListener('click', function(){
      tabs.forEach(function(o){
        $('tab-' + o).hidden = o !== t
        $('tb_' + o).classList.toggle('on', o === t)
      })
    })
  })
}

wireStatic()
if (token) {
  // token may be stale from a previous session — boot() logs out on 401
  enter()
}
</script>
</body>
</html>`
