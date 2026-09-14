#!/usr/bin/env python3
"""Render one project shader headless to a PNG.

Shaders are the product here, and judging them by reading GLSL does not work:
this compiles the real .frag the app uses, the same way three.js does
(GLSL ES 3.00 on WebGL2) and with the app's tone mapping, so what comes out
looks like what the projector shows.

    python3 scripts/shader-preview.py vortex 6.0 /tmp/vortex.png
    python3 scripts/shader-preview.py fire 3.0 /tmp/fire.png 0.9 0.5 0.4 0.8 1 0.9
      (optional trailing args: bass mid high energy beat bassHit)

Multi-pass effects: if <effect>.sim.frag exists it is treated as the
simulation pass and ping-ponged into a half-float buffer for t*60 frames
before the visible pass is drawn, the same way the Engine runs it.
Override iterations-per-frame and buffer scale with DJG_ITERS / DJG_SCALE.
"""
import json
import os
import pathlib
import re
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TONE = ("\nvec4 djgTone(vec3 c, float a) {\n"
        "  c *= 1.1;\n"
        "  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);\n"
        "  return vec4(clamp(c, 0.0, 1.0), a);\n"
        "}\n")


def to_es300_vert(src: str) -> str:
    """three.js rewrites attribute/varying for WebGL2; the preview must match."""
    src = (src.replace("attribute", "in").replace("varying", "out")
              .replace("texture2D(", "texture("))
    src = re.sub(r"^\s*precision[^;]*;\s*$", "", src, count=1, flags=re.M)
    return "#version 300 es\nprecision highp float;\n" + src


def to_es300(frag: str, tone: bool) -> str:
    """three.js compiles our shaders as GLSL ES 3.00 on WebGL2 — do the same or
    the preview silently lies (fwidth() used to come back white)."""
    frag = (frag.replace("varying", "in")
                .replace("texture2D(", "texture(")
                .replace("gl_FragColor", "djgFragColor"))
    head = "#version 300 es\nprecision highp float;\nout vec4 djgFragColor;\n"
    if tone:
        frag = frag.replace("djgFragColor = vec4(", "djgFragColor = djgTone(")
        head += TONE
    frag = re.sub(r"^\s*precision[^;]*;\s*$", "", frag, count=1, flags=re.M)
    return head + frag


def effect_params(effect: str) -> str:
    ep = (REPO / "src/engine/EffectParams.ts").read_text()
    block = re.search(re.escape(effect) + r":\s*\[(.*?)\]", ep, re.S)
    out = ""
    if block:
        for m in re.finditer(r"key:\s*'(\w+)'.*?default:\s*([\d.-]+)", block.group(1)):
            out += f"  u1(p, '{m.group(1)}', {m.group(2)});\n"
    return out


