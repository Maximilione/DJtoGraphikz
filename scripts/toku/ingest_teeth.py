#!/usr/bin/env python3
"""Turns the approved chattering-teeth art into the indexed sheet of chatter.frag.

    python3 scripts/toku/ingest_teeth.py                 writes src/engine/assets/toku-teeth.png + scripts/toku/teeth.json
    python3 scripts/toku/ingest_teeth.py --strip out.png the sheet as the shader paints it, 3x, nothing written
    python3 scripts/toku/ingest_teeth.py --glsl          the constants chatter.frag carries, nothing written

Source: scripts/toku/art/teeth-0.png (the toy, 8 poses) and teeth-1.png (the
small toy for the far ranks, the giant, loose teeth, dust). The cut-out is
ingest.figures(); the reduction is the one of ingest.py (every output pixel
takes the class most of its source pixels have, then a one-pixel ink line
round the silhouette) with the materials of this toy.

Sheet encoding: R = material * 30, G = tone * 50, A = 0 or 255.
  1 gum (tones 1..5)   2 white (teeth, highlights)   3 gold (tooth, key)
  4 shoe               5 eye                         6 mouth (1..2 inside, 3..5 tongue)
  7 ink                8 dust
Each group is a row of equal cells; a toy stands on the bottom line of its
cell with the middle of its gums on column `ax` (teeth.json).
"""
import json
import pathlib
import sys

import numpy as np
from PIL import Image

from ingest import ART, ASSETS, figures

HERE = pathlib.Path(__file__).resolve().parent
OUT = ASSETS / "toku-teeth.png"
GUM, WHITE, GOLD, SHOE, EYE, MOUTH, INK, DUST = 1, 2, 3, 4, 5, 6, 7, 8
INKC = INK * 8                  # a class is material * 8 + tone
INK_SHARE = 0.36
SHEET_W = 512

# group -> (source sheet, poses, height in virtual pixels of its first pose, kind)
GROUPS = {
    # open, half, shut (squashed), hop, land, dizzy, back (the key), yell
    "big": (0, range(8), 64, "toy"),
    # open, shut, hop: drawn for this size
    "small": (1, (0, 1, 2), 38, "toy"),
    # open, shut
    "giant": (1, (3, 4), 150, "toy"),
    "tooth": (1, (5,), 46, "bits"),         # four loose teeth, one per cell
    "puff": (1, (6,), 22, "fx"),
    "burst": (1, (7,), 190, "fx"),          # the giant's impact, behind it: the rays show round its head
}


NAMES = {"big": ["open", "half", "shut", "hop", "land", "dizzy", "back", "yell"], "small": ["open", "shut", "hop"],
         "giant": ["open", "shut"], "tooth": ["white", "white", "white", "gold"], "puff": ["puff"], "burst": ["burst"]}


def classify(fig):
    """Material * 8 + tone of every source pixel, by constant thresholds. Red is SHOE here: split() finds the tongue."""
    c = fig[..., :3].astype(float) / 255
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    mx, mn = c.max(-1), c.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    lum = c @ np.array([0.299, 0.587, 0.114])
    grey = sat < 0.3
    gold = (g > b * 1.8) & (g > 0.38) & (r > 0.5)
    pink = (b > g + 0.1) & (b > 0.24) & (r > 0.5)
    cls = WHITE * 8 + np.select([lum > 0.93, lum > 0.84, lum > 0.7, lum > 0.5], [5, 4, 3, 2], 1)
    red = SHOE * 8 + np.select([mx < 0.57, mx < 0.66, mx < 0.85, g < 0.35], [1, 2, 3, 4], 5)
    cls = np.where(grey, np.where(lum > 0.3, cls, INKC), red)
    cls = np.where(~grey & (mx < 0.4), MOUTH * 8 + np.where(mx < 0.19, 1, 2), cls)      # the dark of the mouth
    cls = np.where(pink, GUM * 8 + np.select([lum < 0.3, lum < 0.41, lum < 0.47, lum < 0.58], [1, 2, 3, 4], 5), cls)
    cls = np.where(gold, GOLD * 8 + np.select([lum < 0.58, lum < 0.68, lum < 0.755], [2, 3, 4], 5), cls)
    return np.where(mx < 0.105, INKC, cls)


def nb(a, fill=0):                                          # up, down, left, right neighbours
    p = np.pad(a, 1, constant_values=fill)
    return p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]


