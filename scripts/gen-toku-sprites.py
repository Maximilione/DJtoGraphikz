#!/usr/bin/env python3
"""Draws the pixel-art sprite sheets of the tokusatsu scenes (Titan Hand, Kaiju Stomp, Robo vs Kaiju).

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
    python3 scripts/gen-toku-sprites.py heroes     # or: foot, hand, duel

Output, in src/engine/assets:
  toku-hero-0/1/2.png  2304 x 1152 each, 16 x 8 cells of 144 px, a hero is 95 px
                   tall, 8 heads, lean. Three designs (helmet, visor, emblem), same moves:
                   stance 0-7, walk 8-15, run 16-27, run looking back 28-39,
                   flip 40-51, skid 52-57, knocked down 58-65, getting up 66-75,
                   roll-call pose 76-87, jab and cross 88-95, roundhouse 96-103,
                   flying kick 104-111, energy bolt 112-121, turning 122-123,
                   the bolt in flight 124-127
  toku-foot.png    1536 x 704, 4 x 2 cells of 384 x 352: coming down, coming
                   down (smear), impact, settling, planted, heel up, lifting.
                   The same foot as the kaiju of the duel, building-sized
  toku-hand.png    1728 x 864, 6 x 3 cells of 288 px: grope 0-3, pat 4-5,
                   grab 6-9, wound up 10, slam 11-12, fist 13-14, withdrawing
                   15-16. Drawn already turned the way it points

  toku-robo.png, toku-kaiju.png  2304 x 1792 each, 8 x 8 cells of 288 x 224, a
                   fighter is about 150 px tall (Robo vs Kaiju). Same moves on both
                   sheets: idle 0-3, walk 4-9, two blows 10-15, the heavy one 16-20,
                   kick 21-25, grab, lift and throw 26-31, hit 32-33, knocked down
                   34-38, getting up 39-42, block 43-44, the big move 45-52 (blade of
                   light / tail), the beam 53-57 (chest / breath), 58 fist up / roar.
                   Indexed like the heroes, R = material x 32
                   (python3 scripts/gen-toku-sprites.py duel [robo|kaiju] [frames])

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
        self.keep = np.zeros((h, w), bool)               # texture drawn pixel by pixel: the clean-up leaves it alone
        self.fx = []                                     # flat shapes with no outline: swooshes, energy
        self.fxf = []                                    # the same, in front of the figure
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

    def quad(self, a, b, wa, wb, c=0.0):
        """A plate: a box from a to b, half-widths wa and wb, corners cut by c."""
        a, b = np.asarray(a, float), np.asarray(b, float)
        u = unit(b - a)
        n = np.array([-u[1], u[0]])
        return self.poly([a + n * (wa - c), a + u * c + n * wa, b - u * c + n * wb, b + n * (wb - c),
                          b - n * (wb - c), b - u * c - n * wb, a + u * c - n * wa, a - n * (wa - c)])

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
    def paint(self, m, mat, gloss=0.3, sig=6.0, dim=1.0, cast=0.38, bump=None, kb=0.0, rim=0.55, dither=False, keep=False):
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
        self.keep[sel] = keep

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
            fix = (same == 0) & (mat > 0) & ~self.dith & ~self.keep & (cand > 0)
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

    def data_image(self, mscale=40):
        mat, lvl = self.finish()
        for m, fm, fl in self.fx:                          # behind the figure, never outlined
            sel = (m > 0.5) & (mat == 0)
            mat[sel] = fm
            lvl[sel] = fl
        for m, fm, fl in self.fxf:
            mat[m > 0.5] = fm
            lvl[m > 0.5] = fl
        arr = np.zeros((self.h, self.w, 4), np.uint8)
        arr[..., 0] = mat.astype(np.int16) * mscale * (mat > 0)
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
CELL, HPX = 144, 95                       # cell size, pixels per unit (1 unit = a hero's height, 8 heads: lean, long in the leg)
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


def held(ks, t):
    """The key drawing nearest in time: a frame is a pose that was drawn, never a blend of two."""
    return min(ks, key=lambda k: abs(k[0] - t))[1]


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


TH, SHN, FT, TORSO, UARM, FARM = 0.268, 0.268, 0.1, 0.235, 0.15, 0.148


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
    j["head"] = j["neck"] + hu * 0.07
    for s, sg in (("A", -1.0), ("B", 1.0)):
        hip = rt * 0.035 * sg
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
        low = min(j["anA"][1] - 0.034, j["toeA"][1] - 0.026, j["anB"][1] - 0.034, j["toeB"][1] - 0.026)
        if p["lie"] > 0.0:
            low = min(low, j["pel"][1] - 0.07, j["chest"][1] - 0.09, j["head"][1] - 0.07, j["wrA"][1] - 0.04, j["wrB"][1] - 0.04,
                      j["knA"][1] - 0.05, j["knB"][1] - 0.05, j["elA"][1] - 0.04, j["elB"][1] - 0.04)
    for k in j:
        if k not in ("up", "hu"):
            j[k] = j[k] - np.array([0.0, low])
    return j


def tube(cv, pts, prof):
    """A limb drawn as one form, not as two sticks hinged together: the line through pts is rounded at the
    joint and the flesh follows prof (pairs of position 0..1 along it, half-width), so it swells and tapers."""
    pts = [np.asarray(q, float) for q in pts]
    for _ in range(2):
        q = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            q += [0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b]
        pts = q + [pts[-1]]
    seg = [float(np.linalg.norm(b - a)) for a, b in zip(pts, pts[1:])]
    ts = np.concatenate([[0.0], np.cumsum(seg)]) / max(sum(seg), 1e-6)
    w = np.interp(ts, [t for t, _ in prof], [r for _, r in prof])
    for k in range(len(pts) - 1):
        if seg[k] > 1e-9:
            cv.cap(pts[k], pts[k + 1], w[k], w[k + 1])
    return cv


LEG_W = [(0.0, 0.056), (0.13, 0.064), (0.32, 0.055), (0.47, 0.041), (0.53, 0.04), (0.66, 0.048), (0.84, 0.04), (1.0, 0.037)]   # thigh, knee, calf, ankle
ARM_W = [(0.0, 0.05), (0.14, 0.05), (0.3, 0.041), (0.47, 0.033), (0.56, 0.034), (0.7, 0.04), (0.92, 0.033), (1.0, 0.033)]      # deltoid, biceps, elbow, forearm, wrist


def leg_shape(cv, j, s):
    """Adds a whole leg to the outline being drawn: thigh to toe, one line."""
    hip, kn, an, toe = j["hip" + s], j["kn" + s], j["an" + s], j["toe" + s]
    sd = unit(an - kn)
    bk = np.array([sd[1], -sd[0]])
    ft = unit(toe - an)
    tube(cv, [hip, kn + bk * -0.006, an], LEG_W)
    cv.disc(kn + sd * 0.1 + bk * 0.012, 0.04)                                     # the calf, behind
    cv.cap(kn + sd * 0.078, kn + sd * 0.096, 0.049, 0.048)                        # the turned-over top of the boot
    cv.disc(an + bk * 0.006, 0.039).cap(an + ft * 0.01, toe, 0.037, 0.028)
    return cv


def leg_trim(cv, j, s, lm):
    """What the leg wears, laid over the form without breaking it: the boot, its cuff, its sole, the knee."""
    hip, kn, an, toe = j["hip" + s], j["kn" + s], j["an" + s], j["toe" + s]
    sd = unit(an - kn)
    ft = unit(toe - an)
    fn = np.array([ft[1], -ft[0]])
    if fn[1] > 0:
        fn = -fn
    cv.begin().cap(kn + sd * 0.085, an, 0.07, 0.06).cap(an - ft * 0.03, toe + ft * 0.03, 0.06, 0.05)
    bm = cv.mask() * lm
    cv.decal(bm, mat=WHITE, mul=1.32)
    cv.begin().cap(kn + sd * 0.103, kn + sd * 0.104, 0.07, 0.07)
    cv.decal(cv.mask() * (1.0 - shift(cv.mask(), -1, 0)) * bm, mul=0.5)           # under the cuff
    cv.begin().cap(an - ft * 0.03 + fn * 0.03, toe + ft * 0.02 + fn * 0.022, 0.011, 0.01)
    cv.decal(cv.mask() * bm, mul=0.2)                                             # sole
    kf = np.array([-sd[1], sd[0]])
    cv.begin().ell(kn + kf * 0.012, 0.02, 0.026, math.atan2(sd[1], sd[0]))
    cv.decal(cv.mask() * lm * (1.0 - bm), mul=1.18)                               # the knee takes the light


def arm_shape(cv, j, s, opened):
    sh, el, wr = j["sh" + s], j["el" + s], j["wr" + s]
    fd = unit(wr - el)
    fnm = np.array([-fd[1], fd[0]])
    tube(cv, [sh, el, wr], ARM_W)
    cv.disc(sh, 0.053)
    cv.cap(el + fd * 0.05, el + fd * 0.066, 0.042, 0.041)                         # the cuff of the glove
    if opened > 0.5:
        cv.cap(wr, wr + fd * 0.068, 0.035, 0.026).cap(wr + fd * 0.01, wr + fd * 0.042 + fnm * 0.04, 0.018, 0.012)
    else:
        cv.ell(wr + fd * 0.03, 0.047, 0.04, math.atan2(fd[1], fd[0])).disc(wr + fd * 0.02 + fnm * 0.034, 0.019)
    return cv


def arm_trim(cv, j, s, am):
    sh, el, wr = j["sh" + s], j["el" + s], j["wr" + s]
    fd = unit(wr - el)
    ud = unit(el - sh)
    cv.begin().cap(el + fd * 0.056, wr + fd * 0.09, 0.07, 0.07)
    gm = cv.mask() * am
    cv.decal(gm, mat=WHITE, mul=1.32)
    cv.begin().cap(el + fd * 0.074, el + fd * 0.075, 0.07, 0.07)
    cv.decal(cv.mask() * gm, mul=0.5)
    cv.begin().ell(sh + ud * 0.02, 0.03, 0.036, math.atan2(ud[1], ud[0]))
    cv.decal(cv.mask() * am * (1.0 - gm), mul=1.15)                               # deltoid


def draw_leg(cv, j, s, dim):
    leg_shape(cv.begin(), j, s)
    lm = cv.mask()
    cv.paint(lm, SUIT, gloss=0.4, sig=5.0, dim=dim)
    leg_trim(cv, j, s, lm)


def draw_arm(cv, j, s, dim, opened):
    arm_shape(cv.begin(), j, s, opened)
    am = cv.mask()
    cv.paint(am, SUIT, gloss=0.4, sig=4.5, dim=dim)
    arm_trim(cv, j, s, am)


def draw_hero(cv, p, v):
    """v picks the helmet, the visor and the emblem: three different designs, all our own."""
    j = joints(p)
    up, hu, look = j["up"], j["hu"], p["look"]
    rt = np.array([up[1], -up[0]])
    pel = j["pel"]
    tw = 0.45 + 0.55 * abs(look)
    T = lambda x, y: pel + rt * x * tw + up * y * 0.94   # torso coordinates
    # the far arm and leg: one drawing, a tone down
    leg_shape(arm_shape(cv.begin(), j, "A", p["open"]), j, "A")
    fm = cv.mask()
    cv.paint(fm, SUIT, gloss=0.4, sig=5.0, dim=0.72)
    arm_trim(cv, j, "A", fm)
    leg_trim(cv, j, "A", fm)
    # the body and the near leg are one outline: shoulders, chest, waist, hip, thigh, down to the toe.
    # What tells chest from stomach from thigh is the modelling, not a seam
    cv.begin().poly([T(-0.116, 0.25), T(0.12, 0.25), T(0.09, 0.16), T(0.052, 0.07), T(0.07, 0.0), T(-0.067, 0.0), T(-0.049, 0.07), T(-0.085, 0.16)])
    cv.disc(T(-0.07, 0.235), 0.05).disc(T(0.075, 0.235), 0.052).disc(T(-0.034, 0.0), 0.042).disc(T(0.037, 0.0), 0.042).disc(T(0.005, 0.205), 0.09 * tw + 0.018)
    tm = cv.mask()
    leg_shape(cv, j, "B")
    bm = cv.mask()
    kB, hB = j["knB"], j["hipB"]
    qd = unit(kB - hB)
    cv.begin().ell(T(-0.046, 0.205), 0.05, 0.036, math.atan2(rt[1], rt[0])).ell(T(0.05, 0.205), 0.05, 0.036, math.atan2(rt[1], rt[0]))   # pectorals
    for y in (0.075, 0.108, 0.141):
        cv.ell(T(-0.02, y), 0.019, 0.013, math.atan2(rt[1], rt[0])).ell(T(0.024, y), 0.019, 0.013, math.atan2(rt[1], rt[0]))           # the stomach, in rows
    cv.ell(hB + qd * 0.11 + np.array([-qd[1], qd[0]]) * 0.012, 0.085, 0.03, math.atan2(qd[1], qd[0]))                                   # the thigh
    cv.paint(bm, SUIT, gloss=0.4, sig=6.5, bump=blur(cv.mask(), 1.3), kb=2.2)
    leg_trim(cv, j, "B", bm * (1.0 - tm))
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
    cv.begin().cap(T(0.0, 0.26), j["head"] - hu * 0.035, 0.03, 0.028)
    cv.paint(cv.mask(), SUIT, gloss=0.2, sig=3.0, dim=0.55)                          # neck
    # helmet
    hr = np.array([hu[1], -hu[0]])
    HS = 0.85                                          # the helmet, a notch smaller than the body would make it
    H = lambda x, y: j["head"] + (hr * x + hu * y) * HS
    ha = math.atan2(hu[1], hu[0]) - math.pi / 2
    vx, vw = 0.034 * look, 0.046 * (0.5 + 0.5 * abs(look))
    cv.begin().ell(j["head"], 0.08 * HS, 0.086 * HS, ha).ell(H(0.016 * look, -0.047), 0.058 * HS, 0.046 * HS, ha)
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
        cv.begin().disc(H(-0.03 * look, 0.0), 0.03 * HS)
        cv.decal(cv.mask() * hm, mat=WHITE)
        cv.begin().ell(H(vx, 0.01), vw * 0.95 * HS, 0.034 * HS, ha)
    else:           # a slanted slit
        cv.begin().poly([H(vx - vw, 0.03), H(vx + vw, 0.044), H(vx + vw, 0.012), H(vx - vw, -0.004)])
    vm = cv.mask() * hm
    cv.decal(vm, mat=VISOR)
    cv.begin().cap(H(vx - vw * 0.5, 0.022), H(vx - vw * 0.05, 0.026), 0.007, 0.005)
    cv.decal(cv.mask() * vm, spec=1.4)                                               # the glint on the visor
    cv.begin().ell(H(vx + 0.003 * look, -0.042), 0.027 * HS * (0.55 + 0.45 * abs(look)), 0.016 * HS, ha)
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
    cv = Canvas(CELL, CELL, HPX, (CELL // 2, CELL - 12), 0.53)
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
    cv = Canvas(CELL, CELL, HPX, (CELL // 2, CELL // 2), 0.53)
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
            br = math.sin(2 * math.pi * (i // 2) / 4)                              # four drawings, each held twice
            add(dict(GUARD, kneeA=0.5 + 0.08 * br, kneeB=0.85 + 0.1 * br, elA=2.0 - 0.07 * br, shB=1.15 + 0.07 * br, lean=0.14 + 0.02 * br))
        for i in range(8):                                                     # 8-15 walk
            add(run_pose(2 * math.pi * i / 8, 1.0, 0.45))
        for i in range(12):                                                    # 16-27 run
            add(run_pose(2 * math.pi * (i // 2) / 6))                              # six drawings, each held twice
        for i in range(12):                                                    # 28-39 run, looking back
            add(run_pose(2 * math.pi * (i // 2) / 6, -1.0))
        dv = [dive_pose(i / 11) for i in range(12)]                            # 40-51 flip
        for i, p in enumerate(dv):
            add(p, dv[i - 1] if 0 < i < 11 else None)
        for i in range(6):                                                     # 52-57 skid stop
            t = i / 5
            p = mixp(run_pose(1.9), SKID, back_out(t * 1.2))
            for k in ("shA", "elA", "shB", "elB"):
                p[k] = mixp(run_pose(1.9), SKID, ease(t * 1.4 - 0.4))[k]
            add(p)
        kn = [held(KNOCK, i / 7) for i in range(8)]                            # 58-65 knocked down
        for i, p in enumerate(kn):
            add(p, kn[i - 1] if 0 < i < 5 else None)
        for i in range(10):                                                    # 66-75 getting up
            add(held(GETUP, i / 9))
        rc = [roll_call(v, round(i / 11 * 5) / 5) for i in range(12)]                         # 76-87 roll-call pose
        for i, p in enumerate(rc):
            add(p, rc[i - 1] if 3 <= i <= 6 else None)
        pc = [held(PUNCH, i / 7) for i in range(8)]                      # 88-95 jab, cross
        for i, p in enumerate(pc):
            def sw(cv, j, i=i):
                if i in (1, 5):                                                # a short white streak behind the fist
                    w = j["wrB"] if i == 1 else j["wrA"]
                    cv.begin().cap(w - np.array([0.03, 0.0]), w - np.array([0.26, -0.01]), 0.03, 0.004)
                    cv.fx.append((cv.mask(), FX, 5))
            add(p, pc[i - 1] if i in (1, 5) else None, sw)
        kc = [held(KICK, i / 7) for i in range(8)]                       # 96-103 roundhouse
        for i, p in enumerate(kc):
            def sw(cv, j, i=i):
                if i in (3, 4):                                                # the arc the boot has just cut
                    c = j["hipB"]
                    a1 = math.atan2(j["toeB"][1] - c[1], j["toeB"][0] - c[0])
                    cv.fx.append((arc(cv, c, 0.36, 0.56, a1 + (1.9 if i == 3 else 1.1), a1 + 0.08), FX, 5 if i == 3 else 3))
            add(p, kc[i - 1] if i == 3 else None, sw)
        fk = [held(FKICK, i / 7) for i in range(8)]                      # 104-111 flying kick
        for i, p in enumerate(fk):
            def sw(cv, j, i=i):
                if 3 <= i <= 5:                                                # speed lines off the trailing side
                    for k, (dy, ln) in enumerate(((0.62, 0.3), (0.5, 0.42), (0.38, 0.26))):
                        cv.begin().cap((-0.28, dy + 0.02 * (i % 2)), (-0.28 - ln, dy + 0.02 * (i % 2) + 0.05), 0.012, 0.003)
                        cv.fx.append((cv.mask(), FX, 5 if k == 1 else 3))
            add(p, None, sw)
        bl = [held(BLAST, i / 9) for i in range(10)]                     # 112-121 energy bolt
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
    HIDE: [(11, 12, 18), (25, 28, 37), (45, 50, 61), (73, 82, 96), (124, 136, 152)],   # charcoal, blue-grey where the light catches
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
    """The same foot the kaiju of the duel stands on (kaiju_foot), at the size of a building: a column of a leg,
    two folds of hide over the ankle, the mitt, four toes in a row each with its claw.
    spread: toes fanned; lift: toes raised; squash: flattened by its own weight;
    heel: heel off the ground; stretch: pulled long by the speed of the fall (the smear)."""
    global FBUMP
    if FBUMP is None:
        FBUMP = knob_bump(FW, FH, 8.5, 7)
    cv = Canvas(FW, FH, FPX, FO, 1.0)
    sy = 1.0 - 0.14 * squash + 0.2 * stretch
    tilt = 0.35 * heel
    c0 = np.array([0.75, 0.0])
    S = 1.18                                            # the length of the mitt, in units

    def F(x, y):                                       # squash or stretch, then rock forward on the toes
        v = np.array([x * S * (1.0 + 0.06 * squash - 0.05 * stretch), y * S * sy]) - c0
        return np.array([v[0] * math.cos(tilt) + v[1] * math.sin(tilt), -v[0] * math.sin(tilt) + v[1] * math.cos(tilt)]) + c0

    def hide(m, sig, dim=1.0, cast=0.55):
        cv.paint(m, HIDE, gloss=0.3, sig=sig, bump=FBUMP, kb=3.4, dim=0.88 * dim, cast=cast, rim=0.7, keep=True)

    kaiju_foot(cv, F, S, hide, 1.0, lift, spread, 6.0)
    cv.begin().cap(F(-0.06, 0.82), F(-0.14, 2.6), 0.37 * S, 0.43 * S)
    lm = cv.mask()
    hide(lm, 34.0)
    cv.begin().ell(F(-0.06, 0.72 - 0.02 * squash), 0.395 * S, 0.085 * S * (1.0 - 0.15 * squash), -tilt)
    hide(cv.mask(), 9.0, 1.0, 0.65)
    cv.begin().ell(F(-0.04, 0.55 - 0.03 * squash), 0.415 * S, 0.11 * S * (1.0 - 0.2 * squash), -tilt)
    hide(cv.mask(), 11.0, 1.0, 0.65)
    # dirt of the last take, up from the sole
    yy = (np.arange(FH, dtype=np.float32)[:, None] - (FO[1] - 0.22 * FPX)) / (0.22 * FPX)
    cv.light *= 1.0 - 0.25 * np.clip(yy, 0.0, 1.0)
    return cv.colour_image(FOOT_PAL)


FBUMP = None


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
    LATEX: [(4, 4, 5), (11, 10, 11), (21, 19, 20), (33, 30, 30), (46, 42, 41)],           # black leather, matte: no tone is grey
    FUR: [(8, 5, 3), (19, 11, 6), (33, 20, 11), (50, 31, 17), (74, 48, 27)],            # dark brown
    NAIL: [(26, 20, 16), (48, 38, 30), (76, 62, 50), (108, 92, 76), (150, 134, 114)],
    INK: [(4, 3, 6)],
}
HW, HH, HPXH, HO = 288, 288, 110, (144, 144)  # hand cell, pixels per unit (wrist to fingertip = 1), where the wrist sits
# the three ways the hand points, for a hand reaching to its right (the shader mirrors it):
# down and out to grope, flatter to slam, up to shake a fist. Drawn turned, never turned afterwards
AIM = {"reach": unit([0.55, -1.0]), "slam": unit([0.9, -0.45]), "up": unit([0.25, 1.0])}


def hand_frame(curl, spread, wig, flat, aim="reach"):
    """Back of the hand, fingers pointing +x. curl 0 open .. 1 fist; flat presses it wide.
    Matte black leather: fingers that swell at the knuckles and taper, creased, each with a
    nail; and a shaggy sleeve of dark brown fur, laid on lock by lock like thatch."""
    cv = Canvas(HW, HH, HPXH, HO, 0.38)
    d = AIM[aim]
    cv.tf = np.array([[d[0], d[1]], [d[1], -d[0]]])    # fingers along d, the thumb side kept on the inside
    rng = np.random.default_rng(3)
    wy = 1.0 + 0.12 * flat

    def rot(v, a):
        return np.array([v[0] * math.cos(a) - v[1] * math.sin(a), v[0] * math.sin(a) + v[1] * math.cos(a)])

    def leather(m, sig, dim=1.0):
        cv.paint(m, LATEX, gloss=0.12, sig=sig, cast=0.55, rim=0.25, dim=dim)

    def locks(n, x0, x1, half, dim, clip=None):
        """Fur: tapering locks, the ones nearer the arm laid over the ones nearer the fingers."""
        seeds = sorted(((rng.uniform(x0, x1), rng.uniform(-1.0, 1.0), rng.uniform(-0.35, 0.35), rng.uniform(0.15, 0.26), rng.uniform(0.032, 0.05), rng.uniform(0.82, 1.08))
                        for _ in range(n)), key=lambda t: -t[0])
        for x, v, a, ln, w, dm in seeds:
            root = np.array([x, v * half * wy])
            a += 0.55 * v
            dd = np.array([math.cos(a), math.sin(a)])
            nn = np.array([-dd[1], dd[0]])
            mid = root + dd * ln * 0.55 + nn * 0.02 * math.copysign(1.0, v)
            cv.begin().poly([root - nn * w, root + nn * w, mid + nn * w * 0.75, root + dd * ln, mid - nn * w * 0.75])
            m = cv.mask() if clip is None else cv.mask() * clip
            cv.paint(m, FUR, gloss=0.3, sig=4.0, cast=0.6, rim=0.5, dim=dim * dm)

    def finger(base, ang, l1, l2, r, thumb=False):
        d1 = rot(np.array([1.0, 0.0]), ang)
        mid = base + d1 * l1 * (1.0 - 0.42 * curl)
        d2 = rot(d1, (0.75 if thumb else -1.0) * (2.3 * curl + 0.22 * (1.0 - curl)))
        tip = mid + d2 * l2 * (1.0 - 0.3 * curl)
        n2 = np.array([-d2[1], d2[0]])
        # the end joint, tapering to a blunt tip, and its nail
        cv.begin().cap(mid, tip, r * 0.82, r * 0.62)
        dm = cv.mask()
        leather(dm, 5.5)
        cv.begin().ell(tip - d2 * r * 0.25, r * 0.5, r * 0.4, math.atan2(d2[1], d2[0]))
        nm = cv.mask() * dm
        cv.decal(nm, mat=NAIL, mul=1.15)
        cv.begin().cap(tip - d2 * r * 0.5 + n2 * r * 0.12, tip - d2 * r * 0.12 + n2 * r * 0.12, 0.008, 0.006)
        cv.decal(cv.mask() * nm, spec=1.25)
        # the first joint, waisted between two knuckles
        cv.begin().cap(base - d1 * 0.08, mid, r * 0.92, r * 0.78).disc(mid, r * 0.96).disc(base + d1 * 0.02, r * 1.06)
        pm = cv.mask()
        leather(pm, 6.0)
        n1 = np.array([-d1[1], d1[0]])
        for o, wd in ((-0.028, 0.62), (0.0, 0.74), (0.028, 0.6)):   # the creases over the knuckle: short, not ruled across
            q = mid + d1 * o
            cv.begin().cap(q + n1 * r * wd, q - n1 * r * wd * 0.6, 0.007, 0.007)
            cv.decal(cv.mask() * pm, mul=0.4)
        cv.begin().disc(mid - d1 * 0.004 + n1 * r * 0.2, r * 0.3)
        cv.decal(cv.mask() * pm, mul=1.25)                          # the knuckle itself takes the light

    def fan(k):
        return k * (0.14 + 0.3 * spread) * (1.0 - 0.5 * curl) + wig * 0.1 * math.sin(k * 2.3 + 1.0)

    # the fur sleeve behind the wrist: a dark core, then the locks
    cv.begin().cap((-0.34, 0.0), (0.0, 0.0), 0.25, 0.27)
    sm = cv.mask()
    cv.paint(sm, FUR, gloss=0.1, sig=20.0, cast=0.45, rim=0.3, dim=0.6)
    finger(np.array([0.12, -0.22 * wy]), -0.9 + 0.35 * curl - 0.3 * spread, 0.22, 0.18, 0.115, thumb=True)
    if curl > 0.6:                                     # a closed fist: the fingers go under the back of the hand
        for k in (-1, 0, 1):
            finger(np.array([0.5, 0.19 * k * wy]), fan(k), 0.27, 0.24 - 0.02 * abs(k), 0.108)
    cv.begin().ell((0.3, 0.0), 0.34, 0.3 * wy)
    pm = cv.mask()
    leather(pm, 20.0)
    for k in (-1, 0, 1):
        if curl <= 0.6:
            finger(np.array([0.5, 0.19 * k * wy]), fan(k), 0.27, 0.24 - 0.02 * abs(k), 0.108)
        else:
            cv.begin().disc(np.array([0.5, 0.19 * k * wy]) + rot(np.array([1.0, 0.0]), fan(k)) * 0.27 * (1.0 - 0.42 * curl), 0.1)
            leather(cv.mask(), 7.0)                    # knuckles of the fist
    locks(26, 0.02, 0.26, 0.2, 0.95)                   # over the back of the hand, short of the knuckles
    locks(70, -0.5, 0.06, 0.26, 1.0)
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

# =====================================================================
# the duel (Robo vs Kaiju): a robot combined from vehicles and a reptile
# with a nose horn, a club tail and a sail of paddles. Both our own designs
# =====================================================================
DW, DH, DPX = 288, 224, 150                            # cell, pixels per unit (1 = about a fighter's height)
DORG = {"robo": (120, 212), "kaiju": (140, 212)}        # where the feet stand in the cell
ARMR, STEEL, GUNM, TRIM, GLASS = 1, 2, 3, 4, 7         # robot: armour in the palette's colour, white plate, gunmetal, gold trim, lit glass
KHIDE, KIVORY, KBELLY, KFIN, KGLOW = 1, 2, 3, 4, 7     # kaiju: hide, horn and claw, belly plates, sail, what burns inside
D0 = dict(hipA=0.0, kneeA=0.0, hipB=0.0, kneeB=0.0, shA=0.0, elA=0.0, shB=0.0, elB=0.0, lean=0.0, head=0.0, rot=0.0,
          air=0.0, lie=0.0, dx=0.0, flatA=1.0, flatB=1.0, open=0.0, sword=0.0, blade=0.0, glow=0.0, tw=1.0,
          neck=0.0, jaw=0.0, tail=0.0, curl=0.0, flip=0.0)


def DP(base=None, **kw):
    p = dict(D0 if base is None else base)
    p.update(kw)
    return p


def rot2(v, a):
    return np.array([v[0] * math.cos(a) - v[1] * math.sin(a), v[0] * math.sin(a) + v[1] * math.cos(a)])


def settle(j, p, feet, rest, ankle):
    """Turn the body by rot, then stand it on its soles (or lie it on whatever is lowest). feet = [(knee, ankle, flat)],
    rest = [(joint, radius)] that may touch the ground when lying. Adds the frame of each foot: F<s> = (origin, x, y)."""
    c = np.array([0.0, 0.15])
    ca, sa = math.cos(p["rot"]), math.sin(p["rot"])
    R = np.array([[ca, -sa], [sa, ca]])
    for k in list(j):
        j[k] = R @ (j[k] - c) + c if k not in ("up", "rt") else R @ j[k]
    low = 1e9
    for s, (kn, an, flat) in feet.items():
        ya = unit(-unit(j[an] - j[kn]) * (1.0 - flat) + np.array([0.0, 1.0]) * flat + 1e-6)
        j["F" + s] = (j[an] - ya * ankle, np.array([ya[1], -ya[0]]), ya)
        low = min(low, j["F" + s][0][1], j[an][1] - ankle)
    if p["lie"] > 0.0:
        low = min([low] + [j[k][1] - r for k, r in rest])
    off = np.array([p["dx"], -low + p["air"]])
    for k in j:
        if k in ("up", "rt"):
            continue
        j[k] = (j[k][0] + off, j[k][1], j[k][2]) if k[0] == "F" else j[k] + off
    return j


def metal(cv, m, mat, dim=0.82, sig=2.2, cast=0.45, sheen=True):
    """A plate of armour: flat face, bevelled edge that takes the key on one side, and one stripe of sheen across it."""
    if not m.any():
        return
    cv.paint(m, mat, gloss=0.9, sig=sig, dim=dim, cast=cast, rim=0.5)
    ys, xs = np.nonzero(m > 0.5)
    if sheen and len(xs) > 90:
        yy, xx = np.mgrid[0:cv.h, 0:cv.w]
        d = (xx - xs.mean()) + (yy - ys.mean()) + 0.16 * (np.ptp(xs) + np.ptp(ys))
        cv.decal(m * (np.abs(d) < 1.6) * (cv.mat == mat), mul=1.24)


def groove(cv, a, b, m, mul=0.45, w=0.0042):
    cv.begin().cap(a, b, w, w)
    cv.decal(cv.mask() * m, mul=mul)


def fx_shape(cv, draw, front=False, levels=((1.0, 2), (0.7, 3), (0.42, 4), (0.2, 5))):
    """Energy: the same shape drawn smaller and hotter, edge colour to white core."""
    ms = []
    for k, lv in levels:
        cv.begin()
        draw(k)
        ms.append((cv.mask(), FX, lv))
    if front:
        cv.fxf += ms
    else:
        cv.fx += ms[::-1]


def fx_arc(cv, c, r0, r1, a0, a1, front=False):
    """The smear a blade or a tail leaves: thin where it was (a0), full and white where it is (a1)."""
    for k, lv in ((1.0, 2), (0.62, 3), (0.34, 5)):
        m = arc(cv, c, r1 - (r1 - r0) * k, r1, a1 + (a0 - a1) * (0.35 + 0.65 * k), a1)
        (cv.fxf if front else cv.fx).append((m, FX, lv))
    if not front:
        cv.fx[-3:] = cv.fx[-3:][::-1]


# ---------------------------------------------------------------- the robot
def robo_joints(p):
    up = np.array([math.sin(p["lean"]), math.cos(p["lean"])])
    rt = np.array([up[1], -up[0]])
    hu = np.array([math.sin(p["lean"] + p["head"]), math.cos(p["lean"] + p["head"])])
    j = {"up": up, "rt": rt, "pel": np.zeros(2), "chest": up * 0.3}
    j["head"] = j["chest"] + up * 0.065 + hu * 0.05
    j["hu"] = j["head"] + hu                              # a point, so that it turns with the rest
    for s, sg in (("A", 1.0), ("B", -1.0)):               # A is the far side and leads, B the near side
        hip = rt * 0.08 * sg - up * 0.02
        kn = hip + dn(p["hip" + s]) * 0.17
        j["hip" + s], j["kn" + s], j["an" + s] = hip, kn, kn + dn(p["hip" + s] - p["knee" + s]) * 0.2
        sh = j["chest"] + rt * 0.17 * sg * p["tw"] - up * 0.015
        el = sh + dn(p["sh" + s]) * 0.13
        j["sh" + s], j["el" + s], j["wr" + s] = sh, el, el + dn(p["sh" + s] + p["el" + s]) * 0.16
    j = settle(j, p, {"A": ("knA", "anA", p["flatA"]), "B": ("knB", "anB", p["flatB"])},
               [("pel", 0.1), ("chest", 0.17), ("head", 0.07), ("knA", 0.07), ("knB", 0.07), ("elA", 0.06), ("elB", 0.06), ("wrA", 0.07), ("wrB", 0.07)], 0.06)
    j["hu"] = unit(j["hu"] - j["head"])
    return j


def draw_robot(cv, p):
    j = robo_joints(p)
    up, rt, pel = j["up"], j["rt"], j["pel"]
    T = lambda x, y: pel + rt * x + up * y

    def leg(s, dim):
        hip, kn, an = j["hip" + s], j["kn" + s], j["an" + s]
        th, sd = unit(kn - hip), unit(an - kn)
        fr = np.array([-sd[1], sd[0]])
        cv.begin().quad(hip, kn, 0.05, 0.046, 0.012)
        metal(cv, cv.mask(), GUNM, dim * 0.78)
        cv.begin().quad(hip + th * 0.035, kn - th * 0.045, 0.068, 0.06, 0.018)
        tm = cv.mask()
        metal(cv, tm, ARMR, dim)
        groove(cv, hip + th * 0.085 - fr * 0.1, hip + th * 0.085 + fr * 0.1, tm)
        # the shin is a truck stood on its tail: a white cab flaring to the ankle, a stripe, a grille, a wheel
        cv.begin().quad(kn - sd * 0.02, an + sd * 0.035, 0.066, 0.09, 0.022)
        sm = cv.mask()
        metal(cv, sm, STEEL, dim)
        cv.begin().quad(kn + fr * 0.04, an + fr * 0.055 + sd * 0.035, 0.02, 0.024)
        cv.decal(cv.mask() * sm, mat=ARMR)
        for t in (0.035, 0.055, 0.075):
            groove(cv, kn + sd * t - fr * 0.05, kn + sd * t + fr * 0.012, sm, 0.5)
        groove(cv, an - sd * 0.035 - fr * 0.1, an - sd * 0.035 + fr * 0.1, sm)
        cv.begin().disc(an - sd * 0.085 - fr * 0.03, 0.036)
        wm = cv.mask() * sm
        cv.decal(wm, mat=GUNM, mul=0.8)
        cv.begin().disc(an - sd * 0.085 - fr * 0.03, 0.014)
        cv.decal(cv.mask() * wm, mat=STEEL, mul=1.3)
        cv.begin().quad(kn + fr * 0.035 - sd * 0.045, kn + fr * 0.035 + sd * 0.04, 0.036, 0.046, 0.016)
        metal(cv, cv.mask(), TRIM, dim, sheen=False)
        # the foot: a wedge with a white toe cap and a dark sole
        o, fx, fy = j["F" + s]
        Fp = lambda x, y: o + fx * x + fy * y
        cv.begin().poly([Fp(-0.085, 0.0), Fp(0.155, 0.0), Fp(0.17, 0.03), Fp(0.1, 0.078), Fp(-0.03, 0.1), Fp(-0.09, 0.07)])
        fm = cv.mask()
        metal(cv, fm, ARMR, dim, sig=2.0)
        cv.begin().poly([Fp(0.085, 0.0), Fp(0.2, 0.0), Fp(0.2, 0.06), Fp(0.1, 0.09)])
        cv.decal(cv.mask() * fm, mat=STEEL)
        cv.begin().poly([Fp(-0.2, -0.02), Fp(0.3, -0.02), Fp(0.3, 0.02), Fp(-0.2, 0.02)])
        cv.decal(cv.mask() * fm, mat=GUNM, mul=0.7)

    def pod(s, dim):
        c = j["sh" + s] + up * 0.03
        cv.begin().quad(c - rt * 0.088, c + rt * 0.088, 0.072, 0.072, 0.022)
        pm = cv.mask()
        metal(cv, pm, STEEL, dim, sig=2.6)
        cv.begin().quad(c - rt * 0.2 + up * 0.04, c + rt * 0.2 + up * 0.04, 0.016, 0.016)
        cv.decal(cv.mask() * pm, mat=ARMR)
        cv.begin().disc(c - up * 0.022, 0.034)
        wm = cv.mask() * pm
        cv.decal(wm, mat=GUNM, mul=0.8)
        cv.begin().disc(c - up * 0.022, 0.013)
        cv.decal(cv.mask() * wm, mat=TRIM, mul=1.3)

    def arm(s, dim):
        sh, el, wr = j["sh" + s], j["el" + s], j["wr" + s]
        fd = unit(wr - el)
        fn = np.array([-fd[1], fd[0]])
        cv.begin().quad(sh, el, 0.042, 0.04, 0.01)
        metal(cv, cv.mask(), GUNM, dim * 0.78, sheen=False)
        pod(s, dim)
        cv.begin().quad(el - fd * 0.025, wr - fd * 0.01, 0.056, 0.07, 0.018)
        fm = cv.mask()
        metal(cv, fm, ARMR, dim)
        groove(cv, el + fd * 0.01 + fn * 0.02, wr - fd * 0.03 + fn * 0.03, fm, 0.5)
        cv.begin().disc(el, 0.03)
        metal(cv, cv.mask(), TRIM, dim, sig=1.6, sheen=False)
        hand = wr + fd * 0.05
        if p["open"] > 0.5:
            cv.begin().quad(wr - fd * 0.005, wr + fd * 0.06, 0.05, 0.052, 0.012)
            for o, a in ((0.034, 0.5), (0.0, 0.15), (-0.034, -0.2)):
                b = wr + fd * 0.055 + fn * o
                cv.quad(b, b + rot2(fd, a) * 0.07, 0.016, 0.013, 0.004)
            cv.quad(wr + fn * 0.04, wr + fn * 0.04 + rot2(fd, 1.0) * 0.06, 0.016, 0.013, 0.004)
            metal(cv, cv.mask(), STEEL, dim, sig=1.6, sheen=False)
        else:
            cv.begin().quad(wr - fd * 0.005, wr + fd * 0.105, 0.06, 0.058, 0.02)
            hm = cv.mask()
            metal(cv, hm, STEEL, dim, sig=2.0)
            for t in (-0.028, 0.0, 0.028):
                groove(cv, wr + fd * 0.06 + fn * t, wr + fd * 0.12 + fn * t, hm, 0.5)
            groove(cv, wr + fd * 0.058 - fn * 0.1, wr + fd * 0.058 + fn * 0.1, hm, 0.5)
        cv.begin().quad(wr - fd * 0.04, wr - fd * 0.004, 0.078, 0.078, 0.012)
        metal(cv, cv.mask(), STEEL, dim, sig=1.8, sheen=False)
        if s == "B" and p["sword"] > 0.0:
            # the finisher: a blade of light out of a gold hilt
            bd = rot2(fd, p["blade"])
            bn = np.array([-bd[1], bd[0]])
            cv.begin().quad(hand - bd * 0.07, hand + bd * 0.035, 0.013, 0.013).quad(hand + bd * 0.035 - bn * 0.045, hand + bd * 0.035 + bn * 0.045, 0.012, 0.012)
            metal(cv, cv.mask(), TRIM, 1.0, sig=1.4, sheen=False)
            ln = 0.1 + 0.52 * p["sword"]
            fx_shape(cv, lambda k: cv.quad(hand + bd * 0.05, hand + bd * (0.05 + ln), 0.034 * k, 0.012 * k).disc(hand + bd * (0.05 + ln), 0.012 * k),
                     front=True, levels=((1.0, 2), (0.7, 3), (0.36, 5)))
            j["tip"], j["hilt"] = hand + bd * (0.05 + ln), hand
        j["fist" + s] = wr + fd * 0.1

    # exhaust stacks and the pack they rise from: a truck's, behind the shoulders
    for x0, x1, y1 in ((-0.19, -0.215, 0.47), (-0.225, -0.255, 0.43)):
        cv.begin().quad(T(x0, 0.3), T(x1, y1), 0.014, 0.013, 0.003)
        metal(cv, cv.mask(), STEEL, 0.7, sig=1.4, sheen=False)
    cv.begin().quad(T(-0.2, 0.13), T(-0.2, 0.335), 0.05, 0.05, 0.014)
    metal(cv, cv.mask(), GUNM, 0.7)
    arm("A", 0.74)
    leg("A", 0.74)
    cv.begin().poly([T(-0.115, 0.07), T(0.125, 0.07), T(0.135, -0.015), T(0.06, -0.07), T(-0.045, -0.07), T(-0.125, -0.015)])
    pm = cv.mask()
    metal(cv, pm, STEEL, 0.84)
    cv.begin().poly([T(-0.035, 0.07), T(0.055, 0.07), T(0.03, -0.07), T(-0.01, -0.07)])
    cv.decal(cv.mask() * pm, mat=TRIM)
    cv.begin().quad(T(0.008, 0.045), T(0.008, 0.15), 0.092, 0.105, 0.012)
    am = cv.mask()
    metal(cv, am, GUNM, 0.8, sheen=False)
    for y in (0.075, 0.095, 0.115):
        groove(cv, T(-0.07, y), T(0.085, y), am, 0.5)
    # the chest is the nose of the lead vehicle: windscreen across the top, the emitter in a gold ring
    cv.begin().poly([T(-0.178, 0.338), T(0.188, 0.338), T(0.204, 0.3), T(0.204, 0.205), T(0.135, 0.128), T(-0.115, 0.128), T(-0.19, 0.205), T(-0.193, 0.3)])
    cm = cv.mask()
    metal(cv, cm, ARMR, 0.86, sig=3.0)
    cv.begin().poly([T(-0.115, 0.128), T(0.135, 0.128), T(0.168, 0.165), T(-0.15, 0.165)])
    cv.decal(cv.mask() * cm, mat=STEEL)
    cv.begin().poly([T(0.0, 0.326), T(0.172, 0.326), T(0.19, 0.272), T(0.02, 0.272)])
    wm = cv.mask() * cm
    cv.decal(wm, mat=GLASS, mul=0.8)
    cv.begin().quad(T(0.03, 0.315), T(0.1, 0.315), 0.006, 0.006)
    cv.decal(cv.mask() * wm, spec=1.3)
    groove(cv, T(-0.085, 0.34), T(-0.085, 0.17), cm)
    groove(cv, T(-0.2, 0.25), T(-0.085, 0.25), cm)
    j["emb"] = T(0.075, 0.215)
    cv.begin().disc(j["emb"], 0.05)
    em = cv.mask() * cm
    cv.decal(em, mat=TRIM, mul=1.1)
    cv.begin().disc(j["emb"], 0.027)
    cv.decal(cv.mask() * em, mat=GLASS, mul=0.75 + 0.7 * p["glow"])
    cv.begin().disc(j["emb"] + np.array([-0.008, 0.008]), 0.008)
    cv.decal(cv.mask() * em, spec=1.3)
    # head: a helmet with one swept fin, an antenna, a band of visor
    hu = j["hu"]
    hr = np.array([hu[1], -hu[0]])
    H = lambda x, y: j["head"] + hr * x + hu * y
    cv.begin().quad(T(0.0, 0.32), j["head"] - hu * 0.03, 0.036, 0.034)
    metal(cv, cv.mask(), GUNM, 0.6, sheen=False)
    cv.begin().poly([H(-0.03, 0.045), H(0.034, 0.05), H(0.012, 0.085), H(-0.075, 0.15), H(-0.062, 0.085)])
    metal(cv, cv.mask(), TRIM, 0.95, sig=1.8, sheen=False)
    cv.begin().quad(H(-0.03, 0.0), H(-0.085, 0.085), 0.007, 0.005)
    metal(cv, cv.mask(), STEEL, 0.8, sig=1.2, sheen=False)
    cv.begin().poly([H(-0.058, -0.048), H(0.046, -0.048), H(0.064, -0.01), H(0.058, 0.04), H(0.03, 0.058), H(-0.042, 0.058), H(-0.064, 0.025)])
    hm = cv.mask()
    metal(cv, hm, ARMR, 0.9, sig=2.6, sheen=False)
    cv.begin().poly([H(0.004, -0.06), H(0.06, -0.06), H(0.07, -0.006), H(0.02, -0.006)])
    cv.decal(cv.mask() * hm, mat=STEEL)
    cv.begin().poly([H(0.0, 0.0), H(0.07, 0.0), H(0.066, 0.03), H(0.006, 0.03)])
    vm = cv.mask() * hm
    cv.decal(vm, mat=GLASS, mul=1.0 + 0.4 * p["glow"])
    cv.begin().quad(H(0.014, 0.02), H(0.04, 0.02), 0.005, 0.005)
    cv.decal(cv.mask() * vm, spec=1.4)
    cv.begin().disc(H(-0.03, 0.0), 0.02)
    cv.decal(cv.mask() * hm, mat=GUNM, mul=0.85)
    leg("B", 1.0)
    arm("B", 1.0)
    return j


RG = DP(hipA=0.55, kneeA=0.62, hipB=-0.12, kneeB=0.5, shA=0.75, elA=1.5, shB=-0.15, elB=2.0, lean=0.08)


def robo_frames():
    G = RG
    fr = []
    add = lambda p, fx=None: fr.append((p, fx))
    for i in range(4):                                                         # 0-3 idle: the weight settles on the knees
        br = math.sin(2 * math.pi * i / 4)
        add(DP(G, kneeA=0.62 + 0.07 * br, kneeB=0.5 + 0.08 * br, elA=1.5 - 0.06 * br, elB=2.0 - 0.05 * br, lean=0.08 + 0.012 * br))
    for i in range(6):                                                         # 4-9 walk
        ph = 2 * math.pi * i / 6
        kn = lambda x: 0.3 + 0.8 * (0.5 + 0.5 * math.cos(x + 0.6)) ** 2
        add(DP(G, hipA=0.22 + 0.42 * math.sin(ph), kneeA=kn(ph), hipB=0.22 + 0.42 * math.sin(ph + math.pi), kneeB=kn(ph + math.pi),
               shA=0.75 - 0.2 * math.sin(ph), shB=-0.15 + 0.25 * math.sin(ph), lean=0.1 + 0.02 * math.sin(2 * ph)))

    def streak(key, ln=0.3, r=0.045):
        def f(cv, j):
            w = j[key]
            fx_shape(cv, lambda k: cv.cap(w - np.array([0.02, 0.0]), w - np.array([ln, -0.012]), r * k, 0.004), levels=((1.0, 3), (0.5, 5)))
        return f

    JAB = DP(G, shA=1.52, elA=0.06, lean=0.2, dx=0.05, shB=-0.3, elB=2.1)                          # 10-15 jab, cross
    CW = DP(G, shA=0.5, elA=2.0, shB=-0.9, elB=1.9, lean=0.02, tw=0.6)
    CROSS = DP(G, shB=1.5, elB=0.05, shA=0.2, elA=2.2, lean=0.32, dx=0.12, hipB=-0.45, kneeB=0.2, hipA=0.7, kneeA=0.85, tw=-0.7)
    add(DP(G, shA=0.45, elA=2.0, lean=0.03))
    add(JAB, streak("fistA"))
    add(mixp(JAB, G, 0.2))
    add(CW)
    add(CROSS, streak("fistB"))
    add(mixp(CROSS, G, 0.25))
    HW = DP(G, shB=-1.4, elB=1.5, shA=1.1, elA=0.9, lean=-0.12, kneeA=0.8, kneeB=0.75)             # 16-20 the heavy one
    HH = DP(G, shB=1.7, elB=0.0, shA=-0.3, elA=1.6, lean=0.42, dx=0.2, hipA=0.8, kneeA=1.0, hipB=-0.6, kneeB=0.12, tw=-0.8)
    add(mixp(G, HW, 0.6))
    add(HW)
    add(HH, streak("fistB", 0.5, 0.065))
    add(DP(HH, lean=0.4))
    add(mixp(HH, G, 0.55))
    KC = DP(G, hipA=1.35, kneeA=1.8, flatA=0.0, hipB=-0.05, kneeB=0.2, lean=-0.1, shA=0.5, elA=1.8, shB=0.3, elB=1.6)   # 21-25 kick
    KH = DP(KC, hipA=1.62, kneeA=0.04, lean=-0.32, dx=0.08)

    def kick_fx(cv, j):
        c = j["hipA"]
        a1 = math.atan2(j["anA"][1] - c[1], j["anA"][0] - c[0])
        fx_arc(cv, c, 0.3, 0.5, a1 - 1.5, a1 - 0.1)
    add(KC)
    add(KH, kick_fx)
    add(DP(KH, lean=-0.3))
    add(KC)
    add(mixp(KC, G, 0.6))
    REACH = DP(G, shA=1.45, elA=0.15, shB=1.2, elB=0.3, open=1.0, lean=0.3, dx=0.16, tw=0.3, hipA=0.7, kneeA=0.8)       # 26-31 grab, lift, throw
    CL = DP(REACH, shA=1.2, elA=0.6, shB=1.0, elB=0.7, open=0.0, lean=0.22)
    LIFT = DP(G, shA=2.75, elA=0.15, shB=2.6, elB=0.2, lean=-0.12, open=1.0, kneeA=0.8, kneeB=0.7, tw=0.5, dx=0.05)
    THROW = DP(G, shA=1.3, elA=0.1, shB=1.1, elB=0.15, open=1.0, lean=0.45, dx=0.14, tw=0.3, hipB=-0.5, kneeB=0.15)
    for q in (REACH, CL, mixp(CL, LIFT, 0.6), LIFT, THROW, mixp(THROW, G, 0.5)):
        add(q)
    ST = DP(G, lean=-0.34, head=-0.3, shA=-0.5, elA=0.9, shB=-1.0, elB=0.7, hipA=0.35, kneeA=0.3, hipB=-0.45, kneeB=0.75, dx=-0.07)   # 32-33 hit
    add(ST)
    add(mixp(ST, G, 0.45))
    K1 = DP(ST, lean=-0.5, rot=0.35, air=0.12, hipA=0.7, kneeA=0.5, hipB=0.3, kneeB=0.6, flatA=0.0, flatB=0.0, dx=-0.1)                # 34-38 knocked down
    K2 = DP(K1, rot=1.0, air=0.22, dx=-0.2, shA=-1.6, shB=-2.0)
    K4 = DP(rot=1.5, lie=1.0, lean=0.05, hipA=0.5, kneeA=0.6, hipB=0.2, kneeB=0.3, shA=-1.2, elA=0.3, shB=-0.8, elB=0.4, flatA=0.0, flatB=0.0, dx=-0.28)
    K3 = DP(K4, hipA=0.9, kneeA=0.7, hipB=0.5, kneeB=0.9, air=0.05)
    for q in (K1, K2, K3, DP(K4, hipA=0.7, kneeA=0.7), K4):
        add(q)
    SIT = DP(rot=0.8, lie=1.0, lean=0.5, hipA=1.4, kneeA=1.4, hipB=1.2, kneeB=1.1, shA=-0.8, elA=0.3, shB=0.6, elB=0.8, flatA=0.0, flatB=0.0, dx=-0.24)   # 39-42 getting up
    KNEEL = DP(lean=0.35, hipA=1.3, kneeA=1.5, hipB=-0.2, kneeB=1.55, flatB=0.0, lie=1.0, shA=0.9, elA=0.6, shB=0.3, elB=0.8, dx=-0.14)
    for q in (SIT, KNEEL, DP(mixp(KNEEL, G, 0.55), lie=0.0, flatB=1.0), DP(mixp(KNEEL, G, 0.85), lie=0.0, flatB=1.0)):
        add(q)
    BL = DP(G, shA=1.25, elA=1.75, shB=0.9, elB=1.95, lean=-0.04, kneeA=0.75, kneeB=0.6, tw=0.6)                # 43-44 block
    add(BL)
    add(DP(BL, lean=-0.14, dx=-0.04, kneeB=0.75))
    # 45-52 the finisher: the blade lights at the hip, goes up, comes down through the other one
    S1 = DP(G, shB=2.4, elB=0.5, sword=1.0, blade=0.3, lean=-0.15, tw=0.2, shA=0.9, elA=1.2, kneeA=0.8, kneeB=0.7)
    S2 = DP(S1, shB=2.9, elB=0.3, blade=0.2, lean=-0.22)
    S3 = DP(G, shB=1.7, elB=0.1, blade=0.2, sword=1.0, lean=0.25, dx=0.12, tw=-0.5, shA=-0.2, elA=1.2)
    S4 = DP(G, shB=0.55, elB=0.15, blade=0.1, sword=1.0, lean=0.45, dx=0.2, tw=-0.7, hipA=0.8, kneeA=1.0, hipB=-0.6, kneeB=0.15, shA=-0.6, elA=1.0)

    def slash(a0, front=True, thin=0.0):
        def f(cv, j):
            c = j["shB"]
            a1 = math.atan2(j["tip"][1] - c[1], j["tip"][0] - c[0])
            r1 = float(np.linalg.norm(j["tip"] - c))
            fx_arc(cv, c, r1 * (0.66 + 0.26 * thin), r1 * 1.02, a1 + a0, a1, front)
        return f

    def glint(cv, j):
        for d in ((1, 0), (0, 1), (0.7, 0.7), (0.7, -0.7)):
            d = np.array(d, float)
            cv.begin().cap(j["tip"] - d * 0.07, j["tip"] + d * 0.07, 0.006, 0.006)
            cv.fxf.append((cv.mask(), FX, 5))
    add(DP(G, shB=-0.6, elB=1.3, sword=0.25, blade=1.2, lean=0.0))
    add(S1)
    add(S2, glint)
    add(S3, slash(1.7))
    add(S4, slash(2.1))
    add(S4, slash(1.2, thin=0.8))
    add(S4)
    add(DP(mixp(S4, G, 0.6), sword=0.3))
    # 53-57 the chest beam: braced, the emitter charging, then firing (the beam itself is drawn by the scene)
    B0 = DP(G, shA=-0.5, elA=0.6, shB=-0.9, elB=0.5, lean=-0.1, kneeA=0.85, kneeB=0.75)

    def charge(r, fire=False):
        def f(cv, j):
            c = j["emb"] + (np.array([0.03, 0.0]) if fire else 0.0)
            fx_shape(cv, lambda k: cv.ell(c, r * k * (1.6 if fire else 1.0), r * k), front=True)
        return f
    add(B0)
    add(DP(B0, glow=0.6), charge(0.035))
    add(DP(B0, glow=1.0, lean=-0.14), charge(0.06))
    add(DP(B0, glow=1.0, lean=0.0, shA=-0.8, shB=-1.2), charge(0.085, True))
    add(DP(B0, glow=1.0, lean=0.02, shA=-0.85, shB=-1.15), charge(0.07, True))
    add(DP(G, shA=2.7, elA=0.35, lean=-0.04, kneeA=0.5))                       # 58 fist in the air
    return fr


# ---------------------------------------------------------------- the kaiju
K_FU = 0.215                                            # the length of the mitt of its foot, in units


def knob_bump(w, h, pitch, seed):
    """Hide as a height map: small knobs packed like cobbles, each its own bump. Lit, every knob gets
    a bright pixel on top and a dark one underneath."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    sg = pitch * 0.3
    rad = int(math.ceil(sg * 2.5))
    for r in range(int(h / (pitch * 0.866)) + 2):
        for c in range(int(w / pitch) + 2):
            cx = (c + 0.5 * (r % 2) + rng.uniform(-0.22, 0.22)) * pitch
            cy = (r + rng.uniform(-0.22, 0.22)) * pitch * 0.866
            x0, x1, y0, y1 = max(int(cx) - rad, 0), min(int(cx) + rad + 1, w), max(int(cy) - rad, 0), min(int(cy) + rad + 1, h)
            if x0 >= x1 or y0 >= y1:
                continue
            yy, xx = np.mgrid[y0:y1, x0:x1]
            g = rng.uniform(0.6, 1.0) * np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * sg * sg))
            out[y0:y1, x0:x1] = np.maximum(out[y0:y1, x0:x1], g)
    return out


