precision highp float;

uniform sampler2D tDiffuse;
uniform vec2  uResolution;
uniform float uZoom;        // 1 = untouched; >1 closer, <1 further away
uniform float uRotation;    // radians
uniform vec2  uPan;         // in screen widths, 0 = centred
uniform float uTile;        // 1 = off; 2+ = mirrored grid of that many
uniform float uPushAmt;     // how much a kick pushes in
uniform float uBeat;        // the beat pulse, already decayed

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
  vec2 t = abs(fract(uv * 0.5) * 2.0 - 1.0);
  return t;
}

void main() {
  // Rotation has to happen in square space or it shears the image on a 16:9
  // frame; the aspect is undone straight after.
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  vec2 uv = vUv - 0.5;
  uv.x *= aspect;

  // A kick pushes the camera in. Zero when the fader is down, so a silent room
  // is perfectly still.
  float zoom = max(0.05, uZoom * (1.0 + uPushAmt * uBeat));
  uv /= zoom;

  float c = cos(uRotation), s = sin(uRotation);
  uv = mat2(c, -s, s, c) * uv;

  uv.x /= aspect;
  uv += 0.5 + uPan;

  // Tiling is the same fold, run at a higher frequency.
  uv = mirrorFold(uv * max(1.0, uTile));

  gl_FragColor = texture2D(tDiffuse, uv);
}
