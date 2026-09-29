precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float dots;
uniform float contrast;
uniform float drift;

// Photocopied flyer. A dark field is sampled once per dot on a 45° screen and
// the dot's radius is the field's brightness there — black paper, white ink.
// The field is a warped sine sheet with a kick ring rolling out of the centre.

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float field(vec2 p, float t) {
  vec2 q = p;
  q += 0.25 * vec2(sin(p.y * 2.1 + t * 0.7), cos(p.x * 1.7 - t * 0.5));
  float v = 0.5 + 0.5 * sin(q.x * 3.0 + t) * sin(q.y * 2.3 - t * 0.6);
  v = mix(v, 0.5 + 0.5 * sin(length(q) * 9.0 - t * 2.0), 0.35);
  // kick ring: one wave per beat, from the centre out
  float ring = exp(-abs(length(p) - uBeatPhase * 1.4) * 5.0) * (0.4 + 0.6 * uBass);
  return clamp(v * 0.75 + ring, 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float t = uTime * drift;

  // 45° screen, the way a real halftone is angled
  vec2 s = rot(0.785398) * p * dots;
  vec2 cell = floor(s);
  vec2 f = fract(s) - 0.5;
  vec2 centre = rot(-0.785398) * ((cell + 0.5) / dots);

  float v = field(centre, t);
  v = pow(v, contrast);
  float r = v * 0.62;
  float aa = 1.5 * dots / uResolution.y;
  float ink = 1.0 - smoothstep(r, r + aa, length(f));

  // ink is white with a breath of the palette; paper is black
  vec3 inkc = mix(vec3(1.0), uColor1, 0.25 + 0.35 * uHigh);
  vec3 col = inkc * ink * (0.85 + 0.3 * uBeat);
  gl_FragColor = vec4(col, 1.0);
}
