#!/usr/bin/env python3
"""toku-robo.png: the super robot of Robo vs Kaiju, a cel sheet (see cel.py).

    python3 scripts/toku/robo.py                 writes the atlas and scripts/toku/robo.json
    python3 scripts/toku/robo.py --preview F.png also a contact sheet of every drawing

A robot is plates, not limbs of clay: every part is a closed outline written in the frame of the
bone it rides on (origin on a joint, t along the bone, s across it), flat inside and bevelled at its
edge, so the light gives each plate one tone and a lit or dark rim. A key drawing is the joints
placed by hand for that pose, in units from the feet (x toward the enemy, y up):

    n* the side nearer the eye (its right arm and leg), f* the far one; a ankle, k knee, h hip;
    s shoulder, e elbow, w wrist; c0 / c1 the bottom and top of the chest's near edge

Classes: suit = armour, dim suit = joints and the far limbs, white = panels, gold = the crest, the
emblem and the trims, visor = the eyes, energy = the lens in the chest. The shader picks the colours.
Cells 0-58 keep the meaning robokaiju.frag gives them (a held drawing fills several cells),
59-61 are the rocket punch; robo.json lists each action with its cells and how long they are held.
"""
import json
import math
import pathlib
import sys

import numpy as np
from PIL import Image, ImageFilter

from cel import SUIT, WHITE, INK, VISOR, GOLD, Canvas, Space, closed, cut_by_cell, ellipse, paint

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent.parent / "src/engine/assets/toku-robo.png"
CW, CH, OX, OY, COLS, ROWS = 288, 224, 120, 212, 8, 8
SP = Space(CW, CH, OX, OY)


def V(*a):
    return np.array(a, float)


def unit(v):
    return v / max(np.linalg.norm(v), 1e-6)


class Frame:
    """The frame of a bone: origin o, t along `up`, s to its right."""

    def __init__(self, o, up, sx=1.0):
        self.o, self.up = V(*o), unit(V(*up))
        self.rt = V(self.up[1], -self.up[0]) * sx

    def __call__(self, pts):
        return [tuple(self.o + self.rt * s + self.up * t) for s, t in pts]

    def p(self, s, t):
        return self.o + self.rt * s + self.up * t

    def vec(self, s, t):
        return unit(self.rt) * s + self.up * t


def pillow(m, r, flat=0.95, tilt=(0.0, 0.0)):
    """Normals of a plate: it faces `tilt` inside and rounds off over r units at its edge."""
    nx, ny = np.zeros(m.shape, np.float32), np.zeros(m.shape, np.float32)
    ys, xs = np.nonzero(m)
    if not len(ys):
        return nx, ny
    pad = int(3 * r * SP.k) + 2                                # only the plate's own box is filtered
    y0, y1, x0, x1 = max(ys.min() - pad, 0), ys.max() + pad + 1, max(xs.min() - pad, 0), xs.max() + pad + 1
    c = m[y0:y1, x0:x1]
    b = np.asarray(Image.fromarray(c.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(r * SP.k)), np.float32) / 255
    gy, gx = np.gradient(b)
    l = np.maximum(np.hypot(gx, gy), 1e-6)
    t = np.clip(2.2 * (1 - b), 0, 1) * flat
    nx[y0:y1, x0:x1], ny[y0:y1, x0:x1] = (-gx / l * t + tilt[0] * (1 - t)) * c, (gy / l * t + tilt[1] * (1 - t)) * c
    return nx, ny


def lay(cv, m, cls, nx=0.0, ny=0.0, pid=1, dim=False, line=0.85, quiet=()):
    """Canvas.put, with the pen line found inside the shape's own box (cel.py grows the whole cell: 0.1 s a part)."""
    ys, xs = np.nonzero(m)
    if line and len(ys):
        n = max(1, int(round(line * SP.k)))
        y0, y1, x0, x1 = max(ys.min() - n, 0), ys.max() + n + 1, max(xs.min() - n, 0), xs.max() + n + 1
        c = m[y0:y1, x0:x1]
        big = np.asarray(Image.fromarray(c.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(2 * n + 1))) > 127
        edge = np.zeros_like(m)
        edge[y0:y1, x0:x1] = big & ~c & (cv.pid[y0:y1, x0:x1] > 0) & (cv.pid[y0:y1, x0:x1] != pid)
        for x, y, r in quiet:                                  # a limb grows out of the body here: no line
            edge &= (SP.WX - x) ** 2 + (SP.WY - y) ** 2 > r * r
        cv.flat(edge, INK)
    cv.put(m, cls, nx, ny, pid, dim=dim, line=0)


def plate(cv, poly, cls, pid, r=2.6, tilt=(0.0, 0.0), dim=False, line=0.85, smooth=False, quiet=(), clip=None):
    m = SP.raster([closed(poly, 6) if smooth else poly])
    if clip is not None:
        m &= clip
    if cls == GOLD:
        lay(cv, m, GOLD, 1.0, 0.5, pid, line=line, quiet=quiet)
    elif cls == VISOR:
        lay(cv, m, VISOR, 0.0, 0.0, pid, line=line, quiet=quiet)
    else:
        nx, ny = pillow(m, r, tilt=tilt)
        lay(cv, m, cls, nx, ny, pid, dim=dim, line=line, quiet=quiet)
    return m


def pen(cv, a, b, w=0.6, on=None):
    """A panel line from a to b."""
    a, b = V(*a), V(*b)
    n = unit(V(-(b - a)[1], (b - a)[0])) * w
    m = SP.raster([[a + n, b + n, b - n, a - n]]) & (cv.cls > 0)
    cv.flat(m if on is None else m & on, INK)