def build_page(effect: str, t: float, audio: list[float]) -> pathlib.Path:
    vert_path = REPO / f"src/engine/shaders/{effect}.vert"
    points = vert_path.exists()
    # a point cloud is blended additively into a float buffer and tone mapped
    # once at the end, the way the app's master stage does it — tone mapping
    # each sprite instead would wash the whole swarm out
    main = to_es300((REPO / f"src/engine/shaders/{effect}.frag").read_text(), tone=not points)
    vert = to_es300_vert(vert_path.read_text()) if points else None
    sim_path = REPO / f"src/engine/shaders/{effect}.sim.frag"
    sim = to_es300(sim_path.read_text(), tone=False) if sim_path.exists() else None

    bass, mid, high, energy, beat, bass_hit = audio
    cfg = {
        "main": main, "sim": sim, "t": t,
        "bass": bass, "mid": mid, "high": high, "energy": energy,
        "beat": beat, "bassHit": bass_hit,
        "iters": int(os.environ.get("DJG_ITERS", 8)),
        "scale": float(os.environ.get("DJG_SCALE", 0.35)),
        "vert": vert,
        "side": int(os.environ.get("DJG_SIDE", 256)),
        "w": int(os.environ.get("DJG_W", 960)), "h": int(os.environ.get("DJG_H", 540)),
        # the sim's buffer letter, so the preview binds the same uniform names
        "buf": (re.search(r"uniform sampler2D tBuffer(\w+)", sim).group(1) if sim else "A"),
    }

    html = """<!DOCTYPE html><html><body style="margin:0">
<canvas id="c"></canvas>
<script>
const CFG = __CFG__;
const W = CFG.w, H = CFG.h;
const canvas = document.getElementById('c');
canvas.width = W; canvas.height = H;
const gl = canvas.getContext('webgl2');
gl.getExtension('EXT_color_buffer_float');
const vs = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

function fail(msg) {
  document.body.innerHTML = '<pre style="background:#300;color:#fbb;font:14px monospace;' +
    'padding:12px;white-space:pre-wrap">' + msg + '</pre>';
}
function sh(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) fail('COMPILE ERROR\\n' + gl.getShaderInfoLog(s));
  return s;
}
const TONE_GLSL = `vec4 djgTone(vec3 c, float a) {
  c *= 1.1;
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  return vec4(clamp(c, 0.0, 1.0), a);
}`;
let SIMTEX = null, SIMW = 0, SIMH = 0;
function program(fsSrc, vsSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vsSrc || vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) fail('LINK ERROR\\n' + gl.getProgramInfoLog(p));
  return p;
}
const u1 = (p, n, v) => { const l = gl.getUniformLocation(p, n); if (l) gl.uniform1f(l, v); };
const u2 = (p, n, x, y) => { const l = gl.getUniformLocation(p, n); if (l) gl.uniform2f(l, x, y); };
const u3 = (p, n, x, y, z) => { const l = gl.getUniformLocation(p, n); if (l) gl.uniform3f(l, x, y, z); };
const ui = (p, n, v) => { const l = gl.getUniformLocation(p, n); if (l) gl.uniform1i(l, v); };

const T = CFG.t;
function setCommon(p, time) {
  gl.useProgram(p);
  u1(p, 'uTime', time);
  u1(p, 'uBass', CFG.bass); u1(p, 'uMid', CFG.mid); u1(p, 'uHigh', CFG.high);
  u1(p, 'uEnergy', CFG.energy); u1(p, 'uBeat', CFG.beat); u1(p, 'uBassHit', CFG.bassHit);
  u1(p, 'uMidHit', 0.3); u1(p, 'uHighHit', 0.4);
  u1(p, 'uSub', 0.5); u1(p, 'uPresence', 0.4);
  u1(p, 'uBeatPhase', time % 1.0); u1(p, 'uBarPhase', (time / 4.0) % 1.0);
  u1(p, 'uBeatClock', time * 128.0 / 60.0);
  u1(p, 'uBassTime', time * 0.6); u1(p, 'uHighTime', time * 0.4);
  u3(p, 'uColor1', 0.0, 1.0, 0.53); u3(p, 'uColor2', 1.0, 0.0, 1.0); u3(p, 'uColor3', 0.27, 0.27, 1.0);
  ui(p, 'uSpectrum', 0);
__PARAMS__}

// fullscreen triangle
const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);

// uSpectrum: synthetic 512-bin spectrum + waveform, same layout as the app
// (r = log-spaced magnitude, g = oscilloscope trace centred on 0.5). A pure
// high-frequency sine here is a pathological test signal — it makes any
// shader that reads the spectrum look like it is buzzing.
{
  const N = 512, px = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const u = i / N;
    let v = (0.30 + 0.70 * Math.pow(1.0 - u, 1.2)) * 0.55;
    const parts = [[0.07, 0.95, 0.020], [0.21, 0.70, 0.028], [0.37, 0.50, 0.035],
                   [0.55, 0.34, 0.045], [0.73, 0.22, 0.055]];
    for (const pt of parts) v += pt[1] * Math.exp(-Math.pow((u - pt[0]) / pt[2], 2.0));
    v *= 0.85 + 0.15 * Math.sin(u * 130.0 + T * 3.0);
    px[i * 4] = Math.max(0, Math.min(255, 255 * v * (0.35 + CFG.energy)));
    px[i * 4 + 1] = 128 + 100 * Math.sin(u * 60.0 + T * 6.0) * CFG.energy;
    px[i * 4 + 3] = 255;
  }
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function attrib(p) {
  const loc = gl.getAttribLocation(p, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

// in points mode the visible fragment shader belongs to the point program:
// linking it against the fullscreen vertex shader is a varying mismatch
const mainProg = CFG.vert ? null : program(CFG.main);

// ---- simulation passes, ping-ponged into half-float buffers ----
if (CFG.sim) {
  const SW = CFG.vert ? CFG.side : Math.max(2, Math.round(W * CFG.scale));
  const SH = CFG.vert ? CFG.side : Math.max(2, Math.round(H * CFG.scale));
  const simProg = program(CFG.sim);
  const make = () => {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE3);   // scratch unit: unit 0 holds the spectrum
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, SW, SH, 0, gl.RGBA, gl.HALF_FLOAT, null);
    // a point cloud's buffer holds one particle per texel: interpolating it
    // blends two particles together, and spreads any bad value to its neighbours
    const f = CFG.vert ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb };
  };
  let read = make(), write = make();
  const frames = Math.max(2, Math.round(T * 60));
  gl.viewport(0, 0, SW, SH);
  attrib(simProg);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < CFG.iters; i++) {
      setCommon(simProg, f / 60.0);
      u2(simProg, 'uResolution', SW, SH);
      u2(simProg, 'uBuffer' + CFG.buf + 'Size', SW, SH);
      u1(simProg, 'uFrame', f);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, read.tex);
      ui(simProg, 'tBuffer' + CFG.buf, 1);
      gl.bindFramebuffer(gl.FRAMEBUFFER, write.fb);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const t = read; read = write; write = t;
    }
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  SIMTEX = read.tex; SIMW = SW; SIMH = SH;
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, read.tex);
  if (mainProg) {
    setCommon(mainProg, T);
    ui(mainProg, 'tBuffer' + CFG.buf, 1);
    u2(mainProg, 'uBuffer' + CFG.buf + 'Size', SW, SH);
  }
}

if (CFG.vert) {
  // point cloud: additive into a float buffer, then one tone-map pass out
  const pointsProg = program(CFG.main, CFG.vert);
  const N = CFG.side * CFG.side;   // indexed by gl_VertexID, no attribute
  const acc = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, acc);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, W, H, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const accFb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, accFb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, acc, 0);
  gl.viewport(0, 0, W, H);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(pointsProg);
  setCommon(pointsProg, T);
  u2(pointsProg, 'uResolution', W, H);
  u2(pointsProg, 'uBuffer' + CFG.buf + 'Size', SIMW, SIMH);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, SIMTEX);
  ui(pointsProg, 'tBuffer' + CFG.buf, 1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.disable(gl.DEPTH_TEST);
  gl.drawArrays(gl.POINTS, 0, N);
  gl.disable(gl.BLEND);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const toneProg = program(`#version 300 es
precision highp float;
out vec4 djgFragColor;
in vec2 vUv;
uniform sampler2D tSrc;
` + TONE_GLSL + `
void main(){ djgFragColor = djgTone(texture(tSrc, vUv).rgb, 1.0); }`);
  gl.useProgram(toneProg);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, acc);
  ui(toneProg, 'tSrc', 2);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  attrib(toneProg);
  gl.viewport(0, 0, W, H);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
} else {
  setCommon(mainProg, T);
  if (CFG.sim) { ui(mainProg, 'tBuffer' + CFG.buf, 1); }
  u2(mainProg, 'uResolution', W, H);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  attrib(mainProg);
  gl.viewport(0, 0, W, H);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
gl.finish();
</script></body></html>"""
    html = html.replace("__CFG__", json.dumps(cfg)).replace("__PARAMS__", effect_params(effect))
    page = pathlib.Path(f"/tmp/djg-preview-{effect}.html")
    page.write_text(html)
    return page


def main() -> int:
    if len(sys.argv) < 4:
        print(__doc__)
        return 2
    effect, t, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    audio = [float(x) for x in sys.argv[4:10]] or [0.6, 0.4, 0.35, 0.55, 0.4, 0.5]
    if len(audio) < 6:
        audio = [0.6, 0.4, 0.35, 0.55, 0.4, 0.5]
    cfg_w = int(os.environ.get("DJG_W", 960))
    cfg_h = int(os.environ.get("DJG_H", 540))
    page = build_page(effect, t, audio)
    subprocess.run([CHROME, "--headless=new", "--disable-gpu-sandbox", "--no-sandbox",
                    "--use-angle=metal", f"--screenshot={out}",
                    f"--window-size={cfg_w},{cfg_h}", "--hide-scrollbars", f"file://{page}"],
                   capture_output=True, timeout=120)
    print("shot:", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
