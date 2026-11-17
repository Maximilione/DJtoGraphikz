#!/usr/bin/env python3
"""Draws the pixel-art sprite sheets of the tokusatsu scenes (Titan Hand, Kaiju Stomp).

16-bit arcade sprites, drawn here pixel by pixel and frame by frame: nothing
is traced, photographed or generated. A keyframed skeleton gives the joints
of a frame; each body part is an outline filled at the sprite's own
resolution (no anti-aliasing, a pixel is in or out); each part is then shaded
as a form with a ramp of four tones per material (shadow, mid, light,
highlight), the part in front takes a tone off the part behind it, the hide
and the fur are dithered with an ordered pattern, stray single pixels are
merged into their neighbours, and the figure gets a one-pixel outline: ink on
the shadow side, the material's own dark tone where the light hits it.

    python3 scripts/gen-toku-sprites.py            # all three sheets
    python3 scripts/gen-toku-sprites.py heroes     # or: foot, hand

Output, in src/engine/assets:
  toku-heroes.png  2016 x 896, 18 x 8 cells of 112 px, a hero is 72 px tall:
                   run 0-15, run looking back 16-31, dive and roll 32-47,
                   skid stop 48-55, knocked down 56-65, getting up 66-79,
                   three roll-call poses 80-93 / 94-107 / 108-121, guard 122-129
  toku-foot.png    1792 x 800, 4 x 2 cells of 448 x 400: coming down, coming
                   down (smear), impact, settling, planted, heel up, lifting
  toku-hand.png    2048 x 448, 8 x 2 cells of 256 x 224: grope 0-3, pat 4-5,
                   grab 6-9, slam 10-11, fist 12-13, withdrawing 14-15

The hero sheet is indexed, not coloured: R = material (suit, white, visor,
gold, ink = 5) x 40, G = tone 0-4 x 50. The shader builds each hero's ramp from
his suit colour. Foot and hand carry their own palettes.
"""
import math
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw

REPO = pathlib.Path(__file__).resolve().parent.parent
OUT = REPO / "src/engine/assets"
SSA = 4                                  # an outline is tested on 4 x 4 points per pixel: in or out, never grey
INK = 5
BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) + 0.5) / 16.0


def unit(v):
    v = np.asarray(v, dtype=np.float64)
    return v / np.linalg.norm(v)


LK = unit([-0.52, -0.58, 0.63])          # key light, image coords (y down), toward the viewer
LR = unit([0.72, -0.42, 0.3])            # rim: from behind, upper right
HV = unit(LK + np.array([0.0, 0.0, 1.0]))


def box1(a, r, axis):
    r = max(int(r), 1)
    a = np.moveaxis(a, axis, 0)
    pad = np.concatenate([np.repeat(a[:1], r, 0), a, np.repeat(a[-1:], r + 1, 0)], 0)
    c = np.cumsum(pad, 0)
    out = (c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1)
    return np.moveaxis(out, 0, axis)


def blur(a, r):
    """Three box passes: close enough to a gaussian, and it keeps floats."""
    r = max(r / 1.7, 1.0)
    for _ in range(3):
        a = box1(box1(a, r, 0), r, 1)
    return a


