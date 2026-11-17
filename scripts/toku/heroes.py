#!/usr/bin/env python3
"""The three suited heroes, drawn frame by frame: src/engine/assets/toku-hero-{0,1,2}.png.

No rig and no joint angles. Every key drawing below is a list of contours written by hand for
that pose, in pixels (x to the right of the feet anchor, y up from the ground): the torso as
four stations with the offset of its front and back contour, each limb as the points its
centre line passes through (the contour is offset from it with an anatomical, asymmetric
profile), swooshes and energy as closed outlines. Helmets and emblems are pixel maps typed by
hand, one set per hero. Everything is filled and shaded once, at the sprite's own resolution:
four tones and a specular per material, light from the top left, dark outline, lit edges
outlined in the material's own shadow.

The sheet keeps the layout the shaders already read (16 x 8 cells of 144 px, same first cell
per action, same number of cells): a key drawing is held over several cells, never tweened.
heroes.json describes the drawings and how long each is held.

The pixels are indexed, not coloured: R = material * 40, G = tone * 50 (1..5, ink 0).

    python3 scripts/toku/heroes.py                 writes the three atlases and heroes.json
    python3 scripts/toku/heroes.py --preview F.png also a 3x strip of every drawing
"""
import json
import math
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent.parent / "src/engine/assets"
CELL, COLS, ROWS = 144, 16, 8
OX, OY = 72, 132                          # the feet anchor in a cell (pixels, y down)
SS = 4                                    # an outline is tested on 4 x 4 points per pixel: in or out, never grey
SUIT, WHITE, VISOR, GOLD, INK, FX = 1, 2, 3, 4, 5, 6
LX, LY, LZ = -0.5, 0.62, 0.6              # the light: top left, toward the viewer


# ------------------------------------------------------------------ contours
def spline(pts, n=10):
    """Catmull-Rom through pts (k columns), n samples per span."""
    p = np.asarray(pts, float)
    q = np.vstack([p[0], p, p[-1]])
    out = []
    for i in range(len(p) - 1):
        a, b, c, d = q[i], q[i + 1], q[i + 2], q[i + 3]
        for t in np.arange(n) / n:
            out.append(0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t ** 3))
    out.append(p[-1])
    return np.array(out)


def raster(polys, discs=()):
    im = Image.new("L", (CELL * SS, CELL * SS), 0)
    d = ImageDraw.Draw(im)
    for poly in polys:
        d.polygon([((OX + x) * SS, (OY - y) * SS) for x, y in poly], fill=255)
    for x, y, r in discs:
        cx, cy = (OX + x) * SS, (OY - y) * SS
        d.ellipse([cx - r * SS, cy - r * SS, cx + r * SS, cy + r * SS], fill=255)
    a = np.asarray(im, np.float32).reshape(CELL, SS, CELL, SS).mean((1, 3))
    return a >= 127.5


YY, XX = np.mgrid[0:CELL, 0:CELL]
WX, WY = XX + 0.5 - OX, OY - (YY + 0.5)   # the centre of each pixel, in drawing coordinates


def stroke(st, logical, caps=(True, True)):
    """A contour given as stations (x, y, left offset, right offset) along a line.
    Returns mask and, per pixel, the place along the line (logical), across it (u, -1..1, +1 = left
    of travel) and the light it catches."""
    s = spline(np.column_stack([np.asarray(st, float), logical]))
    p, wl, wr, lg = s[:, :2], np.maximum(s[:, 2], 0.3), np.maximum(s[:, 3], 0.3), s[:, 4]
    d = np.gradient(p, axis=0)
    d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-6)
    nrm = np.column_stack([-d[:, 1], d[:, 0]])
    le, ri = p + nrm * wl[:, None], p - nrm * wr[:, None]
    polys = [[le[i], le[i + 1], ri[i + 1], ri[i]] for i in range(len(p) - 1)]
    mid, hw = 0.5 * (le + ri), 0.5 * (wl + wr)
    discs = [(mid[i][0], mid[i][1], hw[i]) for i, c in zip((0, -1), caps) if c]
    m = raster(polys, discs)
    ys, xs = np.nonzero(m)
    q = np.column_stack([WX[ys, xs], WY[ys, xs]])
    k = np.argmin(((q[:, None, :] - mid[None]) ** 2).sum(2), axis=1)
    u = np.clip(((q - mid[k]) * nrm[k]).sum(1) / hw[k], -1, 1)
    U, G, LAM = (np.zeros((CELL, CELL), np.float32) for _ in range(3))
    U[ys, xs], G[ys, xs] = u, lg[k]
    return m, G, U, (ys, xs, u, nrm[k])


def lam_of(geo, flat=1.0):
    ys, xs, u, n = geo
    u = u * flat
    a = np.zeros((CELL, CELL), np.float32)
    a[ys, xs] = u * (n[:, 0] * LX + n[:, 1] * LY) + np.sqrt(1 - u * u) * LZ
    return a


def tones(lam):
    return np.where(lam > 0.72, 4, np.where(lam > 0.4, 3, np.where(lam > 0.1, 2, 1))).astype(np.int8)


def nb4(m):
    o = np.zeros_like(m)
    o[1:] |= m[:-1]; o[:-1] |= m[1:]; o[:, 1:] |= m[:, :-1]; o[:, :-1] |= m[:, 1:]
    return o


