#!/usr/bin/env python3
"""Titan Hand sprite sheet, drawn pose by pose (src/engine/assets/toku-hand.png).

    python3 scripts/toku/hand.py            # writes the atlas and scripts/toku/hand.json
    python3 scripts/toku/hand.py --strip D  # also writes D/redraw_hand_3x.png

No skeleton: every key frame below is its own drawing, written as outline coordinates
(the back of the hand as a closed contour, every finger as a brush path with its own
points for that pose). The contours are filled at native resolution, lit from the top
left with a 5 tone ramp per material, and inked where forms overlap.

Hand space: origin on the wrist, u along the fingers, v towards the thumb, in pixels.
The sheet is drawn already turned the three ways titanhand.frag points the hand
(reach, slam, up) for a reach to the right: the shader mirrors it, never rotates it.
Cell layout and frame indices are the ones titanhand.frag already reads (6 x 3 of 288).
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src/engine/assets/toku-hand.png"
CELL, COLS, ROWS, SS = 288, 6, 3, 4
OX, OY = 144, 144                                   # the wrist, where the shader pins the cell
LATEX, FUR, NAIL, INK = 1, 2, 3, 9
PAL = {
    LATEX: [(6, 6, 8), (17, 16, 18), (31, 29, 31), (49, 45, 46), (74, 69, 67)],     # black leather, matte and warm
    FUR: [(8, 5, 3), (21, 12, 6), (38, 23, 12), (60, 37, 20), (90, 59, 33)],        # dark brown
    NAIL: [(20, 16, 14), (40, 33, 28), (66, 56, 47), (96, 83, 70), (138, 124, 106)],
    INK: [(4, 3, 6)],
}
# the light: from the left and a little above. The fingers point down-right, so a light on the
# top-left diagonal would run along them and flatten them; this one rakes across every pose
LIGHT = (0.83, 0.22, 0.51)
TONES = [0.03, 0.33, 0.66, 0.985]


def unit(x, y):
    n = math.hypot(x, y)
    return (x / n, y / n)


AIM = {"reach": unit(0.55, 1.0), "slam": unit(0.9, 0.45), "up": unit(0.25, -1.0)}    # image space, y down


# ---------------------------------------------------------------- drawing kit
def spline(pts, closed=False, n=28):
    """Catmull-Rom through the written points."""
    p = np.asarray(pts, float)
    if closed:
        p = np.vstack([p[-1], p, p[0], p[1]])
    else:
        p = np.vstack([p[0], p, p[-1]])
    t = np.linspace(0, 1, n, endpoint=False)[:, None]
    out = []
    for i in range(1, len(p) - 2):
        a, b, c, d = p[i - 1], p[i], p[i + 1], p[i + 2]
        out.append(0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t ** 3))
    if not closed:
        out.append(p[-2][None])
    return np.vstack(out)


def raster(fn):
    im = Image.new("L", (CELL * SS, CELL * SS), 0)
    fn(ImageDraw.Draw(im))
    a = np.asarray(im, np.float32).reshape(CELL, SS, CELL, SS).mean((1, 3)) / 255.0
    return a >= 0.5


def blob(pts):
    q = [(x * SS, y * SS) for x, y in spline(pts, True)]
    return raster(lambda d: d.polygon(q, fill=255))


def brush(path, radii):
    """A path painted with a round brush whose size changes along it: one continuous shape."""
    def fn(d):
        for (x, y), r in zip(path, radii):
            d.ellipse([(x - r) * SS, (y - r) * SS, (x + r) * SS, (y + r) * SS], fill=255)
    return raster(fn)


def line_mask(pts, width=1):
    im = Image.new("L", (CELL, CELL), 0)
    ImageDraw.Draw(im).line([(float(x), float(y)) for x, y in pts], fill=255, width=width)
    return np.asarray(im) > 0


def edt(mask):
    """Distance of every inside pixel to the outline."""
    out = np.zeros(mask.shape)
    ys, xs = np.nonzero(mask)
    if not len(ys):
        return out
    y0, y1, x0, x1 = max(ys.min() - 1, 0), min(ys.max() + 2, CELL), max(xs.min() - 1, 0), min(xs.max() + 2, CELL)
    f = np.where(mask[y0:y1, x0:x1], 1e9, 0.0)
    i = np.arange(f.shape[1])
    g = (f[:, None, :] + ((i[:, None] - i[None, :]) ** 2.0)[None]).min(2)
    j = np.arange(f.shape[0])
    h = (g.T[:, None, :] + ((j[:, None] - j[None, :]) ** 2.0)[None]).min(2).T
    out[y0:y1, x0:x1] = np.sqrt(h)
    return out


def shift(m, dx, dy, fill=False):
    o = np.full(m.shape, fill, m.dtype)
    h, w = m.shape
    o[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = m[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return o


def no_orphans(tone, mask, rounds=3):
    """A pixel with no neighbour of its own tone is noise: it joins the cluster next to it."""
    for _ in range(rounds):
        same = np.zeros(tone.shape, int)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            same += (shift(tone, dx, dy, -9) == tone) & shift(mask, dx, dy)
        lone = mask & (same == 0)
        if not lone.any():
            break
        for dx, dy in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            src = shift(tone, dx, dy, -9)
            ok = lone & shift(mask, dx, dy)
            tone = np.where(ok, src, tone)
            lone &= ~ok
    return tone


class Cel:
    """One cell: material and tone per pixel."""

    def __init__(self, aim, turn=0.0):
        dx, dy = AIM[aim]
        c, s = math.cos(turn), math.sin(turn)
        self.d = (dx * c - dy * s, dx * s + dy * c)
        self.n = (self.d[1], -self.d[0])                    # the thumb side
        self.mat = np.zeros((CELL, CELL), np.uint8)
        self.tone = np.zeros((CELL, CELL), np.int8)
        self.soft = np.zeros((CELL, CELL), bool)           # smears: never inked
        self.yy, self.xx = np.mgrid[0:CELL, 0:CELL].astype(float)

    def T(self, pts, vs=1.0):
        p = np.asarray(pts, float).reshape(-1, 2) * (1.0, vs)
        return np.stack([OX + p[:, 0] * self.d[0] + p[:, 1] * self.n[0], OY + p[:, 0] * self.d[1] + p[:, 1] * self.n[1]], 1)

    def put(self, mask, mat, tone, ink=True, cast=(2, 3)):
        """Lay a form over what is drawn: it throws a shadow down-right and gets a dark edge on that side."""
        tone = np.broadcast_to(np.asarray(tone, np.int8), mask.shape)
        old = self.mat > 0
        if cast:
            sh = shift(mask, cast[0], cast[1]) & ~mask & old & ~self.soft
            self.tone[sh] = np.maximum(self.tone[sh] - 1, 0)
        self.mat[mask] = mat
        self.tone[mask] = np.clip(tone[mask], 0, 4)
        self.soft[mask] = not ink
        if ink:
            edge = mask & ((shift(old & ~mask, -1, 0)) | (shift(old & ~mask, 0, -1)))     # an older form to the right or below
            self.tone[edge] = 0

    def outline(self):
        for _ in range(2):                                                                 # a pixel standing alone is dropped
            solid = self.mat > 0
            nb = sum(shift(solid, dx, dy).astype(int) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            self.mat[solid & (nb == 0)] = 0
        m = (self.mat > 0) & ~self.soft
        solid = self.mat > 0
        dark = m & (~shift(solid, -1, 0) | ~shift(solid, 0, -1))                           # open to the right or below
        lit = m & ~dark & (~shift(solid, 1, 0) | ~shift(solid, 0, 1))
        self.tone[lit] = np.maximum(self.tone[lit] - 1, 1)
        self.mat[dark] = INK
        self.tone[dark] = 0

    def image(self):
        arr = np.zeros((CELL, CELL, 4), np.uint8)
        for m, ramp in PAL.items():
            for k, c in enumerate(ramp):
                arr[(self.mat == m) & (self.tone == k)] = (*c, 255)
        return Image.fromarray(arr, "RGBA")


# ---------------------------------------------------------------- the hand
OPEN_PROF = ([0, 0.5, 1, 1.5, 2, 2.5, 3], [1.0, 0.92, 1.03, 0.86, 0.93, 0.8, 0.7])       # waisted between the knuckles, tapering
SHUT_PROF = ([0, 1, 2, 3], [1.0, 1.0, 0.98, 0.94])                                        # a folded finger: all knuckle


def skin(cel, palm, fingers, thumb=None, wide=1.0):
    """Back of the hand and the fingers written for this pose, as one surface.
    fingers: (four points knuckle to tip, base radius, nail size 0..1). thumb: (points, radii, nail)."""
    forms, bumps, marks, nails = [], [], [], []
    forms.append((blob(cel.T(palm, VS)), 13.0, False))
    for pts, r, nail in fingers:
        path = cel.T(spline(pts, n=40), VS)
        t = np.linspace(0, 3, len(path))
        prof = OPEN_PROF if nail > 0 else SHUT_PROF
        rad = r * wide * np.interp(t, *prof)
        forms.append((brush(path, rad), r * wide, True))
        ip = cel.T(pts, VS)
        k = ip[0] + (ip[1] - ip[0]) / np.linalg.norm(ip[1] - ip[0]) * 6
        bumps.append((k, 4.2, 4.6))                                                       # the knuckle on the back of the hand
        bumps.append((ip[1], 2.2 if nail > 0 else 3.0, 3.8))
        marks.append((ip[1], ip[2] - ip[0], r * 0.66, 2 if nail > 0 else 1))
        if nail > 0:
            bumps.append((ip[2], 1.3, 3.0))
            marks.append((ip[2], ip[3] - ip[1], r * 0.5, 1))
            nails.append((ip[3], ip[3] - ip[2], rad[-1], nail))
    if thumb:
        pts, radii, nail = thumb
        path = cel.T(spline(pts, n=40), VS)
        rad = np.interp(np.linspace(0, len(pts) - 1, len(path)), np.arange(len(pts)), radii)
        forms.append((brush(path, rad), max(radii), True))
        ip = cel.T(pts, VS)
        bumps.append((ip[1], 1.8, 4.5))
        bumps.append((ip[2], 1.2, 3.4))
        marks.append((ip[2], ip[3] - ip[1], radii[2] * 0.6, 2))
        if nail > 0:
            nails.append((ip[3], ip[3] - ip[2], radii[-1], nail))

    H = np.zeros((CELL, CELL))
    who = np.zeros((CELL, CELL), int)
    M = np.zeros((CELL, CELL), bool)
    for i, (m, R, _) in enumerate(forms):
        t = np.clip((edt(m) - 0.5) / R, 0, 1)
        h = 0.75 * R * (1 - (1 - t) ** 2) + 0.01
        sel = m & (h > H)
        H[sel] = h[sel]
        who[sel] = i
        M |= m
    for (x, y), a, s in bumps:
        H += a * np.exp(-((cel.xx - x) ** 2 + (cel.yy - y) ** 2) / (2 * s * s)) * M
    gy, gx = np.gradient(H)
    lam = (gx * LIGHT[0] + gy * LIGHT[1] + LIGHT[2]) / np.sqrt(gx * gx + gy * gy + 1)
    tone = np.digitize(lam, TONES).astype(np.int8)
    tone = no_orphans(tone, M)
    # two fingers side by side: a dark line in the valley between them
    sep = np.array([f[2] for f in forms])
    for dx, dy in ((-1, 0), (0, -1)):
        w2 = shift(who, dx, dy, 0)
        valley = M & shift(M, dx, dy) & (who != w2) & sep[who] & sep[w2]
        tone[valley] = 0
    # creases across the joints: short curved strokes, not ruled lines
    for (x, y), dv, hw, n in marks:
        dv = dv / np.linalg.norm(dv)
        nv = np.array([-dv[1], dv[0]])
        for k in range(n):
            c = np.array([x, y]) + dv * (k * 3.0 - (n - 1) * 1.5)
            arc = [c + nv * hw * s + dv * (1.6 * (1 - s * s)) for s in np.linspace(-1, 1, 7)]
            lm = line_mask(arc) & M
            tone[lm] = np.minimum(tone[lm], 1) - 1
            tone[lm & (tone < 0)] = 0
    cel.put(M, LATEX, tone)
    # the specular: two pixels on the lit shoulder of each knuckle, where the leather is stretched
    inner = M & shift(M, 2, 0) & shift(M, -2, 0) & shift(M, 0, 2) & shift(M, 0, -2)
    for (x, y), a, sg in bumps:
        if a < 2.0:
            continue
        px, py = int(round(x - sg * 0.55)), int(round(y - sg * 0.2))
        for qx, qy in ((px, py), (px, py + 1)):
            if inner[qy, qx] and cel.tone[qy, qx] >= 3:
                cel.tone[qy, qx] = 4
    for tip, dv, r, size in nails:
        nail_on(cel, M, tip, dv, r, size)
    return M


# fur: locks written row by row from the fingers back to the arm; each later row lies over the one before
#        u    [v of each lock]                     length
ROWS_FUR = [
    (10, [-27, -14, -1, 12, 25], 30),
    (-4, [-32, -20, -7, 6, 19, 31], 32),
    (-18, [-30, -16, -3, 10, 23, 32], 33),
    (-32, [-33, -21, -8, 5, 18, 30], 32),
    (-46, [-29, -15, -2, 11, 24], 31),
    (-59, [-23, -10, 3, 16], 26),
]
# per lock, cycled: turn, extra length, strand width, tone, bend
QUIRK = [(0.10, 3, 3.6, 2, 3.0), (-0.16, -3, 3.2, 3, -2.5), (0.04, 6, 4.0, 2, 2.0), (0.24, 0, 3.4, 3, 4.0), (-0.08, -5, 3.8, 2, -3.5),
         (-0.22, 4, 3.0, 3, -2.0), (0.15, -1, 3.8, 2, 2.5)]
# a lock is three strands off one root: (turn, length, side shift)
STRANDS = [(-0.3, 0.72, -2.2), (0.26, 0.82, 2.0), (0.0, 1.0, 0.0)]


def fur(cel, flat=1.0):
    core = blob(cel.T([(-66, -17), (-58, -27), (-30, -31), (0, -30), (18, -28), (27, 0), (18, 28), (0, 30), (-30, 31), (-58, 27), (-66, 17), (-69, 0)] * np.array([1, flat])))
    cel.put(core, FUR, 1, cast=(2, 3))
    k = 0
    for u, vs, ln in ROWS_FUR:
        for v in vs:
            da, dl, w, tn, bend = QUIRK[k % len(QUIRK)]
            k += 1
            a0 = 0.017 * v * flat + da                                                    # the locks fan out from the middle of the arm
            for j, (sa, sl, so) in enumerate(STRANDS):
                a = a0 + sa
                dd = np.array([math.cos(a), math.sin(a)])
                nn = np.array([-dd[1], dd[0]])
                root = np.array([u, v * flat]) + nn * so
                L = (ln + dl) * sl
                path = cel.T(spline([root - dd * 2, root + dd * L * 0.35 + nn * bend * 0.25, root + dd * L * 0.7 + nn * bend * 0.8, root + dd * L + nn * bend * 1.7], n=24))
                q = np.linspace(0, 1, len(path))
                m = brush(path, w * np.interp(q, [0, 0.3, 0.65, 1], [0.75, 1.0, 0.7, 0.3]))
                t = np.full((CELL, CELL), tn, np.int8)
                t[m & (~shift(m, 1, 0) | ~shift(m, 0, 1))] = tn + 1                       # lit edge
                t[m & (~shift(m, -1, 0) | ~shift(m, 0, -1))] = tn - 1                     # shaded edge
                cel.put(m, FUR, t, cast=(1, 2) if j == 2 else None)


def smear(cel, tips, trail):
    """What the eye keeps of a fast finger: streaks hanging in the air it came through, clear of the tip."""
    tr = np.asarray(trail, float)
    nv = np.array([-tr[1], tr[0]]) / np.linalg.norm(tr)
    for i, tip in enumerate(tips):
        p = cel.T([tip], VS)[0]
        for o, a0, a1, tn in ((-4.0, 0.45, 1.1, 1), (3.0, 0.35, 1.4, 2)):
            a = p + nv * o
            path = spline([a + tr * a0, a + tr * (a0 + a1) / 2 + nv * 1.5, a + tr * a1], n=30)
            m = brush(path, 2.3 * np.sin(np.linspace(0.2, math.pi - 0.2, len(path))))
            cel.put(m, LATEX, tn, ink=False, cast=None)


def whoosh(cel, arcs):
    """Speed lines: thin tapering strokes beside a shaken fist."""
    for pts in arcs:
        path = cel.T(spline(pts, n=30))
        m = brush(path, 2.1 * np.sin(np.linspace(0.15, math.pi - 0.15, len(path))))
        cel.put(m, LATEX, 2, ink=False, cast=None)


# ---------------------------------------------------------------- the drawings
PALM = [(-6, -25), (16, -32), (38, -37), (52, -37), (58, -27), (62, -10), (63, 8), (59, 24), (52, 35), (36, 38), (16, 35), (-6, 26)]
PALM_WIDE = [(-6, -26), (16, -35), (38, -41), (53, -41), (59, -30), (63, -11), (64, 9), (60, 27), (53, 39), (36, 42), (16, 38), (-6, 27)]
PALM_FIST = [(-6, -25), (16, -32), (36, -36), (48, -35), (54, -26), (57, -10), (58, 8), (54, 23), (47, 33), (34, 37), (16, 35), (-6, 26)]
VS = 1.16                                          # the written v, stretched: a broad ape hand
RP, RR, RM, RI = 9.8, 11.2, 11.8, 11.0                # base radius of pinky, ring, middle, index
TH = [15.5, 13.5, 11.5, 9.5]


def F(p, r, m, i):
    return [(p[:4], RP, p[4]), (r[:4], RR, r[4]), (m[:4], RM, m[4]), (i[:4], RI, i[4])]


DRAW = {
    # open, spread: the hand feeling its way
    "open": dict(aim="reach", palm=PALM, thumb=([(14, 26), (32, 44), (45, 57), (54, 68)], TH, 1), fingers=F(
        [(46, -27), (66, -37), (80, -44), (92, -49), 1], [(52, -10), (79, -16), (98, -20), (114, -23), 1],
        [(54, 8), (83, 9), (104, 9), (122, 8), 1], [(49, 25), (74, 33), (92, 39), (107, 43), 1])),
    # index and ring hook down, pinky flares, middle probes
    "grope1": dict(aim="reach", palm=PALM, thumb=([(14, 26), (34, 42), (49, 50), (61, 54)], TH, 1), fingers=F(
        [(46, -27), (64, -40), (76, -50), (86, -58), 1], [(52, -10), (77, -14), (91, -15), (99, -13), 0.6],
        [(54, 8), (83, 11), (104, 15), (122, 20), 1], [(49, 25), (72, 32), (86, 35), (94, 35), 0.6])),
    # the other pair hooks
    "grope2": dict(aim="reach", palm=PALM, thumb=([(14, 26), (30, 46), (40, 61), (46, 74)], TH, 1), fingers=F(
        [(46, -27), (64, -36), (75, -39), (82, -39), 0.6], [(52, -10), (80, -14), (100, -15), (118, -14), 1],
        [(54, 8), (81, 8), (96, 7), (105, 5), 0.6], [(49, 25), (73, 36), (90, 46), (104, 54), 1])),
    # lifted to pat: cupped, the fingers gathered and seen short
    "cup": dict(aim="reach", palm=PALM, thumb=([(14, 26), (33, 42), (47, 50), (58, 53)], TH, 1), fingers=F(
        [(46, -27), (63, -34), (74, -37), (82, -38), 0.6], [(52, -10), (75, -13), (90, -14), (101, -14), 0.6],
        [(54, 8), (78, 8), (94, 8), (106, 7), 0.6], [(49, 25), (70, 30), (84, 32), (94, 32), 0.6])),
    # the pat lands: pressed flat, splayed
    "pat": dict(aim="reach", palm=PALM_WIDE, wide=1.06, flat=1.08, thumb=([(14, 28), (28, 49), (36, 66), (40, 80)], TH, 1), fingers=F(
        [(47, -30), (64, -46), (76, -58), (86, -68), 1], [(53, -11), (80, -21), (99, -29), (115, -36), 1],
        [(55, 9), (84, 10), (106, 10), (125, 9), 1], [(50, 28), (73, 41), (90, 52), (104, 61), 1])),
    # the snatch: claw, wide, tips hooked
    "claw": dict(aim="reach", palm=PALM, thumb=([(14, 26), (30, 46), (42, 58), (48, 64)], TH, 0.7), fingers=F(
        [(46, -27), (65, -40), (76, -47), (82, -50), 0.55], [(52, -10), (80, -18), (96, -22), (104, -24), 0.55],
        [(54, 8), (84, 9), (101, 9), (110, 9), 0.55], [(49, 25), (74, 35), (89, 41), (97, 44), 0.55])),
    # closing: the fingers fold under, only their knuckles left
    "half": dict(aim="reach", palm=PALM, over=([(14, 26), (34, 40), (50, 44), (62, 42)], TH, 1), fingers=F(
        [(46, -27), (62, -33), (71, -33), (75, -31), 0], [(52, -10), (74, -13), (85, -12), (89, -10), 0],
        [(54, 8), (77, 7), (89, 6), (93, 5), 0], [(49, 25), (70, 27), (81, 24), (85, 22), 0])),
    "shut": dict(aim="reach", palm=PALM_FIST, over=([(14, 26), (36, 39), (54, 39), (66, 32)], TH, 1), whoosh=[[(88, -44), (104, -12), (100, 24)], [(100, -30), (113, -8), (110, 14)]], fingers=F(
        [(46, -27), (58, -30), (64, -29), (66, -27), 0], [(52, -10), (68, -12), (75, -11), (77, -9), 0],
        [(54, 8), (71, 7), (78, 6), (80, 5), 0], [(49, 25), (65, 25), (72, 22), (74, 20), 0])),
    # the fist: knuckle ridge, four folded fingers, the thumb locked across them
    "fist": dict(aim="reach", palm=PALM_FIST, over=([(14, 26), (36, 40), (58, 41), (73, 33)], [15.5, 13.5, 11.5, 10], 1), fingers=F(
        [(44, -27), (57, -28), (65, -27), (69, -25), 0], [(49, -10), (64, -10), (73, -9), (77, -8), 0],
        [(50, 8), (66, 8), (76, 8), (80, 8), 0], [(46, 24), (61, 24), (70, 23), (74, 21), 0])),
    # wound up over the ground: everything flung wide
    "windup": dict(aim="slam", palm=PALM_WIDE, thumb=([(14, 28), (26, 50), (31, 68), (32, 83)], TH, 1), fingers=F(
        [(47, -30), (62, -48), (72, -62), (79, -75), 1], [(53, -11), (79, -24), (97, -35), (112, -46), 1],
        [(55, 9), (85, 8), (107, 5), (126, 0), 1], [(50, 28), (74, 40), (92, 49), (108, 55), 1])),
    # coming down: the fingers leave trails
    "slam1": dict(aim="slam", palm=PALM_WIDE, smear=(-10, -30), thumb=([(14, 28), (28, 49), (37, 65), (42, 79)], TH, 1), fingers=F(
        [(47, -30), (64, -46), (77, -57), (88, -66), 1], [(53, -11), (80, -21), (100, -28), (117, -34), 1],
        [(55, 9), (84, 10), (106, 10), (125, 9), 1], [(50, 28), (73, 41), (90, 51), (105, 59), 1])),
    # landed: pressed into the ground, fat and flat
    "slam2": dict(aim="slam", palm=PALM_WIDE, wide=1.1, flat=1.1, thumb=([(14, 29), (27, 51), (34, 68), (37, 82)], [16, 14, 12, 10], 1), fingers=F(
        [(47, -31), (63, -49), (74, -62), (83, -73), 1], [(53, -11), (79, -23), (97, -32), (112, -40), 1],
        [(55, 9), (84, 11), (105, 13), (123, 14), 1], [(50, 29), (72, 44), (87, 57), (99, 68), 1])),
    # the fist shaken at the sky, two drawings
    "shake1": dict(aim="up", turn=-0.1, palm=PALM_FIST, over=([(14, 26), (36, 40), (58, 41), (73, 33)], [15.5, 13.5, 11.5, 10], 1), fingers=F(
        [(44, -27), (57, -28), (65, -27), (69, -25), 0], [(49, -10), (64, -10), (73, -9), (77, -8), 0],
        [(50, 8), (66, 8), (76, 8), (80, 8), 0], [(46, 24), (61, 24), (70, 23), (74, 21), 0]),
        whoosh=[[(40, 58), (62, 60), (84, 50)], [(52, 68), (70, 68), (86, 62)]]),
    "shake2": dict(aim="up", turn=0.1, palm=PALM_FIST, over=([(14, 26), (36, 40), (58, 41), (73, 33)], [15.5, 13.5, 11.5, 10], 1), fingers=F(
        [(44, -27), (57, -28), (65, -27), (69, -25), 0], [(49, -10), (64, -10), (73, -9), (77, -8), 0],
        [(50, 8), (66, 8), (76, 8), (80, 8), 0], [(46, 24), (61, 24), (70, 23), (74, 21), 0]),
        whoosh=[[(40, -52), (62, -54), (84, -44)], [(52, -62), (70, -62), (86, -56)]]),
    # going back in: gone slack, fingers trailing together
    "limp": dict(aim="reach", palm=PALM, thumb=([(14, 26), (34, 41), (50, 47), (62, 48)], TH, 1), fingers=F(
        [(46, -27), (63, -33), (74, -35), (83, -35), 0.6], [(52, -10), (76, -13), (92, -13), (105, -12), 0.8],
        [(54, 8), (79, 8), (97, 7), (111, 5), 0.8], [(49, 25), (71, 28), (86, 28), (98, 26), 0.6])),
    "slack": dict(aim="reach", palm=PALM, over=([(14, 26), (34, 40), (51, 43), (63, 40)], TH, 1), fingers=F(
        [(46, -27), (61, -32), (69, -32), (72, -30), 0], [(52, -10), (72, -13), (82, -12), (86, -10), 0],
        [(54, 8), (75, 7), (86, 6), (90, 5), 0], [(49, 25), (68, 27), (78, 24), (82, 22), 0])),
}

# cell -> drawing: the indices titanhand.frag reads
SHEET = ["open", "grope1", "open", "grope2", "cup", "pat",
         "claw", "half", "shut", "fist", "windup", "slam1",
         "slam2", "shake1", "shake2", "limp", "slack", "windup"]
ACTIONS = {
    "grope": {"frames": [0, 1, 2, 3], "hold": [1, 1, 1, 1], "anchor": [OX, OY]},
    "pat": {"frames": [4, 5], "hold": [1, 2], "anchor": [OX, OY]},
    "burst": {"frames": [9, 8, 7, 6], "hold": [1, 1, 1, 1], "anchor": [OX, OY]},
    "grab": {"frames": [6, 7, 8, 9], "hold": [1, 1, 1, 2], "anchor": [OX, OY]},
    "slam": {"frames": [10, 11, 12], "hold": [4, 1, 4], "anchor": [OX, OY]},
    "fist": {"frames": [9, 13, 14], "hold": [1, 1, 1], "anchor": [OX, OY]},
    "withdraw": {"frames": [15, 16], "hold": [1, 1], "anchor": [OX, OY]},
    "spare": {"frames": [17], "hold": [1], "anchor": [OX, OY]},
}


def draw(name):
    s = DRAW[name]
    cel = Cel(s["aim"], s.get("turn", 0.0))
    tips = [f[0][3] for f in s["fingers"]]
    if "smear" in s:
        smear(cel, tips, s["smear"])
    if "whoosh" in s:
        whoosh(cel, s["whoosh"])
    skin(cel, s["palm"], s["fingers"], s.get("thumb"), s.get("wide", 1.0))
    if "over" in s:                                    # a thumb closed over the folded fingers: its own form, on top
        pts, radii, nail = s["over"]
        skin_thumb(cel, pts, radii, nail)
    fur(cel, s.get("flat", 1.0))
    cel.outline()
    return cel


def skin_thumb(cel, pts, radii, nail):
    path = cel.T(spline(pts, n=40), VS)
    rad = np.interp(np.linspace(0, len(pts) - 1, len(path)), np.arange(len(pts)), radii)
    m = brush(path, rad)
    R = max(radii)
    t = np.clip((edt(m) - 0.5) / R, 0, 1)
    H = (0.75 * R * (1 - (1 - t) ** 2)) * m
    ip = cel.T(pts, VS)
    for (x, y), a, sg in ((ip[1], 1.8, 4.5), (ip[2], 1.4, 3.4)):
        H += a * np.exp(-((cel.xx - x) ** 2 + (cel.yy - y) ** 2) / (2 * sg * sg)) * m
    gy, gx = np.gradient(H)
    lam = (gx * LIGHT[0] + gy * LIGHT[1] + LIGHT[2]) / np.sqrt(gx * gx + gy * gy + 1)
    tone = no_orphans(np.digitize(lam, TONES).astype(np.int8), m)
    dv = (ip[3] - ip[1]) / np.linalg.norm(ip[3] - ip[1])
    nv = np.array([-dv[1], dv[0]])
    for k in (-1.5, 1.5):
        lm = line_mask([ip[2] + dv * k + nv * radii[2] * 0.6 * q + dv * 1.6 * (1 - q * q) for q in np.linspace(-1, 1, 7)]) & m
        tone[lm] = 0
    # the root of the thumb grows out of the hand: no edge there, only where it lies on the fingers
    rootless = m & (np.hypot(cel.xx - ip[0][0], cel.yy - ip[0][1]) < R + 5)
    before = cel.tone.copy()
    cel.put(m, LATEX, tone, cast=(2, 3))
    keep = rootless & (cel.tone == 0) & (tone != 0)
    cel.tone[keep] = np.maximum(before[keep], tone[keep])
    if nail > 0:
        nail_on(cel, m, ip[3], ip[3] - ip[2], radii[-1], nail)


def nail_on(cel, M, tip, dv, r, size):
    """A broad dark nail bedded in the end joint: squared off, lit edge, two bright pixels."""
    dv = dv / np.linalg.norm(dv)
    nv = np.array([-dv[1], dv[0]])
    c = tip - dv * r * 0.3
    shape = [(-0.8, -0.5), (-0.9, 0), (-0.8, 0.5), (0, 0.62), (0.6, 0.56), (0.74, 0), (0.6, -0.56), (0, -0.62)]
    nm = blob([c + dv * a * r * size + nv * b * r for a, b in shape]) & M
    nm &= shift(M, 1, 0) & shift(M, -1, 0) & shift(M, 0, 1) & shift(M, 0, -1)             # never on the outline
    if nm.sum() < 8:
        return
    cut = M & ~nm & (shift(nm, 1, 0) | shift(nm, -1, 0) | shift(nm, 0, 1) | shift(nm, 0, -1))
    cel.tone[cut] = 0                                                                     # the cuticle
    nt = np.full((CELL, CELL), 2, np.int8)
    nt[nm & (~shift(nm, 1, 0) | ~shift(nm, 0, 1))] = 3                                    # lit edge, top left
    nt[nm & (~shift(nm, -1, 0) | ~shift(nm, 0, -1))] = 1
    ys, xs = np.nonzero(nm)
    sx, sy = int(round(xs.mean() - r * 0.22)), int(round(ys.mean() - r * 0.22))
    for px, py in ((sx, sy), (sx + 1, sy)):
        if nm[py, px]:
            nt[py, px] = 4
    cel.put(nm, NAIL, nt, ink=False, cast=None)


def check(cel, name):
    """Self-check: the drawing stays inside its cell and carries no stray pixel."""
    solid = cel.mat > 0
    assert solid.any(), name
    assert not (solid[0].any() or solid[-1].any() or solid[:, 0].any() or solid[:, -1].any()), f"{name} touches the cell edge"
    nb = sum(shift(solid, dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    assert not (solid & (nb == 0)).any(), f"{name} has an orphan pixel"


def main():
    cels = {}
    for name in dict.fromkeys(SHEET):
        cels[name] = draw(name)
        check(cels[name], name)
    sheet = Image.new("RGBA", (COLS * CELL, ROWS * CELL), (0, 0, 0, 0))
    for i, name in enumerate(SHEET):
        sheet.paste(cels[name].image(), ((i % COLS) * CELL, (i // COLS) * CELL))
    sheet.save(OUT, optimize=True)
    table = {"cell": [CELL, CELL], "cols": COLS, "drawings": SHEET, "actions": ACTIONS}
    (Path(__file__).with_suffix(".json")).write_text(json.dumps(table, indent=1) + "\n")
    print(f"{OUT.name}: {len(SHEET)} cells, {len(cels)} drawings")
    if "--strip" in sys.argv:
        d = Path(sys.argv[sys.argv.index("--strip") + 1])
        bg = Image.new("RGBA", sheet.size, (96, 104, 120, 255))
        bg.alpha_composite(sheet)
        bg.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save(d / "redraw_hand_3x.png")
        bg.save(d / "redraw_hand_1x.png")


if __name__ == "__main__":
    main()
