#!/usr/bin/env python3
"""The kaiju of Robo vs Kaiju (toku-kaiju.png) and its foot at the size of a building (toku-foot.png).

    python3 scripts/toku/kaiju.py            writes both atlases and scripts/toku/kaiju.json
    python3 scripts/toku/kaiju.py strip DIR  also writes 3x preview strips into DIR

Every frame is its own drawing: closed outlines written by hand for that pose (pixel coordinates, y up,
origin where the feet stand), no skeleton and no joint angles. An outline is filled, shaded as one round
form lit from the top left, quantised to the material's tone ramp and cleaned to pixel-art clusters.
Small pieces that a sprite artist would paste from frame to frame (head, feet, claws) are drawn once.
The design is our own: a low, forward-leaning reptile with a bony neck frill, brow horns and a nose horn,
rounded sail plates and a club tail."""
import json
import math
import pathlib
import sys
import numpy as np
from PIL import Image, ImageDraw

SS = 4
HIDE, IVORY, BELLY, FIN, INK, FX, GLOW = 1, 2, 3, 4, 5, 6, 7
LIGHT = np.array([-0.56, -0.66, 0.5])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
# shade (-1..1) -> tone 1..5, per material: the hide stays charcoal, only what faces the light goes blue-grey
RAMP = {HIDE: (-0.1, 0.36, 0.63, 0.86), IVORY: (-0.35, 0.05, 0.45, 0.72), BELLY: (-0.2, 0.2, 0.52, 0.8),
        FIN: (-0.25, 0.15, 0.52, 0.78), GLOW: (-0.3, 0.1, 0.5, 0.75)}


def pts(s):
    """'x,y x,y! ...' -> [(x, y, corner)]; '!' marks a sharp corner."""
    if not isinstance(s, str):
        return list(s)
    out = []
    for t in s.split():
        x, y = t.rstrip("!").split(",")
        out.append((float(x), float(y), t.endswith("!")))
    return out


def tf(s, dx=0.0, dy=0.0, a=0.0, piv=(0.0, 0.0), sx=1.0, sy=1.0):
    """Move a whole drawn piece: scale and turn about piv (degrees, counter-clockwise), then shift."""
    c, sn = math.cos(math.radians(a)), math.sin(math.radians(a))
    out = []
    for x, y, k in pts(s):
        x, y = (x - piv[0]) * sx, (y - piv[1]) * sy
        out.append((piv[0] + x * c - y * sn + dx, piv[1] + x * sn + y * c + dy, k))
    return out


def spline(P, closed=True, n=7):
    P = pts(P)
    N = len(P)
    A = np.array([(p[0], p[1]) for p in P], float)
    res = []
    for i in range(N if closed else N - 1):
        i0, i1, i2, i3 = (i - 1) % N, i, (i + 1) % N, (i + 2) % N
        if not closed:
            i0, i3 = max(i - 1, 0), min(i + 2, N - 1)
        p1, p2 = A[i1], A[i2]
        m1 = (p2 - p1) if P[i1][2] else (p2 - A[i0]) * 0.5
        m2 = (p2 - p1) if P[i2][2] else (A[i3] - p1) * 0.5
        for k in range(n):
            t = k / n
            res.append((2 * t**3 - 3 * t**2 + 1) * p1 + (t**3 - 2 * t**2 + t) * m1 + (-2 * t**3 + 3 * t**2) * p2 + (t**3 - t**2) * m2)
    if not closed:
        res.append(A[-1])
    return res


def blur(a, r):
    if r <= 0:
        return a
    k = int(max(1, round(r)))
    for _ in range(2):
        for ax in (0, 1):
            c = np.cumsum(np.pad(a, [(k + 1, k) if x == ax else (0, 0) for x in (0, 1)], mode="edge"), axis=ax)
            a = (np.take(c, range(2 * k + 1, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - 2 * k - 1), axis=ax)) / (2 * k + 1)
    return a