class Frame:
    def __init__(self):
        self.mat = np.zeros((CELL, CELL), np.int8)
        self.tone = np.zeros((CELL, CELL), np.int8)
        self.pid = np.zeros((CELL, CELL), np.int8)

    def put(self, m, mat, tone, pid, quiet=()):
        """Lay a shape over what is drawn: where it crosses another part, that part gets a contour line."""
        line = nb4(m) & ~m & (self.pid > 0) & (self.pid != pid)
        for x, y, r in quiet:                              # a limb grows out of the body here: no line
            line &= (WX - x) ** 2 + (WY - y) ** 2 > r * r
        self.mat[line], self.tone[line] = INK, 0
        self.mat[m], self.tone[m], self.pid[m] = mat[m] if isinstance(mat, np.ndarray) else mat, tone[m], pid

    def finish(self, fx):
        mat, tone = self.mat, self.tone
        fig = mat > 0
        code = mat.astype(np.int16) * 8 + tone
        for _ in range(2):                                 # no orphan pixels: a lone tone joins its neighbours
            pad = np.pad(code, 1)
            ns = np.stack([pad[:-2, 1:-1], pad[2:, 1:-1], pad[1:-1, :-2], pad[1:-1, 2:]])
            lone = fig & (mat != INK) & (mat != GOLD) & (mat != VISOR) & (tone < 5) & (ns != code).all(0)
            for y, x in zip(*np.nonzero(lone)):
                c = [v for v in ns[:, y, x] if v and v // 8 not in (INK, GOLD, VISOR) and v % 8 < 5]
                if c:
                    code[y, x] = max(set(c), key=c.count)
        mat, tone = (code // 8).astype(np.int8), (code % 8).astype(np.int8)
        out = nb4(fig) & ~fig
        mat[out], tone[out] = INK, 0
        # selective outline: on an edge that faces the light the line takes the shadow of the material
        for dy, dx in ((1, 0), (0, 1)):
            nm, nt = np.roll(mat, (-dy, -dx), (0, 1)), np.roll(tone, (-dy, -dx), (0, 1))
            sel = out & (mat == INK) & (nt >= 4) & (nm != INK) & (nm != FX) & (nm != VISOR)
            mat[sel], tone[sel] = nm[sel], 1
        for lvl, polys, discs, front in fx:
            m = raster(polys, discs)
            if not front:
                m &= mat == 0
            mat[m], tone[m] = FX, lvl
        arr = np.zeros((CELL, CELL, 4), np.uint8)
        arr[..., 0] = mat.astype(np.int16) * 40
        arr[..., 1] = tone.astype(np.int16) * 50
        arr[..., 3] = 255 * (mat > 0)
        return arr


# ------------------------------------------------------------------ helmets and emblems, pixel by pixel
# S suit, V visor, W silver, G gold, K line. Drawn facing right; 'f' is the front view.
HELM = {
    (0, "s"): """
..SSS.........
..SSSSS.......
...SSSSSSS....
..SSSSSSSSSS..
.SSSSSSSSSSSS.
.SSSSSSSSSSSS.
SSSSSSVVVVVVVS
SSSSSSSVVVVVVV
SSSSSSSSVVVVVV
SSSSSSSSSSVVVS
.SSSSSSSSWWWWS
.SSSSSSSSKWWW.
..SSSSSSSSSS..
....SSSSSS....""",
    (0, "f"): """
......S......
.....SSS.....
...SSSSSSS...
..SSSSSSSSS..
.SSSSSSSSSSS.
.SSSSSSSSSSS.
SVVVVVSVVVVVS
SVVVVVVVVVVVS
SSVVVVVVVVVSS
SSSSVVVVVSSSS
.SSSSWWWSSSS.
.SSSSWWWSSSS.
..SSSSSSSSS..
....SSSSS....""",
    (1, "s"): """
....SSSSS.....
..SSSSSSSSS...
.SSSSSSSSSSS..
.SSSSSSSSSSSS.
SSSSSSSSSSSSS.
SSSSSSSSVVVVVS
SSWWWSSVVVVVVV
SWWGWWSVVVVVVV
SSWWWSSVVVVVVV
SSSSSSSSVVVVVS
.SSSSSSSSSSSS.
.SSSSSSSSWWWW.
..SSSSSSSSWW..
....SSSSSS....""",
    (1, "f"): """
....SSSSS....
..SSSSSSSSS..
.SSSSSSSSSSS.
.SSSSSSSSSSS.
SSSSSSSSSSSSS
WSSVVVVVVVSSW
WWVVVVVVVVVWW
WWVVVVVVVVVWW
WSSVVVVVVVSSW
SSSSSSSSSSSSS
.SSSSWWWSSSS.
.SSSSWWWSSSS.
..SSSSSSSSS..
....SSSSS....""",
    (2, "s"): """
....SSSSS.....
..SSSSSSSSS...
.SSSSSSSSSSS..
.SSSSSSSSSSSS.
SSSSSSSSSSSSS.
SSSSSSSSSSSSSS
SSSSSSKKKKKKKK
SSSSSSVVVVVVV.
SSSSSSVVVVVVV.
SSSSSSSSSSSSS.
.SSSSSKWWWWWWW
.SSSSSSWWWWWWW
..SSSSSSWWWWW.
....SSSSSS....""",
    (2, "f"): """
....SSSSS....
..SSSSSSSSS..
.SSSSSSSSSSS.
.SSSSSSSSSSS.
SSSSSSSSSSSSS
SSSSSSSSSSSSS
SKKKKKKKKKKKS
SSVVVVVVVVVSS
SSVVVVVVVVVSS
SSSSSSSSSSSSS
.SWWWWWWWWWS.
.SWWWWWWWWWS.
..SWWWWWWWS..
....SSSSS....""",
}
EMBLEM = ["G...G\nGG.GG\n.GGG.\n..G..", ".GGG.\nG...G\nG...G\n.GGG.", "..G..\n.GGG.\nGGGGG\n.GGG.\n..G.."]   # chevron, ring, lozenge
CH = {".": 0, "S": SUIT, "V": VISOR, "W": WHITE, "G": GOLD, "K": INK}


def grid(txt):
    return np.array([[CH[c] for c in row] for row in txt.strip("\n").split("\n")], np.int8)


def helmet(fr, v, x, y, view="s", rot=0):
    g = grid(HELM[(v, "f" if view == "f" else "s")])
    if view == "b":                                        # looking back over the shoulder
        g = g[:, ::-1]
    g = np.rot90(g, rot)                                   # quarter turns only: the pixels are never resampled
    h, w = g.shape
    r0, c0 = int(round(OY - y - h / 2)), int(round(OX + x - w / 2))
    gy, gx = np.mgrid[0:h, 0:w]
    nx, ny = (gx + 0.5 - w / 2) / (w / 2 + 0.3), (h / 2 - gy - 0.5) / (h / 2 + 0.3)
    lam = nx * LX + ny * LY + np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1)) * LZ
    t = np.where(lam > 0.74, 4, np.where(lam > 0.42, 3, np.where(lam > 0.08, 2, 1))).astype(np.int8)
    t[(g == SUIT) & (lam > 0.975)] = 5                     # the specular on the dome
    vis = g == VISOR
    t[vis] = np.where(lam[vis] > 0.5, 2, 1)
    if vis.any():                                          # a glint in the corner of the visor nearest the light
        sc = np.where(vis, lam, -9)
        gy0, gx0 = np.unravel_index(np.argmax(sc), sc.shape)
        t[gy0, gx0] = 4
    t[g == INK] = 0
    t[(g == GOLD)] = 4
    m = np.zeros((CELL, CELL), bool); mat = np.zeros((CELL, CELL), np.int8); tone = np.zeros((CELL, CELL), np.int8)
    m[r0:r0 + h, c0:c0 + w] = g > 0
    mat[r0:r0 + h, c0:c0 + w] = g
    tone[r0:r0 + h, c0:c0 + w] = t
    fr.put(m, mat, tone, 5)


