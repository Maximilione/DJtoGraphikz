#!/usr/bin/env python3
"""Turns the approved pose sheets of a hero into its indexed sprite sheet.

    python3 scripts/toku/ingest.py hero0                    writes src/engine/assets/toku-hero-0.png
    python3 scripts/toku/ingest.py hero0 --strip out.png    the sheet, coloured as heroSprite() does
    python3 scripts/toku/ingest.py hero0 --strip out.png --action punch   one action, enlarged
    python3 scripts/toku/ingest.py hero0 --poses out.png    every source pose after reduction

Source: scripts/toku/art/<char>-<n>.png, 8 poses each on a 4x2 grid ("fake"
pixel art: soft edges, pixels about 5 source pixels wide). Every pose is cut
out, classified pixel by pixel into the material and tone of the sheet encoding
(R = material * 40, G = tone * 50, see heroes.json) and reduced by a majority
vote of those classes, so no colour that is not in the encoding can appear.
One scale for the whole character: the stance comes out STAND px tall.

Cells, holds and actions stay the ones of heroes.json. Each figure goes where
the figure of the previous sheet was (art/layout-<char>.png, saved on the first
run): same feet line, same centre. The FX pixels of the old cells (material 6)
are carried over, the bolt cells are copied as they are.
"""
import json
import pathlib
import shutil
import sys

import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ART = HERE / "art"
ASSETS = HERE.parent.parent / "src" / "engine" / "assets"
META = json.loads((HERE / "heroes.json").read_text())
CW, CH = META["cell"]
COLS, ROWS = META["cols"], META["rows"]
STAND = 100                     # height of the stance on the sheet, fin included
SUIT, WHITE, VISOR, GOLD, INK, FX = 1, 2, 3, 4, 5, 6
INKC = INK * 8                  # a class is material * 8 + tone
INK_SHARE = 0.36

# drawing -> (source sheet, pose 0..7 in reading order). Optional third item, see build():
# dx, dy  nudge the figure;  front: n  lay its leading edge n px from the old one's instead of centring
# fxat    where the old cell's FX go: "tip" = moved as the striking fist or foot moved,
#         (x, y) = their centre on that pixel of the reduced figure (its hands). Without it they stay put.
POSES = {
    "stance": (0, 0), "stance_up": (1, 0), "stance_dn": (1, 1),
    "walk1": (1, 2), "walk2": (1, 3), "walk3": (1, 4), "walk4": (1, 5),
    "run1": (2, 0), "run2": (2, 1), "run3": (2, 2), "run4": (2, 3), "run5": (2, 4), "run6": (2, 5),
    "look1": (3, 0), "look2": (3, 1), "look3": (3, 2), "look4": (3, 3), "look5": (3, 4), "look6": (3, 5),
    "crouch": (3, 6), "rise": (3, 7),
    "dive": (4, 0), "tuck1": (4, 1), "tuck2": (4, 2),
    "skid1": (2, 6), "skid2": (2, 7),
    "hit": (4, 3), "fly": (4, 4), "land": (4, 5), "flat": (4, 6), "sit": (4, 7),
    "kneel": (5, 0), "windup": (5, 1), "pose": (5, 2), "pose_flash": (5, 2, {"fxat": (76, 16)}),
    "jab": (5, 3), "jab_hit": (5, 3, {"fxat": "tip"}), "cross": (5, 4), "cross_hit": (5, 4, {"fxat": "tip"}),
    # the roundhouse of the art is lower and shorter than the old one: it steps in to reach the hand
    "chamber": (5, 5, {"dx": 4}), "round": (5, 6, {"dx": 8}),
    "round_hit": (5, 6, {"fxat": "tip", "dx": 8}), "round_fade": (5, 6, {"fxat": "tip", "dx": 8}),
    "flykick1": (6, 0), "flykick2": (6, 1), "flykick": (6, 1),
    "gather1": (6, 2, {"fxat": (13, 60)}), "gather2": (6, 3, {"fxat": (10, 57)}), "gather3": (6, 4, {"fxat": (13, 53)}),
    "fire": (6, 5), "fire_flash": (6, 5, {"fxat": "tip"}), "fire_fade": (6, 5, {"fxat": "tip"}),
    "turn1": (1, 6), "turn2": (1, 7),
}
# per character: the atlas, the pose that sets the scale, and what differs from POSES
CHARS = {
    "hero0": {"atlas": "toku-hero-0.png", "stand": (0, 0), "poses": {}},
    "hero1": {"atlas": "toku-hero-1.png", "poses": {}},
    "hero2": {"atlas": "toku-hero-2.png", "poses": {}},
}


