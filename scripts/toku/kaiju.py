#!/usr/bin/env python3
"""toku-kaiju.png: the kaiju of Robo vs Kaiju, a cel sheet (see cel.py).

    python3 scripts/toku/kaiju.py                 writes the atlas and scripts/toku/kaiju.json
    python3 scripts/toku/kaiju.py --preview F.png also a contact sheet of every drawing

A giant reptile that walks upright: a heavy tail, thick legs, small arms with claws, a long jaw full
of teeth under a heavy brow, a row of bone plates down its back that light up from the tail when it
charges its breath. The trunk, the neck and the tail are one limb drawn along the spine (eight points
written by hand for each pose, tail tip first); legs and arms are limbs along their own points; the
head, the feet and the plates are outlines set on those. x toward the enemy, y up, units from the feet.

Classes: suit = hide (dim = the far limbs and the brow), dim white = belly and bone plates,
white = teeth, claws, horns and the spikes of the tail, gold = the eye, energy = the cores of the plates
and the breath.
Cells 0-58 keep the meaning robokaiju.frag gives them, 59-61 are the bite.
"""
import json
import math
import pathlib
import sys

import numpy as np
from PIL import Image, ImageFilter

from cel import SUIT, WHITE, INK, GOLD, Canvas, Space, closed, cut_by_cell, paint, spline

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent.parent / "src/engine/assets/toku-kaiju.png"
CW, CH, OX, OY, COLS, ROWS = 288, 224, 140, 212, 8, 8
SP = Space(CW, CH, OX, OY)


def V(*a):
    return np.array(a, float)


def unit(v):
    return v / max(np.linalg.norm(v), 1e-6)


def left(v):
    return V(-v[1], v[0])


def rad(a):
    return V(math.cos(math.radians(a)), math.sin(math.radians(a)))


class Frame:
    """Origin o, s along `fwd`, t to its left (or to its right when the figure has its back to us)."""

    def __init__(self, o, fwd, flip=False):
        self.o, self.fwd = V(*o), unit(V(*fwd))
        self.up = left(self.fwd) * (-1.0 if flip else 1.0)

    def __call__(self, pts):
        return [tuple(self.o + self.fwd * s + self.up * t) for s, t in pts]

    def p(self, s, t):
        return self.o + self.fwd * s + self.up * t


def pillow(m, r, flat=0.95):
    """Normals of a shape treated as a cushion: flat inside, rounding off over r units at its edge."""
    nx, ny = np.zeros(m.shape, np.float32), np.zeros(m.shape, np.float32)
    ys, xs = np.nonzero(m)
    if not len(ys):
        return nx, ny
    pad = int(3 * r * SP.k) + 2                                # only the shape's own box is filtered
    y0, y1, x0, x1 = max(ys.min() - pad, 0), ys.max() + pad + 1, max(xs.min() - pad, 0), xs.max() + pad + 1
    c = m[y0:y1, x0:x1]
    b = np.asarray(Image.fromarray(c.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(r * SP.k)), np.float32) / 255
    gy, gx = np.gradient(b)
    l = np.maximum(np.hypot(gx, gy), 1e-6)
    t = np.clip(2.2 * (1 - b), 0, 1) * flat
    nx[y0:y1, x0:x1], ny[y0:y1, x0:x1] = -gx / l * t * c, gy / l * t * c
    return nx, ny


def lay(cv, m, cls, nx=0.0, ny=0.0, pid=1, dim=False, line=0.9, quiet=()):
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


def shape(cv, poly, cls, pid, r=2.5, dim=False, line=0.9, smooth=True, quiet=(), clip=None):
    m = SP.raster([closed(poly, 6) if smooth else poly])
    if clip is not None:
        m &= clip
    if cls == GOLD:
        lay(cv, m, GOLD, 1.0, 0.5, pid, line=line)
    else:
        nx, ny = pillow(m, r)
        lay(cv, m, cls, nx, ny, pid, dim=dim, line=line, quiet=quiet)
    return m