# ------------------------------------------------------------------ the parts of a drawing
def V(*a):
    return np.array(a, float)


def unit(v):
    return v / max(np.linalg.norm(v), 1e-6)


def left(v):
    return V(-v[1], v[0])


TQ = [(6.5, 7.5), (9.0, 8.5), (5.5, 5.5), (6.5, 7.0)]      # the torso in three-quarter view: front, back
TF = [(9.5, 9.5), (10.0, 10.0), (6.5, 6.5), (7.5, 7.5)]  # and from the front


def draw_torso(fr, v, T, front, quiet, emblem=True):
    T = [tuple(s) + ((TF if front else TQ)[i] if len(s) == 2 else ()) for i, s in enumerate(T)]
    a, b = V(*T[2][:2]), V(*T[3][:2])
    tail = b + unit(b - a) * 3.0
    st = T + [(tail[0], tail[1], 3.2, 3.2)]
    m, G, U, geo = stroke(st, [0, 1, 2, 3, 3.4], caps=(False, True))
    lam = lam_of(geo, 0.7)
    tone = tones(lam)
    c = 0.0 if front else 0.2
    mat = np.full((CELL, CELL), SUIT, np.int8)
    mat[G < 0.9 * (1 - np.minimum(1, np.abs(U - c) / 0.78))] = WHITE          # the yoke: a white V from the shoulders
    belt = (G >= 2.02) & (G < 2.42)
    mat[belt] = WHITE
    mat[belt & (np.abs(U - c - 0.05) < 0.3)] = GOLD
    pec = (G > 1.28) & (G < 1.45) & (U > -0.35) & (mat == SUIT)               # under the chest
    tone[pec] = np.maximum(tone[pec] - 1, 1)
    tone[mat == GOLD] = np.maximum(tone[mat == GOLD], 3)
    fr.put(m, mat, tone, 4, quiet)
    if emblem:                                             # the emblem, below the point of the yoke
        s = spline(np.asarray(T, float))
        k = 13
        d = unit(s[k + 1, :2] - s[k - 1, :2])
        p = s[k, :2] + left(d) * (c * 0.5 * (s[k, 2] + s[k, 3]) + 0.5 * (s[k, 2] - s[k, 3]))
        g = grid(EMBLEM[v]) > 0
        h, w = g.shape
        r0, c0 = int(round(OY - p[1] - h / 2)), int(round(OX + p[0] - w / 2))
        box = np.zeros((CELL, CELL), bool)
        box[r0:r0 + h, c0:c0 + w] = g
        box &= m
        fr.mat[box], fr.tone[box] = GOLD, 4


def draw_neck(fr, T, H):
    a = V(*T[0][:2])
    st = [(a[0], a[1] - 1.5, 3.2, 3.2), (0.5 * (a[0] + H[0]), 0.5 * (a[1] + H[1]), 2.8, 2.8)]
    m, G, U, geo = stroke(st, [0, 1], caps=(False, True))
    fr.put(m, SUIT, np.maximum(tones(lam_of(geo)) - 1, 1), 4)


def draw_leg(fr, L, pid, dim, quiet):
    hip, knee, ank, toe = V(*L[0:2]), V(*L[2:4]), V(*L[4:6]), V(*L[6:8])
    th, sh = knee - hip, ank - knee
    nt, ns = left(unit(th)), left(unit(sh))                # left of travel is the front of the leg
    st = [(*hip, 4.6, 4.8), (*(hip + 0.45 * th + nt * 0.9), 5.0, 4.4), (*knee, 3.6, 3.3),
          (*(knee + 0.3 * sh - ns * 0.7), 3.0, 4.3), (*(knee + 0.52 * sh), 3.4, 3.9), (*ank, 2.5, 2.7)]
    m, G, U, geo = stroke(st, [0, 0.45, 1, 1.3, 1.52, 2])
    lam = lam_of(geo)
    tone = tones(lam)
    mat = np.where(G >= 1.5, WHITE, np.where(G >= 1.42, GOLD, SUIT)).astype(np.int8)
    tone[(mat == SUIT) & (lam > 0.765) & (G > 0.15) & (G < 0.7)] = 5          # the sheen down the thigh
    tone[(mat == SUIT) & (G > 0.9) & (G < 1.08) & (U < -0.2)] -= 0             # (the knee keeps its tone)
    tone[mat == GOLD] = 4
    if dim:
        tone = np.maximum(np.minimum(tone, 4) - 1, 1).astype(np.int8)
    fr.put(m, mat, tone, pid, quiet)
    # the boot: heel, instep, toe
    s = unit(sh)
    c = ank + s * 2.3
    a = unit(toe - c)
    up = 1.0 if np.dot(left(a), -s) >= 0 else -1.0         # which side of the foot is the instep
    w = lambda top, sole: (top, sole) if up > 0 else (sole, top)
    st = [(*(c - a * 2.0), *w(2.5, 2.2)), (*(c + a * 4.0), *w(2.7, 2.2)), (*toe, *w(1.5, 2.0))]
    m, G, U, geo = stroke(st, [0, 1, 2])
    tone = tones(lam_of(geo))
    tone[U * up < -0.55] = 1                               # the sole
    if dim:
        tone = np.maximum(tone - 1, 1).astype(np.int8)
    fr.put(m, WHITE, tone, pid)


