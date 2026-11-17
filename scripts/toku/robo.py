#!/usr/bin/env python3
"""toku-robo.png: the combining robot of Robo vs Kaiju, drawn as fixed sprites.

Every key frame below is its own drawing: a list of points placed by hand, in
pixels from the feet (x right, y up), for that pose only. There is no skeleton
and no joint angle: nothing is rotated, a limb is a prism whose two visible
faces are drawn where the pose says, in the one 3/4 view the whole sheet keeps
(the near flank goes left and up, the front goes right and up, 3:1). Plates
get flat tones by the way they face the light (top left), a one pixel bevel,
a cast shadow, panel lines and glints; the lettering of the vehicles (cab and
wheels on the shin, grille, windscreen, emitter) is drawn onto each face.

  python3 scripts/toku/robo.py            writes src/engine/assets/toku-robo.png and scripts/toku/robo.json
  python3 scripts/toku/robo.py strip OUT  also a 3x strip of the key drawings, coloured as the shader would

Sheet: 8 x 8 cells of 288 x 224, feet at (120, 212). Indexed like the old one:
R = material x 32 (1 armour, 2 white plate, 3 gunmetal, 4 gold, 5 ink, 6 energy,
7 lit glass), G = tone x 50 (1-5). Cells 0-58 keep the meaning robokaiju.frag
gives them (a held drawing simply fills several cells); robo.json lists each
action with the cells to play and how long to hold them.
"""
import json
import math
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent.parent / "src/engine/assets/toku-robo.png"
W, H, OX, OY, SS = 288, 224, 120, 212, 4
ARM, STL, GUN, GLD, INK, FX, GLS = 1, 2, 3, 4, 5, 6, 7


def V(*a):
    return np.array(a, float)


