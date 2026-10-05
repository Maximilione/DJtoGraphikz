precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uHigh;
uniform float uHighHit;
uniform float uEnergy;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

varying vec3 vN;
varying vec3 vP;
uniform float uBeat;
uniform float uBassHit;
uniform float dissolve;

varying float vSeed;
varying vec3 vO;
varying float vLife;

float h31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float vn(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h31(i), b = h31(i + vec3(1, 0, 0)), c = h31(i + vec3(0, 1, 0)), d = h31(i + vec3(1, 1, 0));
  float e = h31(i + vec3(0, 0, 1)), g = h31(i + vec3(1, 0, 1)), h = h31(i + vec3(0, 1, 1)), k = h31(i + vec3(1, 1, 1));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}

void main() {
  // treble: edges and points flicker, each by its own seed
  float spark = 1.0 + 2.2 * clamp(uHighHit + uHigh * 0.5, 0.0, 1.0)
                * step(0.55, fract(vSeed * 13.0 + uTime * 7.0));
#if LOOK == 0
  // neon wireframe: palette runs along the height, additive
  float k = clamp(vP.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(uColor1, uColor2, k);
  gl_FragColor = vec4(c * (0.55 + 0.5 * uEnergy) * spark, 1.0);
#elif LOOK == 1
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, d);
  vec3 c = mix(uColor3, uColor1, fract(vSeed * 3.0 + vP.y * 0.4));
  gl_FragColor = vec4(c * soft * (0.8 + 0.6 * uEnergy) * spark, 1.0);
#elif LOOK == 3
  // hologram: fresnel shell, scanlines running up the body, a dim floor of light
  vec3 n = normalize(vN);
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.0);
  float scan = 0.55 + 0.45 * sin(vP.y * 110.0 - uTime * 3.0);
  float sweep = pow(0.5 + 0.5 * sin(vP.y * 3.0 - uTime * 1.6), 8.0);
  vec3 c = mix(uColor1, uColor2, clamp(vP.y * 0.5 + 0.5, 0.0, 1.0));
  vec3 holo = c * (0.16 + 1.2 * fres) * scan + uColor3 * (fres * 0.6 + sweep * 0.7);
  holo *= 0.8 + 0.5 * uEnergy + 0.6 * uBass;
  gl_FragColor = vec4(holo * spark, 1.0);
#elif LOOK == 5
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  if (d > 0.5) discard;
  vec3 c = mix(uColor1, uColor3, fract(vSeed * 5.0));
  gl_FragColor = vec4(c * smoothstep(0.5, 0.0, d) * vLife * (1.1 + uBass) * spark, 1.0);
#else
  // metal (2) and the dissolving metal (4): a striped fake environment seen
  // through the reflection vector; 4 is eaten by a noise threshold the kick raises
  float edge = 0.0;
#if LOOK == 4
  float kk = clamp(max(uBeat, uBassHit), 0.0, 1.0);
  float lvl = min(dissolve * 0.7 + 0.35 * kk, 0.85);
  float en = 0.65 * vn(vO * 4.0) + 0.35 * vn(vO * 11.0);
  if (en < lvl) discard;
  edge = 1.0 - smoothstep(0.0, 0.07, en - lvl);
#endif
  vec3 n = normalize(vN);
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 r = reflect(-v, n);
  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.5);
  float env = 0.5 + 0.5 * sin(r.y * 6.0 + r.x * 3.0 + uTime * 0.6);
  vec3 c = mix(uColor1, uColor2, env);
  c = mix(c, uColor3, fres);
  float spec = pow(max(dot(r, normalize(vec3(0.4, 0.7, 0.6))), 0.0), 24.0);
  c = c * (0.3 + 0.7 * (0.5 + 0.5 * n.y)) + spec * (0.6 + uBass);
  c += uColor3 * fres * 0.5 * (1.0 + uHighHit * 2.0);
  c += uColor3 * edge * (1.6 + uBass);
  gl_FragColor = vec4(c, 1.0);
#endif
}
