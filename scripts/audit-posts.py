#!/usr/bin/env python3
"""Render every post-FX against the test card and flag any that don't
visibly change it — a post silently no-op'ing (wrong/missing uniform, a
texture bound to the wrong unit) looks identical to a correct dry pass with
amount 0, and nothing else catches that.

    python3 scripts/audit-posts.py
"""
import pathlib
import subprocess
import sys

import numpy as np
from PIL import Image

REPO = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path("/tmp/djg-posts")

POSTS = ['bloom', 'rgb-split', 'chromatic', 'feedback', 'rgb-delay', 'filmgrain',
         'scanlines', 'pixelate', 'mirror', 'invert', 'displace', 'frame-glitch',
         'outline', 'anamorphic', 'halation', 'godrays', 'cinegrade', 'tiltshift']


def main() -> int:
    OUT.mkdir(exist_ok=True)
    card_path = OUT / "_card.png"
    card_path.unlink(missing_ok=True)

    rows = []
    for post in POSTS:
        p = OUT / f"{post}.png"
        subprocess.run([sys.executable, str(REPO / "scripts/post-preview.py"), post, str(p)],
                        capture_output=True, timeout=90)
        if not p.exists() or p.stat().st_size < 500:
            rows.append((post, "NO-RENDER", None))
            continue
        img = np.asarray(Image.open(p).convert("RGB"), dtype=np.float32) / 255.0
        card = np.asarray(Image.open(card_path).convert("RGB"), dtype=np.float32) / 255.0
        diff = float(np.abs(img - card).mean())
        flags = []
        if diff < 0.003:
            flags.append("NO-OP?")   # looks identical to the undistorted card
        rows.append((post, " ".join(flags) or "ok", diff))

    print(f"{'post':<14} {'esito':<10} {'diff da card':>12}")
    for post, verdict, diff in rows:
        print(f"{post:<14} {verdict:<10} {'' if diff is None else f'{diff:12.4f}'}")

    bad = [r[0] for r in rows if r[1] != "ok"]
    print("\nDA GUARDARE:", ", ".join(bad) if bad else "nessuno")
    print("immagini in", OUT, "— un post può cambiare poco per natura (filmgrain, invert di uno scuro): verificare a occhio")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