def pen(cv, pts, w=0.6, on=None):
    """A crease: a pen line through pts."""
    for a, b in zip(pts[:-1], pts[1:]):
        a, b = V(*a), V(*b)
        n = unit(left(b - a)) * w
        m = SP.raster([[a + n, b + n, b - n, a - n]], [(a[0], a[1], w), (b[0], b[1], w)]) & (cv.cls > 0)
        cv.flat(m if on is None else m & on, INK)


def claw(cv, b, d, ln, w, pid, dim=False, bend=0.25):
    """A claw or a tooth from b along d: a curved spike."""
    b, d = V(*b), unit(V(*d))
    n = left(d)
    m = SP.raster([[b + n * w, b + d * ln * 0.55 + n * (w * 0.55 - bend * ln * 0.3), b + d * ln - n * bend * ln, b + d * ln * 0.5 - n * (w * 0.75 + bend * ln * 0.2), b - n * w]])
    nx, ny = pillow(m, 1.2)
    lay(cv, m, WHITE, nx, ny, pid, dim=dim, line=0.6)


# ------------------------------------------------------------------ the parts
# the spine: how thick the body is at each of the eight points, on the side of the back and of the belly
WIDTH = [(1.6, 1.6), (6.5, 6.5), (12.5, 13.5), (22, 25), (23, 27), (20.5, 22), (16, 16), (13, 13)]
PLATES = [(1.15, 6), (1.7, 9), (2.25, 13), (2.8, 17), (3.35, 22), (3.95, 25), (4.55, 24), (5.15, 20), (5.75, 15), (6.3, 10)]     # where along the spine, how tall


def spine(p):
    flip = bool(p.get("flip"))
    st = [(x, y, *(WIDTH[i][::-1] if flip else WIDTH[i])) for i, (x, y) in enumerate(p["S"])]
    return st, spline(np.asarray(st, float))


def at(sp, g, flip):
    """The spine at logical g: the point, the way it runs, the way of the back, how thick the back is there."""
    i = int(np.clip(round(g * 10), 1, len(sp) - 2))
    t = unit(sp[i + 1, :2] - sp[i - 1, :2])
    return sp[i, :2], t, left(t) * (-1.0 if flip else 1.0), sp[i, 3 if flip else 2]


def plates(cv, p, sp):
    """The bone plates, drawn before the body so it hides their roots. `glow` lights them from the tail up."""
    flip, glow = bool(p.get("flip")), p.get("glow", 0.0)
    for g, ln in ((0.22, 13), (0.5, 17)):                      # two spikes near the tip of the tail
        c, t, n, w = at(sp, g, flip)
        claw(cv, c + n * (w - 1.5), n * 0.85 - t * 0.5, ln * (0.5 + 0.5 * p.get("squash", 1.0)), 3.2, 9, bend=0.12)
    for i, (g, h) in enumerate(PLATES):
        h *= p.get("squash", 1.0)                              # lying on them
        c, t, n, w = at(sp, g, flip)
        d = unit(n * math.cos(0.3) - t * math.sin(0.3))        # they lean toward the tail
        F = Frame(c + n * (w - 4), d, not flip)
        k = h * 0.42
        leaf = [(-3, k), (h * 0.42, k * 1.15), (h * 0.5, k * 0.5), (h, k * 0.15), (h * 0.66, -k * 0.5), (h * 0.5, -k * 1.1), (-3, -k * 0.9)]
        m = SP.raster([F(leaf)])
        nx, ny = pillow(m, 1.6)
        lay(cv, m, WHITE, nx, ny, 9, dim=True, line=0.7)
        lit = glow > 0 and glow > i / (len(PLATES) - 1) - 0.01
        core = [(1 + (s - 1) * 0.62, v * 0.6) for s, v in leaf]
        if lit:
            cv.fx(3, [F(leaf)], (), True)
            cv.fx(5, [F(core)], (), True)
        else:
            cv.fx(1, [F(core)], (), True)                      # a seam of light that the shader pulses with the bass


