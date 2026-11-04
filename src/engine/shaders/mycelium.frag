precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBeatClock;
uniform float uBassHit;
uniform float uHighHit;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float density;
uniform float pulse;
uniform float glow;
uniform float grow;

// The palette as a loop, 1 → 2 → 3 → 1, with a plateau on each colour so the
// three read as three and not as their blends.
vec3 pal3(float x) {
  x = fract(x) * 3.0;
  float f = smoothstep(0.25, 0.75, fract(x));
  return x < 1.0 ? mix(uColor1, uColor2, f) : x < 2.0 ? mix(uColor2, uColor3, f) : mix(uColor3, uColor1, f);
}

// Mycelium: an open, branching bioluminescent network. The veins are the
// creases of a ridged multifractal (1-|2n-1|). Each crease is turned into a
// screen-space distance with fwidth, so a filament is a fixed number of
// pixels wide whatever its octave or the zoom (a plain pow() on the field
// gave ribbons as wide as the octave's cell, which read as plasma, not as
// hyphae). Finer octaves are gated by the distance to the coarser ridge, so
// hairs sprout from trunks instead of filling the screen. The domain is
// pre-bent by a low-frequency value noise warp. Kick light is a closed-form
// radial ring (from the beat clock, no state) multiplied by the vein mask, so
// it only runs along the filaments. Hash value noise, no textures. Written
// from the maths, nothing copied.

// The engine only injects LOOK for the mesh scene: on GLSL ES 3.00 an
// undefined macro inside #if is a compile error, so default it here.
#ifndef LOOK
#define LOOK 0
#endif

const float TAU = 6.2831853;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + vec2(17.3, 5.1))); }

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

const mat2 R = mat2(0.8253356, 0.5646425, -0.5646425, 0.8253356); // rot(0.6)

