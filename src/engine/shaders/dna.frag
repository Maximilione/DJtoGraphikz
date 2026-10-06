precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float coils;
uniform float amp;

varying vec2 vUv;

#define PI 3.14159265359

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  // backdrop: vertical palette haze plus a column of light behind the helices
  vec3 color = mix(uColor3, uColor1, uv.y + 0.5) * (0.03 + 0.03 * uEnergy);
  color += mix(uColor1, uColor2, 0.5) * exp(-abs(uv.x) * 3.0) * (0.04 + 0.08 * uBass);

  // Multiple DNA helices: the centre one is nearest (bright, thick), the
  // side ones recede (dimmer, thinner)
  for (int helix = 0; helix < 3; helix++) {
    float fh = float(helix);
    float offsetX = (fh - 1.0) * 0.4;
    float nr = 1.0 - 0.35 * abs(fh - 1.0);

    // Two strands of the helix
    for (int strand = 0; strand < 2; strand++) {
      float phase = float(strand) * PI;
      // bass through the gated clock: t * uBass teleports the helix on every
      // bass change once t is large
      float scrollY = uv.y * coils + t * 2.0 + uBassTime * 3.0;
      float amplitude = amp * (1.0 + uBeat * 0.35) + uMid * 0.05;

      float ph = scrollY + phase + fh * PI * 0.66;
      // Helix curve
      float helixX = sin(ph) * amplitude + offsetX;
      // cos(ph) is the depth: strand in front is bright and thick, behind is dim
      float zf = cos(ph) * 0.5 + 0.5;
      float depthK = (0.45 + 0.55 * zf) * nr;

      // Distance to helix strand: thin bright core plus a wide soft halo
      float d = abs(uv.x - helixX);
      float th = 0.0035 * (0.7 + 0.8 * zf) * nr;
      float glow = th / (d + th);
      glow = min(glow, 2.0);
      float halo = exp(-d * 28.0) * 0.45;

      vec3 strandColor = strand == 0 ? uColor1 : uColor2;
      strandColor = mix(strandColor, uColor3, fh * 0.2);
      strandColor = mix(strandColor, vec3(1.0), clamp(glow - 1.0, 0.0, 1.0) * 0.3);

      color += strandColor * (glow * 0.8 + halo) * depthK * (1.0 + uBass * 0.9);

      // Rungs connecting the two strands
      if (strand == 0) {
        float otherHelixX = sin(scrollY + PI + fh * PI * 0.66) * amplitude + offsetX;

        // Distance to the nearest rung measured in the scrolled frame,
        // divided back to screen units.
        float rungDist = abs(fract(scrollY) - 0.5) / coils;
        if (rungDist < 0.03) {
          float minX = min(helixX, otherHelixX);
          float maxX = max(helixX, otherHelixX);
          float rungInside = step(minX, uv.x) * step(uv.x, maxX);
          float rung = smoothstep(0.005, 0.0, rungDist) * rungInside;

          // Base pair dots at ends
          float dot1 = 0.005 / (length(vec2(uv.x - helixX, rungDist)) + 0.005);
          float dot2 = 0.005 / (length(vec2(uv.x - otherHelixX, rungDist)) + 0.005);

          vec3 rungColor = mix(uColor1, uColor2, 0.5);
          color += rungColor * rung * 0.9 * nr * (1.0 + uBeat * 0.6);
          color += uColor3 * (dot1 + dot2) * 0.3 * nr;
        }
      }
    }
  }

  // Floating particles (nucleotides)
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float px = sin(fi * 7.13 + t * 0.5) * 0.6;
    float py = fract(fi * 0.37 + t * 0.2) * 2.0 - 1.0;
    float pd = length(uv - vec2(px, py));
    float particle = 0.003 / (pd + 0.003);
    float pAlpha = sin(t + fi * 3.0) * 0.5 + 0.5;
    color += uColor3 * particle * 0.12 * (0.4 + pAlpha);
  }

  // Beat pulse: flash through the helices
  color *= 1.0 + uBeat * 0.7;

  // Subtle scanlines (multiplicative: they never push a pixel negative)
  color *= 1.0 - 0.05 * (sin(gl_FragCoord.y * 2.0) * 0.5 + 0.5);

  // soft shoulder for clean bloom highlights
  color = vec3(1.0) - exp(-max(color, vec3(0.0)) * 1.3);
  gl_FragColor = vec4(color, 1.0);
}