def draw_arm(fr, A, pid, dim, quiet):
    sh, el, wr = V(*A[0:2]), V(*A[2:4]), V(*A[4:6])
    opened = len(A) > 6 and A[6] == "o"
    up, fo = el - sh, wr - el
    nu = left(unit(up))
    st = [(*sh, 3.5, 3.5), (*(sh + 0.5 * up + nu * 0.4), 3.4, 3.0), (*el, 2.6, 2.6),
          (*(el + 0.35 * fo), 3.0, 2.8), (*(el + 0.55 * fo), 3.3, 3.3), (*wr, 2.4, 2.4)]
    m, G, U, geo = stroke(st, [0, 0.5, 1, 1.35, 1.55, 2])
    lam = lam_of(geo)
    tone = tones(lam)
    mat = np.where(G >= 1.52, WHITE, np.where(G >= 1.42, GOLD, SUIT)).astype(np.int8)
    tone[(mat == SUIT) & (lam > 0.77) & (G < 0.4)] = 5     # the shoulder catches the light
    tone[mat == GOLD] = 4
    if dim:
        tone = np.maximum(np.minimum(tone, 4) - 1, 1).astype(np.int8)
    fr.put(m, mat, tone, pid, quiet)
    d = unit(fo)
    st = [(*(wr + d * 0.5), 2.4, 2.4), (*(wr + d * 6.0), 1.9, 1.9)] if opened else [(*(wr + d * 1.2), 3.1, 3.1), (*(wr + d * 3.4), 3.1, 3.1)]
    m, G, U, geo = stroke(st, [0, 1])
    tone = tones(lam_of(geo))
    if dim:
        tone = np.maximum(tone - 1, 1).astype(np.int8)
    fr.put(m, WHITE, tone, pid)


def draw(pose, v):
    fr = Frame()
    T, H = pose["T"], pose["H"]
    front = pose.get("front", False)
    hips = [(pose[k][0], pose[k][1], 7.5) for k in "AB"]
    shs = [(pose[k][0], pose[k][1], 4.0) for k in "ab"]
    for part in pose.get("order", "bBATHa"):
        if part in "AB":
            draw_leg(fr, pose[part], 3 if part == "A" else 2, part == "B" and not front, hips)
        elif part in "ab":
            draw_arm(fr, pose[part], 6 if part == "a" else 1, part == "b" and not front, shs)
        elif part == "T":
            draw_neck(fr, T, H)
            draw_torso(fr, v, T, front, hips + shs, pose.get("E", True))
        elif part == "H":
            helmet(fr, v, *H)
    return fr.finish(pose.get("fx", ()))


# ------------------------------------------------------------------ effects: closed outlines, no line round them
def arc(c, r0, r1, a0, a1, lvl=5, front=False, n=18):
    """A swoosh: a crescent, thin at angle a0 and full at a1 (degrees)."""
    an = [math.radians(a0 + (a1 - a0) * i / n) for i in range(n + 1)]
    outer = [(c[0] + r1 * math.cos(a), c[1] + r1 * math.sin(a)) for a in an]
    inner = [(c[0] + (r1 - (r1 - r0) * (i / n) ** 0.8) * math.cos(a), c[1] + (r1 - (r1 - r0) * (i / n) ** 0.8) * math.sin(a)) for i, a in enumerate(an)]
    return (lvl, [outer + inner[::-1]], (), front)


def streak(x0, y0, x1, y1, w, lvl=5, front=False):
    """A speed line: a point at (x0, y0), w thick at (x1, y1)."""
    n = left(unit(V(x1 - x0, y1 - y0))) * w
    return (lvl, [[(x0, y0), (x1 + n[0], y1 + n[1]), (x1 - n[0], y1 - n[1])]], (), front)


def blob(x, y, r, lvl=5, front=False):
    return (lvl, [], [(x, y, r)], front)


def star(x, y, r, lvl=5, front=True, k=4, rot=0.0):
    pts = []
    for i in range(k * 2):
        a = rot + math.pi * i / k
        rr = r if i % 2 == 0 else r * 0.28
        pts.append((x + rr * math.cos(a), y + rr * math.sin(a)))
    return (lvl, [pts], (), front)


def P(T, H, A, B, a, b, **kw):
    return dict(T=T, H=H, A=A, B=B, a=a, b=b, **kw)


def moved(p, dx=0, dy=0, keys="THABab"):
    q = dict(p)
    for k in keys:
        if k == "T":
            q[k] = [(s[0] + dx, s[1] + dy) + tuple(s[2:]) for s in p[k]]
        elif k == "H":
            q[k] = (p[k][0] + dx, p[k][1] + dy) + tuple(p[k][2:])
        else:
            n = 8 if k in "AB" else 6
            q[k] = tuple(c + (dx, dy)[i % 2] for i, c in enumerate(p[k][:n])) + tuple(p[k][n:])
    return q


def other_side(p):
    """The same drawing a half stride later: each limb takes the place of its twin."""
    q = dict(p)
    for x, y, n in (("A", "B", 8), ("a", "b", 6)):
        for me, tw in ((x, y), (y, x)):
            dx, dy = p[me][0] - p[tw][0], p[me][1] - p[tw][1]
            q[me] = tuple(c + (dx, dy)[i % 2] for i, c in enumerate(p[tw][:n])) + tuple(p[tw][n:])
    return q


def look_back(p):
    return dict(p, H=(p["H"][0] - 2, p["H"][1], "b"))


