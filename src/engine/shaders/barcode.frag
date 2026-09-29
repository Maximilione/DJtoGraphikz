precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform float uHighHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float bars;
uniform float gap;
uniform float jitter;

// Barcode. Vertical bars re-rolled on every beat, sliding sideways; the frame
// is cut in three horizontal bands that tear apart on the hats. No colour but
// the odd tinted bar — a label on a crate.

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float gen = floor(uBeatClock);

  // three bands, each with its own slide and tear
  float band = floor(uv.y * 3.0);
  float slide = uTime * 0.05 * jitter * (mod(band, 2.0) * 2.0 - 1.0);
  float tear = (hash(vec2(band, floor(uTime * 12.0))) - 0.5) * 0.15 * uHighHit * jitter;
  float x = uv.x + slide + tear;

  float n = max(4.0, floor(bars));
  float cell = floor(x * n);
  float f = fract(x * n);
  // width of the printed bar inside its cell: random per cell, re-rolled per beat
  float w = hash(vec2(cell, gen)) ;
  float on = step(gap, w);
  float edge = step(0.15, f) * step(f, 0.15 + w * 0.85);
  float bar = on * edge;

  // a few bars carry the palette, the rest are white
  float tinted = step(0.9, hash(vec2(cell, gen + 3.7)));
  vec3 ink = mix(vec3(1.0), uColor1, tinted);
  // the band that just tore flashes brighter
  float bright = 0.75 + 0.35 * uBeat + 0.3 * uBassHit;
  vec3 col = ink * bar * bright;
  // black separator lines between bands, and a dim digit strip at the bottom
  col *= step(0.01, fract(uv.y * 3.0));
  col *= 1.0 - 0.6 * step(uv.y, 0.06) ;
  gl_FragColor = vec4(col, 1.0);
}
