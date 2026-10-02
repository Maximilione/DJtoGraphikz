precision highp float;
// Frame glitch: block shift a righe, tear, color bleed e hold di righe sul frame
// gia' renderizzato (qualunque effetto). Silenzioso con amount basso e senza colpi:
// sono uBeat e uHighHit ad aprirlo.
uniform sampler2D tDiffuse;
uniform float uWet;
uniform float uBeat;
uniform float uHighHit;
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  float k = clamp(uWet * (uWet * 0.35 + uBeat * 0.4 + uHighHit * 0.8), 0.0, 1.0);
  float t = floor(uTime * 15.0);   // frame quantizzati: il glitch "scatta"
  float rows = 24.0;
  float band = floor(vUv.y * rows);
  vec2 uv = vUv;
  // block shift: poche righe saltano di lato a ogni frame glitch
  float jump = step(1.0 - k * 0.6, hash(vec2(band, t)));   // "active" e' riservata in GLSL
  float shift = (hash(vec2(band + 7.0, t)) - 0.5) * 0.3 * k * jump;
  // tear: tutto sopra una linea che si muove slitta un po'
  shift += step(hash(vec2(t, 3.0)), uv.y) * (hash(vec2(t, 5.0)) - 0.5) * 0.08 * k;
  // hold: sul colpo alto una riga si congela in una banda piatta
  float hold = step(1.0 - uHighHit * uWet * 0.3, hash(vec2(band + 31.0, floor(uTime * 6.0))));
  uv.y = mix(uv.y, (band + 0.5) / rows, hold);
  uv.x += shift;
  // color bleed sulle righe spostate
  float bleed = (0.004 + abs(shift)) * k;
  float r = texture2D(tDiffuse, uv + vec2(bleed, 0.0)).r;
  float g = texture2D(tDiffuse, uv).g;
  float b = texture2D(tDiffuse, uv - vec2(bleed * 0.6, 0.0)).b;
  gl_FragColor = vec4(r, g, b, 1.0);
}
