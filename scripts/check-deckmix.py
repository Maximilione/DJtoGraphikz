#!/usr/bin/env python3
"""Contact sheet + pixel checks for the deck crossfader shader (deckmix.frag).

shader-preview.py renders effects only; the deck mixer takes two textures, so
this feeds it two synthetic decks (A red with a dark band at the bottom, B
blue) and draws every mask at crossfade 0.25 / 0.5 / 0.75 (hard edge) plus a
soft-edge column, compiled the same way three.js does (GLSL ES 3.00).

    python3 scripts/check-deckmix.py [/tmp/deckmix.png]

Exit 1 on a compile error or when a mask puts the wrong deck where it must
not be (left of a vertical split, centre of the circle, the lit part of A
under luma-key).
"""
import importlib.util
import json
import pathlib
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("sp", REPO / "scripts/shader-preview.py")
sp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sp)

CW, CH = 240, 135
MODES = ["split-v", "split-h", "radial", "luma", "audio"]
COLS = [(0.25, 0.0, 0, 0), (0.5, 0.0, 0, 0), (0.75, 0.0, 0, 0), (0.5, 0.7, 0, 0)]  # mix, soft, bass, beat


def main() -> int:
    out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/deckmix.png"
    frag = sp.to_es300((REPO / "src/engine/shaders/deckmix.frag").read_text(), tone=False)
    cfg = {"frag": frag, "modes": MODES, "cols": COLS, "cw": CW, "ch": CH}
    html = """<!DOCTYPE html><html><body style="margin:0;background:#222">
<canvas id="c"></canvas><pre id="r"></pre>
<script>
const CFG = __CFG__;
const W = CFG.cw * CFG.cols.length, H = CFG.ch * CFG.modes.length;
const canvas = document.getElementById('c'); canvas.width = W; canvas.height = H;
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
const vs = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;
function sh(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('COMPILE ERROR\\n' + gl.getShaderInfoLog(s));
  return s;
}
const res = { errors: [] };
try {
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, CFG.frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('LINK ERROR\\n' + gl.getProgramInfoLog(p));
  gl.useProgram(p);
  const u1 = (n, v) => gl.uniform1f(gl.getUniformLocation(p, n), v);
  const ui = (n, v) => gl.uniform1i(gl.getUniformLocation(p, n), v);
  // deck A: red, dark band in the bottom third (luma-key reveals B there);
  // deck B: blue
  const tex = (fill) => {
    const px = new Uint8Array(CFG.cw * CFG.ch * 4);
    for (let y = 0; y < CFG.ch; y++) for (let x = 0; x < CFG.cw; x++) {
      const c = fill(x / CFG.cw, y / CFG.ch), i = (y * CFG.cw + x) * 4;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
    }
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CFG.cw, CFG.ch, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  gl.activeTexture(gl.TEXTURE0); tex((x, y) => y < 0.33 ? [25, 0, 0] : [255, 0, 0]);
  gl.activeTexture(gl.TEXTURE1); tex(() => [0, 0, 255]);
  ui('tDeckA', 0); ui('tDeckB', 1); ui('uBlend', 0);
  gl.uniform2f(gl.getUniformLocation(p, 'uResolution'), CFG.cw, CFG.ch);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const px = new Uint8Array(4);
  const at = (ox, oy, fx, fy) => {   // fx,fy in cell uv (y up)
    gl.readPixels(ox + Math.round(fx * (CFG.cw - 1)), oy + Math.round(fy * (CFG.ch - 1)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px[2] > px[0] ? 'B' : 'A';
  };
  CFG.modes.forEach((m, r) => CFG.cols.forEach((c, k) => {
    const ox = k * CFG.cw, oy = (CFG.modes.length - 1 - r) * CFG.ch;
    gl.viewport(ox, oy, CFG.cw, CFG.ch);
    const audio = m === 'audio';
    ui('uMaskMode', r + 1); u1('uMix', c[0]); u1('uMaskSoft', c[1]);
    u1('uBass', audio ? 0.8 : 0); u1('uBeat', audio ? 1.0 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (c[1] > 0) return;   // soft column is for the eye only
    const key = m + '@' + c[0];
    const want = {
      'split-v': [['A', at(ox, oy, 0.05, 0.9)], ['B', at(ox, oy, 0.95, 0.9)], [c[0] >= 0.5 ? 'B' : 'A', at(ox, oy, 0.6, 0.9)]],
      'split-h': [['B', at(ox, oy, 0.5, 0.05)], ['A', at(ox, oy, 0.5, 0.95)]],
      'radial':  [['B', at(ox, oy, 0.5, 0.5)], ['A', at(ox, oy, 0.02, 0.98)]],
      'luma':    [['B', at(ox, oy, 0.5, 0.1)], [c[0] >= 0.5 ? 'B' : 'A', at(ox, oy, 0.5, 0.9)]],
      'audio':   [['B', at(ox, oy, 0.5, 0.5)]],
    }[m];
    want.forEach(([w, g], i) => { if (w !== g) res.errors.push(key + ' probe ' + i + ': want ' + w + ' got ' + g); });
  }));
} catch (e) { res.errors.push(String(e.message || e)); }
gl.finish();
document.getElementById('r').textContent = JSON.stringify(res);
</script></body></html>"""
    page = pathlib.Path("/tmp/djg-deckmix.html")
    page.write_text(html.replace("__CFG__", json.dumps(cfg)))
    base = [sp.CHROME, "--headless=new", "--disable-gpu-sandbox", "--no-sandbox", "--use-angle=metal",
            "--hide-scrollbars", f"--window-size={CW * len(COLS)},{CH * len(MODES)}"]
    subprocess.run(base + [f"--screenshot={out}", f"file://{page}"], capture_output=True, timeout=120)
    dom = subprocess.run(base + ["--dump-dom", f"file://{page}"], capture_output=True, text=True, timeout=120).stdout
    try:
        res = json.loads(dom.split('<pre id="r">')[1].split("</pre>")[0])
    except (IndexError, json.JSONDecodeError):
        print("FAIL: no result in page"); return 1
    print("shot:", out, "rows:", MODES, "cols (mix, soft):", [c[:2] for c in COLS])
    for e in res["errors"]:
        print("FAIL:", e)
    return 1 if res["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
