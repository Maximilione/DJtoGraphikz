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
  toku-hero-0/1/2.png  2048 x 1024 each, 16 x 8 cells of 128 px, a hero is 84 px
                   tall. Three designs (helmet, visor, emblem), same moves:
                   stance 0-7, walk 8-15, run 16-27, run looking back 28-39,
                   flip 40-51, skid 52-57, knocked down 58-65, getting up 66-75,
                   roll-call pose 76-87, jab and cross 88-95, roundhouse 96-103,
                   flying kick 104-111, energy bolt 112-121, turning 122-123,
                   the bolt in flight 124-127
  toku-foot.png    1536 x 704, 4 x 2 cells of 384 x 352: coming down, coming
                   down (smear), impact, settling, planted, heel up, lifting
  toku-hand.png    1728 x 864, 6 x 3 cells of 288 px: grope 0-3, pat 4-5,
                   grab 6-9, wound up 10, slam 11-12, fist 13-14, withdrawing
                   15-16. Drawn already turned the way it points

The hero sheet is indexed, not coloured: R = material (suit, white, visor,
gold, ink = 5, energy = 6) x 40, G = tone 0-5 x 50. The shader builds each hero's ramp from
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
        self.fx = []                                     # flat shapes with no outline: swooshes, energy
        self.tf = None                                   # optional 2x2 turn of everything drawn

    def P(self, v):
        if self.tf is not None:
            v = self.tf @ np.asarray(v, float)
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
        tone = 0.72 * smooth(0.16, 0.24, ndl) + 0.28 * np.clip(ndl, 0.0, 1.0)      # a hard-edged shadow shape
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
        lvl = (1 + (t > 0.44) + (t > 0.66) + (t > 0.95) + (t > 1.16)).astype(np.int8)
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
                pick = nb_occ & ~occ & (bl >= 4) & (bm == 1)   # only the main material: white kit keeps its ink line
                soft_m[pick] = bm[pick]
        mat[out] = INK
        lvl[out] = 0
        soft = out & (soft_m > 0)
        mat[soft] = soft_m[soft]
        lvl[soft] = 1
        return mat, lvl

    def data_image(self):
        mat, lvl = self.finish()
        for m, fm, fl in self.fx:                          # behind the figure, never outlined
            sel = (m > 0.5) & (mat == 0)
            mat[sel] = fm
            lvl[sel] = fl
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
                sel = (mat == m) & ((lvl == (0 if m == INK else k + 1)) | ((k == len(ramp) - 1) & (lvl > k + 1) & (m != INK)))
                arr[sel] = (*c, 255)
        return Image.fromarray(arr, "RGBA")


# =====================================================================
# heroes
# =====================================================================
CELL, HPX = 128, 84                       # cell size, pixels per unit (1 unit = a hero's height, 7.5 heads)
SUIT, WHITE, VISOR, GOLD, FX = 1, 2, 3, 4, 6
POSE0 = dict(hipA=0.0, kneeA=0.0, hipB=0.0, kneeB=0.0, shA=0.0, elA=0.0, shB=0.0, elB=0.0,
             lean=0.0, head=0.0, rot=0.0, look=1.0, air=-1.0, lie=0.0, open=0.0)


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


def snap(x):
    """Pixel timing: get to the key pose fast and sit on it."""
    x = min(max(x, 0.0), 1.0)
    return 1.0 - (1.0 - x) ** 3


def keys(ks, t, f=ease):
    """ks = [(time, pose)...]; interpolation between neighbours."""
    if t <= ks[0][0]:
        return ks[0][1]
    for (t0, p0), (t1, p1) in zip(ks, ks[1:]):
        if t <= t1:
            return mixp(p0, p1, f((t - t0) / (t1 - t0)))
    return ks[-1][1]


def run_pose(ph, look=1.0, amp=1.0):
    """Sprint (amp 1) or walk (amp ~0.45): contact, down, passing, up."""
    a, b = ph, ph + math.pi
    knee = lambda x: 0.2 * amp + (0.25 + 1.25 * amp) * (0.5 + 0.5 * math.cos(x + 0.4)) ** 2
    return P(hipA=0.18 * amp + 0.85 * amp * math.sin(a), kneeA=knee(a), hipB=0.18 * amp + 0.85 * amp * math.sin(b), kneeB=knee(b),
             shA=0.1 - amp * math.sin(a - 0.25), elA=0.5 + amp * (1.0 + 0.4 * math.sin(a - 0.5)),
             shB=0.1 - amp * math.sin(b - 0.25), elB=0.5 + amp * (1.0 + 0.4 * math.sin(b - 0.5)),
             lean=0.04 + 0.32 * amp + 0.05 * amp * math.sin(2 * a + 0.4) - 0.04 * (1.0 - look),
             head=-0.22 * amp - 0.06 * amp * math.sin(2 * a + 1.0), look=look)


GUARD = P(hipA=-0.5, kneeA=0.5, hipB=0.55, kneeB=0.85, shA=0.55, elA=2.0, shB=1.15, elB=1.7, lean=0.14, head=-0.05)
SKID = P(hipA=0.3, kneeA=1.3, hipB=1.0, kneeB=0.08, shA=1.5, elA=0.5, shB=0.9, elB=0.6, lean=-0.38, head=0.3, open=1.0)
TURN = P(hipA=-0.14, kneeA=0.25, hipB=0.14, kneeB=0.25, shA=-0.25, elA=0.5, shB=0.25, elB=0.5, lean=0.0, look=0.0)