def with_fx(p, *fx):
    return dict(p, fx=list(p.get("fx", ())) + list(fx))


# ------------------------------------------------------------------ the key drawings (x from the feet, y from the ground, px)
STANCE = P([(2, 77), (3, 69), (1, 58), (0, 49)], (5, 87),
           (-3, 50, -6, 28, -13, 5, -4, 2.2), (3, 50, 11, 29, 12, 5, 22, 2.2),
           (-4, 75, -2, 63, 8, 69), (9, 75, 15, 65, 21, 74))
WALK1 = P([(1, 78), (2, 70), (0, 59), (0, 50)], (3, 88),
          (-2, 51, -7, 29, -17, 8, -10, 2.5), (2, 51, 9, 29, 15, 6, 24, 5),
          (-3, 76, 1, 65, 8, 59), (8, 76, 0, 66, -6, 60))
WALK2 = P([(1, 79), (1, 71), (0, 60), (0, 51)], (2, 89),
          (-1, 52, -1, 29, -2, 5, 8, 2.2), (2, 52, 9, 34, 2, 15, 10, 10),
          (-3, 77, -3, 66, 0, 57), (8, 77, 8, 66, 11, 58))
RUN1 = P([(6, 76), (6, 68), (2, 58), (0, 50)], (10, 85),
         (-2, 50, -8, 30, -19, 11, -14, 3), (3, 50, 16, 45, 13, 26, 21, 22),
         (1, 74, 7, 64, 15, 71), (11, 74, 3, 65, -6, 61))
RUN2 = P([(7, 79), (7, 71), (3, 61), (1, 53)], (11, 88),
         (-1, 53, -10, 36, -24, 41, -27, 32), (4, 53, 16, 42, 23, 24, 32, 23),
         (2, 77, 9, 68, 16, 76), (12, 77, 4, 68, -6, 66))
RUN3 = P([(5, 75), (5, 67), (2, 57), (1, 49)], (9, 84),
         (-1, 49, 4, 30, -9, 25, -8, 17), (3, 49, 9, 28, 4, 5, 14, 2.2),
         (0, 73, 0, 62, 6, 56), (10, 73, 9, 63, 14, 58))
CROUCH = P([(12, 60), (8, 54), (2, 46), (-2, 40)], (17, 69),
           (-3, 38, 9, 29, 0, 5, 10, 2.2), (1, 38, 14, 31, 7, 5, 17, 2.2),
           (8, 60, -1, 56, -10, 63), (14, 58, 6, 52, -2, 57))
DIVE = moved(P([(14, 48), (7, 50), (-3, 52), (-11, 53)], (24, 46, "s", 3),
               (-11, 53, -31, 60, -50, 54, -59, 50), (-10, 52, -30, 54, -51, 58, -61, 60),
               (13, 48, 24, 40, 33, 33, "o"), (15, 50, 27, 46, 38, 43, "o")), 14, 4)
TUCK1 = P([(8, 31), (5, 38), (0, 47), (-3, 53)], (12, 23, "s", 2),
          (-3, 52, -14, 37, -15, 57, -22, 62), (-2, 51, -11, 34, -18, 53, -25, 57),
          (5, 33, -5, 31, -13, 41), (9, 33, 0, 28, -9, 33), E=False)
TUCK2 = P([(-8, 49), (-5, 42), (-1, 33), (2, 27)], (-10, 59),
          (2, 27, 15, 42, 18, 22, 27, 20), (3, 28, 17, 44, 22, 25, 31, 24),
          (-7, 47, 4, 42, 13, 38), (-4, 48, 6, 46, 15, 44), E=False)
SKID1 = P([(-6, 72), (-5, 64), (-3, 54), (-1, 46)], (-7, 82),
          (-3, 46, 7, 29, -6, 6, 4, 2.2), (1, 46, 15, 30, 27, 9, 36, 10),
          (-10, 70, -17, 61, -24, 66, "o"), (1, 70, 11, 66, 19, 72, "o"))
SKID2 = P([(-9, 66), (-8, 58), (-5, 48), (-2, 41)], (-11, 76),
          (-4, 41, 9, 27, -5, 6, 5, 2.2), (0, 41, 15, 28, 29, 8, 38, 8),
          (-13, 64, -21, 56, -27, 62, "o"), (-2, 64, 8, 58, 16, 63, "o"),
          fx=[blob(42, 4, 4.5, 3), blob(48, 7, 3.5, 3), blob(53, 4, 2.5, 2), blob(44, 5, 2.2, 5), streak(64, 2, 46, 2, 1.6, 3)])
RISE = P([(5, 68), (5, 60), (1, 50), (-1, 42)], (9, 78),
         (-4, 42, -1, 22, -14, 5, -5, 2.2), (2, 42, 15, 27, 13, 5, 23, 2.2),
         (-2, 66, 0, 55, 9, 61), (11, 66, 17, 57, 22, 66))
HIT = P([(-4, 74), (-1, 66), (1, 56), (0, 48)], (-9, 83),
        (-3, 48, -4, 27, -10, 5, -1, 3), (2, 48, 8, 28, 8, 6, 17, 6),
        (-9, 72, -17, 78, -22, 88, "o"), (2, 73, 10, 80, 13, 91, "o"),
        fx=[star(12, 64, 11, 3, True, 5, 0.3), star(12, 64, 6, 5, True, 5, 0.3)])
FLY = P([(-14, 50), (-7, 46), (2, 44), (9, 46)], (-23, 55, "s", 1),
        (9, 46, 27, 55, 44, 48, 50, 56), (8, 47, 24, 62, 43, 62, 47, 71),
        (-13, 51, -6, 62, 4, 70, "o"), (-15, 52, -22, 64, -18, 76, "o"),
        fx=[streak(66, 40, 34, 38, 1.4, 3), streak(68, 30, 20, 34, 1.6, 5), streak(60, 22, 30, 28, 1.2, 3)])
