precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBassTime;
uniform float ringcount;
uniform float spacing;
uniform float gapfreq;
uniform float uLineBoost;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  vec3 color = vec3(0.0);
  // line boost: authored widths scale up, and never fall under mpx pixels
  float lb = 1.0 + 2.5 * uLineBoost;
  float mpx = 3.0 + 4.0 * uLineBoost;

  // Expanding rings from center. Travelled distance is accumulated time:
  // t * (speed from bass) would make every ring jump on each bass change
  // once t is in the thousands.
  float travel = t * 0.15 + uBassTime * 0.2;
  float ringSpacing = spacing + uMid * 0.04;
  float haloK = 30.0 / (1.0 + uLineBoost);
  float haloAmp = 0.7 * (1.0 - 0.5 * uEnergy);
  // Per-ring phases are linear in the ring index, so inside the loop the
  // sin/cos pairs advance by a fixed rotation (angle-addition, 4 mads) instead
  // of 3 sin per ring: thickness phase steps by 2, gap phase by 1 + 0.1 t.
  const vec2 stepT = vec2(-0.41614684, 0.9092974);   // cos 2, sin 2
  float dG = 1.0 + 0.1 * t;
  vec2 stepG = vec2(cos(dG), sin(dG));

  // Multiple concentric ring systems
  for (int sys = 0; sys < 3; sys++) {
    float fs = float(sys);
    vec2 center = vec2(
      sin(t * 0.3 + fs * TAU / 3.0) * 0.15,
      cos(t * 0.4 + fs * TAU / 3.0) * 0.15
    );

    // the system's rotation only shifts the angle: no rot() on the point
    vec2 q = uv - center;
    float r = length(q);
    float a0 = atan(q.y, q.x) + t * 0.1 * (1.0 + fs * 0.3);
    // same (-PI, PI] cut as the atan of the rotated point had: the gap
    // frequency need not be an integer, so the cut location matters
    float a = a0 - TAU * floor((a0 + PI) * (1.0 / TAU));
    // |r - ringR| has the pixel footprint of r (ringR is uniform per ring):
    // one fwidth per system, in uniform flow, outside the loop
    float fw = fwidth(r) * mpx;

    vec3 base;
    if (sys == 0) base = uColor1;
    else if (sys == 1) base = uColor2;
    else base = uColor3;
    // Color shift along ring
    vec3 ringColor = mix(base, uColor3, sin(a * 2.0 + t) * 0.3 + 0.3);

    vec2 th = vec2(sin(a * 4.0 + t), cos(a * 4.0 + t));
    float gA = a * (gapfreq + fs * 2.0) + t * 0.5;
    vec2 g = vec2(sin(gA), cos(gA));

    // Constant loop bound (= param max), dynamic break on the actual count
    for (float i = 0.0; i < 16.0; i++) {
      if (i >= ringcount) break;
      float ringR = mod(i * ringSpacing + travel, 1.0);

      // Ring thickness varies with angle
      float thickness = 0.006 + th.x * 0.002;

      // Broken ring — gaps
      float gapMask = smoothstep(0.0, 0.3, g.x);

      float rd = abs(r - ringR);
      float ring = smoothstep(max(thickness * lb, fw), 0.0, rd) * gapMask;
      // idle floor: a soft halo around each ring, so the systems read in silence
      ring += exp(-rd * haloK) * gapMask * haloAmp;

      // Fade with expansion
      color += ringColor * ring * (1.0 - ringR) * 0.7;

      th = vec2(th.x * stepT.x + th.y * stepT.y, th.y * stepT.x - th.x * stepT.y);
      g = vec2(g.x * stepG.x + g.y * stepG.y, g.y * stepG.x - g.x * stepG.y);
    }
  }

  float ruv = length(uv);
  float fwR = fwidth(ruv) * mpx;
  // Ring burst rides the beat phase, so it expands in time with the music
  {
    float bp = 1.0 - uBeatPhase;
    float preR = uBeatPhase * 0.9;
    float dpre = abs(ruv - preR);
    float pre = smoothstep(max(0.012 * lb, fwR), 0.0, dpre) * bp * 0.6;
    color += mix(uColor2, uColor3, uBarPhase) * pre;
  }
  if (uBeat > 0.1) {
    float burstR = uBeat * 0.8;
    float dbu = abs(ruv - burstR);
    float burst = smoothstep(max(0.01 * lb, fwR), 0.0, dbu);
    color += mix(uColor1, uColor2, 0.5) * burst * 1.5 * uBeat;
  }

  // Connecting lines between ring systems
  float linePattern = sin(uv.x * 50.0 + t * 2.0) * sin(uv.y * 50.0 - t * 1.5);
  linePattern = smoothstep(0.95, 1.0, linePattern);
  color += uColor3 * linePattern * 0.2 * (0.3 + 0.7 * uEnergy);

  color *= 1.0 + uBeat * 0.3;
  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}