# ------------------------------------------------------------------ the parts
def foot(cv, A, kind, pid, dim):
    ang = {"flat": 0, "toe": -15, "hang": -34, "sole": 78, "upward": 90}[kind]
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    F = Frame(A, (-s, c))
    m = plate(cv, F([(-12, -11), (-13, -3), (-8, 4), (8, 4), (19, -2), (27, -8), (27, -11)]), SUIT, pid, dim=dim, tilt=F.vec(-0.1, 0.3))
    plate(cv, F([(11, 2.5), (19, -2), (27, -8), (27, -11), (15, -11), (11, -5)]), WHITE, pid, dim=dim, tilt=F.vec(0.3, 0.2), line=0.6)
    cv.flat(m & SP.raster([F([(-13, -11.5), (-13, -8.2), (28, -8.2), (28, -11.5)])]), INK)       # the sole


def leg(cv, p, n, far):
    A, K, Hp = V(*p[n + "a"]), V(*p[n + "k"]), V(*p[n + "h"])
    dim = far and not p.get("fbright")
    pid = 2 if far else 3
    kind = p.get(n + "foot", "flat")
    if kind not in ("sole", "upward"):
        foot(cv, A, kind, pid, dim)
    T = Frame(Hp, Hp - K)                                     # the thigh: white, narrower at the knee
    Lt = np.linalg.norm(Hp - K)
    plate(cv, T([(-9.5, 5), (-8.5, -Lt + 1), (8, -Lt + 1), (10.5, 3), (4, 9), (-5, 9)]), WHITE, pid, dim=dim, tilt=T.vec(-0.15, 0.1),
          quiet=[(Hp[0], Hp[1], 13)])
    pen(cv, T.p(-9, -Lt * 0.45), T.p(9, -Lt * 0.38))
    lay(cv, SP.raster([], [(K[0], K[1], 7.5)]), SUIT, 0.0, 0.0, pid, dim=True)                  # the joint
    S = Frame(K, K - A)                                       # the shin: a bell, its ridge toward the enemy
    L = np.linalg.norm(K - A)
    m = plate(cv, S([(-8.5, 5), (-10, -L * 0.4), (-14.5, -L + 2), (-14.5, -L - 4), (15.5, -L - 4), (15.5, -L + 3), (12, -L * 0.42), (10, 4), (5, 12), (-3, 10)]),
              SUIT, pid, r=3.4, dim=dim, tilt=S.vec(-0.22, 0.1))
    cv.flat(m & SP.raster([S([(-16, -L + 2.5), (17, -L + 3.5), (17, -L - 0.5), (-16, -L - 1.5)])]), GOLD)      # the ankle ring
    pen(cv, S.p(-16, -L + 3.2), S.p(17, -L + 4.2), on=m)
    pen(cv, S.p(4.5, 6), S.p(7.5, -L + 3), on=m)                                               # the ridge
    plate(cv, S([(-8, -5), (-1, -3), (0, -L * 0.52), (-10.5, -L * 0.55)]), WHITE, pid, dim=dim, r=1.6, tilt=S.vec(-0.2, 0.1), line=0.6, clip=m)
    for k in (0.66, 0.74):                                                                    # vents
        pen(cv, S.p(-11, -L * k), S.p(-2, -L * (k - 0.03)), on=m)
    plate(cv, S([(-1, 11), (7.5, 13), (11, 3), (9.5, -7), (1, -5)]), GOLD, pid, line=0.7)        # knee cap
    if kind in ("sole", "upward"):
        foot(cv, A, kind, pid, dim)


def hips(cv, p, g):
    pc, cb = g["pc"], g["cb"]
    W = Frame(pc, cb - pc, g["sx"])
    st = [(*(pc + W.up * 2), 9, 9), (*(cb + W.up * 3), 10, 10)]
    m, G, U, nx, ny = SP.stroke(st, caps=(False, False), flat=0.9)
    lay(cv, m, SUIT, nx, ny, 4, dim=True)                                                     # the waist, ribbed
    for k in (0.3, 0.55, 0.8):
        cv.flat(m & (np.abs(G - k) < 0.035), INK)
    plate(cv, W([(-21, 6), (-7, 8), (-9, -9), (-22, -11)]), SUIT, 4, tilt=W.vec(-0.3, 0.1))     # skirts
    plate(cv, W([(8, 8), (22, 6), (24, -10), (11, -8)]), SUIT, 4, tilt=W.vec(0.35, 0.0))
    plate(cv, W([(-8, 8), (9, 8), (11, -5), (2, -16), (-10, -5)]), WHITE, 4, tilt=W.vec(0.0, -0.1))
    plate(cv, W([(-3, 6), (5, 6), (4, -3), (1, -6), (-2, -3)]), GOLD, 4, line=0.6)


def wings(cv, g):
    C, H = g["C"], g["H"]
    for poly, tilt in (([(-20, H - 2), (-40, H + 12), (-62, H + 30), (-52, H + 8), (-38, H - 10), (-24, H - 14)], (-0.2, 0.3)),
                       ([(-20, H - 16), (-36, H - 16), (-56, H - 26), (-40, H - 30), (-22, H - 28)], (-0.1, -0.4))):
        plate(cv, C(poly), WHITE, 1, dim=True, tilt=C.vec(*tilt))


