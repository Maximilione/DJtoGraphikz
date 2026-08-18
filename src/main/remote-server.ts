import { BrowserWindow, ipcMain } from 'electron'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { randomBytes, randomInt, timingSafeEqual } from 'crypto'
import { networkInterfaces } from 'os'

// Web remote: phone on the same wifi opens the QR, enters the pairing code,
// gets a session token and drives the engine over plain HTTP.
// ponytail: HTTP POST + 1.5s state polling, no WebSocket — on a LAN the
// latency is fine; switch to `ws` only if slider feel ever demands it.

const BASE_PORT = 9666
const MAX_PAIR_ATTEMPTS = 8
const LOCKOUT_MS = 60_000

let pairingCode = ''
let sessionToken = ''
let failedAttempts = 0
let lockedUntil = 0
let port = BASE_PORT
let lastEngineState: unknown = null

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
  return sessionToken !== '' && safeEqual(token, sessionToken)
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
          sessionToken = randomBytes(24).toString('hex')
          json(res, 200, { token: sessionToken })
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
      json(res, 200, { engine: lastEngineState })
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

  ipcMain.handle('remote:info', () => ({
    url: `http://${lanIp()}:${port}/`,
    code: pairingCode,
  }))

  // Invalidate the session and rotate the pairing code
  ipcMain.handle('remote:reset', () => {
    sessionToken = ''
    pairingCode = String(randomInt(0, 1000000)).padStart(6, '0')
    return { code: pairingCode }
  })
}

// ---- Mobile control page (vanilla, no build step) ----

const EFFECTS = [
  'tunnel', 'kaleidoscope', 'voronoi', 'sacred', 'mandala', 'hexagons', 'rings',
  'fluid', 'plasma', 'warp', 'metaballs', 'fire', 'fractal',
  'particles', 'starfield', 'waves', 'lissajous', 'dna',
  'matrix', 'grid', 'glitch',
]
const POSTS = ['bloom', 'feedback', 'chromatic', 'rgb-split', 'pixelate', 'mirror', 'invert', 'filmgrain', 'scanlines']
const GENRES = ['acid-techno', 'hard-tekno', 'dark-industrial', 'minimal-hypnotic', 'trance', 'drum-n-bass', 'ambient', 'gabber']
const PALETTES = [
  ['#00ff88', '#ff00ff', '#4444ff'], ['#ff4400', '#ffaa00', '#ff0066'],
  ['#00ccff', '#0044ff', '#88ffff'], ['#ff0000', '#880000', '#ff4444'],
  ['#ff71ce', '#01cdfe', '#b967ff'], ['#f72585', '#7209b7', '#3a0ca3'],
  ['#00ff87', '#60efff', '#ff00e5'], ['#ffffff', '#888888', '#ffffff'],
]

