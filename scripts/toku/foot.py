#!/usr/bin/env python3
"""Kaiju Stomp sprite sheet (src/engine/assets/toku-foot.png), a cel sheet (see cel.py).

    python3 scripts/toku/foot.py                 writes the atlas and scripts/toku/foot.json
    python3 scripts/toku/foot.py --preview F.png also a contact sheet of every drawing

The foot of something the size of a building, seen from the side, toes to the right: a column of
a shin that runs out of the top of the cell (the shader carries it on), sagging folds of
hide over the ankle, a slab of a foot, three heavy toes one behind the other, each ending in a
claw, a spur on the heel, a row of thorny plates down the front of the shin.
Every drawing is written as how far the toes are raised, how far the heel has left the ground
(the foot rocks on its ball), a squash and a lift.

Foot space: origin on the ground under the heel end of the sole, x to the toes, y up, in units.
Classes: suit = hide (dim: the shin and the far toe), white = claws (dim: the far one).
Cell layout and frame indices are the ones kaijustomp.frag reads (4 x 2 cells of 384 x 352).
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from cel import SUIT, WHITE, INK, Canvas, Space, closed, ellipse, paint, spline

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src/engine/assets/toku-foot.png"
CW, CH, COLS, ROWS = 384, 352, 4, 2
ANCHOR = (128, 344)
SP = Space(CW, CH, *ANCHOR)
HINGE = (100.0, 20.0)                               # where the toes turn up
BALL = (110.0, 0.0)                                 # what the foot rocks on when the heel lifts

# toe: root, size, dim. Far one first
TOES = [((124, 46), 0.84, True), ((112, 37), 0.92, False), ((100, 28), 1.0, False)]


def turn(pts, a, o):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(o[0] + (x - o[0]) * c - (y - o[1]) * s, o[1] + (x - o[0]) * s + (y - o[1]) * c) for x, y in pts]


def arc(cx, cy, r, a0, a1, th=1.3):
    """A pen stroke: a piece of a circle, th units thick."""
    a = np.radians(np.linspace(a0, a1, 10))
    return [(cx + (r + th) * math.cos(x), cy + (r + th) * math.sin(x)) for x in a] + [(cx + (r - th) * math.cos(x), cy + (r - th) * math.sin(x)) for x in a[::-1]]


def fine(st, logical=None):
    """Stations three times as close, so the normals of a short fat limb do not come out faceted."""
    lg = np.arange(len(st)) if logical is None else logical
    d = spline(np.column_stack([np.asarray(st, float), lg]), 3)
    return d[:, :4], d[:, 4]


def toe(cv, T, B, root, k, pid, dim, near):
    x, y = root
    w = 28.0 * k
    st = [(x - 26 * k, y + 6 * k, 0.85), (x, y, 1.0), (x + 20 * k, y, 0.92), (x + 40 * k, y + 1 * k, 1.06), (x + 62 * k, y - 3 * k, 0.82)]
    q = B([st[0][:2]]) + T([s[:2] for s in st[1:]])      # the root stays in the foot: only the toe turns up
    m, G, U, nx, ny = SP.stroke(*fine([(*q[i], w * st[i][2], w * st[i][2]) for i in range(5)], [-1, 0, 1, 2, 3]), caps=(False, True), flat=0.9)
    cv.put(m, SUIT, nx, ny, pid, dim=dim, quiet=[(*q[0], w * 1.6), (*q[1], w * 1.2)] if near else (), line=1.5)
    for j in (1.0, 2.55):                                # the creases either side of the knuckle, over the top of the toe
        cv.flat(m & (np.abs(G - j) < 0.03) & (U > -0.15), INK)
    e = np.array([x + 62 * k, y - 3 * k])
    tri = [(-6, 21), (16, 22), (36, 14), (50, -2), (56, -22), (56.5, -24), (46, -15), (28, -12), (10, -16), (-6, -20)]
    cm = SP.raster([T(closed([tuple(e + k * np.array(v)) for v in tri], 6))])
    c0 = T([tuple(e + k * np.array((18, 0)))])[0]
    cnx, cny = SP.dome(cm, c0[0], c0[1], 26 * k, 26 * k, 0.8)
    cv.put(cm & ~m, WHITE, cnx, cny, pid + 10, dim=dim, line=1.3)


def foot(up, heel, sy, sx, lift):
    cv = Canvas(SP)
    body = lambda pts: [(x * sx, y * sy + lift) for x, y in turn(pts, -heel, BALL)]
    toes = lambda pts: body(turn(pts, up, HINGE))

    # the shin: it leans with the foot, then stands up straight before it leaves the cell
    a = np.array(body([(12, 50)])[0])
    d = np.array(turn([(0, 1)], -heel, (0, 0))[0])
    p2 = a + 80 * d
    p3 = p2 + np.array([22 * d[0], 60])
    p4 = np.array([p3[0], max(p3[1] + 90, 380)])
    st = [(*a, 56, 50), (*(a + 35 * d), 58, 52), (*p2, 66, 60), (*p3, 74, 68), (*p4, 76, 70)]
    m, G, U, nx, ny = SP.stroke(st, caps=(False, False), flat=0.9)
    cv.put(m, SUIT, nx, ny, 1, dim=True, line=0)
    c = spline(st)                                       # 41 places up the shin: centre, widths
    t = np.gradient(c[:, :2], axis=0)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    at = lambda i, off: c[i, :2] + off * np.array([t[i, 1], -t[i, 0]])
    for i, off, r in ((15, 14, 11), (18, -42, 12), (21, -10, 13), (24, 26, 11), (27, -36, 13), (30, 0, 12), (32, -30, 12), (33, 28, 11)):
        cv.flat(SP.raster([arc(*at(i, off), r, 205, 335)]) & m, INK)      # a few scales: only their lower edge
    thorn = [(-9, -22), (5, -20), (14, 4), (17, 26), (17.5, 27), (4, 16), (-9, 12)]
    for n, i in enumerate((36, 34, 32, 29, 24, 18)):     # plates down the front, each a thorn lapping the one below
        o, k = at(i, c[i, 3] - 4), 1.0 if n % 2 else 0.78
        nr = np.array([t[i, 1], -t[i, 0]])
        pm = SP.raster([closed([tuple(o + k * u * nr + k * v * t[i]) for u, v in thorn], 6)])
        pnx, pny = SP.dome(pm, o[0] + 2 * nr[0], o[1] + 2 * nr[1], 16 * k, 26 * k, 0.9)
        cv.put(pm, SUIT, pnx, pny, 20 + n, line=1.5)

    spur = SP.raster([body(closed([(-14, 30), (-32, 21), (-57, 4), (-58, 3), (-38, 6), (-13, 8)], 6))])
    s0 = body([(-30, 15)])[0]
    snx, sny = SP.dome(spur, s0[0], s0[1], 17, 17, 0.8)
    cv.put(spur, WHITE, snx, sny, 9, line=1.3)

    for i in (0, 1):
        toe(cv, toes, body, TOES[i][0], TOES[i][1], 2 + i, TOES[i][2], False)

    slab = [(-12, 2), (-24, 14), (-28, 34), (-36, 54), (-42, 72), (0, 78), (50, 76), (76, 70), (98, 62), (116, 54), (126, 40), (125, 18),
            (114, 1), (60, 1), (10, 1)]
    sm = SP.raster([body(closed(slab, 8))])
    c0 = body([(46, 26)])[0]
    nx, ny = SP.dome(sm, c0[0], c0[1], 96 * sx, 50 * sy, 0.85)
    cv.put(sm, SUIT, nx, ny, 5, line=1.5)
    for q in ([(78, 69), (87, 54), (88.6, 55), (79.8, 70)], [(93, 63), (101, 50), (102.6, 51), (94.8, 64)], arc(12, 36, 18, 25, 150),
              [(-10, 9.5), (84, 8), (84, 9.8), (-10, 12)]):
        cv.flat(SP.raster([body(q)]) & sm, INK)          # wrinkles over the instep, the ankle bone, the edge of the sole

    toe(cv, toes, body, TOES[2][0], TOES[2][1], 4, TOES[2][2], True)

    # the folds over the ankle: rolls of hide, fat in front, each hanging over the one below and the
    # lowest over the foot. A pen line under each of them only: above, it is the same hide as the shin
    folds = [[(-50, 66, 4, 5), (-24, 60, 10, 14), (14, 54, 14, 20), (52, 57, 15, 21), (76, 66, 9, 12), (84, 74, 3, 4)],
             [(-48, 88, 4, 4), (-20, 83, 9, 11), (16, 79, 12, 15), (50, 82, 11, 13), (72, 90, 3, 4)],
             [(0, 104, 3, 3), (24, 101, 7, 8), (50, 102, 8, 9), (68, 108, 3, 4)]]     # the top one is only a wrinkle on the front
    dn = np.array(turn([(0, -1)], -heel, (0, 0))[0])
    for n, f in enumerate(folds):
        q = body([s[:2] for s in f])
        m, G, U, nx, ny = SP.stroke(*fine([(*q[i], f[i][2], f[i][3]) for i in range(len(f))]), flat=0.9)
        qa = np.array(q)
        v = SP.WX * dn[0] + SP.WY * dn[1]                  # how far down the leg, here and on the middle of the roll
        under = SP.grow(m, 1.5) & ~m & (cv.cls > 0) & (v > np.interp(SP.WY * dn[0] - SP.WX * dn[1], qa @ [-dn[1], dn[0]], qa @ dn))
        cv.put(m, SUIT, np.where(U > 0, 0.35 * nx, nx), np.where(U > 0, 0.35 * ny, ny), 6 + n, line=0)   # round underneath, flat on top
        cv.flat(under, INK)
    return cv.encode()


# name -> (toes raised, heel lifted (degrees), squash of the height, stretch of the length, lift)
DRAWINGS = {
    "descend": (22, 0, 1.0, 1.0, 0),
    "descend_smear": (32, 0, 1.12, 0.96, 0),
    "impact": (-3, 0, 0.84, 1.07, 0),
    "settle": (-1, 0, 0.93, 1.03, 0),
    "planted": (0, 0, 1.0, 1.0, 0),
    "heel_up": (16, 13, 1.0, 1.0, 0),
    "lifted": (-14, 27, 1.0, 1.0, 95),
    "toes_up": (38, 0, 1.0, 1.0, 0),
}
ORDER = ["descend", "descend_smear", "impact", "settle", "planted", "heel_up", "lifted", "toes_up"]
ACTIONS = {"descend": ([1, 0], [1, 1]), "impact": ([2, 3], [1, 2]), "planted": ([4], [1]), "lift": ([5, 6], [1, 1]), "tap": ([0, 7], [1, 1])}


def main():
    done = {}
    for name, args in DRAWINGS.items():
        done[name] = foot(*args)
        a = done[name][..., 3] > 100                     # the top is the leg going on; nothing else may touch the cell
        assert not (a[-1].any() or a[:, 0].any() or a[:, -1].any()), f"{name} is cut by its cell"
        assert a[0].any(), f"{name}: the leg does not reach the top of the cell"
    pw, ph = CW * SP.scale, CH * SP.scale
    sheet = np.zeros((ROWS * ph, COLS * pw, 4), np.uint8)
    for i, n in enumerate(ORDER):
        sheet[(i // COLS) * ph:(i // COLS + 1) * ph, (i % COLS) * pw:(i % COLS + 1) * pw] = done[n]
    Image.fromarray(sheet, "RGBA").save(OUT, optimize=True)
    (Path(__file__).parent / "foot.json").write_text(json.dumps({
        "atlas": "src/engine/assets/toku-foot.png", "cell": [CW, CH], "texelsPerUnit": SP.scale, "cols": COLS, "anchor": list(ANCHOR),
        "drawings": ORDER,
        "encoding": "cel sheet, see scripts/toku/cel.py: suit = hide (dim: shin, far toe), white = claws",
        "note": "the leg leaves by the top of the cell: the shader repeats the top row upwards; 'lifted' is drawn 95 units off the ground",
        "actions": {k: {"frames": f, "hold": h} for k, (f, h) in ACTIONS.items()}}, indent=1) + "\n")
    print(f"toku-foot.png: {len(done)} drawings, {sheet.shape[1]} x {sheet.shape[0]}")
    if "--preview" in sys.argv:
        out = np.zeros((ROWS * ph, COLS * pw, 3), np.float32)
        for i, n in enumerate(ORDER):
            out[(i // COLS) * ph:(i // COLS + 1) * ph, (i % COLS) * pw:(i % COLS + 1) * pw] = paint(done[n], (0.34, 0.3, 0.42), (0.75, 0.5, 0.3))
        Image.fromarray((out * 255).astype(np.uint8)).resize((COLS * pw // 2, ROWS * ph // 2), Image.LANCZOS).save(sys.argv[sys.argv.index("--preview") + 1])


if __name__ == "__main__":
    main()