def sh(a, dy, dx):
    """a moved by (dy, dx): out[y, x] = a[y - dy, x - dx]."""
    o = np.zeros_like(a)
    h, w = a.shape
    o[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = a[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return o


def bil(q, u, v):
    return (q[0] * (1 - u) + q[1] * u) * (1 - v) + (q[3] * (1 - u) + q[2] * u) * v


def spline(pts, n=8):
    """Closed Catmull-Rom through hand-placed points: a drawn curve, not a circle."""
    pts = [V(*p) for p in pts]
    out = []
    for i in range(len(pts)):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % len(pts)], pts[(i + 2) % len(pts)]
        for k in range(n):
            t = k / n
            out.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
    return out


class Cel:
    def __init__(self):
        self.mat = np.zeros((H, W), np.int8)
        self.lvl = np.zeros((H, W), np.int8)
        self.keep = np.zeros((H, W), bool)
        self.fxb, self.fxf = [], []
        self.dim = 0

    # ---- masks ----
    def mask(self, pts):
        xs = [OX + p[0] for p in pts]
        ys = [OY - p[1] for p in pts]
        x0, y0 = max(int(math.floor(min(xs))) - 1, 0), max(int(math.floor(min(ys))) - 1, 0)
        x1, y1 = min(int(math.ceil(max(xs))) + 2, W), min(int(math.ceil(max(ys))) + 2, H)
        m = np.zeros((H, W), bool)
        if x1 <= x0 or y1 <= y0:
            return m
        im = Image.new("L", ((x1 - x0) * SS, (y1 - y0) * SS), 0)
        ImageDraw.Draw(im).polygon([((x - x0) * SS, (y - y0) * SS) for x, y in zip(xs, ys)], fill=255)
        m[y0:y1, x0:x1] = np.asarray(im, np.uint8).reshape(y1 - y0, SS, x1 - x0, SS).mean((1, 3)) > 127
        return m

    def lmask(self, a, b):
        im = Image.new("L", (W, H), 0)
        ImageDraw.Draw(im).line([(OX + a[0], OY - a[1]), (OX + b[0], OY - b[1])], fill=255, width=1)
        return np.asarray(im, np.uint8) > 0

    # ---- paint ----
    def put(self, m, mat, t, lit="tl", shd="br", sep=True, cast=2, whole=None):
        """A plate: flat tone, lit bevel on the edges that face the key, dark bevel on the others, its shadow on what is behind."""
        if not m.any():
            return m
        occ = (self.mat > 0) & ~m
        if whole is not None:
            occ &= ~whole
        if cast:
            c = sh(m, cast, cast) & occ & (self.mat != GLS)
            self.lvl[c] = np.maximum(1, self.lvl[c] - 1)
        if sep:
            ring = (sh(m, 1, 0) | sh(m, -1, 0) | sh(m, 0, 1) | sh(m, 0, -1)) & occ
            self.lvl[ring] = 1
            self.keep[ring] = True
        t = int(np.clip(t + self.dim, 1, 5))
        self.mat[m], self.lvl[m], self.keep[m] = mat, t, False
        w = m if whole is None else (whole | m)
        L = np.zeros_like(m)
        D = np.zeros_like(m)
        if "t" in lit:
            L |= m & ~sh(m, 1, 0)
        if "l" in lit:
            L |= m & ~sh(m, 0, 1)
        if "b" in shd:
            D |= m & ~sh(w, -1, 0)
        if "r" in shd:
            D |= m & ~sh(w, 0, -1)
        self.lvl[L & ~D] = min(t + 1, 5)
        self.lvl[D & ~L] = max(t - 1, 1)
        return m

    def poly(self, pts, mat, t, **kw):
        return self.put(self.mask(pts), mat, t, **kw)

    def tone(self, m, d=0, t=None, mat=None, keep=False):
        m = m & (self.mat > 0)
        if mat is not None:
            self.mat[m] = mat
        if t is not None:
            self.lvl[m] = int(np.clip(t + (self.dim if t < 5 else 0), 1, 5))
        else:
            self.lvl[m] = np.clip(self.lvl[m] + d, 1, 5)
        if keep:
            self.keep[m] = True

    def px(self, p, t=5, mat=None):
        """One placed pixel: a glint."""
        x, y = int(round(OX + p[0])), int(round(OY - p[1]))
        if 0 <= x < W and 0 <= y < H and self.mat[y, x] > 0:
            if mat is not None:
                self.mat[y, x] = mat
            self.lvl[y, x] = t
            self.keep[y, x] = True

    # details drawn onto a face: (u, v) across and along the quad
    def fp(self, q, uv, **kw):
        self.tone(self.mask([bil(q, *p) for p in uv]) & self.mask(q), **kw)

    def fl(self, q, a, b, **kw):
        self.tone(self.lmask(bil(q, *a), bil(q, *b)) & self.mask(q), keep=True, **kw)

    def fe(self, q, c, ru, rv, n=20, **kw):
        self.fp(q, [(c[0] + ru * math.cos(2 * math.pi * i / n), c[1] + rv * math.sin(2 * math.pi * i / n)) for i in range(n)], **kw)

    def box(self, a, b, u, v, mat, t=3, tu=1, tv=0, tc=1, cap="a", ka=1.0, kb=1.0, **kw):
        """A prism seen in the sheet's 3/4: corner edge a-b, face U goes off by u, face V by v, the end by both."""
        a, b, u, v = V(*a), V(*b), V(*u), V(*v)
        U = [a, a + u * ka, b + u * kb, b]
        Vq = [a, a + v * ka, b + v * kb, b]
        e, k = (a, ka) if cap == "a" else (b, kb)
        C = [e, e + u * k, e + (u + v) * k, e + v * k]
        mu, mv = self.mask(U), self.mask(Vq)
        mc = self.mask(C) & ~mu & ~mv if cap else np.zeros_like(mu)
        whole = mu | mv | mc
        if kw.get("cast", 3):
            c = sh(whole, kw.get("cast", 3), kw.get("cast", 3)) & (self.mat > 0) & ~whole & (self.mat != GLS)
            self.lvl[c] = np.maximum(1, self.lvl[c] - 1)
        ring = (sh(whole, 1, 0) | sh(whole, -1, 0) | sh(whole, 0, 1) | sh(whole, 0, -1)) & (self.mat > 0) & ~whole
        self.lvl[ring] = 1
        self.keep[ring] = True
        if cap:
            self.put(mc, mat, t + tc, sep=False, cast=0, whole=whole)
        self.put(mu, mat, t + tu, sep=False, cast=0, whole=whole)
        self.put(mv & ~mu, mat, t + tv, sep=False, cast=0, whole=whole)
        g = kw.get("g", 0.45)
        if g:
            lo, hi = (Vq, U) if tu > tv else (U, Vq)          # lo = the face that gets less light
            self.fp(lo, [(0.0, 1 - g), (1, 1 - g * 0.7), (1, 1), (0, 1)], d=-1)
            self.fp(lo, [(0.62, 0), (1, 0), (1, 1), (0.8, 1)], d=-1) if kw.get("turn") else None
            self.fp(hi, [(0, 1 - g * 0.35), (1, 1 - g * 0.35), (1, 1), (0, 1)], d=-1)
        return {"u": U, "v": Vq, "c": C}

    def seg(self, a, b, w, mat, t=3, ka=1.0, kb=1.0, cap=True, **kw):
        """A limb between two placed points (centre line), w wide. Upright: flank left, front right. Level: side below, top above."""
        a, b = V(*a), V(*b)
        d = b - a
        if abs(d[1]) >= abs(d[0]) * 0.9:
            u, v, off = V(-0.58 * w, 0.19 * w), V(0.42 * w, 0.14 * w), V(0.08 * w, -0.16 * w)
            f = self.box(a + off, b + off, u, v, mat, t, 1, 0, 1, ("a" if d[1] < 0 else "b") if cap else None, ka, kb, **kw)
            f["up"] = True
        else:
            u, v, off = V(0, -0.8 * w), V(0.3 * w, 0.26 * w), V(-0.15 * w, 0.27 * w)
            f = self.box(a + off, b + off, u, v, mat, t, 0, 1, 0, None, ka, kb, **kw)
            f["up"] = False
        return f

    def blob(self, pts, mat, t, n=6, **kw):
        return self.put(self.mask(spline(pts, n)), mat, t, **kw)

    def fx(self, pts, lv, front=False, curve=True):
        (self.fxf if front else self.fxb).append((self.mask(spline(pts, 8) if curve else pts), lv))

    # ---- to the indexed cell ----
    def cell(self):
        mat, lvl = self.mat.copy(), self.lvl.copy()
        for _ in range(2):                                    # a pixel alone in its tone joins the tone around it
            nb = [(sh(lvl, dy, dx), sh(mat, dy, dx)) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            same = sum(((l == lvl) & (m == mat)).astype(np.int8) for l, m in nb)
            cand = np.where(nb[0][1] == mat, nb[0][0], np.where(nb[2][1] == mat, nb[2][0], np.where(nb[1][1] == mat, nb[1][0], nb[3][0])))
            fix = (same == 0) & (mat > 0) & ~self.keep & (cand > 0)
            lvl[fix] = cand[fix]
        occ = mat > 0
        out = np.zeros_like(occ)
        soft = np.zeros_like(mat)
        for dy, dx, lit in ((1, 0, False), (-1, 0, True), (0, 1, False), (0, -1, True)):
            nb = sh(occ, dy, dx)
            out |= nb & ~occ
            if lit:                                           # the body is below or right of this pixel: the edge faces the key
                bl, bm = sh(lvl, dy, dx), sh(mat, dy, dx)
                pick = nb & ~occ & (bl >= 4) & (bm == ARM)
                soft[pick] = bm[pick]
        mat[out], lvl[out] = INK, 0
        s = out & (soft > 0)
        mat[s], lvl[s] = soft[s], 1
        for m, lv in self.fxb:
            sel = m & (mat == 0)
            mat[sel], lvl[sel] = FX, lv
        for m, lv in self.fxf:
            mat[m], lvl[m] = FX, lv
        arr = np.zeros((H, W, 4), np.uint8)
        arr[..., 0] = mat.astype(np.int16) * 32
        arr[..., 1] = lvl.astype(np.int16) * 50
        arr[..., 3] = 255 * (mat > 0)
        return Image.fromarray(arr, "RGBA")


# =====================================================================
# the parts, each drawn where the pose puts it
# =====================================================================
def foot(s, A, kind="flat"):
    A = V(*A)
    if kind == "flat":                                        # planted: a flat sole, the toe cap toward the other one
        g = A + V(1, -11)
        s.poly([g + V(-21, 0), g + V(-22, 7), g + V(-16, 13), g + V(8, 13), g + V(17, 9), g + V(23, 4), g + V(23, 0)], ARM, 3)
        s.poly([g + V(8, 13), g + V(17, 9), g + V(23, 4), g + V(12, 4), g + V(8, 8)], STL, 4, sep=False, cast=0)
        s.poly([g + V(-21, 0), g + V(-21, 3), g + V(23, 3), g + V(23, 0)], GUN, 2, sep=False, cast=0, lit="t")
        s.tone(s.mask([g + V(-21, 3), g + V(-22, 7), g + V(-18, 11), g + V(-13, 3)]), d=-1)
    elif kind == "toe":                                       # heel up, the weight on the toe (ankle 17 above the street)
        g = A + V(1, -17)
        s.poly([g + V(-20, 8), g + V(-22, 15), g + V(-16, 20), g + V(8, 18), g + V(17, 11), g + V(23, 4), g + V(23, 0), g + V(9, 0)], ARM, 3)
        s.poly([g + V(8, 18), g + V(17, 11), g + V(23, 4), g + V(13, 4), g + V(8, 11)], STL, 4, sep=False, cast=0)
        s.poly([g + V(-20, 8), g + V(-20, 11), g + V(9, 3), g + V(23, 3), g + V(23, 0), g + V(9, 0)], GUN, 2, sep=False, cast=0, lit="")
    elif kind == "sole":                                      # kicking: the sole shown to the other one
        c = A + V(3, 13)
        f = s.box(c, c + V(0, -24), (-9, 0), (5, 2), ARM, 3, tu=0, tv=-1, cap=None)
        s.fp(f["v"], [(0, 0), (1, 0), (1, 1), (0, 1)], mat=GUN, t=2)
        for k in (0.2, 0.45, 0.7):
            s.fl(f["v"], (0, k), (1, k), t=1)
        s.fp(f["u"], [(0, 0), (1, 0), (1, 0.25), (0, 0.25)], mat=STL, t=4)
    elif kind == "hang":                                      # off the ground, toe hanging
        s.poly([A + V(-7, 3), A + V(6, 5), A + V(15, -6), A + V(13, -12), A + V(-4, -8), A + V(-9, -3)], ARM, 3)
        s.poly([A + V(-9, -3), A + V(-4, -8), A + V(13, -12), A + V(12, -15), A + V(-6, -11)], GUN, 2, cast=0)
        s.poly([A + V(6, 5), A + V(15, -6), A + V(11, -5), A + V(4, 2)], STL, 4, cast=0, sep=False)
    elif kind == "upward":                                    # lying on the back: the toes point at the sky
        s.poly([A + V(-5, -4), A + V(-4, 13), A + V(3, 17), A + V(8, 12), A + V(7, -5)], ARM, 3)
        s.poly([A + V(3, 17), A + V(8, 12), A + V(7, -5), A + V(4, -4), A + V(4, 11)], GUN, 2, cast=0, sep=False)
        s.poly([A + V(-4, 13), A + V(3, 17), A + V(3, 12), A + V(-4, 9)], STL, 4, cast=0, sep=False)


def shin(s, K, A):
    f = s.seg(K, A, 26, STL, 3, g=0.3)
    U, F = f["u"], f["v"]                                     # flank: cab and wheels; front: radiator
    s.fp(U, [(0, 0), (1, 0), (1, 0.3), (0, 0.3)], mat=ARM, t=4 if f["up"] else 3)
    s.fp(U, [(0.18, 0.08), (0.82, 0.08), (0.82, 0.22), (0.18, 0.22)], mat=GLS, t=2)
    s.fl(U, (0.7, 0.1), (0.5, 0.2), t=5)
    s.fl(U, (0, 0.31), (1, 0.31), t=1)
    for cv in (0.53, 0.83):
        s.fe(U, (0.5, cv), 0.4, 0.14, mat=GUN, t=1)
        s.fe(U, (0.5, cv), 0.25, 0.085, mat=GUN, t=3)
        s.fe(U, (0.5, cv), 0.1, 0.035, mat=STL, t=4)
    s.fp(F, [(0, 0), (1, 0), (1, 0.3), (0, 0.3)], mat=ARM, t=3 if f["up"] else 4)
    s.fl(F, (0, 0.31), (1, 0.31), t=1)
    for i in range(4):
        s.fl(F, (0.16, 0.42 + i * 0.085), (0.84, 0.42 + i * 0.085), mat=GUN, t=1)
    s.fp(F, [(0.08, 0.78), (0.36, 0.78), (0.36, 0.86), (0.08, 0.86)], mat=GLD, t=5)
    s.fp(F, [(0.64, 0.78), (0.92, 0.78), (0.92, 0.86), (0.64, 0.86)], mat=GLD, t=4)
    s.fp(F, [(0, 0.9), (1, 0.9), (1, 1), (0, 1)], mat=GUN, t=2)
    s.fp(U, [(0, 0.95), (1, 0.95), (1, 1), (0, 1)], mat=GUN, t=2)
    return f


def knee(s, K):
    K = V(*K)
    f = s.box(K + V(2, 6), K + V(2, -5), (-13, 4), (10, 3), GLD, 3, g=0.5)
    s.fl(f["u"], (0.15, 0.25), (0.6, 0.25), t=5)


def thigh(s, Hp, K):
    f = s.seg(Hp, V(*K) + V(0, 3), 25, ARM, 3, kb=0.84, cap=False)
    s.fl(f["u"], (0, 0.55), (1, 0.55), t=1)
    s.fl(f["v"], (0, 0.55), (1, 0.55), t=1)
    s.fp(f["u"], [(0.25, 0.12), (0.75, 0.12), (0.75, 0.42), (0.25, 0.42)], d=1)


def leg(s, p, n, far=False):
    s.dim = -1 if far and not p.get("fbright") else 0
    A, K, Hp = p[n + "a"], p[n + "k"], p[n + "h"]
    kind = p.get(n + "foot", "flat")
    if kind in ("sole", "upward"):
        thigh(s, Hp, K)
        shin(s, K, A)
        foot(s, A, kind)
    else:
        foot(s, A, kind)
        thigh(s, Hp, K)
        shin(s, K, A)
    knee(s, K)
    s.dim = 0


def hips(s, p):
    P, c0 = V(*p["pel"]), V(*p["c0"])
    if p.get("lying"):
        s.poly([P + V(-6, 7), P + V(8, 9), P + V(12, -8), P + V(-4, -9)], STL, 3)
        s.poly([P + V(-6, 7), P + V(8, 9), P + V(12, 12), P + V(-2, 10)], GLD, 4)
        s.poly([c0 + V(0, 6), P + V(-6, 7), P + V(-4, -8), c0 + V(0, -9)], GUN, 2)
        return
    f = s.box(c0 + V(1, -2), P + V(1, 0), (-11, 3), (21, 5), GUN, 2, cap=None, g=0)            # the waist, ribbed
    n = max(int(abs(c0[1] - P[1]) // 3), 1)
    for i in range(1, n):
        s.fl(f["v"], (0, i / n), (1, i / n), t=1)
        s.fl(f["u"], (0, i / n), (1, i / n), t=1)
    f = s.box(P, P + V(0, -14), (-14, 4), (27, 7), STL, 3, g=0.3)
    s.fp(f["v"], [(0.28, 0), (0.72, 0), (0.62, 1), (0.38, 1)], mat=GLD, t=3)               # crotch plate
    s.fl(f["v"], (0.3, 0.06), (0.7, 0.06), t=5)
    s.fp(f["v"], [(0.4, 0.3), (0.6, 0.3), (0.56, 0.7), (0.44, 0.7)], mat=GLD, t=2)
    s.fp(f["u"], [(0.2, 0.25), (1, 0.25), (1, 1), (0.2, 1)], mat=ARM, t=4)                 # hip skirt
    s.fp(f["v"], [(0.8, 0.25), (1, 0.25), (1, 1), (0.8, 1)], mat=ARM, t=2)


def chest(s, p):
    c1, c0 = V(*p["c1"]), V(*p["c0"])
    if p.get("lying"):                                        # on its back: the flank toward us, the windscreen at the sky
        f = s.box(c1, c0, (0, -22), (10, 16), ARM, 3, tu=0, tv=1, cap=None, kb=0.85, g=0.3)
    else:
        u, v = p.get("cu", (-13, 4)), p.get("cv", (36, 9))
        f = s.box(c1, c0, u, v, ARM, 3, kb=0.8, g=0.25, turn=1)
    U, F = f["u"], f["v"]
    g = p.get("glow", 0)
    s.fp(F, [(0.06, 0.09), (0.94, 0.09), (0.94, 0.37), (0.06, 0.37)], mat=GLS, t=2)        # windscreen, two panes
    s.fp(F, [(0.1, 0.12), (0.46, 0.12), (0.46, 0.2), (0.1, 0.2)], mat=GLS, t=3)
    s.fp(F, [(0.54, 0.12), (0.8, 0.12), (0.8, 0.17), (0.54, 0.17)], mat=GLS, t=3)
    s.fl(F, (0.38, 0.1), (0.22, 0.36), mat=GLS, t=5)
    s.fl(F, (0.44, 0.1), (0.3, 0.36), mat=GLS, t=4)
    s.fl(F, (0.5, 0.09), (0.5, 0.37), mat=ARM, t=1)
    s.fl(F, (0, 0.42), (1, 0.42), t=4)
    s.fl(F, (0, 0.45), (1, 0.45), t=1)
    s.fp(F, [(0, 0.47), (0.24, 0.47), (0.3, 1), (0, 1)], mat=STL, t=3)                      # white ribs either side of the emitter
    s.fp(F, [(0.76, 0.47), (1, 0.47), (1, 1), (0.7, 1)], mat=STL, t=2)
    s.fe(F, (0.5, 0.69), 0.2, 0.2, mat=GLD, t=3)                                            # emitter in its gold ring
    s.fe(F, (0.47, 0.67), 0.16, 0.16, mat=GLD, t=4)
    s.fe(F, (0.5, 0.69), 0.115, 0.115, mat=GLS, t=2 + 2 * (g > 0))
    s.fe(F, (0.48, 0.67), 0.05, 0.05, mat=GLS, t=4 + (g > 0))
    s.fp(U, [(0.15, 0.09), (0.85, 0.09), (0.85, 0.37), (0.15, 0.37)], mat=GLS, t=3)        # side window
    s.fl(U, (0.3, 0.12), (0.5, 0.34), mat=GLS, t=5)
    s.fl(U, (0, 0.45), (1, 0.45), t=1)
    for k in (0.58, 0.68, 0.78):
        s.fl(U, (0.2, k), (0.8, k), mat=GUN, t=1)
    return f


def head(s, p, f):
    c1 = V(*p["c1"])
    n = V(*p["head"]) if "head" in p else c1 + V(12, 8)
    t = V(*p.get("tilt", (0, 0)))                             # where the crown goes, by hand: looking up, down, thrown back
    if p.get("lying"):
        n = V(*p["head"])
        s.poly([n + V(1, -4), n + V(1, 5), n + V(8, 5), n + V(8, -4)], GUN, 2)
        b = s.box(n + V(-17, 8), n + V(2, 8), (0, -14), (6, 8), ARM, 3, tu=0, tv=1, cap=None, g=0.3)
        s.fp(b["v"], [(0, 0.2), (1, 0.2), (1, 0.48), (0, 0.48)], mat=GLS, t=4)       # the visor looks at the sky
        s.fp(b["v"], [(0, 0.5), (1, 0.5), (1, 1), (0, 1)], mat=STL, t=4)
        s.fp(b["u"], [(0, 0.5), (0.3, 0.5), (0.3, 1), (0, 1)], mat=STL, t=3)
        s.fe(b["u"], (0.62, 0.6), 0.2, 0.16, mat=GLD, t=3)
        c = n + V(-17, 10)
        s.poly([c + V(1, -2), c + V(3, 4), c + V(-11, 9), c + V(-23, 4), c + V(-11, 2), c + V(-2, -6)], GLD, 3)
        s.poly([c + V(3, 4), c + V(-11, 9), c + V(-23, 4), c + V(-11, 5), c + V(-1, 1)], GLD, 4, sep=False, cast=0, lit="t", shd="")
        return
    s.poly([n + V(-6, -3), n + V(6, -2), n + V(6, 5), n + V(-6, 4)], GUN, 2)                 # neck
    a = n + V(1, 23) + t
    b = s.box(a, n + V(1, 3), (-13, 4), (11, 3), ARM, 3, g=0.3)
    U, F = b["u"], b["v"]
    s.fp(F, [(0, 0.2), (1, 0.2), (1, 0.48), (0, 0.48)], mat=GLS, t=4)                       # visor, wrapping the corner
    s.fp(U, [(0, 0.2), (0.5, 0.2), (0.34, 0.48), (0, 0.48)], mat=GLS, t=3)
    s.fl(F, (0.1, 0.25), (0.6, 0.25), mat=GLS, t=5)
    s.fp(F, [(0, 0.5), (1, 0.5), (1, 1), (0, 1)], mat=STL, t=3)                             # face plate
    s.fp(F, [(0.25, 0.68), (0.8, 0.68), (0.8, 0.78), (0.25, 0.78)], mat=GUN, t=1)
    s.fp(U, [(0, 0.5), (0.3, 0.5), (0.3, 1), (0, 1)], mat=STL, t=4)
    s.fe(U, (0.66, 0.62), 0.2, 0.2, mat=GLD, t=3)                                           # ear
    s.fp(F, [(0.3, 0), (0.7, 0), (0.6, 0.2), (0.4, 0.2)], mat=GLD, t=4)                     # brow jewel
    c = a + V(3, 3)                                           # the one fin, swept back from the brow
    s.poly([c + V(-1, -1), c + V(5, 2), c + V(-5, 15), c + V(-21, 21), c + V(-12, 9), c + V(-8, 0)], GLD, 3)
    s.poly([c + V(-1, -1), c + V(5, 2), c + V(-5, 15), c + V(-21, 21), c + V(-8, 10), c + V(-1, 3)], GLD, 4, sep=False, cast=0, lit="t", shd="")
    s.px(c + V(1, 2), 5)


def fist(s, w, d, open_=False, far=False):
    """The hand at the wrist w, pointing the way the forearm does. Four drawings (right, up, left, down), never turned."""
    w, d = V(*w), V(*d)
    ax = (1, 0) if abs(d[0]) >= abs(d[1]) and d[0] >= 0 else (-1, 0) if abs(d[0]) >= abs(d[1]) else (0, 1) if d[1] > 0 else (0, -1)
    R = lambda x, y: w + V(x * ax[0] - y * ax[1], x * ax[1] + y * ax[0]) if ax[0] != -1 else w + V(-x, y)
    if ax == (0, -1):
        R = lambda x, y: w + V(y, -x)
    if ax == (0, 1):
        R = lambda x, y: w + V(-y, x)
    if not open_:
        s.poly([R(-1, -7), R(-1, 6), R(2, 8), R(10, 8), R(13, 5), R(13, -5), R(10, -8), R(2, -8)], STL, 3)
        s.tone(s.mask([R(-1, 4), R(-1, 6), R(2, 8), R(10, 8), R(13, 5), R(12, 4)]) & (s.mat == STL), t=4)
        s.tone(s.mask([R(7, -8), R(7, 4), R(13, 4), R(13, -8)]) & (s.mat == STL), d=-1)
        for k in (-4, -1, 2):
            s.tone(s.lmask(R(8, k), R(12, k)) & (s.mat == STL), t=1, keep=True)
        s.tone(s.lmask(R(7, -7), R(7, 4)) & (s.mat == STL), t=1, keep=True)
        s.poly([R(1, -8), R(8, -9), R(10, -6), R(4, -4), R(1, -5)], STL, 4, cast=0)          # thumb
    else:
        s.blob([R(-2, -6), R(-2, 6), R(5, 7), R(8, 0), R(5, -7)], STL, 3, n=5)
        for k, ln in ((-5.5, 9), (-2, 11), (1.5, 11), (5, 9)):
            s.poly([R(5, k - 1.6), R(5 + ln, k - 1.2), R(6 + ln, k + 0.6), R(5, k + 1.6)], STL, 4, cast=0)
        s.poly([R(0, 5), R(3, 11), R(6, 11), R(4, 5)], STL, 3, cast=0)


def arm(s, p, n):
    S, E, Wr = V(*p[n + "s"]), V(*p[n + "e"]), V(*p[n + "w"])
    near = n == "n"
    if near and not p.get("lying"):                           # exhaust stacks, behind the pauldron
        for dx, hh in ((-11, 27), (-5, 31)):
            b = s.box(S + V(dx, hh), S + V(dx, 6), (-3, 1), (3, 1), STL, 3)
            s.fp(b["u"], [(0, 0.55), (1, 0.55), (1, 1), (0, 1)], mat=GUN, t=3)
            s.fp(b["v"], [(0, 0.55), (1, 0.55), (1, 1), (0, 1)], mat=GUN, t=2)
            s.fl(b["u"], (0, 0.12), (1, 0.12), t=2)
            s.fp(b["c"], [(0.2, 0.2), (0.8, 0.2), (0.8, 0.8), (0.2, 0.8)], mat=GUN, t=1)
    wu, wf = (19, 22) if near else (16, 19)
    f = s.seg(S, E, wu, ARM, 3, cap=False)
    s.blob([E + V(-7, 0), E + V(0, 7), E + V(7, 0), E + V(0, -7)], GUN, 2, n=4)             # elbow
    if near:                                                  # pauldron: white, armour band, a rivet
        b = s.box(S + V(3, 12), S + V(3, -10), (-18, 5), (12, 3), STL, 3, g=0)
        s.fp(b["u"], [(0, 0.66), (1, 0.66), (1, 1), (0, 1)], mat=ARM, t=4)
        s.fp(b["v"], [(0, 0.66), (1, 0.66), (1, 1), (0, 1)], mat=ARM, t=3)
        s.fe(b["u"], (0.5, 0.32), 0.17, 0.14, mat=GLD, t=3)
        s.px(bil(b["u"], 0.55, 0.28), 5)
        s.fl(b["u"], (0, 0.66), (1, 0.66), t=1)
    else:
        b = s.box(S + V(1, 10), S + V(1, -8), (-12, 3), (12, 3), STL, 3, g=0)
        s.fp(b["u"], [(0, 0.66), (1, 0.66), (1, 1), (0, 1)], mat=ARM, t=4)
        s.fp(b["v"], [(0, 0.66), (1, 0.66), (1, 1), (0, 1)], mat=ARM, t=3)
    d = Wr - E
    f = s.seg(E, Wr, wf, ARM, 3, ka=0.85, cap=False)
    for q in (f["u"], f["v"]):                                # gauntlet cuff
        s.fl(q, (0, 0.5), (1, 0.5), t=1)
        s.fp(q, [(0, 0.78), (1, 0.78), (1, 0.92), (0, 0.92)], mat=GLD)
        s.fp(q, [(0, 0.92), (1, 0.92), (1, 1), (0, 1)], mat=GUN, t=2)
    if p.get(n + "hand", "fist") != "none":
        fist(s, Wr + d / max(np.linalg.norm(d), 1) * 1.0, d, p.get(n + "hand", "fist") == "open", not near)
    if p.get("blade") and n == p.get("blade_arm", "n"):
        blade(s, p, Wr)


def blade(s, p, Wr):
    """The blade of light: hilt in the fist, the blade a hand-drawn tapering shape, hot core."""
    b = p["blade"]
    h, tip = V(*b[0]), V(*b[1])
    d = tip - h
    ln = np.linalg.norm(d)
    u = d / ln
    nrm = V(-u[1], u[0])
    s.poly([h - u * 5 - nrm * 2.5, h - u * 5 + nrm * 2.5, h + u * 2 + nrm * 2.5, h + u * 2 - nrm * 2.5], GLD, 3)
    s.poly([h + u * 1 - nrm * 5.5, h + u * 1 + nrm * 5.5, h + u * 3.5 + nrm * 5.5, h + u * 3.5 - nrm * 5.5], GLD, 4)
    for k, lv in ((1.0, 2), (0.62, 4), (0.3, 5)):
        w0 = 6.5 * k
        s.fx([h + u * 3 - nrm * w0, h + u * (ln * 0.55) - nrm * w0 * 1.05, tip + u * (2 * k - 2), h + u * (ln * 0.55) + nrm * w0 * 1.05, h + u * 3 + nrm * w0], lv, front=True, curve=False)


ORDER = ("farm", "fleg", "hips", "nleg", "chest", "head", "narm")


def figure(p):
    if p.get("dx") or p.get("dy"):
        p = moved(p, p.get("dx", 0), p.get("dy", 0), ALL)
    s = Cel()
    f = {}
    for part in p.get("order", ORDER):
        if part == "farm":
            arm(s, p, "f")
        elif part == "narm":
            arm(s, p, "n")
        elif part == "fleg":
            leg(s, p, "f", far=True)
        elif part == "nleg":
            leg(s, p, "n")
        elif part == "hips":
            hips(s, p)
        elif part == "chest":
            f = chest(s, p)
        elif part == "head":
            head(s, p, f)
    for fx in p.get("fx", ()):
        fx(s, p)
    return s


def D(base=None, **kw):
    p = dict(base or {})
    p.update(kw)
    return p


def moved(p, dx, dy, keys):
    """The same drawing with some of its points shifted by whole pixels (the breath of the idle, a recoil)."""
    q = dict(p)
    for k in keys:
        if k in q:
            q[k] = (q[k][0] + dx, q[k][1] + dy)
    return q


UPPER = ("pel", "c0", "c1", "ns", "ne", "nw", "fs", "fe", "fw", "head", "nh", "fh")
ALL = UPPER + ("nk", "na", "fk", "fa")


# ---- swooshes, drawn into the frame ----
def crescent(c, r, w, a0, a1, lv=(2, 3, 5), front=True):
    """The smear of a blow: thin where it began (a0, degrees), full and white where the fist, foot or blade is now (a1)."""
    def f(s, p):
        ox, oy = p.get("dx", 0), p.get("dy", 0)
        for k, l in zip((1.0, 0.62, 0.3), lv):
            o, i = [], []
            for n in range(25):
                t = n / 24
                a = math.radians(a0 + (a1 - a0) * t)
                ww = w * k * t ** 0.7 * min(1.0, (1 - t) / 0.1 + 0.15)
                d = V(math.cos(a), math.sin(a))
                o.append(V(c[0] + ox, c[1] + oy) + d * r)
                i.append(V(c[0] + ox, c[1] + oy) + d * (r - ww))
            s.fx(o + i[::-1], l, front, curve=False)
    return f


def streak(x0, x1, y, h, lv=(3, 5)):
    """A straight blow: a wedge behind the fist and a bright crescent of air in front of it."""
    def f(s, p):
        for k, l in zip((1.0, 0.45), lv):
            s.fx([(x0, y), (x1 - 6, y + h * k), (x1 + 3 * k, y), (x1 - 6, y - h * k)], l, False, curve=False)
        crescent((x1 - 8, y), 14, 4, 70, -70 if False else -1, lv=(3, 5, 5))(s, {})
        crescent((x1 - 8, y), 14, 4, -70, 1, lv=(3, 5, 5))(s, {})
    return f


def glow(c, r, wide=1.0):
    def f(s, p):
        for k, l in ((1.0, 2), (0.72, 3), (0.46, 4), (0.24, 5)):
            s.fx([(c[0] + r * k * wide * math.cos(a), c[1] + r * k * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 12, endpoint=False)], l, True)
    return f


def glint(c, r=11):
    def f(s, p):
        for d in ((1, 0), (0, 1)):
            d = V(*d)
            s.fx([V(*c) - d * r, V(*c) + V(-d[1], d[0]) * 1.2, V(*c) + d * r, V(*c) - V(-d[1], d[0]) * 1.2], 5, True, curve=False)
        s.fx([V(*c) + V(-4, 0), V(*c) + V(0, 4), V(*c) + V(4, 0), V(*c) + V(0, -4)], 5, True, curve=False)
    return f


# =====================================================================
# the key drawings. Points, by hand, in pixels from the feet:
#   n* near side (viewer's left), f* far side; a ankle, k knee, h hip; s shoulder, e elbow, w wrist
#   pel = top corner of the pelvis, c0 / c1 = bottom / top of the chest's corner edge
# =====================================================================
IDLE = D(na=(-31, 11), nk=(-25, 52), nh=(-10, 84), fa=(27, 14), fk=(24, 55), fh=(12, 87),
         pel=(-3, 95), c0=(-3, 101), c1=(-1, 139),
         ns=(-20, 132), ne=(-31, 110), nw=(-15, 110),
         fs=(37, 140), fe=(47, 118), fw=(59, 133))
IDLE2 = D(moved(moved(IDLE, 0, -2, UPPER), 1, 0, ("nk", "fk")), nw=(-15, 109), fw=(60, 130))

# walk: contact, passing, contact, passing. The body drops on the contacts
WALK0 = D(IDLE, na=(16, 11), nk=(6, 50), nh=(-9, 82), fa=(-30, 20), ffoot="toe", fk=(-10, 52), fh=(11, 85),
          pel=(-3, 93), c0=(-3, 99), c1=(0, 137), ns=(-19, 130), ne=(-32, 109), nw=(-17, 106), fs=(38, 138), fe=(50, 118), fw=(63, 130))
WALK1 = D(IDLE, na=(-8, 11), nk=(-6, 53), nh=(-10, 87), fa=(10, 30), ffoot="hang", fk=(28, 62), fh=(12, 90),
          pel=(-3, 98), c0=(-3, 104), c1=(0, 142), ns=(-19, 135), ne=(-30, 113), nw=(-14, 113), fs=(38, 143), fe=(48, 121), fw=(60, 136))
WALK2 = D(IDLE, na=(-46, 17), nfoot="toe", nk=(-27, 51), nh=(-10, 82), fa=(38, 14), fk=(27, 53), fh=(12, 85),
          pel=(-3, 93), c0=(-3, 99), c1=(0, 137), ns=(-19, 130), ne=(-28, 108), nw=(-11, 109), fs=(38, 138), fe=(46, 116), fw=(57, 132))
WALK3 = D(IDLE, na=(-14, 28), nfoot="hang", nk=(6, 60), nh=(-10, 87), fa=(6, 14), fk=(9, 56), fh=(12, 90),
          pel=(-3, 98), c0=(-3, 104), c1=(0, 142), ns=(-19, 135), ne=(-31, 113), nw=(-15, 112), fs=(38, 143), fe=(47, 121), fw=(59, 137))

# jab with the lead arm, cross with the rear one coming through
JAB = D(IDLE, fk=(27, 54), pel=(-1, 95), c0=(-1, 101), c1=(6, 138), ns=(-14, 131), ne=(-29, 112), nw=(-14, 107),
        fs=(44, 138), fe=(64, 135), fw=(86, 134))
CROSS = D(na=(-38, 17), nfoot="toe", nk=(-22, 50), nh=(-4, 83), fa=(31, 14), fk=(34, 53), fh=(18, 85),
          pel=(4, 94), c0=(4, 100), c1=(13, 136), ns=(-2, 129), ne=(28, 127), nw=(60, 126),
          fs=(50, 137), fe=(44, 114), fw=(56, 120))
# the heavy one: wound up behind the head, then thrown from the hip with the whole body
HWIND = D(na=(-31, 11), nk=(-30, 49), nh=(-14, 82), fa=(27, 14), fk=(22, 56), fh=(8, 86),
          pel=(-6, 94), c0=(-6, 100), c1=(-11, 137), ns=(-31, 129), ne=(-52, 124), nw=(-46, 146),
          fs=(27, 139), fe=(42, 121), fw=(56, 128))
HHIT = D(na=(-46, 17), nfoot="toe", nk=(-20, 46), nh=(4, 78), fa=(40, 14), fk=(44, 51), fh=(26, 80),
         pel=(11, 89), c0=(12, 95), c1=(27, 128), ns=(12, 122), ne=(46, 121), nw=(80, 118),
         fs=(62, 128), fe=(56, 108), fw=(68, 112))
# front kick: knee up, then the sole of the truck in the other one's chest
KCH = D(na=(-24, 11), nk=(-22, 52), nh=(-9, 85), fa=(30, 62), ffoot="hang", fk=(36, 98), fh=(12, 89), fbright=1,
        pel=(-4, 96), c0=(-4, 102), c1=(-9, 139), ns=(-28, 131), ne=(-38, 109), nw=(-22, 108),
        fs=(29, 141), fe=(41, 120), fw=(52, 134))
KHIT = D(na=(-22, 11), nk=(-21, 52), nh=(-9, 85), fa=(84, 97), ffoot="sole", fk=(47, 95), fh=(12, 90), fbright=1,
         pel=(-5, 96), c0=(-5, 102), c1=(-15, 138), ns=(-34, 129), ne=(-50, 111), nw=(-58, 94),
         fs=(23, 141), fe=(35, 120), fw=(45, 133))
# grab: both hands out, hauled overhead, thrown down in front
REACH = D(na=(-36, 11), nk=(-24, 50), nh=(-6, 83), fa=(31, 14), fk=(33, 54), fh=(17, 86),
          pel=(2, 94), c0=(2, 100), c1=(11, 137), ns=(-6, 129), ne=(22, 121), nw=(50, 127), nhand="open",
          fs=(48, 138), fe=(64, 127), fw=(82, 133), fhand="open")
LIFT = D(na=(-33, 11), nk=(-28, 50), nh=(-11, 82), fa=(28, 14), fk=(27, 54), fh=(11, 85),
         pel=(-4, 93), c0=(-4, 99), c1=(-5, 137), ns=(-24, 131), ne=(-29, 154), nw=(-21, 173), nhand="open",
         fs=(33, 139), fe=(38, 160), fw=(30, 177), fhand="open", order=("fleg", "hips", "nleg", "chest", "farm", "head", "narm"))
THROW = D(na=(-42, 17), nfoot="toe", nk=(-22, 48), nh=(0, 80), fa=(36, 14), fk=(40, 52), fh=(22, 82),
          pel=(7, 91), c0=(8, 97), c1=(21, 131), ns=(6, 124), ne=(34, 114), nw=(58, 100), nhand="open",
          fs=(56, 131), fe=(74, 116), fw=(88, 100), fhand="open")
# hit: the chest thrown back, the arms flung
STUN = D(na=(-38, 11), nk=(-33, 52), nh=(-15, 83), fa=(20, 20), ffoot="toe", fk=(16, 57), fh=(7, 86),
         pel=(-8, 94), c0=(-9, 100), c1=(-21, 136), tilt=(-4, -1), ns=(-40, 127), ne=(-58, 112), nw=(-66, 128), nhand="open",
         fs=(17, 139), fe=(34, 128), fw=(46, 144), fhand="open")
STUN2 = D(moved(STUN, 3, 0, UPPER), tilt=(-2, 0), nw=(-63, 124), fw=(48, 140))
# knocked down: off its feet going backwards, flat in the air, flat on the street
REEL = D(na=(8, 26), nfoot="hang", nk=(-4, 58), nh=(-22, 80), fa=(40, 40), ffoot="hang", fk=(22, 68), fh=(-2, 85),
         pel=(-16, 90), c0=(-18, 96), c1=(-39, 128), tilt=(-5, -2), ns=(-57, 119), ne=(-70, 136), nw=(-64, 156), nhand="open",
         fs=(-4, 132), fe=(16, 142), fw=(32, 156), fhand="open", dx=-8, dy=6)
FLAT = D(lying=1, c1=(-54, 24), c0=(-16, 24), pel=(-4, 13), head=(-58, 13),
         nh=(4, 12), nk=(40, 13), na=(82, 13), nfoot="upward", fh=(8, 22), fk=(40, 46), fa=(62, 14),
         ns=(-46, 30), ne=(-28, 38), nw=(-10, 34), fs=(-40, 36), fe=(-22, 40), fw=(-4, 36), fhand="none", dx=-14,
         order=("farm", "narm", "fleg", "hips", "chest", "head", "nleg"))
AIR = D(FLAT, nk=(38, 28), na=(74, 46), fk=(36, 50), fa=(64, 72), ffoot="upward", ns=(-46, 32), ne=(-40, 54), nw=(-30, 72), nhand="open",
        fe=(-18, 56), fw=(-4, 70), fhand="open", dy=10)
# getting up: sitting, on one knee, crouched
SIT = D(pel=(-30, 16), c0=(-31, 22), c1=(-40, 58), nh=(-30, 12), nk=(4, 22), na=(42, 12), nfoot="upward",
        fh=(-14, 18), fk=(14, 42), fa=(34, 14), ns=(-59, 51), ne=(-66, 30), nw=(-62, 12), fs=(-2, 60), fe=(8, 44), fw=(20, 42), dx=-22)
KNEEL = D(nh=(-12, 50), nk=(-8, 15), na=(-48, 12), nfoot="hang", fa=(28, 14), fk=(30, 57), fh=(8, 56),
          pel=(-5, 62), c0=(-4, 68), c1=(7, 104), ns=(-10, 96), ne=(-24, 76), nw=(-22, 56),
          fs=(46, 105), fe=(50, 82), fw=(40, 66), dx=-10)
CROUCH = D(na=(-44, 11), nk=(-36, 50), nh=(-12, 64), fa=(40, 14), fk=(40, 54), fh=(14, 67),
           pel=(-3, 75), c0=(-3, 81), c1=(-1, 119), ns=(-20, 112), ne=(-32, 90), nw=(-16, 90),
           fs=(37, 120), fe=(48, 98), fw=(60, 112))
# block: both forearms up in front of the chest
BLOCK = D(na=(-33, 11), nk=(-30, 50), nh=(-13, 81), fa=(27, 14), fk=(27, 54), fh=(9, 84),
          pel=(-6, 92), c0=(-6, 98), c1=(-8, 135), ns=(-26, 128), ne=(-6, 106), nw=(2, 132),
          fs=(30, 137), fe=(36, 110), fw=(26, 136), order=("fleg", "hips", "nleg", "chest", "head", "farm", "narm"))
BLOCK2 = D(moved(BLOCK, -3, -1, UPPER), nk=(-32, 49), fk=(25, 53))
# the blade of light: lit overhead, then down through the other one
RAISE = D(na=(-33, 11), nk=(-29, 51), nh=(-12, 83), fa=(27, 14), fk=(25, 55), fh=(10, 86),
          pel=(-5, 94), c0=(-5, 100), c1=(-7, 138), ns=(-26, 131), ne=(-33, 154), nw=(-26, 172),
          fs=(31, 140), fe=(47, 124), fw=(62, 132), blade=((-25, 180), (-58, 209)))
RAISE0 = D(RAISE, blade=((-25, 180), (-38, 192)))
SLASH = D(HHIT, ns=(12, 122), ne=(40, 108), nw=(62, 90), blade=((67, 85), (108, 52)))
SHEATHE = D(SLASH, blade=None)
# the chest beam: braced low so the emitter sits where the scene starts the beam (12, 95)
BEAM = D(CROUCH, ns=(-22, 112), ne=(-40, 96), nw=(-30, 78), fs=(37, 120), fe=(54, 104), fw=(50, 86), fbright=1)
BEAM2 = D(moved(BEAM, -1, 0, UPPER))
# the fist in the air
TAUNT = D(na=(-29, 11), nk=(-25, 52), nh=(-11, 86), fa=(25, 14), fk=(23, 56), fh=(11, 89),
          pel=(-4, 97), c0=(-4, 103), c1=(-4, 141), ns=(-23, 135), ne=(-31, 158), nw=(-25, 177),
          fs=(34, 142), fe=(48, 122), fw=(36, 108))

EM = (12, 95)
KEYS = {
    "idle": IDLE, "idle2": IDLE2, "walk0": WALK0, "walk1": WALK1, "walk2": WALK2, "walk3": WALK3,
    "jab": D(JAB, fx=[streak(40, 100, 134, 7)]), "jab_h": JAB,
    "cross": D(CROSS, fx=[streak(10, 76, 126, 8)]), "cross_h": CROSS,
    "hwind": HWIND, "hhit": D(HHIT, fx=[crescent((30, 120), 70, 20, 150, -4)]), "hhit_h": HHIT,
    "kch": KCH, "khit": D(KHIT, fx=[crescent((14, 90), 86, 16, -80, 4)]), "khit_h": KHIT,
    "reach": REACH, "lift": LIFT, "throw": D(THROW, fx=[crescent((10, 110), 84, 14, 95, -6, front=False)]), "throw_h": THROW,
    "stun": STUN, "stun2": STUN2, "reel": REEL, "air": AIR, "bounce": D(AIR, dy=2), "flat": FLAT,
    "sit": SIT, "kneel": KNEEL, "crouch": CROUCH, "block": BLOCK, "block2": BLOCK2,
    "raise0": RAISE0, "raise": RAISE, "raise_g": D(RAISE, fx=[glint((-56, 204), 6)]),
    "slash": D(SLASH, fx=[crescent((20, 100), 100, 30, 130, -29)]), "slash2": D(SLASH, fx=[crescent((20, 100), 100, 18, 60, -29)]),
    "slash3": D(SLASH, fx=[crescent((20, 100), 100, 7, 10, -29)]), "slash_h": SLASH, "sheathe": SHEATHE,
    "beam0": BEAM, "beam1": D(BEAM, glow=1, fx=[glow(EM, 6)]), "beam2": D(BEAM, glow=1, fx=[glow(EM, 10)]),
    "beam3": D(BEAM2, glow=1, fx=[glow((16, 95), 14, 1.5)]), "beam4": D(BEAM, glow=1, fx=[glow((15, 95), 11, 1.5)]),
    "taunt": TAUNT,
}

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
         "taunt"]                                                              # 58 fist in the air
# the table for whoever plays the sheet: cells and how long each drawing is held, in ticks of 1/12 s
ACTIONS = {
    "idle": ([0, 1], [6, 6]), "walk": ([4, 6, 7, 9], [3, 2, 3, 2]),
    "combo": ([10, 11, 12, 13, 14, 15], [2, 1, 2, 2, 1, 3]), "heavy": ([16, 18, 19, 20], [5, 1, 4, 2]),
    "kick": ([21, 22, 23, 24], [3, 1, 3, 2]), "grab": ([26, 28, 30, 31], [4, 6, 1, 3]),
    "hit": ([32, 33], [2, 3]), "knockdown": ([34, 35, 36, 37], [2, 3, 1, 6]), "getup": ([39, 40, 41, 42], [3, 3, 2, 2]),
    "block": ([43, 44], [2, 3]), "blade": ([45, 46, 47, 48, 49, 50, 51, 52], [2, 2, 3, 1, 1, 1, 3, 3]),
    "beam": ([53, 54, 55, 56, 57], [3, 3, 3, 1, 1]), "taunt": ([58], [8]),
}


def build():
    cache = {}
    sheet = Image.new("RGBA", (8 * W, 8 * H), (0, 0, 0, 0))
    for i, name in enumerate(CELLS):
        if name not in cache:
            cache[name] = figure(KEYS[name]).cell()
        sheet.paste(cache[name], ((i % 8) * W, (i // 8) * H))
    a = np.asarray(sheet)
    assert len(CELLS) == 59 and set(np.unique(a[..., 0])) <= {m * 32 for m in range(8)} and a[..., 1].max() <= 250
    for c in cache.values():                                  # nothing may touch the edge of its cell: it would be cut
        al = np.asarray(c)[..., 3]
        assert not (al[0].any() or al[-1].any() or al[:, 0].any() or al[:, -1].any())
    sheet.save(OUT, optimize=True)
    table = {"cell": [W, H], "cols": 8, "sheet": [8 * W, 8 * H],
             "encoding": "R = material x 32 (1 armour, 2 white, 3 gunmetal, 4 gold, 5 ink, 6 energy, 7 glass), G = tone x 50",
             "tick": "1/12 s", "emitter": list(EM),
             "actions": {k: {"frames": f, "hold": h, "anchor": [OX, OY]} for k, (f, h) in ACTIONS.items()},
             "cells": CELLS}
    (HERE / "robo.json").write_text(json.dumps(table, indent=1) + "\n")
    print(f"{OUT.name}: {len(CELLS)} cells, {len(cache)} drawings")
    return cache


def strip(cells, out, z=3, cols=8):
    sys.path.insert(0, str(pathlib.Path(out).parent))
    from view import colour
    ims = [colour(c).crop((20, 0, 270, 224)) for c in cells]
    w, h = ims[0].size
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w, rows * h), (107, 102, 120))
    for i, c in enumerate(ims):
        sheet.paste(c, ((i % cols) * w, (i // cols) * h))
    sheet.resize((sheet.width * z, sheet.height * z), Image.NEAREST).save(out)


def main():
    if len(sys.argv) > 2 and sys.argv[1] == "strip":          # python3 robo.py strip OUT [names] [zoom] [cols]: no atlas written
        names = sys.argv[3].split(",") if len(sys.argv) > 3 and sys.argv[3] != "all" else list(KEYS)
        strip([figure(KEYS[n]).cell() for n in names], sys.argv[2], int(sys.argv[4]) if len(sys.argv) > 4 else 3, int(sys.argv[5]) if len(sys.argv) > 5 else 8)
    else:
        build()
    return 0


if __name__ == "__main__":
    sys.exit(main())
