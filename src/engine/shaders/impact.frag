precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float rings;
uniform float width;
uniform float fade;

// Shockwaves. Every beat drops a ring at the centre that expands and dies; the
// last few beats are still in flight, so a bar reads as nested rings. The kick
// itself is a white point that never grows — the wave is the memory of it.

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  // a touch of hex distortion so the rings are not perfect circles
  float a = atan(p.y, p.x);
  float r = length(p) * (1.0 + 0.04 * cos(a * 6.0 + uTime * 0.3));

  vec3 col = vec3(0.0);
  float n = clamp(floor(rings), 1.0, 8.0);
  float beat = floor(uBeatClock);
  for (int k = 0; k < 8; k++) {
    if (float(k) >= n) break;
    float age = uBeatClock - (beat - float(k));   // beats since this ring fired
    float radius = age * 0.22;
    float life = exp(-age * fade * 0.8);
    float w = 0.012 * width * (1.0 + age * 0.4);
    float d = abs(r - radius);
    float ring = exp(-d * d / (w * w)) * life;
    // a thin white core inside a coloured halo
    col += mix(uColor1, vec3(1.0), ring * 0.6) * ring;
    col += uColor2 * exp(-d * 14.0) * life * 0.12;
  }
  // the kick point, and the room going dark around it
  float core = exp(-r * 60.0) * uBassHit * 2.0;
  col += vec3(1.0) * core;
  col *= 1.0 - smoothstep(0.45, 0.8, r);
  col *= 0.85 + 0.4 * uBeat;
  col += vec3(hash(gl_FragCoord.xy + fract(uTime) * 11.0)) * 0.01;
  gl_FragColor = vec4(col, 1.0);
}