def body(cv, p, st, sp):
    flip = bool(p.get("flip"))
    m, G, U, nx, ny = SP.stroke(st, flat=0.92)
    u = -U if flip else U                                      # +1 on the back, -1 on the belly
    belly = (u < -0.22 - 0.9 * np.clip(2.9 - G, 0, 1) - 0.6 * np.clip(G - 6.3, 0, 1)) & m
    cls = np.where(belly, WHITE, SUIT).astype(np.int8)
    lay(cv, m, cls, nx, ny, 4, dim=belly)
    for g in np.arange(2.75, 6.5, 0.34):                                                     # the plates of the belly
        c, t, n, _ = at(sp, g, flip)
        w = sp[int(round(g * 10)), 2 if flip else 3]
        pen(cv, [c - n * w * 0.24 - t * 1.5, c - n * w * 0.62 + t * 1.2, c - n * w], 0.55, on=belly)
    return m


def head(cv, p, sp):
    flip = bool(p.get("flip"))
    ang, jaw = p["head"]
    o = sp[-1, :2]
    H = Frame(o, rad(ang), flip)
    sg = -1.0 if flip else 1.0
    J = Frame(H.p(0, -4), rad(ang - sg * jaw), flip)           # the lower jaw swings on its hinge
    for a, b, c in (((-8, 11), (-27, 21), (-5, 17)), ((-3, 16), (-17, 33), (4, 19))):         # two horns swept back
        m = SP.raster([H([a, b, c])])
        nx, ny = pillow(m, 1.6)
        lay(cv, m, WHITE, nx, ny, 5, line=0.7)
    if jaw > 5:                                                # the inside of the mouth: dark, or alight
        gape = [H.p(0, -4), H.p(42, -3), J.p(40, 0), J.p(4, 0)]
        m = SP.raster([gape])
        if p.get("fire"):
            cv.fx(2, [gape], (), True)
            cv.fx(4, [[H.p(6, -4), H.p(40, -4), J.p(38, 1.5), J.p(8, 1)]], (), True)
        else:
            lay(cv, m, INK, pid=5, line=0)
            cv.flat(m, INK)
    for x in (17, 23, 29, 35):                                 # lower teeth
        claw(cv, J.p(x, -1), J.up - J.fwd * 0.1, 6.0, 2.3, 5, bend=0.1)
    shape(cv, J([(-6, 0), (10, 0), (30, 0), (40, -1), (41.5, -5), (35, -9), (14, -11), (0, -10), (-8, -5)]), SUIT, 5, r=3.0)
    for x in (15, 21, 27, 33, 39):                             # upper teeth
        claw(cv, H.p(x, -2.5), -H.up - H.fwd * 0.12, 6.6 if x < 38 else 5.0, 2.5, 5, bend=0.1)
    m = shape(cv, H([(-9, -5), (-12, 5), (-8, 14), (2, 19), (12, 18), (22, 13), (34, 11.5), (42, 9), (45.5, 3), (43, -3), (24, -3.5), (8, -5)]), SUIT, 5, r=4.0)
    shape(cv, H([(0, 16.5), (9, 21), (21, 15.5), (18, 11.5), (9, 13.5), (2, 12.5)]), SUIT, 5, r=1.6, dim=True, line=0.7)       # the brow
    eye = SP.raster([H([(9.5, 12.6), (16.8, 11.2), (15.6, 8.4), (10.4, 8.6)])]) & m
    cv.flat(SP.grow(eye, 0.5) & m, INK)
    cv.flat(eye, GOLD)
    cv.flat(eye & SP.raster([H([(12.6, 13), (13.8, 13), (13.6, 8), (12.8, 8)])]), INK)
    n = H.p(41, 6.5)
    cv.flat(SP.raster([], [(n[0], n[1], 1.1)]) & m, INK)
    pen(cv, [H.p(4, -3), H.p(9, 3), H.p(18, 5.5), H.p(28, 4)], 0.5, on=m)                      # the cheek
    return H.p(44, -4), J.p(40, 0)


