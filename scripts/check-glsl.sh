#!/bin/sh
# Compiles every fragment AND vertex shader with glslang (brew install glslang),
# wrapped the way three r170 wraps ShaderMaterial on WebGL2 (GLSL ES 3.00). It
# checks types, redefinitions and undeclared names: the things tsc/build never
# see and a black screen at runtime. Does not launch the app.
#   yarn check:glsl
command -v glslangValidator >/dev/null 2>&1 || { echo "glslangValidator non trovato (brew install glslang): salto"; exit 0; }
cd "$(dirname "$0")/.." || exit 1
T=$(mktemp -d); fail=0; n=0
for f in src/engine/shaders/*.frag; do
  b=$(basename "$f" .frag); n=$((n+1))
  { printf '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\n#define LOOK 0\n#define varying in\n#define texture2D texture\n#define gl_FragColor pc_fragColor\nlayout(location=0) out highp vec4 pc_fragColor;\n'; cat "$f"; } > "$T/$b.frag"
  out=$(glslangValidator -S frag "$T/$b.frag" 2>&1)
  if echo "$out" | grep -q ERROR; then echo "FAIL $b"; echo "$out" | grep ERROR | head -3; fail=$((fail+1)); fi
done
# Custom vertex shaders rely on three.js's ShaderMaterial auto-declaring
# `position`/`normal` — the files themselves never do, same as the app never
# wraps them any other way. Looped over every LOOK value so #if LOOK==n
# branches the preprocessor would otherwise skip all get compiled at least
# once (only mesh.vert uses LOOK; harmless no-op for the others).
for f in src/engine/shaders/*.vert; do
  b=$(basename "$f" .vert)
  for look in 0 1 2 3 4 5; do
    n=$((n+1))
    { printf '#version 300 es\nprecision highp float;\n#define LOOK %s\n#define attribute in\n#define varying out\n#define texture2D texture\nin vec3 position;\nin vec3 normal;\n' "$look"; cat "$f"; } > "$T/$b-look$look.vert"
    out=$(glslangValidator -S vert "$T/$b-look$look.vert" 2>&1)
    if echo "$out" | grep -q ERROR; then echo "FAIL $b (LOOK=$look)"; echo "$out" | grep ERROR | head -3; fail=$((fail+1)); fi
  done
done
rm -rf "$T"
[ $fail -eq 0 ] && echo "check:glsl OK — $n shader compilati" || { echo "$fail shader non compilano"; exit 1; }
