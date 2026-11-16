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
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float mass;
uniform float disk;
uniform float tilt;
uniform float swirl;

// Singularity: a black hole with its accretion disk, seen through its own
// gravity. Nothing is faked in screen space: each pixel is a photon traced
// backwards through a Schwarzschild field (units: event horizon radius = 1,
// bending acceleration -1.5 h^2 x / r^5 with h the conserved angular
// momentum). The disk is the plane y = 0 between the innermost stable orbit
// and an outer rim; a ray may cross it several times, which is what draws the
// arch of the far side over the shadow and the thin photon ring. Relativistic
// beaming makes the side that spins toward us several times brighter. The
// kick sends a density wave outward through the disk and a pulse up the polar
// jets; the stars behind are bent by the same integration.

const float TAU = 6.2831853;
const float RIN = 2.6;
const float ROUT = 11.0;
const int STEPS = 72;

float h21(vec2 p) {
  return fract(sin(dot(p, vec2(41.31, 289.17))) * 43758.5453);
}

// value noise, periodic in y with integer period py
float vnY(vec2 p, float py) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float y0 = mod(i.y, py), y1 = mod(i.y + 1.0, py);
  return mix(mix(h21(vec2(i.x, y0)), h21(vec2(i.x + 1.0, y0)), f.x),
             mix(h21(vec2(i.x, y1)), h21(vec2(i.x + 1.0, y1)), f.x), f.y);
}

float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
}

