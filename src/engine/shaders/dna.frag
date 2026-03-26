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

varying vec2 vUv;

#define PI 3.14159265359

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  vec3 color = vec3(0.0);

  // Multiple DNA helices
  for (int helix = 0; helix < 3; helix++) {
    float fh = float(helix);
    float offsetX = (fh - 1.0) * 0.4;

    // Two strands of the helix
    for (int strand = 0; strand < 2; strand++) {
      float phase = float(strand) * PI;
      float speed = 2.0 + uBass * 3.0;

      float scrollY = uv.y * 8.0 + t * speed;
      float amplitude = 0.12 + uMid * 0.05;

      // Helix curve
      float helixX = sin(scrollY + phase + fh * PI * 0.66) * amplitude + offsetX;

      // Distance to helix strand
      float d = abs(uv.x - helixX);
      float glow = 0.003 / (d + 0.003);
      glow = min(glow, 2.0);

      vec3 strandColor = strand == 0 ? uColor1 : uColor2;
      strandColor = mix(strandColor, uColor3, fh * 0.2);

      color += strandColor * glow * 0.3;

      // Rungs connecting the two strands
      if (strand == 0) {
        float otherHelixX = sin(scrollY + PI + fh * PI * 0.66) * amplitude + offsetX;

        // Rungs at regular intervals
        float rungY = mod(scrollY, 1.0);
        float rungMask = smoothstep(0.02, 0.0, abs(rungY - 0.5));

        if (rungMask > 0.01) {
          float minX = min(helixX, otherHelixX);
          float maxX = max(helixX, otherHelixX);

          float rungInside = step(minX, uv.x) * step(uv.x, maxX);
          float rungDist = abs(uv.y - (floor(uv.y * 8.0 + t * speed) + 0.5) / (8.0));

          float rung = smoothstep(0.003, 0.0, rungDist) * rungInside;

          // Base pair dots at ends
          float dot1 = 0.003 / (length(vec2(uv.x - helixX, rungDist)) + 0.003);
          float dot2 = 0.003 / (length(vec2(uv.x - otherHelixX, rungDist)) + 0.003);

          vec3 rungColor = mix(uColor1, uColor2, 0.5);
          color += rungColor * rung * rungMask * 0.5;
          color += uColor3 * (dot1 + dot2) * rungMask * 0.1;
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
    float particle = 0.002 / (pd + 0.002);
    float pAlpha = sin(t + fi * 3.0) * 0.5 + 0.5;
    color += uColor3 * particle * 0.05 * pAlpha;
  }

  // Beat pulse
  color *= 1.0 + uBeat * 0.5;

  // Subtle scanlines
  float scan = sin(gl_FragCoord.y * 2.0) * 0.03;
  color -= scan;

  color = max(color, vec3(0.0));
  gl_FragColor = vec4(color, 1.0);
}
