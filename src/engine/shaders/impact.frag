precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform float uBarPhase;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float rings;
uniform float width;
uniform float fade;

// Shockwaves, layered. Each beat fires a thick wave (bright front, long
// coloured wake) that also bends the space it crosses; radial sparks fly out
// with it, cracks of light split the plane, a heart beats at the centre and the
// whole blast relocates every 4 bars. Fine ripple grid underneath for detail.

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h1(float x) { return fract(sin(x * 91.3458) * 47453.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float bar = floor(uBeatClock / 16.0);
  float bm = mod(bar, 8.0);
  // the epicentre hops every 4 bars (16 beats), eased in on the downbeat
  vec2 c0 = (vec2(h1(bm + 1.0), h1(bm + 7.0)) - 0.5) * vec2(0.5 * aspect, 0.3) * step(0.5, bm);
  p -= c0;
  float mn = min(1.0, aspect);
  float beat = floor(uBeatClock);
  float ph = fract(uBeatClock);
  float n = clamp(floor(rings), 1.0, 8.0);
  float a0 = atan(p.y, p.x);
  float r0 = length(p);

  // space distortion: every wave in flight pushes the plane outwards
  float push = 0.0;
  for (int k = 0; k < 8; k++) {
    if (float(k) >= n) break;
    float age = ph + float(k);
    float rad = age * 0.2 + 0.02;
    float life = exp(-age * fade * 0.7);
    push += exp(-pow((r0 - rad) / 0.07, 2.0)) * life;
  }
  vec2 q = p * (1.0 - 0.09 * push) ;
  float lobes = 5.0 + 2.0 * floor(h1(bm + 3.0) * 3.0);
  float r = length(q) * (1.0 + 0.05 * cos(a0 * lobes + uBassTime * 0.5 + bm));
  float a = atan(q.y, q.x);

  vec3 col = vec3(0.0);
  float fw = fwidth(r) * 1.5;
  for (int k = 0; k < 8; k++) {
    if (float(k) >= n) break;
    float age = ph + float(k);
    float sd = mod(beat - float(k), 16.0);
    float radius = age * 0.2 + 0.02;
    float life = exp(-age * fade * 0.7);
    float w = max(0.014 * width * (1.0 + age * 0.35), fw);
    float d = r - radius;
    // hard bright front, long wake trailing behind it
    float front = exp(-d * d / (w * w));
    float wake = d < 0.0 ? exp(d / (w * 6.0 + 0.04)) : exp(-d / (w * 0.8));
    vec3 ringc = mix(uColor1, uColor3, h1(sd + 2.0));
    col += (mix(ringc, vec3(1.0), front * 0.7) * front * 1.5 + uColor2 * wake * 0.22) * life;
    // sparks riding the front: radial streaks in angular cells
    float cells = 36.0 + 12.0 * floor(h1(sd) * 4.0);
    float ca = a * cells / 6.2831853;
    float id = floor(ca);
    float hh = h1(id + sd * 13.0);
    float streak = smoothstep(0.35, 0.0, abs(fract(ca) - 0.5) - 0.12) * step(0.45, hh);
    float lead = radius + hh * 0.09;
    float tail = smoothstep(0.0, 0.1, lead - r) * smoothstep(0.16, 0.0, lead - r) * step(r, lead);
    col += mix(uColor3, vec3(1.0), 0.5) * streak * tail * life * 1.6;
  }

  // cracks of light: thin angular fissures, they flare on the kick and
  // reshuffle every bar
  float cr = a * 1.2732395 + sin(r * 18.0 + bar) * 0.35 + bar * 1.7;
  float crack = exp(-abs(fract(cr) - 0.5) * 70.0 * (0.5 + r)) * exp(-r * 3.2);
  col += mix(uColor2, vec3(1.0), 0.35) * crack * (0.12 + 0.9 * uBassHit + 0.3 * uBeat);

  // fine ripple lattice underneath
  float guide = exp(-abs(fract(r * 9.0 - uBassTime * 0.1) - 0.5) * 30.0) * 0.1;
  float guide2 = exp(-abs(fract(r * 2.0) - 0.5) * 16.0) * 0.07;
  col += uColor1 * (guide + guide2 + exp(-r * 4.0) * 0.1) * (1.0 - 0.4 * uEnergy);

  // the heart: a hex-ish pulsing core with halo and a ring that snaps out
  float pulse = 0.5 * uBassHit + 0.5 * uBeat + 0.3 * uBass;
  float heart = 0.03 + 0.03 * pulse;
  float hr = length(p) * (1.0 + 0.1 * cos(a0 * 6.0 - uBassTime));
  col += vec3(1.0) * exp(-hr * hr / (heart * heart)) * (0.5 + 1.8 * uBassHit);
  col += mix(uColor1, uColor3, 0.5) * exp(-hr * (9.0 - 3.0 * pulse)) * (0.2 + 0.5 * pulse);
  col += uColor3 * exp(-pow((hr - 0.07 - 0.03 * pulse) / 0.012, 2.0)) * (0.3 + 0.7 * uBassHit);

  // every 4 bars a full-frame flash on the downbeat
  float down = step(uBarPhase, 0.04) * (1.0 - uBarPhase / 0.04);
  col += uColor1 * exp(-r0 * 3.0) * down * 0.4;

  col *= 1.0 - smoothstep(0.3, 0.75, length(vec2(uv.x - 0.5, uv.y - 0.5) * vec2(aspect, 1.0)) / max(mn, 0.35) * 0.9);
  col *= 1.0 + 0.3 * uBeat;
  col += vec3(hash(gl_FragCoord.xy + fract(uTime) * 11.0)) * 0.01;
  gl_FragColor = vec4(col, 1.0);
}