def kaiju_foot(cv, F, s, hide, dim=1.0, lift=0.0, spread=0.0, sig=1.0):
    """The foot, in its own coordinates (F: x to the toes, y up, the sole under the ankle at 0, 0; s = units per
    length of the mitt): a heel pad, a heavy mitt sloping down, and across its front four short toes in a row,
    the near one rearmost. Each toe is a knuckle with a long claw curving down to the ground, dark at the root."""
    cv.begin().disc(F(-0.14, 0.2), 0.2 * s).cap(F(0.0, 0.3), F(0.42, 0.21), 0.3 * s, 0.21 * s)
    hide(cv.mask(), 7.0 * sig, dim)
    for k in range(4):                                  # far to near
        b = np.array([0.82 - (0.16 + 0.03 * spread) * k, 0.115 + 0.036 * (3 - k) + 0.02 * lift])
        ang = lift * (0.55 - 0.05 * (3 - k))
        Q = lambda x, y: F(*(b + rot2(np.array([x + 0.1, y]), ang) - np.array([0.1, 0.0])))
        pts, a = [np.array([0.07, 0.0])], -0.12
        for step, bend in ((0.13, 0.42), (0.11, 0.55), (0.085, 0.0)):
            pts.append(pts[-1] + np.array([math.cos(a), math.sin(a)]) * step)
            a -= bend
        cv.begin().cap(Q(*pts[0]), Q(*pts[1]), 0.085 * s, 0.062 * s).cap(Q(*pts[1]), Q(*pts[2]), 0.062 * s, 0.034 * s).cap(Q(*pts[2]), Q(*pts[3]), 0.034 * s, 0.004 * s)
        cm = cv.mask()
        cv.paint(cm, KIVORY, gloss=0.85, sig=2.4 * sig, dim=dim, cast=0.5)
        cv.begin().disc(Q(*pts[0]), 0.11 * s)
        cv.decal(cv.mask() * cm, mul=0.42)
        cv.begin().cap(Q(-0.15, 0.05), Q(0.05, 0.0), 0.13 * s, 0.108 * s)
        hide(cv.mask(), 4.2 * sig, dim * (1.0 - 0.06 * (3 - k)))