def leg(cv, hip, L, pid, dim, flip):
    kx, ky, ax, ay, fa = L
    hip, K, A = V(*hip), V(kx, ky), V(ax, ay)
    F = Frame(A, rad(180 - fa if flip else fa), flip)
    for i, s in enumerate((24, 16, 8)):                        # claws first, the far one first
        claw(cv, F.p(s, -6.5 + i * 0.5), F.fwd - F.up * 0.36, 16, 4.4, pid, dim)
    shape(cv, F([(-11, -11), (-12.5, -2), (-7, 6), (6, 8), (18, 2.5), (28, -4), (31, -11)]), SUIT, pid, r=3.4, dim=dim)
    th, shn = K - hip, A - K
    n = left(unit(th))
    st = [(*(hip - unit(th) * 4), 15, 15), (*(hip + 0.42 * th), 16, 15), (*K, 10.5, 10.5), (*(K + 0.5 * shn), 8.5, 9), (*A, 7.5, 7.5)]
    m, G, U, nx, ny = SP.stroke(st, [0, 0.45, 1, 1.5, 2], flat=0.92)
    lay(cv, m, SUIT, nx, ny, pid, dim=dim, quiet=[(hip[0] - unit(th)[0] * 6, hip[1] - unit(th)[1] * 6, 13)])
    pen(cv, [hip + 0.3 * th - n * 6, hip + 0.62 * th - n * 8.5, K - n * 5 - unit(th) * 3], 0.55, on=m)     # the muscle of the thigh
    return m


def arm(cv, sh, A, pid, dim, flip):
    ex, ey, wx, wy, d = A
    sh, E, Wr = V(*sh), V(ex, ey), V(wx, wy)
    dd = rad(180 - d if flip else d)
    for k in (-1, 0, 1):
        c, s = math.cos(0.42 * k), math.sin(0.42 * k)
        claw(cv, Wr + left(dd) * 3.0 * k + dd * 2, V(dd[0] * c - dd[1] * s, dd[0] * s + dd[1] * c), 14, 3.0, pid, dim)
    claw(cv, E, E - 0.5 * (sh + Wr), 9.5, 2.6, pid, dim, bend=0.1)                            # a spur on the elbow
    st = [(*sh, 9.5, 9.5), (*(0.5 * (sh + E)), 8.6, 7.6), (*E, 5.0, 5.4), (*(0.55 * E + 0.45 * Wr), 5.6, 4.2), (*Wr, 3.5, 3.5), (*(Wr + dd * 4.5), 5.8, 5.8)]
    m, G, U, nx, ny = SP.stroke(st, [0, 0.5, 1, 1.45, 2, 2.3], flat=0.92)
    lay(cv, m, SUIT, nx, ny, pid, dim=dim, quiet=[(sh[0], sh[1], 9)])



def draw(p):
    cv = Canvas(SP)
    flip = bool(p.get("flip"))
    st, sp = spine(p)
    _, t3, n3, _ = at(sp, 3.0, flip)
    _, t5, n5, _ = at(sp, 5.0, flip)
    hipN, hipF = V(*p["S"][3]) - n3 * 8, V(*p["S"][3]) - n3 * 6 - t3 * 12
    shN, shF = V(*p["S"][5]) - n5 * 9, V(*p["S"][5]) - n5 * 11 + t5 * 7
    arm(cv, shF, p["b"], 1, True, flip)
    leg(cv, hipF, p["F"], 2, True, flip)
    plates(cv, p, sp)
    body(cv, p, st, sp)
    leg(cv, hipN, p["N"], 3, False, flip)
    mouth = head(cv, p, sp)
    arm(cv, shN, p["a"], 6, False, flip)
    for f in p.get("fx", ()):
        lvl, polys, discs, front = f(mouth) if callable(f) else f
        cv.fx(lvl, polys, discs, front)
    return cv.encode(), mouth


# ------------------------------------------------------------------ energy and air, as closed outlines
def crescent(c, r, w, a0, a1, front=True):
    """The smear of a blow: thin where it began (a0, degrees), full and white where the claw or the tail is now."""
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


def lines(x0, x1, y, h):
    """Speed lines behind a lunge."""
    return [(3, [[(x0, y + h), (x1, y + h * 1.3), (x1, y + h * 0.8)]], (), False), (3, [[(x0 + 10, y - h), (x1, y - h * 1.3), (x1, y - h * 0.8)]], (), False),
            (5, [[(x0 + 16, y), (x1, y + h * 0.25), (x1, y - h * 0.25)]], (), False)]


