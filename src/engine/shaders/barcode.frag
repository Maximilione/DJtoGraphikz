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
uniform float uLineBoost;

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
  // the beat count feeds a sin() hash: fold it or an hour in, the bars repeat
  float gen = mod(floor(uBeatClock), 512.0);

  // three bands, each with its own slide and tear
  float band = floor(uv.y * 3.0);
  float slide = mod(uTime * 0.05 * jitter, 1.0) * (mod(band, 2.0) * 2.0 - 1.0);
  float th = hash(vec2(band, mod(floor(uTime * 12.0), 512.0)));
  float tear = (th - 0.5) * 0.15 * uHighHit * jitter;
  float x = uv.x + slide + tear;

  float n = max(4.0, floor(bars));
  // periodic in x: the slide wraps by 1 without re-rolling the bars
  float cell = mod(floor(x * n), n);
  float f = fract(x * n);
  // width of the printed bar inside its cell: random per cell, re-rolled per beat
  float w = hash(vec2(cell, gen)) ;
  float on = step(gap, w);
  // printed width: widened, and never under lminPx pixels (a cell is uResolution.x / n px)
  float lminPx = 3.0 + 4.0 * uLineBoost;
  float bw = min(max(w * 0.85 * (1.0 + 0.8 * uLineBoost), lminPx * n / uResolution.x), 0.85);
  // bar edges one pixel soft, so the slide does not crawl
  float aa = n / uResolution.x;
  float edge = smoothstep(0.15 - aa, 0.15, f) * (1.0 - smoothstep(0.15 + bw, 0.15 + bw + aa, f));
  float bar = on * edge;

  // a few bars carry the palette, the rest are white
  float tinted = step(0.9, hash(vec2(cell, gen + 3.7)));
  vec3 ink = mix(vec3(1.0), hash(vec2(cell, gen + 9.1)) < 0.65 ? uColor1 : uColor3, tinted);
  // the scanner: a laser line that crosses the label once per beat, top to
  // bottom. The print sits at a dim grey and lights where it has just been
  // read, so the beat is a moving thing and not a change of level on a flat
  // field of bars.
  float dy = uv.y - (1.0 - fract(uBeatClock));
  float read = dy > 0.0 ? exp(-dy * 4.0) : 0.0;
  float beam = exp(-dy * dy * 12000.0);
  // the band that just tore flashes brighter
  float bright = 0.30 + 0.60 * read * (0.7 + 0.3 * uEnergy) + 0.15 * uBeat + 0.3 * uBassHit;
  bright *= 1.0 + 0.5 * uHighHit * abs(th - 0.5) * 2.0;
  vec3 col = ink * bar * bright;
  col += uColor2 * beam * (0.25 + 1.2 * bar) * (0.6 + 0.6 * uEnergy);
  // black separator lines between bands, and a dim digit strip at the bottom
  col *= step(0.01, fract(uv.y * 3.0));
  col *= 1.0 - 0.6 * step(uv.y, 0.06) ;
  gl_FragColor = vec4(col, 1.0);
}