def kaiju_joints(p):
    up = np.array([math.sin(p["lean"]), math.cos(p["lean"])])
    rt = np.array([up[1], -up[0]])
    na = p["lean"] + p["neck"]
    nd = np.array([math.sin(na), math.cos(na)])
    j = {"up": up, "rt": rt, "pel": np.zeros(2), "chest": up * 0.25, "nk": up * 0.345 + rt * 0.03}
    j["head"] = j["nk"] + nd * 0.15
    j["hd"] = j["head"] + np.array([math.cos(p["head"]), math.sin(p["head"])])
    for s, sg in (("A", 1.0), ("B", -1.0)):
        hip = rt * 0.07 * sg - up * 0.03
        kn = hip + dn(p["hip" + s]) * 0.19
        j["hip" + s], j["kn" + s], j["an" + s] = hip, kn, kn + dn(p["hip" + s] - p["knee" + s]) * 0.15
        sh = j["chest"] + rt * (0.1 if sg > 0 else 0.035) + up * 0.02
        el = sh + dn(p["sh" + s]) * 0.115
        j["sh" + s], j["el" + s], j["wr" + s] = sh, el, el + dn(p["sh" + s] + p["el" + s]) * 0.11
    q, a = np.array([-0.08, 0.0]), p["tail"]
    for i in range(8):
        j["t%d" % i] = q
        q = q + 0.098 * np.array([-math.cos(a), math.sin(a)])
        a += p["curl"]
    j = settle(j, p, {"A": ("knA", "anA", p["flatA"]), "B": ("knB", "anB", p["flatB"])},
               [("pel", 0.15), ("chest", 0.14), ("head", 0.08), ("knA", 0.08), ("knB", 0.08), ("t3", 0.08), ("t7", 0.05)], 0.5 * K_FU)
    for i in range(8):                                  # the tail drags on the ground, never through it
        j["t%d" % i] = np.array([j["t%d" % i][0], max(j["t%d" % i][1], (0.125 - 0.0135 * i) * 0.9)])
    j["hd"] = unit(j["hd"] - j["head"])
    return j


