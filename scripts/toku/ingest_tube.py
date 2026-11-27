#!/usr/bin/env python3
"""Turns the approved tube-man pose sheets into the indexed sheet of airdancers.frag.

    python3 scripts/toku/ingest_tube.py                 writes src/engine/assets/toku-tube.png and tube.json
    python3 scripts/toku/ingest_tube.py --view out.png  the sheet, flat-coloured, 3x (nothing is written)

Source: scripts/toku/art/tube-0.png and tube-1.png, 8 poses each. Cut out and
reduced with the helpers of ingest.py (majority vote of classes, binary alpha,
one-pixel ink line), all at one scale: the standing pose with its blower comes
out STAND px tall. Encoding as the other toku sheets: R = material * 40,
G = tone * 50. Every pose sits with the middle of its blower on the middle of
its cell and its feet on the bottom line (BASE px up); the two torn-loose poses
are centred. The last cell is the blower alone.
"""
import json
import pathlib
import sys

import numpy as np
from PIL import Image

import ingest

HERE = pathlib.Path(__file__).resolve().parent
OUT = ingest.ASSETS / "toku-tube.png"
STAND = 150
CW, CH, COLS, ROWS = 160, 160, 6, 3
BASE = 1                        # empty rows under the feet
FABRIC, WHITE, MOUTH, BLOWER, INK = 1, 2, 3, 4, 5
# cell -> (sheet, pose in reading order)
NAMES = ["heap", "sag", "stand", "buckle_a", "buckle_b", "scurve", "bow", "yell",
         "stump", "flop_r", "flop_l", "lean_a", "lean_b", "corkscrew", "rocket", "tumble"]
POSES = [(s, i) for s in range(2) for i in range(8)]
LOOSE = ("rocket", "tumble")


def classify(fig):
    """Material * 8 + tone of every source pixel, with constant thresholds."""
    c = fig[..., :3].astype(float) / 255
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    mx, mn = c.max(-1), c.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    lum = c @ np.array([0.299, 0.587, 0.114])
    grey = sat < 0.22
    cls = FABRIC * 8 + np.select([(r > 0.93) & (g > 0.3), r > 0.93, r > 0.75, r > 0.56], [5, 4, 3, 2], 1)
    cls = np.where(r < 0.42, MOUTH * 8 + 1, cls)                         # the dark inside of the tube
    cls = np.where((r > 0.6) & (b < r * 0.3), MOUTH * 8 + 3, cls)        # the red of the mouth
    cls = np.where(grey, np.where(lum > 0.75, WHITE * 8 + 4, BLOWER * 8 + np.select([lum > 0.47, lum > 0.37, lum > 0.28], [4, 3, 2], 1)), cls)
    return np.where(mx < 0.27, ingest.INKC, cls)


def blower_box(cls):
    """x0, x1, top row of the blower in a reduced pose, or None: the grey block at its feet."""
    h = cls.shape[0]
    m = cls // 8 == BLOWER
    m[: h - 30] = False
    cols = np.where(m.sum(0) >= 4)[0]
    if len(cols) < 10:
        return None
    x0, x1 = cols.min(), cols.max() + 1
    rows = np.where(m[:, x0:x1].sum(1) >= (x1 - x0) * 0.5)[0]
    return x0, x1, rows.min()


def sprites():
    ingest.classify = classify                              # reduce() votes on these classes
    figs = [f for n in range(2) for f in ingest.figures(ingest.ART / f"tube-{n}.png")]
    s = STAND / figs[NAMES.index("stand")].shape[0]
    out = []
    for name, fig in zip(NAMES, figs):
        cls = ingest.reduce(fig, s)
        box = None if name in LOOSE else blower_box(cls)
        assert box or name in LOOSE, f"{name}: no blower found"
        # grey away from the blower is the soft edge of an eye: white or line, never metal
        stray = cls // 8 == BLOWER
        if box:
            stray[box[2] - 1:, box[0] - 1:box[1] + 1] = False
        cls[stray] = np.where(cls[stray] % 8 >= 3, WHITE * 8 + 4, ingest.INKC)
        out.append((cls, box))
    return out