const REMOTE_PAGE = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>DJtoGraphikz Remote</title>
<style>
  :root { --bg:#08080a; --panel:#131318; --line:#26262f; --ink:#e8e8f0; --mute:#8888a0; --acc:#00ff88; }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { background:var(--bg); color:var(--ink); font-family:-apple-system,system-ui,sans-serif; padding:14px; padding-bottom:40px; }
  h1 { font-size:14px; letter-spacing:2px; color:var(--acc); font-family:ui-monospace,monospace; margin-bottom:14px; }
  .sect { font-size:10px; letter-spacing:2px; color:var(--mute); text-transform:uppercase; margin:18px 0 8px; font-family:ui-monospace,monospace; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
  button { background:var(--panel); border:1px solid var(--line); color:var(--ink); border-radius:8px;
    padding:13px 6px; font-size:13px; touch-action:manipulation; }
  button.on { border-color:var(--acc); color:var(--acc); background:rgba(0,255,136,.1); }
  button.danger.on { border-color:#ff4455; color:#ff4455; background:rgba(255,68,85,.12); }
  .row { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
  .row button { flex:1; padding:16px 6px; font-weight:700; }
  input[type=range] { width:100%; height:34px; accent-color:var(--acc); }
  .pal { display:flex; gap:2px; justify-content:center; padding:12px 4px; }
  .pal span { width:20px; height:20px; border-radius:4px; }
  select { width:100%; background:var(--panel); color:var(--ink); border:1px solid var(--line);
    border-radius:8px; padding:12px; font-size:14px; }
  #pair { position:fixed; inset:0; background:var(--bg); display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:14px; padding:24px; }
  #pair input { background:var(--panel); border:1px solid var(--line); color:var(--ink); border-radius:10px;
    font-size:30px; text-align:center; letter-spacing:10px; width:230px; padding:12px; font-family:ui-monospace,monospace; }
  #pair .err { color:#ff5566; font-size:13px; min-height:18px; }
  #pair button { width:230px; background:var(--acc); color:#000; font-weight:700; font-size:15px; border:0; }
  .tap { width:100%; padding:22px; font-size:16px; font-weight:800; letter-spacing:2px; }
  .lbl { font-size:11px; color:var(--mute); width:64px; flex-shrink:0; font-family:ui-monospace,monospace; }
</style>
</head>
<body>
<div id="pair">
  <h1>DJTOGRAPHIKZ</h1>
  <div style="color:var(--mute);font-size:13px">Inserisci il codice mostrato nell'app</div>
  <input id="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="——————" autofocus>
  <div class="err" id="err"></div>
  <button onclick="pair()">COLLEGA</button>
</div>

<div id="panel" style="display:none">
  <h1>DJTOGRAPHIKZ REMOTE</h1>

  <div class="row">
    <button id="blackout" class="danger" onclick="toggle('blackout')">BLACKOUT</button>
    <button id="freeze" onclick="toggle('freeze')">FREEZE</button>
    <button class="tapbtn" onclick="cmd({type:'tap'})">TAP</button>
  </div>
  <div class="row"><span class="lbl">MASTER</span>
    <input type="range" min="0" max="1" step="0.01" value="1" oninput="slide('brightness', this.value)"></div>

  <div class="sect">Auto VJ</div>
  <div class="row">
    <button id="autovj" onclick="toggle('autovj')">AUTO VJ</button>
    <select onchange="cmd({type:'genre', value:this.value})">
      ${GENRES.map(g => `<option value="${g}">${g}</option>`).join('')}
    </select>
  </div>

  <div class="sect">Effetti</div>
  <div class="grid" id="fx">
    ${EFFECTS.map(e => `<button data-fx="${e}" onclick="cmd({type:'effect', value:'${e}'})">${e}</button>`).join('')}
  </div>

  <div class="sect">Crossfader A/B</div>
  <div class="row"><span class="lbl">A → B</span>
    <input type="range" min="0" max="1" step="0.01" value="0" oninput="slide('crossfade', this.value)"></div>
  <select onchange="cmd({type:'deckB', value:this.value})">
    ${EFFECTS.map(e => `<option value="${e}">deck B: ${e}</option>`).join('')}
  </select>

  <div class="sect">Post FX</div>
  <div class="grid">
    ${POSTS.map(p => `<button data-post="${p}" onclick="cmd({type:'post', value:'${p}'})">${p}</button>`).join('')}
  </div>

  <div class="sect">Colori</div>
  <div class="grid">
    ${PALETTES.map(p => `<button class="pal" onclick='cmd({type:"palette", value:${JSON.stringify(p)}})'>${p.map(c => `<span style="background:${c}"></span>`).join('')}</button>`).join('')}
  </div>
</div>

<script>
let token = localStorage.getItem('djg-token') || ''
let states = { blackout:false, freeze:false, autovj:false }

async function pair() {
  const r = await fetch('/pair', { method:'POST', body: JSON.stringify({ code: document.getElementById('code').value }) })
  const j = await r.json()
  if (j.token) { token = j.token; localStorage.setItem('djg-token', token); enter() }
  else document.getElementById('err').textContent = j.error || 'Errore'
}

function enter() {
  document.getElementById('pair').style.display = 'none'
  document.getElementById('panel').style.display = 'block'
  poll()
  setInterval(poll, 1500)
}

async function cmd(c) {
  const r = await fetch('/cmd', { method:'POST', headers:{ Authorization:'Bearer '+token }, body: JSON.stringify(c) })
  if (r.status === 401) { localStorage.removeItem('djg-token'); location.reload() }
}

let slideT = {}
function slide(type, value) {
  clearTimeout(slideT[type])
  slideT[type] = setTimeout(() => cmd({ type, value: parseFloat(value) }), 60)
}

function toggle(k) {
  states[k] = !states[k]
  cmd({ type:k, value: states[k] })
  document.getElementById(k).classList.toggle('on', states[k])
}

async function poll() {
  try {
    const r = await fetch('/state', { headers:{ Authorization:'Bearer '+token } })
    if (r.status === 401) { localStorage.removeItem('djg-token'); location.reload(); return }
    const { engine } = await r.json()
    if (!engine) return
    document.querySelectorAll('[data-fx]').forEach(b =>
      b.classList.toggle('on', b.dataset.fx === engine.activeEffect))
    document.querySelectorAll('[data-post]').forEach(b =>
      b.classList.toggle('on', (engine.activePost||[]).includes(b.dataset.post)))
    states.blackout = !!engine.blackout
    states.freeze = !!engine.frozen
    document.getElementById('blackout').classList.toggle('on', states.blackout)
    document.getElementById('freeze').classList.toggle('on', states.freeze)
  } catch (_) {}
}

if (token) {
  // token may be stale from a previous session — poll() logs out on 401
  enter()
}
</script>
</body>
</html>`
