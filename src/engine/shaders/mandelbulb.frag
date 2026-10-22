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

// Mandelbulb: the 3D fractal raymarched with the distance estimator. The
// camera orbits it and keeps diving towards the surface and back out (focal
// length grows exponentially, the hit threshold follows the pixel footprint,
// so the zoom keeps finding new detail). The colour is an orbit trap: the
// closest approach of the iteration to each of the three axis planes picks
// the palette colour, so the bulb is painted by its own structure. The power
// breathes slowly and on the kick; the kick also flares the aura. Misses are
// never black: the closest approach to the set becomes a halo over a dark
// palette gradient.
//
// Budget (this is the heaviest effect in the set, drawn into a half-size
// buffer, see EFFECT_SHADERS): 48 march steps with a hit threshold of 1.5
// buffer pixels, the march confined to the set's bounding sphere (rays past
// it never march at all, rays through it stop at the far side instead of
// crawling to t=6), a tetrahedral 4-tap normal and a 2-tap occlusion. The
// formula keeps 7 iterations with a late bailout: fewer (5) looked the same
// from afar but the estimate had not converged on the smooth faces the dive
// gets close to, and the normals broke into contour rings there (the same
// rings the old step-count occlusion drew). Worst case 55 x 7 formula
// iterations per buffer pixel, as before, but on 2.25x fewer pixels and with
// far fewer steps per ray.

vec3 gTrap;
float gPow;

float map(vec3 p) {
  vec3 z = p;
  float dr = 1.0;
  float r = length(z);
  gTrap = vec3(1e3);
  for (int i = 0; i < 7; i++) {
    r = max(length(z), 1e-5);
    // bail out late (iq's 256 on r^2): at |z| = 2 the estimate still jumps
    // between escape bands, which drew contour rings over every smooth face
    // and flipped the normals along them
    if (r > 16.0) break;
    float th = acos(clamp(z.z / r, -1.0, 1.0)) * gPow;
    float ph = atan(z.y, z.x) * gPow;
    float rp = pow(r, gPow - 1.0);   // one pow: r^gPow is rp*r
    dr = rp * gPow * dr + 1.0;
    float st = sin(th);
    z = rp * r * vec3(st * cos(ph), st * sin(ph), cos(th)) + p;
    // the trap reads the first three orbits only: the later ones change
    // from pixel to pixel and painted the surface with speckle
    if (i < 3) gTrap = min(gTrap, abs(z));
  }
  return 0.5 * log(r) * r / dr;
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
  float f = 1.3 * clamp(zoom, 0.5, 2.0) * exp(1.5 * dive * dive);
  vec3 rd = normalize(uv.x * rt + uv.y * up + f * fw);

  // the set lives inside |p| < 2^(1/(power-1)): march only that stretch
  float RB = pow(2.0, 1.0 / (gPow - 1.0)) + 0.05;
  float bb = dot(ro, rd);
  float bh = bb * bb - dot(ro, ro) + RB * RB;

  float mind = 10.0;
  float t = 0.0;
  bool hit = false;
  // hit threshold in world units per unit distance: 1.5 buffer pixels (the
  // upscale blurs more than that; a tighter one only costs steps)
  float px = 1.5 / (uResolution.y * f);
  if (bh < 0.0) {
    // misses the sphere: the halo falls off with the miss distance
    float tc = max(-bb, 0.1);
    mind = (sqrt(dot(ro, ro) - bb * bb) - RB + 0.05) / tc;
  } else {
    float sh = sqrt(bh);
    t = max(-bb - sh, 0.0);
    float tEnd = -bb + sh;
    for (int i = 0; i < 48; i++) {
      float d = map(ro + rd * t);
      mind = min(mind, d / t);
      if (d < px * t) { hit = true; break; }
      t += d * 0.9;
      if (t > tEnd) break;
    }
  }
  // on a hit the loop broke right after map(ro + rd*t): this is the trap at
  // the hit point itself, kept before the normal taps overwrite it
  vec3 trapHit = gTrap;

  float rr = length(uv);
  vec3 col = mix(uColor2 * 0.12, uColor1 * 0.07, smoothstep(0.0, 1.0, rr)) * (1.0 + 0.4 * uBass);
  col += uColor1 * clamp(glow, 0.3, 2.0) * 0.05 / (mind * 6.0 + 0.04) * (0.6 + 0.8 * kick + 0.4 * uEnergy);

  if (hit) {
    vec3 p = ro + rd * t;
    float e = px * t;
    vec2 k = vec2(1.0, -1.0);
    vec3 n = normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                       k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
    vec3 w = exp(-trapHit * vec3(1.8, 2.4, 3.2));
    w /= (w.x + w.y + w.z + 1e-3);
    vec3 base = uColor1 * w.x * 1.2 + uColor2 * w.y * 1.4 + uColor3 * w.z * 1.2 + uColor2 * 0.12;
    // occlusion from two taps along the normal, scaled to the pixel footprint
    // (a step-count AO drew contour lines over every smooth face)
    float a1 = px * t * 30.0, a2 = px * t * 90.0;
    float ao = 0.5 * clamp(map(p + n * a1) / a1, 0.0, 1.0) + 0.5 * clamp(map(p + n * a2) / a2, 0.0, 1.0);
    ao = 0.35 + 0.65 * ao;
    vec3 L = normalize(vec3(0.6, 0.8, 0.4) + 0.3 * rt);
    float dif = max(dot(n, L), 0.0);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    vec3 surf = base * (0.4 + 1.1 * dif) * ao
              + uColor3 * rim * (0.5 + 0.9 * kick + 0.6 * uHigh) * glow
              + uColor1 * pow(max(dot(reflect(rd, n), L), 0.0), 24.0) * 0.5;
    col = mix(col, surf, exp(-max(t - 1.2, 0.0) * 0.25));
  }

  col = col / (1.0 + 0.35 * col);
  col *= clamp(1.25 - dot(uv, uv) * 0.6, 0.5, 1.0);
  gl_FragColor = vec4(col, 1.0);
}