def dive_pose(tu):
    """Reach, tuck, turn over, open out onto the feet."""
    tuck = ease((tu - 0.12) / 0.28) * (1.0 - ease((tu - 0.72) / 0.26))
    reach = P(hipA=-0.45, kneeA=0.15, hipB=-0.15, kneeB=0.35, shA=2.7, elA=0.15, shB=2.95, elB=0.2, lean=0.15, head=-0.3, open=1.0)
    ball = P(hipA=1.9, kneeA=2.35, hipB=2.05, kneeB=2.2, shA=1.3, elA=1.9, shB=1.55, elB=1.8, lean=0.8, head=0.5)
    p = mixp(reach, ball, tuck)
    p["rot"] = -2 * math.pi * ease((tu - 0.02) / 0.96) - 1.1 * (1.0 - tuck) * math.sin(tu * math.pi) * (1.0 - ease((tu - 0.35) / 0.25))
    p["air"] = 0.36
    edge = max(1.0 - tu / 0.1, (tu - 0.9) / 0.1, 0.0)
    out = mixp(p, dict(run_pose(1.2), air=0.36, rot=p["rot"] if tu < 0.5 else -2 * math.pi), ease(edge))
    out["air"] = -1.0 if edge > 0.0 else 0.36          # feet on the ground going in and coming out
    return out


ROLL = [
    # the pose each of them holds at the roll call: fist raised, arms crossed, low palm strike
    P(hipA=-0.6, kneeA=0.1, hipB=0.62, kneeB=0.6, lean=0.04, shA=1.0, elA=2.2, shB=2.85, elB=0.1),
    P(hipA=-0.55, kneeA=0.25, hipB=0.6, kneeB=0.5, lean=0.0, shA=1.35, elA=2.35, shB=1.2, elB=2.3, look=0.6),
    P(hipA=-0.9, kneeA=0.3, hipB=0.85, kneeB=1.25, lean=0.25, shA=-0.7, elA=2.1, shB=1.55, elB=0.06, open=1.0),
]


def roll_call(v, t):
    coil = P(hipA=-0.3, kneeA=0.8, hipB=0.4, kneeB=1.0, shA=-0.5, elA=1.6, shB=-0.2, elB=1.9, lean=0.3, head=0.15)
    p = keys([(0.0, GUARD), (0.22, coil), (0.5, ROLL[v]), (1.0, ROLL[v])], t, snap)
    if 0.22 < t < 0.6:                                  # the arms come round the long way and lock late
        w = 1.0 - back_out((t - 0.22) / 0.38)
        p["shA"] += 2.2 * w
        p["shB"] -= 2.4 * w
    p["kneeB"] += 0.1 * math.exp(-max(t - 0.55, 0.0) * 12.0) * (1.0 if t > 0.55 else 0.0)
    return p


