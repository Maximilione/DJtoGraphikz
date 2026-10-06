precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform sampler2D tImgs;   // atlas 4x2 of square cells, each image letterboxed (contain) with alpha
uniform float uImgCount;   // 0 = no user image: procedural glyph
uniform float rhythm;
uniform float style;
uniform float size;
uniform float punch;
uniform float spin;

// Image on the beat: the user's pictures (logo, flyer, photo) hit the screen
// on a rhythm (beat, 2 beats, bar, syncopated 3-3-2, kick only) with a punch of
// scale and a flash inside the image shape, then decay and leave the palette
// background (tunnel / floor grid / fog, one per four bars) to breathe: image
// and visual alternate. With several images they cycle on every hit. Styles:
// pulse, negative, duotone, RGB-split glitch, 4-way mirror, zoom-through
// tunnel, strobe. Without images a procedural glyph takes their place.
// Everything runs on uBeatClock, so it moves in silence too; the strobe is
// two pulses per hit and the frame is capped below white.

const float TAU = 6.2831853;

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453); }

vec2 rot(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// Procedural default picture: a diamond inside a ring (even) or a ring with a cross (odd)
vec4 glyph(vec2 q, float id) {
  float r = length(q);
  float ring = 1.0 - smoothstep(0.0, 0.03, abs(r - 0.82) - 0.06);
  float shape;
  if (mod(id, 2.0) < 0.5) {
    shape = 1.0 - smoothstep(0.0, 0.03, abs(abs(q.x) + abs(q.y) - 0.5) - 0.07);
    shape = max(shape, 1.0 - smoothstep(0.0, 0.03, r - 0.1));
  } else {
    shape = 1.0 - smoothstep(0.0, 0.03, min(abs(q.x - q.y), abs(q.x + q.y)) - 0.06);
    shape *= 1.0 - smoothstep(0.55, 0.6, r);
  }
  float a = max(ring, shape);
  vec3 c = mix(uColor1, uColor2, clamp(q.y * 0.5 + 0.5, 0.0, 1.0));
  return vec4(mix(c, vec3(1.0), 0.45), a);
}

vec4 getImg(vec2 q, float id) {
  if (uImgCount < 0.5) return glyph(q, id);
  float n = uImgCount;
  float cell = mod(mod(id, n) + n, n);
  vec2 c = vec2(mod(cell, 4.0), floor(cell / 4.0));
  vec2 inside = step(abs(q), vec2(1.0));
  vec2 qc = clamp(q, -0.995, 0.995);
  vec4 t = texture2D(tImgs, (c + vec2(qc.x * 0.5 + 0.5, 0.5 - qc.y * 0.5)) / vec2(4.0, 2.0));
  return vec4(t.rgb, t.a * inside.x * inside.y);
}

// Palette background: tunnel, perspective grid or fog, switching every 4 bars
vec3 background(vec2 p, float variant) {
  float t = uBeatClock;
  float r = length(p);
  vec3 base = mix(uColor3 * 0.22, uColor2 * 0.3, smoothstep(1.4, 0.0, r)) + 0.04;
  vec3 c = base;
  if (variant < 0.5) {
    float z = 0.35 / (r + 0.06) + t * 0.5;
    float ring = pow(abs(sin(z * 3.14159)), 14.0);
    float a = atan(p.y, p.x);
    float spoke = pow(abs(sin(a * 8.0 + uTime * 0.2 + z * 0.4)), 24.0);
    c += uColor1 * ring * (0.55 + 0.5 * uBass) * smoothstep(0.0, 0.5, r);
    c += uColor2 * spoke * 0.35 * smoothstep(0.1, 0.9, r);
  } else if (variant < 1.5) {
    float ay = max(abs(p.y), 0.03);
    float z = 0.5 / ay;
    vec2 g = vec2(p.x * z * 0.8, z * 0.5 + t * 0.5);
    vec2 f = abs(fract(g) - 0.5);
    float line = smoothstep(0.47, 0.5, max(f.x, f.y));
    c += mix(uColor1, uColor2, step(0.0, p.y)) * line * smoothstep(0.0, 0.5, abs(p.y)) * (0.6 + 0.5 * uBass);
  } else {
    float n = sin(p.x * 2.6 + uTime * 0.4) + sin(p.y * 3.4 - uTime * 0.5)
            + sin(r * 5.0 - uTime * 0.8 - t * 0.5) + sin((p.x + p.y) * 2.0 + t * 0.25);
    float w = 0.5 + 0.25 * n;
    c += mix(uColor1, uColor2, clamp(w, 0.0, 1.0)) * (0.2 + 0.3 * w + 0.2 * uEnergy);
  }
  return c;
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  p.x *= uResolution.x / uResolution.y;

  // ---- rhythm: tick index, phase inside the tick (0 at the hit) and decay ----
  float bc = max(uBeatClock, 0.0);
  float rh = floor(rhythm + 0.5);
  float idx, ph, env;
  if (rh < 0.5) {
    idx = floor(bc); ph = fract(bc);
  } else if (rh < 1.5) {
    idx = floor(bc * 0.5); ph = fract(bc * 0.5);
  } else if (rh < 2.5) {
    idx = floor(bc * 0.25); ph = fract(bc * 0.25);
  } else if (rh < 3.5) {
    // 3-3-2 over eight eighth notes
    float e8 = bc * 2.0;
    float pos = mod(e8, 8.0);
    float k = pos < 3.0 ? 0.0 : (pos < 6.0 ? 1.0 : 2.0);
    float st = k < 2.0 ? k * 3.0 : 6.0;
    float len = k < 2.0 ? 3.0 : 2.0;
    idx = floor(e8 / 8.0) * 3.0 + k;
    ph = (pos - st) / len;
  } else {
    idx = floor(bc); ph = 0.0;
  }
  if (rh < 3.5) {
    env = pow(1.0 - ph, 2.5);
  } else {
    // kick only; a soft hit on the bar keeps the picture alive in silence
    env = clamp(max(clamp(uBassHit, 0.0, 1.0), 0.3 * pow(1.0 - fract(bc * 0.25), 3.0)), 0.0, 1.0);
    ph = 1.0 - pow(env, 0.4);
  }

  float vis = smoothstep(0.72, 0.36, ph);
  float sty = floor(style + 0.5);
  if (sty > 5.5) vis *= step(0.5, fract(ph * 2.0 + 0.25)) * 0.85 + 0.15;

  vec3 bg = background(p, mod(floor(bc / 16.0), 3.0));

  float sc = max(size, 0.2) * (1.0 + 0.3 * punch * env);
  float ang = spin * (0.1 * sin(uTime * 0.6) + 0.17 * env * (mod(idx, 2.0) * 2.0 - 1.0));
  vec2 q = rot(p / sc, ang);

  vec4 im = vec4(0.0);
  float bgDim = 1.0 - 0.55 * vis;
  if (sty < 0.5) {
    im = getImg(q, idx);
  } else if (sty < 1.5) {
    im = getImg(q, idx);
    if (mod(idx, 2.0) > 0.5) im.rgb = 1.0 - im.rgb;
  } else if (sty < 2.5) {
    im = getImg(q, idx);
    float l = dot(im.rgb, vec3(0.299, 0.587, 0.114));
    im.rgb = l < 0.5 ? mix(uColor3 * 0.25, uColor1, l * 2.0) : mix(uColor1, uColor2 * 1.1, l * 2.0 - 1.0);
  } else if (sty < 3.5) {
    // horizontal slices shifted per slice, RGB split, both riding the hit
    float sl = floor(q.y * 11.0 + idx * 3.7);
    float tt = floor(uTime * 12.0);
    float h = hash11(sl + tt * 7.31);
    float off = (hash11(sl * 1.7 + tt) - 0.5) * step(0.45, h) * 0.6 * env * punch;
    float sp = 0.05 * env * punch + 0.006;
    vec4 a = getImg(q + vec2(off + sp, 0.0), idx);
    vec4 b = getImg(q + vec2(off, 0.0), idx);
    vec4 c = getImg(q + vec2(off - sp, 0.0), idx);
    im = vec4(a.r, b.g, c.b, max(a.a, max(b.a, c.a)));
  } else if (sty < 4.5) {
    // four mirrored copies, turning
    vec2 k = 2.0 * abs(q) - 1.0;
    im = getImg(k, idx);
  } else if (sty < 5.5) {
    // zoom-through: the picture repeats in perspective, each hit pulls one layer
    float f = idx + (1.0 - pow(1.0 - ph, 3.0));
    vec3 acc = bg * 0.6;
    for (int i = 4; i >= -1; i--) {
      float jd = floor(f) + float(i);
      float d = jd - f;
      float s = max(size, 0.2) * exp(-0.55 * d);
      float al = smoothstep(-1.0, -0.3, d) * smoothstep(4.5, 3.0, d);
      vec4 L = getImg(rot(p, ang) / s, jd);
      acc = mix(acc, L.rgb * (0.55 + 0.45 * al), L.a * al);
    }
    vis = 1.0;
    bgDim = 1.0;
    bg = acc;
    im = vec4(0.0);
  } else {
    im = getImg(q, idx);
  }

  vec3 col = bg * bgDim;
  float m = im.a * vis;
  vec3 flash = mix(uColor1, uColor2, 0.5) * (0.3 * punch * env + 0.1 * uBeat);
  col = mix(col, im.rgb * (0.85 + 0.15 * uEnergy) + flash * m, m);
  // never a flat white frame: cap the output
  col = min(col, vec3(0.92));
  gl_FragColor = vec4(col, 1.0);
}
