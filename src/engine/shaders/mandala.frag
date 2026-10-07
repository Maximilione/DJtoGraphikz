precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float symmetry;
uniform float ringfreq;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

// One mandala layer in the kaleidoscope-folded plane. Returns
// x = lines (petal edges, rings, flow), y = dots, z = spokes + lattice.
vec3 mandalaLayer(vec2 uv, float folds, float rt, float t) {
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float foldAngle = TAU / folds;
  float fa = mod(a + rt, foldAngle);
  if (fa > foldAngle * 0.5) fa = foldAngle - fa;
  float k = cos(fa * folds); // 1 on the spoke, -1 on the fold edge
  vec2 p = r * vec2(cos(fa), sin(fa));

  // Concentric petal rings: radius is modulated by the fold, so each ring
  // becomes a scalloped garland.
  float lines = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float rr = r - (0.10 + fi * 0.11 + uBeat * 0.015 * (fi + 1.0) + uBassHit * 0.02 * fi)
                 - 0.035 * k * (0.5 + fi * 0.3);
    float d = abs(rr);
    lines += (exp(-d * 85.0) + 0.25 * exp(-d * 18.0)) * (0.45 + 0.1 * fi);
  }

  // Big lotus petal outline
  float pd = abs(r - (0.5 + 0.13 * k + 0.04 * uBass));
  lines += exp(-pd * 110.0) * 1.1 + 0.2 * exp(-pd * 14.0);

  // Flowing ring bands (ringfreq), gated by the petal shape
  float flow = smoothstep(0.78, 1.0, sin(r * ringfreq - t * 2.0 - uBass * 5.0));
  lines += flow * (0.35 + 0.35 * k);

  // Jewels: dots on the middle of each half-fold
  float dots = 0.0;
  float fb = foldAngle * 0.25;
  for (int i = 1; i < 6; i++) {
    float fi = float(i);
    float R = fi * 0.12 + uBeat * 0.02 * fi + uBassHit * 0.03 * fi;
    vec2 c = R * vec2(cos(fb), sin(fb));
    vec2 q = p - c;
    dots += 0.0004 / (dot(q, q) + 0.0004) * (1.2 - 0.12 * fi);
  }

  // Spokes: thicker/sharper with the highs, fold edges are the weak ones
  float swd = 60.0 + uHigh * 120.0;
  float spokes = exp(-r * fa * swd) + 0.5 * exp(-r * (foldAngle * 0.5 - fa) * swd);
  float spokeMask = smoothstep(0.04, 0.3, r) * (1.0 - smoothstep(0.4, 0.95, r));
  float lat = smoothstep(0.78, 1.0, sin(p.x * 26.0 + t * 2.0) * sin(p.y * 26.0 - t * 1.5)) * 0.3;

  return vec3(lines, dots, spokes * spokeMask * 0.8 + lat * (1.0 - smoothstep(0.3, 0.9, r)));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime * 0.3;

  // The kick punches the whole mandala toward the camera
  uv *= 1.0 - 0.07 * uBassHit - 0.03 * uBass;

  float r = length(uv);
  float a = atan(uv.y, uv.x);

  float folds = max(floor(symmetry + uMid * 6.0), 3.0);

  float rt = t * 0.2 + uBassTime * 0.03;
  vec3 front = mandalaLayer(uv, folds, rt, t);
  // Back layer: bigger, counter-rotating, dimmer: parallax depth
  vec3 back = mandalaLayer(uv * 1.7 * rot(-t * 0.15), folds, -rt * 0.6, t * 0.6);

  float hueP = r * 3.0 + a / TAU + t * 0.2 + uHigh;
  vec3 ca = mix(uColor1, uColor2, sin(hueP * TAU) * 0.5 + 0.5);
  vec3 cb = mix(uColor2, uColor3, sin(hueP * TAU + TAU / 3.0) * 0.5 + 0.5);
  vec3 hot = mix(uColor3, vec3(1.0), 0.6);

  vec3 color = vec3(0.0);
  color += ca * front.x + hot * front.y * 0.9 + cb * front.z;
  color += (cb * back.x + ca * back.y * 0.6 + uColor3 * back.z) * 0.4 * (1.0 - 0.5 * smoothstep(0.2, 0.9, r));

  // Kick shockwave: a bright ring travelling outward while the hit decays
  float sr = 0.12 + 0.85 * (1.0 - uBassHit);
  float sw = (r - sr) * 16.0;
  color += mix(uColor3, vec3(1.0), 0.45) * exp(-sw * sw) * uBassHit * 1.3;

  // Breathing
  color *= 1.0 + sin(t * 2.0 + uBass * 3.0) * 0.12 + uBeat * 0.35 + uBassHit * 0.35;

  // Center eye: soft halo, white-hot core and a ring that jumps on the kick
  color += mix(uColor1, uColor2, 0.5) * exp(-r * 8.0) * (0.3 + uBeat * 1.0);
  color += vec3(1.0) * exp(-r * r * 280.0) * (0.35 + 1.4 * uBassHit);
  float er = (r - 0.07 - 0.03 * uBassHit) * 90.0;
  color += uColor3 * exp(-er * er) * (0.3 + 0.7 * uBassHit);

  // Dark but never black: faint palette haze
  color += mix(uColor1, uColor3, r) * (0.035 + 0.03 * uEnergy) * (1.2 - r);

  color *= smoothstep(1.05, 0.3, r);

  color = vec3(1.0) - exp(-color * 1.35);
  gl_FragColor = vec4(color, 1.0);
}
