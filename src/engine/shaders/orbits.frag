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
uniform float bodies;
uniform float orbitr;
uniform float trail;

// Orbital system: glowing bodies on nested orbits, comet trails, the kick
// widens the orbits, hats twinkle the small ones.
void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  vec3 color = vec3(0.0);

  // faint orbit rings
  for (int k = 0; k < 3; k++) {
    float rr = orbitr * (0.45 + float(k) * 0.35) * (1.0 + uBass * 0.15);
    float d = abs(length(uv) - rr);
    color += uColor3 * smoothstep(0.004, 0.0, d - fwidth(d)) * 0.18;
  }

  for (float i = 0.0; i < 16.0; i++) {
    if (i >= bodies) break;
    float h = hash(vec2(i, 7.0));
    float ring = mod(i, 3.0);
    float rr = orbitr * (0.45 + ring * 0.35) * (1.0 + uBass * 0.15);
    float speed = (0.4 + h * 0.9) * (ring == 0.0 ? 1.6 : ring == 1.0 ? 1.0 : 0.65);
    float dir = mod(i, 2.0) < 1.0 ? 1.0 : -1.0;
    float ang = t * speed * dir + h * TAU + uBarPhase * TAU * 0.1;
    vec2 pos = vec2(cos(ang), sin(ang)) * rr;

    float d = length(uv - pos);
    float size = 0.010 + h * 0.014 + (ring == 2.0 ? uBassHit * 0.02 : 0.0);
    vec3 c = mix(uColor1, uColor2, h);
    float tw = ring == 0.0 ? (0.6 + 0.4 * step(0.6, fract(uHighTime * 3.0 + h))) : 1.0;
    color += c * (size * size) / (d * d + size * size * 0.25) * tw;

    // comet trail: sample a few past positions
    for (int s = 1; s <= 5; s++) {
      float fs = float(s);
      float ta = ang - dir * fs * 0.09 * (0.5 + trail);
      vec2 pp = vec2(cos(ta), sin(ta)) * rr;
      float td = length(uv - pp);
      color += c * (size * size * 0.4) / (td * td + size * size) * (1.0 - fs / 6.0) * trail;
    }
  }

  // gravity well at the center breathing with the bar
  float cd = length(uv);
  color += mix(uColor3, uColor1, uBarPhase) * 0.015 / (cd * cd + 0.02) * (0.5 + uBass);

  color = min(color, vec3(2.2));
  gl_FragColor = vec4(color, 1.0);
}
