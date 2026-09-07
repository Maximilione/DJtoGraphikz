precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBassHit;
uniform float uMidHit;
uniform float uHighHit;
uniform float uBassTime;
uniform float uHighTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
uniform float towers;
uniform float foglevel;
uniform float orbit;

// PS2 boot screen: luminous prisms of different heights floating in deep blue
// haze, slow orbiting camera, motes drifting upward. The kick raises fresh
// towers, the bass makes the whole city breathe.
void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;

  // deep-space gradient backdrop with faint haze bands
  vec3 sky = mix(uColor3 * 0.10, uColor3 * 0.28, smoothstep(-0.6, 0.6, uv.y));
  sky += uColor2 * 0.05 * sin(uv.y * 6.0 + t * 0.3);
  vec3 color = sky;

  float camA = t * 0.12 * (0.5 + orbit);
  float camBob = sin(t * 0.4) * 0.03 + uBassHit * 0.02;

  // towers sorted far→near by drawing three depth shells
  for (int shell = 0; shell < 3; shell++) {
    float fs = float(shell);           // 0 = far, 2 = near
    for (float i = 0.0; i < 16.0; i++) {
      if (i + fs * 16.0 >= towers) break;
      float id = i + fs * 16.0;
      float h1 = hash(vec2(id, 3.1));
      float h2 = hash(vec2(id, 9.7));

      // world position on a disc, rotated by the camera orbit
      float ang = h1 * TAU + camA;
      float rad = 0.5 + h2 * 2.4 - fs * 0.5;
      vec3 wp = vec3(cos(ang) * rad, 0.0, sin(ang) * rad + 3.2);
      if (wp.z < 0.7) continue;        // behind the camera

      // perspective projection
      float px = wp.x / wp.z;
      float ground = -0.32 / wp.z + camBob;

      // tower height: base + slow individual growth + kick lift on a subset
      float grow = 0.5 + 0.5 * sin(t * (0.1 + h2 * 0.2) + h1 * TAU);
      float lift = step(0.7, hash(vec2(id, floor(uBassTime * 1.5)))) * uBassHit * 0.4;
      float hgt = (0.25 + h2 * 0.85 + grow * 0.3 + lift + uBass * 0.15) / wp.z;
      float wid = (0.030 + h1 * 0.022) / wp.z;

      // rectangle with soft edges
      float dx = abs(uv.x - px);
      float inX = smoothstep(wid, wid * 0.55, dx);
      float inY = smoothstep(ground - 0.003, ground, uv.y)
                * smoothstep(ground + hgt, ground + hgt - 0.02 / wp.z, uv.y);
      float body = inX * inY;

      // luminance: silver-white core tinted by the palette, brighter at the top
      float topGlow = smoothstep(ground, ground + hgt, uv.y);
      vec3 tc = mix(uColor1, vec3(0.95), 0.55) * (0.55 + topGlow * 0.7);
      tc = mix(tc, uColor2, h1 * 0.35);

      // depth fog eats the far towers
      float fog = exp(-wp.z * (0.16 + foglevel * 0.22));
      color = mix(color, tc, body * fog * 0.9);
      // side glow halo
      color += tc * (wid * 0.5) / (dx + wid * 1.2) * inY * fog * 0.35;
      // floor reflection, dimmer and squashed
      float ry = ground - (uv.y - ground) * 0.55;
      float refl = inX * smoothstep(0.06 / wp.z, 0.0, abs(uv.y - ry)) * step(uv.y, ground);
      color += tc * refl * fog * 0.18;
    }
  }

  // rising motes (the PS2 fireflies) — hats make them twinkle
  for (int m = 0; m < 14; m++) {
    float fm = float(m);
    float mh = hash(vec2(fm, 41.0));
    vec2 mp = vec2(
      (hash(vec2(fm, 17.0)) - 0.5) * 1.7 + sin(t * (0.3 + mh) + fm) * 0.05,
      mod(mh + t * (0.03 + mh * 0.05), 1.0) * 1.1 - 0.55);
    float md = length(uv - mp);
    float tw = 0.7 + 0.3 * sin(t * (4.0 + mh * 8.0) + fm) + uHighHit * 0.8;
    color += mix(vec3(0.9), uColor1, mh) * (0.00018 / (md * md + 0.00025)) * tw * 0.55;
  }

  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}
