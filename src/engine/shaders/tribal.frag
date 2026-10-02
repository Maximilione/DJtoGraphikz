precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float blades;
uniform float spikes;
uniform float turn;

// The eye. A black pupil in an iris of colour 1, a thin bright rim, and N
// tomoe — the commas — orbiting the pupil on a dark ring. They turn on their
// own and faster while the bass plays; on the kick the pupil contracts and the
// tomoe stretch into a star, then settle back. Black room, one eye, ten metres.

#define TAU 6.28318530718

float ring(float x, float c, float w) { float d = (x - c) / w; return exp(-d * d); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  float hit = clamp(uBassHit, 0.0, 1.0);
  hit *= hit;
  // a circle on any wall: the iris follows the short side, and flinches on the kick
  float R = 0.42 * min(aspect, 1.0) * (1.0 - 0.05 * hit);
  vec2 q = p / R;
  float px = 1.5 / (uResolution.y * R);   // antialias width, in iris units
  float rho = length(q);
  float phi = atan(q.y, q.x);
  float n = max(3.0, floor(blades));

  // spin: a slow turn always, and the bass clock on top — it only runs while
  // the bass plays, so the eye speeds up with the track and rests in the break
  float spin = turn * (uTime * 0.3 + uBassTime * 1.2);
  float stretch = clamp(spikes * hit, 0.0, 1.0);

  float pupilR = 0.30 * (1.0 - 0.3 * hit);
  float orbit = 0.57;
  float sector = TAU / n;
  float head = min(0.12, 0.3 * sector * orbit);
  // angle past the nearest tomoe head, centred so the head is whole
  float rel = mod(phi - spin, sector);
  float relc = rel > 0.5 * sector ? rel - sector : rel;

  // the head: a disc on the orbit
  vec2 ql = rho * vec2(cos(relc), sin(relc));
  float dHead = length(ql - vec2(orbit, 0.0)) - head;
  // the tail: an arc trailing the head, thinning to a point and bending in
  float L = mix(min(0.8 * sector, 1.3), 0.98 * sector, stretch);
  float ft = clamp(rel / L, 0.0, 1.0);
  float rc = orbit - 0.07 * ft;
  float th = head * pow(1.0 - ft, 1.3);
  float dTail = rel < L ? abs(rho - rc) - th : 1.0;
  float tomoe = 1.0 - smoothstep(-px, px, min(dHead, dTail));
  // the star: on the kick each head throws a blade to the rim
  float tipR = orbit + (1.0 - orbit) * 1.05 * stretch;
  float ha = (head / orbit) * clamp((tipR - rho) / max(tipR - orbit, 1e-3), 0.0, 1.0);
  float dBlade = rho * (abs(relc) - ha);
  float blade = (1.0 - smoothstep(-px, px, dBlade)) * step(orbit, rho) * smoothstep(0.0, 0.05, stretch);
  float dark = max(tomoe, blade);

  float iris = 1.0 - smoothstep(1.0 - px, 1.0 + px, rho);
  float pupil = 1.0 - smoothstep(pupilR - px, pupilR + px, rho);
  // iris shading: lit near the pupil, fibres, the dark orbit ring the tomoe sit on
  float shade = mix(1.0, 0.5, smoothstep(pupilR, 1.0, rho));
  shade *= 1.0 + 0.08 * sin(phi * 46.0 + rho * 9.0) * sin(phi * 19.0 - rho * 5.0);
  shade *= 1.0 - 0.75 * ring(rho, orbit, 0.012);
  shade *= 1.0 + 0.5 * hit;
  // thin bright rings: around the pupil and at the limbus
  float rims = ring(rho, pupilR + 0.025, 0.014) + ring(rho, 0.955, 0.02) * 0.8;

  vec3 rimc = mix(uColor1, vec3(1.0), 0.55);
  float body = iris * (1.0 - pupil) * (1.0 - dark);
  vec3 col = uColor1 * shade * body;
  col += rimc * rims * body;
  // a soft bloom off the iris into the dark, breathing with the bass
  col += uColor1 * exp(-max(rho - 1.0, 0.0) * 5.0) * (1.0 - iris) * (0.12 + 0.18 * uBass);
  // the wet glint: an eye, not a logo
  float glint = 1.0 - smoothstep(0.05, 0.075, length(q - vec2(-0.19, 0.21)));
  col += vec3(1.0) * glint * 0.85;
  col *= 0.85 + 0.25 * uBeat;
  gl_FragColor = vec4(col, 1.0);
}