def sh(a, dy, dx, fill=False):
    out = np.full_like(a, fill)
    h, w = a.shape
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = a[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


def grow(m, diag=False):
    o = m | sh(m, 1, 0) | sh(m, -1, 0) | sh(m, 0, 1) | sh(m, 0, -1)
    if diag:
        o |= sh(m, 1, 1) | sh(m, -1, -1) | sh(m, 1, -1) | sh(m, -1, 1)
    return o


def dist(m, R):
    """Depth inside the outline, in pixels, up to R (octagonal: 4- and 8-neighbour steps alternate)."""
    d = np.zeros(m.shape, np.float32)
    cur = m.copy()
    for i in range(int(R) + 1):
        if not cur.any():
            break
        d[cur] = i + 1
        cur = ~grow(~cur, diag=(i % 2 == 1))
    return d


def knobs(w, h, pitch, seed, big=False):
    """The pebbled hide as pixel clusters: +1 where a knob catches the light, -1 under it."""
    rng = np.random.default_rng(seed)
    K = np.zeros((h, w), np.int8)
    j = 0
    y = 1.0
    while y < h - 4:
        x = 1.0 + (j % 2) * pitch * 0.5
        while x < w - 5:
            if rng.random() < 0.62:
                cx, cy = int(x + rng.integers(-1, 2)), int(y + rng.integers(-1, 2))
                if big:
                    K[cy:cy + 2, cx:cx + 3] = 1
                    K[cy + 1, cx + 3] = K[cy + 1, cx] = 0
                    K[cy + 2, cx + 1:cx + 4] = -1
                    K[cy + 1, cx + 3] = -1
                else:
                    n = 2 + (rng.random() < 0.3)
                    K[cy, cx:cx + n] = 1
                    K[cy + 1, cx + 1:cx + 1 + n] = -1
            x += pitch
        y += pitch * 0.82
        j += 1
    return K


class Cv:
    def __init__(self, w, h, ox, oy, pitch=5, big=False):
        self.w, self.h, self.ox, self.oy = w, h, ox, oy
        self.mat = np.zeros((h, w), np.int8)
        self.lv = np.zeros((h, w), np.int8)
        self.fxb, self.fxf = [], []
        self.K = knobs(w * 2, h * 2, pitch, 11, big)
        self.ibias = 0.0                                        # ivory drawn large would go all white
        self.scale = 1.0                                        # roundness of the forms, for a drawing made larger
        self.G = None                                           # a whole drawing moved, turned or mirrored: dict for tf()

    def g(self, P):
        return tf(P, **self.G) if self.G else pts(P)

    def mask(self, P, closed=True):
        im = Image.new("L", (self.w * SS, self.h * SS), 0)
        q = [((self.ox + p[0]) * SS, (self.oy - p[1]) * SS) for p in spline(self.g(P))]
        ImageDraw.Draw(im).polygon(q, fill=255)
        a = np.asarray(im, np.float32).reshape(self.h, SS, self.w, SS).mean((1, 3))
        return a >= 127

    def fill(self, P, mat=HIDE, R=None, dim=0, tex=True, line=True, grad=None, cast=True, bias=0.0, cap=22, flat=None):
        """One closed outline, shaded as a single round form. dim: tones darker (the far side);
        grad=(x0,y0,x1,y1,b0,b1): tone bias along a direction (dark root, bright tip)."""
        m = self.mask(P)
        if not m.any():
            return m
        cap *= self.scale
        d = dist(m, cap)
        R = R * self.scale if R else max(2.0, min(float(d.max()), cap))
        t = np.clip((d - 0.5) / R, 0, 1)
        hgt = blur(R * np.sqrt(1 - (1 - t) ** 2), self.scale)
        gy, gx = np.gradient(hgt)
        nz = 1.0 / np.sqrt(gx * gx + gy * gy + 1)
        s = (-gx * LIGHT[0] - gy * LIGHT[1] + LIGHT[2]) * nz + bias
        if mat == HIDE:                                         # the whole form turns away from the light toward its underside
            ys = np.nonzero(m.any(1))[0]
            v = (np.arange(self.h, dtype=np.float32)[:, None] - ys[0]) / max(ys[-1] - ys[0], 8)
            s = s + 0.2 * (0.45 - v)
        if grad is not None:
            x0, y0, x1, y1, b0, b1 = grad
            yy, xx = np.mgrid[0:self.h, 0:self.w]
            u = ((xx - self.ox - x0) * (x1 - x0) + (self.oy - yy - y0) * (y1 - y0)) / max((x1 - x0) ** 2 + (y1 - y0) ** 2, 1e-6)
            s = s + b0 + (b1 - b0) * np.clip(u, 0, 1)
        r = RAMP[mat]
        lv = (1 + (s > r[0]) + (s > r[1]) + (s > r[2]) + (s > r[3])).astype(np.int8)
        if mat == HIDE:
            lv = np.minimum(lv, 4)                              # tone 5 on the hide is kept for single specular pixels
            if tex:
                ys, xs = np.nonzero(m)
                ay, ax = int(ys.min()) % 64, int(xs.min()) % 64  # the pattern travels with the shape
                K = self.K[64 - ay:64 - ay + self.h, 64 - ax:64 - ax + self.w]
                ok = d >= 3
                lv = np.where(ok & (K > 0) & (lv >= 3), lv + 1, lv)
                lv = np.where(ok & (K > 0) & (lv == 2) & (sh(K, 0, 3) == 0), 3, lv)
                lv = np.where(ok & (K < 0) & (lv >= 2), lv - 1, lv)
        lv = np.clip(lv - dim, 1, 5).astype(np.int8)
        if flat is not None:
            lv[:] = flat
        under = self.mat > 0
        if cast:                                                # the form in front shades what is behind it
            c = sh(m, 3, 2) & under & ~m & (self.mat != INK) & (self.mat != GLOW)
            self.lv[c] = np.maximum(self.lv[c] - 1, 1)
        if line:                                                # an inner contour, on the side away from the light
            ring = (grow(m) if line == 2 else (sh(m, 1, 0) | sh(m, 0, 1))) & ~m & under
            self.mat[ring] = INK
            self.lv[ring] = 0
            lit = (sh(m, -1, 0) | sh(m, 0, -1)) & ~m & under & (self.mat != INK) & (self.mat != GLOW)
            self.lv[lit] = np.maximum(self.lv[lit] - 1, 1)
        self.mat[m] = mat
        self.lv[m] = lv[m]
        return m

    def stroke(self, P, lv=1, mat=None, only=None, w=1):
        """An inner contour line (fold, plate edge, muscle): tone lv of what is under it, or INK with lv=0."""
        im = Image.new("L", (self.w, self.h), 0)
        q = [(self.ox + p[0], self.oy - p[1]) for p in spline(self.g(P), closed=False)]
        ImageDraw.Draw(im).line(q, fill=255, width=w)
        m = (np.asarray(im) > 0) & (self.mat > 0) & (self.mat != INK)
        if only is not None:
            m &= self.mat == only
        if lv == 0:
            self.mat[m] = INK
            self.lv[m] = 0
        else:
            if mat is not None:
                self.mat[m] = mat
            self.lv[m] = lv if lv > 0 else np.maximum(self.lv[m] + lv, 1)
        return m

    def px(self, x, y, mat, lv):
        x, y = self.g([(x, y, False)])[0][:2]
        X, Y = int(round(self.ox + x)), int(round(self.oy - y))
        if 0 <= X < self.w and 0 <= Y < self.h:
            self.mat[Y, X], self.lv[Y, X] = mat, lv

    def fx(self, P, lv, front=False):
        (self.fxf if front else self.fxb).append((self.mask(P), lv))

    def finish(self):
        mat, lv = self.mat.copy(), self.lv.copy()
        fig = mat > 0
        # no orphan pixels: a tone standing alone takes the tone of its neighbours
        for _ in range(2):
            key = mat.astype(np.int16) * 8 + lv
            same = np.zeros(fig.shape, np.int8)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                same += sh(key, dy, dx, -1) == key
            alone = fig & (same == 0) & (mat != GLOW) & (mat != INK)
            for dy, dx in ((0, -1), (-1, 0), (0, 1), (1, 0)):
                nm, nl = sh(mat, dy, dx), sh(lv, dy, dx)
                take = alone & (nm == mat)
                lv[take] = nl[take]
                alone &= ~take
        out = grow(fig) & ~fig
        mat[out] = INK
        lv[out] = 0
        for m, l in self.fxb:
            s = m & (mat == 0)
            mat[s], lv[s] = FX, l
        for m, l in self.fxf:
            mat[m], lv[m] = FX, l
        return mat, lv

    def data(self):
        mat, lv = self.finish()
        a = np.zeros((self.h, self.w, 4), np.uint8)
        a[..., 0] = mat.astype(np.int16) * 32
        a[..., 1] = lv.astype(np.int16) * 50
        a[..., 3] = 255 * (mat > 0)
        return Image.fromarray(a, "RGBA")

    def colour(self, pal):
        mat, lv = self.finish()
        a = np.zeros((self.h, self.w, 4), np.uint8)
        for m, ramp in pal.items():
            for k, c in enumerate(ramp):
                a[(mat == m) & (np.clip(lv, 1, len(ramp)) == k + 1)] = (*c, 255)
        return Image.fromarray(a, "RGBA")


# what the shader of the duel does with the indices, for the preview strips
PREVIEW = {HIDE: [(13, 14, 22), (30, 33, 44), (54, 60, 72), (88, 98, 114), (150, 162, 178)],
           IVORY: [(60, 44, 34), (128, 104, 74), (196, 176, 134), (238, 228, 196), (255, 252, 240)],
           BELLY: [(47, 40, 32), (82, 69, 56), (120, 101, 81), (158, 133, 107), (198, 166, 134)],
           FIN: [(22, 62, 60), (36, 104, 98), (52, 150, 140), (70, 198, 184), (165, 232, 222)],
           INK: [(8, 6, 18)],
           FX: [(150, 50, 20), (178, 60, 22), (255, 100, 30), (255, 190, 120), (255, 255, 255)],
           GLOW: [(120, 40, 24), (190, 66, 30), (255, 110, 40), (255, 200, 150), (255, 244, 220)]}


def preview(data_im, bg=(70, 90, 120)):
    a = np.asarray(data_im)
    mat, lv = np.round(a[..., 0] / 32).astype(int), np.round(a[..., 1] / 50).astype(int)
    out = np.zeros(a.shape[:2] + (3,), np.uint8)
    out[:] = bg
    for m, ramp in PREVIEW.items():
        for k, c in enumerate(ramp):
            out[(mat == m) & (np.clip(lv, 1, len(ramp)) == k + 1)] = c
    return Image.fromarray(out, "RGB")


# =====================================================================
# pieces drawn once and pasted from frame to frame, as on a sprite sheet
# =====================================================================
def spike(cv, b, t, w, bend=0.0, mat=IVORY, dim=0, root=-0.8, tip=0.35):
    """A claw, horn or tooth: dark at the root, glossy at the tip, curved by bend."""
    (bx, by), (tx, ty) = b, t
    dx, dy = tx - bx, ty - by
    L = math.hypot(dx, dy)
    nx, ny = -dy / L, dx / L
    mx, my = bx + dx * 0.55 + nx * bend * L, by + dy * 0.55 + ny * bend * L
    P = [(bx + nx * w / 2, by + ny * w / 2, True), (mx + nx * w * 0.36, my + ny * w * 0.36, False), (tx, ty, True),
         (mx - nx * w * 0.3, my - ny * w * 0.3, False), (bx - nx * w / 2, by - ny * w / 2, True)]
    cv.fill(P, mat, tex=False, dim=dim, grad=(bx, by, tx, ty, root, tip), cast=False, bias=cv.ibias)


def plates(cv, row, glow=0, dim=0):
    """The sail: rounded plates, each (x, y, lean in degrees, height, half width) written for the pose."""
    for i, (x, y, a, h, w) in enumerate(row):
        P = tf([(-w, -4, True), (-w * 1.12, h * 0.45, False), (-w * 0.62, h * 0.9, False), (0, h, False),
                (w * 0.62, h * 0.9, False), (w * 1.12, h * 0.45, False), (w, -4, True)], x, y, a)
        lit = glow > i / max(len(row) - 1, 1) - 0.01 and glow > 0       # the glow climbs from the tail up
        m = cv.fill(P, GLOW if lit else FIN, R=max(2.5, w * 0.6), tex=False, dim=dim, cast=False)
        cv.stroke(tf([(0, 0, False), (0, h * 0.62, False)], x, y, a), lv=-1, only=GLOW if lit else FIN)


def head(cv, x, y, a=0.0, jaw=0.0, s=0.92, eye=5):
    """Broad armoured snout, nose horn, two brow horns and the bony frill behind the skull. Local frame:
    origin at the back of the jaw, snout along +x. jaw: how far the lower jaw hangs open, in degrees."""
    T = lambda q, **k: tf(tf(q, sx=s, sy=s, **k), x, y, a)
    tp = lambda px, py: T([(px, py, False)])[0][:2]
    spike(cv, tp(15, 18), tp(33, 38), 6.5 * s, -0.12, dim=1)                                  # far brow horn
    cv.fill(T("1,-8 -11,-9 -22,-1 -29,13 -28,28 -19,39 -6,43 5,37 10,22 7,6"), R=5)            # the frill: a rim of hide
    cv.fill(T("2,-3 -9,-5 -18,2 -24,14 -23,26 -16,35 -6,38 2,33 6,22 5,6"), BELLY, R=9, tex=False, line=False, cast=False, bias=-0.12)   # and a shield of bone
    for q in ("4,10 -17,3", "4,13 -23,17", "5,16 -16,33", "6,18 -4,37"):
        cv.stroke(T(q), lv=-1, only=BELLY)
    for b, t in (((-21, 0), (-30, -6)), ((-28, 13), (-38, 12)), ((-27, 28), (-36, 34)), ((-18, 39), (-23, 49)), ((-5, 42), (-4, 52))):
        spike(cv, tp(*b), tp(*t), 6 * s, 0.0, root=-0.5)
    J = lambda q: T(tf(q, a=-jaw, piv=(5, -5)))
    jp = lambda px, py: J([(px, py, False)])[0][:2]
    if jaw > 4:                                                                                # the mouth, lit from the throat
        cv.fill([(*tp(6, -5), True), (*tp(44, -2), True), (*jp(43, -6), True)], GLOW, tex=False, flat=2, cast=False)
        cv.fill([(*tp(6, -5), True), (*tp(26, -3), True), (*jp(24, -6), True)], GLOW, tex=False, flat=1, cast=False, line=False)
    cv.fill(J("3,-4 14,-5 38,-5 45,-6 45,-10 37,-13 20,-14 7,-13 1,-9"), R=4)                   # lower jaw
    if jaw > 4:
        for tx in (40, 33, 26):
            spike(cv, jp(tx, -6), jp(tx + 1, -1), 3.2 * s, root=0.0)
    cv.fill(T("-1,2 0,14 6,20 14,21 21,16 31,12 40,11 46,7 48,1! 45,-3 30,-3 14,-4 5,-6"), R=8)  # skull and snout
    if jaw > 4:
        for tx in (43, 37, 31, 25):
            spike(cv, tp(tx, -3), tp(tx - 1, -8), 3.4 * s, root=0.0)
    cv.stroke(T("10,-2 12,6 20,9 30,7 38,3"), lv=-1, only=HIDE)                                # cheek plate
    cv.stroke(T("30,7 31,-2"), lv=-1, only=HIDE)
    cv.stroke(T("12,14 17,13 23,11"), lv=0)                                                    # brow over the eye
    ex, ey = tp(18, 10)
    for ox, oy, l in ((0, 0, eye), (1, 0, eye), (2, 0, eye - 2), (0, -1, eye - 2), (1, -1, eye - 1)):
        cv.px(ex + ox, ey + oy, GLOW, l)
    cv.px(ex + 2, ey - 1, INK, 0)
    cv.px(*tp(44, 5), INK, 0)
    spike(cv, tp(39, 10), tp(46, 25), 7.5 * s, 0.14)                                           # nose horn
    spike(cv, tp(9, 19), tp(27, 41), 8 * s, -0.13)                                             # near brow horn
    return tp(47, -3)                                                                          # the mouth


def foot(cv, x, y, a=0.0, dim=0, up=0.0):
    """A foot: the mitt, four toes in a row each with a long curved claw, the fold of hide over the ankle.
    Origin at the heel end of the sole. up: toes and claws raised (degrees)."""
    T = lambda q: tf(q, x, y, a)
    cv.fill(T("0,0! -4,7 -2,15 6,20 16,19 24,14 29,8 31,3 31,0!"), R=8, dim=dim, line=2)
    for bx, by in ((33, 4), (28, 3), (23, 1), (18, 0)):                                        # far toe first
        U = lambda q: T(tf(q, bx, by, up, piv=(0, 4)))
        up_ = lambda px, py: U([(px, py, False)])[0][:2]
        cv.fill(U("0,0! -2,5 2,9 8,8 11,4 11,0!"), R=4, dim=dim, cast=False, line=2)
        spike(cv, up_(8, 4.5), up_(21, 0), 6.5, 0.22, dim=dim, root=-0.6)
    cv.fill(T("-4,14 2,20 12,22 23,20 28,16 23,12 10,14 1,11"), R=3.5, dim=dim, cast=False)    # ankle fold


def hand(cv, x, y, d, dim=0, n=3, L=11, fan=24):
    """The claws of a hand at (x, y), pointing along d degrees."""
    for k in range(n):
        a = math.radians(d + fan * (k - (n - 1) / 2))
        o = math.radians(d + 90) 
        bx, by = x + 2.5 * (k - (n - 1) / 2) * math.cos(o), y + 2.5 * (k - (n - 1) / 2) * math.sin(o)
        spike(cv, (bx, by), (bx + L * math.cos(a), by + L * math.sin(a)), 4.2, -0.15, dim=dim, root=-0.5)


def club(cv, x, y, d):
    """The spikes of the club at the end of the tail, d = where the tail points."""
    for k in (-75, 0, 75):
        a = math.radians(d + k)
        spike(cv, (x + 7 * math.cos(a), y + 7 * math.sin(a)), (x + 19 * math.cos(a), y + 19 * math.sin(a)), 7, 0.0, root=-0.5)


def belly(cv, P):
    cv.fill(P, BELLY, R=5, tex=False, line=False, cast=False)
    q = pts(P)
    for i in range(1, len(q) // 2):                          # the plates across it
        a, b = q[i], q[-i]
        cv.stroke([(a[0], a[1], False), (b[0], b[1], False)], lv=0, only=BELLY)


def swoosh(cv, P, front=False):
    """A smear drawn into the frame: coloured edge, white core."""
    q = pts(P)
    cx, cy = sum(p[0] for p in q) / len(q), sum(p[1] for p in q) / len(q)
    cv.fx(q, 3, front)
    cv.fx(tf(q, piv=(cx, cy), sx=0.82, sy=0.82), 4, front)
    cv.fx(tf(q, piv=(cx, cy), sx=0.6, sy=0.6), 5, front)


# =====================================================================
# the drawings. Outlines are written per pose; x right (toward the enemy), y up, feet at (0, 0)
# =====================================================================
KW, KH, KO = 288, 224, (140, 212)
# --- arms: shoulder, elbow, hand as one outline; (hand x, y, direction of the claws)
ARM_A = ("36,108 46,112 54,104 52,92 50,86 60,84 70,82 74,76 70,70 60,70 48,72 38,74 34,84 34,98", (72, 75, -12))          # at rest, forearm forward
ARM_W = ("42,112 52,104 44,95 30,84 20,84 19,96 25,112 30,124 38,123 40,114 35,104 33,97 37,104", (34, 122, 70))             # cocked back, claws up
ARM_S = ("42,106 52,110 64,104 78,98 90,94 96,88 94,80 84,80 72,84 60,86 48,86 40,94", (94, 85, -25))                        # slashed forward
ARM_T = ("42,104 52,108 64,100 76,90 86,80 90,72 86,66 78,68 68,76 58,82 48,84 40,92", (88, 69, -55))                        # flung down
ARM_UP = ("30,124 40,128 52,122 58,118 62,128 62,140 68,146 74,140 72,126 68,112 60,106 46,108 34,112", (68, 143, 80))       # raised, claws to the sky
ARM_HI = ("28,122 40,126 46,138 46,154 44,170 40,180 30,180 28,168 30,152 30,140 26,132", (35, 179, 95))                    # straight up, holding
ARM_BL = ("30,122 40,126 50,118 56,108 66,106 70,118 70,134 64,142 57,138 58,124 54,116 44,112 34,112", (64, 139, 100))      # forearm up before the face
ARM_P = ("40,66 52,68 58,56 60,40 64,26 68,14 62,8 54,10 52,24 48,40 42,52", (62, 9, -20))                                   # propped on the ground
# --- legs (near side; the far one is the same drawing moved back) and where the foot goes: (x, y, turn, toes up)
LEG_A = ("24,76 30,60 31,48 26,36 24,24 24,12 4,12 2,24 -3,36 -10,46 -20,58 -22,74 -12,88 6,92 20,86", (2, 0, 0, 0))         # planted column
LEG_F = ("24,78 34,62 40,48 40,34 42,22 42,12 22,12 20,24 14,36 4,46 -12,58 -22,74 -12,88 6,92 20,86", (20, 0, 0, 0))        # stepped forward
LEG_B = ("20,74 16,60 6,48 -6,38 -14,26 -18,16 -36,22 -32,34 -26,46 -22,58 -24,74 -12,88 6,92 18,86", (-40, 9, -16, 14))     # trailing, heel up
LEG_UP = ("22,78 34,70 42,62 42,52 36,44 32,36 14,40 16,48 14,54 4,58 -14,62 -22,74 -12,88 6,92 20,86", (10, 24, -22, 0))    # lifted, passing
LEG_KC = ("-12,90 10,94 34,92 50,88 58,78 58,64 56,48 40,46 40,60 36,68 18,66 0,62 -16,62 -22,76", (40, 33, -18, 0))         # knee to the chest
LEG_KH = ("-12,92 10,96 34,94 58,92 78,92 82,74 60,72 36,70 14,66 -4,62 -18,64 -22,78", (84, 64, 72, 0))                     # kicked out, sole first
LEG_C = ("-18,66 -2,72 18,66 34,54 40,42 34,30 28,20 26,12 6,12 8,24 6,32 -8,38 -22,48", (4, 0, 0, 0))                       # folded under, crouching
LEG_K = ("6,36 22,46 38,58 50,60 58,52 66,40 72,30 60,24 54,36 46,42 34,36 22,22 8,20", (62, 20, 42, 0))                     # in the air, on its back
# --- tails with the club: outline, (club x, y, direction)
TAIL_A = ("-20,96 -40,86 -61,71 -81,56 -94,48 -103,47 -108,52 -118,50 -123,39 -117,29 -106,28 -94,30 -79,37 -60,50 -40,58 -22,60", (-114, 40, 200))
TAIL_L = ("-22,90 -44,88 -68,85 -92,83 -104,84 -112,90 -124,88 -129,77 -123,67 -111,66 -100,68 -84,66 -62,64 -40,60 -24,56", (-119, 78, 175))
TAIL_R = ("-22,84 -38,68 -54,49 -70,33 -85,24 -96,22 -103,27 -113,24 -117,13 -111,3 -100,2 -88,5 -74,11 -58,24 -42,42 -27,56", (-107, 14, 200))
TAIL_C = ("-24,70 -42,56 -58,39 -76,26 -88,20 -96,22 -102,26 -111,22 -114,12 -108,2 -97,1 -83,5 -65,14 -49,28 -34,40 -25,46", (-105, 13, 200))
TAIL_COIL = ("-24,72 -42,68 -58,72 -70,84 -74,98 -70,110 -64,116 -64,128 -54,134 -44,128 -42,116 -50,108 -56,96 -54,86 -46,76 -36,62 -26,50", (-54, 124, 80))
TAIL_SW = ("24,72 44,80 66,86 88,89 102,88 110,94 122,92 127,81 121,71 109,71 96,73 78,71 58,64 40,54 26,48", (116, 82, 5))
TAIL_SW2 = ("24,70 44,66 66,56 86,44 98,36 104,38 116,34 119,22 111,13 100,15 92,21 76,31 58,41 40,48 26,46", (109, 25, -30))
TAIL_K = ("26,26 44,22 66,18 88,16 100,16 106,21 118,19 123,9 117,0 105,0 96,3 80,4 60,4 40,5 24,8", (112, 10, 0))
# --- bodies: trunk and neck as one outline, the plates of the belly, the sail, where the head sits (x, y)
B_A = ("-36,80 -28,98 -14,114 6,127 26,134 44,134 58,126 63,114 65,103 66,92 60,76 48,62 26,54 0,54 -20,58 -34,66",
       "62,112 64,102 65,92 59,77 47,64 26,56 18,62 34,70 42,82 46,94 46,104 48,114",
       ((22, 131, 16, 16, 7), (4, 123, 28, 22, 9), (-15, 110, 40, 22, 9), (-30, 94, 50, 16, 7)), (55, 116))
B_L = ("-34,74 -24,92 -6,106 16,116 40,120 60,118 74,110 80,100 80,90 74,78 64,66 48,56 24,50 0,52 -20,56 -34,62",
       "78,100 79,90 73,79 63,68 48,58 26,52 20,58 40,66 52,76 58,86 62,94 64,104",
       ((36, 118, 8, 16, 7), (14, 113, 20, 22, 9), (-8, 102, 34, 22, 9), (-26, 88, 48, 16, 7)), (70, 104))
B_R = ("-34,76 -32,96 -24,116 -10,134 6,146 24,150 38,144 44,132 44,118 46,104 48,90 46,74 38,60 22,52 0,52 -20,58 -32,66",
       "40,140 44,128 44,114 46,102 47,90 45,76 37,63 22,55 14,62 26,72 30,84 31,96 30,108 29,122 28,136",
       ((0, 144, 28, 16, 7), (-14, 132, 42, 22, 9), (-26, 114, 58, 22, 9), (-33, 94, 72, 16, 7)), (30, 140))
B_F = ("-36,80 -30,98 -18,114 -2,128 16,136 32,136 44,128 50,116 52,104 54,92 52,76 44,62 26,54 0,54 -20,58 -34,66",
       "49,116 51,104 53,92 51,77 43,64 26,56 18,62 30,70 36,80 37,92 36,104 36,116",
       ((12, 135, 14, 16, 7), (-4, 126, 28, 22, 9), (-20, 112, 42, 22, 9), (-31, 95, 56, 16, 7)), (42, 114))
B_C = ("-36,56 -26,74 -6,84 18,88 40,86 58,78 66,66 64,54 54,44 36,38 12,36 -12,40 -30,46",
       "64,62 63,54 54,45 36,40 14,38 12,42 34,44 48,50 55,58 56,64",
       ((30, 88, 6, 16, 7), (10, 87, 14, 22, 9), (-10, 82, 28, 22, 9), (-26, 72, 44, 16, 7)), (58, 62))
B_K = ("-62,8 -40,4 -10,4 14,6 28,14 30,28 22,40 4,46 -18,46 -40,42 -58,34 -68,22",
       "-56,34 -40,41 -18,45 4,45 20,39 16,35 2,40 -18,40 -38,37 -54,30",
       ((-44, 8, 172, 8, 6), (-22, 7, 180, 9, 8), (0, 7, 186, 8, 7)), (-58, 20))


def tail_sail(tail):
    if not any(tail is t for t in (TAIL_A, TAIL_L, TAIL_R, TAIL_C, TAIL_COIL, TAIL_SW, TAIL_SW2, TAIL_K)):
        return []
    """Small plates down the tail, from the outline's upper edge (its first points)."""
    q = pts(tail[0])
    out = []
    for i, (h, w) in zip((1, 2, 3), ((11, 5), (8, 4), (6, 3))):
        a = math.degrees(math.atan2(q[i + 1][1] - q[i - 1][1], q[i + 1][0] - q[i - 1][0])) - 90
        if tail in (TAIL_SW, TAIL_SW2, TAIL_K):
            a += 180 if tail is TAIL_K else 0
        out.append((q[i][0], q[i][1] - 2 * math.cos(math.radians(a)), a + (180 if q[i + 1][0] < q[i - 1][0] else 0), h, w))
    return out


def arm(cv, A, dx=0, dy=0, dim=0, d=None):
    sx, sy = pts(A[0])[0][:2]                               # drawn a little larger than the sketch, from the shoulder
    P = tf(tf(A[0], piv=(sx, sy), sx=1.18, sy=1.18), dx, dy)
    cv.fill(P, dim=dim, line=2, cap=9)
    hx, hy, hd = A[1]
    hand(cv, sx + (hx - sx) * 1.18 + dx, sy + (hy - sy) * 1.18 + dy, hd if d is None else d, dim, L=12)


def leg(cv, Lg, dx=0, dy=0, dim=0, ft=None):
    cv.fill(tf(Lg[0], dx, dy), dim=dim, line=2)
    fx, fy, fa, fu = ft or Lg[1]
    foot(cv, fx + dx, fy + dy, fa, dim, fu)


def figure(cv, body, tail, legN, legF, armN, armF, hd, glow=0.0, bd=(0, 0), legF_d=(-30, 2), armF_d=(11, 4), arm_d=(0, 0), ft=None, ftF=None, mirror_head=False):
    """One drawing, back to front: far arm, far leg, tail, sail, trunk, belly, near leg, near arm, head.
    hd = (turn of the head, jaw open); bd shifts the trunk with what hangs from it."""
    bx, by = bd
    if armF:
        arm(cv, armF, armF_d[0] + arm_d[0] + bx, armF_d[1] + arm_d[1] + by, 1)
    if legF:
        leg(cv, legF, legF_d[0], legF_d[1], 1, ftF)
    club(cv, *tail[1])
    plates(cv, [(x + bx, y + by, a, h, w) for x, y, a, h, w in body[2]] + tail_sail(tail), glow)
    cv.fill(tail[0])
    cv.fill(tf(body[0], bx, by))
    belly(cv, tf(body[1], bx, by))
    if legN:
        leg(cv, legN, ft=ft)
    m = head(cv, body[3][0] + bx, body[3][1] + by, hd[0], hd[1])
    if armN:
        arm(cv, armN, arm_d[0] + bx, arm_d[1] + by)
    return m


def idle(cv, v):
    figure(cv, B_A, TAIL_A, LEG_A, LEG_A, ARM_A, ARM_A, (-5, (0, 0, 0, 12)[v]), bd=(0, (0, 1, 0, 1)[v]))


def walk(cv, v):
    n, f = ((LEG_F, LEG_B), (LEG_A, LEG_UP), (LEG_B, LEG_F), (LEG_UP, LEG_A))[v]
    figure(cv, B_A, TAIL_A, n, f, ARM_A, ARM_A, (-5, 0), bd=(0, (-2, 1, -2, 1)[v]), legF_d=(-14, 2))


def combo(cv, v):
    if v == 0:                                               # the claw drawn back
        figure(cv, B_A, TAIL_A, LEG_A, LEG_A, ARM_W, ARM_A, (2, 6), bd=(-4, 0), arm_d=(4, -16))
    elif v in (1, 2):                                        # the near claw rakes down
        figure(cv, B_L, TAIL_L, LEG_F, LEG_A, ARM_S, ARM_A, (-10, 18), arm_d=(14, -6))
        if v == 1:
            swoosh(cv, "84,140 106,134 124,116 130,94 124,76 120,94 112,110 98,126", True)
    else:                                                    # the far one follows, jaws open
        figure(cv, B_L, TAIL_L, LEG_F, LEG_A, ARM_W, ARM_S, (-14, 26), bd=(4, -2), arm_d=(12, -20), armF_d=(4, 22))
        if v == 3:
            swoosh(cv, "92,146 114,140 132,122 138,100 134,84 128,100 120,116 106,132", True)


def heavy(cv, v):
    if v == 0:                                               # reared back, the horn aimed
        figure(cv, B_R, TAIL_R, LEG_A, LEG_A, ARM_W, ARM_W, (20, 8), arm_d=(-8, -2))
    else:                                                    # and thrown forward, head first
        figure(cv, B_L, TAIL_L, LEG_F, LEG_B, ARM_T, ARM_T, (-24, 4), bd=(6, -4), arm_d=(-6, -4), legF_d=(-22, 2))
        if v == 1:
            swoosh(cv, "70,150 96,152 120,144 136,128 142,112 130,122 112,132 92,138")


def kick(cv, v):
    if v == 0:
        figure(cv, B_R, TAIL_R, LEG_KC, LEG_A, ARM_A, ARM_W, (4, 8), bd=(-6, 0), arm_d=(-6, 14), legF_d=(-16, 0))
    else:
        figure(cv, B_R, TAIL_R, LEG_KH, LEG_A, ARM_W, ARM_UP, (8, 22), bd=(-12, -2), arm_d=(-8, 0), legF_d=(-16, 0))
        if v == 1:
            swoosh(cv, "20,40 48,34 78,40 100,58 112,84 98,68 76,54 50,48")


def grab(cv, v):
    if v == 0:                                               # both arms and the jaws reach
        figure(cv, B_L, TAIL_L, LEG_F, LEG_A, ARM_S, ARM_S, (-4, 30), arm_d=(14, -4), armF_d=(4, 12))
    elif v == 1:                                             # hauled overhead
        figure(cv, B_R, TAIL_R, LEG_A, LEG_A, ARM_HI, ARM_HI, (38, 6), armF_d=(-22, 2))
    else:                                                    # and flung down
        figure(cv, B_L, TAIL_L, LEG_F, LEG_B, ARM_T, ARM_T, (-18, 28), bd=(4, -2), arm_d=(14, -2), legF_d=(-22, 2))


def stun(cv, v):
    cv.G = dict(a=(10, 4, 26)[v], piv=(-10, 30), dy=(0, 0, 12)[v], dx=(0, 0, 22)[v])
    figure(cv, B_R, TAIL_A if v < 2 else TAIL_L, LEG_A if v < 2 else LEG_KC, LEG_A if v < 2 else LEG_UP, ARM_UP, ARM_UP, (36, 22), armF_d=(-10, 6))
    cv.G = None


def down(cv, v):
    """On its back: 0 in the air, belly up; 1 bouncing; 2 flat out."""
    cv.G = dict(a=-14, piv=(0, 24), dy=44, dx=-18) if v == 0 else dict(dy=4) if v == 1 else None
    leg(cv, LEG_K, 16, 5, 1, (80, 26, 55, 0))
    arm(cv, ("-42,40 -30,42 -26,54 -24,66 -30,72 -38,66 -38,54", (-30, 70, 95)), 10, 2, 1)
    club(cv, *TAIL_K[1])
    plates(cv, B_K[2])
    cv.fill(TAIL_K[0])
    cv.fill(B_K[0])
    belly(cv, B_K[1])
    leg(cv, LEG_K)
    arm(cv, ("-42,40 -30,42 -26,54 -24,66 -30,72 -38,66 -38,54", (-30, 70, 95)))
    g = dict(cv.G or {})
    cv.G = dict(sx=-1, piv=(-58, 20), **{k: v_ for k, v_ in g.items() if k in ("dy",)}) if v else dict(sx=-1, piv=(-58, 20), a=14, dy=52, dx=-22)
    head(cv, -58, 20, 22 if v else 0, 24)
    cv.G = None


def crouch(cv, v):
    """0 pushing itself up, 1 low on its hands, 2 the same with the tail coiled to strike."""
    if v == 0:
        cv.G = dict(a=16, piv=(-20, 0), dx=14)
    figure(cv, B_C, TAIL_COIL if v == 2 else TAIL_C if v else (tf(TAIL_L[0], 0, -18), (-119, 60, 175)), LEG_C, LEG_C, ARM_P if v else ARM_A, ARM_P if v else ARM_A, (-6 if v else 4, 10 if v == 0 else 0),
           legF_d=(-28, 2), arm_d=(0, 8) if v else (4, -40))
    cv.G = None


def block(cv, v):
    figure(cv, B_R, TAIL_R, LEG_A, LEG_A, ARM_BL, ARM_BL, (-34, 0), bd=(-4 - 3 * v, -2), armF_d=(9, 3))


def swipe(cv, v):
    """Its back turned, the club comes round at chest height: 0 and 1 the blow, 2 the follow-through."""
    tail = TAIL_SW2 if v == 2 else TAIL_SW
    club(cv, *tail[1])
    plates(cv, tail_sail(tail))
    cv.fill(tail[0])
    cv.G = dict(sx=-1, dx=6)
    arm(cv, ARM_A, 11, -36, 1)
    leg(cv, LEG_C, -28, 2, 1)
    plates(cv, B_C[2])
    cv.fill(B_C[0])
    belly(cv, B_C[1])
    leg(cv, LEG_C)
    arm(cv, ARM_A, 2, -40)
    head(cv, 58, 62, 6, 16)
    cv.G = None
    if v == 0:
        swoosh(cv, "-24,150 28,162 80,148 116,120 132,92 112,104 92,124 62,138 24,146", True)
    elif v == 1:
        swoosh(cv, "40,150 84,140 116,116 132,90 118,100 100,120 72,134", True)


def breath(cv, v):
    if v < 3:                                                # it rears and the sail lights from the tail up
        m = figure(cv, B_R, TAIL_R, LEG_A, LEG_A, ARM_A, ARM_A, (24, (8, 14, 22)[v]), glow=(0.45, 0.75, 1.0)[v], arm_d=(-8, 14))
        if v == 2:
            cv.fx([(m[0] + x, m[1] + y, False) for x, y in ((-3, 5), (2, 9), (7, 5), (2, 1))], 5, True)
    else:                                                    # braced, jaws wide: the beam leaves at (85, 111)
        m = figure(cv, B_F, TAIL_L, LEG_F, LEG_A, ARM_W, ARM_W, (0, 30), glow=1.0, arm_d=(-8, -14))
        r = (11, 8)[v - 3]
        swoosh(cv, [(m[0] + 4 + r * 1.3 * math.cos(t), m[1] + 3 + r * math.sin(t), False) for t in np.linspace(0, 2 * math.pi, 9)[:-1]], True)
        return m


def roar(cv):
    figure(cv, B_R, TAIL_R, LEG_A, LEG_A, ARM_UP, ARM_UP, (34, 32), armF_d=(-12, 4))


# name -> drawing; the sheet keeps the cell numbers the shader of the duel already reads (59 cells, 8 a row)
D = {"idle_a": lambda c: idle(c, 0), "idle_b": lambda c: idle(c, 1), "idle_c": lambda c: idle(c, 3),
     "walk_1": lambda c: walk(c, 0), "walk_2": lambda c: walk(c, 1), "walk_3": lambda c: walk(c, 2), "walk_4": lambda c: walk(c, 3),
     "claw_wind": lambda c: combo(c, 0), "claw_a_fx": lambda c: combo(c, 1), "claw_a": lambda c: combo(c, 2), "claw_b_fx": lambda c: combo(c, 3), "claw_b": lambda c: combo(c, 4),
     "horn_wind": lambda c: heavy(c, 0), "horn_fx": lambda c: heavy(c, 1), "horn": lambda c: heavy(c, 2),
     "kick_wind": lambda c: kick(c, 0), "kick_fx": lambda c: kick(c, 1), "kick": lambda c: kick(c, 2),
     "grab": lambda c: grab(c, 0), "lift": lambda c: grab(c, 1), "throw": lambda c: grab(c, 2),
     "stun_a": lambda c: stun(c, 0), "stun_b": lambda c: stun(c, 1), "launched": lambda c: stun(c, 2),
     "air": lambda c: down(c, 0), "bounce": lambda c: down(c, 1), "flat": lambda c: down(c, 2),
     "push_up": lambda c: crouch(c, 0), "crouch": lambda c: crouch(c, 1), "coil": lambda c: crouch(c, 2),
     "block_a": lambda c: block(c, 0), "block_b": lambda c: block(c, 1),
     "swipe_fx": lambda c: swipe(c, 0), "swipe_fx2": lambda c: swipe(c, 1), "swipe_end": lambda c: swipe(c, 2),
     "charge_1": lambda c: breath(c, 0), "charge_2": lambda c: breath(c, 1), "charge_3": lambda c: breath(c, 2),
     "fire_a": lambda c: breath(c, 3), "fire_b": lambda c: breath(c, 4), "roar": roar}
CELLS = ["idle_a", "idle_b", "idle_c", "idle_b",                                           # 0-3 idle
         "walk_1", "walk_1", "walk_2", "walk_3", "walk_3", "walk_4",                       # 4-9 walk
         "claw_wind", "claw_a_fx", "claw_a", "claw_wind", "claw_b_fx", "claw_b",           # 10-15 combo
         "horn_wind", "horn_wind", "horn_fx", "horn", "horn",                              # 16-20 heavy: the horn
         "kick_wind", "kick_fx", "kick", "kick_wind", "idle_a",                            # 21-25 kick
         "grab", "grab", "lift", "lift", "throw", "throw",                                 # 26-31 grab, lift, throw
         "stun_a", "stun_b",                                                               # 32-33 hit
         "launched", "air", "bounce", "flat", "flat",                                      # 34-38 knocked down
         "push_up", "crouch", "crouch", "idle_b",                                          # 39-42 getting up
         "block_a", "block_b",                                                             # 43-44 block
         "coil", "coil", "swipe_fx", "swipe_fx2", "swipe_end", "swipe_end", "coil", "idle_a",   # 45-52 the tail
         "charge_1", "charge_2", "charge_3", "fire_a", "fire_b",                           # 53-57 the breath
         "roar"]                                                                           # 58 taunt
_cache = {}


def render(name):
    if name not in _cache:
        cv = Cv(KW, KH, *KO)
        m = D[name](cv)
        fig = cv.mat > 0
        if fig[0].any() or fig[-1].any() or fig[:, 0].any() or fig[:, -1].any():
            print("warning:", name, "touches the edge of its cell", fig[0].any(), fig[-1].any(), fig[:, 0].any(), fig[:, -1].any())
        if m is not None:
            print(name, "mouth at", [round(x) for x in m])
        _cache[name] = cv.data()
    return _cache[name]


def strip(names, path, cols=6, zoom=3, crop=None):
    ims = [preview(render(n)) for n in names]
    if crop:
        ims = [i.crop(crop) for i in ims]
    w, h = ims[0].size
    rows = (len(ims) + cols - 1) // cols
    st = Image.new("RGB", (cols * w, rows * h), (70, 90, 120))
    for i, im in enumerate(ims):
        st.paste(im, ((i % cols) * w, (i // cols) * h))
    st.resize((st.width * zoom, st.height * zoom), Image.NEAREST).save(path)


# =====================================================================
# the foot at the size of a building (Kaiju Stomp): the same foot, drawn large. 4 x 2 cells of 384 x 352,
# heel end of the sole at (128, 344); the leg runs out of the top of the cell and the scene carries it on
# =====================================================================
FW, FH, FO, FS = 384, 352, (128, 344), 4.3
FOOT_PAL = {HIDE: [(11, 12, 18), (25, 28, 37), (45, 50, 61), (73, 82, 96), (124, 136, 152)],
            IVORY: [(60, 44, 34), (128, 104, 74), (196, 176, 134), (238, 228, 196), (255, 252, 240)], INK: [(5, 5, 9)]}
# frame: (toes raised, heel lifted (degrees, turning on the toes), squash of the height, stretch of the width)
FOOT_FRAMES = [("descend", 24, 0, 1.0, 1.0), ("descend_smear", 34, 0, 1.16, 0.96), ("impact", -5, 0, 0.84, 1.07), ("settle", -2, 0, 0.93, 1.03),
               ("planted", 0, 0, 1.0, 1.0), ("heel_up", 16, 13, 1.0, 1.0), ("lifted", -12, 27, 1.0, 1.0), ("planted", 0, 0, 1.0, 1.0)]


def big_foot(up, heel, sy, sx):
    cv = Cv(FW, FH, *FO, pitch=7, big=True)
    cv.scale, cv.ibias = FS, -0.3
    c, sn = math.cos(math.radians(-heel)), math.sin(math.radians(-heel))
    px, py = 54 * FS * sx, 0.0                               # it rocks on the tips of the claws
    base = dict(sx=FS * sx, sy=FS * sy)
    lift = 34.0 if heel > 20 else 0.0
    def G(q):
        out = []
        for x, y, k in tf(q, **base):
            x, y = x - px, y - py
            out.append((px + x * c - y * sn, py + x * sn + y * c + lift, k))
        return out
    cv.g = G
    cv.fill("-6,150! -5,60 -3,28 1,14 25,14 24,28 23,60 23,150!", line=False)       # the column of the leg
    for q in ("3,60 10,57 18,60", "2,44 12,40 22,44", "6,30 14,28 20,31"):
        cv.stroke(q, lv=-1)
    cv.fill("-7,26 -2,33 10,35 24,33 31,27 26,21 10,22 -2,20", R=5, cast=False, line=2)    # two folds of hide over the ankle
    foot(cv, 0, 0, 0, 0, up)
    return cv.colour(FOOT_PAL)


def sheet(ims, cols, rows):
    w, h = ims[0].size
    im = Image.new("RGBA", (cols * w, rows * h), (0, 0, 0, 0))
    for i, f in enumerate(ims):
        im.paste(f, ((i % cols) * w, (i // cols) * h))
    return im


def frame_table():
    acts = {"idle": (0, 4), "walk": (4, 10), "combo": (10, 16), "heavy": (16, 21), "kick": (21, 26), "grab_lift_throw": (26, 32), "hit_stun": (32, 34),
            "knockdown": (34, 39), "get_up": (39, 43), "block": (43, 45), "tail_swipe": (45, 53), "breath_charge": (53, 56), "breath_fire": (56, 58), "taunt": (58, 59)}
    out = {}
    for k, (a, b) in acts.items():
        fr, hold = [], []
        for i in range(a, b):                                # a drawing held over several cells is one frame with a longer hold
            if fr and CELLS[i] == CELLS[fr[-1]] and i - fr[-1] == hold[-1]:
                hold[-1] += 1
            else:
                fr.append(i)
                hold.append(1)
        out[k] = {"frames": fr, "hold": hold, "anchor": list(KO), "drawings": [CELLS[i] for i in fr]}
    return {"cell": [KW, KH], "cols": 8, "atlas": "src/engine/assets/toku-kaiju.png", "encoding": "R = material * 32, G = tone * 50 (1 hide, 2 ivory, 3 belly and frill, 4 sail, 5 ink, 6 energy, 7 glow)",
            "note": "cells keep the numbers robokaiju.frag already reads; hold counts cells of the shader's own timing; the kaiju faces +x; beam leaves the mouth at (85, 111) px from the feet in cells 56-57",
            "actions": out,
            "foot": {"atlas": "src/engine/assets/toku-foot.png", "cell": [FW, FH], "cols": 4, "anchor": list(FO), "encoding": "colour",
                     "actions": {"descend": {"frames": [1, 0], "hold": [1, 1]}, "impact": {"frames": [2, 3], "hold": [1, 2]}, "planted": {"frames": [4], "hold": [1]}, "lift": {"frames": [5, 6], "hold": [1, 1]}}}}


def main():
    here = pathlib.Path(__file__).resolve().parent
    out = here.parent.parent / "src/engine/assets"
    sheet([render(n) for n in CELLS], 8, 8).save(out / "toku-kaiju.png", optimize=True)
    feet = [big_foot(*f[1:]) for f in FOOT_FRAMES]
    sheet(feet, 4, 2).save(out / "toku-foot.png", optimize=True)
    (here / "kaiju.json").write_text(json.dumps(frame_table(), indent=1) + "\n")
    a = np.asarray(Image.open(out / "toku-kaiju.png"))
    assert a.shape == (8 * KH, 8 * KW, 4) and set(np.unique(a[..., 0])) <= {0, 32, 64, 96, 128, 160, 192, 224}, "kaiju sheet: bad size or material index"
    assert all(a[(i // 8) * KH:(i // 8 + 1) * KH, (i % 8) * KW:(i % 8 + 1) * KW, 3].any() for i in range(len(CELLS))), "empty cell"
    print(f"toku-kaiju.png: {len(CELLS)} cells, {len(D)} drawings; toku-foot.png: {len(feet)} frames; kaiju.json")
    if len(sys.argv) > 2 and sys.argv[1] == "strip":
        d = pathlib.Path(sys.argv[2])
        strip(list(D), d / "redraw_kaiju_3x.png", cols=6, zoom=3, crop=(0, 14, 288, 224))
        st = Image.new("RGB", (FW * 4, FH * 2), (70, 90, 120))
        for i, f in enumerate(feet):
            st.paste(f, ((i % 4) * FW, (i // 4) * FH), f)
        st.resize((st.width * 3, st.height * 3), Image.NEAREST).save(d / "redraw_kaiju_foot_3x.png")
        st.save(d / "foot_1x.png")
        strip(list(D), d / "kaiju_1x.png", cols=7, zoom=1, crop=(0, 14, 288, 224))


if __name__ == "__main__":
    if len(sys.argv) > 3 and sys.argv[1] == "dbg":
        strip(sys.argv[3].split(","), sys.argv[2], cols=int(sys.argv[4]) if len(sys.argv) > 4 else 3, zoom=int(sys.argv[5]) if len(sys.argv) > 5 else 3, crop=(0, 14, 288, 224))
    else:
        sys.exit(main())