def build():
    sheet = np.zeros((ROWS * CH, COLS * CW, 4), np.uint8)
    spr = sprites()
    meta = {}

    def put(cell, cls, x, y):
        h, w = cls.shape
        assert 1 <= x and x + w <= CW - 1 and 1 <= y and y + h <= CH - BASE, f"cell {cell}: {w}x{h} at {x},{y} does not fit"
        cy, cx = cell // COLS * CH, cell % COLS * CW
        sheet[cy + y:cy + y + h, cx + x:cx + x + w] = ingest.encode(cls)

    tops = []
    for cell, (name, (cls, box)) in enumerate(zip(NAMES, spr)):
        h, w = cls.shape
        if box:
            x, y = CW // 2 - (box[0] + box[1]) // 2, CH - BASE - h
            tops.append(int(h - box[2]))
        else:
            x, y = (CW - w) // 2, (CH - h) // 2
        put(cell, cls, x, y)
        meta[name] = {"cell": cell, "size": [w, h]}
    # the blower alone: the foot of the standing pose, closed with a line where the tube was
    cls, box = spr[NAMES.index("stand")]
    blow = cls[box[2]:, box[0] - 1:box[1] + 1].copy()
    blow[(blow // 8 != BLOWER) & (blow != ingest.INKC)] = 0
    blow[0][blow[0] > 0] = ingest.INKC
    put(len(NAMES), blow, CW // 2 - blow.shape[1] // 2, CH - BASE - blow.shape[0])
    meta["blower"] = {"cell": len(NAMES), "size": list(blow.shape[::-1])}

    a = sheet[..., 3]
    assert set(np.unique(a)) <= {0, 255}, "alpha is not binary"
    assert set(np.unique(sheet[..., 0][a > 0])) <= {40, 80, 120, 160, 200}, "material out of the encoding"
    assert set(np.unique(sheet[..., 1][a > 0])) <= {0, 50, 100, 150, 200, 250}, "tone out of the encoding"
    info = {
        "atlas": OUT.name, "cell": [CW, CH], "cols": COLS, "rows": ROWS, "stand": STAND, "base": BASE,
        "encoding": "R = material * 40 (1 fabric, 2 white, 3 mouth, 4 blower, 5 ink), G = tone * 50 (fabric 1..5)",
        "anchor": "blower centre on x = cell width / 2, feet on the bottom line; rocket and tumble centred",
        "blower_top": [int(min(tops)), int(max(tops))],               # rows from the feet to the top of the blower, over the poses
        "poses": meta,
    }
    return sheet, info


def view(sheet):
    mat, lv = (sheet[..., 0].astype(int) + 20) // 40, (sheet[..., 1].astype(int) + 25) // 50
    out = np.full(sheet.shape[:2] + (3,), (40, 60, 90), np.uint8)
    out[::CH] = out[:, ::CW] = (60, 90, 130)
    pal = {FABRIC: [(110, 10, 60), (160, 15, 85), (205, 20, 110), (250, 25, 140), (255, 120, 205)],
           WHITE: [(255, 255, 255)] * 5, MOUTH: [(80, 10, 35), (80, 10, 35), (240, 20, 40), (240, 20, 40), (240, 20, 40)],
           BLOWER: [(55, 55, 60), (85, 85, 90), (110, 110, 115), (150, 150, 155), (150, 150, 155)], INK: [(10, 8, 20)] * 6}
    for m, tones in pal.items():
        for l in range(6):
            out[(sheet[..., 3] > 0) & (mat == m) & (lv == l)] = tones[max(l - 1, 0) if m != INK else 0]
    im = Image.fromarray(out, "RGB")
    return im.resize((im.width * 3, im.height * 3), Image.NEAREST)


def main():
    sheet, info = build()
    if "--view" in sys.argv:
        view(sheet).save(sys.argv[sys.argv.index("--view") + 1])
        print(json.dumps(info))
        return
    Image.fromarray(sheet, "RGBA").save(OUT, optimize=True)
    (HERE / "tube.json").write_text(json.dumps(info, indent=2) + "\n")
    print("wrote", OUT, sheet.shape[1], "x", sheet.shape[0])


if __name__ == "__main__":
    main()
