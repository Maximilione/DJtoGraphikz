precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float count;
uniform float tentacles;
uniform float drift;
uniform float glow;

// The palette as a loop, 1 → 2 → 3 → 1, with a plateau on each colour so the
// three read as three and not as their blends.
vec3 pal3(float x) {
  x = fract(x) * 3.0;
  float f = smoothstep(0.25, 0.75, fract(x));
  return x < 1.0 ? mix(uColor1, uColor2, f) : x < 2.0 ? mix(uColor2, uColor3, f) : mix(uColor3, uColor1, f);
}

// Medusae: bioluminescent jellyfish drifting in a deep blue-black water, on
// four parallax depths. Pure 2D, no raymarch. Each layer is a grid of cells
// with at most one jellyfish per cell (hash spawn, jittered position). The
// animal sits in the upper part of its cell and its tentacles hang into the
// cells below, so a pixel only looks at its own cell and the two above (3 per
// layer). Bell = half ellipse with a wavy rim, tentacles = sine curves drawn
// as horizontal distance from x(y). Original maths and palette; the kick
// squeezes every bell and pushes it up, the beat clock keeps them breathing
// in silence, far layers lag behind the near ones so a wave crosses the depth.

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(5.2, 1.3);
    a *= 0.5;
  }
  return s;
}

