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

uniform float power;
uniform float zoom;
uniform float glow;

// Mandelbulb: the 3D fractal raymarched with the distance estimator, 64 steps
// at most. The camera orbits it and keeps diving towards the surface and back
// out (focal length grows exponentially, the hit threshold follows the pixel
// footprint, so the zoom keeps finding new detail). The colour is an orbit
// trap: the closest approach of the iteration to each of the three axis
// planes picks the palette colour, so the bulb is painted by its own
// structure. The power breathes slowly and on the kick; the kick also flares
// the aura. Misses are never black: the closest approach to the set becomes a
// halo over a dark palette gradient.

vec3 gTrap;
float gPow;

float map(vec3 p) {
  vec3 z = p;
  float dr = 1.0;
  float r = length(z);
  gTrap = vec3(1e3);
  for (int i = 0; i < 7; i++) {
    r = length(z);
    if (r > 2.0) break;
    float th = acos(clamp(z.z / max(r, 1e-4), -1.0, 1.0));
    float ph = atan(z.y, z.x);
    dr = pow(r, gPow - 1.0) * gPow * dr + 1.0;
    float zr = pow(r, gPow);
    th *= gPow;
    ph *= gPow;
    z = zr * vec3(sin(th) * cos(ph), sin(ph) * sin(th), cos(th)) + p;
    gTrap = min(gTrap, abs(z));
  }
  return 0.5 * log(max(r, 1e-4)) * r / dr;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float kick = clamp(uBassHit, 0.0, 1.0);
  gPow = clamp(power, 3.0, 10.0) + 0.9 * sin(uTime * 0.11 + uBassTime * 0.12) + 0.5 * kick;

  float orb = uBassTime * 0.15 + uTime * 0.06;
  float el = 0.45 * sin(uTime * 0.05 + uBassTime * 0.04) + 0.15;
  vec3 ro = 2.4 * vec3(cos(orb) * cos(el), sin(el), sin(orb) * cos(el));
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  // ping-pong dive: 0 at the far view, 1 deep in the detail
  float dive = 0.5 - 0.5 * cos(uTime * 0.06 + uBassTime * 0.05);
  float f = 1.3 * clamp(zoom, 0.5, 2.0) * exp(2.2 * dive * dive);
  vec3 rd = normalize(uv.x * rt + uv.y * up + f * fw);

  float mind = 10.0;
  float t = 0.5;
  bool hit = false;
  int steps = 0;
  for (int i = 0; i < 64; i++) {
    float d = map(ro + rd * t);
    mind = min(mind, d / t);
    steps = i;
    if (d < 0.35 * t / (uResolution.y * f)) { hit = true; break; }
    t += d * 0.9;
    if (t > 6.0) break;
  }

  float rr = length(uv);
  vec3 col = mix(uColor2 * 0.10, uColor1 * 0.06, smoothstep(0.0, 1.0, rr)) * (1.0 + 0.4 * uBass);
  col += uColor1 * clamp(glow, 0.3, 2.0) * 0.05 / (mind * 6.0 + 0.04) * (0.6 + 0.8 * kick + 0.4 * uEnergy);

  if (hit) {
    vec3 p = ro + rd * t;
    float e = 0.5 * t / (uResolution.y * f);
    vec2 k = vec2(1.0, -1.0);
    vec3 n = normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                       k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
    map(p); // refresh the orbit trap at the hit point
    vec3 w = exp(-gTrap * vec3(2.2, 3.0, 4.2));
    w /= (w.x + w.y + w.z + 1e-3);
    vec3 base = uColor1 * w.x * 1.2 + uColor2 * w.y * 1.4 + uColor3 * w.z * 1.2 + uColor2 * 0.12;
    float ao = clamp(1.0 - float(steps) / 64.0, 0.0, 1.0);
    ao = ao * ao * 0.8 + 0.2;
    vec3 L = normalize(vec3(0.6, 0.8, 0.4) + 0.3 * rt);
    float dif = max(dot(n, L), 0.0);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    vec3 surf = base * (0.25 + 0.9 * dif) * ao
              + uColor3 * rim * (0.5 + 0.9 * kick + 0.6 * uHigh) * glow
              + uColor1 * pow(max(dot(reflect(rd, n), L), 0.0), 24.0) * 0.5;
    col = mix(col, surf, exp(-max(t - 1.2, 0.0) * 0.25));
  }

  col = col / (1.0 + 0.45 * col);
  col *= clamp(1.25 - dot(uv, uv) * 0.7, 0.45, 1.0);
  gl_FragColor = vec4(col, 1.0);
}
