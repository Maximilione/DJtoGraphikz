precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uBassTime;
uniform float uBeatClock;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float density;
uniform float wave;
uniform float mirror;
uniform float glow;

// Lamp Forest: an endless mirrored room hung with lamps at different heights,
// in the spirit of immersive light installations (only the idea; the maths is
// ours). Domain repetition on XZ gives one lamp per cell, jittered so it is
// not a rigid grid. Floor and ceiling are mirrors done with a periodic fold of
// y, so the reflections come for free in the same march. On every beat a lamp
// near the camera is the origin of a chain reaction: the lamp at grid distance
// r lights up when the front (cells per beat) reaches it, in closed form from
// the beat clock (no state), and its colour drifts with the front. Glow is
// accumulated along the march so far lamps stay as halos in the dark.

const float H = 4.0;
const float TAU = 6.2831853;

float gC;       // cell size
float gWv;      // wave speed, cells per beat (clamped)
vec2 gO;        // camera position in cell coordinates (continuous)
vec2 gFw;       // camera heading on XZ (unit)
vec2 gId = vec2(1.0e9);
vec3 gEm;

float hash11(float n) {
  return fract(sin(n * 127.1 + 31.7) * 43758.5453);
}
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
vec2 hash22(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

// three-stop cyclic palette from the scene colours
vec3 palette3(float t) {
  t = fract(t) * 3.0;
  if (t < 1.0) return mix(uColor1, uColor2, smoothstep(0.0, 1.0, t));
  if (t < 2.0) return mix(uColor2, uColor3, smoothstep(0.0, 1.0, t - 1.0));
  return mix(uColor3, uColor1, smoothstep(0.0, 1.0, t - 2.0));
}

float sdSeg(vec3 p, vec3 a, vec3 b) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// emission colour of the lamp in cell id (cached per cell along the ray)
vec3 lampEm(vec2 id) {
  if (id == gId) return gEm;
  vec2 idw = mod(id, 16.0);
  float hh = hash21(idw);
  float lit = 0.0;
  float bc = floor(uBeatClock);
  float fb = uBeatClock - bc;
  for (int j = 0; j < 3; j++) {
    float kN = bc - float(j);
    // origin a few cells ahead of the camera (continuous, so it never jumps
    // when the camera crosses a cell), randomised per beat
    vec2 o = gO + gFw * 3.0 + floor((hash22(vec2(mod(kN, 997.0), 7.0)) - 0.5) * 8.0);
    float tau = (uBeatClock - kN) * gWv;
    float dist = length(id - o) + hh * 0.7;
    float x = tau - dist;
    // amplitudes chain continuously: j0 -> j1 -> j2 keep 0.55 at the hand-over,
    // the oldest wave fades out over its last beat instead of popping off
    float amp = (j == 0) ? 0.55 + 0.45 * uBassHit : ((j == 1) ? 0.55 : 0.55 * (1.0 - fb));
    lit += smoothstep(0.0, 0.6, x) * exp(-max(x, 0.0) * 0.35) * amp;
  }
  float L = 0.15 + 0.25 * uBass + lit * 1.5;
  L *= 1.0 + uHigh * 0.4 * (hash21(idw + floor(uTime * 20.0)) - 0.5);
  // hue: spatial bands + a season every 8 bars, blended over the last beats
  float sb = uBeatClock / 32.0;
  float season = floor(sb) + smoothstep(0.88, 1.0, fract(sb));
  float hue = fract(hh * 0.3 + dot(id, vec2(0.037, 0.029)) + season * 0.37);
  vec3 col = palette3(hue);
  col = mix(col, vec3(1.0, 0.95, 0.85), clamp(lit * 0.5, 0.0, 0.8));
  gId = id;
  gEm = col * L;
  return gEm;
}

// lamp placement: centre of body in world space
vec3 lampPos(vec2 id) {
  vec2 idw = mod(id, 16.0);
  float hh = hash21(idw);
  vec2 jit = (hash22(idw + 3.7) - 0.5) * 0.5 * gC;
  float ly = 1.0 + 2.2 * hh;
  vec2 xz = (id + 0.5) * gC + jit;
  // keep a corridor over the camera path (eye at 1.6): lamps close to the
  // diagonal track are hung higher so the camera never flies through one
  float perp = abs(xz.x * 0.8087 - xz.y * 0.5882);
  ly = mix(max(ly, 2.55), ly, smoothstep(0.45, 0.95, perp));
  xz.x += 0.08 * uBass * sin(uTime * 1.3 + hh * 20.0);
  return vec3(xz.x, ly, xz.y);
}

// x: body, y: cap, z: cable
vec3 lampD(vec3 p, vec2 id) {
  vec3 c = lampPos(id);
  vec3 q = p - c;
  vec3 r = vec3(0.18, 0.225, 0.18);
  float k0 = length(q / r);
  float k1 = length(q / (r * r));
  float body = k0 * (k0 - 1.0) / max(k1, 1.0e-4);
  vec3 qc = q - vec3(0.0, 0.26, 0.0);
  vec2 w = vec2(length(qc.xz) - 0.07, abs(qc.y) - 0.04);
  float cap = min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
  vec2 idw = mod(id, 16.0);
  vec2 aj = (hash22(idw + 3.7) - 0.5) * 0.5 * gC;
  vec3 anchor = vec3((id.x + 0.5) * gC + aj.x, H, (id.y + 0.5) * gC + aj.y);
  float cab = sdSeg(p, c + vec3(0.0, 0.3, 0.0), anchor);
  return vec3(body, cap, cab);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = vec2((uv.x - 0.5) * uResolution.x / uResolution.y, uv.y - 0.5);

  float dens = clamp(density, 0.5, 2.0);
  gC = 2.2 * dens;
  gWv = clamp(wave, 0.25, 4.0);
  float g = max(glow, 0.02);
  bool mir = mirror > 0.5;

  // camera: slow diagonal drift, periodic (multiple of the 16-cell hash period)
  float t = mod(uTime * 0.4 + uBassTime * 0.1, 320.0 * gC);
  vec3 ro = vec3(t * 0.4, 1.6, t * 0.55);
  float yaw = 0.63 + 0.3 * sin(mod(uTime * 0.05, TAU));
  float pitch = 0.12;
  vec3 fw = normalize(vec3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)));
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(p.x * rt + p.y * up + fw * 1.0);
  gO = ro.xz / gC - 0.5;
  gFw = normalize(fw.xz);

  // lamps sit at least this far inside their cell: bounds the step so a ray
  // never skips a lamp in a cell the 2-lamp SDF does not evaluate
  float margin = max(0.25 * gC - 0.27, 0.01);
  vec2 ird = 1.0 / max(abs(rd.xz), vec2(1.0e-4));

  // per-pixel dither of the start hides the step banding of the halo
  float tt = 0.02 + 0.08 * hash21(gl_FragCoord.xy);
  vec3 halo = vec3(0.0);
  float cable = 0.0;
  bool hit = false;
  float hitPart = 0.0;
  vec2 hitId = vec2(0.0);
  vec3 hitLocal = vec3(0.0);
  float hitK = 1.0;
  float hitSy = 1.0;
  float gl = g * (1.0 + 0.2 * uHigh);

  for (int i = 0; i < 40; i++) {
    vec3 q3 = ro + rd * tt;
    float kR;
    float yf;
    float sy;
    if (mir) {
      kR = pow(0.55, abs(floor(q3.y / H)));
      float m = mod(q3.y, 2.0 * H);
      yf = H - abs(m - H);
      sy = m < H ? 1.0 : -1.0;
    } else {
      kR = q3.y < 0.0 ? 0.55 : 1.0;
      yf = abs(q3.y);
      sy = q3.y < 0.0 ? -1.0 : 1.0;
    }
    vec3 ps = vec3(q3.x, yf, q3.z);
    vec2 id0 = floor(ps.xz / gC);
    vec2 f = ps.xz / gC - id0 - 0.5;
    vec2 id1 = id0 + (abs(f.x) > abs(f.y) ? vec2(f.x >= 0.0 ? 1.0 : -1.0, 0.0) : vec2(0.0, f.y >= 0.0 ? 1.0 : -1.0));
    vec3 a = lampD(ps, id0);
    vec3 b = lampD(ps, id1);
    float dA = min(a.x, a.y);
    float dB = min(b.x, b.y);
    float d = min(dA, dB);
    bool useA = dA <= dB;
    vec2 idn = useA ? id0 : id1;

    if (d < 0.002 * tt + 0.001) {
      hit = true;
      vec3 av = useA ? a : b;
      hitPart = av.y < av.x ? 1.0 : 0.0;
      hitId = idn;
      hitLocal = ps - lampPos(idn);
      hitK = kR;
      hitSy = sy;
      break;
    }

    // step: sphere tracing, slowed near the cable, bounded by the cell exit
    float dc = min(a.z, b.z);
    float cw = max(0.02, tt * 0.002);   // cable width ~2 px: no far aliasing
    vec2 fc = fract(ps.xz / gC);
    vec2 tex = vec2(rd.x > 0.0 ? 1.0 - fc.x : fc.x, rd.z > 0.0 ? 1.0 - fc.y : fc.y) * gC * ird;
    float ds = clamp(min(d * 0.9, dc + cw), 0.02, 0.5 * gC);
    ds = min(ds, max(min(tex.x, tex.y), 0.0) + margin);

    // halo: tight core + broad soft light, integrated along the step; far
    // light is only partly attenuated so the forest stays lit in the depth
    vec3 em = lampEm(idn);
    float hl = exp(-d * 12.0 / gl) + 0.06 * gl / (1.0 + 8.0 * d * d);
    halo += em * kR * hl * ds * (0.55 + 0.45 * exp(-tt * 0.03));
    cable += kR * 0.0008 / (dc * dc + cw * cw) * (cw / 0.02) * ds * 3.0 * exp(-tt * 0.03);

    tt += ds;
    if (tt > 40.0) break;
  }

  // deep background, never pure black
  vec3 col = mix(uColor2 * 0.02, vec3(0.0), clamp(p.y + 0.5, 0.0, 1.0));

  if (hit) {
    vec3 em = lampEm(hitId);
    vec3 r = vec3(0.18, 0.225, 0.18);
    vec3 nb = normalize(hitLocal / (r * r) + vec3(0.0, 1.0e-4, 0.0));
    vec3 rdf = vec3(rd.x, rd.y * hitSy, rd.z);   // ray direction in the folded room
    float fres = pow(1.0 - clamp(dot(nb, -rdf), 0.0, 1.0), 3.0);
    vec3 surf;
    if (hitPart < 0.5) {
      // opalescent: bright milky core, lighter rim
      surf = em * 1.6 * (0.75 + 0.5 * fres) + vec3(1.0, 0.95, 0.85) * em * 0.25 * fres;
    } else {
      // dark metal cap catching a reflection of the lamp itself
      surf = uColor1 * 0.03 + em * (0.25 + 0.5 * fres);
    }
    col = surf * hitK;
    col *= exp(-tt * 0.03);
  }

  // mirror tile joints on the first floor/ceiling crossing: makes the mirror readable
  float tc = 1.0e5;
  if (rd.y < -1.0e-3) tc = (0.0 - ro.y) / rd.y;
  else if (rd.y > 1.0e-3 && mir) tc = (H - ro.y) / rd.y;
  if (tc < tt) {
    vec3 pc = ro + rd * tc;
    vec2 fxz = abs(fract(pc.xz / gC) - 0.5);
    float e = 0.5 - max(fxz.x, fxz.y);
    float line = exp(-e * 60.0);
    col += uColor2 * line * 0.12 * exp(-tc * 0.08) * (0.5 + 0.5 * uEnergy);
  }

  col += halo;
  col += cable * (uColor3 * 0.5 + 0.1) * (0.35 + 0.3 * uEnergy + 0.25 * uMid);

  // tonemap and vignette
  col = 1.0 - exp(-col * 1.1);
  col *= 1.0 / (1.0 + 0.5 * dot(p, p));
  col = max(col, vec3(0.0));
  gl_FragColor = vec4(col, 1.0);
}