def chest(cv, p, g):
    C, H = g["C"], g["H"]
    m = plate(cv, C([(-14, -1), (-25, 12), (-31, H - 8), (-27, H + 3), (-10, H + 7), (12, H + 8), (28, H + 5), (34, H - 5), (31, 12), (18, -1)]),
              SUIT, 5, r=4.0, tilt=C.vec(-0.08, 0.28))
    plate(cv, C([(-13, -2), (-19, 11), (-1, 16), (24, 11), (17, -2)]), WHITE, 5, r=2.4, tilt=C.vec(0.12, -0.5), clip=m)       # the belly plate, under the overhang
    for s in (-7, 1, 9):
        pen(cv, C.p(s - 1, 12), C.p(s, 0), on=m)
    v = plate(cv, C([(-29, H + 1), (-1, H - 20), (32, H + 3), (33, H - 7), (0, H - 30), (-30, H - 9)]), GOLD, 5, clip=m)           # the V across it
    e = C.p(0.5, H - 9)
    cv.flat(SP.raster([], [(e[0], e[1], 8.2)]) & m, INK)
    if SP.raster([], [(e[0], e[1], 4.0)])[m].any():            # the lens: the robot's own light, with a glint
        cv.fx(2, [], [(e[0], e[1], 7.0)], True)
        cv.fx(4 if p.get("glow") else 3, [], [(e[0] + 0.8, e[1] - 0.8, 4.6)], True)
        cv.fx(5, [C([(-4.5, H - 5), (-0.5, H - 4.2), (-1.8, H - 7.6), (-5, H - 8.2)])], (), True)
    plate(cv, C([(-9, H + 7), (11, H + 8), (8, H + 1.5), (-5, H + 0.5)]), WHITE, 5, r=1.5, tilt=C.vec(0, 0.3), clip=m, line=0.6)  # collar
    for t in (H - 16, H - 20):                                                                # intakes under the far shoulder
        pen(cv, C.p(22, t + 4), C.p(30, t + 7), on=m & ~v)
    return e


def head(cv, p, g):
    n, ang = g["neck"], g["hang"]
    up = V(-math.sin(ang), math.cos(ang))
    Hd = Frame(n + up * 13, up)
    st = [(*(n - up * 3), 5, 5), (*(n + up * 5), 4.5, 4.5)]
    m, G, U, nx, ny = SP.stroke(st, caps=(False, False))
    lay(cv, m, SUIT, nx, ny, 6, dim=True)
    plate(cv, Hd([(6, 8), (10.5, 8.5), (19, 21), (27, 35), (14, 22)]), GOLD, 6)                  # the far blade of the crest
    dome = plate(cv, Hd([(-9, -8), (-10.5, 2), (-8, 9), (-1, 12.5), (6, 11.5), (10, 7), (10.5, -2), (8, -9), (0, -10.5)]), SUIT, 6, r=3.2, smooth=True,
                 tilt=Hd.vec(-0.1, 0.2))
    plate(cv, Hd([(1.5, -10.5), (8.5, -10.5), (12.5, -4.5), (11.5, 0.6), (2.5, 0.6)]), WHITE, 6, r=1.8, tilt=Hd.vec(0.25, -0.1), line=0.6)       # the mask
    pen(cv, Hd.p(6.5, -6), Hd.p(11, -5.2), 0.35)
    pen(cv, Hd.p(6, -8), Hd.p(10, -7.4), 0.35)
    vz = plate(cv, Hd([(2.2, 1.6), (11.6, 1.6), (10.6, 6.4), (3, 6.8)]), VISOR, 6, line=0.6)
    cv.g[vz & SP.raster([Hd([(3.8, 6.0), (7.4, 5.8), (6.2, 4.2), (4.0, 4.4)])])] = 1.0
    plate(cv, Hd([(-9.5, 6), (-2, 10.5), (3, 11.5), (-1, 18), (-12, 21)]), SUIT, 6, r=1.6, tilt=Hd.vec(-0.3, 0.2), line=0.6)                       # the comb
    plate(cv, Hd([(4.5, 7.5), (10, 9), (8, 21), (-3, 37), (1, 20)]), GOLD, 6)                    # the near blade
    e = Hd.p(-3.5, -0.5)
    cv.flat(SP.raster([], [(e[0], e[1], 3.9)]) & dome, INK)
    cv.flat(SP.raster([], [(e[0], e[1], 3.0)]) & dome, GOLD)


def fist(cv, Wr, d, opened, pid, dim):
    F = Frame(Wr, d)
    if not opened:
        m = plate(cv, F([(-8.5, -2), (-9.5, 7), (-6.5, 13.5), (5, 14.5), (9.5, 9), (9.5, -2)]), WHITE, pid, dim=dim, r=2.4, tilt=F.vec(-0.15, 0.15), line=0.6)
        pen(cv, F.p(-9, 7.5), F.p(9, 8.5), on=m)
        for s in (-3.2, 1.6):
            pen(cv, F.p(s, 8), F.p(s + 0.4, 14), 0.35, on=m)
        plate(cv, F([(3.5, 0), (10.5, 1), (11, 7.5), (5, 7)]), WHITE, pid, dim=dim, r=1.4, tilt=F.vec(0.2, 0.1), line=0.5)       # thumb
    else:
        plate(cv, F([(-7.5, -2), (-8.5, 7), (7, 8), (8, -2)]), WHITE, pid, dim=dim, r=2.2, tilt=F.vec(-0.15, 0.15), line=0.6)
        for s, a, ln in ((-6.4, 14, 11), (-2.2, 5, 13), (2.0, -4, 13), (6.0, -14, 11)):
            c, sn = math.cos(math.radians(a)), math.sin(math.radians(a))
            b = F.p(s, 6.5)
            dd = F.vec(-sn, c)
            nn = V(dd[1], -dd[0]) * 1.9
            plate(cv, [b - nn, b + dd * ln - nn * 0.8, b + dd * (ln + 1.5), b + dd * ln + nn * 0.8, b + nn], WHITE, pid, dim=dim, r=1.2, line=0.5)
        plate(cv, F([(6, 0), (13, 5), (14.5, 9), (11, 9.5), (6, 6)]), WHITE, pid, dim=dim, r=1.2, line=0.5)