def breath(r, wide=1.3):
    """Light in the jaws, where the breath leaves them."""
    def ring(k, lvl):
        return lambda mj: (lvl, [[(0.5 * (mj[0][0] + mj[1][0]) + 3 + r * k * wide * math.cos(a), 0.5 * (mj[0][1] + mj[1][1]) + r * k * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 16, endpoint=False)]], (), True)
    return [ring(1.0, 2), ring(0.66, 3), ring(0.36, 5)]


def K(S, head, N, F, a, b, **kw):
    return dict(S=S, head=head, N=N, F=F, a=a, b=b, **kw)


def D(base, **kw):
    q = dict(base)
    q.update(kw)
    return q


def turned(p, deg, piv=(0, 0), dx=0.0, dy=0.0):
    """The whole drawing turned about piv and moved: a body thrown back, lifted, falling."""
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))

    def tp(x, y):
        x, y = x - piv[0], y - piv[1]
        return (piv[0] + x * c - y * s + dx, piv[1] + x * s + y * c + dy)
    q = dict(p)
    q["S"] = [tp(*v) for v in p["S"]]
    q["head"] = (p["head"][0] + deg, p["head"][1])
    for k in "NFab":
        v = p[k]
        q[k] = (*tp(v[0], v[1]), *tp(v[2], v[3]), v[4] + deg)
    return q


def up(S, dx, dy, frm=4):
    """The spine with its upper part (from point `frm`) moved."""
    return [(x + dx, y + dy) if i >= frm else (x, y) for i, (x, y) in enumerate(S)]


# ------------------------------------------------------------------ the key drawings
# S: tail tip, tail, root of the tail, hips, belly, chest, base of the neck, back of the skull
# head: where the snout points (degrees), how far the jaw hangs open
# N, F: near and far leg as knee, ankle, how the foot is turned; a, b: near and far arm as elbow, wrist, where the claws point
S_A = [(-126, 30), (-92, 15), (-52, 31), (-15, 60), (4, 88), (14, 114), (20, 136), (24, 153)]              # standing
S_L = [(-128, 78), (-96, 68), (-58, 60), (-16, 62), (14, 76), (42, 92), (62, 106), (74, 114)]              # leaning in
S_H = [(-124, 92), (-94, 78), (-56, 66), (-14, 62), (18, 73), (48, 84), (70, 93), (84, 98)]                # thrown forward, head first
S_R = [(-118, 8), (-88, 9), (-56, 24), (-26, 56), (-12, 88), (-4, 118), (2, 142), (7, 158)]                # reared back
S_F = [(-126, 44), (-94, 34), (-56, 40), (-18, 58), (6, 84), (26, 106), (40, 124), (48, 134)]              # braced to fire
S_C = [(-122, 12), (-94, 11), (-60, 22), (-24, 42), (4, 56), (30, 64), (48, 68), (60, 70)]                 # down on its hands
S_K = [(130, 9), (98, 8), (62, 13), (28, 27), (-2, 34), (-28, 34), (-48, 31), (-62, 28)]                    # on its back
S_SW = [(132, 90), (100, 86), (62, 76), (24, 58), (-4, 64), (-28, 78), (-44, 94), (-54, 106)]              # its back turned, the tail brought round