KBUMP = None


def draw_kaiju(cv, p):
    global KBUMP
    if KBUMP is None:
        KBUMP = knob_bump(DW, DH, 4.3, 11)
    if p["flip"] > 0.5:                                 # turned its back: the tail is on our side of it
        cv.tf = np.array([[-1.0, 0.0], [0.0, 1.0]])
    j = kaiju_joints(p)
    up, rt, pel = j["up"], j["rt"], j["pel"]
    T = lambda x, y: pel + rt * x + up * y
    bump = np.roll(KBUMP, (-int(round(pel[1] * DPX)), int(round(pel[0] * DPX))), (0, 1))

    def hide(m, sig, dim=1.0, cast=0.5):
        cv.paint(m, KHIDE, gloss=0.3, sig=sig, bump=bump, kb=1.7, dim=0.88 * dim, cast=cast, rim=0.9, keep=True)

    def paddle(c, d, sz, dim=1.0):
        """One plate of the sail: a round paddle on a short stem, edge to the back light."""
        n = np.array([-d[1], d[0]])
        cv.begin().ell(c + d * 0.05 * sz, 0.078 * sz, 0.05 * sz, math.atan2(d[1], d[0])).poly([c - n * 0.028 * sz, c + n * 0.028 * sz, c + d * 0.05 * sz])
        fm = cv.mask()
        cv.paint(fm, KFIN, gloss=0.6, sig=2.6, dim=dim, cast=0.5, rim=1.5)
        cv.begin().ell(c + d * 0.055 * sz, 0.045 * sz, 0.022 * sz, math.atan2(d[1], d[0]))
        cv.decal(cv.mask() * fm, mat=KGLOW if p["glow"] > 0.4 else None, mul=0.6 if p["glow"] <= 0.4 else 0.9 + 0.5 * p["glow"])

    # the tail: thick at the root, paddles down its top, a club with three spikes
    tp = [j["t%d" % i] for i in range(8)]
    tr = [0.125 - 0.0135 * i for i in range(8)]
    for i in (2, 3, 4, 5):
        d = unit(tp[i + 1] - tp[i - 1])
        paddle(tp[i] + np.array([d[1], -d[0]]) * -tr[i] * 0.75, unit(np.array([d[1], -d[0]]) * -1.0 - d * 0.5), 0.95 - 0.13 * i, 0.9)
    td = unit(tp[7] - tp[6])
    for a in (-0.9, 0.0, 0.9):
        sd = rot2(td, a)
        sn = np.array([-sd[1], sd[0]])
        cv.begin().poly([tp[7] + sd * 0.04 - sn * 0.026, tp[7] + sd * 0.04 + sn * 0.026, tp[7] + sd * 0.14])
        cv.paint(cv.mask(), KIVORY, gloss=0.8, sig=1.6, cast=0.5)
    cv.begin()
    for i in range(7):
        cv.cap(tp[i], tp[i + 1], tr[i], tr[i + 1])
    cv.disc(tp[7] + td * 0.01, 0.07)
    hide(cv.mask(), 6.0, 0.92)

    def arm(s, dim):
        sh, el, wr = j["sh" + s], j["el" + s], j["wr" + s]
        fd = unit(wr - el)
        fn = np.array([-fd[1], fd[0]])
        for o in (-0.03, 0.0, 0.03):                     # three claws, hooked
            b = wr + fd * 0.035 + fn * o
            cv.begin().poly([b - fn * 0.014, b + fn * 0.014, b + fd * 0.055 + fn * (o * 0.7 + 0.012), b + fd * 0.095 + fn * (o * 0.7 - 0.02), b + fd * 0.05 + fn * (o * 0.7 - 0.012)])
            cv.paint(cv.mask(), KIVORY, gloss=0.8, sig=1.4, dim=dim, cast=0.5)
        cv.begin().cap(sh, el, 0.052, 0.043).cap(el, wr, 0.043, 0.037).disc(wr + fd * 0.02, 0.044)
        hide(cv.mask(), 4.0, dim)
        j["fist" + s] = wr + fd * 0.1

    def leg(s, dim):
        hip, kn, an = j["hip" + s], j["kn" + s], j["an" + s]
        th = unit(kn - hip)
        o, fx, fy = j["F" + s]
        kaiju_foot(cv, lambda x, y: o + fx * x * K_FU + fy * y * K_FU, K_FU, hide, dim)
        cv.begin().cap(kn, an, 0.088, 0.074)
        hide(cv.mask(), 6.0, dim)
        cv.begin().ell(an - fy * 0.012, 0.094, 0.034, math.atan2(fx[1], fx[0]))
        hide(cv.mask(), 2.6, dim, 0.6)                   # the fold of hide over the ankle
        cv.begin().cap(hip, kn, 0.118, 0.09).ell(hip + th * 0.07 - np.array([-th[1], th[0]]) * 0.015, 0.13, 0.112, math.atan2(th[1], th[0]))
        hide(cv.mask(), 8.0, dim)

    arm("A", 0.72)
    leg("A", 0.72)
    # the sail down the back, big and small in turn
    nrt = unit(j["head"] - j["nk"])
    nb = np.array([-nrt[1], nrt[0]])
    for c, d, sz in ((T(-0.14, 0.05), -rt * 1.0 + up * 0.25, 0.8), (T(-0.15, 0.15), -rt * 1.0 + up * 0.5, 1.25), (T(-0.135, 0.25), -rt * 0.9 + up * 0.75, 0.9),
                     (T(-0.1, 0.335), -rt * 0.75 + up * 1.0, 1.3), (j["nk"] + nrt * 0.06 + nb * 0.085, nb + nrt * 0.5, 0.75)):
        paddle(c, unit(d), sz)
    cv.begin().cap(pel, j["chest"], 0.155, 0.14).disc(T(0.035, 0.08), 0.16).cap(j["chest"], j["nk"], 0.14, 0.108).cap(j["nk"], j["head"] - j["hd"] * 0.02, 0.102, 0.08)
    tm = cv.mask()
    hide(tm, 9.0)
    # belly plates: bands of paler hide down the front, throat to groin
    yy, xx = np.mgrid[0:cv.h, 0:cv.w]
    sx = -1.0 if p["flip"] > 0.5 else 1.0
    ux, uy = sx * (xx - cv.o[0]) / cv.px - pel[0], (cv.o[1] - yy) / cv.px - pel[1]
    f, hgt = ux * rt[0] + uy * rt[1], ux * up[0] + uy * up[1]
    belly = tm * (f > 0.095 - 0.07 * np.clip((hgt - 0.22) / 0.2, 0.0, 1.0)) * (hgt < 0.4) * (hgt > -0.11)
    cv.decal(belly, mat=KBELLY, mul=1.1)
    cv.decal(belly * (np.mod(hgt + 0.2, 0.052) < 0.012), mul=0.45)
    # the head: long jaws, a nose horn, two brow horns swept back, a cheek plate
    hd = j["hd"]
    hn = np.array([-hd[1], hd[0]])
    Hh = lambda x, y: j["head"] + hd * x + hn * y
    for y1, x1 in ((0.15, -0.2), (0.07, -0.19)):
        cv.begin().poly([Hh(-0.01, 0.07), Hh(-0.07, 0.04), Hh(x1 * 0.6, y1 * 0.75 + 0.01), Hh(x1, y1), Hh(x1 * 0.5, y1 * 0.9 + 0.02)])
        cv.paint(cv.mask(), KIVORY, gloss=0.8, sig=1.8, cast=0.5, dim=0.95)
    cv.begin()                                           # the collar: a fan of bone behind the skull, scalloped
    for a in (0.5, 1.05, 1.6, 2.15, 2.7):
        cv.ell(Hh(-0.03 + 0.105 * math.cos(a), -0.02 + 0.105 * math.sin(a)), 0.05, 0.036, math.atan2(hd[1], hd[0]) + a)
    cv.poly([Hh(-0.01, -0.06), Hh(0.03, 0.06)] + [Hh(-0.03 + 0.1 * math.cos(a), -0.02 + 0.1 * math.sin(a)) for a in (0.6, 1.05, 1.6, 2.15, 2.8)])
    fm = cv.mask()
    cv.paint(fm, KFIN, gloss=0.5, sig=3.0, cast=0.5, rim=1.2, dim=0.9)
    for a in (0.78, 1.33, 1.88, 2.43):
        groove(cv, Hh(-0.02, 0.0), Hh(-0.03 + 0.14 * math.cos(a), -0.02 + 0.14 * math.sin(a)), fm, 0.55)
    hinge = Hh(-0.01, -0.035)
    jd = rot2(hd, -p["jaw"] * 0.75)
    jn = np.array([-jd[1], jd[0]])
    if p["jaw"] > 0.25:                                  # what is inside: dark, or lit when it is about to fire
        cv.begin().poly([hinge, hinge + jd * 0.19, Hh(0.2, -0.03), Hh(0.05, -0.02)])
        cv.paint(cv.mask(), KGLOW, gloss=0.1, sig=2.0, dim=0.35 + 0.9 * p["glow"], cast=0.0)
        for t in (0.09, 0.125, 0.16):
            b = hinge + jd * t + jn * 0.012
            cv.begin().poly([b - jd * 0.01, b + jd * 0.01, b + jn * 0.03])
            cv.paint(cv.mask(), KIVORY, gloss=0.6, sig=1.0, cast=0.0)
            b = Hh(t + 0.035, -0.03)
            cv.begin().poly([b - hd * 0.01, b + hd * 0.01, b - hn * 0.03])
            cv.paint(cv.mask(), KIVORY, gloss=0.6, sig=1.0, cast=0.0)
    cv.begin().quad(hinge - jd * 0.03, hinge + jd * 0.205, 0.04, 0.02, 0.008)
    hide(cv.mask(), 2.6, 0.85)
    cv.begin().poly([Hh(0.185, 0.03), Hh(0.225, 0.02), Hh(0.215, 0.07), Hh(0.235, 0.125), Hh(0.2, 0.085)])
    cv.paint(cv.mask(), KIVORY, gloss=0.8, sig=1.6, cast=0.5)
    cv.begin().ell(j["head"], 0.092, 0.08, math.atan2(hd[1], hd[0])).quad(Hh(0.03, 0.012), Hh(0.235, 0.0), 0.06, 0.034, 0.014)
    hm = cv.mask()
    hide(hm, 4.5)
    cv.begin().cap(Hh(0.02, 0.05), Hh(0.085, 0.038), 0.012, 0.008)
    cv.decal(cv.mask() * hm, mul=0.3)                    # brow
    cv.begin().disc(Hh(0.05, 0.022), 0.015)
    em = cv.mask() * hm
    cv.decal(em, mat=KGLOW, spec=1.0)
    cv.begin().disc(Hh(0.047, 0.026), 0.006)
    cv.decal(cv.mask() * em, spec=1.4)
    cv.begin().disc(Hh(0.205, 0.012), 0.007)
    cv.decal(cv.mask() * hm, mul=0.3)                    # nostril
    j["mouth"] = Hh(0.2, -0.04) - jn * 0.02
    leg("B", 1.0)
    arm("B", 1.0)
    if p["flip"] > 0.5:
        for k in list(j):
            if k not in ("up", "rt", "hd") and k[0] != "F":
                j[k] = np.array([-j[k][0], j[k][1]])
        cv.tf = None
    return j