def pylon(cv, S, g, near):
    C = Frame(S, g["C"].up, g["sx"])
    k = 1.0 if near else 0.86
    sg = -1.0 if near else 1.0                                 # the spike leans away from the chest
    P = lambda pts: C([(sg * s * k, t * k) for s, t in pts])
    pid = 8 if near else 1
    m = plate(cv, P([(-11, -10), (-12, 6), (-7, 13), (4, 15), (13, 12), (19, 32), (20, 8), (16, -8), (3, -13)]), SUIT, pid, r=3.4, tilt=C.vec(-0.15 if near else 0.3, 0.3))
    plate(cv, P([(-13, -3), (18, -1), (17, -7.5), (3, -13.5), (-12, -10.5)]), WHITE, pid, r=1.6, tilt=C.vec(0.0, -0.3), clip=m, line=0.6)
    c = C.p(sg * 2 * k, 5 * k)
    cv.flat(SP.raster([], [(c[0], c[1], 3.6 * k)]) & m, INK)
    cv.flat(SP.raster([], [(c[0], c[1], 2.7 * k)]) & m, GOLD)


def arm(cv, p, n, g):
    S, E, Wr = V(*p[n + "s"]), V(*p[n + "e"]), V(*p[n + "w"])
    near = n == "n"
    pid, dim = (7, False) if near else (1, not p.get("abright"))
    kind = p.get(n + "hand", "fist")
    if not near and not p.get("lying"):
        pylon(cv, S, g, False)
    U = Frame(S, S - E)
    Lu = np.linalg.norm(S - E)
    plate(cv, U([(-6.5, 2), (-6.5, -Lu), (6.5, -Lu), (6.5, 2)]), SUIT, pid, dim=True, tilt=U.vec(-0.2, 0), quiet=[(S[0], S[1], 12)])
    cv.put(SP.raster([], [(E[0], E[1], 7.0)]), SUIT, 0.0, 0.0, pid, dim=True, line=0)
    F = Frame(E, E - Wr)
    L = max(np.linalg.norm(E - Wr), 14.0)
    plate(cv, F([(-4, 5), (0, 15), (4.5, 5)]), WHITE, pid, dim=dim, r=1.5, line=0.6)             # the spike past the elbow
    m = plate(cv, F([(-7.5, 4), (-9, -L * 0.5), (-12, -L + 2), (-12, -L - 3), (12, -L - 3), (12, -L + 2), (9.5, -L * 0.5), (8, 4), (0, 7)]), SUIT, pid, r=3.0,
              dim=dim, tilt=F.vec(-0.22, 0.05))
    cv.flat(m & SP.raster([F([(-13, -L + 2.5), (13, -L + 2.5), (13, -L - 0.5), (-13, -L - 0.5)])]), GOLD)
    pen(cv, F.p(-13, -L + 3.2), F.p(13, -L + 3.2), on=m)
    pen(cv, F.p(-9, -L * 0.42), F.p(9.5, -L * 0.42), on=m)
    d = unit(Wr - E)
    if kind != "none":
        fist(cv, Wr + d * 1.0, d, kind == "open", pid, dim)
    if near and not p.get("lying"):
        pylon(cv, S, g, True)
    if p.get("blade") and near:
        h, tip = V(*p["blade"][0]), V(*p["blade"][1])
        B = Frame(h, tip - h)
        plate(cv, B([(-2.6, -6), (2.6, -6), (2.6, 2), (-2.6, 2)]), GOLD, 9)
        plate(cv, B([(-6.5, 1), (6.5, 1), (5, 4.2), (-5, 4.2)]), GOLD, 9)
        ln = np.linalg.norm(tip - h)
        for w, lvl in ((7.0, 2), (4.4, 3), (1.9, 5)):                                          # the blade of light, in three flat layers
            cv.fx(lvl, [B([(-w, 4), (-w * 1.08, ln * 0.6), (0, ln + 2 * w - 12), (w * 1.08, ln * 0.6), (w, 4)])], (), True)


def geometry(p):
    """Where the trunk sits for this drawing: the chest, the pelvis, the neck."""
    c0, c1 = V(*p["c0"]), V(*p["c1"])
    side = bool(p.get("lying"))                                # on its back it shows its flank: everything is narrower
    sx = 0.45 if side else 1.0
    up = unit(c1 - c0)
    rt = V(up[1], -up[0])
    o = c0 + rt * (-8.0 if side else 10.0)
    C = Frame(o, up, sx)
    H = float(np.linalg.norm(c1 - c0))
    pc = 0.5 * (V(*p["nh"]) + V(*p["fh"])) + V(0, 3)
    lean = math.atan2(-up[0], up[1])
    ang = lean if side else 0.55 * lean - math.radians(2.6 * p.get("tilt", (0, 0))[0])
    neck = C.p(2.5 / sx if not side else 0, H + 8) if "head" not in p or side else V(*p["head"])
    return {"C": C, "H": H, "pc": pc, "cb": o, "sx": sx, "neck": neck, "hang": ang}


ORDER = ("wings", "farm", "fleg", "hips", "nleg", "chest", "head", "narm")


def draw(p):
    if p.get("dx") or p.get("dy"):
        p = moved(p, p.get("dx", 0), p.get("dy", 0), ALL)
    cv = Canvas(SP)
    g = geometry(p)
    for part in p.get("order", ORDER):
        if part == "wings":
            wings(cv, g)
        elif part in ("farm", "narm"):
            arm(cv, p, part[0], g)
        elif part in ("fleg", "nleg"):
            leg(cv, p, part[0], part[0] == "f")
        elif part == "hips":
            hips(cv, p, g)
        elif part == "chest":
            cv.em = chest(cv, p, g)
        elif part == "head":
            head(cv, p, g)
    ox, oy = p.get("dx", 0), p.get("dy", 0)
    for f in p.get("fx", ()):
        lvl, polys, discs, front = f(cv.em) if callable(f) else f
        cv.fx(lvl, [[(x + ox, y + oy) for x, y in q] for q in polys], [(x + ox, y + oy, r) for x, y, r in discs], front)
    return cv.encode(), cv.em


def only_fx(fx, extra=None):
    cv = Canvas(SP)
    if extra:
        extra(cv)
    for f in fx:
        cv.fx(*f)
    return cv.encode(), None