HIT = P(hipA=0.45, kneeA=0.35, hipB=0.7, kneeB=0.3, shA=-2.3, elA=0.3, shB=-1.7, elB=0.5, lean=-0.4, head=-0.35, rot=0.35, air=0.52, open=1.0)
FLY = P(hipA=0.5, kneeA=0.6, hipB=0.85, kneeB=0.35, shA=-2.2, elA=0.3, shB=-1.5, elB=0.5, lean=-0.25, head=-0.2, rot=1.15, air=0.42, open=1.0)
LAND = P(hipA=1.25, kneeA=0.7, hipB=0.95, kneeB=1.0, shA=-1.3, elA=0.3, shB=-0.7, elB=0.4, lean=0.1, head=0.3, rot=1.5, lie=1.0, open=1.0)
FLAT = P(hipA=0.45, kneeA=0.75, hipB=0.2, kneeB=0.35, shA=-0.9, elA=0.5, shB=-0.3, elB=0.7, lean=-0.02, head=-0.05, rot=1.56, lie=1.0, open=1.0)
SIT = P(hipA=1.45, kneeA=1.5, hipB=1.3, kneeB=1.2, shA=-0.9, elA=0.25, shB=0.9, elB=0.9, lean=0.55, head=0.2, rot=0.75, lie=1.0)
KNEEL = P(hipA=-0.15, kneeA=1.62, hipB=1.4, kneeB=1.5, shA=0.3, elA=0.6, shB=1.1, elB=0.5, lean=0.4, head=0.05, rot=0.0, lie=1.0)
RISE = P(hipA=-0.4, kneeA=0.9, hipB=0.9, kneeB=1.3, shA=0.5, elA=1.6, shB=1.2, elB=1.4, lean=0.3, head=-0.05)
KNOCK = [(0.0, GUARD), (0.14, HIT), (0.42, FLY), (0.68, LAND), (1.0, FLAT)]
GETUP = [(0.0, FLAT), (0.3, SIT), (0.58, KNEEL), (0.8, RISE), (1.0, GUARD)]
# strikes: wind up, hit, hold the hit, recover
JAB = P(hipA=-0.55, kneeA=0.4, hipB=0.65, kneeB=0.8, shA=0.4, elA=2.2, shB=1.5, elB=0.05, lean=0.24, head=-0.1)
CROSS = P(hipA=-0.7, kneeA=0.2, hipB=0.75, kneeB=1.0, shA=1.55, elA=0.05, shB=0.2, elB=2.3, lean=0.34, head=-0.15)
PUNCH = [(0.0, GUARD), (0.14, JAB), (0.3, JAB), (0.44, GUARD), (0.58, CROSS), (0.8, CROSS), (1.0, GUARD)]
CHAMBER = P(hipA=-0.1, kneeA=0.25, hipB=1.5, kneeB=2.1, shA=0.9, elA=1.8, shB=-0.4, elB=1.5, lean=-0.2, head=0.15)
ROUND = P(hipA=-0.12, kneeA=0.1, hipB=1.8, kneeB=0.04, shA=1.1, elA=1.6, shB=-0.9, elB=0.6, lean=-0.5, head=0.4)
KICK = [(0.0, GUARD), (0.25, CHAMBER), (0.42, ROUND), (0.7, ROUND), (0.85, CHAMBER), (1.0, GUARD)]
CROUCH = P(hipA=0.5, kneeA=1.5, hipB=1.1, kneeB=1.7, shA=-0.8, elA=0.6, shB=-0.5, elB=0.8, lean=0.5, head=-0.2)
FLYK = P(hipA=1.15, kneeA=2.2, hipB=1.62, kneeB=0.04, shA=-0.9, elA=0.9, shB=0.5, elB=2.0, lean=-0.1, head=0.1, rot=0.42, air=0.55)
FKICK = [(0.0, GUARD), (0.18, CROUCH), (0.38, FLYK), (0.75, FLYK), (0.9, dict(CROUCH, air=-1.0)), (1.0, GUARD)]
GATHER = P(hipA=-0.6, kneeA=0.7, hipB=0.5, kneeB=1.0, shA=-0.5, elA=1.5, shB=-0.25, elB=1.75, lean=-0.06, head=0.0, open=1.0)
FIRE = P(hipA=-0.85, kneeA=0.25, hipB=0.85, kneeB=1.2, shA=1.5, elA=0.05, shB=1.58, elB=0.05, lean=0.32, head=-0.2, open=1.0)
BLAST = [(0.0, GUARD), (0.15, GATHER), (0.42, GATHER), (0.52, FIRE), (0.85, FIRE), (1.0, GUARD)]


def dn(a):
    return np.array([math.sin(a), -math.cos(a)])


TH, SHN, FT, TORSO, UARM, FARM = 0.26, 0.255, 0.12, 0.25, 0.155, 0.15


def joints(p):
    """Forward kinematics from the pelvis; then turn the body, then stand or lie it on the ground."""
    up = np.array([math.sin(p["lean"]), math.cos(p["lean"])])
    rt = np.array([up[1], -up[0]])
    hu = np.array([math.sin(p["lean"] + p["head"]), math.cos(p["lean"] + p["head"])])
    tw = 0.45 + 0.55 * abs(p["look"])                  # how much of the chest faces us: narrow when square-on to the move
    j = {}
    j["pel"] = np.zeros(2)
    j["chest"] = up * TORSO
    j["neck"] = j["chest"] + up * 0.045
    j["head"] = j["neck"] + hu * 0.082
    for s, sg in (("A", -1.0), ("B", 1.0)):
        hip = rt * 0.042 * sg
        kn = hip + dn(p["hip" + s]) * TH
        an = kn + dn(p["hip" + s] - p["knee" + s]) * SHN
        j["hip" + s], j["kn" + s], j["an" + s] = hip, kn, an
        j["toe" + s] = an + dn(p["hip" + s] - p["knee" + s] + 1.5) * FT
        sh = j["chest"] + rt * 0.082 * sg * tw - up * 0.012
        el = sh + dn(p["sh" + s]) * UARM
        j["sh" + s], j["el" + s] = sh, el
        j["wr" + s] = el + dn(p["sh" + s] + p["el" + s]) * FARM
    c = np.array([0.0, 0.12])
    ca, sa = math.cos(p["rot"]), math.sin(p["rot"])
    R = np.array([[ca, -sa], [sa, ca]])
    for k in j:
        j[k] = R @ (j[k] - c) + c
    j["up"], j["hu"] = R @ up, R @ hu
    if p["air"] >= 0.0:
        low = -p["air"]
    else:
        low = min(j["anA"][1] - 0.04, j["toeA"][1] - 0.03, j["anB"][1] - 0.04, j["toeB"][1] - 0.03)
        if p["lie"] > 0.0:
            low = min(low, j["pel"][1] - 0.085, j["chest"][1] - 0.1, j["head"][1] - 0.08, j["wrA"][1] - 0.04, j["wrB"][1] - 0.04,
                      j["knA"][1] - 0.05, j["knB"][1] - 0.05, j["elA"][1] - 0.04, j["elB"][1] - 0.04)
    for k in j:
        if k not in ("up", "hu"):
            j[k] = j[k] - np.array([0.0, low])
    return j