// a sparse field of plankton motes, one candidate point per cell
float plankton(vec2 p, float scale, float seed, float tw) {
  vec2 g = p * scale;
  vec2 id = floor(g);
  float h = hash12(id + seed);
  if (h < 0.9) return 0.0;
  vec2 pos = vec2(hash12(id + seed + 1.7), hash12(id + seed + 4.1)) * 0.6 + 0.2;
  vec2 d = fract(g) - pos;
  float twinkle = 0.5 + 0.5 * sin(tw * (1.5 + 3.0 * h) + h * 60.0);
  return exp(-dot(d, d) * 90.0) * (0.35 + 0.65 * twinkle);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float tm = mod(uTime, 600.0);
  float T = tm * drift;
  float bc = mod(uBeatClock, 512.0);
  float cnt = clamp(count, 0.2, 1.0);
  float tl = clamp(tentacles, 0.5, 2.0);
  float gl = clamp(glow, 0.0, 2.0);

  // deep water: lighter towards the surface, with a slow low-res haze
  float fog = fbm3(p * 1.2 + vec2(0.0, -T * 0.05));
  // the water fills the frame, so it shades along the palette, 2 in the deep,
  // 3, then 1 near the surface, instead of being colour 3 everywhere
  vec3 water = pal3(0.45 + 0.45 * vUv.y + 0.06 * fog);
  vec3 col = water * mix(0.025, 0.10, vUv.y);
  col += water * 0.12 * fog * (1.0 + 1.2 * uBass);
  col += mix(uColor3, uColor2, 0.4) * 0.03 * pow(max(0.0, sin(p.x * 3.0 + fog * 2.0)), 8.0) * vUv.y * (1.0 + uMid);

  for (int L = 0; L < 4; L++) {
    float fl = float(L) / 3.0;                 // 0 far, 1 near
    float sc = mix(5.0, 1.6, fl);
    float lb = mix(0.30, 1.0, fl);
    float bl = mix(0.05, 0.008, fl);
    float lag = mix(0.4, 1.0, fl);             // far layers feel the kick less

    // one push per beat, continuous: a step that eases in, then stays
    float bcl = bc + fl * 0.15;
    float rise = 0.125 * floor(bcl) + 0.125 * smoothstep(0.0, 0.35, fract(bcl));
    vec2 q = p * sc + vec2(float(L) * 7.3, -T * mix(0.15, 0.4, fl) - rise);
    // cells further down the screen must not see a world that slides sideways
    q.x += 0.35 * sin(T * 0.15 + float(L) * 2.0) * (0.4 + fl);

    vec3 layerCol = vec3(0.0);
    float layerA = 0.0;

    // 3 rows: own cell + the two above, whose tentacles hang into this one
    // (long tentacles reach two cells down). Odd rows are shifted half a cell
    // so the animals never line up in a visible grid.
    for (int k = 0; k < 3; k++) {
      float idy = floor(q.y) + float(k);
      float sx = 0.5 * mod(idy, 2.0);
      vec2 id = vec2(floor(q.x + sx), idy);
      float h = hash12(id + float(L) * 31.0);
      if (h > cnt) continue;

      // everything (bell + halo) stays inside the cell's own column and below
      // its top edge: neighbours never evaluate this animal.
      vec2 center = id + vec2(0.5 - sx + (hash12(id + 3.1) - 0.5) * 0.24, 0.45 + 0.25 * hash12(id + 7.7))
                  + vec2(0.04 * sin(T * 0.6 + h * 20.0), 0.0);
      float rad = 0.24 * (0.8 + 0.4 * hash12(id + 9.0));
      vec2 lp = (q - center) / rad;
      vec2 fq = q - id + vec2(sx, 0.0);   // 0..1 inside the animal's cell
      if (abs(lp.x) > 2.4 || lp.y > 1.6 || lp.y < -2.6 * tl * 1.3) continue;

      // breathing: beat clock for the body, kick on top
      float ph = fract(bc + fl * 0.15 + h * 0.05);
      float env = exp(-ph * 5.0) * (0.5 + 0.9 * uBassHit);
      env = max(env, uBassHit * lag);

      float wx = 1.0 - 0.28 * env + 0.1 * uBass;
      float hy = 0.75 + 0.2 * env;
      vec2 e = vec2(lp.x / wx, lp.y / hy);
      float dBell = length(e) - 1.0;
      float rimY = -0.05 + 0.06 * sin(lp.x * 9.0 + uTime * 3.0);
      float cut = smoothstep(rimY - 0.03, rimY + 0.03, lp.y);
      float bw = min(bl * sc * 1.2, 0.35);
      float bellMask = smoothstep(bw, -0.0, dBell) * cut;
      float body = 0.25 + 0.5 * smoothstep(-1.0, 0.0, dBell);
      float fill = bellMask * body * (0.85 + 0.5 * uBass);

      float rim = exp(-abs(dBell) * 28.0) * cut * (0.6 + 1.2 * env) * gl;
      // lower lip, brighter than the dome so the silhouette closes
      rim += exp(-abs(lp.y - rimY) * 26.0) * smoothstep(0.1, -0.1, dBell) * (0.5 + 0.8 * env) * gl * 0.7;

      vec2 gq = lp - vec2(0.0, 0.25);
      float ang = atan(gq.y, abs(gq.x) + 1e-4);   // mirrored: symmetric gonads, no atan(0,0)
      float gon = smoothstep(0.35, 0.0, length(lp - vec2(0.0, 0.25)) - 0.15 - 0.05 * sin(ang * 4.0 + uTime)) * 0.5 * bellMask;
      gon *= 0.8 + 0.6 * uBass;

      // tentacles
      float tent = 0.0;
      float dots = 0.0;
      float y = -lp.y;
      if (y > 0.0) {
        for (int i = 0; i < 5; i++) {
          float fi = float(i);
          float x0 = (fi / 4.0 - 0.5) * 1.4 * wx;
          float len = 2.6 * tl * (0.7 + 0.5 * hash12(id + fi));
          if (y > len) continue;
          float u = y / len;
          float xc = x0 * (1.0 - 0.25 * u)
                   + 0.15 * y * sin(y * 2.3 - uTime * 2.2 + fi * 1.7 + h * 6.0) * (0.5 + 0.5 * u);
          float d = abs(lp.x - xc);
          float w = mix(0.06, 0.012, u);
          float m = smoothstep(w + bl * sc * 0.6, 0.0, d) * (1.0 - u);
          tent += m * 0.7;
          dots += m * smoothstep(0.85, 1.0, sin(y * 14.0 - uTime * 4.0 + fi * 2.0)) * uHigh * 1.5;
        }
      }
      tent = min(tent, 1.0);

      // each bell its own palette colour (colour 3 too: it was only the water)
      vec3 jc = pal3(hash12(id + 5.0));
      vec3 c = jc * (fill * 0.6 + gon * 0.7)
             + mix(jc, vec3(1.0), 0.3) * rim
             + jc * tent * 0.8
             + mix(jc, vec3(1.0), 0.6) * dots;
      float halo = exp(-max(dBell, 0.0) * 3.0) * 0.15 * gl * (0.8 + 0.5 * env);
      // fade the halo before the cell border, or its cut-off shows as a seam
      halo *= smoothstep(0.0, 0.15, fq.x) * smoothstep(1.0, 0.85, fq.x) * smoothstep(1.0, 0.85, fq.y);
      // soft fade under the rim: multiplying by `cut` drew a hard wavy line across the cell
      c += jc * halo * smoothstep(rimY - 0.6, rimY + 0.15, lp.y);

      // far layers fade into the water colour
      // far layers fade into the water colour. Was c * uColor3: a product of
      // two palette colours, black whenever they share no channel.
      c = mix(c * mix(0.35, 1.0, fl), mix(c, uColor3 * dot(c, vec3(0.3333)), 0.5) * 0.5, 1.0 - fl);
      float a = clamp(fill + tent * 0.6 + gon * 0.3 + rim * 0.5, 0.0, 1.0);
      layerCol += c;
      layerA = max(layerA, a);
    }
    // near ones cover the far ones, light still adds
    col = col * (1.0 - 0.45 * layerA * lb) + layerCol * lb;
  }

  // plankton motes drifting up, twinkling with the highs
  vec2 pp = p + vec2(0.03 * sin(T * 0.2), -T * 0.02);
  float pl = plankton(pp, 40.0, 11.0, uTime) + plankton(pp + 3.3, 70.0, 23.0, uTime * 1.3);
  col += mix(uColor2, vec3(1.0), 0.5) * pl * (0.3 + 1.2 * uHigh) * 0.6;

  float vig = 1.0 / (1.0 + 0.6 * dot(p, p));
  col *= vig * (1.0 + 0.25 * uBeat);
  col = clamp(col, 0.0, 2.0);
  gl_FragColor = vec4(col, 1.0);
}
