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

uniform float blobs;
uniform float morph;
uniform float shine;

// Liquid chrome: a drop of mercury that never settles. A core sphere and up to
// five satellites melt into each other (smooth minimum) while a travelling
// ripple, fed by the bass, wrinkles the surface. Raymarched in at most 56
// steps, inside a bounding sphere so the empty frame costs nothing. The metal
// has no texture of its own: it reflects a studio built from the palette
// (gradient room, light strips, a key light, a coloured rim) and a thin film
// of the three palette colours slides over it with the viewing angle. The
// kick shoves the satellites apart and swells the core.

const float TAU = 6.2831853;

vec3 env(vec3 r, float t) {
  float h = r.y * 0.5 + 0.5;
  vec3 c = mix(uColor2 * 0.30, uColor1 * 0.55, h);
  // horizontal softboxes drifting up, vertical ones turning round the room
  float bands = smoothstep(0.80, 0.95, sin(r.y * 7.0 + t * 0.5 + r.x * 2.0));
  float ribs = smoothstep(0.86, 0.97, sin(atan(r.z, r.x) * 5.0 - t * 0.35));
  c += uColor3 * (bands + 0.7 * ribs) * 1.5;
  // key light and a coloured rim from behind
  c += mix(uColor3, vec3(1.0), 0.45) * pow(max(dot(r, normalize(vec3(0.5, 0.8, 0.4))), 0.0), 16.0) * 2.6;
  c += uColor1 * pow(max(dot(r, normalize(vec3(-0.7, 0.1, -0.6))), 0.0), 8.0) * 1.3;
  // the floor of the studio is dark
  return c * (0.3 + 0.7 * smoothstep(-0.7, 0.3, r.y));
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float gT;     // blob clock
float gKick;  // kick envelope

float map(vec3 p) {
  float spread = 0.85 + 0.55 * gKick;
  float d = length(p) - 0.78 * (1.0 + 0.28 * gKick);
  for (int i = 0; i < 5; i++) {
    if (float(i) >= blobs - 1.0) break;
    float fi = float(i);
    vec3 c = vec3(sin(gT * (0.7 + 0.13 * fi) + fi * 2.1),
                  sin(gT * (0.9 + 0.11 * fi) + fi * 1.3 + 1.0),
                  cos(gT * (0.6 + 0.17 * fi) + fi * 0.7)) * spread * (0.7 + 0.14 * fi);
    d = smin(d, length(p - c) - (0.46 - 0.03 * fi), 0.6);
  }
  float w = sin(p.x * 3.5 + gT * 2.0) * sin(p.y * 3.1 - gT * 1.7) * sin(p.z * 3.8 + gT * 1.3);
  d += morph * 0.1 * w * (0.4 + uBass);
  return d * 0.72; // the ripple breaks the distance bound: shorter steps
}

vec3 normalAt(vec3 p) {
  vec2 k = vec2(1.0, -1.0);
  const float e = 0.0015;
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                   k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gT = uBassTime * 0.5 + uTime * 0.18;

  float a = gT * 0.22 + 0.3 * sin(mod(uBeatClock * 0.1, TAU));
  vec3 ro = vec3(sin(a) * 4.6, 0.9 + 0.7 * sin(a * 0.7), cos(a) * 4.6);
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(uv.x * rt + uv.y * up + fw * 1.6);

  // backdrop: the studio, dim, so the metal is the thing that shines
  vec3 col = env(rd, gT) * 0.16 * (1.0 - smoothstep(0.0, 1.2, length(uv)) * 0.5);

  // bounding sphere: skip the march entirely for rays that cannot touch it
  float bR = 3.1;
  float b = dot(ro, rd);
  float disc = b * b - (dot(ro, ro) - bR * bR);
  if (disc > 0.0) {
    float t = max(-b - sqrt(disc), 0.0);
    float tMax = -b + sqrt(disc);
    bool hit = false;
    for (int i = 0; i < 56; i++) {
      float d = map(ro + rd * t);
      if (d < 0.002) { hit = true; break; }
      t += d;
      if (t > tMax) break;
    }
    if (hit) {
      vec3 p = ro + rd * t;
      vec3 n = normalAt(p);
      vec3 r = reflect(rd, n);
      float ndv = max(dot(n, -rd), 0.0);
      float fres = pow(1.0 - ndv, 3.0);

      // thin film: the palette slides over the metal with angle and height
      float w = fract(fres * 0.9 + n.y * 0.25 + gT * 0.04);
      vec3 film = w < 0.333 ? mix(uColor1, uColor2, w * 3.0)
                : w < 0.666 ? mix(uColor2, uColor3, (w - 0.333) * 3.0)
                            : mix(uColor3, uColor1, (w - 0.666) * 3.0);
      // a hair of chromatic offset between the three reflections
      vec3 e0 = env(r, gT);
      vec3 e1 = env(normalize(r + n * 0.05), gT);
      vec3 e2 = env(normalize(r - n * 0.05), gT);
      vec3 refl = vec3(e0.r, e1.g, e2.b) * 0.5 + e0 * 0.5;
      col = refl * (0.55 + 0.9 * film) * shine
          + film * fres * 1.1 * shine
          + uColor3 * gKick * 0.35 * fres;
    }
  }

  col = col / (1.0 + 0.5 * col) + uColor1 * 0.01;
  gl_FragColor = vec4(col, 1.0);
}
