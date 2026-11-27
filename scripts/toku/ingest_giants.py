#!/usr/bin/env python3
"""Turns the approved pose sheets of the giant hand and the giant foot into their sprite sheets.

    python3 scripts/toku/ingest_giants.py hand                  writes src/engine/assets/toku-hand.png
    python3 scripts/toku/ingest_giants.py foot                  writes src/engine/assets/toku-foot.png
    python3 scripts/toku/ingest_giants.py hand --strip out.png  the sheet as the shader shows it, on a flat ground
    python3 scripts/toku/ingest_giants.py hand --poses out.png  every source pose after reduction, x2

Source: scripts/toku/art/hand-<n>.png and foot-0.png, 6 poses each on a 3x2 grid
("fake" pixel art, pixels about 4 source pixels wide; hand-1 comes on an opaque
pale ground and is keyed on colour). The steps are the ones of ingest.py, whose
helpers are used: every source pixel is classified into a material and a tone,
the pose is reduced by a majority vote of those classes and gets its one-pixel
ink outline, so no colour that is not in the palette can appear. The giants
are big on screen (the hand is half the size of its art, the foot three
quarters), so their lines come out two or three pixels thick: the foot's are
thinned by one.

The sheets are colour encoded, as titanHand() and footSprite() read them: the
palette is the mean colour of each class in the art, taken back through the
app's tone curve so the screen shows the art's colours.

Hand: 6 x 3 cells of 288 px, cells as listed in hand.json. The arm comes in
from the left and its cut end is on column CUTX: titanHand() never shows it,
the arm slides out from behind the jamb of the bay. Each drawing sits on its own
line, see HAND. Foot: 4 x 2 cells of 384 x 352, sole on row 344, claw tips
where the old sheet had them (art/layout-foot.png, saved on the first run).
"""
import json
import pathlib
import shutil
import sys

import numpy as np
from PIL import Image

import ingest as ing

HERE = pathlib.Path(__file__).resolve().parent
ART = HERE / "art"
ASSETS = HERE.parent.parent / "src" / "engine" / "assets"
INKC = ing.INKC
LUMA = np.array([0.299, 0.587, 0.114])
# the shader multiplies the sheet by this: ivory is brighter than the tone curve lets a sheet value of 1 come out
GAIN = {"hand": 1.0, "foot": 2.0}

# ---------------------------------------------------------------- what is drawn where
# hand: drawing of hand.json -> (sheet, pose 0..5 in reading order, line)
# line: "arm"    the middle of the forearm's cut end on row ARMY: the arm holds still, the hand works
#       "ground" the lowest pixel of the hand on row GROUND: what touches the plaza is always on the same row
CUTX, ARMY, GROUND = 40, 150, 205
HAND = {
    "open": (0, 0, "arm"), "grope1": (1, 0, "arm"), "grope2": (1, 1, "arm"), "cup": (0, 1, "arm"),
    "pat": (1, 2, "ground"), "claw": (0, 2, "arm"), "half": (0, 3, "arm"), "shut": (1, 3, "arm"),
    "fist": (0, 4, "arm"), "windup": (0, 5, "arm"), "slam1": (1, 4, "ground"), "slam2": (1, 5, "ground"),
    "shake1": (2, 0, "arm"), "shake2": (2, 1, "arm"), "limp": (2, 2, "arm"), "slack": (2, 3, "arm"),
    "pullback": (2, 4, "arm"),                              # not used: (2, 5), the pointing hand
}
# foot: cell -> pose of foot-0.png. Seven cells are used by the shader, the art has six poses:
# the second impact frame is the planted foot (the squash lasts one frame), cell 7 is spare
FOOT = [0, 1, 2, 3, 3, 4, 5, 3]
FOOT_NAMES = ["descend1", "descend2", "impact1", "impact2", "planted", "lift1", "lift2", "spare"]

CHARS = {
    "hand": {"atlas": "toku-hand.png", "sheets": ["hand-0", "hand-1", "hand-2"], "base": 0.44, "thin": 0,
             "tones": {1: 4, 2: 4, 3: 2}},                  # skin, fur, nail
    "foot": {"atlas": "toku-foot.png", "sheets": ["foot-0"], "base": 0.75, "thin": 1,
             "tones": {1: 4, 2: 4}},                        # hide, bone (shin plates and claws)
}