# ------------------------------------------------------------------ energy and air, as closed outlines
def crescent(c, r, w, a0, a1, front=True):
    """The smear of a blow: thin where it began (a0, degrees), full and white where the fist or the blade is now."""
    out = []
    for k, lvl in ((1.0, 2), (0.62, 3), (0.3, 5)) if front else ((0.3, 5), (0.62, 3), (1.0, 2)):      # behind the figure a layer cannot cover another: the core goes first
        o, i = [], []
        for n in range(25):
            t = n / 24
            a = math.radians(a0 + (a1 - a0) * t)
            ww = w * k * t ** 0.7 * min(1.0, (1 - t) / 0.1 + 0.15)
            o.append((c[0] + r * math.cos(a), c[1] + r * math.sin(a)))
            i.append((c[0] + (r - ww) * math.cos(a), c[1] + (r - ww) * math.sin(a)))
        out.append((lvl, [o + i[::-1]], (), front))
    return out


def streak(x0, x1, y, h):
    """A straight blow: speed lines behind the fist, a star of air where it stops."""
    out = [(3, [[(x0, y + h * 0.9), (x1 - 8, y + h * 1.25), (x1 - 8, y + h * 0.75)]], (), False),
           (3, [[(x0 + 8, y - h * 0.9), (x1 - 8, y - h * 1.3), (x1 - 8, y - h * 0.8)]], (), False),
           (5, [[(x0 + 14, y), (x1 - 10, y + h * 0.3), (x1 - 10, y - h * 0.3)]], (), False)]
    for r, lvl in ((13, 3), (8, 5)):
        pts = []
        for i in range(10):
            a = math.pi * i / 5 + 0.2
            rr = r if i % 2 == 0 else r * 0.36
            pts.append((x1 + 5 + rr * math.cos(a), y + rr * math.sin(a)))
        out.append((lvl, [pts], (), True))
    return out


def glow(r, wide=1.0, dx=0.0):
    """Light gathering on the lens of the chest."""
    return [(lambda em, k=k, lvl=lvl: (lvl, [ellipse(em[0] + dx, em[1], r * k * wide, r * k, 20)], (), True)) for k, lvl in ((1.0, 2), (0.66, 3), (0.36, 5))]


def glint(c, r=11):
    out = []
    for d in ((1, 0), (0, 1)):
        n = (-d[1], d[0])
        out.append((5, [[(c[0] - d[0] * r, c[1] - d[1] * r), (c[0] + n[0] * 1.3, c[1] + n[1] * 1.3), (c[0] + d[0] * r, c[1] + d[1] * r), (c[0] - n[0] * 1.3, c[1] - n[1] * 1.3)]], (), True))
    return out


def D(base=None, **kw):
    p = dict(base or {})
    p.update(kw)
    return p


def moved(p, dx, dy, keys):
    q = dict(p)
    for k in keys:
        if k in q:
            q[k] = (q[k][0] + dx, q[k][1] + dy)
    if q.get("blade") and "nw" in keys:
        q["blade"] = tuple((x + dx, y + dy) for x, y in q["blade"])
    return q


UPPER = ("c0", "c1", "ns", "ne", "nw", "fs", "fe", "fw", "head", "nh", "fh")
ALL = UPPER + ("nk", "na", "fk", "fa")

# ------------------------------------------------------------------ the key drawings
IDLE = D(na=(-34, 11), nk=(-27, 51), nh=(-10, 83), fa=(30, 11), fk=(27, 53), fh=(13, 85),
         c0=(-3, 100), c1=(1, 138),
         ns=(-21, 131), ne=(-33, 110), nw=(-17, 104),
         fs=(39, 137), fe=(51, 118), fw=(61, 133))
IDLE2 = D(moved(moved(IDLE, 0, -2, UPPER), 1, 0, ("nk", "fk")), nw=(-16, 103), fw=(62, 130))

# walk: contact, passing, contact, passing. The body drops on the contacts
WALK0 = D(IDLE, na=(16, 11), nk=(6, 50), nh=(-9, 82), fa=(-30, 17), ffoot="toe", fk=(-10, 52), fh=(11, 85),
          c0=(-3, 99), c1=(0, 137), ns=(-19, 130), ne=(-32, 109), nw=(-17, 106), fs=(38, 138), fe=(50, 118), fw=(63, 130))
WALK1 = D(IDLE, na=(-8, 11), nk=(-6, 53), nh=(-10, 87), fa=(10, 30), ffoot="hang", fk=(28, 62), fh=(12, 90),
          c0=(-3, 104), c1=(0, 142), ns=(-19, 135), ne=(-30, 113), nw=(-14, 113), fs=(38, 143), fe=(48, 121), fw=(60, 136))
WALK2 = D(IDLE, na=(-46, 17), nfoot="toe", nk=(-27, 51), nh=(-10, 82), fa=(38, 11), fk=(27, 53), fh=(12, 85),
          c0=(-3, 99), c1=(0, 137), ns=(-19, 130), ne=(-28, 108), nw=(-11, 109), fs=(38, 138), fe=(46, 116), fw=(57, 132))
WALK3 = D(IDLE, na=(-14, 28), nfoot="hang", nk=(6, 60), nh=(-10, 87), fa=(6, 11), fk=(9, 56), fh=(12, 90),
          c0=(-3, 104), c1=(0, 142), ns=(-19, 135), ne=(-31, 113), nw=(-15, 112), fs=(38, 143), fe=(47, 121), fw=(59, 137))

# jab with the lead arm, cross with the rear one coming through
JAB = D(IDLE, fk=(29, 52), c0=(-1, 99), c1=(7, 136), ns=(-14, 130), ne=(-30, 114), nw=(-16, 104),
        fs=(45, 136), fe=(64, 134), fw=(88, 133), abright=1)
CROSS = D(na=(-40, 17), nfoot="toe", nk=(-22, 49), nh=(-4, 81), fa=(33, 11), fk=(35, 51), fh=(18, 83),
          c0=(5, 97), c1=(16, 133), ns=(0, 127), ne=(30, 126), nw=(62, 125),
          fs=(52, 134), fe=(45, 112), fw=(58, 120))
