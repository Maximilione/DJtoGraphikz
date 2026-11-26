precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float uHighTime;
uniform float uBassTime;
uniform float uBassHit;
uniform float tile;
uniform float density;

varying vec2 vUv;

float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(vec3(i, 7.0)), hash(vec3(i + vec2(1.0, 0.0), 7.0)), f.x),
             mix(hash(vec3(i + vec2(0.0, 1.0), 7.0)), hash(vec3(i + vec2(1.0, 1.0), 7.0)), f.x), f.y);
}

vec3 pal(float k) {
  return k < 0.3333 ? uColor1 : k < 0.6667 ? uColor2 : uColor3;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  // the kick shoves the camera forward
  uv *= 1.0 - 0.06 * uBassHit;
  float r = length(uv);
  vec2 rdir = uv / max(r, 1e-4);
  vec3 color = vec3(0.0);

  // the warp clock: bass through uBassTime, never t * uBass (after half an
  // hour that product jumps whole cycles on every bass change and the whole
  // field teleports each frame)
  float zClock = uTime * 0.035 + uBassTime * 0.09;
  float warp = uBass * 0.8 + uBeat * 0.4;
  // uHighTime: hats push the twinkle phase forward
  float twPhase = uTime * 2.0 + uHighTime * 2.0 + uHigh * 5.0;

  // Nebula: two soft cloud fields far behind the stars, one per palette colour
  // (octaves rotated against each other: axis-aligned value noise shows its lattice as boxes)
  const mat2 NR = mat2(0.8, -0.6, 0.6, 0.8);
  vec2 np = NR * uv * 1.3 + vec2(uTime * 0.012, -uTime * 0.008);
  vec2 nq = NR * np * 2.1 + 4.1;
  float nb = vnoise(nq) * 0.6 + vnoise(NR * nq * 2.2 + 9.7) * 0.4;
  float n1 = vnoise(np) * 0.55 + nb * 0.45;
  float n2 = vnoise(np.yx * 1.2 + 31.7) * 0.55 + nb * 0.45;
  float neb = 0.17 + 0.08 * uEnergy;
  color += uColor3 * smoothstep(0.35, 0.85, n1) * neb;
  color += uColor2 * smoothstep(0.4, 0.9, n2) * neb * 0.8;
  color += uColor1 * smoothstep(0.5, 0.9, 1.0 - n1) * neb * 0.6;

  // Fixed sky: pinpoint stars too far to move, they glitter with the hats
  vec2 fs = uv * tile * 5.0 + 3.7;
  vec2 fid = floor(fs);
  float fh = hash(vec3(fid, 91.0));
  if (fh > 0.5) {
    vec2 fp = fract(fs) - 0.5 - (vec2(hash(vec3(fid, 92.0)), hash(vec3(fid, 93.0))) - 0.5) * 0.6;
    float px = tile * 5.0 / uResolution.y;       // one pixel in cell units
    float pt = smoothstep(max(0.08, px * 1.2), 0.0, length(fp));
    color += mix(pal(fract(fh * 53.0)), vec3(1.0), 0.5) * pt
           * (0.8 + (0.5 + 0.9 * uHigh) * (0.5 + 0.5 * sin(twPhase * 1.7 + fh * 200.0)));
  }

  // Flying stars: 12 depth slices in true perspective (cell size = depth), so
  // near stars are large, sparse and fast and far ones small, dense and slow.
  // One cell lookup per slice: a star and its streak stay inside their cell.
  for (int layer = 0; layer < 12; layer++) {
    float fl = float(layer);
    float zc = zClock + fl / 12.0;
    float z = fract(zc);
    float depth = 1.05 - z;
    // new stars every time the slice wraps from the lens back to the horizon
    float seed = fl + mod(floor(zc), 32.0) * 12.0;

    vec2 st = uv * tile * depth + fl * 17.3;
    vec2 id = floor(st);
    float h = hash(vec3(id, seed));
    // a floor of stars at rest: the field has to hold the wall in a breakdown
    if (h > 1.0 - min(density * 1.3, 0.95)) {
      vec2 sp = (vec2(hash(vec3(id + 1.0, seed)), hash(vec3(id + 2.0, seed))) - 0.5) * 0.4
              - (fract(st) - 0.5);
      // screen speed of a star is r / depth: in cell units the streak only
      // depends on r, so the centre stays points and the edges smear
      float stretch = 1.0 + r * tile * (0.05 + 1.5 * warp);
      float dr = dot(sp, rdir) / stretch;
      // a streak is also thinner than the point it came from, or it reads as a pill
      float dt = dot(sp, vec2(-rdir.y, rdir.x)) * sqrt(min(stretch, 4.0));
      float d2 = dr * dr + dt * dt;
      float fade = smoothstep(0.0, 0.18, z) * (1.0 - smoothstep(0.86, 1.0, z));
      // near stars grow with perspective, but less than 1 / depth: no blobs at the lens
      float core = 0.0006 * (0.25 + 0.75 * depth);
      float win = smoothstep(0.3, 0.1, length(sp));
      float lum = fade * (0.55 + 0.45 * z)
                * (0.75 + (0.2 + 0.3 * uHigh) * sin(twPhase + h * 100.0));
      float star = 3.2 * core / (d2 + core) * win * lum;
      // soft halo: the near stars glow instead of being bare dots
      float halo = exp(-d2 * 160.0) * win * lum * (0.1 + 0.3 * z);
      vec3 sColor = pal(fract(h * 37.0));
      color += mix(sColor, vec3(1.0), 0.55 * smoothstep(0.5, 1.6, star)) * star + sColor * halo;
    }
  }

  // Beat flash
  color *= 1.0 + uBeat * 0.5;
  // vanishing point: the bass lights the place the stars come from
  color += mix(uColor1, uColor3, 0.5) * exp(-r * 5.0) * (0.03 + 0.25 * uBass);

  color = min(color, vec3(1.5));
  // dither: the nebula gradients do not band on 8-bit projector output
  color += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(color, 1.0);
}