def shift(a, dy, dx):
    """Move an image by whole pixels; what comes in at the edge is empty."""
    out = np.zeros_like(a)
    h, w = a.shape
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = a[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


class Canvas:
    """One frame at the sprite's own resolution. px = pixels per unit, origin = where (0, 0) lands
    (pixels, y down), sk scales the roundness of the forms to the size of the sprite."""

    def __init__(self, w, h, px, origin, sk):
        self.w, self.h, self.px, self.o, self.sk = w, h, px, origin, sk
        self.mat = np.zeros((h, w), np.int8)             # 0 = empty
        self.light = np.zeros((h, w), np.float32)
        self.dith = np.zeros((h, w), bool)

    def P(self, v):
        return ((self.o[0] + v[0] * self.px) * SSA, (self.o[1] - v[1] * self.px) * SSA)

    # ---- outlines: everything below fills into the current mask ----
    def begin(self):
        self._im = Image.new("L", (self.w * SSA, self.h * SSA), 0)
        self._d = ImageDraw.Draw(self._im)
        return self

    def poly(self, pts):
        self._d.polygon([self.P(p) for p in pts], fill=255)
        return self

    def disc(self, c, r):
        x, y = self.P(c)
        r *= self.px * SSA
        self._d.ellipse([x - r, y - r, x + r, y + r], fill=255)
        return self

    def cap(self, a, b, ra, rb):
        """A limb: two circles and the skin stretched between them."""
        a, b = np.asarray(a, float), np.asarray(b, float)
        d = b - a
        ln = max(np.linalg.norm(d), 1e-6)
        u = d / ln
        n = np.array([-u[1], u[0]])
        s = np.clip((ra - rb) / ln, -0.99, 0.99)
        c = math.sqrt(1.0 - s * s)
        m1, m2 = s * u + c * n, s * u - c * n
        self.poly([a + ra * m1, b + rb * m1, b + rb * m2, a + ra * m2])
        return self.disc(a, ra).disc(b, rb)

    def ell(self, c, rx, ry, ang=0.0, n=40):
        ca, sa = math.cos(ang), math.sin(ang)
        pts = []
        for i in range(n):
            t = 2 * math.pi * i / n
            x, y = rx * math.cos(t), ry * math.sin(t)
            pts.append((c[0] + x * ca - y * sa, c[1] + x * sa + y * ca))
        return self.poly(pts)

    def mask(self):
        a = np.asarray(self._im, np.float32) / 255.0
        return (a.reshape(self.h, SSA, self.w, SSA).mean((1, 3)) > 0.5).astype(np.float32)

    # ---- shade a mask as a rounded form; the tone is decided in finish() ----
    def paint(self, m, mat, gloss=0.3, sig=6.0, dim=1.0, cast=0.38, bump=None, kb=0.0, rim=0.55, dither=False):
        if not m.any():
            return
        s = max(sig * self.sk, 1.0)
        # the part in front takes a tone off whatever lies just below and right of it,
        # and is ringed by the darkest tone of whatever it overlaps: the inner outline
        self.light *= 1.0 - cast * np.clip(shift(m, 1, 1) - m, 0.0, 1.0)
        ring = np.clip(np.maximum(np.maximum(shift(m, 1, 0), shift(m, -1, 0)), np.maximum(shift(m, 0, 1), shift(m, 0, -1))) - m, 0.0, 1.0)
        self.light[(ring > 0.5) & (self.mat > 0)] = 0.05
        h = blur(m, s)
        gy, gx = np.gradient(h)
        kk = s * 2.4
        nx, ny = -gx * kk, -gy * kk
        if bump is not None:
            by, bx = np.gradient(bump)
            nx, ny = nx - bx * kb, ny - by * kb
        inv = 1.0 / np.sqrt(nx * nx + ny * ny + 1.0)
        nx, ny, nz = nx * inv, ny * inv, inv
        ndl = nx * LK[0] + ny * LK[1] + nz * LK[2]
        tone = 0.55 * smooth(0.12, 0.3, ndl) + 0.45 * np.clip(ndl, 0.0, 1.0)
        light = 0.3 + 0.82 * tone
        light = light + rim * np.clip(nx * LR[0] + ny * LR[1] + nz * LR[2], 0.0, 1.0) ** 2 * np.clip(1.6 - 2.0 * h, 0.0, 1.0)
        spec = np.clip(nx * HV[0] + ny * HV[1] + nz * HV[2], 0.0, 1.0) ** (10.0 + 110.0 * gloss) * gloss
        light = light * dim + spec * 0.9
        sel = m > 0.5
        self.light[sel] = light[sel]
        self.mat[sel] = mat
        self.dith[sel] = dither

    def decal(self, m, mat=None, mul=None, spec=None):
        """Change the material inside m, keeping the light already on the form."""
        sel = (m > 0.5) & (self.mat > 0)
        if mat is not None:
            self.mat[sel] = mat
        if mul is not None:
            self.light[sel] *= mul
        if spec is not None:
            self.light[sel] = np.maximum(self.light[sel], spec)

    def finish(self):
        """Light to tones 1-4, clean the clusters, draw the outline. Returns (material, tone)."""
        t = self.light + np.where(self.dith, (np.tile(BAYER, (self.h // 4 + 1, self.w // 4 + 1))[:self.h, :self.w] - 0.5) * 0.17, 0.0)
        lvl = (1 + (t > 0.52) + (t > 0.84) + (t > 1.14)).astype(np.int8)
        lvl[self.mat == 0] = 0
        mat = self.mat.copy()
        # a pixel alone in its tone joins the tone around it (dithered materials keep their pattern)
        for _ in range(2):
            nb = [shift(lvl, dy, dx) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            nm = [shift(mat, dy, dx) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            same = sum(((a == lvl) & (b == mat)).astype(np.int8) for a, b in zip(nb, nm))
            cand = np.where(nm[0] == mat, nb[0], np.where(nm[2] == mat, nb[2], np.where(nm[1] == mat, nb[1], nb[3])))
            fix = (same == 0) & (mat > 0) & ~self.dith & (cand > 0)
            lvl[fix] = cand[fix]
        # outline: the empty pixels that touch the figure. Where the form behind it
        # is in the light and the light comes from that side, it is the material's own dark tone
        occ = mat > 0
        out = np.zeros_like(occ)
        soft_m = np.zeros_like(mat)
        for dy, dx, lit_side in ((1, 0, False), (-1, 0, True), (0, 1, False), (0, -1, True)):
            nb_occ = shift(occ, dy, dx)
            out |= nb_occ & ~occ
            if lit_side:                                   # the body is below or to the right: this edge faces the key
                bl = shift(lvl, dy, dx)
                bm = shift(mat, dy, dx)
                pick = nb_occ & ~occ & (bl >= 3)
                soft_m[pick] = bm[pick]
        mat[out] = INK
        lvl[out] = 0
        soft = out & (soft_m > 0)
        mat[soft] = soft_m[soft]
        lvl[soft] = 1
        return mat, lvl

    def data_image(self):
        mat, lvl = self.finish()
        arr = np.zeros((self.h, self.w, 4), np.uint8)
        arr[..., 0] = mat.astype(np.int16) * 40 * (mat > 0)
        arr[..., 1] = lvl.astype(np.int16) * 50
        arr[..., 3] = 255 * (mat > 0)
        return Image.fromarray(arr, "RGBA")

    def colour_image(self, pal):
        mat, lvl = self.finish()
        arr = np.zeros((self.h, self.w, 4), np.uint8)
        for m, ramp in pal.items():
            for k, c in enumerate(ramp):
                sel = (mat == m) & (lvl == (0 if m == INK else k + 1))
                arr[sel] = (*c, 255)
        return Image.fromarray(arr, "RGBA")


# =====================================================================
# heroes
# =====================================================================
CELL, HPX = 112, 72                       # cell size, pixels per unit (1 unit = a hero's height)
SUIT, WHITE, VISOR, GOLD = 1, 2, 3, 4
POSE0 = dict(hipA=0.0, kneeA=0.0, hipB=0.0, kneeB=0.0, shA=0.0, elA=0.0, shB=0.0, elB=0.0,
             lean=0.0, head=0.0, rot=0.0, look=1.0, air=-1.0, lie=0.0)


def P(**kw):
    p = dict(POSE0)
    p.update(kw)
    return p


def mixp(a, b, t):
    return {k: a[k] + (b[k] - a[k]) * t for k in a}


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3.0 - 2.0 * x)


def back_out(x):
    x = min(max(x, 0.0), 1.0) - 1.0
    return 1.0 + x * x * (2.7 * x + 1.7)


def keys(ks, t):
    """ks = [(time, pose)...]; eased interpolation between neighbours."""
    if t <= ks[0][0]:
        return ks[0][1]
    for (t0, p0), (t1, p1) in zip(ks, ks[1:]):
        if t <= t1:
            return mixp(p0, p1, ease((t - t0) / (t1 - t0)))
    return ks[-1][1]


def run_pose(ph, look=1.0):
    """Sprint: contact, down, passing, up. The knee folds as the leg comes through,
    the arms swing against the legs a touch late, the head stays level."""
    a, b = ph, ph + math.pi
    knee = lambda x: 0.2 + 1.5 * (0.5 + 0.5 * math.cos(x + 0.4)) ** 2
    return P(hipA=0.18 + 0.85 * math.sin(a), kneeA=knee(a), hipB=0.18 + 0.85 * math.sin(b), kneeB=knee(b),
             shA=0.1 - 1.0 * math.sin(a - 0.25), elA=1.5 + 0.4 * math.sin(a - 0.5),
             shB=0.1 - 1.0 * math.sin(b - 0.25), elB=1.5 + 0.4 * math.sin(b - 0.5),
             lean=0.34 + 0.05 * math.sin(2 * a + 0.4) - 0.08 * (1.0 - look) * 0.5,
             head=-0.22 - 0.06 * math.sin(2 * a + 1.0), look=look)


GUARD = P(hipA=-0.5, kneeA=0.45, hipB=0.55, kneeB=0.85, shA=0.55, elA=2.0, shB=1.15, elB=1.7, lean=0.14, head=-0.05)
SKID = P(hipA=0.3, kneeA=1.3, hipB=1.0, kneeB=0.08, shA=1.5, elA=0.5, shB=0.9, elB=0.6, lean=-0.38, head=0.3)


def dive_pose(tu):
    """Reach, tuck, turn over, open out onto the feet."""
    tuck = ease((tu - 0.12) / 0.28) * (1.0 - ease((tu - 0.72) / 0.26))
    reach = P(hipA=-0.45, kneeA=0.15, hipB=-0.15, kneeB=0.35, shA=2.7, elA=0.15, shB=2.95, elB=0.2, lean=0.15, head=-0.3)
    ball = P(hipA=1.9, kneeA=2.35, hipB=2.05, kneeB=2.2, shA=1.3, elA=1.9, shB=1.55, elB=1.8, lean=0.8, head=0.5)
    p = mixp(reach, ball, tuck)
    p["rot"] = -2 * math.pi * ease((tu - 0.02) / 0.96) - 1.1 * (1.0 - tuck) * math.sin(tu * math.pi) * (1.0 - ease((tu - 0.35) / 0.25))
    p["air"] = 0.36
    # leave from a run, come back to one
    edge = max(1.0 - tu / 0.1, (tu - 0.9) / 0.1, 0.0)
    out = mixp(p, dict(run_pose(1.2), air=0.36, rot=p["rot"] if tu < 0.5 else -2 * math.pi), ease(edge))
    out["air"] = -1.0 if edge > 0.0 else 0.36          # feet on the ground going in and coming out
    return out


ROLL = [
    # legs set first; the arms come round late and lock with a bounce
    (P(hipA=-0.6, kneeA=0.1, hipB=0.62, kneeB=0.6, lean=0.04), (1.15, 2.3, 2.75, 0.06)),
    (P(hipA=-0.8, kneeA=0.28, hipB=0.78, kneeB=1.15, lean=0.22), (-0.6, 2.1, 1.55, 0.06)),
    (P(hipA=-0.18, kneeA=0.05, hipB=1.35, kneeB=1.75, lean=-0.06), (2.45, 0.3, -1.0, 0.45)),
]


def roll_call(v, t):
    legs, arms = ROLL[v]
    # anticipation: sink and coil the other way before the move
    coil = P(hipA=-0.3, kneeA=0.75, hipB=0.4, kneeB=0.95, shA=-0.5, elA=1.6, shB=-0.2, elB=1.9, lean=0.3, head=0.15)
    p = mixp(GUARD, coil, ease(t / 0.2))
    p = mixp(p, legs, ease((t - 0.18) / 0.3))
    ea = back_out((t - 0.25) / 0.5)
    sweep = (2.4, 0.9, -2.6, 1.2)
    if t > 0.2:
        w = ease((t - 0.2) / 0.12)
        for k, key in enumerate(("shA", "elA", "shB", "elB")):
            p[key] = p[key] * (1.0 - w) + (arms[k] + (1.0 - ea) * sweep[k]) * w
    p["head"] = -0.08 * ea + 0.1 * (1.0 - ea)
    # settle: the whole figure gives a little and comes back
    p["kneeB"] += 0.08 * math.exp(-max(t - 0.75, 0.0) * 14.0) * (1.0 if t > 0.75 else 0.0)
    return p


HIT = P(hipA=0.45, kneeA=0.35, hipB=0.7, kneeB=0.3, shA=-2.3, elA=0.3, shB=-1.7, elB=0.5, lean=-0.4, head=-0.35, rot=0.35, air=0.52)
FLY = P(hipA=0.5, kneeA=0.6, hipB=0.85, kneeB=0.35, shA=-2.2, elA=0.3, shB=-1.5, elB=0.5, lean=-0.25, head=-0.2, rot=1.15, air=0.42)
LAND = P(hipA=1.25, kneeA=0.7, hipB=0.95, kneeB=1.0, shA=-1.3, elA=0.3, shB=-0.7, elB=0.4, lean=0.1, head=0.3, rot=1.5, lie=1.0)
FLAT = P(hipA=0.45, kneeA=0.75, hipB=0.2, kneeB=0.35, shA=-0.9, elA=0.5, shB=-0.3, elB=0.7, lean=-0.02, head=-0.05, rot=1.56, lie=1.0)
SIT = P(hipA=1.45, kneeA=1.5, hipB=1.3, kneeB=1.2, shA=-0.9, elA=0.25, shB=0.9, elB=0.9, lean=0.55, head=0.2, rot=0.75, lie=1.0)
KNEEL = P(hipA=-0.15, kneeA=1.62, hipB=1.4, kneeB=1.5, shA=0.3, elA=0.6, shB=1.1, elB=0.5, lean=0.4, head=0.05, rot=0.0, lie=1.0)
RISE = P(hipA=-0.4, kneeA=0.9, hipB=0.9, kneeB=1.3, shA=0.5, elA=1.6, shB=1.2, elB=1.4, lean=0.3, head=-0.05)
KNOCK = [(0.0, GUARD), (0.14, HIT), (0.42, FLY), (0.68, LAND), (1.0, FLAT)]
GETUP = [(0.0, FLAT), (0.3, SIT), (0.58, KNEEL), (0.8, RISE), (1.0, GUARD)]


def dn(a):
    return np.array([math.sin(a), -math.cos(a)])


def joints(p):
    """Forward kinematics from the pelvis; then turn the body, then stand or lie it on the ground."""
    up = np.array([math.sin(p["lean"]), math.cos(p["lean"])])
    rt = np.array([up[1], -up[0]])
    hu = np.array([math.sin(p["lean"] + p["head"]), math.cos(p["lean"] + p["head"])])
    j = {}
    j["pel"] = np.zeros(2)
    j["chest"] = up * 0.27
    j["neck"] = j["chest"] + up * 0.05
    j["head"] = j["neck"] + hu * 0.1
    for s, sg in (("A", -1.0), ("B", 1.0)):
        hip = rt * 0.034 * sg
        kn = hip + dn(p["hip" + s]) * 0.245
        an = kn + dn(p["hip" + s] - p["knee" + s]) * 0.245
        j["hip" + s], j["kn" + s], j["an" + s] = hip, kn, an
        j["toe" + s] = an + dn(p["hip" + s] - p["knee" + s] + 1.5) * 0.1
        sh = j["chest"] + rt * (0.05 if sg > 0 else -0.045) - up * 0.015
        el = sh + dn(p["sh" + s]) * 0.15
        j["sh" + s], j["el" + s] = sh, el
        j["wr" + s] = el + dn(p["sh" + s] + p["el" + s]) * 0.145
    c = np.array([0.0, 0.12])
    ca, sa = math.cos(p["rot"]), math.sin(p["rot"])
    R = np.array([[ca, -sa], [sa, ca]])
    for k in j:
        j[k] = R @ (j[k] - c) + c
    j["up"], j["hu"] = R @ up, R @ hu
    if p["air"] >= 0.0:
        low = -p["air"]
    else:
        low = min(j["anA"][1] - 0.034, j["toeA"][1] - 0.027, j["anB"][1] - 0.034, j["toeB"][1] - 0.027)
        if p["lie"] > 0.0:
            body = min(j["pel"][1] - 0.085, j["chest"][1] - 0.1, j["head"][1] - 0.1, j["wrA"][1] - 0.035, j["wrB"][1] - 0.035,
                       j["knA"][1] - 0.05, j["knB"][1] - 0.05, j["elA"][1] - 0.04, j["elB"][1] - 0.04)
            low = min(low, body)
    for k in j:
        if k not in ("up", "hu"):
            j[k] = j[k] - np.array([0.0, low])
    return j



def draw_leg(cv, j, s, dim):
    hip, kn, an, toe = j["hip" + s], j["kn" + s], j["an" + s], j["toe" + s]
    sd = unit(an - kn)
    bk = np.array([sd[1], -sd[0]])                 # the back of the leg
    th = unit(kn - hip)
    mid = kn + sd * 0.1
    cv.begin().cap(hip, kn, 0.076, 0.052).ell(hip + th * 0.1 - np.array([th[1], -th[0]]) * 0.012, 0.085, 0.062, math.atan2(th[1], th[0]))
    cv.cap(kn, mid, 0.051, 0.047).disc(kn + sd * 0.085 + bk * 0.013, 0.045)
    cv.paint(cv.mask(), SUIT, gloss=0.45, sig=5.0, dim=dim)
    # boot: shaft, heel, foot, one clean white shape at this size
    ft = unit(toe - an)
    cv.begin().cap(mid, an, 0.048, 0.035).disc(mid + sd * 0.03 + bk * 0.012, 0.04).disc(an, 0.037).cap(an + ft * 0.01, toe, 0.036, 0.026)
    cv.paint(cv.mask(), WHITE, gloss=0.55, sig=4.0, dim=dim)


def draw_arm(cv, j, s, dim):
    sh, el, wr = j["sh" + s], j["el" + s], j["wr" + s]
    fd = unit(wr - el)
    m2 = el + fd * 0.062
    cv.begin().disc(sh, 0.058).cap(sh, el, 0.053, 0.039).cap(el, m2, 0.041, 0.037)
    cv.paint(cv.mask(), SUIT, gloss=0.45, sig=4.0, dim=dim)
    cv.begin().cap(m2, wr, 0.039, 0.031).ell(wr + fd * 0.03, 0.043, 0.036, math.atan2(fd[1], fd[0]))
    cv.disc(wr + fd * 0.012 + np.array([-fd[1], fd[0]]) * 0.03, 0.017)
    cv.paint(cv.mask(), WHITE, gloss=0.55, sig=3.5, dim=dim)


def draw_hero(cv, p):
    j = joints(p)
    up, hu, look = j["up"], j["hu"], p["look"]
    rt = np.array([up[1], -up[0]])
    pel, chest = j["pel"], j["chest"]
    T = lambda x, y: pel + rt * x + up * y           # torso coordinates
    draw_arm(cv, j, "A", 0.74)
    draw_leg(cv, j, "A", 0.74)
    # torso: hips and shoulders have width, the waist does not
    ta = math.atan2(up[1], up[0]) - math.pi / 2
    cv.begin().cap(T(0, 0.02), T(0, 0.25), 0.077, 0.1).ell(pel, 0.096, 0.073, ta).cap(T(-0.06, 0.262), T(0.065, 0.262), 0.058, 0.06)
    tm = cv.mask()
    cv.paint(tm, SUIT, gloss=0.45, sig=8.0)
    cv.begin().poly([T(-0.13, 0.31), T(0.015, 0.185), T(0.13, 0.31), T(0.13, 0.262), T(0.015, 0.137), T(-0.13, 0.262)])
    cv.decal(cv.mask() * tm, mat=WHITE)                                              # chevron
    cv.begin().poly([T(-0.13, 0.03), T(0.13, 0.03), T(0.13, 0.066), T(-0.13, 0.066)])
    cv.decal(cv.mask() * tm, mat=WHITE)                                              # belt
    cv.begin().poly([T(-0.13, 0.024), T(0.13, 0.024), T(0.13, 0.03), T(-0.13, 0.03)]).poly([T(-0.13, 0.066), T(0.13, 0.066), T(0.13, 0.072), T(-0.13, 0.072)])
    cv.decal(cv.mask() * tm, mul=0.55)
    cv.begin().ell(T(0.042, 0.048), 0.028, 0.022, ta)
    cv.decal(cv.mask() * tm, mat=GOLD, spec=0.9)                                     # buckle
    cv.begin().cap(T(0.0, 0.29), j["head"] - hu * 0.05, 0.042, 0.04)
    cv.paint(cv.mask(), SUIT, gloss=0.2, sig=3.0, dim=0.6)                           # neck
    draw_leg(cv, j, "B", 1.0)
    # helmet: shell and jaw; the visor slides round the shell as the head turns
    hr = np.array([hu[1], -hu[0]])
    H = lambda x, y: j["head"] + hr * x + hu * y
    ha = math.atan2(hu[1], hu[0]) - math.pi / 2
    cv.begin().ell(j["head"], 0.1, 0.107, ha).ell(H(0.022 * look, -0.058), 0.072, 0.056, ha)
    hm = cv.mask()
    cv.paint(hm, SUIT, gloss=0.9, sig=8.0)
    vx, vw = 0.044 * look, 0.058 * (0.5 + 0.5 * abs(look))
    cv.begin().poly([H(-0.012 - 0.006 * look, 0.03), H(0.012 - 0.006 * look, 0.03), H(0.012 - 0.006 * look, 0.12), H(-0.012 - 0.006 * look, 0.12)])
    cv.decal(cv.mask() * hm, mat=WHITE)                                              # crest
    cv.begin().cap(H(vx - vw + 0.022, 0.014), H(vx + vw - 0.022, 0.014), 0.031, 0.031)
    vm = cv.mask() * hm
    cv.decal(vm, mat=VISOR)                                                          # visor
    cv.begin().cap(H(vx - vw * 0.55, 0.028), H(vx - vw * 0.1, 0.03), 0.006, 0.004)
    cv.decal(cv.mask() * vm, spec=1.3)
    cv.begin().ell(H(vx + 0.004 * look, -0.05), 0.034 * (0.55 + 0.45 * abs(look)), 0.021, ha)
    cv.decal(cv.mask() * hm, mat=WHITE, mul=0.8)                                     # mouthpiece
    draw_arm(cv, j, "B", 1.0)


def hero_frame(p, prev=None):
    cv = Canvas(CELL, CELL, HPX, (CELL // 2, CELL - 12), 0.4)
    if prev is not None:
        # smear: where the limbs were half a frame ago, under the figure
        j = joints(mixp(prev, p, 0.5))
        for s in ("A", "B"):
            draw_arm(cv, j, s, 0.62)
            draw_leg(cv, j, s, 0.62)
    draw_hero(cv, p)
    return cv.data_image()


def atlas(frames, cols, rows):
    w, h = frames[0].size
    im = Image.new("RGBA", (cols * w, rows * h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        im.paste(f, ((i % cols) * w, (i // cols) * h))
    return im


def build_heroes():
    a = [run_pose(2 * math.pi * i / 16) for i in range(16)]
    a += [run_pose(2 * math.pi * i / 16, -1.0) for i in range(16)]
    a += [dive_pose(i / 15) for i in range(16)]
    # skid: out of the stride, heels in, the arms arriving after the body
    for i in range(8):
        t = i / 7
        p = mixp(run_pose(1.9), SKID, back_out(t * 1.15))
        for k in ("shA", "elA", "shB", "elB"):
            p[k] = mixp(run_pose(1.9), SKID, ease(t * 1.4 - 0.4))[k]
        a.append(p)
    a += [keys(KNOCK, i / 9) for i in range(10)]
    a += [keys(GETUP, i / 13) for i in range(14)]
    a += [roll_call(v, i / 13) for v in range(3) for i in range(14)]
    for i in range(8):
        br = math.sin(2 * math.pi * i / 8)
        a.append(dict(GUARD, kneeA=0.45 + 0.07 * br, kneeB=0.85 + 0.09 * br, elA=2.0 - 0.06 * br, shB=1.15 + 0.06 * br, lean=0.14 + 0.02 * br))
    # smear frames where a limb covers a lot of ground between two drawings:
    # the dive, the sweep of the arms into a pose, the knock-down
    smear = set(range(33, 47)) | set(range(57, 62)) | {80 + 14 * v + i for v in range(3) for i in range(4, 9)}
    frames = [hero_frame(p, a[i - 1] if i in smear else None) for i, p in enumerate(a)]
    atlas(frames, 18, 8).save(OUT / "toku-heroes.png", optimize=True)
    print(f"toku-heroes.png: {len(frames)} frames")


# =====================================================================
# the kaiju's foot
# =====================================================================
HIDE, IVORY = 1, 2
FOOT_PAL = {
    HIDE: [(13, 15, 19), (27, 31, 33), (45, 51, 49), (70, 76, 68)],
    IVORY: [(112, 92, 66), (178, 158, 116), (232, 220, 180), (255, 250, 232)],
    INK: [(8, 8, 14)],
}
FW, FH, FPX, FO = 448, 400, 200, (150, 392)   # foot cell, pixels per unit, where the heel end of the sole sits


def norm01(a):
    return (a - a.min()) / (a.max() - a.min())


def hide_bump(w, h, seed):
    """Knobbly rubber as a height map: welts running up the leg, knobs between."""
    rng = np.random.default_rng(seed)
    knob = smooth(0.48, 0.6, norm01(blur(rng.random((h, w)).astype(np.float32), 7.0)))
    welt = norm01(blur(rng.random((h, w // 5 + 1)).astype(np.float32).repeat(5, 1)[:, :w], 5.0))
    welt = smooth(0.8, 0.97, 1.0 - np.abs(welt - 0.5) * 2.0)
    return blur(0.9 * knob + 0.7 * welt, 1.6).astype(np.float32)


def foot_frame(spread, lift, squash, heel, stretch=0.0):
    """spread: toes fanned; lift: toes raised; squash: flattened by its own weight;
    heel: heel off the ground; stretch: pulled long by the speed of the fall (the smear)."""
    cv = Canvas(FW, FH, FPX, FO, 0.43)
    bump = hide_bump(FW, FH, 7)
    sy = 1.0 - 0.16 * squash + 0.2 * stretch
    tilt = 0.35 * heel
    c0 = np.array([0.55, 0.0])

    def X(x, y):                                       # squash or stretch, then rock forward on the toes
        v = np.array([x * (1.0 + 0.07 * squash - 0.05 * stretch), y * sy]) - c0
        return np.array([v[0] * math.cos(tilt) + v[1] * math.sin(tilt), -v[0] * math.sin(tilt) + v[1] * math.cos(tilt)]) + c0

    def skin(m, sig, dim=1.0):
        cv.paint(m, HIDE, gloss=0.35, sig=sig, bump=bump, kb=5.0, dim=dim * 1.1, cast=0.5, rim=0.3, dither=True)

    def toe(k):
        ang = -0.06 + lift * (0.5 - 0.1 * k) - 0.1 * squash
        base = np.array([0.42 - 0.12 * k, 0.2 + 0.1 * k + spread * 0.04 * k])
        d = np.array([math.cos(ang), math.sin(ang)])
        mid = base + d * (0.3 - 0.03 * k)
        a2 = ang - 0.25 + 0.3 * lift
        tip = mid + np.array([math.cos(a2), math.sin(a2)]) * (0.3 - 0.05 * k)
        r = 0.158 - 0.016 * k
        dim = 1.0 - 0.12 * k
        cd = unit(tip - mid)
        # blunt claw, stained toward the root
        cv.begin().cap(X(*(tip - cd * 0.03)), X(*(tip + cd * 0.26 + np.array([0.0, -0.035]))), 0.125, 0.055)
        cm = cv.mask()
        cv.paint(cm, IVORY, gloss=0.6, sig=7.0, dim=dim, cast=0.5)
        cv.begin().disc(X(*(tip - cd * 0.02)), 0.135)
        cv.decal(cv.mask() * cm, mul=0.6)
        cv.begin().cap(X(*base), X(*mid), r * 1.06, r).cap(X(*mid), X(*tip), r, r * 0.9).disc(X(*(mid + np.array([0.0, 0.03]))), r * 1.04)
        tm = cv.mask()
        skin(tm, 15.0, dim)
        for o in (-0.035, 0.03):                       # creases over the knuckle
            q = mid + d * o
            cv.begin().cap(X(*(q + np.array([-0.01, r * 0.95]))), X(*(q + np.array([0.012, r * 0.2]))), 0.009, 0.006)
            cv.decal(cv.mask() * tm, mul=0.5)

    # the leg, out of the top of the frame
    cv.begin().cap(X(-0.1, 0.9), X(-0.22, 2.6), 0.4, 0.47)
    lm = cv.mask()
    skin(lm, 30.0)
    cv.begin().cap(X(-0.4, 0.95), X(-0.53, 2.6), 0.008, 0.008)                      # the seam of the suit
    cv.decal(cv.mask() * lm, mul=0.45)
    toe(2)
    toe(1)
    # rolls of rubber where the ankle folds, each lying on the one below
    for i, (y, rx) in enumerate(((0.92, 0.44), (0.76, 0.47), (0.6, 0.5))):
        cv.begin().ell(X(-0.09 + 0.01 * i, y - 0.02 * squash * i), rx, 0.115 * (1.0 - 0.25 * squash))
        skin(cv.mask(), 11.0)
    cv.begin().cap(X(-0.5, 0.22), X(-0.72, 0.09), 0.1, 0.04)                        # heel spur
    cv.paint(cv.mask(), IVORY, gloss=0.6, sig=6.0, cast=0.5, dim=0.85)
    cv.begin().disc(X(-0.3, 0.28), 0.3).ell(X(0.02, 0.31), 0.45, 0.3).cap(X(-0.3, 0.3), X(-0.1, 0.5), 0.3, 0.42)
    skin(cv.mask(), 26.0)
    toe(0)
    # dirt of the last take, up from the sole
    yy = (np.arange(FH, dtype=np.float32)[:, None] - (FO[1] - 0.3 * FPX)) / (0.3 * FPX)
    cv.light *= 1.0 - 0.3 * np.clip(yy, 0.0, 1.0)
    return cv.colour_image(FOOT_PAL)


def build_foot():
    frames = [foot_frame(1.0, 0.75, 0.0, 0.0), foot_frame(1.0, 0.9, 0.0, 0.0, 1.0), foot_frame(1.0, 0.0, 1.0, 0.0),
              foot_frame(0.7, 0.03, 0.5, 0.0), foot_frame(0.4, 0.05, 0.12, 0.0), foot_frame(0.2, -0.1, 0.0, 0.5),
              foot_frame(0.0, -0.25, 0.0, 1.0), foot_frame(0.4, 0.05, 0.12, 0.0)]
    atlas(frames, 4, 2).save(OUT / "toku-foot.png", optimize=True)
    print("toku-foot.png: 8 frames")


# =====================================================================
# the titan's hand
# =====================================================================
LATEX, FUR, NAIL = 1, 2, 3
HAND_PAL = {
    LATEX: [(9, 9, 14), (20, 20, 30), (40, 41, 58), (120, 126, 160)],
    FUR: [(13, 9, 8), (26, 17, 13), (43, 28, 20), (64, 44, 30)],
    NAIL: [(54, 46, 40), (92, 82, 72), (140, 128, 112), (204, 194, 176)],
    INK: [(6, 5, 10)],
}
HW, HH, HPXH, HO = 256, 224, 108, (70, 112)   # hand cell, pixels per unit (wrist to fingertip = 1), where the wrist sits


def hand_frame(curl, spread, wig, flat):
    """Back of the hand, fingers pointing +x. curl 0 open .. 1 fist; flat presses it wide."""
    cv = Canvas(HW, HH, HPXH, HO, 0.47)
    rng = np.random.default_rng(3)
    wy = 1.0 + 0.12 * flat
    strand = norm01(blur(rng.random((HH, HW // 6 + 1)).astype(np.float32).repeat(6, 1)[:, :HW], 1.0))

    def rot(v, a):
        return np.array([v[0] * math.cos(a) - v[1] * math.sin(a), v[0] * math.sin(a) + v[1] * math.cos(a)])

    def furry(m, sig, dim=1.0):
        cv.paint(m, FUR, gloss=0.2, sig=sig, bump=strand, kb=4.5, cast=0.45, rim=0.8, dither=True, dim=dim)

    def finger(base, ang, l1, l2, r, thumb=False):
        d1 = rot(np.array([1.0, 0.0]), ang)
        mid = base + d1 * l1 * (1.0 - 0.42 * curl)
        d2 = rot(d1, (0.75 if thumb else -1.0) * (2.3 * curl + 0.22 * (1.0 - curl)))
        tip = mid + d2 * l2 * (1.0 - 0.3 * curl)
        cv.begin().cap(mid, tip, r * 0.9, r * 0.76)
        dm = cv.mask()
        cv.paint(dm, LATEX, gloss=0.85, sig=6.0, cast=0.5, rim=0.8)
        nd = unit(tip - mid)
        cv.begin().ell(tip - nd * 0.02, r * 0.62, r * 0.5, math.atan2(nd[1], nd[0]))
        cv.decal(cv.mask() * dm, mat=NAIL, mul=1.25)
        cv.begin().cap(base - d1 * 0.08, mid, r * 1.04, r * 0.92).disc(mid, r * 0.98)
        pm = cv.mask()
        cv.paint(pm, LATEX, gloss=0.85, sig=6.5, cast=0.5, rim=0.8)
        n1 = np.array([-d1[1], d1[0]])
        for o in (-0.03, 0.03):                        # creases
            q = mid + d1 * o
            cv.begin().cap(q + n1 * r * 0.7, q - n1 * r * 0.7, 0.008, 0.008)
            cv.decal(cv.mask() * pm, mul=0.45)

    def fan(k):
        return k * (0.14 + 0.3 * spread) * (1.0 - 0.5 * curl) + wig * 0.1 * math.sin(k * 2.3 + 1.0)

    # the fur sleeve behind the wrist, ragged along both edges
    cv.begin().cap((-0.3, 0.0), (0.02, 0.0), 0.29, 0.3)
    for i in range(40):
        x = rng.uniform(-0.3, 0.1)
        sg = 1.0 if i % 2 else -1.0
        y = sg * 0.29 * wy
        cv.poly([(x - 0.03, y * 0.9), (x + 0.035, y * 0.9), (x + rng.uniform(0.04, 0.11), y + sg * rng.uniform(0.02, 0.055))])
    sm = cv.mask()
    furry(sm, 22.0, 0.82)
    finger(np.array([0.12, -0.2 * wy]), -0.9 + 0.35 * curl - 0.3 * spread, 0.22, 0.18, 0.1, thumb=True)
    if curl > 0.6:                                     # a closed fist: the fingers go under the back of the hand
        for k in (-1, 0, 1):
            finger(np.array([0.5, 0.17 * k * wy]), fan(k), 0.27, 0.24 - 0.02 * abs(k), 0.092)
    cv.begin().ell((0.3, 0.0), 0.34, 0.275 * wy)
    pm = cv.mask()
    cv.paint(pm, LATEX, gloss=0.75, sig=20.0, cast=0.45, rim=0.8)
    for k in (-1, 0, 1):
        if curl <= 0.6:
            finger(np.array([0.5, 0.17 * k * wy]), fan(k), 0.27, 0.24 - 0.02 * abs(k), 0.092)
        else:
            cv.begin().disc(np.array([0.5, 0.17 * k * wy]) + rot(np.array([1.0, 0.0]), fan(k)) * 0.27 * (1.0 - 0.42 * curl), 0.1)
            cv.paint(cv.mask(), LATEX, gloss=0.85, sig=7.0, cast=0.5, rim=0.8)        # knuckles of the fist
    # fur glued over the back of the hand, ragged at its edge
    cv.begin().ell((0.1, 0.0), 0.27, 0.25 * wy)
    for i in range(34):
        a = rng.uniform(-1.35, 1.35)
        c = np.array([0.1 + 0.27 * math.cos(a), 0.25 * wy * math.sin(a)])
        t = np.array([-math.sin(a), math.cos(a)]) * 0.03
        cv.poly([c - t - np.array([0.02, 0.0]), c + t - np.array([0.02, 0.0]), c + np.array([rng.uniform(0.05, 0.12), rng.uniform(-0.02, 0.02)])])
    furry(cv.mask() * np.maximum(pm, sm), 14.0, 0.9)
    return cv.colour_image(HAND_PAL)


def build_hand():
    f = [hand_frame(0.05 + 0.05 * math.sin(i * 1.57), 0.9, math.sin(i * 1.57 + 0.5), 0.0) for i in range(4)]     # grope
    f += [hand_frame(0.22, 0.6, 0.0, 0.5), hand_frame(0.12, 0.8, 0.0, 1.0)]                                      # pat
    f += [hand_frame(c, 0.8 - 0.6 * c, 0.0, 0.0) for c in (0.25, 0.5, 0.78, 1.0)]                                # grab
    f += [hand_frame(0.0, 1.0, 0.0, 1.0), hand_frame(0.04, 0.95, 0.5, 0.8)]                                      # slam
    f += [hand_frame(1.0, 0.1, 0.0, 0.0), hand_frame(0.95, 0.12, 0.0, 0.0)]                                      # fist
    f += [hand_frame(0.55, 0.3, 0.0, 0.0), hand_frame(0.7, 0.2, 0.0, 0.0)]                                       # withdrawing
    atlas(f, 8, 2).save(OUT / "toku-hand.png", optimize=True)
    print("toku-hand.png: 16 frames")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("all", "heroes"):
        build_heroes()
    if what in ("all", "foot"):
        build_foot()
    if what in ("all", "hand"):
        build_hand()
    return 0


if __name__ == "__main__":
    sys.exit(main())