KG = DP(hipA=0.5, kneeA=0.8, hipB=-0.05, kneeB=0.5, shA=1.0, elA=0.9, shB=0.7, elB=1.2, lean=0.4, neck=0.5, head=-0.05, jaw=0.12, tail=-0.3, curl=0.11)


def kaiju_frames():
    G = KG
    fr = []
    add = lambda p, fx=None: fr.append((p, fx))
    for i in range(4):                                                         # 0-3 idle: it breathes, the tail sways
        br = math.sin(2 * math.pi * i / 4)
        add(DP(G, kneeA=0.8 + 0.06 * br, kneeB=0.5 + 0.07 * br, lean=0.4 + 0.02 * br, jaw=0.14 + 0.1 * br, curl=0.11 + 0.02 * math.cos(2 * math.pi * i / 4), elA=0.9 + 0.08 * br, elB=1.2 - 0.08 * br))
    for i in range(6):                                                         # 4-9 walk
        ph = 2 * math.pi * i / 6
        kn = lambda x: 0.35 + 0.7 * (0.5 + 0.5 * math.cos(x + 0.6)) ** 2
        add(DP(G, hipA=0.25 + 0.4 * math.sin(ph), kneeA=kn(ph), hipB=0.25 + 0.4 * math.sin(ph + math.pi), kneeB=kn(ph + math.pi),
               lean=0.42 + 0.03 * math.sin(2 * ph), curl=0.11 + 0.035 * math.sin(ph), neck=0.5 + 0.04 * math.sin(2 * ph + 1.0)))

    def rake(key):
        def f(cv, j):
            w = j[key]
            for o in (-0.035, 0.0, 0.035):
                fx_shape(cv, lambda k: cv.cap(w + np.array([0.0, o]), w + np.array([-0.24, o + 0.1]), 0.014 * k, 0.003), levels=((1.0, 3), (0.5, 5)))
        return f
    C1 = DP(G, shA=1.55, elA=0.1, lean=0.42, dx=0.06, neck=0.4, jaw=0.4)                            # 10-15 claws, left and right
    CW = DP(G, shA=0.5, elA=1.6, shB=-0.6, elB=1.5, lean=0.25, jaw=0.3)
    C2 = DP(G, shB=1.6, elB=0.1, shA=0.4, elA=1.6, lean=0.52, dx=0.13, jaw=0.6, neck=0.4, hipB=-0.3, kneeB=0.3)
    add(DP(G, shA=0.3, elA=1.7, lean=0.25))
    add(C1, rake("fistA"))
    add(mixp(C1, G, 0.2))
    add(CW)
    add(C2, rake("fistB"))
    add(mixp(C2, G, 0.25))
    HW = DP(G, lean=-0.05, neck=-0.1, head=0.55, jaw=0.5, tail=-0.55, curl=0.16, shA=-0.3, elA=1.2, shB=-0.6, elB=1.0, kneeA=1.0, kneeB=0.7)   # 16-20 the horn, head first
    HH = DP(G, lean=0.72, neck=0.75, head=-0.3, jaw=0.05, dx=0.2, hipA=0.8, kneeA=1.05, hipB=-0.5, kneeB=0.15, tail=0.1, curl=0.06, shA=-0.4, elA=0.8, shB=-0.8, elB=0.6)

    def horn(cv, j):
        w = j["mouth"] + np.array([0.02, 0.05])
        fx_shape(cv, lambda k: cv.cap(w, w + np.array([-0.4, 0.18]), 0.06 * k, 0.004), levels=((1.0, 3), (0.5, 5)))
    add(mixp(G, HW, 0.6))
    add(HW)
    add(HH, horn)
    add(DP(HH, lean=0.7))
    add(mixp(HH, G, 0.55))
    KC = DP(G, hipA=1.3, kneeA=1.6, flatA=0.0, hipB=0.0, kneeB=0.25, lean=0.12, neck=0.4, tail=-0.5, curl=0.14)        # 21-25 kick, propped on the tail
    KH = DP(KC, hipA=1.55, kneeA=0.08, lean=-0.05, dx=0.08, jaw=0.6)

    def kick_fx(cv, j):
        c = j["hipA"]
        a1 = math.atan2(j["anA"][1] - c[1], j["anA"][0] - c[0])
        fx_arc(cv, c, 0.28, 0.5, a1 - 1.5, a1 - 0.12)
    add(KC)
    add(KH, kick_fx)
    add(DP(KH, lean=-0.03))
    add(KC)
    add(mixp(KC, G, 0.6))
    REACH = DP(G, lean=0.6, neck=0.55, head=-0.1, jaw=1.0, shA=1.5, elA=0.2, shB=1.3, elB=0.3, dx=0.16, hipA=0.7, kneeA=0.95)   # 26-31 bite, lift, throw
    CL = DP(REACH, jaw=0.15, shA=1.3, elA=0.6, shB=1.1, elB=0.7, lean=0.5)
    LIFT = DP(G, lean=-0.08, neck=-0.25, head=1.0, jaw=0.2, shA=2.6, elA=0.2, shB=2.4, elB=0.3, kneeA=0.95, kneeB=0.7, tail=-0.5, curl=0.15, dx=0.05)
    THROW = DP(G, lean=0.55, neck=0.6, head=-0.25, jaw=0.9, shA=1.4, elA=0.1, shB=1.2, elB=0.2, dx=0.14, hipB=-0.4, kneeB=0.2, tail=0.15, curl=0.05)
    for q in (REACH, CL, mixp(CL, LIFT, 0.6), LIFT, THROW, mixp(THROW, G, 0.5)):
        add(q)
    ST = DP(G, lean=-0.1, neck=-0.3, head=0.6, jaw=0.8, shA=-0.6, elA=0.8, shB=-1.0, elB=0.6, hipA=0.35, kneeA=0.4, hipB=-0.4, kneeB=0.8, dx=-0.07, tail=-0.45, curl=0.2)   # 32-33 hit
    add(ST)
    add(mixp(ST, G, 0.45))
    K1 = DP(ST, lean=-0.25, rot=0.4, air=0.1, hipA=0.8, kneeA=0.6, hipB=0.4, kneeB=0.7, flatA=0.0, flatB=0.0, dx=-0.1, tail=-0.8, curl=0.1)          # 34-38 knocked down
    K2 = DP(K1, rot=1.0, air=0.2, dx=-0.2, tail=-1.2, curl=0.05, shA=-1.4, shB=-1.8)
    K4 = DP(rot=1.42, lie=1.0, lean=0.1, neck=0.25, head=1.9, jaw=0.5, hipA=0.6, kneeA=0.7, hipB=0.3, kneeB=0.4, shA=-1.0, elA=0.4, shB=-0.6, elB=0.5,
            flatA=0.0, flatB=0.0, dx=-0.16, tail=-1.45, curl=0.03)
    K3 = DP(K4, hipA=1.0, kneeA=0.8, hipB=0.6, kneeB=1.0, air=0.05, jaw=0.9)
    for q in (K1, K2, K3, DP(K4, hipA=0.8, kneeA=0.8), K4):
        add(q)
    SIT = DP(rot=0.7, lie=1.0, lean=0.4, neck=0.4, head=0.5, jaw=0.4, hipA=1.4, kneeA=1.4, hipB=1.2, kneeB=1.1, shA=-0.6, elA=0.4, shB=0.5, elB=0.8,
             flatA=0.0, flatB=0.0, dx=-0.22, tail=-0.95, curl=0.08)                                                    # 39-42 getting up
    CR = DP(G, lean=0.6, neck=0.3, head=0.1, hipA=1.0, kneeA=1.5, hipB=0.6, kneeB=1.5, shA=0.4, elA=0.8, shB=0.2, elB=0.8, dx=-0.12, tail=-0.2, curl=0.1)
    for q in (SIT, CR, mixp(CR, G, 0.55), mixp(CR, G, 0.85)):
        add(q)
    BL = DP(G, lean=0.12, neck=0.2, head=-0.45, jaw=0.0, shA=1.75, elA=1.3, shB=1.5, elB=1.5, kneeA=0.95, kneeB=0.65, tail=-0.45, curl=0.15)   # 43-44 block
    add(BL)
    add(DP(BL, lean=0.02, dx=-0.04, kneeB=0.8))
    # 45-52 the tail: it coils, turns its back and the club comes round at chest height
    W0 = DP(G, lean=0.5, neck=0.3, head=-0.2, kneeA=1.05, kneeB=0.8, tail=0.25, curl=0.3)
    TB = DP(G, flip=1.0, lean=0.45, neck=0.2, head=0.15, jaw=0.5, kneeA=0.95, kneeB=0.7, shA=0.3, shB=0.0)

    def sweep(a0, thin=0.0):
        def f(cv, j):
            c = j["t0"]
            r1 = float(np.linalg.norm(j["t7"] - c)) + 0.06
            a1 = math.atan2(j["t7"][1] - c[1], j["t7"][0] - c[0])
            fx_arc(cv, c, r1 * (0.55 + 0.35 * thin), r1, a1 + a0, a1, True)
        return f
    add(W0)
    add(DP(TB, tail=1.1, curl=-0.12, dx=0.05))
    add(DP(TB, tail=0.38, curl=-0.03, dx=0.1), sweep(1.3))
    add(DP(TB, tail=0.3, curl=-0.02, dx=0.1), sweep(0.7, 0.7))
    add(DP(TB, tail=0.12, curl=-0.01, dx=0.1))
    add(DP(TB, tail=-0.2, curl=0.08, dx=0.06))
    add(DP(W0, tail=-0.1, curl=0.2))
    add(mixp(W0, G, 0.7))
    # 53-57 the breath: it rears, the sail lights from the tail up, then the jaws open (the beam is drawn by the scene)
    I1 = DP(G, lean=0.1, neck=0.05, head=0.5, jaw=0.35, glow=0.5, kneeA=0.95, kneeB=0.7, tail=-0.45, curl=0.16)
    FI = DP(G, lean=0.5, neck=0.62, head=-0.05, jaw=1.0, glow=1.0, dx=0.05, hipA=0.7, kneeA=0.95, tail=0.0, curl=0.08, shA=0.3, shB=0.0)

    def muzzle(r):
        def f(cv, j):
            fx_shape(cv, lambda k: cv.ell(j["mouth"] + np.array([0.035, 0.0]), r * k * 1.5, r * k), front=True)
        return f
    add(I1)
    add(DP(I1, lean=0.0, neck=-0.15, head=0.65, jaw=0.55, glow=0.8))
    add(DP(I1, lean=-0.04, neck=-0.2, head=0.7, jaw=0.7, glow=1.0), lambda cv, j: fx_shape(cv, lambda k: cv.disc(j["mouth"], 0.04 * k), front=True))
    add(FI, muzzle(0.075))
    add(DP(FI, lean=0.52, jaw=0.95), muzzle(0.06))
    add(DP(G, lean=0.05, neck=-0.1, head=0.8, jaw=1.0, shA=-0.4, elA=0.9, shB=-0.8, elB=0.7, tail=-0.5, curl=0.18))    # 58 roar
    return fr


