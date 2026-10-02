precision highp float;
uniform sampler2D tDiffuse;
uniform float uLevel;   // amount grezzo (senza macro intensita'): sceglie il modo
uniform vec2 uResolution;
varying vec2 vUv;

// Mappa amount -> modo, a scaglioni (default amount=1 = orizzontale, come prima):
//   (0.8, 1]   orizzontale
//   (0.6, 0.8] verticale
//   (0.4, 0.6] quad (orizzontale + verticale)
//   (0.2, 0.4] kaleido 6 spicchi
//   [0, 0.2]   kaleido 8 spicchi
vec2 kaleido(vec2 uv, float n) {
  vec2 asp = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * asp;
  float seg = 6.2831853 / n;
  float a = abs(mod(atan(p.y, p.x), seg) - seg * 0.5);   // specchio dentro lo spicchio
  vec2 q = 0.5 + vec2(cos(a), sin(a)) * length(p) / asp;
  return 1.0 - abs(mod(q, 2.0) - 1.0);   // oltre il bordo: ripiega invece di sbavare
}

void main() {
  vec2 uv = vUv;
  if (uLevel > 0.8) { if (uv.x > 0.5) uv.x = 1.0 - uv.x; }
  else if (uLevel > 0.6) { if (uv.y > 0.5) uv.y = 1.0 - uv.y; }
  else if (uLevel > 0.4) uv = 0.5 - abs(uv - 0.5);
  else if (uLevel > 0.2) uv = kaleido(uv, 6.0);
  else uv = kaleido(uv, 8.0);
  gl_FragColor = texture2D(tDiffuse, uv);
}