IDLE = K(S_A, (-8, 0), (18, 38, 6, 11, 0), (-10, 38, -22, 11, 0), (33, 92, 49, 96, -15), (41, 98, 57, 104, -5))
STEP_F, STEP_B, STEP_UP = (30, 36, 26, 11, 0), (-16, 36, -40, 15, -18), (10, 46, -4, 26, -24)
LEAN = K(S_L, (-10, 18), (30, 36, 26, 11, 0), (-20, 36, -42, 15, -18), (66, 72, 82, 78, -10), (72, 80, 88, 88, -5))
REAR = K(S_R, (20, 8), (6, 38, -4, 11, 0), (-20, 38, -32, 11, 0), (22, 100, 38, 104, 0), (30, 106, 46, 112, 10))
LUNGE = K(S_H, (-22, 4), (34, 36, 30, 11, 0), (-22, 36, -46, 15, -18), (52, 60, 42, 48, -120), (60, 66, 50, 54, -120))
BRACE = K(S_F, (0, 36), (26, 36, 22, 11, 0), (-22, 36, -44, 15, -18), (30, 94, 22, 110, 100), (38, 100, 30, 116, 100), glow=1.0, fire=1)
CROUCH = K(S_C, (-6, 0), (14, 28, -2, 11, 0), (-12, 28, -28, 11, 0), (50, 38, 56, 15, -70), (58, 42, 66, 17, -70))
DOWN = K(S_K, (164, 24), (56, 58, 80, 50, 55), (68, 52, 92, 42, 55), (-18, 54, -10, 68, 95), (-26, 50, -20, 64, 95), squash=0.3)
SWIPE = K(S_SW, (196, 16), (12, 30, 22, 11, 0), (36, 30, 46, 11, 0), (-46, 60, -60, 56, 200), (-52, 66, -66, 62, 200), flip=1)

KEYS = {
    "idle_a": IDLE, "idle_b": D(IDLE, S=up(S_A, 0, 1.5), head=(-6, 0)), "idle_c": D(IDLE, S=up(S_A, 0, 1.5), head=(-4, 14)),
    "walk_1": D(IDLE, S=up(S_A, 0, -2, 3), N=STEP_F, F=STEP_B), "walk_2": D(IDLE, S=up(S_A, 0, 1, 3), F=STEP_UP),
    "walk_3": D(IDLE, S=up(S_A, 0, -2, 3), N=(-2, 36, -24, 15, -18), F=(22, 36, 18, 11, 0)), "walk_4": D(IDLE, S=up(S_A, 0, 1, 3), N=(26, 46, 12, 26, -24), F=(-12, 38, -22, 11, 0)),
    "claw_wind": D(IDLE, S=up(S_A, -5, 0), head=(4, 8), a=(12, 122, 20, 140, 75)),
    "claw_a_fx": D(LEAN, a=(72, 96, 96, 86, -30), fx=crescent((70, 96), 58, 20, 105, -22)), "claw_a": D(LEAN, a=(72, 96, 96, 86, -30)),
    "claw_b_fx": D(LEAN, S=up(S_L, 4, -2), head=(-14, 28), a=(44, 106, 50, 124, 75), b=(82, 104, 106, 96, -30), fx=crescent((80, 104), 58, 20, 105, -22)),
    "claw_b": D(LEAN, S=up(S_L, 4, -2), head=(-14, 28), a=(44, 106, 50, 124, 75), b=(82, 104, 106, 96, -30)),
    "horn_wind": D(REAR, a=(6, 122, 14, 140, 75), b=(14, 128, 24, 146, 75)),
    "horn_fx": D(LUNGE, fx=lines(-20, 70, 128, 12) + crescent((96, 96), 40, 12, 110, -60)), "horn": LUNGE,
    "kick_wind": D(REAR, S=[(x - 6, y) for x, y in S_R], N=(10, 66, 4, 40, -18), head=(4, 8)),
    "kick_fx": D(turned(D(REAR, N=(8, 62, 46, 66, 74), head=(8, 22), a=(8, 118, 14, 136, 75)), 6, (-30, 0), 42), fx=crescent((24, 62), 80, 16, -56, 8)),
    "kick": turned(D(REAR, N=(8, 62, 46, 66, 74), head=(8, 22), a=(8, 118, 14, 136, 75)), 6, (-30, 0), 42),
    "grab": D(LEAN, head=(-4, 32), a=(74, 96, 98, 100, 0), b=(80, 104, 104, 110, 5)),
    "lift": D(REAR, head=(40, 6), a=(10, 128, 6, 146, 95), b=(18, 134, 16, 152, 95)),
    "throw": D(LEAN, head=(-18, 28), a=(68, 76, 84, 62, -55), b=(76, 84, 92, 70, -55)),
    "stun_a": turned(D(IDLE, head=(36, 24), a=(36, 122, 52, 134, 50), b=(44, 128, 60, 142, 50)), 11, (-10, 20)),
    "stun_b": turned(D(IDLE, head=(36, 24), a=(36, 122, 52, 134, 50), b=(44, 128, 60, 142, 50)), 6, (-10, 20)),
    "launched": turned(D(REAR, S=[(-100, 62), (-82, 38), (-56, 30)] + S_R[3:], head=(36, 24), N=(14, 58, 10, 32, -20), F=(-12, 50, -22, 26, -24), a=(22, 124, 36, 138, 60), b=(30, 130, 44, 146, 60)), 20, (-10, 30), 14, 2),
    "air": turned(DOWN, -12, (0, 24), -4, 40), "bounce": turned(DOWN, 0, (0, 0), 0, 5), "flat": DOWN,
    "push_up": turned(D(CROUCH, S=[(-112, 36), (-90, 26), (-60, 28)] + S_C[3:], head=(4, 10), a=(52, 60, 68, 50, -40), b=(60, 64, 76, 56, -40)), 14, (-24, 0), 6),
    "crouch": CROUCH, "coil": D(CROUCH, S=[(-58, 132), (-80, 98), (-64, 52)] + S_C[3:]),
    "block_a": D(REAR, S=up(S_R, -3, -2), head=(-36, 0), a=(26, 106, 34, 132, 95), b=(34, 110, 44, 138, 95)),
    "block_b": D(REAR, S=up(S_R, -6, -3), head=(-36, 0), a=(23, 105, 31, 131, 95), b=(31, 109, 41, 137, 95)),
    "swipe_fx": D(SWIPE, fx=crescent((20, 64), 118, 26, 150, 14)), "swipe_fx2": D(SWIPE, fx=crescent((20, 64), 118, 14, 80, 14)),
    "swipe_end": D(SWIPE, S=[(124, 22), (96, 34), (60, 52)] + S_SW[3:]),
    "charge_1": D(REAR, head=(24, 8), glow=0.45), "charge_2": D(REAR, head=(24, 14), glow=0.75),
    "charge_3": D(REAR, head=(24, 24), glow=1.0, fire=1, fx=breath(7)),
    "fire_a": D(BRACE, fx=breath(13)), "fire_b": D(BRACE, S=up(S_F, -1, 0), fx=breath(10)),
    "roar": D(REAR, head=(36, 38), a=(26, 110, 44, 122, 40), b=(34, 116, 52, 130, 40)),
    "bite_wind": D(REAR, head=(14, 44), a=(22, 104, 38, 112, 20), b=(30, 110, 46, 120, 20)),
    "bite_fx": D(LUNGE, head=(-16, 16), a=(70, 70, 88, 66, -10), b=(78, 76, 96, 74, -10), fx=crescent((92, 100), 42, 9, 150, 20) + crescent((92, 86), 42, 9, -150, -20)),
    "bite": D(LUNGE, head=(-16, 0), a=(70, 70, 88, 66, -10), b=(78, 76, 96, 74, -10)),
}

