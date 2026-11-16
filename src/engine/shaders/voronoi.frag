precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uHighTime;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float cells;
uniform float edgewidth;

varying vec2 vUv;

#define TAU 6.28318530718

vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)))) * 43758.5453);
}

// animated site of a cell: bass drives the speed (integrated clock), not the
// position, so the lattice surges instead of shaking in unison
vec2 site(vec2 cell, float t) {
  return 0.5 + 0.5 * sin(t * 0.8 + TAU * hash2(cell) + uBassTime * 0.6);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;

  // Scale
  float scale = cells + uMid * 3.0;
  vec2 p = uv * scale;

  // Voronoi
  vec2 ip = floor(p);
  vec2 fp = fract(p);

  // pass 1: nearest site (squared distances, one sqrt after the loop)
  float d1 = 64.0;
  vec2 mr = vec2(0.0);      // vector from the pixel to the nearest site
  vec2 mb = vec2(0.0);      // its cell offset
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 diff = neighbor + site(ip + neighbor, t) - fp;
      float dd = dot(diff, diff);
      if (dd < d1) { d1 = dd; mr = diff; mb = neighbor; }
    }
  }
  d1 = sqrt(d1);
  // stable id: the cell, not the moving site (that re-hashed the hue every frame)
  vec2 nearestCell = ip + mb;

  // pass 2: exact distance to the cell border (F2-F1 pinched at vertices and
  // varied in width), doubled to keep the old F2-F1 scale for the edge widths
  float bd = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = mb + vec2(float(x), float(y));
      vec2 r = neighbor + site(ip + neighbor, t) - fp;
      vec2 dr = r - mr;
      if (dot(dr, dr) > 1e-5) bd = min(bd, dot(0.5 * (mr + r), normalize(dr)));
    }
  }

  // Edge detection: sharp neon core + wide halo for the bloom
  float edge = 2.0 * bd;
  float ew = edgewidth + uHigh * 0.05;
  float edgeLine = 1.0 - smoothstep(0.0, ew, edge);
  float halo = exp(-edge * 9.0);

  // Cell color based on point hash
  float cellHue = fract(hash2(nearestCell).x + t * 0.1);
  vec3 cellColor = mix(uColor1, uColor2, cellHue);
  cellColor = mix(cellColor, uColor3, fract(cellHue * 3.0 + 0.5));

  // Cell body: dark at the rim, lit nucleus, per-cell flash on kick/hats
  float shade = pow(max(1.0 - d1 * 0.9, 0.0), 2.0);
  float nuc = exp(-d1 * d1 * 18.0);
  float flash = step(0.7, fract(cellHue * 7.0 + uHighTime * 2.0));
  vec3 color = cellColor * (0.06 + shade * 0.4 + nuc * (0.35 + uBassHit * 0.9 + flash * uHigh * 0.8));

  // Neon edges
  color += mix(uColor1, vec3(1.0), 0.25) * edgeLine * 1.6;
  color += uColor3 * edgeLine * pow(max(1.0 - d1, 0.0), 3.0);
  color += mix(uColor2, uColor1, 0.5) * halo * (0.12 + uEnergy * 0.2);

  // Kick: edges flare, a shockwave ring sweeps out from the center
  color += (uColor1 + uColor2) * edgeLine * (uBeat * 1.4 + uBassHit * 1.2);
  float rr = length(uv);
  float wave = (1.0 - uBassHit) * 1.1;
  color += uColor3 * smoothstep(0.07, 0.0, abs(rr - wave)) * uBassHit * (0.4 + halo * 1.5);

  // Center glow + depth vignette (never fully black)
  color += uColor2 * exp(-rr * 2.0) * uEnergy * 0.5;
  color *= (0.55 + 0.45 * smoothstep(1.2, 0.2, rr)) * (1.0 + uBeat * 0.4);
  color += uColor2 * 0.02;
  // soft knee: kick edges roll off instead of clipping flat
  vec3 kn = max(color - 0.8, 0.0);
  color = min(color, 0.8) + 0.2 * (1.0 - exp(-kn * 2.0));

  gl_FragColor = vec4(color, 1.0);
}
