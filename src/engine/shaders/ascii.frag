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
  return clamp(v * (0.55 + 0.9 * uEnergy) + spec * 0.45, 0.0, 1.0);
}

// 5x5 glyphs, densest last. Each row is 5 bits, packed low to high.
float glyph(int idx, vec2 g) {
  ivec2 c = ivec2(floor(g * 5.0));
  if (c.x < 0 || c.x > 4 || c.y < 0 || c.y > 4) return 0.0;
  float rows[5];
  if (idx <= 0) { rows[0]=0.0; rows[1]=0.0; rows[2]=4.0;  rows[3]=0.0;  rows[4]=0.0; }        // .
  else if (idx == 1) { rows[0]=0.0; rows[1]=4.0; rows[2]=14.0; rows[3]=4.0; rows[4]=0.0; }    // +
  else if (idx == 2) { rows[0]=17.0; rows[1]=10.0; rows[2]=4.0; rows[3]=10.0; rows[4]=17.0; } // x
  else if (idx == 3) { rows[0]=21.0; rows[1]=14.0; rows[2]=31.0; rows[3]=14.0; rows[4]=21.0; }// *
  else if (idx == 4) { rows[0]=14.0; rows[1]=17.0; rows[2]=17.0; rows[3]=17.0; rows[4]=14.0; }// O
  else { rows[0]=31.0; rows[1]=31.0; rows[2]=31.0; rows[3]=31.0; rows[4]=31.0; }              // block
  float row = rows[4 - c.y];
  float bit = floor(mod(row / pow(2.0, float(4 - c.x)), 2.0));
  return bit;
}

void main() {
  vec2 uvp = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;

  float cols = clamp(floor(uResolution.x / max(4.0, cellsize)), 16.0, 220.0);
  vec2 grid = vec2(cols, floor(cols / aspect));
  vec2 cell = floor(uvp * grid);
  vec2 inCell = fract(uvp * grid);

  vec2 sp = ((cell + 0.5) / grid - 0.5) * vec2(aspect, 1.0) * sourcezoom * 6.0;
  float v = source(sp);

  float lv = clamp(floor(levels), 2.0, 6.0);
  int idx = int(clamp(floor(v * lv), 0.0, lv - 1.0) * (6.0 / lv));
  float ink = glyph(idx, inCell);

  // a scanline-ish tint: hotter cells drift toward color2
  vec3 tint = mix(uColor1, uColor2, smoothstep(0.35, 0.95, v));
  tint = mix(tint, uColor3, step(0.985, hash(cell + floor(uTime * 6.0))));

  vec3 c = tint * ink * (0.55 + 0.8 * v + 0.6 * uBeat);
  c += uColor1 * 0.02 * v;                       // faint phosphor in empty cells
  gl_FragColor = vec4(c, 1.0);
}