# the heavy one: wound up behind the head, then thrown from the hip with the whole body
HWIND = D(na=(-33, 11), nk=(-32, 48), nh=(-15, 80), fa=(29, 11), fk=(22, 54), fh=(8, 84),
          c0=(-7, 98), c1=(-14, 135), ns=(-34, 127), ne=(-56, 124), nw=(-50, 148),
          fs=(25, 138), fe=(41, 121), fw=(56, 130))
HHIT = D(na=(-50, 17), nfoot="toe", nk=(-22, 44), nh=(4, 75), fa=(42, 11), fk=(46, 49), fh=(27, 77),
         c0=(13, 91), c1=(31, 124), ns=(15, 119), ne=(50, 119), nw=(84, 116),
         fs=(66, 124), fe=(58, 104), fw=(70, 110))
# front kick: knee up, then the sole in the other one's chest
KCH = D(na=(-24, 11), nk=(-22, 52), nh=(-9, 85), fa=(30, 62), ffoot="hang", fk=(36, 98), fh=(12, 89), fbright=1,
        c0=(-4, 102), c1=(-9, 139), ns=(-28, 131), ne=(-38, 109), nw=(-22, 108),
        fs=(29, 141), fe=(41, 120), fw=(52, 134))
KHIT = D(na=(-22, 11), nk=(-21, 52), nh=(-9, 85), fa=(96, 98), ffoot="sole", fk=(53, 96), fh=(12, 90), fbright=1,
         c0=(-5, 102), c1=(-17, 137), ns=(-36, 128), ne=(-52, 111), nw=(-60, 94),
         fs=(21, 140), fe=(35, 121), fw=(46, 134))
# grab: both hands out, hauled overhead, thrown down in front
REACH = D(na=(-36, 11), nk=(-24, 50), nh=(-6, 83), fa=(33, 11), fk=(33, 54), fh=(17, 86),
          c0=(2, 100), c1=(11, 137), ns=(-6, 129), ne=(22, 121), nw=(50, 127), nhand="open",
          fs=(48, 138), fe=(64, 127), fw=(82, 133), fhand="open", abright=1)
LIFT = D(na=(-35, 11), nk=(-28, 50), nh=(-11, 82), fa=(30, 11), fk=(27, 54), fh=(11, 85),
         c0=(-4, 99), c1=(-5, 137), ns=(-24, 131), ne=(-31, 154), nw=(-21, 173), nhand="open",
         fs=(33, 139), fe=(40, 160), fw=(32, 177), fhand="open", abright=1, order=("wings", "fleg", "hips", "nleg", "chest", "farm", "head", "narm"))
THROW = D(na=(-42, 17), nfoot="toe", nk=(-22, 48), nh=(0, 80), fa=(38, 11), fk=(40, 52), fh=(22, 82),
          c0=(8, 97), c1=(21, 131), ns=(6, 124), ne=(34, 114), nw=(58, 100), nhand="open",
          fs=(56, 131), fe=(74, 116), fw=(88, 100), fhand="open", abright=1)
# hit: the chest thrown back, the arms flung
STUN = D(na=(-38, 11), nk=(-33, 52), nh=(-15, 83), fa=(20, 17), ffoot="toe", fk=(16, 57), fh=(7, 86),
         c0=(-9, 100), c1=(-21, 136), tilt=(-4, -1), ns=(-40, 127), ne=(-58, 112), nw=(-66, 128), nhand="open",
         fs=(17, 139), fe=(34, 128), fw=(46, 144), fhand="open")
STUN2 = D(moved(STUN, 3, 0, UPPER), tilt=(-2, 0), nw=(-63, 124), fw=(48, 140))
# knocked down: off its feet going backwards, flat in the air, flat on the street
REEL = D(na=(8, 26), nfoot="hang", nk=(-4, 58), nh=(-22, 80), fa=(40, 40), ffoot="hang", fk=(22, 68), fh=(-2, 85),
         c0=(-18, 96), c1=(-39, 128), tilt=(-5, -2), ns=(-57, 119), ne=(-70, 136), nw=(-64, 156), nhand="open",
         fs=(-4, 132), fe=(16, 142), fw=(32, 156), fhand="open", dx=-2, dy=6)
FLAT = D(lying=1, c1=(-54, 26), c0=(-16, 26), head=(-58, 13),
         nh=(4, 12), nk=(40, 14), na=(80, 14), nfoot="upward", fh=(8, 20), fk=(40, 46), fa=(60, 13),
         ns=(-46, 26), ne=(-28, 34), nw=(-8, 30), fs=(-40, 32), fe=(-22, 38), fw=(-4, 34), fhand="none", dx=18,
         order=("farm", "fleg", "hips", "chest", "head", "nleg", "narm"))
AIR = D(FLAT, nk=(38, 28), na=(74, 46), fk=(36, 50), fa=(64, 72), ffoot="upward", ns=(-46, 28), ne=(-40, 52), nw=(-30, 70), nhand="open",
        fe=(-18, 56), fw=(-4, 70), fhand="open", dy=10)
# getting up: sitting, on one knee, crouched
SIT = D(c0=(-31, 22), c1=(-40, 58), nh=(-30, 12), nk=(4, 24), na=(42, 14), nfoot="upward",
        fh=(-14, 18), fk=(14, 42), fa=(34, 11), ns=(-59, 51), ne=(-66, 30), nw=(-62, 12), fs=(-2, 60), fe=(8, 44), fw=(20, 42), dx=-16)
KNEEL = D(nh=(-12, 50), nk=(-8, 15), na=(-46, 19), nfoot="toe", fa=(28, 11), fk=(30, 57), fh=(8, 56),
          c0=(-4, 68), c1=(7, 104), ns=(-10, 96), ne=(-24, 76), nw=(-22, 56),
          fs=(46, 105), fe=(50, 82), fw=(40, 66), dx=-10)