# cell -> drawing, exactly where robokaiju.frag looks for it. A held drawing fills several cells
CELLS = ["idle_a", "idle_b", "idle_c", "idle_b",                                           # 0-3 idle
         "walk_1", "walk_1", "walk_2", "walk_3", "walk_3", "walk_4",                       # 4-9 walk
         "claw_wind", "claw_a_fx", "claw_a", "claw_wind", "claw_b_fx", "claw_b",           # 10-15 combo
         "horn_wind", "horn_wind", "horn_fx", "horn", "horn",                              # 16-20 heavy: the skull
         "kick_wind", "kick_fx", "kick", "kick_wind", "idle_a",                            # 21-25 kick
         "grab", "grab", "lift", "lift", "throw", "throw",                                 # 26-31 grab, lift, throw
         "stun_a", "stun_b",                                                               # 32-33 hit
         "launched", "air", "bounce", "flat", "flat",                                      # 34-38 knocked down
         "push_up", "crouch", "crouch", "idle_b",                                          # 39-42 getting up
         "block_a", "block_b",                                                             # 43-44 block
         "coil", "coil", "swipe_fx", "swipe_fx2", "swipe_end", "swipe_end", "coil", "idle_a",   # 45-52 the tail
         "charge_1", "charge_2", "charge_3", "fire_a", "fire_b",                           # 53-57 the breath
         "roar",                                                                           # 58 taunt
         "bite_wind", "bite_fx", "bite"]                                                   # 59-61 the bite