def draw_leg(cv, j, s, dim):
    hip, kn, an, toe = j["hip" + s], j["kn" + s], j["an" + s], j["toe" + s]
    sd = unit(an - kn)
    bk = np.array([sd[1], -sd[0]])                 # the back of the leg
    th = unit(kn - hip)
    mid = kn + sd * 0.085
    cv.begin().cap(hip, kn, 0.078, 0.05).ell(hip + th * 0.1 - np.array([th[1], -th[0]]) * 0.014, 0.09, 0.066, math.atan2(th[1], th[0]))
    cv.cap(kn, mid, 0.05, 0.047)
    cv.paint(cv.mask(), SUIT, gloss=0.4, sig=5.5, dim=dim)
    # boot: a chunky shaft with a calf, a turned-over cuff, a heel, a long foot, a dark sole
    ft = unit(toe - an)
    fn = np.array([ft[1], -ft[0]])
    if fn[1] > 0:
        fn = -fn
    cv.begin().cap(mid, an, 0.053, 0.04).disc(mid + sd * 0.045 + bk * 0.016, 0.046).disc(an + bk * 0.008, 0.043).cap(an + ft * 0.012, toe, 0.042, 0.032)
    bm = cv.mask()
    cv.paint(bm, WHITE, gloss=0.7, sig=4.5, dim=dim)
    cv.begin().cap(an - ft * 0.03 + fn * 0.036, toe + ft * 0.02 + fn * 0.027, 0.012, 0.011)
    cv.decal(cv.mask() * bm, mul=0.2)
    cv.begin().cap(mid - sd * 0.008, mid + sd * 0.014, 0.06, 0.059)
    cv.paint(cv.mask(), WHITE, gloss=0.6, sig=3.0, dim=dim, cast=0.6)


def draw_arm(cv, j, s, dim, opened):
    sh, el, wr = j["sh" + s], j["el" + s], j["wr" + s]
    fd = unit(wr - el)
    fnm = np.array([-fd[1], fd[0]])
    m2 = el + fd * 0.055
    cv.begin().disc(sh, 0.064).cap(sh, el, 0.056, 0.04).cap(el, m2, 0.043, 0.04)
    cv.paint(cv.mask(), SUIT, gloss=0.4, sig=4.5, dim=dim)
    # glove: gauntlet, flared cuff, and either a square fist with a thumb or an open hand
    cv.begin().cap(m2, wr, 0.043, 0.036)
    if opened > 0.5:
        cv.cap(wr, wr + fd * 0.075, 0.04, 0.03).cap(wr + fd * 0.01, wr + fd * 0.045 + fnm * 0.045, 0.02, 0.014)
    else:
        cv.poly([wr - fnm * 0.045 - fd * 0.005, wr + fnm * 0.045 - fd * 0.005, wr + fnm * 0.045 + fd * 0.065, wr - fnm * 0.045 + fd * 0.065])
        cv.disc(wr + fd * 0.03, 0.05).disc(wr + fd * 0.02 + fnm * 0.04, 0.022)
    cv.paint(cv.mask(), WHITE, gloss=0.7, sig=4.0, dim=dim)
    cv.begin().cap(m2 - fd * 0.008, m2 + fd * 0.014, 0.053, 0.051)
    cv.paint(cv.mask(), WHITE, gloss=0.6, sig=3.0, dim=dim, cast=0.6)


