precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uHighHit;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float grain;
uniform float roll;
uniform float bands;
uniform float uBarPhase;

// Dead channel. Lost signal: coarse snow with a ghost picture (colour bars,
// target, cross, play arrow) surfacing from it on every kick, a rolling sync
// band, tracking tears, RGB ghosting, scanlines and CRT glow. Palette-tinted.

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// ghost picture: x,y in frame units (y -0.5..0.5), returns rgb
vec3 pic(vec2 p, float sc) {
  float ax = p.x;
  if (sc < 0.5) { // colour bars
    float i = floor((ax * 0.8 + 0.5) * 6.0);
    i = clamp(i, 0.0, 5.0);
    vec3 c = i < 1.0 ? vec3(1.0) : i < 2.0 ? uColor1 : i < 3.0 ? uColor2 : i < 4.0 ? uColor3 : i < 5.0 ? vec3(0.15) : uColor1 * uColor2;
    return c * (abs(p.y) < 0.4 ? 1.0 : 0.0);
  } else if (sc < 1.5) { // target
    float r = length(p);
    float ring = step(0.5, fract(r * 7.0));
    return mix(uColor2, uColor1, ring) * step(r, 0.42) + uColor3 * step(abs(p.x), 0.004) * step(r, 0.46) + uColor3 * step(abs(p.y), 0.004) * step(r, 0.46);
  } else if (sc < 2.5) { // big cross
    float d = min(abs(p.x - p.y), abs(p.x + p.y));
    return mix(uColor3, uColor1, step(0.5, fract(p.y * 5.0))) * step(d, 0.06) * step(length(p), 0.5);
  }
  if (sc < 3.5) { // play arrow
    float a = step(abs(p.y), 0.34 - (p.x + 0.22) * 0.6) * step(-0.22, p.x) * step(p.x, 0.3);
    return mix(uColor1, uColor2, 0.5 + 0.5 * p.y * 2.0) * a;
  }
  // stylised face: oval head, two eyes, mouth bar
  float head = step(length(p * vec2(1.0, 0.8)), 0.36) - step(length(p * vec2(1.0, 0.8)), 0.32);
  float eyes = step(length(vec2(abs(p.x) - 0.11, p.y - 0.07)), 0.045);
  float mouth = step(abs(p.x), 0.13) * step(abs(p.y + 0.14), 0.014);
  return mix(uColor3, uColor1, 0.3) * clamp(head + eyes + mouth, 0.0, 1.0) + uColor2 * 0.25 * step(length(p * vec2(1.0, 0.8)), 0.32);
}