// stars + nebula for an escaped direction
vec3 sky(vec3 d) {
  vec2 s = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)));
  vec3 c = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float sc = k == 0 ? 38.0 : 85.0;
    vec2 g = s * sc;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float r = h21(id + float(k) * 17.0);
    vec2 o = (vec2(h21(id + 3.1), h21(id + 7.7)) - 0.5) * 0.7;
    float tw = 0.6 + 0.4 * sin(uTime * (1.0 + 3.0 * r) + r * 40.0) + uHigh * 0.8 * step(0.9, r);
    float st = step(0.86, r) * exp(-dot(f - o, f - o) * (90.0 + 160.0 * r)) * tw;
    c += mix(vec3(1.0), mix(uColor1, uColor3, fract(r * 9.0)), 0.45) * st * (k == 0 ? 1.6 : 0.7);
  }
  float n = vn(s * 2.2 + 3.0) * 0.6 + vn(s * 5.0 - 1.0) * 0.4;
  float bz = (d.y + 0.25 * sin(s.x * 2.0)) * 2.6; // pow() with a negative base is undefined
  float band = exp(-bz * bz);
  c += mix(uColor3, uColor2, n) * pow(n, 3.0) * band * 0.22;
  return c;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float t = uTime;
  float kick = clamp(uBassHit, 0.0, 1.0);
  float M = clamp(mass, 0.5, 2.0);
  float dk = clamp(disk, 0.0, 2.0);
  float sw = clamp(swirl, 0.0, 3.0);

  // camera: slow orbit, inclination from the tilt param, breathing with the bass
  float camR = 17.0 / M;
  float el = mix(0.045, 0.5, clamp(tilt, 0.0, 1.0)) + 0.03 * sin(t * 0.11);
  float az = t * 0.035 + uBassTime * 0.02;
  vec3 ro = camR * vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  float rl = 0.22 + 0.05 * sin(t * 0.07);          // dutch angle: the disk never sits flat
  vec2 q = vec2(p.x * cos(rl) - p.y * sin(rl), p.x * sin(rl) + p.y * cos(rl));
  vec3 vel = normalize(fw * (1.9 + 0.06 * kick) + rt * q.x + up * q.y);
  // per-pixel start jitter: step banding in jets/halo becomes fine grain
  vec3 pos = ro + vel * h21(gl_FragCoord.xy) * 0.35;

  vec3 hv = cross(pos, vel);
  float h2 = dot(hv, hv);

  vec3 col = vec3(0.0);
  float trans = 1.0;
  float jet = 0.0;
  float halo = 0.0;
  bool captured = false;

  // density wave of the kick: leaves the inner edge and runs to the rim
  float waveR = RIN + (1.0 - kick) * (ROUT - RIN) * 0.9;
  float rot = t * 0.22 * sw + uBassTime * 0.12 * sw;
  float bc = uBeatClock;

  for (int i = 0; i < STEPS; i++) {
    float r2 = dot(pos, pos);
    if (r2 < 1.0) { captured = true; break; }
    if (r2 > 420.0 && dot(pos, vel) > 0.0) break; // bending past r~20 is negligible
    float r = sqrt(r2);
    float dt = clamp(0.13 * r, 0.06, 2.2);
    float dAx = dot(pos.xz, pos.xz);
    // finer near the disk plane so crossings are located well (only within the disk's reach)
    if (dAx < ROUT * ROUT * 1.3) dt = min(dt, max(abs(pos.y) * 0.6, 0.07 + 0.02 * r));
    vec3 acc = -1.5 * h2 * pos / (r2 * r2 * r);
    vel += acc * dt;
    vec3 np = pos + vel * dt;

    // polar jets and the faint glow of the photon sphere
    if (dAx < 2.0) { // exp(-10) beyond
      float ay = abs(pos.y);
      float jp = 0.55 + 0.45 * sin(ay * 1.1 - bc * TAU * 0.5);
      jet += dt * exp(-dAx * (5.0 + 0.05 * ay * ay) - ay * 0.16) * smoothstep(1.0, 2.5, ay) * jp;
    }
    halo += dt / (r2 * r2);

    if (pos.y * np.y < 0.0 && trans > 0.02) {
      float f = pos.y / (pos.y - np.y);
      vec3 hp = mix(pos, np, f);
      float rr = length(hp.xz);
      if (rr > RIN && rr < ROUT) {
        float ph = atan(hp.z, hp.x);
        float u = ph / TAU;
        // two streak layers at different angular speeds: shear without a singularity
        float n1 = vnY(vec2(rr * 1.7, (u + rot * 0.11) * 48.0), 48.0);
        float n2 = vnY(vec2(rr * 2.7 + 7.0, (u + rot * 0.19) * 96.0), 96.0);
        float n3 = vnY(vec2(rr * 0.6 + 3.0, (u + rot * 0.05) * 12.0), 12.0);
        // concentric lanes: the disk is made of rings, not of fog
        float lane = vnY(vec2(rr * 2.6 + 11.0, 0.5), 4.0);
        float dens = 0.15 + 0.85 * n3 * n3;
        dens *= 0.12 + 1.5 * n1 * n1 * n1 + 0.9 * n2 * n2 * n1;
        dens *= 0.35 + 1.1 * lane * lane;
        dens *= 0.85 + 0.5 * uMid * n2;
        float rn = (rr - RIN) / (ROUT - RIN);
        float edge = smoothstep(0.0, 0.05, rn) * (1.0 - smoothstep(0.45, 1.0, rn));
        float heat = pow(RIN / rr, 2.2);
        // beaming: gas orbits counter-clockwise, vel is the traced (reversed) photon
        vec3 gv = vec3(-hp.z, 0.0, hp.x) / rr;
        float dop = 1.0 / (1.0 + 0.42 * dot(gv, normalize(vel)));
        dop = dop * dop * dop;
        vec3 hot = mix(uColor1, vec3(1.0, 0.96, 0.9), 0.55);
        vec3 dc = mix(hot, uColor1, smoothstep(0.0, 0.16, rn));
        dc = mix(dc, uColor2, smoothstep(0.1, 0.45, rn));
        dc = mix(dc, uColor3, smoothstep(0.3, 0.7, rn));
        float wx = (rr - waveR) * 1.3;
        float wv = exp(-wx * wx) * kick;
        float em = edge * dens * (0.6 + 5.0 * heat) * dop;
        em *= (0.35 + dk) * (0.8 + 0.5 * uBass + 0.6 * kick * heat);
        em += edge * wv * 2.2 * dop;
        vec3 e = dc * em + vec3(1.0) * edge * wv * 0.5;
        float a = clamp(edge * (0.2 + 0.9 * dens) * (0.55 + 0.4 * heat), 0.0, 0.95);
        col += trans * e * a;
        trans *= 1.0 - a;
      }
    }
    pos = np;
  }

  if (!captured) col += trans * sky(normalize(vel)) * (0.8 + 0.3 * uEnergy);

  // jets and photon haze; the shadow itself stays pure black, that is the picture
  if (!captured) {
    col += mix(uColor3, vec3(0.8, 0.9, 1.0), 0.35) * jet * (0.3 + 0.3 * dk) * (0.5 + 0.6 * uBass + 0.9 * kick);
    col += mix(uColor1, uColor2, 0.5) * pow(min(halo, 0.6) / 0.6, 2.0) * 0.3 * (0.5 + 0.5 * kick) * 0.5;
  }

  // floor: the disk never goes fully dark on silence (0.35 + dk above), plus a breath of colour
  col += uColor3 * 0.006;

  col = col / (1.0 + 0.35 * col);
  col *= clamp(1.15 - dot(p, p) * 0.55, 0.5, 1.0);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