def draw_hero(cv, p, v):
    """v picks the helmet, the visor and the emblem: three different designs, all our own."""
    j = joints(p)
    up, hu, look = j["up"], j["hu"], p["look"]
    rt = np.array([up[1], -up[0]])
    pel = j["pel"]
    tw = 0.45 + 0.55 * abs(look)
    T = lambda x, y: pel + rt * x * tw + up * y       # torso coordinates
    draw_arm(cv, j, "A", 0.72, p["open"])
    draw_leg(cv, j, "A", 0.72)
    # torso: broad shoulders, deep chest, narrow waist, hips
    cv.begin().poly([T(-0.118, 0.25), T(0.122, 0.25), T(0.1, 0.16), T(0.07, 0.07), T(0.088, 0.0), T(-0.085, 0.0), T(-0.066, 0.07), T(-0.094, 0.16)])
    cv.disc(T(-0.07, 0.235), 0.055).disc(T(0.075, 0.235), 0.057).disc(T(-0.045, 0.0), 0.05).disc(T(0.048, 0.0), 0.05).disc(T(0.005, 0.2), 0.105 * tw + 0.02)
    tm = cv.mask()
    cv.paint(tm, SUIT, gloss=0.4, sig=8.0)
    if v == 0:      # a chevron
        cv.begin().poly([T(-0.115, 0.29), T(0.012, 0.19), T(0.125, 0.29), T(0.125, 0.235), T(0.012, 0.135), T(-0.115, 0.235)])
        cv.decal(cv.mask() * tm, mat=WHITE)
    elif v == 1:    # a ring
        cv.begin().disc(T(0.015, 0.185), 0.062)
        ring = cv.mask()
        cv.begin().disc(T(0.015, 0.185), 0.032)
        cv.decal(ring * (1.0 - cv.mask()) * tm, mat=WHITE)
    else:           # a lozenge, and a stripe down from it
        cv.begin().poly([T(0.015, 0.265), T(0.07, 0.19), T(0.015, 0.115), T(-0.04, 0.19)]).poly([T(-0.004, 0.13), T(0.034, 0.13), T(0.034, 0.06), T(-0.004, 0.06)])
        cv.decal(cv.mask() * tm, mat=WHITE)
    cv.begin().poly([T(-0.14, 0.02), T(0.14, 0.02), T(0.14, 0.06), T(-0.14, 0.06)])
    cv.decal(cv.mask() * tm, mat=WHITE)                                              # belt
    cv.begin().poly([T(-0.14, 0.008), T(0.14, 0.008), T(0.14, 0.02), T(-0.14, 0.02)])
    cv.decal(cv.mask() * tm, mul=0.45)
    cv.begin().poly([T(-0.012, 0.014), T(0.05, 0.014), T(0.05, 0.066), T(-0.012, 0.066)])
    cv.decal(cv.mask() * tm, mat=GOLD, spec=1.0)                                     # buckle
    cv.begin().cap(T(0.0, 0.26), j["head"] - hu * 0.04, 0.036, 0.034)
    cv.paint(cv.mask(), SUIT, gloss=0.2, sig=3.0, dim=0.55)                          # neck
    draw_leg(cv, j, "B", 1.0)
    # helmet
    hr = np.array([hu[1], -hu[0]])
    H = lambda x, y: j["head"] + hr * x + hu * y
    ha = math.atan2(hu[1], hu[0]) - math.pi / 2
    vx, vw = 0.034 * look, 0.046 * (0.5 + 0.5 * abs(look))
    cv.begin().ell(j["head"], 0.08, 0.086, ha).ell(H(0.016 * look, -0.047), 0.058, 0.046, ha)
    if v == 0:      # a fin from brow to nape
        cv.poly([H(0.03 * look, 0.07), H(-0.012 * look, 0.118), H(-0.07 * look, 0.085), H(-0.06 * look, 0.03)])
    elif v == 2:    # a peak over the brow and a jutting chin guard
        cv.poly([H(0.03 * look, 0.085), H(0.1 * look, 0.05), H(0.05 * look, 0.035)]).poly([H(0.02 * look, -0.05), H(0.085 * look, -0.075), H(0.03 * look, -0.095)])
    hm = cv.mask()
    cv.paint(hm, SUIT, gloss=0.95, sig=6.5)
    if v == 0:
        cv.begin().poly([H(0.026 * look, 0.074), H(-0.012 * look, 0.112), H(-0.062 * look, 0.084), H(-0.03 * look, 0.06)])
        cv.decal(cv.mask() * hm, mat=WHITE)
        cv.begin().poly([H(vx - vw, 0.036), H(vx + vw, 0.036), H(vx + vw, -0.004), H(vx, -0.022), H(vx - vw, -0.004)])
    elif v == 1:    # ear discs and a round visor
        cv.begin().disc(H(-0.03 * look, 0.0), 0.03)
        cv.decal(cv.mask() * hm, mat=WHITE)
        cv.begin().ell(H(vx, 0.01), vw * 0.95, 0.034, ha)
    else:           # a slanted slit
        cv.begin().poly([H(vx - vw, 0.03), H(vx + vw, 0.044), H(vx + vw, 0.012), H(vx - vw, -0.004)])
    vm = cv.mask() * hm
    cv.decal(vm, mat=VISOR)
    cv.begin().cap(H(vx - vw * 0.5, 0.022), H(vx - vw * 0.05, 0.026), 0.007, 0.005)
    cv.decal(cv.mask() * vm, spec=1.4)                                               # the glint on the visor
    cv.begin().ell(H(vx + 0.003 * look, -0.042), 0.027 * (0.55 + 0.45 * abs(look)), 0.016, ha)
    cv.decal(cv.mask() * hm, mat=WHITE, mul=0.85)                                    # mouthpiece
    draw_arm(cv, j, "B", 1.0, p["open"])
    return j


def arc(cv, c, r0, r1, a0, a1, n=14):
    """A swoosh: a crescent from angle a0 (thin) to a1 (thick), the trail of a fast limb."""
    outer = [c + r1 * np.array([math.cos(a0 + (a1 - a0) * i / n), math.sin(a0 + (a1 - a0) * i / n)]) for i in range(n + 1)]
    inner = [c + (r0 + (r1 - r0) * (1.0 - i / n) * 0.92) * np.array([math.cos(a0 + (a1 - a0) * i / n), math.sin(a0 + (a1 - a0) * i / n)]) for i in range(n + 1)]
    cv.begin().poly(outer + inner[::-1])
    return cv.mask()