LAND = P([(-20, 9), (-13, 9.5), (-4, 10), (3, 13)], (-29, 8, "s", 1),
         (3, 13, 13, 33, 30, 30, 35, 38), (3, 14, 8, 36, 22, 44, 26, 53),
         (-19, 10, -10, 5, 0, 4, "o"), (-21, 12, -30, 20, -38, 14, "o"),
         fx=[blob(-40, 3, 4, 3), blob(-46, 6, 3, 3), blob(14, 3, 4, 3), blob(21, 5, 3, 2), blob(-42, 4, 2, 5)])
FLAT = P([(-20, 9), (-13, 9.5), (-4, 7), (4, 7.5)], (-29, 7.5, "s", 1),
         (4, 7.5, 25, 13, 47, 5, 52, 13), (4, 8, 24, 7, 46, 6.5, 50, 14),
         (-19, 9, -9, 5, 1, 4, "o"), (-21, 11, -30, 7, -39, 5, "o"))
SIT = P([(-11, 34), (-7, 27), (-1, 17), (3, 9)], (-13, 44),
        (3, 9, 17, 25, 27, 6, 36, 4), (3, 10, 20, 20, 36, 6, 45, 6),
        (-14, 32, -18, 20, -17, 7, "o"), (-5, 33, 4, 27, 12, 24))
KNEEL = P([(5, 56), (4, 48), (0, 38), (-2, 30)], (9, 65),
          (-3, 30, -1, 8, -23, 5, -31, 4), (2, 30, 16, 31, 15, 6, 25, 2.2),
          (-1, 54, 2, 43, 11, 36), (10, 54, 16, 45, 18, 35))
WINDUP = P([(1, 75), (2, 67), (0, 56), (0, 47)], (4, 85),
           (-3, 48, -7, 27, -13, 5, -4, 2.2), (3, 48, 11, 28, 14, 5, 24, 2.2),
           (-4, 73, 2, 62, 11, 72, "o"), (9, 73, 10, 62, 2, 74, "o"), order="BATHba",
           fx=[arc((4, 66), 15, 22, 200, 60, 5), arc((4, 66), 17, 26, 20, -120, 3)])
POSES = [
    P([(0, 78), (1, 70), (0, 59), (0, 50)], (2, 88),                           # fist to the sky, fist on the hip
      (-3, 51, -9, 28, -16, 5, -8, 2.2), (3, 51, 12, 29, 18, 5, 28, 2.2),
      (-5, 76, -13, 65, -5, 57), (8, 76, 13, 88, 11, 100)),
    P([(4, 70), (5, 62), (1, 52), (-1, 44)], (8, 80),                          # deep lunge, the open hand points high
      (-4, 44, -16, 26, -30, 6, -22, 2.2), (2, 44, 17, 33, 15, 6, 25, 2.2),
      (-3, 68, -12, 62, -6, 70), (11, 68, 20, 74, 29, 82, "o")),
    P([(0, 78), (0, 70), (0, 59), (0, 50)], (1, 88),                           # on one leg, one fist out, one overhead
      (-2, 51, -4, 28, -5, 5, 5, 2.2), (3, 51, 14, 37, 8, 18, 15, 12),
      (-5, 76, -10, 87, -2, 95), (8, 76, 19, 76, 30, 77)),
]
JAB = P([(4, 77), (5, 69), (2, 58), (0, 49)], (8, 87),
        (-3, 50, -5, 28, -13, 5, -4, 2.2), (3, 50, 12, 29, 13, 5, 23, 2.2),
        (-2, 75, 1, 63, 9, 71), (11, 75, 21, 75, 32, 76))
CROSS = P([(7, 75), (7, 67), (3, 57), (0, 48)], (12, 85),
          (-3, 49, -8, 29, -18, 7, -11, 2.5), (3, 49, 15, 29, 15, 5, 25, 2.2),
          (3, 74, 16, 74, 29, 75), (13, 73, 15, 63, 17, 72))
CHAMBER = P([(-3, 76), (-3, 68), (-1, 58), (0, 50)], (-3, 86),
            (-2, 50, 13, 58, 5, 40, 10, 33), (2, 50, 3, 27, 1, 5, 11, 2.2),
            (-8, 74, -15, 66, -20, 58), (4, 74, 11, 68, 14, 77), order="bBTHAa")
ROUND = P([(-8, 73), (-7, 65), (-3, 56), (0, 50)], (-10, 83),
          (-1, 51, 20, 57, 42, 62, 51, 66), (2, 50, 2, 27, 0, 5, -10, 2.5),
          (-13, 71, -20, 62, -26, 54), (-1, 71, 6, 65, 9, 74), order="bBTHAa")
FLYK = P([(-8, 70), (-6, 62), (-1, 53), (3, 47)], (-11, 80),
         (3, 47, 24, 45, 46, 42, 53, 50), (1, 47, 16, 36, 2, 26, 8, 19),
         (-13, 68, -22, 62, -28, 70), (-1, 68, 7, 62, 10, 71), order="bBTHAa")
GATHER = P([(-1, 74), (0, 66), (0, 56), (0, 47)], (1, 84),
           (-3, 48, -7, 27, -14, 5, -5, 2.2), (3, 48, 12, 28, 14, 5, 24, 2.2),
           (-6, 72, -14, 62, -10, 53, "o"), (7, 72, 2, 61, -6, 59, "o"), order="BATHba")
FIRE = P([(6, 74), (6, 66), (2, 56), (0, 47)], (10, 84),
         (-3, 48, -9, 28, -19, 6, -11, 2.2), (3, 48, 15, 29, 15, 5, 25, 2.2),
         (2, 72, 14, 70, 26, 70, "o"), (12, 72, 22, 74, 30, 73, "o"))
TURN = P([(0, 78), (0, 70), (0, 59), (0, 50)], (0, 88, "f"),
         (-4, 50, -6, 27, -7, 5, -11, 2.2), (4, 50, 6, 27, 7, 5, 11, 2.2),
         (-11, 76, -13, 64, -12, 53), (11, 76, 13, 64, 12, 53), front=True, order="BATHba")
