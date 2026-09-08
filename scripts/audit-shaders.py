#!/usr/bin/env python3
"""Render every effect headless and flag visual defects.

Four shipped effects were visually broken (flat wash, static noise, camera
inside the geometry, scattered dots) while compiling perfectly, so compilation
is not a quality signal. This renders each effect at two moments, measures the
pixels and flags the suspects for a human look.

    python3 scripts/audit-shaders.py
"""
import pathlib
import re
import subprocess
import sys

import numpy as np
from PIL import Image

REPO = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path("/tmp/djg-audit")
TIMES = [3.0, 11.0]


def effect_ids() -> list[str]:
    src = (REPO / "src/engine/Engine.ts").read_text()
    block = src[src.index("const EFFECT_SHADERS"):]
    return re.findall(r"^\s+([\w-]+):\s", block[:block.index("\n}")], re.M)


def main() -> int:
    OUT.mkdir(exist_ok=True)
    rows = []
    for fx in effect_ids():
        imgs = []
        for i, t in enumerate(TIMES):
            p = OUT / f"{fx}-{i}.png"
            subprocess.run([sys.executable, str(REPO / "scripts/shader-preview.py"),
                            fx, str(t), str(p)], capture_output=True, timeout=90)
            imgs.append(np.asarray(Image.open(p).convert("RGB"), dtype=np.float32) / 255.0
                        if p.exists() and p.stat().st_size > 500 else None)

        if imgs[0] is None:
            rows.append((fx, "NO-RENDER", None))
            continue

        a = imgs[0]
        lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        s = {"mean": float(lum.mean()), "white": float((lum > 0.97).mean() * 100),
             "black": float((lum < 0.02).mean() * 100), "std": float(lum.std()),
             "motion": float(np.abs(imgs[1] - a).mean()) if imgs[1] is not None else -1.0}

        flags = []
        # the compile-error page is a dark banner over white
        if a[:90].mean() < 0.25 and a[90:].mean() > 0.9:
            flags.append("COMPILE-ERROR")
        if s["white"] > 25:
            flags.append("BRUCIATO")
        if s["black"] > 97:
            flags.append("VUOTO")
        if s["std"] < 0.045 and s["black"] < 97:
            flags.append("PIATTO?")     # dark effects trip this: always eyeball it
        if 0 <= s["motion"] < 0.004:
            flags.append("STATICO")
        rows.append((fx, " ".join(flags) or "ok", s))

    print(f"{'effetto':<14} {'esito':<22} {'media':>6} {'bianco%':>8} {'nero%':>7} {'std':>6} {'moto':>7}")
    for fx, verdict, s in rows:
        if s is None:
            print(f"{fx:<14} {verdict:<22}")
            continue
        print(f"{fx:<14} {verdict:<22} {s['mean']:6.3f} {s['white']:8.1f} "
              f"{s['black']:7.1f} {s['std']:6.3f} {s['motion']:7.4f}")

    bad = [r[0] for r in rows if r[1] != "ok"]
    print("\nDA GUARDARE:", ", ".join(bad) if bad else "nessuno")
    print("immagini in", OUT, "— PIATTO? va sempre verificato a occhio, gli effetti scuri lo fanno scattare")
    return 0


if __name__ == "__main__":
    sys.exit(main())