def hero_frame(p, v, prev=None, fx=None):
    cv = Canvas(CELL, CELL, HPX, (CELL // 2, CELL - 12), 0.47)
    if prev is not None:
        # smear: where the limbs were half a frame ago, under the figure
        j = joints(mixp(prev, p, 0.5))
        for s in ("A", "B"):
            draw_arm(cv, j, s, 0.6, p["open"])
            draw_leg(cv, j, s, 0.6)
    j = draw_hero(cv, p, v)
    if fx is not None:
        fx(cv, j)
    return cv.data_image()


def fx_frame(kind, i):
    """The energy bolt in flight: a white core in a shell of the hero's colour."""
    cv = Canvas(CELL, CELL, HPX, (CELL // 2, CELL // 2), 0.47)
    wob = 0.04 * math.sin(i * 1.7)
    cv.begin().cap((0.2, 0.0), (-0.5, wob), 0.14 + 0.02 * (i % 2), 0.02)
    cv.fx.append((cv.mask(), FX, 2))
    cv.begin().cap((0.2, 0.0), (-0.25, wob * 0.5), 0.1, 0.02)
    cv.fx.insert(0, (cv.mask(), FX, 3))
    cv.begin().disc((0.21, 0.0), 0.065 + 0.012 * (i % 2))
    cv.fx.insert(0, (cv.mask(), FX, 5))
    return cv.data_image()


def atlas(frames, cols, rows):
    w, h = frames[0].size
    im = Image.new("RGBA", (cols * w, rows * h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        im.paste(f, ((i % cols) * w, (i // cols) * h))
    return im


def build_heroes():
    for v in range(3):
        fr = []
        add = lambda p, prev=None, fx=None: fr.append(hero_frame(p, v, prev, fx))
        for i in range(8):                                                     # 0-7 stance, breathing
            br = math.sin(2 * math.pi * i / 8)
            add(dict(GUARD, kneeA=0.5 + 0.08 * br, kneeB=0.85 + 0.1 * br, elA=2.0 - 0.07 * br, shB=1.15 + 0.07 * br, lean=0.14 + 0.02 * br))
        for i in range(8):                                                     # 8-15 walk
            add(run_pose(2 * math.pi * i / 8, 1.0, 0.45))
        for i in range(12):                                                    # 16-27 run
            add(run_pose(2 * math.pi * i / 12))
        for i in range(12):                                                    # 28-39 run, looking back
            add(run_pose(2 * math.pi * i / 12, -1.0))
        dv = [dive_pose(i / 11) for i in range(12)]                            # 40-51 flip
        for i, p in enumerate(dv):
            add(p, dv[i - 1] if 0 < i < 11 else None)
        for i in range(6):                                                     # 52-57 skid stop
            t = i / 5
            p = mixp(run_pose(1.9), SKID, back_out(t * 1.2))
            for k in ("shA", "elA", "shB", "elB"):
                p[k] = mixp(run_pose(1.9), SKID, ease(t * 1.4 - 0.4))[k]
            add(p)
        kn = [keys(KNOCK, i / 7) for i in range(8)]                            # 58-65 knocked down
        for i, p in enumerate(kn):
            add(p, kn[i - 1] if 0 < i < 5 else None)
        for i in range(10):                                                    # 66-75 getting up
            add(keys(GETUP, i / 9))
        rc = [roll_call(v, i / 11) for i in range(12)]                         # 76-87 roll-call pose
        for i, p in enumerate(rc):
            add(p, rc[i - 1] if 3 <= i <= 6 else None)
        pc = [keys(PUNCH, i / 7, snap) for i in range(8)]                      # 88-95 jab, cross
        for i, p in enumerate(pc):
            def sw(cv, j, i=i):
                if i in (1, 5):                                                # a short white streak behind the fist
                    w = j["wrB"] if i == 1 else j["wrA"]
                    cv.begin().cap(w - np.array([0.03, 0.0]), w - np.array([0.26, -0.01]), 0.03, 0.004)
                    cv.fx.append((cv.mask(), FX, 5))
            add(p, pc[i - 1] if i in (1, 5) else None, sw)
        kc = [keys(KICK, i / 7, snap) for i in range(8)]                       # 96-103 roundhouse
        for i, p in enumerate(kc):
            def sw(cv, j, i=i):
                if i in (3, 4):                                                # the arc the boot has just cut
                    c = j["hipB"]
                    a1 = math.atan2(j["toeB"][1] - c[1], j["toeB"][0] - c[0])
                    cv.fx.append((arc(cv, c, 0.36, 0.56, a1 + (1.9 if i == 3 else 1.1), a1 + 0.08), FX, 5 if i == 3 else 3))
            add(p, kc[i - 1] if i == 3 else None, sw)
        fk = [keys(FKICK, i / 7, snap) for i in range(8)]                      # 104-111 flying kick
        for i, p in enumerate(fk):
            def sw(cv, j, i=i):
                if 3 <= i <= 5:                                                # speed lines off the trailing side
                    for k, (dy, ln) in enumerate(((0.62, 0.3), (0.5, 0.42), (0.38, 0.26))):
                        cv.begin().cap((-0.28, dy + 0.02 * (i % 2)), (-0.28 - ln, dy + 0.02 * (i % 2) + 0.05), 0.012, 0.003)
                        cv.fx.append((cv.mask(), FX, 5 if k == 1 else 3))
            add(p, None, sw)
        bl = [keys(BLAST, i / 9, snap) for i in range(10)]                     # 112-121 energy bolt
        for i, p in enumerate(bl):
            def sw(cv, j, i=i):
                c = 0.5 * (j["wrA"] + j["wrB"]) + np.array([0.05, 0.0])
                if 2 <= i <= 4:                                                # the charge grows between the hands
                    r = 0.035 + 0.022 * (i - 2)
                    cv.begin().disc(c, r + 0.03)
                    cv.fx.append((cv.mask(), FX, 2))
                    cv.begin().disc(c, r)
                    cv.fx.insert(0, (cv.mask(), FX, 5))
                if 5 <= i <= 6:                                                # the flash as it leaves
                    cv.begin().ell(c + np.array([0.1, 0.0]), 0.2 - 0.05 * (i - 5), 0.12 - 0.03 * (i - 5))
                    cv.fx.append((cv.mask(), FX, 3))
                    cv.begin().ell(c + np.array([0.08, 0.0]), 0.12, 0.07)
                    cv.fx.insert(0, (cv.mask(), FX, 5))
            add(p, None, sw)
        add(TURN)                                                              # 122-123 turning round
        add(dict(TURN, lean=0.06, kneeA=0.4, kneeB=0.4))
        fr += [fx_frame("bolt", i) for i in range(4)]                          # 124-127 the bolt in flight
        atlas(fr, 16, 8).save(OUT / f"toku-hero-{v}.png", optimize=True)
        print(f"toku-hero-{v}.png: {len(fr)} frames")


# =====================================================================
# the kaiju's foot
# =====================================================================
HIDE, IVORY = 1, 2
FOOT_PAL = {
    HIDE: [(8, 9, 12), (17, 19, 23), (29, 32, 37), (46, 51, 58), (84, 93, 104)],      # charcoal, blue-grey where the light catches
    IVORY: [(60, 44, 34), (128, 104, 74), (196, 176, 134), (238, 228, 196), (255, 252, 240)],
    INK: [(5, 5, 9)],
}
FW, FH, FPX, FO = 384, 352, 170, (128, 344)   # foot cell, pixels per unit, where the heel end of the sole sits


def norm01(a):
    return (a - a.min()) / (a.max() - a.min())


def hide_bump(w, h, seed):
    """Pebbly rubber as a height map: small knobs packed close, bigger lumps under them.
    Lit from above each knob gets a bright top and a dark underside: clusters, not noise."""
    rng = np.random.default_rng(seed)
    knobs = norm01(blur((rng.random((h, w)) > 0.955).astype(np.float32), 1.9)) ** 0.7
    lumps = norm01(blur(rng.random((h, w)).astype(np.float32), 9.0))
    return (1.0 * knobs + 0.5 * smooth(0.45, 0.6, lumps)).astype(np.float32)


def foot_frame(spread, lift, squash, heel, stretch=0.0):
    """spread: toes fanned; lift: toes raised; squash: flattened by its own weight;
    heel: heel off the ground; stretch: pulled long by the speed of the fall (the smear)."""
    cv = Canvas(FW, FH, FPX, FO, 0.37)
    bump = hide_bump(FW, FH, 7)
    sy = 1.0 - 0.16 * squash + 0.2 * stretch
    tilt = 0.35 * heel
    c0 = np.array([0.55, 0.0])

    def X(x, y):                                       # squash or stretch, then rock forward on the toes
        v = np.array([x * (1.0 + 0.07 * squash - 0.05 * stretch), y * sy]) - c0
        return np.array([v[0] * math.cos(tilt) + v[1] * math.sin(tilt), -v[0] * math.sin(tilt) + v[1] * math.cos(tilt)]) + c0

    def skin(m, sig, dim=1.0):
        cv.paint(m, HIDE, gloss=0.3, sig=sig, bump=bump, kb=9.0, dim=dim * 0.92, cast=0.55, rim=0.35)

    def toe(k):
        """Four short toes side by side, the near one lowest; each ends in a long curved claw."""
        ang = -0.05 + lift * (0.5 - 0.08 * k) - 0.1 * squash
        base = np.array([0.5 - 0.1 * k, 0.17 + 0.075 * k + spread * 0.03 * k])
        d = np.array([math.cos(ang), math.sin(ang)])
        tip = base + d * (0.36 - 0.03 * k)
        r = 0.135 - 0.01 * k
        dim = 1.0 - 0.1 * k
        # the claw: three tapering joints curving down to a point, dark at the root, pale at the tip
        pts = [tip - d * 0.02]
        a = ang - 0.08
        for step, bend in ((0.14, 0.3), (0.13, 0.42), (0.11, 0.0)):
            pts.append(pts[-1] + np.array([math.cos(a), math.sin(a)]) * step)
            a -= bend
        cv.begin().cap(X(*pts[0]), X(*pts[1]), 0.092, 0.066).cap(X(*pts[1]), X(*pts[2]), 0.066, 0.036).cap(X(*pts[2]), X(*pts[3]), 0.036, 0.006)
        cm = cv.mask()
        cv.paint(cm, IVORY, gloss=0.85, sig=5.0, dim=dim, cast=0.5)
        cv.begin().disc(X(*pts[0]), 0.125)
        cv.decal(cv.mask() * cm, mul=0.5)
        cv.begin().cap(X(*base), X(*tip), r * 1.05, r).disc(X(*(base + d * 0.2 + np.array([0.0, 0.03]))), r * 1.03)
        skin(cv.mask(), 13.0, dim)

    # the leg, out of the top of the frame
    cv.begin().cap(X(-0.1, 0.9), X(-0.22, 2.6), 0.4, 0.47)
    lm = cv.mask()
    skin(lm, 30.0)
    cv.begin().cap(X(-0.4, 0.95), X(-0.53, 2.6), 0.008, 0.008)                      # the seam of the suit
    cv.decal(cv.mask() * lm, mul=0.45)
    toe(3)
    toe(2)
    toe(1)
    # the ankle: one heavy roll of rubber sagging over the foot, a smaller one above it
    cv.begin().ell(X(-0.1, 0.95), 0.45, 0.1)
    skin(cv.mask(), 11.0)
    cv.begin().ell(X(-0.07, 0.72 - 0.03 * squash), 0.53, 0.17 * (1.0 - 0.2 * squash))
    skin(cv.mask(), 15.0)
    cv.begin().cap(X(-0.5, 0.22), X(-0.72, 0.09), 0.1, 0.04)                        # heel spur
    cv.paint(cv.mask(), IVORY, gloss=0.8, sig=6.0, cast=0.5, dim=0.85)
    cv.begin().disc(X(-0.3, 0.28), 0.3).ell(X(-0.04, 0.31), 0.42, 0.31).cap(X(-0.3, 0.3), X(-0.1, 0.5), 0.3, 0.42)
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
    LATEX: [(5, 5, 6), (11, 10, 11), (19, 18, 19), (30, 28, 28), (58, 54, 52)],          # black leather, a dull sheen
    FUR: [(6, 5, 5), (13, 9, 8), (22, 15, 12), (33, 23, 17), (50, 37, 27)],
    NAIL: [(30, 26, 24), (52, 46, 42), (80, 72, 66), (112, 102, 94), (150, 140, 130)],
    INK: [(4, 3, 6)],
}
HW, HH, HPXH, HO = 288, 288, 110, (144, 144)  # hand cell, pixels per unit (wrist to fingertip = 1), where the wrist sits
# the three ways the hand points, for a hand reaching to its right (the shader mirrors it):
# down and out to grope, flatter to slam, up to shake a fist. Drawn turned, never turned afterwards
AIM = {"reach": unit([0.55, -1.0]), "slam": unit([0.9, -0.45]), "up": unit([0.25, 1.0])}


def hand_frame(curl, spread, wig, flat, aim="reach"):
    """Back of the hand, fingers pointing +x. curl 0 open .. 1 fist; flat presses it wide."""
    cv = Canvas(HW, HH, HPXH, HO, 0.38)
    d = AIM[aim]
    cv.tf = np.array([[d[0], d[1]], [d[1], -d[0]]])    # fingers along d, the thumb side kept on the inside
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
        cv.paint(dm, LATEX, gloss=0.5, sig=6.0, cast=0.5, rim=0.45)
        nd = unit(tip - mid)
        cv.begin().ell(tip - nd * 0.02, r * 0.62, r * 0.5, math.atan2(nd[1], nd[0]))
        cv.decal(cv.mask() * dm, mat=NAIL, mul=1.25)
        cv.begin().cap(base - d1 * 0.08, mid, r * 1.04, r * 0.92).disc(mid, r * 0.98)
        pm = cv.mask()
        cv.paint(pm, LATEX, gloss=0.5, sig=6.5, cast=0.5, rim=0.45)
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
    finger(np.array([0.12, -0.22 * wy]), -0.9 + 0.35 * curl - 0.3 * spread, 0.22, 0.18, 0.115, thumb=True)
    if curl > 0.6:                                     # a closed fist: the fingers go under the back of the hand
        for k in (-1, 0, 1):
            finger(np.array([0.5, 0.19 * k * wy]), fan(k), 0.27, 0.24 - 0.02 * abs(k), 0.108)
    cv.begin().ell((0.3, 0.0), 0.34, 0.3 * wy)
    pm = cv.mask()
    cv.paint(pm, LATEX, gloss=0.45, sig=20.0, cast=0.45, rim=0.45)
    for k in (-1, 0, 1):
        if curl <= 0.6:
            finger(np.array([0.5, 0.19 * k * wy]), fan(k), 0.27, 0.24 - 0.02 * abs(k), 0.108)
        else:
            cv.begin().disc(np.array([0.5, 0.19 * k * wy]) + rot(np.array([1.0, 0.0]), fan(k)) * 0.27 * (1.0 - 0.42 * curl), 0.1)
            cv.paint(cv.mask(), LATEX, gloss=0.5, sig=7.0, cast=0.5, rim=0.45)        # knuckles of the fist
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
    f = [hand_frame(0.05 + 0.05 * math.sin(i * 1.57), 0.9, math.sin(i * 1.57 + 0.5), 0.0) for i in range(4)]     # 0-3 grope
    f += [hand_frame(0.22, 0.6, 0.0, 0.5), hand_frame(0.12, 0.8, 0.0, 1.0)]                                      # 4-5 pat
    f += [hand_frame(c, 0.8 - 0.6 * c, 0.0, 0.0) for c in (0.25, 0.5, 0.78, 1.0)]                                # 6-9 grab
    f += [hand_frame(0.0, 1.0, 0.0, 0.0, "slam")]                                                                # 10 wound up
    f += [hand_frame(0.0, 1.0, 0.0, 1.0, "slam"), hand_frame(0.04, 0.95, 0.5, 0.8, "slam")]                      # 11-12 slam
    f += [hand_frame(1.0, 0.1, 0.0, 0.0, "up"), hand_frame(0.95, 0.12, 0.0, 0.0, "up")]                          # 13-14 fist
    f += [hand_frame(0.55, 0.3, 0.0, 0.0), hand_frame(0.7, 0.2, 0.0, 0.0), hand_frame(0.0, 1.0, 0.0, 0.0, "slam")]  # 15-16 withdrawing, 17 spare
    atlas(f, 6, 3).save(OUT / "toku-hand.png", optimize=True)
    print(f"toku-hand.png: {len(f)} frames")

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