# ---------------------------------------------------------------- cut out
def figures(path):
    """The 8 poses of a sheet as straight-alpha RGBA arrays, in reading order."""
    a = np.asarray(Image.open(path).convert("RGBA")).copy()
    h, w = a.shape[:2]
    # a sheet can come with a faint haze instead of a clear background: whatever alpha the
    # border of the sheet has is background, and alpha counts from there up
    al = a[..., 3].astype(float)
    haze = np.percentile(np.concatenate([al[0], al[-1], al[:, 0], al[:, -1]]), 98)
    assert haze < 110, f"{path.name}: the background is not transparent enough to key on alpha"
    a[..., 3] = np.clip((al - haze - 8) * 255 / (247 - haze), 0, 255) if haze > 0 else a[..., 3]
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
        key = (min(1, int(ys.mean() * B * 2 // h)), min(3, int(xs.mean() * B * 4 // w)))
        cells.setdefault(key, []).append((n, i))
    out = []
    for r in range(2):
        for c in range(4):
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
def classify(fig):
    """Material * 8 + tone of every source pixel. The thresholds are constants,
    so a surface keeps its tone from one frame to the next."""
    c = fig[..., :3].astype(float) / 255
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    mx, mn = c.max(-1), c.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    lum = c @ np.array([0.299, 0.587, 0.114])
    green = (g > r * 1.15) & (g > b * 1.15) & (sat > 0.15)
    gold = (r > b * 1.4) & (g > b * 1.25) & (r >= g * 0.9) & (sat > 0.3)
    # the soft edge between a line and a surface is dark and coloured: it belongs to the line
    cls = np.where(lum > 0.35, WHITE * 8 + np.select([lum > 0.875, lum > 0.6], [4, 3], 2), INKC)
    cls = np.where(gold, np.where(lum > 0.3, GOLD * 8 + np.select([lum > 0.65, lum > 0.45], [4, 3], 2), INKC), cls)
    cls = np.where(green, np.where(mx > 0.24, SUIT * 8 + np.select([mx > 0.66, mx > 0.46], [5, 4], 2), INKC), cls)
    return np.where(mx < 0.2, INKC, cls)


# ---------------------------------------------------------------- reduce
def reduce(fig, s):
    """Classes of the figure at scale s (< 1), 0 where empty. Every output pixel
    takes the class most of its source pixels have; then the silhouette gets a
    one-pixel ink line and the line is thinned where it came out two thick."""
    h, w = fig.shape[:2]
    H, W = max(1, round(h * s)), max(1, round(w * s))
    yi = np.minimum((np.arange(h) + 0.5) * H / h, H - 1).astype(int)
    xi = np.minimum((np.arange(w) + 0.5) * W / w, W - 1).astype(int)
    idx = (yi[:, None] * W + xi[None, :]).ravel()
    al = fig[..., 3].ravel() / 255.0
    cover = np.bincount(idx, al, H * W) / np.maximum(np.bincount(idx, None, H * W), 1)
    cls = classify(fig).ravel()
    votes = np.zeros((48, H * W))
    for k in np.unique(cls):
        votes[k] = np.bincount(idx, al * (cls == k), H * W)
    ink = votes[INKC] >= INK_SHARE * votes.sum(0)           # lines are thin: a good third of a pixel is enough
    votes[INKC] = 0
    out = np.where(cover > 0.5, np.where(ink, INKC, votes.argmax(0)), 0).reshape(H, W)

    def nb(a, fill=0):                                      # up, down, left, right neighbours
        p = np.pad(a, 1, constant_values=fill)
        return p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]

    def nb2(a):                                             # two steps the opposite way
        p = np.pad(a, 2)
        return p[4:, 2:-2], p[:-4, 2:-2], p[2:-2, 4:], p[2:-2, :-4]

    edge = (out > 0) & np.logical_or.reduce([n == 0 for n in nb(out)])
    out[edge] = INKC
    # an ink pixel right behind the outline with paint right behind it: the line is two thick there
    res = out.copy()
    for e, inner in zip(nb(edge, False), nb2(out)):
        fix = (out == INKC) & ~edge & e & (inner > 0) & (inner != INKC) & (res == INKC)
        res[fix] = inner[fix]
    # a lone pixel of a class none of its neighbours has is noise from the vote
    n4 = nb(res)
    lone = (res > 0) & (res != INKC) & np.logical_and.reduce([n != res for n in n4])
    stack = np.stack(n4)
    for y, x in zip(*np.where(lone)):
        v = [k for k in stack[:, y, x] if k > 0 and k != INKC]
        if v:
            res[y, x] = max(set(v), key=v.count)
    return res


def scale():
    """One factor for the three heroes, so their builds keep their proportions: hero0's stance is STAND tall."""
    ref = CHARS["hero0"]["stand"]
    return STAND / figures(ART / f"hero0-{ref[0]}.png")[ref[1]].shape[0]


def sprites(char):
    """Every source pose of the character, reduced: {(sheet, pose): classes}."""
    paths = sorted(ART.glob(f"{char}-[0-9]*.png"))
    assert paths, f"no art for {char} in {ART}"
    figs = {(int(p.stem.split("-")[1]), i): f for p in paths for i, f in enumerate(figures(p))}
    s = scale()
    return {k: reduce(f, s) for k, f in figs.items()}


# ---------------------------------------------------------------- place
def encode(cls):
    out = np.zeros(cls.shape + (4,), np.uint8)
    out[..., 0] = (cls // 8) * 40
    out[..., 1] = np.where(cls // 8 == INK, 0, (cls % 8) * 50)
    out[..., 3] = (cls > 0) * 255
    return out


def bbox(mask):
    ys, xs = np.where(mask)
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1) if len(xs) else None


def tip(mask):
    """The striking end of a figure facing right: its right-most point above the feet."""
    ys, xs = np.where(mask)
    up = ys < ys.max() - 30
    x = xs[up].max()
    return np.array([x, round(ys[up & (xs >= x - 3)].mean())])


def build(char):
    cfg = CHARS[char]
    atlas = ASSETS / cfg["atlas"]
    layout = ART / f"layout-{char}.png"
    if not layout.exists():                                 # the sheet being replaced is the layout reference
        shutil.copyfile(atlas, layout)
    old = np.asarray(Image.open(layout).convert("RGBA"))
    assert old.shape == (ROWS * CH, COLS * CW, 4)
    spr = sprites(char)
    poses = {**POSES, **cfg["poses"]}
    sheet = np.zeros_like(old)
    for name, act in META["actions"].items():
        for first, hold, drawing in zip(act["frames"], act["hold"], act["drawings"]):
            for cell in range(first, first + hold):
                cy, cx = cell // COLS * CH, cell % COLS * CW
                oc = old[cy:cy + CH, cx:cx + CW]
                if drawing == "bolt":
                    sheet[cy:cy + CH, cx:cx + CW] = oc
                    continue
                src = poses[drawing]
                fig = spr[src[:2]]
                opt = src[2] if len(src) > 2 else {}
                omat = (oc[..., 0].astype(int) + 20) // 40
                fx = (oc[..., 3] > 127) & (omat == FX)
                ob = bbox((oc[..., 3] > 127) & (omat != FX))
                h, w = fig.shape
                assert w <= CW - 2 and h <= CH - 2, f"{drawing}: {w}x{h} does not fit a cell"
                # same bottom line and same centre as the old figure
                x = (ob[0] + ob[2]) // 2 - w // 2 + opt.get("dx", 0)
                if "front" in opt:                          # or the same leading edge, for a blow that has to land
                    x = ob[2] - w + opt["front"]
                y = ob[3] - h + opt.get("dy", 0)
                x, y = min(max(x, 1), CW - 1 - w), min(max(y, 1), CH - 1 - h)
                out = np.zeros((CH, CW, 4), np.uint8)
                fdx, fdy = 0, 0
                if fx.any() and "fxat" in opt:
                    if opt["fxat"] == "tip":
                        fdx, fdy = tip(fig > 0) + (x, y) - tip((oc[..., 3] > 127) & (omat != FX))
                    else:
                        fb = bbox(fx)
                        fdx, fdy = opt["fxat"][0] + x - (fb[0] + fb[2]) // 2, opt["fxat"][1] + y - (fb[1] + fb[3]) // 2
                    ys, xs = np.where(fx)                   # never out of the cell
                    fdx = int(np.clip(fdx, 1 - xs.min(), CW - 2 - xs.max()))
                    fdy = int(np.clip(fdy, 1 - ys.min(), CH - 2 - ys.max()))
                fxm = np.roll(fx, (fdy, fdx), (0, 1))
                out[fxm] = np.roll(oc, (fdy, fdx), (0, 1))[fxm]
                enc = encode(fig)
                over = drawing.endswith(("_hit", "_flash", "_fade")) or drawing.startswith(("gather", "fire", "hit"))
                m = enc[..., 3] > 0
                if over:                                    # a flash is in front of the figure, a trail behind it
                    m &= ~fxm[y:y + h, x:x + w]
                out[y:y + h, x:x + w][m] = enc[m]
                sheet[cy:cy + CH, cx:cx + CW] = out
    check(sheet, old)
    return sheet


def check(sheet, old):
    a = sheet[..., 3]
    assert set(np.unique(a)) <= {0, 255}, "alpha is not binary"
    op = a > 0
    assert set(np.unique(sheet[..., 0][op])) <= {40, 80, 120, 160, 200, 240}, "material out of the encoding"
    assert set(np.unique(sheet[..., 1][op])) <= {0, 50, 100, 150, 200, 250}, "tone out of the encoding"
    cells = op.reshape(ROWS, CH, COLS, CW)
    assert not (cells[:, [0, -1]].any() or cells[:, :, :, [0, -1]].any()), "a figure touches a cell edge"
    assert cells.any(axis=(1, 3)).all(), "empty cell"
    for cell in META["actions"]["bolt"]["frames"]:
        cy, cx = cell // COLS * CH, cell % COLS * CW
        assert (sheet[cy:cy + CH, cx:cx + CW] == old[cy:cy + CH, cx:cx + CW]).all(), "bolt cell changed"


# ---------------------------------------------------------------- preview
def colour(sheet, suit=(0.1, 1.0, 0.577), bg=(0.27, 0.43, 0.67)):
    """The indexed sheet as heroSprite() paints it (gSprLight = 1), through the app's tone curve."""
    suit = np.array(suit)

    def ramp(b, lv, lift):
        if lv > 4.5:
            return b * 0.5 + np.array([1.0, 0.95, 0.7]) * 0.5
        if lv > 3.5:
            return b
        k = (0.74 if lv > 2.5 else 0.5 if lv > 1.5 else 0.3) * (1 - lift) + lift
        cool = 0.12 if lv > 2.5 else 0.26 if lv > 1.5 else 0.44
        l = b @ np.array([0.299, 0.587, 0.114])
        return (b * (1 - cool * 0.6) + l * cool * 0.6) * k * (1 - cool) + (np.array([0.6, 0.5, 1.45]) * l * k + np.array([0.02, 0.015, 0.05])) * cool

    mat, lv, al = (sheet[..., 0].astype(int) + 20) // 40, (sheet[..., 1].astype(int) + 25) // 50, sheet[..., 3] > 127
    out = np.zeros(sheet.shape[:2] + (3,))
    out[:] = bg
    base = {SUIT: suit, WHITE: np.array([1.4, 1.4, 1.36]), VISOR: np.array([0.13, 0.16, 0.3]), GOLD: np.array([1.1, 0.8, 0.08])}
    for m in range(1, 7):
        for l in range(6):
            sel = al & (mat == m) & (lv == l)
            if not sel.any():
                continue
            if m == FX:
                c = np.array([1.0, 0.98, 0.9]) if l > 4 else suit * 0.4 + np.array([1.0, 0.96, 0.8]) * 0.6 if l > 2 else suit * 1.2
            elif m == INK:
                c = np.array([0.04, 0.03, 0.08])
            else:
                c = ramp(base[m], l, 0.0)
                if m == SUIT and l == 2:
                    c = c * 0.8
                if m == VISOR and l >= 4:
                    c = np.array([0.8, 0.88, 1.0])
            c = c * 1.1
            out[sel] = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14)
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), "RGB")