def reduce(fig, s, share=INK_SHARE):
    """ingest.reduce() with this toy's classes: classes of the figure at scale s, 0 where empty."""
    h, w = fig.shape[:2]
    H, W = max(1, round(h * s)), max(1, round(w * s))
    yi = np.minimum((np.arange(h) + 0.5) * H / h, H - 1).astype(int)
    xi = np.minimum((np.arange(w) + 0.5) * W / w, W - 1).astype(int)
    idx = (yi[:, None] * W + xi[None, :]).ravel()
    al = fig[..., 3].ravel() / 255.0
    cover = np.bincount(idx, al, H * W) / np.maximum(np.bincount(idx, None, H * W), 1)
    cls = classify(fig).ravel()
    votes = np.zeros((80, H * W))
    for k in np.unique(cls):
        votes[k] = np.bincount(idx, al * (cls == k), H * W)
    ink = votes[INKC] >= share * votes.sum(0)
    votes[INKC] = 0
    out = np.where(cover > 0.5, np.where(ink, INKC, votes.argmax(0)), 0).reshape(H, W)
    edge = (out > 0) & np.logical_or.reduce([n == 0 for n in nb(out)])
    out[edge] = INKC
    # an ink pixel right behind the outline with paint right behind it: the line is two thick there
    res = out.copy()
    p = np.pad(out, 2)
    for e, inner in zip(nb(edge, False), (p[4:, 2:-2], p[:-4, 2:-2], p[2:-2, 4:], p[2:-2, :-4])):
        fix = (out == INKC) & ~edge & e & (inner > 0) & (inner != INKC) & (res == INKC)
        res[fix] = inner[fix]
    # a lone pixel of a class none of its neighbours has is noise from the vote
    n4 = np.stack(nb(res))
    lone = (res > 0) & (res != INKC) & (n4 != res).all(0)
    for y, x in zip(*np.where(lone)):
        v = [k for k in n4[:, y, x] if k > 0 and k != INKC]
        if v:
            res[y, x] = max(set(v), key=v.count)
    return res


def label(m):
    """4-connected components of a mask, by spreading the largest label."""
    lab = np.where(m, np.arange(m.size).reshape(m.shape) + 1, 0)
    while True:
        n = np.maximum.reduce([lab, *nb(lab)]) * m
        if (n == lab).all():
            return lab
        lab = n


def split(cls):
    """What colour alone cannot tell: red inside the figure is the tongue (red at its rim is a shoe),
    white above the gums is an eye."""
    mat = cls // 8
    out = cls.copy()
    p = np.pad(cls == 0, 2, constant_values=True)
    H, W = cls.shape
    rim = np.logical_or.reduce([p[dy:dy + H, dx:dx + W] for dy in range(5) for dx in range(5)])   # 2 px from the outside
    lab = label(mat == SHOE)
    for i in np.unique(lab[lab > 0]):
        m = lab == i
        if not (m & rim).any():
            out[m] = MOUTH * 8 + np.select([cls[m] % 8 <= 2, cls[m] % 8 <= 4], [3, 4], 5)
    rows = (mat == GUM).sum(1)
    top = int(np.argmax(rows >= 0.3 * W)) if (rows >= 0.3 * W).any() else 0
    lab = label(mat == WHITE)
    for i in np.unique(lab[lab > 0]):
        m = lab == i
        if np.where(m)[0].mean() < top:
            out[m] = EYE * 8 + cls[m] % 8
    return out


