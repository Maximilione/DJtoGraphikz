"""Cel sprites: what every sheet in scripts/toku is made of.

A drawing is closed shapes laid one over the other (a limb, a helmet, a claw), each with a class
(suit, white, ink, visor, gold, energy) and, where it is a lit surface, the normal of a rounded
solid. Nothing is coloured or shaded here: the sheet stores smooth fields and the shader paints
them, so an edge stays sharp at any size and the light can move.

    A  the silhouette, blurred: the edge is where it crosses 0.5
    B  the class: 0 energy | .30 suit (.17 in the far limbs) | .50 ink | .80 white (.70 far) | 1 flat
    R  normal x (0.5 = facing the viewer); energy: how hot; flat: 0 visor, 1 gold
    G  normal y;                                            flat: 1 = the glint on the visor

Classes sit in that order on purpose: where suit meets white the filter passes through ink, which
is the line a pen would have put there.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SUIT, WHITE, INK, VISOR, GOLD, FX = 1, 2, 3, 4, 5, 6
CODE = {SUIT: 0.30, WHITE: 0.80, INK: 0.50, VISOR: 1.0, GOLD: 1.0, FX: 0.0}
DIM = {SUIT: 0.17, WHITE: 0.70}


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


def closed(pts, n=8):
    """A smooth closed outline through pts."""
    p = np.asarray(pts, float)
    q = np.vstack([p[-1], p, p[0], p[1]])
    out = []
    for i in range(len(p)):
        a, b, c, d = q[i], q[i + 1], q[i + 2], q[i + 3]
        for t in np.arange(n) / n:
            out.append(0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t ** 3))
    return [tuple(v) for v in out]


def ellipse(cx, cy, rx, ry, n=40, rot=0.0):
    c, s = np.cos(rot), np.sin(rot)
    a = np.linspace(0, 2 * np.pi, n, endpoint=False)
    x, y = rx * np.cos(a), ry * np.sin(a)
    return list(zip(cx + x * c - y * s, cy + x * s + y * c))


class Space:
    """A cell: cw x ch drawing units, the anchor at (ox, oy from the top), stored at `scale` texels
    per unit and drawn at `ss` times that."""

    def __init__(self, cw, ch, ox, oy, scale=2, ss=2):
        self.cw, self.ch, self.ox, self.oy, self.scale, self.ss = cw, ch, ox, oy, scale, ss
        self.k = scale * ss
        self.W, self.H = cw * self.k, ch * self.k
        yy, xx = np.mgrid[0:self.H, 0:self.W]
        self.WX, self.WY = (xx + 0.5) / self.k - ox, oy - (yy + 0.5) / self.k

    def raster(self, polys=(), discs=()):
        im = Image.new("L", (self.W, self.H), 0)
        d = ImageDraw.Draw(im)
        k = self.k
        for poly in polys:
            d.polygon([((self.ox + x) * k, (self.oy - y) * k) for x, y in poly], fill=255)
        for x, y, r in discs:
            cx, cy = (self.ox + x) * k, (self.oy - y) * k
            d.ellipse([cx - r * k, cy - r * k, cx + r * k, cy + r * k], fill=255)
        return np.asarray(im) > 127

    def grow(self, m, r):
        """m grown by r drawing units."""
        n = max(1, int(round(r * self.k)))
        return np.asarray(Image.fromarray(m.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(2 * n + 1))) > 127

    def stroke(self, st, logical=None, caps=(True, True), flat=1.0):
        """A limb: stations (x, y, left width, right width) along a line. Returns its mask and, per
        pixel, the place along the line (logical), across it (u, -1..1, +1 = left of travel) and the
        normal of the rounded solid (x, y)."""
        st = np.asarray(st, float)
        lg = np.arange(len(st)) if logical is None else logical
        s = spline(np.column_stack([st, lg]))
        p, wl, wr, lg = s[:, :2], np.maximum(s[:, 2], 0.3), np.maximum(s[:, 3], 0.3), s[:, 4]
        d = np.gradient(p, axis=0)
        d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-6)
        nrm = np.column_stack([-d[:, 1], d[:, 0]])
        le, ri = p + nrm * wl[:, None], p - nrm * wr[:, None]
        polys = [[le[i], le[i + 1], ri[i + 1], ri[i]] for i in range(len(p) - 1)]
        mid, hw = 0.5 * (le + ri), 0.5 * (wl + wr)
        m = self.raster(polys, [(mid[i][0], mid[i][1], hw[i]) for i, c in zip((0, -1), caps) if c])
        ys, xs = np.nonzero(m)
        q = np.column_stack([self.WX[ys, xs], self.WY[ys, xs]])
        k = np.concatenate([np.argmin(((q[i:i + 20000, None, :] - mid[None]) ** 2).sum(2), axis=1) for i in range(0, len(q), 20000)]) if len(q) else np.zeros(0, int)
        u = np.clip(((q - mid[k]) * nrm[k]).sum(1) / hw[k], -1, 1)
        G, U, NX, NY = (np.zeros((self.H, self.W), np.float32) for _ in range(4))
        G[ys, xs], U[ys, xs] = lg[k], u
        NX[ys, xs], NY[ys, xs] = u * flat * nrm[k, 0], u * flat * nrm[k, 1]
        return m, G, U, NX, NY

    def dome(self, m, cx, cy, rx, ry, flat=1.0):
        """Normals of a mask treated as a rounded lump centred on (cx, cy)."""
        nx, ny = (self.WX - cx) / rx, (self.WY - cy) / ry
        l = np.maximum(np.sqrt(nx * nx + ny * ny), 1.0)
        return (nx / l * flat * m).astype(np.float32), (ny / l * flat * m).astype(np.float32)


class Canvas:
    def __init__(self, sp):
        self.sp = sp
        z = lambda t: np.zeros((sp.H, sp.W), t)
        self.cls, self.pid, self.dim = z(np.int8), z(np.int8), z(bool)
        self.r, self.g = z(np.float32), z(np.float32)        # normal x, y or the codes of a flat class

    def put(self, m, cls, nx=0.0, ny=0.0, pid=1, dim=False, quiet=(), line=0.6):
        """Lay a shape over what is drawn. Where it crosses another part, a pen line `line` units wide."""
        sp = self.sp
        if line:
            edge = sp.grow(m, line) & ~m & (self.pid > 0) & (self.pid != pid)
            for x, y, r in quiet:                              # a limb grows out of the body here: no line
                edge &= (sp.WX - x) ** 2 + (sp.WY - y) ** 2 > r * r
            self.flat(edge, INK)
        for dst, src in ((self.cls, cls), (self.r, nx), (self.g, ny), (self.dim, dim)):
            dst[m] = src[m] if isinstance(src, np.ndarray) else src
        self.pid[m] = pid

    def flat(self, m, cls, r=0.5, g=0.5):
        """Paint a flat class over the figure where m is (a visor, a buckle, a pen line)."""
        self.cls[m], self.r[m], self.g[m], self.dim[m] = cls, {VISOR: 0.0, GOLD: 1.0}.get(cls, r), g, False

    def fx(self, lvl, polys, discs, front):
        m = self.sp.raster(polys, discs)
        if not front:
            m &= self.cls == 0
        self.cls[m], self.r[m], self.g[m], self.dim[m], self.pid[m] = FX, lvl / 5.0, 0.5, False, 0

    def encode(self):
        sp, ss = self.sp, self.sp.ss
        fig = self.cls > 0
        a = Image.fromarray(fig.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(1.25 * ss))
        b = np.zeros(fig.shape, np.float32)
        for c, v in CODE.items():
            b[self.cls == c] = v
        for c, v in DIM.items():
            b[(self.cls == c) & self.dim] = v
        lit = (self.cls == SUIT) | (self.cls == WHITE)
        r = np.where(lit, self.r * 0.5 + 0.5, self.r)
        g = np.where(lit, self.g * 0.5 + 0.5, self.g)
        box = lambda x: x.reshape(sp.H // ss, ss, sp.W // ss, ss).sum((1, 3))
        w = box(fig.astype(np.float32))
        ch = [box(x * fig) / np.maximum(w, 1e-6) for x in (r, g, b)]
        have = w > 0
        for _ in range(6):                                     # colour bleeds past the edge, so the filter never mixes in black
            pad = [np.pad(x * have, 1) for x in ch] + [np.pad(have.astype(np.float32), 1)]
            acc = [sum(p[1 + dy:p.shape[0] - 1 + dy, 1 + dx:p.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) for p in pad]
            new = (acc[3] > 0) & ~have
            for i in range(3):
                ch[i] = np.where(new, acc[i] / np.maximum(acc[3], 1e-6), ch[i])
            have |= new
        out = np.zeros((sp.H // ss, sp.W // ss, 4), np.uint8)
        for i in range(3):
            out[..., i] = np.clip(np.round(ch[i] * 255), 0, 255)
        out[..., 3] = np.round(box(np.asarray(a, np.float32)) / (ss * ss))
        return out


def cut_by_cell(cell):
    """True when the drawing touches the edge of its cell."""
    a = cell[..., 3] > 100
    return a[0].any() or a[-1].any() or a[:, 0].any() or a[:, -1].any()


def paint(cell, suit=(0.2, 0.62, 0.9), ground=(0.12, 0.1, 0.2), light=(-0.5, 0.6, 0.62)):
    """A cell coloured roughly the way the shaders do it, for a contact sheet."""
    t = cell.astype(np.float32) / 255
    r, g, b, a = t[..., 0], t[..., 1], t[..., 2], t[..., 3]
    nx, ny = r * 2 - 1, g * 2 - 1
    lam = nx * light[0] + ny * light[1] + np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1)) * light[2]
    suit = np.array(suit, np.float32)
    out = np.empty(cell.shape[:2] + (3,), np.float32)
    tone = np.where(lam > 0.45, 1.0, 0.42)[..., None]
    out[:] = suit * tone
    wh = b >= 0.62
    out[wh] = (np.array([0.97, 0.96, 0.92]) * np.where(lam > 0.45, 1.0, 0.6)[..., None])[wh]
    dim = ((b < 0.235) & (b >= 0.09)) | ((b >= 0.62) & (b < 0.75))
    out[dim] *= 0.6
    out[(b >= 0.4) & (b < 0.62)] = (0.03, 0.03, 0.07)
    fl = b >= 0.9
    out[fl & (r < 0.5)] = (0.06, 0.08, 0.2)
    out[fl & (r < 0.5) & (g > 0.5)] = (0.85, 0.95, 1.0)
    out[fl & (r >= 0.5)] = (1.0, 0.8, 0.25)
    en = b < 0.09
    out[en] = (suit * 0.5 + 0.5 * r[..., None])[en] + (r[..., None] > 0.8)[en] * 0.5
    line = np.clip((a - 0.25) / 0.2, 0, 1)[..., None]
    body = np.clip((a - 0.45) / 0.1, 0, 1)[..., None]
    out = out * body + np.array([0.03, 0.03, 0.07]) * (1 - body)
    return np.clip(out * line + np.array(ground, np.float32) * (1 - line), 0, 1)
