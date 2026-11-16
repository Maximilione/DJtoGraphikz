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
uniform float zoom;
uniform float warpamt;
uniform float linefreq;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

// sin-free hash (36 per pixel): cheaper ALU, same noise character
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) {
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  uv *= zoom;

  float t = uTime * 0.4;

  // Domain warping — multiple layers
  float bass = uBass;
  float mid = uMid;

  // Layer 1: slow large warp
  vec2 q = vec2(
    noise(uv * 2.0 + vec2(t * 0.3, 0.0)),
    noise(uv * 2.0 + vec2(0.0, t * 0.4))
  );

  // Layer 2: medium warp driven by audio
  vec2 wq = uv * 3.0 + q * warpamt * (1.0 + bass * 2.0);
  vec2 r2 = vec2(
    noise(wq + vec2(t * 0.7, t * 0.3)),
    noise(wq + vec2(t * 0.5, -t * 0.6))
  );

  // Layer 3: fine detail
  float n = noise(uv * 4.0 + r2 * 3.0 * (1.0 + mid) + t * 0.2);

  // Fractal accumulation
  float f = 0.0;
  f += 0.5000 * noise(uv * 1.0 + r2 * 2.0 + t * 0.1);
  f += 0.2500 * noise(uv * 2.0 + q * 3.0 - t * 0.2);
  f += 0.1250 * noise(uv * 4.0 + r2 * 1.5 + t * 0.3);
  // the 4th octave was finer than the flow lines resolve: dropped, sum rescaled to the same range
  f *= 1.0 / 0.875;
  // contrast on the field: deep troughs between filaments
  float fc = smoothstep(0.22, 0.72, f);

  // Flow lines
  float lines = sin(f * linefreq + uTime * 2.0 + bass * 10.0);
  // antialiased threshold: clean line edges instead of a crawling near-square wave
  float lw = fwidth(f) * linefreq * 1.5 + 0.02;
  lines = smoothstep(-lw, lw, lines);

  // Color mapping
  float cr = f * 3.0 + uTime * 0.1;
  vec3 c1 = uColor1 * (sin(cr) * 0.5 + 0.5);
  vec3 c2 = uColor2 * (sin(cr + 2.094) * 0.5 + 0.5);
  vec3 c3 = uColor3 * (sin(cr + 4.189) * 0.5 + 0.5);

  vec3 color = c1 * fc * fc * 1.4 + c2 * (1.0 - fc) * lines + c3 * n * n * 0.6;
  color *= 1.2;

  // Hot spots
  // hot spots stay in palette and sparkle on the hats
  float hot = n * n * n * (1.2 + 3.0 * uHigh);
  color += mix(uColor3, vec3(1.0), 0.25) * hot;

  // Beat flash: additive-ish gain, the old 2.2× pushed the frame to pastel
  color *= 1.0 + uBeat * 0.4;

  // Subtle vignette in frame space — bounded on any aspect, so it never goes
  // negative (on a 6:1 strip origUv.x reaches 3 and the frame edges went white)
  color = 1.0 - exp(-color * 1.25);   // highlight rolloff
  vec2 vq = (vUv - 0.5) * vec2(1.78, 1.0);
  float vig = max(1.0 - dot(vq, vq) * 1.15, 0.0);
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