# ---------------------------------------------------------------- cut out
def load(path):
    """RGB 0..1 and the mask of what is drawn. A sheet on an opaque ground is keyed on colour:
    the ground is whatever pale, grey pixel can be reached from the border of the sheet."""
    a = np.asarray(Image.open(path).convert("RGBA")).astype(float) / 255
    rgb, al = a[..., :3], a[..., 3]
    if np.percentile(al, 2) < 0.2:
        return rgb, al > 0.5
    mx, mn = rgb.max(-1), rgb.min(-1)
    pale = (rgb @ LUMA > 0.6) & ((mx - mn) / np.maximum(mx, 1e-6) < 0.3)
    bg = np.zeros_like(pale)
    bg[[0, -1]] = pale[[0, -1]]
    bg[:, [0, -1]] = pale[:, [0, -1]]
    while True:                                             # flood from the border through the pale pixels
        p = np.pad(bg, 1)
        n = (p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]) & pale
        if (n == bg).all():
            break
        bg = n
    return rgb, ~bg


def split(mask, cols=3, rows=2):
    """Bounding box and mask of the figure in each grid cell, in reading order. A figure
    belongs to the cell its centre is in, so one that spills over a grid line stays whole."""
    h, w = mask.shape
    B = 4
    m = mask[: h // B * B, : w // B * B].reshape(h // B, B, w // B, B).any(axis=(1, 3))
    lab = np.where(m, np.arange(m.size).reshape(m.shape) + 1, 0)
    while True:
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
            assert comps, f"no figure in grid cell {r},{c}"
            big = max(comps)[0]
            keep = np.kron(np.isin(lab, [i for n, i in comps if n >= 0.02 * big]), np.ones((B, B), bool))
            full = np.zeros((h, w), bool)
            full[: keep.shape[0], : keep.shape[1]] = keep
            full &= mask
            ys, xs = np.where(full)
            out.append(((ys.min(), ys.max() + 1, xs.min(), xs.max() + 1), full))
    return out


# ---------------------------------------------------------------- classify
def materials(char, rgb):
    """Material of every source pixel: 0 = ink, else the materials of CHARS[char]["tones"]."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    lum = rgb @ LUMA
    if char == "hand":
        fur = (r - b) / np.maximum(mx, 1e-6) > 0.4
        mat = np.where(fur, 2, np.where((sat < 0.2) & (lum > 0.5), 3, 1))
        return np.where((mx < 0.14) | (~fur & (lum < 0.15)), 0, mat)
    mat = np.where(b > r + 0.02, 1, 2)
    return np.where((mx < 0.17) | ((mat == 2) & (lum < 0.36)), 0, mat)       # a dark warm grey is the soft edge of a line


def tones(lum, n):
    """Thresholds that cut the luminances of one material of one sheet into n tones (1-D k-means):
    worked out per sheet, because the sheets were not all generated equally bright."""
    c = np.percentile(lum, (np.arange(n) + 0.5) * 100 / n)
    for _ in range(30):
        k = np.abs(lum[:, None] - c[None, :]).argmin(1)
        c = np.array([lum[k == i].mean() if (k == i).any() else c[i] for i in range(n)])
    return (c[1:] + c[:-1]) / 2


def classes(char, rgb, mask):
    """Material * 8 + tone (1 = darkest) of every pixel of a sheet, INKC for the lines."""
    mat = materials(char, rgb)
    lum = rgb @ LUMA
    cls = np.full(mat.shape, INKC)
    for m, n in CHARS[char]["tones"].items():
        sel = mask & (mat == m)
        cls[mat == m] = m * 8 + 1 + np.searchsorted(tones(lum[sel][::7], n), lum[mat == m])
    return cls


# ---------------------------------------------------------------- reduce, enlarge
def thin(c, rounds):
    """Lines one pixel thinner: an ink pixel with paint on one side and ink on the other gives
    way to the paint, one side at a time so a line can never vanish."""
    for _ in range(rounds):
        for dy, dx in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            p = np.pad(c, 1)
            near = p[1 - dy:p.shape[0] - 1 - dy, 1 - dx:p.shape[1] - 1 - dx]     # the neighbour on this side
            far = p[1 + dy:p.shape[0] - 1 + dy, 1 + dx:p.shape[1] - 1 + dx]      # and the one opposite
            go = (c == INKC) & (near > 0) & (near != INKC) & (far == INKC)
            c = np.where(go, near, c)
    return c


def outline(c):
    p = np.pad(c, 1)
    edge = (c > 0) & ((p[:-2, 1:-1] == 0) | (p[2:, 1:-1] == 0) | (p[1:-1, :-2] == 0) | (p[1:-1, 2:] == 0))
    return np.where(edge, INKC, c)


def sprites(char):
    """Every source pose of the character at its size on the sheet: {(sheet, pose): classes}."""
    cfg = CHARS[char]
    out = {}
    PAD, TRIM = 16, 8                                       # an open end (the arm, the leg) is drawn on past the cut
    for si, name in enumerate(cfg["sheets"]):
        rgb, mask = load(ART / f"{name}.png")
        cls = classes(char, rgb, mask)
        for pi, ((y0, y1, x0, x1), full) in enumerate(split(mask)):
            fig = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
            fig[..., 0] = cls[y0:y1, x0:x1]
            fig[..., 3] = full[y0:y1, x0:x1] * 255
            if char == "hand":                              # the ragged first columns (rows) of the cut go
                fig = fig[:, TRIM:]
                fig = np.concatenate([np.repeat(fig[:, :1], PAD, 1), fig], 1)
            else:
                fig = fig[TRIM:]
                fig = np.concatenate([np.repeat(fig[:1], PAD, 0), fig], 0)
            ing.classify = lambda f: f[..., 0].astype(int)  # reduce() votes on the classes worked out above
            small = ing.reduce(fig, cfg["base"])
            big = outline(thin(small, cfg["thin"]))
            cut = round(PAD * cfg["base"])
            out[(si, pi)] = big[:, cut:] if char == "hand" else big[cut:]
    return out


# ---------------------------------------------------------------- palette
def untone(c):
    """The sheet value that the app's tone curve (c * 1.1, then the filmic curve) brings to c."""
    y = np.clip(np.asarray(c, float), 0, 0.98)
    a, b, k = 2.51 - 2.43 * y, 0.03 - 0.59 * y, -0.14 * y
    return (-b + np.sqrt(b * b - 4 * a * k)) / (2 * a) / 1.1


def tone(c):
    c = np.asarray(c, float) * 1.1
    return (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14)


def palette(char):
    """Sheet colour (0..255) of every class: the mean colour the class has in the art."""
    acc = {}
    for name in CHARS[char]["sheets"]:
        rgb, mask = load(ART / f"{name}.png")
        cls = classes(char, rgb, mask)
        for k in np.unique(cls[mask]):
            s, n = acc.get(k, (0, 0))
            acc[k] = (s + rgb[mask & (cls == k)].sum(0), n + (mask & (cls == k)).sum())
    pal = {k: np.round(np.clip(untone(s / n) / GAIN[char], 0, 1) * 255).astype(np.uint8) for k, (s, n) in acc.items()}
    pal[INKC] = np.round(np.array([0.04, 0.03, 0.08]) / GAIN[char] * 255).astype(np.uint8)       # INK of the shaders
    return pal


def paint(cls, pal):
    out = np.zeros(cls.shape + (4,), np.uint8)
    for k in np.unique(cls[cls > 0]):
        out[cls == k] = (*pal[k], 255)
    return out


# ---------------------------------------------------------------- place
def build_hand():
    meta = json.loads((HERE / "hand.json").read_text())
    CW, CH = meta["cell"]
    cols = meta["cols"]
    spr, pal = sprites("hand"), palette("hand")
    rows = -(-len(meta["drawings"]) // cols)
    sheet = np.zeros((rows * CH, cols * CW, 4), np.uint8)
    for cell, drawing in enumerate(meta["drawings"]):
        s, p, line = HAND[drawing]
        fig = spr[(s, p)]
        h, w = fig.shape
        if line == "arm":
            ys = np.where((fig[:, :6] > 0).any(1))[0]
            y = ARMY - (ys.min() + ys.max() + 1) // 2
        else:
            y = GROUND - np.where((fig[:, w // 3:] > 0).any(1))[0].max()         # the hand, not the fur of the arm
        assert 1 <= y and y + h <= CH - 1 and CUTX + w <= CW - 1, f"{drawing}: {w}x{h} at row {y} does not fit a cell"
        cy, cx = cell // cols * CH, cell % cols * CW
        sheet[cy + y:cy + y + h, cx + CUTX:cx + CUTX + w] = paint(fig, pal)
    return sheet


def build_foot():
    meta = json.loads((HERE / "kaiju.json").read_text())["foot"]
    CW, CH = meta["cell"]
    cols = meta["cols"]
    atlas = ASSETS / CHARS["foot"]["atlas"]
    layout = ART / "layout-foot.png"
    if not layout.exists():                                 # the sheet being replaced is the layout reference
        shutil.copyfile(atlas, layout)
    old = np.asarray(Image.open(layout).convert("RGBA"))
    spr, pal = sprites("foot"), palette("foot")
    sheet = np.zeros((2 * CH, cols * CW, 4), np.uint8)
    for cell, pose in enumerate(FOOT):
        fig = spr[(0, pose)]
        h, w = fig.shape
        cy, cx = cell // cols * CH, cell % cols * CW
        ob = ing.bbox(old[cy:cy + CH, cx:cx + CW, 3] > 127)
        # the claw tips and the lowest point where the old foot had them
        x, y = ob[2] - w, ob[3] - h
        x, y = min(max(x, 0), CW - w), max(y, 0)
        out = np.zeros((CH, CW, 4), np.uint8)
        out[y:y + h, x:x + w] = paint(fig, pal)[:CH - y]
        out[:y] = out[y]                                    # above the art the leg goes on to the top of the cell
        sheet[cy:cy + CH, cx:cx + CW] = out
    return sheet


def check(sheet, pal):
    assert set(np.unique(sheet[..., 3])) <= {0, 255}, "alpha is not binary"
    cols = {tuple(c) for c in sheet[sheet[..., 3] > 0][:, :3]}
    assert cols <= {tuple(c) for c in pal.values()}, "a colour that is not in the palette"


def flat(sheet, gain, bg=(0.27, 0.43, 0.67)):
    """The sheet as the shader shows it (gSprLight = 1), through the app's tone curve."""
    c = tone(sheet[..., :3] / 255.0 * gain)
    c[sheet[..., 3] < 128] = bg
    return Image.fromarray((np.clip(c, 0, 1) * 255).astype(np.uint8), "RGB")


def main():
    args = sys.argv[1:]
    if not args or args[0] not in CHARS:
        sys.exit(__doc__)
    char = args[0]
    pal = palette(char)
    if "--poses" in args:
        spr = sprites(char)
        ch = max(f.shape[0] for f in spr.values()) + 8
        cw = max(f.shape[1] for f in spr.values()) + 8
        n = max(k[0] for k in spr) + 1
        sheet = np.zeros((n * ch, 6 * cw, 4), np.uint8)
        for (s, i), f in spr.items():
            sheet[s * ch + 4:s * ch + 4 + f.shape[0], i * cw + 4:i * cw + 4 + f.shape[1]] = paint(f, pal)
        im = flat(sheet, GAIN[char])
        im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(args[args.index("--poses") + 1])
        return
    sheet = build_hand() if char == "hand" else build_foot()
    check(sheet, pal)
    if "--strip" in args:
        flat(sheet, GAIN[char]).save(args[args.index("--strip") + 1])
        return
    Image.fromarray(sheet, "RGBA").save(ASSETS / CHARS[char]["atlas"], optimize=True)
    print("wrote", ASSETS / CHARS[char]["atlas"])
    print("palette (as the screen shows it):", {int(k): [round(float(v), 3) for v in tone(c / 255.0 * GAIN[char])] for k, c in sorted(pal.items())})


if __name__ == "__main__":
    main()
