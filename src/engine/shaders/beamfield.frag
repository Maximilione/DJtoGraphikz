precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uBassTime;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float beams;
uniform float scan;
uniform float haze;

// Beamfield: a stage laser rig seen from the audience, in fog. Movers hang on
// a truss at the back and sit on the floor; every one throws a beam towards
// the camera. There is no marching: for each pixel ray the closest approach to
// each beam line is computed in closed form, and the gaussian beam profile
// (it widens with distance) integrated across the haze gives the glow, boosted
// where the view crosses the beam at a shallow angle, as real fog does. Beams
// sweep in fans to the beat clock and the kick opens and flares them. Each
// mover has a bright lens glow. Colours cycle through the palette.

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float kick = clamp(uBassHit, 0.0, 1.0);
  vec3 r = normalize(vec3(uv, 1.2));
  float nb = floor(clamp(beams, 4.0, 12.0) + 0.5);
  float sp = clamp(scan, 0.0, 2.0);
  float hz = clamp(haze, 0.3, 2.0);
  float clk = uBeatClock * 0.5 * (0.4 + 0.6 * sp) + uTime * 0.15;

  // fog: palette gradient, brighter low where the floor lights scatter
  vec2 lc = uv - vec2(0.0, -0.2);
  vec3 col = mix(uColor1 * 0.10, uColor2 * 0.06, smoothstep(-0.5, 0.5, uv.y)) * hz;
  col += uColor3 * 0.04 * hz / (1.0 + 5.0 * dot(lc, lc));

  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    if (fi >= nb) break;
    float u = (fi + 0.5) / nb;                  // position along the rig
    bool top = mod(fi, 2.0) < 0.5;
    vec3 o = vec3((u - 0.5) * 9.0, top ? 2.4 : -2.0, 7.0 + 2.0 * sin(fi * 1.9));
    // sweeping aim: a fan on the beat clock
    float a = sin(clk * (1.0 + 0.25 * mod(fi, 3.0)) + fi * 0.8) * (0.55 + 0.25 * kick) * (0.4 + 0.6 * sp);
    float e = cos(clk * 0.7 + fi * 1.3) * 0.25 * (0.4 + 0.6 * sp);
    vec3 b = normalize(vec3(-o.x * 0.12 + sin(a), top ? -0.32 + e : 0.3 + e, -1.0));

    vec3 nrm = cross(r, b);
    float nl2 = max(dot(nrm, nrm), 1e-5);
    float nl = sqrt(nl2);
    float s = dot(cross(o, b), nrm) / nl2;      // along the pixel ray
    float t = dot(cross(r, o), nrm) / nl2;      // along the beam
    float dist = abs(dot(o, nrm)) / nl;
    float w = 0.05 * (1.0 + 0.12 * max(t, 0.0)) * (1.0 + 0.5 * kick);
    float vis = (s > 0.0 && t > 0.0) ? 1.0 : 0.0;
    float g = exp(-dist * dist / (w * w)) / max(nl, 0.12) * exp(-max(t, 0.0) * 0.045) * vis;

    float m = fract(u * 1.5 + fi * 0.17);
    vec3 pc = m < 0.5 ? mix(uColor1, uColor2, m * 2.0) : mix(uColor2, uColor3, m * 2.0 - 1.0);
    pc = mix(pc, uColor3, 0.25);
    col += pc * g * 0.16 * hz * (0.8 + 0.8 * kick + 0.4 * uEnergy);

    // lens of the mover
    vec3 od = o / length(o);
    float lens = 0.0012 / (1.0 - dot(r, od) + 0.0012);
    col += mix(pc, vec3(1.0), 0.4) * lens * (0.6 + kick) * 0.5;
  }

  col = col / (1.0 + 0.55 * col);
  col *= clamp(1.2 - dot(uv, uv) * 0.6, 0.5, 1.0);
  gl_FragColor = vec4(col, 1.0);
}