CROUCH = D(na=(-46, 11), nk=(-38, 50), nh=(-12, 62), fa=(42, 11), fk=(42, 52), fh=(14, 65),
           c0=(-3, 79), c1=(1, 117), ns=(-20, 110), ne=(-34, 90), nw=(-18, 86),
           fs=(39, 118), fe=(52, 98), fw=(64, 112))
# block: both forearms up in front of the chest
BLOCK = D(na=(-35, 11), nk=(-32, 50), nh=(-13, 81), fa=(29, 11), fk=(27, 54), fh=(9, 84),
          c0=(-6, 98), c1=(-8, 135), ns=(-26, 128), ne=(-2, 108), nw=(8, 136),
          fs=(30, 137), fe=(40, 112), fw=(30, 140), abright=1, order=("wings", "fleg", "hips", "nleg", "chest", "head", "farm", "narm"))
BLOCK2 = D(moved(BLOCK, -3, -1, UPPER), nk=(-34, 49), fk=(25, 53))
# the blade of light: lit overhead, then down through the other one
RAISE = D(na=(-35, 11), nk=(-29, 51), nh=(-12, 83), fa=(29, 11), fk=(25, 55), fh=(10, 86),
          c0=(-5, 100), c1=(-7, 138), ns=(-26, 131), ne=(-36, 152), nw=(-28, 168),
          fs=(31, 140), fe=(47, 124), fw=(62, 132), blade=((-27, 181), (-78, 203)))
RAISE0 = D(RAISE, blade=((-27, 181), (-46, 190)))
SLASH = D(HHIT, ns=(15, 119), ne=(44, 106), nw=(66, 88), blade=((74, 78), (114, 44)))
SHEATHE = D(SLASH, blade=None)
# the chest beam: braced low, the arms thrown back off the lens
BEAM = D(CROUCH, ns=(-22, 110), ne=(-44, 98), nw=(-36, 78), fs=(39, 118), fe=(58, 106), fw=(54, 86), abright=1)
BEAM2 = D(moved(BEAM, -1, 0, UPPER))
# the fist in the air
TAUNT = D(na=(-31, 11), nk=(-25, 52), nh=(-11, 86), fa=(27, 11), fk=(23, 56), fh=(11, 89),
          c0=(-4, 103), c1=(-4, 141), ns=(-23, 135), ne=(-33, 158), nw=(-27, 178),
          fs=(34, 142), fe=(50, 124), fw=(40, 108))
# the rocket punch: the lead arm levelled and steadied with the other hand, then it leaves the elbow
AIM = D(na=(-42, 11), nk=(-30, 49), nh=(-8, 80), fa=(36, 11), fk=(34, 52), fh=(16, 83),
        c0=(1, 97), c1=(8, 134), ns=(-9, 127), ne=(14, 112), nw=(40, 122), nhand="open",
        fs=(46, 134), fe=(62, 126), fw=(86, 126), abright=1, order=("wings", "farm", "fleg", "hips", "nleg", "chest", "head", "narm"))
FIRED = D(moved(AIM, -4, 0, UPPER), fhand="none")

KEYS = {
    "idle": IDLE, "idle2": IDLE2, "walk0": WALK0, "walk1": WALK1, "walk2": WALK2, "walk3": WALK3,
    "jab": D(JAB, fx=streak(46, 104, 133, 7)), "jab_h": JAB,
    "cross": D(CROSS, fx=streak(14, 80, 125, 8)), "cross_h": CROSS,
    "hwind": HWIND, "hhit": D(HHIT, fx=crescent((34, 118), 72, 22, 150, -4)), "hhit_h": HHIT,
    "kch": KCH, "khit": D(KHIT, fx=crescent((14, 90), 102, 16, -70, 5)), "khit_h": KHIT,
    "reach": REACH, "lift": LIFT, "throw": D(THROW, fx=crescent((10, 110), 86, 14, 95, -6, front=False)), "throw_h": THROW,
    "stun": STUN, "stun2": STUN2, "reel": REEL, "air": AIR, "bounce": D(AIR, dy=2), "flat": FLAT,
    "sit": SIT, "kneel": KNEEL, "crouch": CROUCH, "block": BLOCK, "block2": BLOCK2,
    "raise0": RAISE0, "raise": RAISE, "raise_g": D(RAISE, fx=glint((-76, 202), 8)),
    "slash": D(SLASH, fx=crescent((24, 96), 104, 30, 130, -29)), "slash2": D(SLASH, fx=crescent((24, 96), 104, 18, 60, -29)),
    "slash3": D(SLASH, fx=crescent((24, 96), 104, 7, 10, -29)), "slash_h": SLASH, "sheathe": SHEATHE,
    "beam0": BEAM, "beam1": D(BEAM, glow=1, fx=glow(9)), "beam2": D(BEAM, glow=1, fx=glow(14)),
    "beam3": D(BEAM2, glow=1, fx=glow(19, 1.4, 4)), "beam4": D(BEAM, glow=1, fx=glow(15, 1.4, 3)),
    "taunt": TAUNT, "aim": AIM, "fired": D(FIRED, fx=[(3, [], [(82, 126, 9)], True), (5, [], [(82, 126, 5)], True)]),
}


def rocket_fist(cv):
    """The fist on its own, in flight: the shader carries this cell across the street."""
    F = Frame((0, 100), (1, 0))
    plate(cv, F([(-11, -12), (11, -12), (12.5, -3), (-12.5, -3)]), SUIT, 1, r=3.0, tilt=(-0.1, 0.3))
    cv.flat(SP.raster([F([(-13, -6.5), (13, -6.5), (13, -3), (-13, -3)])]) & (cv.cls > 0), GOLD)
    fist(cv, V(0, 100), V(1, 0), False, 2, False)


