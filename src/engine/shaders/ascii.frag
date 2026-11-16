precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform sampler2D uSpectrum;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float cellsize;
uniform float levels;
uniform float sourcezoom;
uniform float uLineBoost;

// Terminal readout: a procedural field sampled once per character cell and
// printed as a glyph whose ink coverage matches the brightness. The glyphs are
// 5x5 bitmaps packed into floats — cheap, and it looks like a real terminal
// instead of the usual "blocky mosaic" pixelation.

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// the picture being printed: swirling plasma, loudest where the spectrum is
float source(vec2 p) {
  float t = uTime * 0.4 + uBeatClock * 0.1;
  float v = sin(p.x * 3.1 + t) + sin(p.y * 2.7 - t * 0.8)
          + sin((p.x + p.y) * 2.2 + t * 1.3)
          + sin(length(p) * 5.0 - t * 1.7);
  v = v * 0.25 + 0.5;
  float spec = texture2D(uSpectrum, vec2(clamp(p.x * 0.25 + 0.5, 0.0, 1.0), 0.5)).r;
  // gain kept under 1 so the field spans all the glyph levels: with the old
  // gain a loud track saturated most cells to the top glyph and the screen
  // read as magenta blobs instead of text
  return clamp(v * (0.5 + 0.4 * uEnergy) + spec * 0.3, 0.0, 1.0);
}

// 5x5 glyphs, densest last. Each row is 5 bits, packed low to high.
float glyph(int idx, vec2 g) {
  ivec2 c = ivec2(floor(g * 5.0));
  if (c.x < 0 || c.x > 4 || c.y < 0 || c.y > 4) return 0.0;
  float rows[5];
  if (idx <= 0) { rows[0]=0.0; rows[1]=0.0; rows[2]=4.0;  rows[3]=0.0;  rows[4]=0.0; }        // .
  else if (idx == 1) { rows[0]=0.0; rows[1]=4.0; rows[2]=14.0; rows[3]=4.0; rows[4]=0.0; }    // +
  else if (idx == 2) { rows[0]=17.0; rows[1]=10.0; rows[2]=4.0; rows[3]=10.0; rows[4]=17.0; } // x
  else if (idx == 3) { rows[0]=14.0; rows[1]=17.0; rows[2]=17.0; rows[3]=17.0; rows[4]=14.0; }// O
  else if (idx == 4) { rows[0]=21.0; rows[1]=14.0; rows[2]=31.0; rows[3]=14.0; rows[4]=21.0; }// *
  // densest: a bold O, not a solid block — a block has no gaps and the hot
  // regions turned into flat slabs instead of printed characters
  else { rows[0]=14.0; rows[1]=31.0; rows[2]=31.0; rows[3]=31.0; rows[4]=14.0; }              // @
  float row = rows[4 - c.y];
  float bit = floor(mod(row / exp2(float(4 - c.x)), 2.0));
  return bit;
}

void main() {
  vec2 uvp = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;

  float cols = clamp(floor(uResolution.x / max(4.0, cellsize)), 16.0, 220.0);
  // cell snapped to a whole multiple of 6 px (5 bits + gutter) so every glyph bit is the same
  // number of pixels wide: no uneven 3/4 px strokes
  float cpx = max(6.0, floor(uResolution.x / cols / 6.0 + 0.5) * 6.0);
  vec2 grid = uResolution / cpx;
  vec2 cell = floor(gl_FragCoord.xy / cpx);
  vec2 inCell = fract(gl_FragCoord.xy / cpx);

  vec2 sp = ((cell + 0.5) / grid - 0.5) * vec2(aspect, 1.0) * sourcezoom * 6.0;
  float v = source(sp);

  float lv = clamp(floor(levels), 2.0, 6.0);
  // spread the levels over the whole glyph ramp: the top level always prints '@'
  int idx = int(floor(clamp(floor(v * lv), 0.0, lv - 1.0) * 5.0 / (lv - 1.0) + 0.5));
  // a glyph stroke is one bit = a sixth of the cell: ~2 px at the default
  // size. Dilate it so strokes reach mpx pixels (never past half a bit: the glyphs must stay glyphs, not blobs)
  vec2 cellPx = vec2(cpx);
  // bit = cellPx/6 px (5 bits + 1-bit gutter); dil in glyph space (1 px = 1.2/cellPx), capped at half a bit
  vec2 dil = clamp(0.5 * ((3.0 + 4.0 * uLineBoost) - cellPx / 6.0), vec2(0.0), cellPx / 12.0) * 1.2 / cellPx;
  // glyph drawn at 1/1.2 of the cell: a 1-bit gutter (top/right) keeps dense neighbours apart, bits stay whole pixels
  vec2 g = inCell * 1.2;
  float ink = glyph(idx, g);
  // frame-uniform branch: at large cells dil is 0 and the 4 taps would repeat the first
  if (dil.x > 0.0 || dil.y > 0.0) {
    ink = max(max(ink, glyph(idx, g + vec2(dil.x, 0.0))),
              max(glyph(idx, g - vec2(dil.x, 0.0)),
                  max(glyph(idx, g + vec2(0.0, dil.y)), glyph(idx, g - vec2(0.0, dil.y)))));
  }

  // a scanline-ish tint: hotter cells drift toward color2
  vec3 tint = mix(uColor1, uColor2, smoothstep(0.35, 0.95, v));
  tint = mix(tint, uColor3, step(0.985, hash(cell + floor(uTime * 6.0))));

  vec3 c = tint * ink * (0.55 + 0.8 * v + 0.6 * uBeat);
  // one printed row sweeps the page per bar: terminal refresh on the beat grid
  float rowHit = step(abs(cell.y - floor(fract(uBeatClock * 0.25) * grid.y)), 0.5);
  c *= 1.0 + 0.9 * rowHit;
  c += uColor1 * 0.02 * v;                       // faint phosphor in empty cells
  gl_FragColor = vec4(c, 1.0);
}
