#!/usr/bin/env python3
"""Genera build/dmg-background.png (660x400) e @2x. Uso: python3 scripts/make-dmg-background.py
Icone posizionate da package.json build.dmg.contents: app (165,200), Applications (495,200)."""
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 660, 400
BG, ACC = (10, 10, 14), (0, 255, 136)
FONT = "/System/Library/Fonts/SFNS.ttf"  # ponytail: font di sistema macOS, lo script gira solo su Mac


def render(s):
    w, h = W * s, H * s
    # alone verde molto tenue al centro, vignettatura ai bordi
    y, x = np.mgrid[0:h, 0:w]
    d = np.hypot((x - w / 2) / w, (y - h * 0.5) / h)
    glow = np.clip(1 - d * 2.2, 0, 1) ** 2 * 0.07
    img = np.zeros((h, w, 3), float)
    for i in range(3):
        img[..., i] = BG[i] + (ACC[i] - BG[i]) * glow
    im = Image.fromarray(img.astype("uint8"))
    dr = ImageDraw.Draw(im)
    f = lambda sz: ImageFont.truetype(FONT, sz * s)
    t = "DJtoGraphikz"
    tw = dr.textlength(t, font=f(30))
    dr.text(((w - tw) / 2, 38 * s), t, font=f(30), fill=(235, 235, 240))
    dr.rectangle([w / 2 - 20 * s, 84 * s, w / 2 + 20 * s, 85 * s + s // 2], fill=ACC)
    # freccia tra le due icone (y=200)
    cy, x0, x1 = 200 * s, 255 * s, 405 * s
    lw = 3 * s
    dr.line([x0, cy, x1 - 10 * s, cy], fill=ACC, width=lw)
    dr.polygon([(x1, cy), (x1 - 18 * s, cy - 11 * s), (x1 - 18 * s, cy + 11 * s)], fill=ACC)
    t2 = "DRAG TO APPLICATIONS"
    f2 = ImageFont.truetype(FONT, 11 * s)
    sp = 2 * s
    tw2 = sum(dr.textlength(c, font=f2) + sp for c in t2) - sp
    xx = (w - tw2) / 2
    for c in t2:
        dr.text((xx, 330 * s), c, font=f2, fill=(140, 140, 150))
        xx += dr.textlength(c, font=f2) + sp
    return im


if __name__ == "__main__":
    render(1).save("build/dmg-background.png")
    render(2).save("build/dmg-background@2x.png")
