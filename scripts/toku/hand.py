#!/usr/bin/env python3
"""Titan Hand sprite sheet (src/engine/assets/toku-hand.png), a cel sheet (see cel.py).

    python3 scripts/toku/hand.py                 writes the atlas and scripts/toku/hand.json
    python3 scripts/toku/hand.py --preview F.png also a contact sheet of every drawing

The hand of something the size of the building, seen from the side as it reaches: a slab of a
palm, four fingers that hook towards the ground and end in claws, the thumb under them, a cuff of
fur where the arm (drawn by the shader) takes over. Every drawing is written as how far each
finger is hooked, how wide they fan and which way the whole hand points; the sheet is drawn
already turned for a reach to the right, the shader mirrors it and never rotates it.

Hand space: origin on the wrist, u along the fingers, v to the back of the hand, in units.
Classes: suit = hide, suit in the dim variant = fur, white = claws. The shader picks the colours.
Cell layout and frame indices are the ones titanhand.frag reads (6 x 3 cells of 288 units).
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from cel import SUIT, WHITE, INK, Canvas, Space, closed, cut_by_cell, paint

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src/engine/assets/toku-hand.png"
CELL, COLS, ROWS = 288, 6, 3
SP = Space(CELL, CELL, 144, 144)                    # the wrist is where the shader pins the cell
REACH, SLAM, RAISED, UP = -58.0, -27.0, 28.0, 76.0  # the ways the hand points, degrees

# finger: v of its root, length, half width. Index first: it is the one nearest the thumb
FINGERS = [(-26, 45, 10.6), (-9, 52, 11.2), (9, 48, 10.6), (26, 38, 9.4)]


def rot(pts, a, squash=1.0):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(u * c - v * squash * s, u * s + v * squash * c) for u, v in pts]


def finger(cv, a, root, length, w, hook, fan, pid, claw=True, squash=1.0):
    """One finger: three joints, each turned `hook` further towards the ground (-v)."""
    p, d = np.array([60.0, root]), math.radians(fan)
    pts, dirs = [p.copy()], []
    for seg in (0.42, 0.32, 0.26):
        d -= math.radians(hook * 82.0)
        p = p + length * seg * np.array([math.cos(d), math.sin(d)])
        pts.append(p.copy())
        dirs.append(d)
    back = pts[0] - 10.0 * np.array([math.cos(math.radians(fan)), math.sin(math.radians(fan))])
    st = [(*back, w, w), (*pts[0], w * 1.08, w * 1.08), (*pts[1], w * 1.02, w * 1.02), (*pts[2], w * 0.92, w * 0.92), (*pts[3], w * 0.72, w * 0.72)]
    st = [(*rot([s[:2]], a, squash)[0], s[2], s[3]) for s in st]
    m, G, U, nx, ny = SP.stroke(st, [-0.5, 0, 1, 2, 3], caps=(False, True), flat=0.9)
    cv.put(m, SUIT, nx, ny, pid, line=1.1)
    for j in (1.0, 2.0):                                 # the creases over the two knuckles, on the back of the finger
        cv.flat(m & (np.abs(G - j) < 0.035) & (U > -0.1), INK)
    if claw and hook < 0.8:
        t, n = np.array([math.cos(dirs[2]), math.sin(dirs[2])]), np.array([-math.sin(dirs[2]), math.cos(dirs[2])])
        tip = pts[3]
        tri = [tip + n * w * 0.62 - t * 3, tip + t * 10 + n * w * 0.5, tip + t * 23 - n * w * 0.8, tip + t * 8 - n * w * 0.72, tip - n * w * 0.62 - t * 3]
        cm = SP.raster([rot(closed(tri, 6), a, squash)])
        c0 = rot([tip + t * 8], a, squash)[0]
        cnx, cny = SP.dome(cm, c0[0], c0[1], 12, 12, 0.8)
        cv.put(cm & ~m, WHITE, cnx, cny, pid + 10, line=1.0)


def thumb(cv, a, hook, over, squash=1.0):
    d = math.radians(-8.0 if over else -52.0)             # over = folded across the fingers of a fist
    p = np.array([20.0, -27.0])
    pts = [p.copy()]
    for seg in (24.0, 20.0, 17.0):
        d += math.radians(-6.0 if over else hook * 62.0)
        p = p + seg * np.array([math.cos(d), math.sin(d)])
        pts.append(p.copy())
    st = [(8.0, -14.0, 11, 11), (*pts[0], 11.5, 11.5), (*pts[1], 10.5, 10.5), (*pts[2], 9.5, 9.5), (*pts[3], 7.2, 7.2)]
    st = [(*rot([s[:2]], a, squash)[0], s[2], s[3]) for s in st]
    m, G, U, nx, ny = SP.stroke(st, [-0.5, 0, 1, 2, 3], caps=(True, True), flat=0.9)
    cv.put(m, SUIT, nx, ny, 8, line=1.1)
    cv.flat(m & (np.abs(G - 2.0) < 0.035) & (U > -0.1), INK)
    if hook < 0.8 or over:
        t, n = np.array([math.cos(d), math.sin(d)]), np.array([-math.sin(d), math.cos(d)])
        tip = pts[3]
        tri = [tip + n * 4.6 - t * 3, tip + t * 8 + n * 3.6, tip + t * 18 - n * 5, tip + t * 7 - n * 5, tip - n * 4.6 - t * 3]
        cm = SP.raster([rot(closed(tri, 6), a, squash)])
        c0 = rot([tip + t * 7], a, squash)[0]
        cnx, cny = SP.dome(cm, c0[0], c0[1], 11, 11, 0.8)
        cv.put(cm & ~m, WHITE, cnx, cny, 18, line=1.0)


def cuff(cv, a, seed):
    """Fur where the hide ends: tufts over the wrist, flaring, and off to the arm behind."""
    rnd = np.random.RandomState(seed)
    top, bot = [], []
    for i, u in enumerate(np.linspace(-46, 6, 8)):       # the two flanks: a tuft every few units, tips swept back
        k = 34 + 9 * math.sin(math.pi * (u + 46) / 56)
        top += [(u, k - 5), (u + 3 - 9 * (i % 2), k + 4 + 5 * rnd.rand())]
        bot += [(u, -k + 5), (u + 3 - 9 * (i % 2), -k - 4 - 5 * rnd.rand())]
    front = []
    for i, v in enumerate(np.linspace(30, -30, 10)):      # the fringe that lies over the back of the hand
        front += [(10 + 3 * rnd.rand(), v + 3), (22 + 9 * rnd.rand() + (5 if i % 3 == 0 else 0), v - 0.5)]
    poly = [(-48, 27)] + top + front + bot[::-1] + [(-48, -27)]
    m = SP.raster([rot(poly, a)])
    c0 = rot([(-16, 0)], a)[0]
    nx, ny = SP.dome(m, c0[0], c0[1], 44, 44, 0.85)
    cv.put(m, SUIT, nx, ny, 9, dim=True, line=1.1)
    for i in range(7):                                   # a few locks drawn into it
        u, v = -40 + 46 * rnd.rand(), -22 + 44 * rnd.rand()
        lock = [(u, v), (u + 13, v + 2.2), (u + 15, v), (u + 13, v - 0.6)]
        cv.flat(SP.raster([rot(lock, a)]) & m, INK)


def hand(a, hooks, fan, th, fx=(), squash=1.0, seed=3):
    cv = Canvas(SP)
    fist = min(hooks) > 0.8
    if not fist:
        thumb(cv, a, th, False, squash)
    palm = closed([(-8, -26), (18, -35), (48, -38), (64, -31), (70, -9), (70, 11), (64, 30), (48, 36), (20, 34), (-8, 26)], 8)
    m = SP.raster([rot(palm, a, squash)])
    c0 = rot([(30, 0)], a, squash)[0]
    nx, ny = SP.dome(m, c0[0], c0[1], 48, 48, 0.8)
    cv.put(m, SUIT, nx, ny, 1, line=1.1)
    for i in (3, 2, 1, 0):                               # little finger first: the index is nearest the eye
        root, length, w = FINGERS[i]
        finger(cv, a, root, length, w, hooks[i], fan * (i - 1.5) * 0.5, 2 + i, squash=squash)
    if fist:
        thumb(cv, a, th, True, squash)
    cuff(cv, a, seed)
    for f in fx:
        cv.fx(*f)
    return cv.encode()


def arcs(a, r, side):
    """Two short strokes of air beside a shaking fist."""
    out = []
    for k, rr in enumerate((r, r + 13)):
        an = [math.radians(a + side * (62 + 8 * k) + side * t) for t in np.linspace(0, 26, 8)]
        pts = [(60 + rr * math.cos(x) - 60 * math.cos(math.radians(a)) * 0 , rr * math.sin(x)) for x in an]
        c = np.array(rot([(52, 0)], a)[0])
        o = [(c[0] + (rr + 2.2) * math.cos(x), c[1] + (rr + 2.2) * math.sin(x)) for x in an]
        i = [(c[0] + (rr - 2.2) * math.cos(x), c[1] + (rr - 2.2) * math.sin(x)) for x in an[::-1]]
        out.append((3, [o + i], (), False))
    return out


# name -> (points, hooks index..little, fan, thumb hook, extras)
DRAWINGS = {
    "open": (REACH, (0.12, 0.08, 0.1, 0.16), 15, 0.1),
    "grope1": (REACH, (0.34, 0.12, 0.05, 0.3), 17, 0.25),
    "grope2": (REACH, (0.08, 0.3, 0.36, 0.1), 13, 0.05),
    "cup": (REACH, (0.42, 0.44, 0.46, 0.5), 9, 0.4),
    "pat": (REACH, (0.03, 0.02, 0.03, 0.05), 22, 0.0),
    "claw": (REACH, (0.5, 0.48, 0.5, 0.56), 19, 0.5),
    "half": (REACH, (0.7, 0.72, 0.74, 0.78), 9, 0.7),
    "shut": (REACH, (0.9, 0.92, 0.94, 0.96), 4, 0.9),
    "fist": (REACH, (1.0, 1.0, 1.0, 1.0), 0, 1.0),
    "windup": (RAISED, (0.05, 0.02, 0.04, 0.1), 26, 0.0),
    "slam1": (SLAM, (0.0, 0.0, 0.0, 0.02), 30, 0.0),
    "slam2": (SLAM, (0.08, 0.06, 0.08, 0.12), 24, 0.1),
    "shake1": (UP - 6, (1.0, 1.0, 1.0, 1.0), 0, 1.0),
    "shake2": (UP + 6, (1.0, 1.0, 1.0, 1.0), 0, 1.0),
    "limp": (REACH, (0.3, 0.32, 0.34, 0.38), 5, 0.3),
    "slack": (REACH, (0.5, 0.52, 0.55, 0.6), 3, 0.5),
}
ORDER = ["open", "grope1", "open", "grope2", "cup", "pat", "claw", "half", "shut", "fist", "windup", "slam1", "slam2", "shake1", "shake2",
         "limp", "slack", "windup"]
ACTIONS = {"grope": ([0, 1, 2, 3], [1, 1, 1, 1]), "pat": ([4, 5], [1, 2]), "burst": ([9, 8, 7, 6], [1, 1, 1, 1]), "grab": ([6, 7, 8, 9], [1, 1, 1, 2]),
           "slam": ([10, 11, 12], [4, 1, 4]), "fist": ([9, 13, 14], [1, 1, 1]), "withdraw": ([15, 16], [1, 1]), "spare": ([17], [1])}


def main():
    done = {}
    for name, (a, hooks, fan, th) in DRAWINGS.items():
        fx = arcs(a, 74, 1) + arcs(a, 74, -1) if name.startswith("shake") else ()
        done[name] = hand(a, hooks, fan, th, fx)
        assert not cut_by_cell(done[name]), f"{name} is cut by its cell"
    px = CELL * SP.scale
    sheet = np.zeros((ROWS * px, COLS * px, 4), np.uint8)
    for i, n in enumerate(ORDER):
        sheet[(i // COLS) * px:(i // COLS + 1) * px, (i % COLS) * px:(i % COLS + 1) * px] = done[n]
    Image.fromarray(sheet, "RGBA").save(OUT, optimize=True)
    (Path(__file__).parent / "hand.json").write_text(json.dumps({
        "cell": [CELL, CELL], "texelsPerUnit": SP.scale, "cols": COLS, "drawings": ORDER,
        "encoding": "cel sheet, see scripts/toku/cel.py: suit = hide, dim suit = fur, white = claws",
        **{k: {"frames": f, "hold": h, "anchor": [144, 144]} for k, (f, h) in ACTIONS.items()}}, indent=1) + "\n")
    print(f"toku-hand.png: {len(done)} drawings on {len(ORDER)} cells")
    if "--preview" in sys.argv:
        names = list(done)
        out = np.zeros((2 * px, 8 * px, 3), np.float32)
        for i, n in enumerate(names):
            out[(i // 8) * px:(i // 8 + 1) * px, (i % 8) * px:(i % 8 + 1) * px] = paint(done[n], (0.34, 0.3, 0.42), (0.75, 0.5, 0.3))
        Image.fromarray((out * 255).astype(np.uint8)).resize((4 * px, px), Image.LANCZOS).save(sys.argv[sys.argv.index("--preview") + 1])


if __name__ == "__main__":
    main()