TURN2 = dict(moved(TURN, 0, -2, "THab"), H=(1, 86, "s"),
             A=(-4, 48, -8, 26, -7, 5, -11, 2.2), B=(4, 48, 9, 27, 7, 5, 12, 2.2))


def bolt(i):
    """The energy bolt in flight: a comet, head to the right, a ragged tail."""
    j = 1.5 * (i % 2)
    tail = [(-44 - 3 * j, 1), (-30, 6 + j), (-34, 2), (-16, 9), (-20, 4), (2, 11), (16, 9), (24, 0), (16, -9), (2, -11),
            (-18, -4 - j), (-14, -9), (-32, -3), (-28, -7 - j), (-40, -2)]
    core = [(-22, 0), (-6, 5 + 0.5 * j), (8, 6), (17, 0), (8, -6), (-6, -5)]
    w = lambda pts: [(x, y + 60) for x, y in pts]          # centred on the cell, as the shaders place it
    return [(2, [w(tail)], (), True), (3, [w(core)], (), True), (5, [], [(12, 60, 5.5 + 0.5 * j)], True),
            (5, [w([(-10, 1.5), (10, 2), (10, -2), (-10, -1.5)])], (), True)]


def drawings(v):
    """name -> pose, in the order they are used. Everything the sheet shows is one of these."""
    D = {"stance": STANCE, "stance_up": moved(STANCE, 0, 1, "THab"), "stance_dn": moved(STANCE, 0, -1, "THab")}
    D["walk1"], D["walk2"] = WALK1, WALK2
    D["walk3"], D["walk4"] = other_side(WALK1), other_side(WALK2)
    for i, r in enumerate((RUN1, RUN2, RUN3)):
        D[f"run{i + 1}"], D[f"run{i + 4}"] = r, other_side(r)
    for i in range(1, 7):
        D[f"look{i}"] = look_back(D[f"run{i}"])
    D["crouch"] = CROUCH
    D["dive"] = with_fx(DIVE, streak(-62, 72, -30, 64, 1.3, 3), streak(-66, 50, -52, 50, 1.0, 3))
    D["tuck1"] = with_fx(TUCK1, arc((-3, 40), 24, 30, 200, 60, 3))
    D["tuck2"] = with_fx(TUCK2, arc((5, 38), 24, 30, 110, -40, 3))
    D["rise"] = RISE
    D["skid1"], D["skid2"] = SKID1, SKID2
    D["hit"], D["fly"], D["land"], D["flat"] = HIT, FLY, LAND, FLAT
    D["sit"], D["kneel"] = SIT, KNEEL
    D["windup"] = WINDUP
    c = (POSES[v]["b"][4], POSES[v]["b"][5] + 3)
    D["pose_flash"] = with_fx(POSES[v], star(c[0], c[1], 13, 3, False, 4), star(c[0], c[1], 8, 5, True, 4))
    D["pose"] = POSES[v]
    D["jab_hit"] = with_fx(JAB, streak(8, 82, 34, 81, 1.6), streak(12, 70, 34, 71, 1.2, 3), star(39, 76, 6, 5, True, 4, 0.78))
    D["jab"] = JAB
    D["cross_hit"] = with_fx(CROSS, streak(2, 81, 32, 80, 1.8), streak(6, 68, 32, 70, 1.3, 3), star(37, 75, 7, 5, True, 4, 0.78))
    D["cross"] = CROSS
    D["chamber"] = CHAMBER
    D["round_hit"] = with_fx(ROUND, arc((-1, 51), 40, 56, 128, 12, 5), arc((-1, 51), 34, 41, 150, 60, 3))
    D["round_fade"] = with_fx(ROUND, arc((-1, 51), 46, 55, 80, 12, 3))
    D["round"] = ROUND
    ln = lambda d: [streak(-66, 82 + d, -18, 80 + d, 1.3, 3), streak(-68, 62 - d, -20, 60 - d, 1.7, 5), streak(-62, 44 + d, -8, 40 + d, 1.3, 3),
                    streak(-50, 28, 0, 24, 1.1, 3)]
    D["flykick1"], D["flykick2"], D["flykick"] = with_fx(FLYK, *ln(0)), with_fx(FLYK, *ln(2)), FLYK
    ch = lambda r: [blob(-9, 56, r + 2.5, 2, True), blob(-9, 56, r, 5, True)]
    D["gather1"], D["gather2"], D["gather3"] = with_fx(GATHER, *ch(2.0)), with_fx(GATHER, *ch(3.5)), with_fx(GATHER, *ch(5.0), star(-9, 56, 11, 3, False, 4, 0.4))
    D["fire_flash"] = with_fx(FIRE, star(40, 71, 20, 3, False, 6, 0.2), blob(40, 71, 9, 2, True), blob(40, 71, 6, 5, True))
    D["fire_fade"] = with_fx(FIRE, blob(40, 71, 6, 3, True), blob(40, 71, 3.5, 5, True))
    D["fire"] = FIRE
    D["turn1"], D["turn2"] = TURN, TURN2
    return D


# action -> (first cell on the sheet, the drawings in order, how many cells each is held)
ACTIONS = [
    ("stance", 0, ["stance", "stance_up", "stance", "stance_dn"], [2, 2, 2, 2]),
    ("walk", 8, ["walk1", "walk2", "walk3", "walk4"], [2, 2, 2, 2]),
    ("run", 16, ["run1", "run2", "run3", "run4", "run5", "run6"], [2] * 6),
    ("look", 28, ["look1", "look2", "look3", "look4", "look5", "look6"], [2] * 6),
    ("flip", 40, ["crouch", "dive", "tuck1", "tuck2", "crouch", "rise"], [2, 3, 2, 2, 2, 1]),
    ("skid", 52, ["skid1", "skid2", "rise"], [1, 3, 2]),
    ("knock", 58, ["hit", "fly", "land", "flat"], [2, 2, 2, 2]),
    ("getup", 66, ["flat", "sit", "kneel", "rise", "stance"], [2, 2, 3, 2, 1]),
    ("pose", 76, ["stance", "windup", "pose_flash", "pose"], [1, 3, 2, 6]),
    ("punch", 88, ["stance", "jab_hit", "jab", "stance", "cross_hit", "cross", "stance"], [1, 1, 1, 1, 1, 2, 1]),
    ("kick", 96, ["stance", "chamber", "round_hit", "round_fade", "round", "chamber", "stance"], [1, 1, 1, 1, 2, 1, 1]),
    ("fkick", 104, ["crouch", "flykick1", "flykick2", "flykick", "crouch", "stance"], [2, 1, 1, 2, 1, 1]),
    ("blast", 112, ["stance", "gather1", "gather2", "gather3", "fire_flash", "fire_fade", "fire", "stance"], [1, 1, 1, 2, 1, 1, 2, 1]),
    ("turn", 122, ["turn1", "turn2"], [1, 1]),
]
BOLT = 124