ACTIONS = {"idle": (0, 4), "walk": (4, 10), "combo": (10, 16), "heavy": (16, 21), "kick": (21, 26), "grab_lift_throw": (26, 32), "hit_stun": (32, 34),
           "knockdown": (34, 39), "get_up": (39, 43), "block": (43, 45), "tail_swipe": (45, 53), "breath_charge": (53, 56), "breath_fire": (56, 58),
           "taunt": (58, 59), "bite": (59, 62)}


def table(mouth):
    out = {}
    for k, (a, b) in ACTIONS.items():
        fr, hold = [], []
        for i in range(a, b):                                # a drawing held over several cells is one frame with a longer hold
            if fr and CELLS[i] == CELLS[fr[-1]] and i - fr[-1] == hold[-1]:
                hold[-1] += 1
            else:
                fr.append(i)
                hold.append(1)
        out[k] = {"frames": fr, "hold": hold, "anchor": [OX, OY], "drawings": [CELLS[i] for i in fr]}
    return {"cell": [CW, CH], "texelsPerUnit": SP.scale, "cols": COLS, "rows": ROWS, "atlas": "src/engine/assets/toku-kaiju.png",
            "encoding": "cel sheet, see scripts/toku/cel.py: suit = hide, dim white = belly and plates, white = teeth, claws, horns, gold = eye, energy = plate cores and breath",
            "mouth": [round(float(v), 1) for v in mouth],
            "note": "cells keep the numbers robokaiju.frag reads; the kaiju faces +x and the shader mirrors it; mouth = where the breath leaves the jaws in cells 56-57, units from the feet",
            "actions": out}


def build():
    done, mouth = {}, {}
    for name in dict.fromkeys(CELLS):
        done[name], mj = draw(KEYS[name])
        mouth[name] = 0.5 * (mj[0] + mj[1])
    bad = [n for n in done if cut_by_cell(done[n])]
    px, py = CW * SP.scale, CH * SP.scale
    sheet = np.zeros((ROWS * py, COLS * px, 4), np.uint8)
    for i, n in enumerate(CELLS):
        sheet[(i // COLS) * py:(i // COLS + 1) * py, (i % COLS) * px:(i % COLS + 1) * px] = done[n]
    Image.fromarray(sheet, "RGBA").save(OUT, optimize=True)
    t = table(mouth["fire_a"])
    (HERE / "kaiju.json").write_text(json.dumps(t, indent=1) + "\n")
    print(f"{OUT.name}: {len(CELLS)} cells, {len(done)} drawings, mouth at {t['mouth']}")
    return done, bad


def preview(done, path, cols=8):
    names = list(done)
    px, py = CW * SP.scale, CH * SP.scale
    rows = -(-len(names) // cols)
    out = np.zeros((rows * py, cols * px, 3), np.float32)
    for i, n in enumerate(names):
        out[(i // cols) * py:(i // cols + 1) * py, (i % cols) * px:(i % cols + 1) * px] = paint(done[n], (0.3, 0.42, 0.4), (0.8, 0.5, 0.36))
    im = Image.fromarray((out * 255).astype(np.uint8))
    (im.resize((im.width // 2, im.height // 2), Image.LANCZOS) if len(names) > 4 else im).save(path)


def main():
    if "--only" in sys.argv:                                  # a few drawings, no atlas: python3 kaiju.py --only idle_a,horn --preview F.png
        names = sys.argv[sys.argv.index("--only") + 1].split(",")
        preview({n: draw(KEYS[n])[0] for n in names}, sys.argv[sys.argv.index("--preview") + 1], cols=min(len(names), 4))
        return
    done, bad = build()
    if "--preview" in sys.argv:
        preview(done, sys.argv[sys.argv.index("--preview") + 1])
    assert not bad, f"cut by their cell: {bad}"                # after the preview, so it can show which


if __name__ == "__main__":
    main()