def main():
    args = sys.argv[1:]
    if not args or args[0] not in CHARS:
        sys.exit(__doc__)
    char = args[0]
    if "--poses" in args:
        spr = sprites(char)
        n = max(k[0] for k in spr) + 1
        sheet = np.zeros((n * CH, 8 * CW, 4), np.uint8)
        for (s, i), f in spr.items():
            h, w = f.shape
            sheet[s * CH + CH - 6 - h:s * CH + CH - 6, i * CW + (CW - w) // 2:i * CW + (CW - w) // 2 + w] = encode(f)
        im = colour(sheet)
        im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(args[args.index("--poses") + 1])
        return
    sheet = build(char)
    if "--strip" in args:
        im, k = colour(sheet), 1
        if "--action" in args:
            act = META["actions"][args[args.index("--action") + 1]]
            cells = [c for f, h in zip(act["frames"], act["hold"]) for c in range(f, f + h)]
            im = Image.fromarray(np.hstack([np.asarray(im)[c // COLS * CH:c // COLS * CH + CH, c % COLS * CW:c % COLS * CW + CW] for c in cells]))
            k = 3
        im.resize((im.width * k, im.height * k), Image.NEAREST).save(args[args.index("--strip") + 1])
        return
    Image.fromarray(sheet, "RGBA").save(ASSETS / CHARS[char]["atlas"], optimize=True)
    print("wrote", ASSETS / CHARS[char]["atlas"])


if __name__ == "__main__":
    main()