def sprites():
    """{group: [classes per cell]} and {group: column of the middle of the gums in each cell}."""
    src = {n: figures(ART / f"teeth-{n}.png") for n in (0, 1)}
    cells, axes = {}, {}
    for name, (sheet, poses, height, kind) in GROUPS.items():
        figs = [src[sheet][i] for i in poses]
        s = height / figs[0].shape[0]
        # the small toy is drawn with lines as thick as its eyes are wide: there a line needs more of a pixel to win
        red = [reduce(f, s, 0.43 if name == "small" else INK_SHARE) for f in figs]
        if kind == "toy":
            red = [split(c) for c in red]
            ax = []
            for c in red:
                xs = np.where((c // 8 == GUM).any(0))[0]
                ax.append((xs.min() + xs.max() + 1) // 2)
        elif kind == "bits":                                # the four largest pieces, speed lines dropped
            whole = red[0]
            lab = label(whole > 0)
            ids, n = np.unique(lab[lab > 0], return_counts=True)
            red = []
            for i in sorted(ids[np.argsort(-n)[:4]]):
                ys, xs = np.where(lab == i)
                red.append(np.where(lab == i, whole, 0)[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
            ax = [c.shape[1] // 2 for c in red]
        else:
            red = [np.where(c // 8 == WHITE, DUST * 8 + c % 8, c) for c in red]
            ax = [c.shape[1] // 2 for c in red]
        cells[name], axes[name] = red, ax
    return cells, axes


def build():
    cells, axes = sprites()
    meta, placed = {}, []
    x = y = shelf = 0
    for name, red in cells.items():
        left = max(axes[name])                              # one anchor column for the group
        cw = left + max(c.shape[1] - a for c, a in zip(red, axes[name])) + 2
        ch = max(c.shape[0] for c in red) + 2
        if x + cw * len(red) > SHEET_W:
            x, y, shelf = 0, y + shelf, 0
        meta[name] = {"x": x, "y": y, "cw": cw, "ch": ch, "n": len(red), "ax": left + 1, "cells": NAMES[name],
                      "sizes": [list(c.shape[::-1]) for c in red]}
        for i, (c, a) in enumerate(zip(red, axes[name])):
            placed.append((x + i * cw + 1 + left - a, y + ch - 1 - c.shape[0], c))    # feet on the bottom line
        x, shelf = x + cw * len(red), max(shelf, ch)
        assert x <= SHEET_W, f"{name} does not fit the sheet"
    H = y + shelf
    sheet = np.zeros((H, SHEET_W, 4), np.uint8)
    for px, py, c in placed:
        v = sheet[py:py + c.shape[0], px:px + c.shape[1]]
        v[..., 0] = (c // 8) * 30
        v[..., 1] = np.where(c // 8 == INK, 0, (c % 8) * 50)
        v[..., 3] = (c > 0) * 255
    check(sheet, meta)
    return sheet, {"size": [SHEET_W, H], "encoding": "R = material * 30, G = tone * 50", "groups": meta}


def check(sheet, meta):
    op = sheet[..., 3] > 0
    assert set(np.unique(sheet[..., 3])) <= {0, 255}, "alpha is not binary"
    assert set(np.unique(sheet[..., 0][op])) <= {30 * m for m in range(1, 9)}, "material out of the encoding"
    assert set(np.unique(sheet[..., 1][op])) <= {0, 50, 100, 150, 200, 250}, "tone out of the encoding"
    for name, g in meta.items():
        blk = op[g["y"]:g["y"] + g["ch"], g["x"]:g["x"] + g["cw"] * g["n"]].reshape(g["ch"], g["n"], g["cw"])
        assert blk.any(axis=(0, 2)).all(), f"{name}: empty cell"
        assert not (blk[[0, -1]].any() or blk[:, :, [0, -1]].any()), f"{name}: a figure touches its cell edge"
    mat = sheet[..., 0] // 30
    for name in ("big", "small", "giant"):                  # every toy pose has what the shader dresses
        g = meta[name]
        for i in range(g["n"]):
            m = mat[g["y"]:g["y"] + g["ch"], g["x"] + i * g["cw"]:g["x"] + (i + 1) * g["cw"]]
            need = {GUM, EYE, SHOE, INK} | ({WHITE} if (name, i) != ("big", 6) else {GOLD})
            assert need <= set(np.unique(m)), f"{name} {i}: materials {need - set(np.unique(m))} missing"


def colour(sheet, gum=(1.0, 0.25, 0.5), shoe=(0.95, 0.12, 0.12), bg=(0.2, 0.22, 0.34)):
    """The indexed sheet as chatter.frag paints it (toyCol), through the app's tone curve."""
    def ramp(b, lv):
        b = np.array(b, float)
        if lv > 4.5:
            return b * 0.5 + np.array([1.0, 0.95, 0.72]) * 0.5
        if lv > 3.5:
            return b
        k = 0.3 if lv < 1.5 else 0.52 if lv < 2.5 else 0.76
        t = 0.4 if lv < 1.5 else 0.22 if lv < 2.5 else 0.08
        s = b * k
        s = s * (1 - 0.6 * t) + (s @ np.array([0.299, 0.587, 0.114])) * 0.6 * t
        return s * (1 - t) + np.array([0.14, 0.08, 0.36]) * (0.5 + k) * t

    mat, lv, al = sheet[..., 0] // 30, (sheet[..., 1].astype(int) + 25) // 50, sheet[..., 3] > 127
    out = np.zeros(sheet.shape[:2] + (3,))
    out[:] = bg
    for m in range(1, 9):
        for l in range(6):
            sel = al & (mat == m) & (lv == l)
            if not sel.any():
                continue
            c = {GUM: lambda: ramp(gum, l) * 1.25, SHOE: lambda: ramp(shoe, l) * 1.2,
                 WHITE: lambda: ramp((1.5, 1.5, 1.45), min(l, 4)), EYE: lambda: ramp((1.5, 1.5, 1.45), min(l, 4)),
                 GOLD: lambda: ramp((1.3, 0.85, 0.1), l), DUST: lambda: ramp((1.1, 1.1, 1.2), min(l, 4)),
                 MOUTH: lambda: np.array([0.1, 0.02, 0.05]) * l if l < 2.5 else ramp((1.0, 0.16, 0.2), l),
                 INK: lambda: np.array([0.03, 0.02, 0.06])}[m]() * 1.1
            out[sel] = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14)
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), "RGB")


def main():
    sheet, meta = build()
    if "--strip" in sys.argv:
        im = colour(sheet)
        im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(sys.argv[sys.argv.index("--strip") + 1])
        return
    if "--glsl" in sys.argv:
        print(f"const vec2 SHEET = vec2({meta['size'][0]}.0, {meta['size'][1]}.0);")
        for name, g in meta["groups"].items():              # origin x, y (from the top), cell w, h; then the anchor column
            print(f"const vec4 {name.upper()} = vec4({g['x']}.0, {g['y']}.0, {g['cw']}.0, {g['ch']}.0); const float {name.upper()}_AX = {g['ax']}.0;")
        return
    Image.fromarray(sheet, "RGBA").save(OUT, optimize=True)
    (HERE / "teeth.json").write_text(json.dumps(meta, indent=1, default=int) + "\n")       # numpy ints
    print("wrote", OUT, meta["size"])


if __name__ == "__main__":
    main()
