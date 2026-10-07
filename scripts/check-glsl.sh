#!/bin/sh
# Compiles every fragment shader with glslang (brew install glslang), wrapped
# the way three r170 wraps ShaderMaterial on WebGL2 (GLSL ES 3.00). It checks
# types, redefinitions and undeclared names: the things tsc/build never see and
# a black screen at runtime. Does not launch the app.
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
rm -rf "$T"
[ $fail -eq 0 ] && echo "check:glsl OK — $n shader compilati" || { echo "$fail shader non compilano"; exit 1; }