def build(v):
    D = drawings(v)
    done = {}
    cells = [None] * (COLS * ROWS)
    for name, first, seq, hold in ACTIONS:
        c = first
        for d, h in zip(seq, hold):
            if d not in done:
                done[d] = draw(D[d], v)
            for _ in range(h):
                assert cells[c] is None, f"{name}: cell {c} used twice"
                cells[c] = done[d]
                c += 1
    for i in range(4):
        cells[BOLT + i] = Frame().finish(bolt(i))
    assert all(c is not None for c in cells), "the sheet has an empty cell"
    for i, c in enumerate(cells):                           # nothing may touch the edge of its cell, nothing may be empty
        a = c[..., 3] > 0
        assert a.any() and not (a[0].any() or a[-1].any() or a[:, 0].any() or a[:, -1].any()), f"hero {v}: cell {i} is cut by its cell"
        assert set(np.unique(c[..., 0])) <= {0, 40, 80, 120, 160, 200, 240} and c[..., 1].max() <= 250
    sheet = np.zeros((ROWS * CELL, COLS * CELL, 4), np.uint8)
    for i, c in enumerate(cells):
        sheet[(i // COLS) * CELL:(i // COLS + 1) * CELL, (i % COLS) * CELL:(i % COLS + 1) * CELL] = c
    return sheet, done


def table():
    acts = {}
    for name, first, seq, hold in ACTIONS:
        fr, c = [], first
        for h in hold:
            fr.append(c)
            c += h
        acts[name] = {"frames": fr, "hold": hold, "anchor": [OX, OY], "drawings": seq}
    acts["bolt"] = {"frames": [BOLT + i for i in range(4)], "hold": [1, 1, 1, 1], "anchor": [OX, CELL // 2], "drawings": ["bolt"] * 4}
    return {"cell": [CELL, CELL], "cols": COLS, "rows": ROWS, "atlases": [f"toku-hero-{v}.png" for v in range(3)],
            "encoding": "R = material * 40 (1 suit, 2 white, 3 visor, 4 gold, 5 ink, 6 energy), G = tone * 50 (1..5, ink 0)",
            "note": "hold = cells on the sheet per drawing: frames[i] is the first cell of drawing i and the next hold[i]-1 cells repeat it, "
                    "so the first cell and the length of every action are the ones titanhand.frag and kaijustomp.frag already use",
            "actions": acts}


def preview(done_all, path, zoom=3):
    """Every drawing once, tinted the way the shader does, on a flat ground."""
    suits = [(0.2, 0.72, 0.32), (0.86, 0.2, 0.22), (0.2, 0.42, 0.9)]
    names = list(done_all[0])
    cw, chh, cols = 140, 124, 10
    rows_per = -(-len(names) // cols)
    out = np.zeros((rows_per * 3 * chh, cols * cw, 3), np.float32)
    out[:] = (0.27, 0.45, 0.72)
    for v in range(3):
        for i, n in enumerate(names):
            a = done_all[v][n][CELL - chh - 2:CELL - 2, (CELL - cw) // 2:(CELL + cw) // 2]
            mat, lv = a[..., 0] // 40, a[..., 1] // 50
            y0, x0 = (v * rows_per + i // cols) * chh, (i % cols) * cw
            reg = out[y0:y0 + chh, x0:x0 + cw]
            suit = np.array(suits[v])
            for m, base in ((1, suit), (2, np.array([0.96, 0.96, 0.93])), (3, np.array([0.1, 0.12, 0.22])), (4, np.array([1.0, 0.8, 0.25]))):
                for l in range(1, 6):
                    k = [(0.5 if m == 2 else 0.3), (0.66 if m == 2 else 0.5), (0.82 if m == 2 else 0.75), 1.0, 1.0][l - 1]
                    c = base * k
                    if l == 1:
                        c = c * 0.75 + np.array([0.12, 0.08, 0.3]) * 0.25
                    if l == 5:
                        c = base * 0.4 + np.array([1.0, 1.0, 0.92]) * 0.6
                    if m == 3 and l >= 4:
                        c = np.array([0.8, 0.88, 1.0])
                    reg[(mat == m) & (lv == l)] = c
            reg[mat == 5] = (0.04, 0.03, 0.08)
            for l in range(1, 6):
                reg[(mat == 6) & (lv == l)] = np.ones(3) if l > 4 else suit * 0.4 + 0.6 if l > 2 else np.minimum(suit * 1.25, 1)
    im = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))
    im.resize((im.width * zoom, im.height * zoom), Image.NEAREST).save(path)


def main():
    done_all = []
    for v in range(3):
        sheet, done = build(v)
        Image.fromarray(sheet, "RGBA").save(OUT / f"toku-hero-{v}.png", optimize=True)
        done_all.append(done)
        print(f"toku-hero-{v}.png: {len(done)} drawings on {COLS * ROWS} cells")
    (HERE / "heroes.json").write_text(json.dumps(table(), indent=1) + "\n")
    if "--preview" in sys.argv:
        preview(done_all, sys.argv[sys.argv.index("--preview") + 1])


if __name__ == "__main__":
    main()
