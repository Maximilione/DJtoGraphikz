precision highp float;
// Displace procedurale: onde o noise spostano i pixel del frame, senza mappa.
// uWet (amount) e' sia l'ampiezza sia il tipo: basso = onde morbide, alto = noise.
uniform sampler2D tDiffuse;
uniform float uWet;
uniform float uBass;
uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  float amp = uWet * (0.5 + uBass) * 0.06;   // al massimo ~9% del frame
  vec2 p = vUv * vec2(uResolution.x / uResolution.y, 1.0);
  vec2 wave = vec2(sin(p.y * 9.0 + uTime * 1.6), cos(p.x * 7.0 - uTime * 1.3));
  vec2 n = vec2(noise(p * 4.0 + uTime * 0.7), noise(p * 4.0 - uTime * 0.6 + 17.0)) * 2.0 - 1.0;
  vec2 d = mix(wave, n, smoothstep(0.3, 0.8, uWet)) * amp;
  vec2 uv = 1.0 - abs(mod(vUv + d, 2.0) - 1.0);   // ai bordi ripiega invece di sbavare
  gl_FragColor = texture2D(tDiffuse, uv);
}
