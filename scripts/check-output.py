#!/usr/bin/env python3
"""Release gate: does the PROJECTOR actually show an image?

Launches the app, waits for it to settle, grabs the frame the output window is
really painting and fails if it is black, uniform or frozen. Logs and frame
counters were not enough: a projector can report healthy numbers and still show
nothing, so this looks at the pixels.

    python3 scripts/check-output.py      # exit 0 = projector OK
"""
import os
import pathlib
import subprocess
import sys
import time

import numpy as np
from PIL import Image

REPO = pathlib.Path(__file__).resolve().parent.parent
SHOT = pathlib.Path(os.environ.get("DJG_SHOT_DIR", "/tmp")) / "djg-selftest.png"
LOG_DIR = pathlib.Path.home() / ".djtographikz" / "logs"


def newest_log(after: float):
    logs = [p for p in LOG_DIR.glob("*.log") if p.stat().st_mtime >= after]
    return max(logs, key=lambda p: p.stat().st_mtime, default=None)


def main() -> int:
    SHOT.unlink(missing_ok=True)
    started = time.time() - 1

    env = {**os.environ, "DJG_SELFTEST": str(SHOT)}
    env.pop("ELECTRON_RUN_AS_NODE", None)   # silently kills Electron
    print("avvio app…")
    proc = subprocess.run(["yarn", "dev"], cwd=REPO, env=env,
                          capture_output=True, text=True, timeout=180)

    if not SHOT.exists() or SHOT.stat().st_size < 1000:
        print("FALLITO: il proiettore non ha restituito nessun frame")
        print(proc.stdout[-1500:])
        return 1

    img = np.asarray(Image.open(SHOT).convert("RGB"), dtype=np.float32) / 255.0
    lum = img @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    mean, std, bright = float(lum.mean()), float(lum.std()), float((lum > 0.08).mean())
    print(f"frame proiettore: {img.shape[1]}x{img.shape[0]} media={mean:.3f} "
          f"std={std:.3f} pixel_accesi={bright * 100:.1f}%")

    problems = []
    if mean < 0.008:
        problems.append("immagine nera")
    if std < 0.01:
        problems.append("immagine uniforme (nessun contenuto)")
    if bright < 0.02:
        problems.append("quasi nessun pixel acceso")

    log = newest_log(started)
    if log:
        text = log.read_text(errors="ignore")
        beats = [l for l in text.splitlines() if "output/health" in l]
        if not beats:
            problems.append("nessun battito dal proiettore nel log")
        else:
            print("ultimo battito:", beats[-1].split("output/health]")[-1].strip())
            if "NOSIGNAL" in beats[-1]:
                problems.append("il proiettore segnala IN ATTESA DI SEGNALE")
            frames = [int(l.split("frames=")[1].split()[0]) for l in beats if "frames=" in l]
            if len(frames) >= 2 and frames[-1] <= frames[0]:
                problems.append("i frame non avanzano")
    else:
        problems.append("nessun log di sessione trovato")

    if problems:
        print("FALLITO:", "; ".join(problems))
        print("frame salvato in", SHOT)
        return 1
    print("OK: il proiettore mostra contenuto")
    return 0


if __name__ == "__main__":
    sys.exit(main())
