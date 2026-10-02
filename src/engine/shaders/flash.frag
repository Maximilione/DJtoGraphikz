precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float decay;
uniform float scan;
uniform float tint;

// Blackout strobe with structure. The frame is black; every kick fires a
// DIFFERENT shape of light, one per beat of the bar: radial blades, LED
// slats, shutter bars, a shock ring over a dot grid. A hard kick adds the
// blades on top, the downbeat swaps the lamp to the third palette colour.
// Dust hangs in the beam. The lamp lives only in the first quarter of each
// beat, so the wall always goes dark between hits.

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// 1 inside (d > 0), 0 outside, one pixel of ramp
float aa(float d) { float w = max(fwidth(d), 1e-4); return smoothstep(-w, w, d); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 c = (uv - 0.5) * vec2(1.78, 1.0);        // vignette: frame units
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);       // geometry: square units
  float r = length(q);
  float ps = 1.0 / uResolution.y;

  float gate = 1.0 - smoothstep(0.15, 0.25, uBeatPhase);
  float hit = pow(clamp(uBassHit, 0.0, 1.0), decay);
  float clock = pow(1.0 - uBeatPhase, decay * 2.0) * 0.3;
  float flash = max(hit, clock) * gate;
  float p = clamp(uBeatPhase / 0.25, 0.0, 1.0);  // life of the hit, 0..1
  float strong = smoothstep(0.7, 1.0, uBassHit);
  float b = floor(uBarPhase * 4.0 + 0.1);
  b = mod(b, 4.0);

  // --- shape 0: radial blades, rotating one turn per bar, random lengths
  float n = 16.0;
  float fa = atan(q.y, q.x) / 6.2831853 * n + uBarPhase * 4.0;
  float fw = ps / max(r, 0.02) * n / 6.2831853 * 1.2;
  float tri = abs(fract(fa) - 0.5);
  float bladeW = 0.20 - 0.10 * p;
  float blade = smoothstep(-fw, fw, bladeW - tri);
  float len = 0.45 + 0.9 * hash(vec2(floor(fa), 3.0));
  float rays = blade * smoothstep(len, len * 0.55, r) * (0.5 + 0.5 * smoothstep(0.0, 0.12, r));

  // --- shape 1: LED slats, random heights, shrinking as the hit dies
  float cols = floor(aspect * 14.0);
  float cx = uv.x * cols;
  float cid = floor(cx);
  float slatH = hash(vec2(cid, 5.0)) * (1.1 - 0.5 * p);
  float slats = aa(0.40 - abs(fract(cx) - 0.5)) * aa(slatH - abs(uv.y - 0.5) * 2.0);

  // --- shape 2: shutter bars, sliding in from alternating sides
  float rows = 9.0;
  float ry = uv.y * rows;
  float rid = floor(ry);
  float side = mod(rid, 2.0) < 0.5 ? uv.x : 1.0 - uv.x;
  float ext = (0.35 + 0.65 * hash(vec2(rid, 9.0))) * (1.15 - 0.55 * p);
  float bars = aa(0.06 + 0.22 * (1.0 - p) - abs(fract(ry) - 0.5)) * aa(ext - side);

  // --- shape 3: shock ring over an LED dot grid
  float R = p * 1.1;
  float wave = exp(-pow((r - R) * 7.0, 2.0));
  vec2 g = q * 16.0;
  float dd = length(fract(g) - 0.5);
  float dots = aa(0.10 + 0.32 * wave + 0.12 * (1.0 - p) - dd) * (0.35 + 0.65 * wave + 0.2 * (1.0 - r));
  float ring = aa(2.5 * ps - abs(r - R)) * (1.0 - p);
  float ringShape = max(dots, ring);

  float mask = b < 0.5 ? rays : (b < 1.5 ? slats : (b < 2.5 ? bars : ringShape));
  mask = max(mask, rays * strong * 0.3);

  // the downbeat is another colour
  vec3 lamp = mix(vec3(1.0), uColor1, tint);
  lamp = mix(lamp, mix(uColor3, vec3(1.0), 0.35), b < 0.5 ? 0.7 : 0.0);

  float vig = max(1.0 - dot(c, c) * 0.9, 0.0);
  float halo = exp(-r * 2.4);
  vec3 col = lamp * flash * vig * (mask * 1.1 + halo * 0.3 * (0.5 + uBass));
  // palette edge colour in the beam
  col += mix(uColor2, uColor3, 0.5 + 0.5 * sin(r * 6.0)) * flash * vig * mask * 0.25;

  // dust hanging in the beam: drifts up one cell-row loop per bar
  vec2 gd = vec2(uv.x * aspect, uv.y) * 34.0;
  gd.y += uBarPhase * 34.0;
  vec2 id = vec2(floor(gd.x), mod(floor(gd.y), 34.0));
  float jx = hash(id + 1.7), jy = hash(id + 8.3);
  float spark = step(0.86, hash(id));
  float mote = smoothstep(0.16, 0.0, length(fract(gd) - vec2(jx, jy) * 0.6 - 0.2));
  col += lamp * mote * spark * flash * vig * (0.45 + uHigh);

  // faint ghost of the shape and the filament: dark, not off
  col += lamp * vig * (0.035 + mask * 0.035);

  // one scan line per bar, with a glowing wake above it
  float dy = uv.y - (1.0 - uBarPhase);
  float line = (exp(-abs(dy) * 90.0) + 0.35 * exp(-max(dy, 0.0) * 14.0) * step(0.0, dy)) * scan;
  col += uColor2 * line * (0.5 + 0.5 * uHigh);

  col += vec3(hash(gl_FragCoord.xy + fract(uTime) * 17.0)) * 0.015;
  gl_FragColor = vec4(col, 1.0);
}
