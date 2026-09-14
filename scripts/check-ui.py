#!/usr/bin/env python3
"""Take a picture of the CONTROL window.

The release gate looks at the projector, which proves the engine is alive and
says nothing about the interface — and the interface is exactly what a CSS or
layout refactor breaks, silently, in a window nobody screenshots. This reuses
the same launch, so it costs one app start:

    python3 scripts/check-ui.py            # writes /tmp/djg-ui.png
    python3 scripts/check-ui.py simple     # start in a given mode
    python3 scripts/check-ui.py simple 0.34  # …zoomed out to fit the sidebar

It fails on a window that is blank or nearly so; everything else is for human
eyes, which is the point.
"""
import os
import pathlib
import subprocess
import sys
import time

import numpy as np
from PIL import Image

REPO = pathlib.Path(__file__).resolve().parent.parent
SHOT_DIR = pathlib.Path(os.environ.get("DJG_SHOT_DIR", "/tmp"))
UI = SHOT_DIR / "djg-ui.png"
PROJ = SHOT_DIR / "djg-selftest.png"


def main() -> int:
    UI.unlink(missing_ok=True)
    env = {**os.environ, "DJG_SELFTEST": str(PROJ), "DJG_SELFTEST_UI": str(UI)}
    if len(sys.argv) > 1:
        env["DJG_SELFTEST_MODE"] = sys.argv[1]
        print("modalita' richiesta:", sys.argv[1])
    if len(sys.argv) > 2:
        # the window cannot grow past the screen, so zooming out is the only
        # way to get a whole sidebar into one frame
        env["DJG_SELFTEST_UI_ZOOM"] = sys.argv[2]
        print("zoom:", sys.argv[2])
    env.pop("ELECTRON_RUN_AS_NODE", None)   # silently kills Electron
    print("avvio app…")
    t0 = time.time()
    proc = subprocess.run(["yarn", "dev"], cwd=REPO, env=env,
                          capture_output=True, text=True, timeout=180)

    if not UI.exists() or UI.stat().st_size < 1000:
        print("FALLITO: nessuna immagine della finestra di controllo")
        print(proc.stdout[-1500:])
        return 1

    img = np.asarray(Image.open(UI).convert("RGB"), dtype=np.float32) / 255.0
    lum = img @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    print(f"finestra di controllo: {img.shape[1]}x{img.shape[0]} "
          f"media={lum.mean():.3f} std={lum.std():.3f} "
          f"({time.time() - t0:.0f}s)")
    if lum.std() < 0.02:
        print("FALLITO: la finestra e' uniforme — non ha disegnato niente")
        return 1
    print("OK:", UI)
    return 0


if __name__ == "__main__":
    sys.exit(main())
