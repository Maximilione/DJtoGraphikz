precision highp float;

uniform sampler2D tDiffuse;
uniform vec2  uResolution;
uniform float uZoom;        // 1 = untouched; >1 closer, <1 further away
uniform float uRotation;    // radians
uniform vec2  uPan;         // in screen widths, 0 = centred
uniform float uTile;        // 1 = off; 2+ = mirrored grid of that many
uniform float uPushAmt;     // how much a kick pushes in
uniform float uBeat;        // the beat pulse, already decayed
// Impact layer (audio-driven, see engine/impact.ts) — all 0 when silent
uniform vec2  uShake;       // screen widths
uniform float uPunch;       // extra zoom factor, 1 = none
uniform float uWarp;        // mid-band wobble amplitude (uv)
uniform float uChroma;      // high-band channel split (uv)
uniform float uSparkle;     // high-band glitter, additive, tiny
uniform float uFlash;       // soft lift towards white, capped by the engine
uniform float uTime;

varying vec2 vUv;

/**
 * The camera, applied to the whole scene before anything else looks at it.
 *
 * It resamples what the effect drew rather than asking the effect to move, so
 * one control acts on all 46 built-in effects and on every imported ISF at
 * once — none of which know it exists.
 *
 * Outside the frame it mirrors instead of clamping or going black: a smeared
 * edge reads as a bug, and black reads as a broken projector. Mirroring reads
 * as a deliberate kaleidoscope, which is also what makes the tiling mode work
 * with no extra code.
 */
vec2 mirrorFold(vec2 uv) {
  // fract of the doubled coordinate, folded back: 0..1..0 with no seam
  // 1 - fold, so uv inside 0..1 maps to itself (the bare fold flipped the image)
  return 1.0 - abs(fract(uv * 0.5) * 2.0 - 1.0);
}

void main() {
  // Rotation has to happen in square space or it shears the image on a 16:9
  // frame; the aspect is undone straight after.
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  vec2 uv = vUv - 0.5;
  uv.x *= aspect;

  // A kick pushes the camera in. Zero when the fader is down, so a silent room
  // is perfectly still.
  float zoom = max(0.05, uZoom * uPunch * (1.0 + uPushAmt * uBeat));
  uv /= zoom;

  float c = cos(uRotation), s = sin(uRotation);
  uv = mat2(c, -s, s, c) * uv;

  uv.x /= aspect;
  uv += 0.5 + uPan + uShake;
  uv += uWarp * vec2(sin(uv.y * 9.0 + uTime * 2.3), cos(uv.x * 7.0 - uTime * 1.9));

  // Tiling is the same fold, run at a higher frequency.
  uv = mirrorFold(uv * max(1.0, uTile));

  vec3 col;
  if (uChroma > 0.0) {
    vec2 d = (uv - 0.5) * uChroma * 6.0;
    col = vec3(texture2D(tDiffuse, mirrorFold(uv + d)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, mirrorFold(uv - d)).b);
  } else {
    col = texture2D(tDiffuse, uv).rgb;
  }
  // glitter: sparse hash-noise, only where it is already lit a little
  vec2 g = floor(vUv * uResolution * 0.5);
  float h = fract(sin(dot(g, vec2(12.9898, 78.233)) + uTime * 7.0) * 43758.5453);
  col += step(0.985, h) * uSparkle * 4.0 * (0.3 + dot(col, vec3(0.333)));
  // soft flash: lifts towards white, never reaches it
  col += uFlash * (1.0 - col);
  gl_FragColor = vec4(col, 1.0);
}