void main() {
  vec2 res = uResolution;
  float asp = res.x / res.y;
  vec2 uv = gl_FragCoord.xy / res;
  // CRT curvature: barrel-warp the frame, black bezel outside the glass
  vec2 cc = uv - 0.5;
  uv = cc * (1.0 + 0.10 * dot(cc, cc) * 2.0) + 0.5;
  float glass = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float g = max(1.0, grain);
  float tk = mod(floor(uTime * 24.0), 1024.0);
  float bt = mod(uBassTime, 64.0);
  float hit = clamp(uBassHit, 0.0, 1.0);

  // sync roll band position
  float y = fract(uv.y - bt * 0.25 * roll - mod(uTime, 50.0) * 0.02);
  float inBand = smoothstep(0.0, 0.08, y) * smoothstep(0.22, 0.14, y);
  float edgeLine = exp(-abs(y - 0.22) * 90.0);

  // per-row horizontal displacement: hats tear, tracking error inside the
  // band, big block jumps on the kick (and a harder one at bar start)
  float row = floor(gl_FragCoord.y / g);
  float rh = hash(vec2(row, tk));
  float blk = hash(vec2(floor(uv.y * 9.0), floor(bt * 2.0)));
  float bar = smoothstep(0.92, 1.0, uBarPhase) + smoothstep(0.06, 0.0, uBarPhase);
  float tear = (rh - 0.5) * (uHighHit * 0.10 + inBand * bands * 0.12)
             + (step(0.75, blk) * (blk - 0.87)) * hit * (0.35 + 0.5 * bar);
  tear += sin(uv.y * 40.0 + tk) * edgeLine * 0.01 * bands;

  // ghost picture: scene changes every 4 kicks
  float sc = mod(floor(bt * 0.25), 5.0);
  float emerge = clamp(0.2 + 0.7 * hit + 0.35 * uBeat + 0.35 * bar + 0.3 * uEnergy, 0.0, 1.2);
  vec2 q = vec2(uv.x - 0.5 + tear, uv.y - 0.5);
  q *= vec2(asp, 1.0);
  float sz = 1.0 + 0.06 * hit;
  float ab = 0.004 + 0.02 * hit + 0.01 * uHighHit; // chroma offset
  vec3 ghost = vec3(0.0);
  ghost.r = pic((q + vec2(ab * asp, 0.0)) / sz, sc).r;
  ghost.g = pic(q / sz, sc).g;
  ghost.b = pic((q - vec2(ab * asp, 0.0)) / sz, sc).b;
  // ghost only lives where the noise lets it: blocky, flickering mask
  vec2 c = floor((gl_FragCoord.xy + vec2(tear * res.x, 0.0)) / g);
  float n = hash(c + vec2(fract(uTime * 7.31) * 100.0, fract(uTime * 3.7) * 50.0));
  float n2 = hash(c + vec2(31.7, fract(uTime * 5.1) * 77.0));
  float mask = smoothstep(1.0 - emerge * 0.75, 1.0, n2 + 0.25 * sin(uv.y * 6.0 + bt));
  ghost *= mask * (0.25 + 0.6 * emerge);
  // thin horizontal break-up of the picture
  ghost *= 0.75 + 0.25 * step(0.5, fract(gl_FragCoord.y * 0.5));

  // snow: tinted, per-channel slightly different
  float snow = pow(n, 6.0) * (0.4 + 0.8 * uEnergy);
  vec3 sn = snow * mix(vec3(1.0), uColor1, 0.2);
  sn.r += pow(hash(c + 7.7 + tk), 10.0) * 0.5 * uHigh;
  sn.b += pow(hash(c + 3.3 + tk), 10.0) * 0.5 * uHigh;
  sn *= 1.0 - inBand * bands * 0.85;

  // fine per-pixel grain on top of the coarse snow
  float fine = hash(gl_FragCoord.xy + tk * 1.7);
  sn += (fine - 0.5) * 0.12 * (0.5 + uEnergy);

  // wide soft luma waves (tv hum bars) in palette 2
  float hum = 0.5 + 0.5 * sin(uv.y * 14.0 - bt * 2.0);
  vec3 col = sn + ghost + uColor2 * hum * hum * 0.07 * (0.4 + uBass);
  col += mix(vec3(1.0), uColor3, 0.5) * edgeLine * bands * (0.35 + 0.65 * uBass);

  // SMPTE bars flash: a controlled burst on some kicks, top two thirds
  float smpte = hit * step(0.78, hash(vec2(floor(bt), 5.0)));
  if (smpte > 0.0 && uv.y > 0.33) {
    float bi = floor(uv.x * 7.0);
    vec3 sb = bi < 1.0 ? vec3(0.75) : bi < 2.0 ? vec3(0.75, 0.75, 0.0) : bi < 3.0 ? vec3(0.0, 0.75, 0.75)
            : bi < 4.0 ? vec3(0.0, 0.75, 0.0) : bi < 5.0 ? vec3(0.75, 0.0, 0.75) : bi < 6.0 ? vec3(0.75, 0.0, 0.0) : vec3(0.0, 0.0, 0.75);
    col = mix(col, mix(sb, uColor1 * 0.8, 0.3), 0.6 * smpte);
  }
  // block glitch on the bass: a few rectangles swap channels and shift
  vec2 bid = floor(uv * vec2(10.0, 7.0));
  float gb = step(0.9, hash(bid + floor(bt * 3.0))) * hit;
  col = mix(col, col.gbr * 1.2 + 0.03, gb);

  // brightness flicker
  col *= 0.92 + 0.08 * hash(vec2(tk, 1.3)) + 0.05 * sin(uTime * 90.0) * uHigh;

  // scanlines + CRT glow (soft bright halo of what is bright, vignette in frame units)
  col *= 0.78 + 0.22 * step(0.5, fract(gl_FragCoord.y * 0.5));
  float lum = dot(col, vec3(0.333));
  col += col * smoothstep(0.35, 0.9, lum) * 0.5;
  vec2 vq = (uv - 0.5) * vec2(asp, 1.0);
  col *= 1.0 - smoothstep(0.35, 1.1, length(vq)) * 0.6;
  col += mix(vec3(1.0), uColor1, 0.5) * hit * 0.05;
  // soft tone-map and cap: never a flat white screen
  col = col / (1.0 + 0.55 * col);
  col = min(col * 1.25, vec3(0.92));
  gl_FragColor = vec4(col * (0.15 + 0.85 * glass), 1.0);
}
