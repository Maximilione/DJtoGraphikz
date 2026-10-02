precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float radius;
uniform float corona;
uniform float wobble;

// A black disc eating the light. Only the corona shows: rays that flicker
// around the rim and reach out on the bass. The disc never lights — the
// darkest thing on the wall is the middle of it.

#define TAU 6.28318530718

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// periodic in `per` cells so the ray field closes on itself around the rim
float noise(float x, float per) {
  float i = floor(x), f = fract(x);
  return mix(hash(vec2(mod(i, per), 0.0)), hash(vec2(mod(i + 1.0, per), 0.0)), f * f * (3.0 - 2.0 * f));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) / min(aspect, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);

  // the rim wobbles slowly
  float rim = radius * (1.0 + wobble * 0.04 * sin(a * 5.0 + uTime * 0.8)
                                + wobble * 0.02 * sin(a * 11.0 - uTime * 1.3));
  float outside = smoothstep(rim, rim + 0.004, r);

  // rays: two octaves of angular noise, drifting opposite ways
  float rays = noise(a / TAU * 72.0 + uTime * 0.6, 72.0)
             * noise(a / TAU * 174.0 - uTime * 0.9, 174.0);
  rays = pow(rays, 1.5) * 1.6;
  float reach = corona * (0.6 + 1.6 * uBass);
  float halo = exp(-(r - rim) * 9.0 / reach) * (0.35 + rays);
  float shell = exp(-(r - rim) * 60.0) * (0.6 + 0.8 * uHigh);

  vec3 col = uColor1 * halo + mix(uColor1, vec3(1.0), 0.6) * shell;
  col = mix(col, uColor2 * halo * 0.5, smoothstep(rim + 0.1, rim + 0.5, r));
  col += vec3(1.0) * uBassHit * exp(-(r - rim) * 30.0) * 0.4;
  col *= outside;
  col += vec3(hash(gl_FragCoord.xy + fract(uTime) * 13.0)) * 0.008 * outside;
  gl_FragColor = vec4(col, 1.0);
}
