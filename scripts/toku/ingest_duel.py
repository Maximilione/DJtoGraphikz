#!/usr/bin/env python3
"""Turns the approved pose sheets of the robot and the kaiju into the indexed sheets of robokaiju.frag.

    python3 scripts/toku/ingest_duel.py robo                  writes src/engine/assets/toku-robo.png
    python3 scripts/toku/ingest_duel.py kaiju                 writes src/engine/assets/toku-kaiju.png
    python3 scripts/toku/ingest_duel.py robo --strip out.png  the sheet, coloured as duelSprite() does
    python3 scripts/toku/ingest_duel.py robo --strip out.png --cells 10-15   those cells, enlarged
    python3 scripts/toku/ingest_duel.py robo --poses out.png  every source pose after reduction
    python3 scripts/toku/ingest_duel.py robo --stats          sizes, scales and the mean art colour of every tone

Same job as ingest.py does for the heroes, same approach (cut out, classify every source
pixel into material and tone, reduce by a vote of those classes, place against the sheet
being replaced), for sheets of 6 poses on a 3x2 grid:

- one scale per character: the stance (sheet 0, pose 0) comes out as tall as the stance of
  the old sheet. A sheet that drew the character smaller (the sword sheet) is brought back
  by the size of the body (median sqrt of the body area of its poses), not of the bounding box;
- the kaiju art faces left and is mirrored, the sheet faces +x;
- cells, anchors and timing stay the ones robokaiju.frag reads. Each figure stands on the
  old figure's feet line; across, see place(). The energy pixels of the old cells
  (material 6: flashes, arcs, the charge) are carried over.

The old sheets are kept as art/layout-robo.png and art/layout-kaiju.png.
"""
import json
import os
import pathlib
import shutil
import sys

import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ART = HERE / "art"
ASSETS = HERE.parent.parent / "src" / "engine" / "assets"
CW, CH, COLS, ROWS = 288, 224, 8, 8
INK, FX = 5, 6
INKC = INK * 8                  # a class is material * 8 + tone


