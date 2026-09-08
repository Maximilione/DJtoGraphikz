#!/usr/bin/env python3
"""Render one project shader headless to a PNG.

Shaders are the product here, and judging them by reading GLSL does not work:
this compiles the real .frag the app uses, the same way three.js does
(GLSL ES 3.00 on WebGL2) and with the app's tone mapping, so what comes out
looks like what the projector shows.

    python3 scripts/shader-preview.py vortex 6.0 /tmp/vortex.png
    python3 scripts/shader-preview.py fire 3.0 /tmp/fire.png 0.9 0.5 0.4 0.8 1 0.9
      (optional trailing args: bass mid high energy beat bassHit)
"""
import json
import pathlib
import re
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def build_page(effect: str, t: float, audio: list[float]) -> pathlib.Path:
    frag = (REPO / f"src/engine/shaders/{effect}.frag").read_text()

    # three.js runs these as GLSL ES 3.00 on WebGL2; do the same conversion or
    # fwidth() fails and the preview silently lies (it used to return white)
    frag = (frag.replace("varying", "in")
                .replace("texture2D(", "texture(")
                .replace("gl_FragColor", "djgFragColor"))
    # approximate the app's master stage so brightness is judged fairly
    tone = ("\nvec4 djgTone(vec3 c, float a) {\n"
            "  c *= 1.1;\n"
            "  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);\n"
            "  return vec4(clamp(c, 0.0, 1.0), a);\n"
            "}\n")
    frag = frag.replace("djgFragColor = vec4(", "djgFragColor = djgTone(")
    frag = re.sub(r"^\s*precision[^;]*;\s*$", "", frag, count=1, flags=re.M)
    frag = "#version 300 es\nprecision highp float;\nout vec4 djgFragColor;\n" + tone + frag

    # effect parameters at their declared defaults
    ep = (REPO / "src/engine/EffectParams.ts").read_text()
    block = re.search(re.escape(effect) + r":\s*\[(.*?)\]", ep, re.S)
    params = ""
    if block:
        for m in re.finditer(r"key:\s*'(\w+)'.*?default:\s*([\d.-]+)", block.group(1)):
            params += f"u1('{m.group(1)}', {m.group(2)});\n"

    bass, mid, high, energy, beat, bass_hit = audio
    html = f"""<!DOCTYPE html><html><body style="margin:0">
<canvas id="c" width="960" height="540"></canvas>
<script>
const gl = document.getElementById('c').getContext('webgl2');
const vs = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){{ vUv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }}`;
const fs = {json.dumps(frag)};
function sh(type, src) {{
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {{
    const log = gl.getShaderInfoLog(s);
    document.body.innerHTML = '<pre style="background:#300;color:#fbb;font:14px monospace;padding:12px;white-space:pre-wrap">COMPILE ERROR\\n' + log + '</pre>';
  }}
  return s;
}}
const prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(prog); gl.useProgram(prog);
const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'p');
gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const u1 = (n, v) => {{ const l = gl.getUniformLocation(prog, n); if (l) gl.uniform1f(l, v); }};
const u2 = (n, x, y) => {{ const l = gl.getUniformLocation(prog, n); if (l) gl.uniform2f(l, x, y); }};
const u3 = (n, x, y, z) => {{ const l = gl.getUniformLocation(prog, n); if (l) gl.uniform3f(l, x, y, z); }};
const T = {t};
u1('uTime', T); u2('uResolution', 960, 540);
u1('uBass', {bass}); u1('uMid', {mid}); u1('uHigh', {high});
u1('uEnergy', {energy}); u1('uBeat', {beat}); u1('uBassHit', {bass_hit});
u1('uMidHit', 0.3); u1('uHighHit', 0.4);
u1('uBeatPhase', T % 1.0); u1('uBarPhase', (T / 4.0) % 1.0);
u1('uBassTime', T * 0.6); u1('uHighTime', T * 0.4);
u3('uColor1', 0.0, 1.0, 0.53); u3('uColor2', 1.0, 0.0, 1.0); u3('uColor3', 0.27, 0.27, 1.0);
{params}
gl.viewport(0, 0, 960, 540);
gl.drawArrays(gl.TRIANGLES, 0, 3);
gl.finish();
</script></body></html>"""
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
    page = build_page(effect, t, audio)
    subprocess.run([CHROME, "--headless=new", "--disable-gpu-sandbox", "--no-sandbox",
                    "--use-angle=metal", f"--screenshot={out}",
                    "--window-size=960,540", "--hide-scrollbars", f"file://{page}"],
                   capture_output=True, timeout=60)
    print("shot:", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