// Vein field. wc = trunk core width in px, wh = halo reach in px, px = pixel
// scale (1 at 540p). Returns core (thin lines), halo (wide soft glow) and
// node (where the trunk octave and the first branch octave cross). The
// domain is rotated before the first octave so the value-noise lattice never
// lines the veins up with the screen axes.
vec3 veins(vec2 q, float wc, float wh, float px) {
  float core = 0.0, halo = 0.0, node = 1.0;
  float amp = 1.0, gate = 1.0;
  q = R * q;
  for (int i = 0; i < 4; i++) {
    float n = vnoise(q);
    float fw = fwidth(n);
    // an octave whose ridges sit a few pixels apart is moire, not hyphae:
    // fade it out as its frequency approaches the pixel grid
    float fade = 1.0 - smoothstep(0.06, 0.16, fw);
    float rdg = 1.0 - abs(2.0 * n - 1.0);
    float d = (1.0 - rdg) / max(2.0 * fw, 1e-5);   // pixels to the crease
    float w = max(wc * amp, 0.9 * px);
    float c = exp(-d * d / (w * w)) * gate * fade;
    float h = exp(-d / (wh * amp)) * gate * fade;
    core = max(core, c * (0.45 + 0.55 * amp));   // hairs dimmer than trunks
    halo += h * amp;
    if (i < 2) node *= exp(-d * d / (9.0 * w * w));
    // the next octave only lives near this ridge (plus a faint free web)
    gate *= min(1.0, exp(-d / (wh * amp * 3.0)) + 0.07);
    q = R * q * 2.07 + vec2(1.7, 9.2);
    amp *= 0.7;
  }
  return vec3(core, halo, node);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float px = uResolution.y / 540.0;   // widths stay proportional at 1080p
#if LOOK == 1
  // roots: pulses rise from the bottom, the net drifts upward
  float r = p.y + 0.5;
#else
  float r = length(p);
#endif

  // Drift. The slow part runs on uTime (continuous, only fed to cos/sin);
  // the beat-locked part is a closed loop of exactly 256 beats, so the
  // mod() wrap of the beat clock is invisible (a linear mod term would make
  // the whole network jump every 256 beats).
  float tg = uTime * 0.01 * grow;
  float bph = mod(uBeatClock, 256.0) * (TAU / 256.0);
  vec2 dw = vec2(cos(tg * 0.7), sin(tg * 0.5)) * 0.6
          + vec2(cos(bph), sin(2.0 * bph)) * 0.35 * grow;
#if LOOK == 1
  dw.y -= tg * 0.8;
#endif
  // wrapped clock for the fast oscillators (sin(uTime*40) loses precision
  // after hours); 5*TAU keeps both 40x and 6x periodic across the wrap
  float tm = mod(uTime, 5.0 * TAU);

  // organic warp
  vec2 w = vec2(vnoise(p * 0.9 + dw), vnoise(p * 0.9 + vec2(4.1, 7.3) - dw)) - 0.5;
  w += 0.5 * (vec2(vnoise(p * 1.9 - dw * 1.3), vnoise(p * 1.9 + vec2(9.2, 1.7) + dw)) - 0.5);
  vec2 pw = p * density + w * (1.3 + 0.35 * uBass);

  // seed shifts every 16 beats, crossfaded over the last 2
  float bc = max(uBeatClock, 0.0);
  float s0 = floor(bc / 16.0);
  float xf = smoothstep(14.0, 16.0, mod(bc, 16.0));
  s0 = mod(s0, 64.0);
  float s1 = mod(s0 + 1.0, 64.0); // wraps with s0, no jump at beat 1024

  // bass swells the trunks, the kick widens them for an instant; glow and
  // bass push the halo further out
  float wc = (2.0 + 1.6 * uBass + 1.4 * uBassHit) * px;
  float wh = (10.0 + 14.0 * glow) * (0.7 + 0.5 * uBass) * px;
  vec3 vn = veins(pw + s0 * vec2(13.1, 7.7), wc, wh, px);
  if (xf > 0.0) {   // uniform branch: xf depends on the beat clock alone
    vn = mix(vn, veins(pw + s1 * vec2(13.1, 7.7), wc, wh, px), xf);
  }
  float core = vn.x;
  float halo = vn.y;
  float mask = max(core, halo * 0.6);
  // thin-vein shimmer from the highs
  core *= 1.0 + 0.5 * uHigh * (0.5 + 0.5 * sin(tm * 40.0 + pw.x * 6.0 + pw.y * 5.0));

  // light pulses: three closed-form rings, one per beat
  float rn = r + 0.08 * (vnoise(pw * 0.5) - 0.5);
  float ringSum = 0.0;
  float ph = fract(uBeatClock);
  for (int j = 0; j < 3; j++) {
    float age = ph + float(j);
    float Rj = age * 0.55 * (0.6 + 0.4 * pulse);
    float d = (rn - Rj) / 0.06;
    float ring = exp(-d * d) * exp(-age * 0.9);
    // the kick boost fades to 1 by the end of the beat, so ring 0 hands
    // over to ring 1 at the same brightness (no pop on every beat)
    if (j == 0) ring *= 1.0 + 0.8 * uBassHit * (1.0 - ph);
    ringSum += ring;
  }
  float lightPulse = ringSum * mask * pulse * 2.2;

  // nodes where the trunk and the first branches cross, flashed by the kick
  float node = vn.z * (0.35 + 1.6 * uBassHit);

  // spores
  vec2 g = p * 18.0 + vec2(0.0, mod(tg * 3.0, 256.0));
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(id);
  float spore = 0.0;
  if (h > 0.93) {
    vec2 o = (hash2(id) - 0.5) * 0.6;
    float d = length(f - o);
    spore = exp(-d * d * 900.0) * (0.5 + 0.5 * sin(tm * 6.0 + h * 40.0))
          * (0.3 + 1.2 * uHigh + 0.8 * uHighHit) * smoothstep(0.1, 0.5, mask);
  }

  // colour
  vec3 base = uColor3 * 0.02;
  // veins walk the whole palette, outward and with the phrase (was c1 → c2)
  vec3 veinCol = pal3(mod(uBeatClock, 32.0) / 32.0 + r * 0.25);
  // the halo floor keeps the net visible in silence, even at glow 0
  float haloK = (0.07 + 0.14 * glow) * (0.6 + 0.6 * uBass + 0.4 * uEnergy) + 0.03;
  vec3 col = base
    + veinCol * (core * 1.1 + halo * haloK)
    + mix(uColor2, vec3(1.0), 0.4) * lightPulse
    + mix(uColor3, vec3(1.0), 0.3) * node * 0.9
    + uColor2 * spore;
  col *= 1.0 / (1.0 + 0.8 * dot(p, p));
  col = log(1.0 + max(col, 0.0) * 1.2) * 0.9;
  gl_FragColor = vec4(col, 1.0);
}