# ---------------------------------------------------------------- cut out
def figures(path, cols=3, rows=2):
    """The poses of a sheet as straight-alpha RGBA arrays, in reading order (as ingest.figures, any grid)."""
    cache = os.environ.get("DJG_DUEL_CACHE")                # a pickle {stem: figures}, to iterate faster
    if cache and pathlib.Path(cache).exists():
        import pickle
        got = pickle.load(open(cache, "rb")).get(path.stem)
        if got:
            return got
    a = np.asarray(Image.open(path).convert("RGBA")).copy()
    h, w = a.shape[:2]
    B = 4                                                   # label on a 4x coarser mask: fast, and bridges hairline gaps
    m = (a[..., 3] > 128)[: h // B * B, : w // B * B].reshape(h // B, B, w // B, B).any(axis=(1, 3))
    lab = np.where(m, np.arange(m.size).reshape(m.shape) + 1, 0)
    while True:                                             # connected components by spreading the largest label
        p = np.pad(lab, 1)
        n = np.maximum.reduce([p[1:-1, 1:-1], p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]]) * m
        if (n == lab).all():
            break
        lab = n
    ids, area = np.unique(lab[lab > 0], return_counts=True)
    cells = {}
    for i, n in zip(ids, area):
        ys, xs = np.where(lab == i)
        key = (min(rows - 1, int(ys.mean() * B * rows // h)), min(cols - 1, int(xs.mean() * B * cols // w)))
        cells.setdefault(key, []).append((n, i))
    out = []
    for r in range(rows):
        for c in range(cols):
            comps = cells.get((r, c))
            assert comps, f"{path.name}: no figure in grid cell {r},{c}"
            big = max(comps)[0]
            keep = np.isin(lab, [i for n, i in comps if n >= 0.02 * big])        # specks are not part of the pose
            full = np.zeros((h, w), bool)
            up = np.kron(keep, np.ones((B, B), bool))
            full[: up.shape[0], : up.shape[1]] = up
            ys, xs = np.where(full & (a[..., 3] > 128))
            y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            fig = a[y0:y1, x0:x1].copy()
            fig[~full[y0:y1, x0:x1]] = 0
            out.append(fig)
    return out


# ---------------------------------------------------------------- classify
# Thresholds are constants per character, so a surface keeps its tone from one frame to the next.
def classify(fig, char):
    """Material * 8 + tone of every source pixel."""
    c = fig[..., :3].astype(float) / 255
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    mx, mn = c.max(-1), c.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    lum = c @ np.array([0.299, 0.587, 0.114])
    sel = np.select
    if char == "robo":
        cyan = (g > r * 1.15) & (b > r * 1.15) & (sat > 0.16)
        gold = (r > b * 1.5) & (g > b * 1.2) & (r >= g) & (sat > 0.3)
        armour = 1 * 8 + sel([mx < 0.23, mx < 0.30, mx < 0.37, mx < 0.44], [1, 2, 3, 4], 5)
        glass = 7 * 8 + sel([r > 0.35, g > 0.9, g > 0.76, g > 0.62], [5, 4, 3, 2], 1)
        yel = 4 * 8 + sel([lum > 0.8, lum > 0.63, lum > 0.56, lum > 0.45], [5, 4, 3, 2], 1)
        white = 2 * 8 + sel([lum > 0.96, lum > 0.89, lum > 0.78, lum > 0.6], [5, 4, 3, 2], 1)
        gun = 3 * 8 + sel([lum < 0.16, lum < 0.23, lum < 0.3, lum < 0.4], [1, 2, 3, 4], 5)
        cls = sel([mx < 0.105, cyan & (mx < 0.56), cyan, gold, lum > 0.5], [INKC, armour, glass, yel, white], gun)
    else:
        glow = (r > g * 1.3) & (r > b * 1.6)
        sail = (g > r * 1.5) & (b > r * 1.5)
        warm = r >= b * 1.08
        hide = 1 * 8 + sel([lum < 0.23, lum < 0.29, lum < 0.36, lum < 0.43], [1, 2, 3, 4], 5)
        fin = 4 * 8 + sel([g < 0.45, g < 0.57, g < 0.64, g < 0.76], [1, 2, 3, 4], 5)
        fire = 7 * 8 + sel([lum > 0.5, lum > 0.36, r > 0.48, r > 0.3], [5, 4, 3, 2], 1)
        ivory = 2 * 8 + np.where(lum > 0.96, 5, 4)
        cream = 3 * 8 + sel([lum > 0.91, lum > 0.8, lum > 0.62, lum > 0.45], [5, 4, 3, 2], 1)
        cls = sel([mx < 0.105, glow & (mx < 0.2), glow, sail & (mx < 0.25), sail, (sat < 0.15) & (lum > 0.8), warm & (lum < 0.2), warm],
                  [INKC, INKC, fire, INKC, fin, ivory, INKC, cream], hide)
    return cls


# ---------------------------------------------------------------- reduce
def nb(a, fill=0):                                          # up, down, left, right neighbours
    p = np.pad(a, 1, constant_values=fill)
    return p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]


def components(mask):
    """Labels of the 4-connected components of a small mask (0 = outside)."""
    lab = np.where(mask, np.arange(mask.size).reshape(mask.shape) + 1, 0)
    while True:
        n = np.maximum.reduce([lab, *nb(lab)]) * mask
        if (n == lab).all():
            return lab
        lab = n


def reduce(fig, s, char, sword=False):
    """Classes of the figure at scale s (< 1), 0 where empty: every output pixel takes the material
    most of its source pixels have, then the tone most of those have. The silhouette is closed
    with a one-pixel ink line."""
    h, w = fig.shape[:2]
    H, W = max(1, round(h * s)), max(1, round(w * s))
    yi = np.minimum((np.arange(h) + 0.5) * H / h, H - 1).astype(int)
    xi = np.minimum((np.arange(w) + 0.5) * W / w, W - 1).astype(int)
    idx = (yi[:, None] * W + xi[None, :]).ravel()
    al = fig[..., 3].ravel() / 255.0
    cover = np.bincount(idx, al, H * W) / np.maximum(np.bincount(idx, None, H * W), 1)
    cls = classify(fig, char).ravel()
    votes = np.zeros((64, H * W))
    for k in np.unique(cls):
        votes[k] = np.bincount(idx, al * (cls == k), H * W)
    mat = votes.reshape(8, 8, -1).sum(1)
    mat[INK] *= INK_BIAS
    m = mat.argmax(0)
    tone = np.take_along_axis(votes.reshape(8, 8, -1), m[None, None, :], 0)[0].argmax(0)
    out = np.where(cover > 0.5, m * 8 + np.where(m == INK, 0, tone), 0).reshape(H, W)
    edge = (out > 0) & np.logical_or.reduce([n == 0 for n in nb(out)])
    out[edge] = INKC
    # a lone pixel of a class none of its neighbours has is noise from the vote
    n4 = nb(out)
    lone = (out > 0) & (out != INKC) & np.logical_and.reduce([n // 8 != out // 8 for n in n4])
    stack = np.stack(n4)
    for y, x in zip(*np.where(lone)):
        v = [k for k in stack[:, y, x] if k > 0 and k != INKC]
        if v:
            out[y, x] = max(set(v), key=v.count)
    if char == "robo":                                      # the lightest armour and the darkest glass are one colour: the surroundings decide
        m, p = out // 8, np.pad(out, 2)
        near = [p[2 + dy:2 + dy + H, 2 + dx:2 + dx + W] for dy in range(-2, 3) for dx in range(-2, 3)]
        glass, armour = sum((n // 8 == 7) & (n % 8 >= 3) for n in near), sum(n // 8 == 1 for n in near)
        out[(m == 7) & (out % 8 <= 2) & (armour > glass)] = 1 * 8 + 5
        out[(out == 1 * 8 + 5) & (glass > armour)] = 7 * 8 + 2
    if sword:                                               # the blade is the glass that is pure cyan: energy
        lab = components(out // 8 == 7)
        for i in np.unique(lab[lab > 0]):
            sel = lab == i
            if sel.sum() >= 12 and (out[sel] % 8 == 4).mean() > 0.4:
                out[sel] = FX * 8 + np.maximum(out[sel] % 8, 2)
    return out


INK_BIAS = 1.3                                              # a line that shares a pixel with a surface keeps it
STANCE = (0, 0)                                             # the pose that sets the scale
PER_POSE = {("robo", 5)}                                    # sheets whose poses are not all drawn at one size
# Stance height, as a share of the old sheet's. The new robot is as wide as it is tall (the old one
# was 127 x 200): at the old height its arms-up poses are 235 px and the sword 259, in a cell where
# 212 fit above the feet line, and on a screen that shows 188 above the street. 0.81 is the largest
# at which every pose used fits the cell. The kaiju fits as it is.
FIT = {"robo": 0.81, "kaiju": 1.0}
ANCHOR = {"robo": (120, 212), "kaiju": (140, 212)}          # the feet, in a cell: robokaiju.frag reads these
FEET = 213                                                  # first row under the soles


def body(fig, char):
    """Size of the body in a source pose: sqrt of its area, the blade of the sword left out."""
    op = fig[..., 3] > 128
    if char == "robo":
        r, g = fig[..., 0], fig[..., 1]
        op &= ~((r < 40) & (g > 232))
    return np.sqrt(op.sum())


def load(char):
    """{(sheet, pose): source figure facing +x} and {(sheet, pose): scale}."""
    paths = sorted(ART.glob(f"{char}-[0-9].png"))
    assert paths, f"no art for {char} in {ART}"
    figs = {(int(p.stem.split("-")[1]), i): (f[:, ::-1] if char == "kaiju" else f) for p in paths for i, f in enumerate(figures(p))}
    old = np.asarray(Image.open(ART / f"layout-{char}.png").convert("RGBA"))[:224, :288]
    stand = np.ptp(np.where((old[..., 3] > 127) & ((old[..., 0].astype(int) + 16) // 32 != FX))[0]) + 1
    size = {k: body(f, char) for k, f in figs.items()}
    sheet = {n: np.percentile([v for k, v in size.items() if k[0] == n], 67) for n in {k[0] for k in figs}}   # hidden limbs only take area away
    s0 = FIT[char] * stand / figs[STANCE].shape[0]
    scale = {k: s0 * sheet[STANCE[0]] / (size[k] if (char, k[0]) in PER_POSE else sheet[k[0]]) for k in figs}
    return figs, scale


def sprites(char):
    figs, scale = load(char)
    return {k: reduce(f, scale[k], char, sword=(char, k[0]) == ("robo", 5)) for k, f in figs.items()}


def encode(cls):
    out = np.zeros(cls.shape + (4,), np.uint8)
    out[..., 0] = (cls // 8) * 32
    out[..., 1] = np.where(cls // 8 == INK, 0, (cls % 8) * 50)
    out[..., 3] = (cls > 0) * 255
    return out


# ---------------------------------------------------------------- place
# cell name -> (sheet, pose 0..5 in reading order, options). Options, see build():
# at      "feet" (default): on the feet line, the centre of mass where the old figure's was;
#         "box": lying or in the air, the old bounding box centre and bottom
# dx, dy  nudge
# fx      what happens to the old cell's energy pixels: None dropped, "tip" moved as the striking
#         end moved, "lens" / "mouth" / "blade" centred on (or, the blade, hung from) that point of the new figure
ROBO = {
    "idle": (0, 0), "idle2": (1, 0),
    "walk0": (1, 1), "walk1": (1, 2), "walk2": (1, 3), "walk3": (1, 4),
    "jab": (1, 5, {"fx": "tip"}), "jab_h": (1, 5),
    "hwind": (2, 0), "cross": (2, 1, {"fx": "tip"}), "cross_h": (2, 1),
    "hhit": (0, 1, {"fx": "tip"}), "hhit_h": (0, 1),
    "crouch": (2, 2), "kch": (2, 3), "khit": (2, 4, {"fx": "tip"}), "khit_h": (2, 4),
    "reach": (2, 5), "lift": (3, 0), "throw": (3, 1, {"fx": "tip"}), "throw_h": (3, 1),
    "stun": (6, 4), "stun2": (0, 4),
    "reel": (3, 3, {"at": "box"}), "air": (3, 5, {"at": "box"}), "bounce": (3, 4, {"at": "box"}), "flat": (3, 5, {"at": "box"}),
    "sit": (4, 0, {"at": "box"}), "kneel": (4, 1),
    "block": (0, 2), "block2": (4, 2),
    "raise0": (5, 5), "raise": (5, 1), "raise_g": (5, 1),
    "slash": (5, 2, {"fx": "blade"}), "slash2": (5, 3, {"fx": "blade"}), "slash3": (5, 3), "slash_h": (5, 3), "sheathe": (5, 5),
    "beam0": (4, 5), "beam1": (6, 0, {"fx": "lens"}), "beam2": (6, 1, {"fx": "lens"}),
    "beam3": (6, 1, {"fx": "lens"}), "beam4": (6, 1, {"fx": "lens"}),
    "taunt": (4, 3),
}
KAIJU = {
    "idle_a": (0, 0), "idle_b": (1, 0), "idle_c": (0, 0),
    "walk_1": (1, 1), "walk_2": (1, 2), "walk_3": (1, 3), "walk_4": (1, 4),
    "claw_wind": (4, 2), "claw_a_fx": (2, 0, {"fx": "tip"}), "claw_a": (2, 0), "claw_b_fx": (0, 1, {"fx": "tip"}), "claw_b": (0, 1),
    "horn_wind": (2, 2), "horn_fx": (2, 1, {"fx": "tip"}), "horn": (2, 1),
    "kick_wind": (6, 0), "kick_fx": (2, 4, {"fx": "tip"}), "kick": (2, 4),
    "grab": (2, 5), "lift": (3, 0), "throw": (3, 1),
    "stun_a": (4, 5), "stun_b": (3, 2),
    "launched": (3, 3, {"at": "box"}), "air": (3, 5, {"at": "box"}), "bounce": (3, 4, {"at": "box"}), "flat": (3, 5, {"at": "box"}),
    "push_up": (4, 0), "crouch": (4, 1),
    "block_a": (4, 2), "block_b": (4, 2),
    "coil": (5, 0), "coil_turn": (5, 1), "swipe_fx": (5, 2, {"fx": "tip"}), "swipe_fx2": (5, 3, {"fx": "tip"}),
    "swipe_end": (5, 4), "swipe_back": (5, 5),
    "charge_1": (6, 0), "charge_2": (6, 1), "charge_3": (6, 2, {"fx": "mouth"}),
    "fire_a": (6, 3, {"fx": "mouth"}), "fire_b": (6, 3, {"fx": "mouth"}),
    "roar": (4, 4),
}
# what each cell of the kaiju sheet shows (robo.json already lists its own)
KAIJU_CELLS = ("idle_a idle_b idle_c idle_b walk_1 walk_1 walk_2 walk_3 walk_3 walk_4 "
               "claw_wind claw_a_fx claw_a claw_wind claw_b_fx claw_b horn_wind horn_wind horn_fx horn horn "
               "kick_wind kick_fx kick kick_wind idle_a grab grab lift lift throw throw stun_a stun_b "
               "launched air bounce flat flat push_up crouch crouch idle_b block_a block_b "
               "coil coil_turn swipe_fx swipe_fx2 swipe_end swipe_end swipe_back idle_a "
               "charge_1 charge_2 charge_3 fire_a fire_b roar").split()
TABLE = {"robo": ROBO, "kaiju": KAIJU}


def bbox(mask):
    ys, xs = np.where(mask)
    return np.array([xs.min(), ys.min(), xs.max() + 1, ys.max() + 1])


def tip(mask):
    """The striking end of a figure facing right: its right-most point above the feet (x, y)."""
    ys, xs = np.where(mask)
    up = ys < ys.max() - 30
    x = xs[up].max()
    return np.array([x, round(ys[up & (xs >= x - 3)].mean())])


def mark(cls, what):
    """A point of a reduced figure (x, y): the chest lens of the robot, the mouth of the kaiju, the point of the sword."""
    mat, lv = cls // 8, cls % 8
    if what == "mouth":                                     # the front of the inside of the mouth
        ys, xs = np.where((mat == 7) & (lv <= 3))
        front = xs >= xs.max() - 3
        return np.array([xs.max() + 1, round(ys[front].mean())])
    if what == "blade":                                     # the energy pixel farthest from the body
        ys, xs = np.where(mat == FX)
        by, bx = [v.mean() for v in np.where((cls > 0) & (mat != FX))]
        i = np.argmax((ys - by) ** 2 + (xs - bx) ** 2)
        return np.array([xs[i], ys[i]])
    lab = components(mat == 7)                              # the lens: the round glass nearest the middle of the trunk
    h, w = cls.shape
    best = None
    for i in np.unique(lab[lab > 0]):
        x0, y0, x1, y1 = bbox(lab == i)
        n = (lab == i).sum()
        if 20 <= n and 0.7 < (x1 - x0) / (y1 - y0) < 1.45 and n > 0.6 * (x1 - x0) * (y1 - y0) and (y0 + y1) / 2 < 0.62 * h:
            d = abs((y0 + y1) / 2 - 0.5 * h)
            if best is None or d < best[0]:
                best = (d, np.array([(x0 + x1) // 2, (y0 + y1) // 2]))
    assert best, "no lens on this pose"
    return best[1]


def cells_of(char):
    meta = json.loads((HERE / f"{char}.json").read_text())
    return meta["cells"] if char == "robo" else KAIJU_CELLS


def build(char, report=False):
    """The new sheet, and the contact points measured on it: {cell: {...}} in px from the anchor, y up."""
    old = np.asarray(Image.open(ART / f"layout-{char}.png").convert("RGBA"))
    assert old.shape == (ROWS * CH, COLS * CW, 4)
    spr, names = sprites(char), cells_of(char)
    ax, ay = ANCHOR[char]
    sheet, info = np.zeros_like(old), {}
    for cell, name in enumerate(names):
        cy, cx = cell // COLS * CH, cell % COLS * CW
        oc = old[cy:cy + CH, cx:cx + CW]
        src = TABLE[char][name]
        fig, opt = spr[src[:2]], (src[2] if len(src) > 2 else {})
        solid = fig > 0
        omat = (oc[..., 0].astype(int) + 16) // 32
        obody, fx = (oc[..., 3] > 127) & (omat != FX), (oc[..., 3] > 127) & (omat == FX)
        ob, h, w = bbox(obody), *fig.shape
        if opt.get("at") == "box":
            x, y = (ob[0] + ob[2]) // 2 - w // 2, ob[3] - h
        else:
            x, y = round(np.where(obody)[1].mean() - np.where(solid & (fig // 8 != FX))[1].mean()), FEET - h
        x, y = x + opt.get("dx", 0), y + opt.get("dy", 0)
        assert w <= CW - 2 and 1 <= y and y + h <= CH - 1, f"{char} cell {cell} {name}: {w}x{h} at {x},{y} does not fit the cell"
        x = min(max(x, 1), CW - 1 - w)                      # a lying figure longer than the old one stays in the cell
        out = np.zeros((CH, CW, 4), np.uint8)
        out[y:y + h, x:x + w][solid] = encode(fig)[solid]
        how = opt.get("fx")
        if fx.any() and how:                                # the old energy pixels, in front of the figure
            if how == "tip":
                d = tip(solid) + (x, y) - tip(obody)
            elif how == "blade":                            # the arc ends on the point of the blade, as it did
                ys, xs = np.where(fx)
                d = mark(fig, how) + (x, y) - (round(xs[ys >= ys.max() - 2].mean()), ys.max())
            else:
                fb = bbox(fx)
                d = mark(fig, how) + (x, y) - ((fb[0] + fb[2]) // 2, (fb[1] + fb[3]) // 2) + ((6, 0) if how == "mouth" else (0, 0))
            ys, xs = np.where(fx)                           # never out of the cell
            d = (int(np.clip(d[0], 1 - xs.min(), CW - 2 - xs.max())), int(np.clip(d[1], 1 - ys.min(), CH - 2 - ys.max())))
            out[ys + d[1], xs + d[0]] = oc[ys, xs]
        sheet[cy:cy + CH, cx:cx + CW] = out
        rel = lambda p: [int(p[0] + x - ax), int(ay + 1 - p[1] - y)]
        info[cell] = {"name": name, "x": [x - ax, x + w - ax], "top": FEET - y, "tip": rel(tip(solid)), "old_tip": [int(tip(obody)[0] - ax), int(ay + 1 - tip(obody)[1])]}
        for m in ("lens", "mouth", "blade"):
            if how == m:
                info[cell][m] = rel(mark(fig, m))
    check(sheet, len(names))
    return sheet, info


def check(sheet, used):
    a = sheet[..., 3]
    assert set(np.unique(a)) <= {0, 255}, "alpha is not binary"
    op = a > 0
    assert set(np.unique(sheet[..., 0][op])) <= {32, 64, 96, 128, 160, 192, 224}, "material out of the encoding"
    assert set(np.unique(sheet[..., 1][op])) <= {0, 50, 100, 150, 200, 250}, "tone out of the encoding"
    assert ((sheet[..., 1][op] > 0) | (sheet[..., 0][op] == INK * 32)).all(), "a painted pixel without a tone"
    cells = op.reshape(ROWS, CH, COLS, CW)
    assert not (cells[:, [0, -1]].any() or cells[:, :, :, [0, -1]].any()), "a figure touches a cell edge"
    full = cells.any(axis=(1, 3)).ravel()
    assert full[:used].all() and not full[used:].any(), "an empty cell, or a cell nobody reads"


# ---------------------------------------------------------------- preview
def tone(c):
    c = np.asarray(c, float) * 1.1
    return np.clip((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0, 1)


def colour(sheet, char, bg=(0.27, 0.43, 0.67)):
    """The indexed sheet as duelSprite() paints it, through the app's tone curve."""
    mat, lv, al = (sheet[..., 0].astype(int) + 16) // 32, (sheet[..., 1].astype(int) + 25) // 50, sheet[..., 3] > 127
    out = np.zeros(sheet.shape[:2] + (3,))
    out[:] = bg
    for m in range(1, 8):
        for l in range(6):
            sel = al & (mat == m) & (lv == l)
            if sel.any():
                out[sel] = tone(shade(char, m, max(l, 1)))
    return Image.fromarray((out * 255).astype(np.uint8), "RGB")


# The ramps of duelSprite() in robokaiju.frag. The fixed materials are the mean colour the art has
# in each tone (--stats), taken back through the app's tone curve and the light of the set, so the
# effect shows the art's own colours; the materials that wear the palette keep the art's steps of value.
TONES = {
    ("robo", 2): [(0.548, 0.548, 0.582), (0.707, 0.705, 0.737), (0.854, 0.849, 0.865), (0.917, 0.914, 0.918), (0.983, 0.983, 0.974)],
    ("robo", 3): [(0.124, 0.126, 0.141), (0.194, 0.196, 0.221), (0.254, 0.255, 0.285), (0.338, 0.338, 0.372), (0.444, 0.444, 0.479)],
    ("robo", 4): [(0.400, 0.277, 0.033), (0.718, 0.501, 0.028), (0.832, 0.591, 0.025), (0.939, 0.701, 0.055), (0.983, 0.886, 0.385)],
    ("kaiju", 1): [(0.146, 0.182, 0.231), (0.221, 0.269, 0.334), (0.278, 0.331, 0.408), (0.349, 0.404, 0.489), (0.419, 0.477, 0.569)],
    ("kaiju", 2): [(0.403, 0.357, 0.307), (0.582, 0.518, 0.447), (0.777, 0.695, 0.603), (0.963, 0.922, 0.861), (0.986, 0.978, 0.952)],
    ("kaiju", 3): [(0.403, 0.357, 0.307), (0.582, 0.518, 0.447), (0.777, 0.695, 0.603), (0.952, 0.865, 0.759), (0.985, 0.910, 0.805)],
}
VALUE = {"armour": [0.17, 0.264, 0.325, 0.394, 0.474], "sail": [0.377, 0.523, 0.606, 0.703, 0.802]}   # the art's green channel
LIFT = 1.3                                                  # the armour is a little lighter than the art's: it has to carry any palette
PAL = [np.array(c) * 0.92 + 0.08 for c in ((0.0, 1.0, 0.53), (1.0, 0.0, 1.0), (0.27, 0.27, 1.0))]   # the preview's uColor1..3
LIGHT = np.array([0.94, 0.92, 1.0])                         # gSprLight at rest


def untone(y):
    """The linear value the shader has to output for the screen to show y."""
    y = np.minimum(np.asarray(y, float), 0.92)              # the curve only reaches white at infinity
    a, b, c = 2.51 - 2.43 * y, 0.03 - 0.59 * y, -0.14 * y
    return (-b + np.sqrt(b * b - 4 * a * c)) / (2 * a) / 1.1


def ramps():
    """{name: 5 linear colours or factors}, as written in the shader."""
    out = {f"{c}{m}": [np.round(untone(t) / LIGHT, 3) for t in tones] for (c, m), tones in TONES.items()}
    out["armour"] = [round(float(untone(v * LIFT) / 0.95), 3) for v in VALUE["armour"]]
    out["sail"] = [round(float(untone(v) / 0.95), 3) for v in VALUE["sail"]]
    return out


def shade(char, mat, lv):
    cA, cB, cC = PAL
    eR, eK = cB * 0.65 + np.array([0.3, 0.9, 1.0]) * 0.35, cC * 0.65 + np.array([1.0, 0.35, 0.2]) * 0.35
    hue, R, i = (eR if char == "robo" else eK), ramps(), lv - 1
    if mat == FX:
        return np.ones(3) if lv > 4.5 else hue * 0.35 + 0.65 if lv > 3.5 else hue * 1.2 if lv > 2.5 else hue * 0.7
    if mat == INK:
        return np.array([0.03, 0.025, 0.07])
    if char == "robo":
        if mat == 7:                                        # glass, lit from inside
            c = hue * (0.35 + 0.3 * lv)
            return c * 0.5 + 0.5 if lv > 3.5 else c
        if mat == 1:
            return cA * R["armour"][i] * LIGHT
        c = R[f"robo{mat}"][i]
        if mat == 4:                                        # the gold takes a little of the second colour
            c = c * 0.85 + cB * (c @ np.array([0.299, 0.587, 0.114])) * 0.15
        return c * LIGHT
    if mat == 7:                                            # the inside of the mouth is dark, the eye burns
        return hue * [0.14, 0.26, 0.42][i] if lv < 3.5 else (hue * 1.2) * (0.7 if lv < 4.5 else 0.45) + np.array([1.0, 0.9, 0.7]) * (0.3 if lv < 4.5 else 0.55)
    if mat == 4:
        c = (cC * 0.75 + np.array([0.1, 0.5, 0.45]) * 0.25) * R["sail"][i]
        return (c * 0.85 + 0.15 if lv > 4.5 else c) * LIGHT
    return R[f"kaiju{mat}"][i] * LIGHT


def glsl():
    v = lambda c: "vec3(" + ", ".join(f"{x:g}" for x in c) + ")"
    for k, t in ramps().items():
        print(k, ", ".join(v(c) if np.ndim(c) else f"{c:g}" for c in t))


def main():
    args = sys.argv[1:]
    if not args or args[0] not in ("robo", "kaiju"):
        sys.exit(__doc__)
    char = args[0]
    if "--glsl" in args:
        return glsl()
    if "--stats" in args:
        figs, scale = load(char)
        acc = np.zeros((64, 4))
        for k, f in sorted(figs.items()):
            print(k, f"{f.shape[1]}x{f.shape[0]} body {body(f, char):.0f} scale {scale[k]:.4f} -> {f.shape[1] * scale[k]:.0f}x{f.shape[0] * scale[k]:.0f}")
            cls, op = classify(f, char), f[..., 3] > 250
            for c in np.unique(cls[op]):
                px = f[op & (cls == c)][:, :3]
                acc[c, :3] += px.sum(0)
                acc[c, 3] += len(px)
        for c in np.where(acc[:, 3] > 0)[0]:
            print(f"mat {c // 8} tone {c % 8}: {100 * acc[c, 3] / acc[:, 3].sum():5.1f}%  " + " ".join(f"{v:.3f}" for v in acc[c, :3] / acc[c, 3] / 255))
        return
    if "--poses" not in args:
        sheet, info = build(char)
        if "--strip" in args:
            im, k = colour(sheet, char), 1
            if "--cells" in args:
                lo, _, hi = args[args.index("--cells") + 1].partition("-")
                cs = range(int(lo), int(hi or lo) + 1)
                im = Image.fromarray(np.hstack([np.asarray(im)[c // COLS * CH:c // COLS * CH + CH, c % COLS * CW:c % COLS * CW + CW] for c in cs]))
                k = 3 if len(cs) < 5 else 2
            im.resize((im.width * k, im.height * k), Image.NEAREST).save(args[args.index("--strip") + 1])
            return
        for c, i in info.items():
            print(c, i)
        if "--dry" not in args:
            Image.fromarray(sheet, "RGBA").save(ASSETS / f"toku-{char}.png", optimize=True)
            print("wrote", ASSETS / f"toku-{char}.png")
        return
    if "--poses" in args:
        spr = sprites(char)
        n = max(k[0] for k in spr) + 1
        TW, TH = 320, 320
        sheet = np.zeros((n * TH, 6 * TW, 4), np.uint8)
        for (s, i), f in spr.items():
            h, w = f.shape
            assert h <= TH and w <= TW, (s, i, w, h)
            sheet[s * TH + TH - 4 - h:s * TH + TH - 4, i * TW + (TW - w) // 2:i * TW + (TW - w) // 2 + w] = encode(f)
        im = colour(sheet, char)
        only = [int(a) for a in args[args.index("--poses") + 2:]]
        if only:
            im = im.crop((0, only[0] * TH, im.width, (only[-1] + 1) * TH))
        im.save(args[args.index("--poses") + 1])
        return


if __name__ == "__main__":
    main()
