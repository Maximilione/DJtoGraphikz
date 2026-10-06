precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float sides;
uniform float ringdensity;
uniform float twist;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;

  // Audio-reactive warp: the vanishing point sways and the kick shoves the camera
  float warp = uBass * 0.3 + uBeat * 0.15;
  uv *= rot(uTime * twist + uMid * 0.5);
  uv += vec2(sin(uTime * 0.3) * warp, cos(uTime * 0.4) * warp);
  uv *= 1.0 - 0.06 * uBassHit;

  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // Infinite tunnel. Travel is integrated (uBassTime, uTime) so speed changes
  // never teleport the pattern; the kick adds an instant lurch forward.
  float build = uBarPhase * uBarPhase;
  float depth = 1.0 / (r + 0.05) + uTime * (2.0 + build * 1.5) + uBassTime * 1.6 + uBassHit * 0.7;

  // Wall panels: sectors around, slabs along the depth
  float sg = max(floor(sides + uMid * 3.0), 3.0);
  float lane = a / TAU * sg;
  float li = floor(lane);
  float ap = fract(lane);
  float ea = min(ap, 1.0 - ap);                 // distance to the sector edge
  float zc = depth * ringdensity / PI;
  float fz = fract(zc);
  float ez = min(fz, 1.0 - fz);                 // distance to the slab edge
  float zi = mod(floor(zc), 64.0);

  float h = hash(vec2(mod(li, 32.0), zi));
  float nr = smoothstep(0.02, 0.14, r);      // lines melt into the vanishing point

  // Slab rings and sector seams, thin in depth space so they shrink with distance
  float rings = (smoothstep(0.1, 0.0, ez) + 0.3 * exp(-ez * 9.0)) * nr;
  float segs = (exp(-ea * (r + 0.03) * 70.0) + 0.2 * exp(-ea * 6.0)) * nr;

  // Lit panels flicker on with the kick and the highs
  float litThr = 0.82 - 0.14 * uBassHit - 0.08 * uHigh;
  float lit = step(litThr, h) * smoothstep(0.02, 0.14, ea) * smoothstep(0.02, 0.12, ez) * nr;
  lit *= 0.7 + 0.3 * sin(uTime * 6.0 + h * TAU);

  // Soft wall texture, keeps the tube readable between the lines
  float p1 = sin(depth * 4.0 + a * sg) * 0.5 + 0.5;
  float p2 = sin(depth * 8.0 - uTime * 3.0) * 0.5 + 0.5;

  // Sparks flying past the camera
  float sl = a / TAU * 24.0;
  float sh = hash(vec2(floor(sl), 7.0));
  float sf = fract(depth * (0.25 + 0.35 * sh) + sh * 10.0);
  float across = abs(fract(sl) - 0.5) * (r + 0.02);
  float spark = exp(-across * 200.0) * exp(-sf * 9.0) * step(0.55, sh) * nr;

  // Colour cycling with depth
  float cs = depth * 0.1 + uTime * 0.2 + uHigh * 2.0;
  vec3 c1 = uColor1 * (sin(cs) * 0.4 + 0.6);
  vec3 c2 = uColor2 * (sin(cs + TAU / 3.0) * 0.4 + 0.6);
  vec3 c3 = uColor3 * (sin(cs + TAU * 2.0 / 3.0) * 0.4 + 0.6);

  vec3 color = vec3(0.0);
  color += c1 * rings * (1.3 + 0.8 * uBassHit);
  color += c2 * segs * 1.1;
  color += c3 * lit * 1.2;
  color += c3 * p1 * p2 * 0.3;
  color += mix(c1, vec3(1.0), 0.7) * spark * (0.8 + uHigh);

  // Floor of light: never black even in silence
  color += mix(uColor1, uColor2, 0.5) * 0.04 * (0.5 + p1);

  // Vanishing point: halo, white-hot core and a ring that races out on the kick
  float centerGlow = exp(-r * 4.0) * (0.5 + uBeat * 2.0);
  color += (c1 + c2) * 0.5 * centerGlow;
  color += vec3(1.0) * exp(-r * r * 500.0) * (0.3 + 1.5 * uBassHit);
  float sw = (r - (0.04 + 0.9 * (1.0 - uBassHit))) * 12.0;
  color += mix(uColor3, vec3(1.0), 0.5) * exp(-sw * sw) * uBassHit * 1.2;

  // Depth fog: bright at the vanishing point, dim near the lens
  float fog = mix(0.35, 1.0, exp(-r * 1.5));
  float pulse = 1.0 + uBeat * 0.6 + build * 0.3;
  color *= fog * pulse;

  // Scanlines
  color *= 0.97 + 0.03 * sin(gl_FragCoord.y * 1.5);

  color = vec3(1.0) - exp(-color * 1.3);
  gl_FragColor = vec4(color, 1.0);
}
