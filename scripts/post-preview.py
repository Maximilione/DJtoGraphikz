#!/usr/bin/env python3
"""Render one post-FX shader headless to a PNG, applied to a synthetic test card.

Posts take a rendered frame as input (tDiffuse), not UV alone — this draws a
test card first (colour bars, a bright disc for bloom highlights, a fine grid
for displacement/pixelate/mirror, diagonal edges for outline/frame-glitch)
then runs the real post .frag the app uses on it, GLSL ES 3.00 on WebGL2,
same as shader-preview.py does for effects.

    python3 scripts/post-preview.py bloom /tmp/bloom.png
    python3 scripts/post-preview.py rgb-delay /tmp/rgbdelay.png

A '_card.png' is written alongside the first time, as the undistorted
reference to compare every post screenshot against.
"""
import json
import pathlib
import re
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# post id -> .frag basename (all live in src/engine/shaders/)
FRAG = {
    'bloom': 'bloom', 'rgb-split': 'rgbsplit', 'chromatic': 'chromatic',
    'feedback': 'feedback', 'rgb-delay': 'rgbdelay', 'filmgrain': 'filmgrain',
    'scanlines': 'scanlines', 'pixelate': 'pixelate', 'mirror': 'mirror',
    'invert': 'invert', 'displace': 'displace', 'frame-glitch': 'frameglitch',
    'outline': 'outline', 'anamorphic': 'anamorphic', 'halation': 'halation',
    'godrays': 'godrays', 'cinegrade': 'cinegrade', 'tiltshift': 'tiltshift',
}
# posts that read a second highlight/history texture beyond tDiffuse
NEEDS_BLOOM_TEX = {'bloom', 'anamorphic', 'halation', 'godrays'}
NEEDS_PREV = {'feedback'}
NEEDS_DELAY = {'rgb-delay'}
# uniforms outside the generic set this harness always sets (name -> value),
# matching Engine.ts's construction-time defaults
EXTRA_UNIFORMS = {
    'bloom': {'uStrength': 1.4},
    'chromatic': {'uStrength': 0.008},
    'rgb-split': {'uAmount': 0.012, 'uAngle': 0.0},  # amount boosted 4x from the 0.003 default — visible at 960x540, the app runs it at output res
}


def to_es300(frag: str) -> str:
    frag = (frag.replace("varying", "in")
                .replace("texture2D(", "texture(")
                .replace("gl_FragColor", "djgFragColor"))
    head = "#version 300 es\nprecision highp float;\nout vec4 djgFragColor;\n"
    frag = re.sub(r"^\s*precision[^;]*;\s*$", "", frag, count=1, flags=re.M)
    return head + frag