def build_duel():
    what = sys.argv[2] if len(sys.argv) > 2 else "both"
    for name, mk, draw in (("robo", robo_frames, draw_robot), ("kaiju", kaiju_frames, draw_kaiju)):
        if what not in ("both", name):
            continue
        frames = mk()
        if len(sys.argv) > 3:                               # a few frames only, while drawing
            keepf = [int(x) for x in sys.argv[3].split(",")]
            frames = [frames[i] for i in keepf]
        out = []
        for p, fx in frames:
            cv = Canvas(DW, DH, DPX, DORG[name], 1.0)
            j = draw(cv, p)
            if fx is not None:
                fx(cv, j)
            out.append(cv.data_image(32))
            if p["glow"] >= 1.0 and fx is not None:                # where the scene must start the beam
                print(f"  {name} frame {len(out) - 1}: beam leaves at {np.round(j['emb' if name == 'robo' else 'mouth'] * DPX).astype(int)} px from the feet")
        atlas(out, 8, 8).save(OUT / f"toku-{name}.png", optimize=True)
        print(f"toku-{name}.png: {len(out)} frames")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("all", "heroes"):
        build_heroes()
    if what in ("all", "foot"):
        build_foot()
    if what in ("all", "hand"):
        build_hand()
    if what in ("all", "duel"):
        build_duel()
    return 0


if __name__ == "__main__":
    sys.exit(main())
