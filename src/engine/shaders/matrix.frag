precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uHighTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float cols;
uniform float fallspeed;
uniform float trailfade;

varying vec2 vUv;

float hash(float n) { return fract(sin(n) * 43758.5453); }

// Blocky 4x6 glyph: dense enough to read as a character, cheap enough to be free
float glyph(vec2 p, float seed) {
  vec2 g = floor(p * vec2(4.0, 6.0));
  float on = step(0.42, hash(g.x * 7.0 + g.y * 13.0 + seed * 31.0));
  // keep a margin so glyphs don't fuse into a solid block
  vec2 m = step(vec2(0.06), fract(p * vec2(4.0, 6.0))) * step(fract(p * vec2(4.0, 6.0)), vec2(0.94));
  return on * m.x * m.y;
}

void main() {
  vec2 pixel = gl_FragCoord.xy;
  float t = uTime;

  float columns = max(cols + uMid * 12.0, 4.0);
  float cellW = uResolution.x / columns;
  float cellH = cellW * 1.4;
  float rows = max(uResolution.y / cellH, 2.0);

  vec2 cell = floor(pixel / vec2(cellW, cellH));
  vec2 cellUv = fract(pixel / vec2(cellW, cellH));

  // measure downward: the rain falls from the top of the screen
  float rowFromTop = rows - 1.0 - cell.y;

  float seed = hash(cell.x * 7.77);
  float tail = 6.0 + hash(cell.x * 3.31) * 16.0;      // per-column trail length
  float speed = (fallspeed + hash(cell.x * 0.123) * 3.0) * (1.0 + uBass * 1.6);

  // head travels down; the cycle is longer than the screen so columns restart
  // staggered instead of all together
  float cycle = rows + tail;
  float head = mod(t * speed * 3.0 + seed * cycle, cycle);

  // distance ABOVE the head: this is the trail (the old code used
  // fract(integer + phase), identical for every cell of a column — the whole
  // effect was flat noise instead of falling code)
  float d = head - rowFromTop;
  float inTrail = step(0.0, d) * step(d, tail);
  float fade = exp(-d / (tail * (0.25 + trailfade * 0.35)));

  // glyphs flicker on their own clock, faster near the head
  float flick = floor(t * (2.0 + hash(cell.x + cell.y * 3.7) * 6.0) + uHighTime);
  float g = glyph(cellUv, floor(cell.x * 31.0 + cell.y * 17.0) + flick);

  float headMask = smoothstep(1.6, 0.0, d) * inTrail;

  vec3 color = vec3(0.0);
  color += uColor1 * g * fade * inTrail * 0.9;                 // body of the trail
  color += mix(uColor2, vec3(1.0), 0.6) * g * headMask * 1.7;  // bright head
  color += uColor3 * g * inTrail * pow(fade, 4.0) * 0.35;      // accent near the head

  // kick: a few columns light up whole
  float flashCol = step(0.93, hash(cell.x * 3.33 + floor(uTime * 2.0)));
  color += uColor1 * flashCol * uBassHit * g * 1.2;

  color *= 0.92 + 0.08 * sin(pixel.y * 3.0);                    // scanlines
  color *= 0.75 + uEnergy * 0.45;
  gl_FragColor = vec4(min(color, vec3(2.0)), 1.0);
}