def build_page(post_id: str | None, w: int, h: int) -> pathlib.Path:
    src = to_es300((REPO / f"src/engine/shaders/{FRAG[post_id]}.frag").read_text()) if post_id else None
    cfg = {"post": src, "w": w, "h": h,
           "needsBloom": post_id in NEEDS_BLOOM_TEX,
           "needsPrev": post_id in NEEDS_PREV,
           "needsDelay": post_id in NEEDS_DELAY,
           "extra": EXTRA_UNIFORMS.get(post_id, {})}

    html = """<!DOCTYPE html><html><body style="margin:0">
<canvas id="c"></canvas>
<script>
const CFG = __CFG__;
const W = CFG.w, H = CFG.h;
const canvas = document.getElementById('c');
canvas.width = W; canvas.height = H;
const gl = canvas.getContext('webgl2');

function fail(msg) {
  document.body.innerHTML = '<pre style="background:#300;color:#fbb;font:14px monospace;' +
    'padding:12px;white-space:pre-wrap">' + msg + '</pre>';
}
function sh(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) fail('COMPILE ERROR\\n' + gl.getShaderInfoLog(s));
  return s;
}
function program(fsSrc) {
  const vs = `#version 300 es\\nin vec2 p; out vec2 vUv;
void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) fail('LINK ERROR\\n' + gl.getProgramInfoLog(p));
  return p;
}
const u1 = (p, n, v) => { const l = gl.getUniformLocation(p, n); if (l) gl.uniform1f(l, v); };
const u2 = (p, n, x, y) => { const l = gl.getUniformLocation(p, n); if (l) gl.uniform2f(l, x, y); };
const u3 = (p, n, x, y, z) => { const l = gl.getUniformLocation(p, n); if (l) gl.uniform3f(l, x, y, z); };
const ui = (p, n, v) => { const l = gl.getUniformLocation(p, n); if (l) gl.uniform1i(l, v); };

const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
function attrib(p) {
  const loc = gl.getAttribLocation(p, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}
function draw(p, target) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target);
  gl.viewport(0, 0, W, H);
  gl.useProgram(p);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  attrib(p);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
function rtt() {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fb };
}

// ---- test card: colour bars, a bright disc (bloom highlight), a fine grid
// (displacement/pixelate/mirror), diagonal hard edges (outline/frame-glitch) ----
const cardProg = program(`#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec2 uOffset;
void main() {
  vec2 uv = vUv + uOffset;
  vec3 c = vec3(0.08, 0.08, 0.1);
  float bar = floor(uv.x * 6.0);
  vec3 bars[6] = vec3[6](vec3(1,0.2,0.2), vec3(1,0.6,0.1), vec3(1,1,0.2),
                          vec3(0.2,1,0.3), vec3(0.2,0.6,1), vec3(0.8,0.2,1));
  if (uv.y > 0.55 && uv.y < 0.85) c = bars[int(bar)];
  float d = length(uv - vec2(0.76, 0.22));
  c += vec3(1.0, 0.95, 0.8) * smoothstep(0.1, 0.0, d) * 3.0; // bright disc, bloom food
  vec2 g = abs(fract(uv * 20.0) - 0.5);
  float grid = smoothstep(0.46, 0.5, max(g.x, g.y));
  c = mix(c, vec3(1.0), grid * 0.15);
  float diag = abs(uv.x - uv.y);
  c = mix(c, vec3(1.0, 0.9, 0.2), smoothstep(0.015, 0.0, diag));
  c = mix(c, vec3(0.9, 0.1, 0.5), smoothstep(0.015, 0.0, abs(uv.x + uv.y - 1.0)));
  o = vec4(c, 1.0);
}`);
const card = rtt();
draw(cardProg, card.fb);

// cinema-grade posts (bloom/anamorphic/halation/godrays) read a thresholded,
// blurred highlight buffer (Engine.renderBloom/renderBloomPost), not the raw
// frame — feeding them the sharp full card reads as "everything is a
// highlight" and blows the whole image out, nothing like the real pipeline.
const bloomPrefilter = program(`#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tCard;
void main() {
  vec3 c = texture(tCard, vUv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  o = vec4(c * smoothstep(0.55, 0.9, l), 1.0);
}`);
const bloomBlur = program(`#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tSrc; uniform vec2 uDir; uniform vec2 uTexel;
void main() {
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  for (int i = -8; i <= 8; i++) {
    float w = exp(-float(i * i) / 18.0);
    sum += texture(tSrc, vUv + uDir * uTexel * float(i)).rgb * w;
    wsum += w;
  }
  o = vec4(sum / wsum, 1.0);
}`);
const bloomA = rtt(), bloomB = rtt();
gl.useProgram(bloomPrefilter);
gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, card.tex);
ui(bloomPrefilter, 'tCard', 0);
draw(bloomPrefilter, bloomA.fb);
gl.useProgram(bloomBlur);
ui(bloomBlur, 'tSrc', 0);
u2(bloomBlur, 'uTexel', 1 / W, 1 / H);
gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bloomA.tex);
u2(bloomBlur, 'uDir', 1, 0);
draw(bloomBlur, bloomB.fb);
gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bloomB.tex);
u2(bloomBlur, 'uDir', 0, 1);
draw(bloomBlur, bloomA.fb);
const bloomTex = bloomA.tex;   // thresholded + blurred highlight buffer

// a second, hue-shifted card so history/delay textures read as visibly
// different from the current frame (as they would be, mid-performance)
const card2Prog = program(`#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tCard;
void main() {
  vec3 c = texture(tCard, vUv).rgb;
  o = vec4(c.gbr * 0.8, 1.0);
}`);
const card2 = rtt();
gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, card.tex);
gl.useProgram(card2Prog); ui(card2Prog, 'tCard', 0);
draw(card2Prog, card2.fb);

// rgb-delay reads real history: the same scene a few frames back, so almost
// identical to the current frame with only the moving parts offset — a
// hue-rotated still (card2) is a believable "very different frame" for
// feedback's warp, but a misleading stand-in for actual temporal delay.
// card3/card4 are the same card, content nudged a little further each step.
gl.useProgram(cardProg);
const card3 = rtt();
u2(cardProg, 'uOffset', 0.015, 0.01);
draw(cardProg, card3.fb);
const card4 = rtt();
u2(cardProg, 'uOffset', 0.03, 0.02);
draw(cardProg, card4.fb);

if (!CFG.post) {
  // reference card only (uOffset reset — card3/card4 above left it nonzero)
  gl.useProgram(cardProg);
  u2(cardProg, 'uOffset', 0.0, 0.0);
  draw(cardProg, null);
} else {
  const postProg = program(CFG.post);
  gl.useProgram(postProg);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, card.tex);
  ui(postProg, 'tDiffuse', 0);
  if (CFG.needsBloom) {
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloomTex);
    ui(postProg, 'tBloom', 1);
  }
  if (CFG.needsPrev) {
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, card2.tex);
    ui(postProg, 'tPrevFrame', 1);
  }
  if (CFG.needsDelay) {
    // the real app's current/delay1/delay2 are the same scene a few frames
    // apart (card/card3/card4: same content, nudged a little further back)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, card3.tex);
    ui(postProg, 'tDelay1', 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, card4.tex);
    ui(postProg, 'tDelay2', 2);
  }
  u1(postProg, 'uWet', 1.0); u1(postProg, 'uLevel', 1.0);
  u1(postProg, 'uBass', 0.6); u1(postProg, 'uMid', 0.4); u1(postProg, 'uHigh', 0.35);
  u1(postProg, 'uEnergy', 0.6); u1(postProg, 'uBeat', 0.7); u1(postProg, 'uHighHit', 0.5);
  u1(postProg, 'uLineBoost', 1.0); u1(postProg, 'uTime', 5.0);
  u2(postProg, 'uResolution', W, H);
  u3(postProg, 'uColor1', 0.0, 1.0, 0.53); u3(postProg, 'uColor2', 1.0, 0.0, 1.0);
  u3(postProg, 'uColor3', 0.27, 0.27, 1.0);
  for (const [name, val] of Object.entries(CFG.extra)) u1(postProg, name, val);
  draw(postProg, null);
}
gl.finish();
</script></body></html>"""
    html = html.replace("__CFG__", json.dumps(cfg))
    page = pathlib.Path(f"/tmp/djg-post-preview-{post_id or 'card'}.html")
    page.write_text(html)
    return page


def shoot(page: pathlib.Path, out: str, w: int, h: int):
    subprocess.run([CHROME, "--headless=new", "--disable-gpu-sandbox", "--no-sandbox",
                    "--use-angle=metal", f"--screenshot={out}",
                    f"--window-size={w},{h}", "--hide-scrollbars", f"file://{page}"],
                   capture_output=True, timeout=120)
    print("shot:", out)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    post_id, out = sys.argv[1], sys.argv[2]
    w, h = 960, 540
    card_out = str(pathlib.Path(out).parent / "_card.png")
    if not pathlib.Path(card_out).exists():
        shoot(build_page(None, w, h), card_out, w, h)
    if post_id not in FRAG:
        print(f"unknown post '{post_id}', known: {', '.join(FRAG)}")
        return 2
    shoot(build_page(post_id, w, h), out, w, h)
    return 0


if __name__ == "__main__":
    sys.exit(main())