ROCKET_FX = [(5, [[(-12, 100), (-20, 105), (-36, 100), (-20, 95.5)]], (), False), (3, [[(-12, 100), (-22, 109), (-52, 101), (-24, 92)]], (), False),
             (2, [[(-12, 100), (-24, 114), (-50, 108), (-42, 101), (-68, 96), (-46, 94), (-52, 88), (-26, 86)]], (), False)]

# cell -> drawing, exactly where robokaiju.frag looks for it. A held drawing fills several cells
CELLS = ["idle", "idle2", "idle", "idle2",                                   # 0-3 idle
         "walk0", "walk0", "walk1", "walk2", "walk2", "walk3",                 # 4-9 walk
         "idle2", "jab", "jab_h", "hwind", "cross", "cross_h",                 # 10-15 jab, cross
         "hwind", "hwind", "hhit", "hhit_h", "crouch",                         # 16-20 the heavy one
         "kch", "khit", "khit_h", "kch", "idle2",                              # 21-25 kick
         "reach", "reach", "lift", "lift", "throw", "throw_h",                 # 26-31 grab, lift, throw
         "stun", "stun2",                                                      # 32-33 hit
         "reel", "air", "bounce", "flat", "flat",                              # 34-38 knocked down
         "sit", "kneel", "crouch", "idle2",                                    # 39-42 getting up
         "block", "block2",                                                    # 43-44 block
         "raise0", "raise", "raise_g", "slash", "slash2", "slash3", "slash_h", "sheathe",   # 45-52 the blade
         "beam0", "beam1", "beam2", "beam3", "beam4",                          # 53-57 the chest beam
         "taunt",                                                              # 58 fist in the air
         "aim", "fired", "fist"]                                               # 59-61 the rocket punch
# the table for whoever plays the sheet: cells and how long each drawing is held, in ticks of 1/12 s
ACTIONS = {
    "idle": ([0, 1], [6, 6]), "walk": ([4, 6, 7, 9], [3, 2, 3, 2]),
    "combo": ([10, 11, 12, 13, 14, 15], [2, 1, 2, 2, 1, 3]), "heavy": ([16, 18, 19, 20], [5, 1, 4, 2]),
    "kick": ([21, 22, 23, 24], [3, 1, 3, 2]), "grab": ([26, 28, 30, 31], [4, 6, 1, 3]),
    "hit": ([32, 33], [2, 3]), "knockdown": ([34, 35, 36, 37], [2, 3, 1, 6]), "getup": ([39, 40, 41, 42], [3, 3, 2, 2]),
    "block": ([43, 44], [2, 3]), "blade": ([45, 46, 47, 48, 49, 50, 51, 52], [2, 2, 3, 1, 1, 1, 3, 3]),
    "beam": ([53, 54, 55, 56, 57], [3, 3, 3, 1, 1]), "taunt": ([58], [8]), "rocket": ([59, 60], [3, 6]), "rocket_fist": ([61], [1]),
}


def build():
    done, em = {}, {}
    for name in dict.fromkeys(CELLS):
        done[name], em[name] = only_fx(ROCKET_FX, rocket_fist) if name == "fist" else draw(KEYS[name])
    bad = [n for n in done if cut_by_cell(done[n])]
    px, py = CW * SP.scale, CH * SP.scale
    sheet = np.zeros((ROWS * py, COLS * px, 4), np.uint8)
    for i, n in enumerate(CELLS):
        sheet[(i // COLS) * py:(i // COLS + 1) * py, (i % COLS) * px:(i % COLS + 1) * px] = done[n]
    Image.fromarray(sheet, "RGBA").save(OUT, optimize=True)
    table = {"cell": [CW, CH], "texelsPerUnit": SP.scale, "cols": COLS, "rows": ROWS,
             "encoding": "cel sheet, see scripts/toku/cel.py: suit = armour, dim suit = joints and far limbs, white = panels, gold = crest and trims, visor = eyes, energy = lens of the chest",
             "tick": "1/12 s", "emitter": [round(float(v), 1) for v in em["beam3"]], "rocketWrist": [86, 126], "rocketFist": [0, 100],
             "note": "emitter = the lens of the chest in cells 53-57, units from the feet; the rocket fist (cell 61) is drawn with its wrist on rocketFist",
             "actions": {k: {"frames": f, "hold": h, "anchor": [OX, OY]} for k, (f, h) in ACTIONS.items()},
             "cells": CELLS}
    (HERE / "robo.json").write_text(json.dumps(table, indent=1) + "\n")
    print(f"{OUT.name}: {len(CELLS)} cells, {len(done)} drawings, lens at {table['emitter']}")
    return done, bad


def preview(done, path, names=None, cols=8):
    names = names or list(done)
    px, py = CW * SP.scale, CH * SP.scale
    rows = -(-len(names) // cols)
    out = np.zeros((rows * py, cols * px, 3), np.float32)
    for i, n in enumerate(names):
        out[(i // cols) * py:(i // cols + 1) * py, (i % cols) * px:(i % cols + 1) * px] = paint(done[n], (0.16, 0.5, 0.92), (0.8, 0.5, 0.36))
    im = Image.fromarray((out * 255).astype(np.uint8))
    (im.resize((im.width // 2, im.height // 2), Image.LANCZOS) if len(names) > 4 else im).save(path)


def main():
    if "--only" in sys.argv:                                  # a few drawings, no atlas: python3 robo.py --only idle,jab --preview F.png
        names = sys.argv[sys.argv.index("--only") + 1].split(",")
        done = {n: (only_fx(ROCKET_FX, rocket_fist) if n == "fist" else draw(KEYS[n]))[0] for n in names}
        preview(done, sys.argv[sys.argv.index("--preview") + 1], cols=min(len(names), 4))
        return
    done, bad = build()
    if "--preview" in sys.argv:
        preview(done, sys.argv[sys.argv.index("--preview") + 1])
    assert not bad, f"cut by their cell: {bad}"                # after the preview, so it can show which


if __name__ == "__main__":
    main()
