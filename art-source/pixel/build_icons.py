"""Home-screen icons for the web version (PWA): the singing Siren rising out of the night sea.

    python3 art-source/pixel/build_icons.py

Writes game/web/icon-180.png (iPhone), icon-192.png, icon-512.png and icon-maskable-512.png (Android
crops this one to a circle or squircle, so everything that matters sits in the middle 80%).
Each pixel of the sprite is scaled by a whole number so the pixel art stays crisp.
The web/ folder is web-only: tools/pack.mjs leaves it out of the Xiaohongshu package.
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "game", "web"))
os.makedirs(OUT, exist_ok=True)

NIGHT = (22, 27, 69, 255)       # #161b45, the game's theme colour
STAR = (255, 243, 214, 255)
SEA = (47, 92, 196, 255)
SEA_HI = (96, 150, 240, 255)
FOAM = (255, 255, 255, 255)

SPRITE = Image.open(os.path.join(HERE, "siren", "sing.png")).convert("RGBA")
CROP = (22, 12, 94, 84)          # head, flower, mic and shoulders: 72 x 72 sprite pixels


def icon(size, scale, sea=0.84):
    """size: output px; scale: px per sprite pixel; sea: where the waterline sits (share of the icon height)."""
    im = Image.new("RGBA", (size, size), NIGHT)
    d = ImageDraw.Draw(im)
    p = scale                                           # one "pixel" of the background, same grid as the sprite
    for fx, fy, n in ((0.10, 0.12, 2), (0.84, 0.09, 1), (0.91, 0.36, 2), (0.16, 0.40, 1), (0.74, 0.22, 1), (0.05, 0.62, 1), (0.93, 0.60, 1)):
        x, y = int(fx * size) // p * p, int(fy * size) // p * p
        d.rectangle([x, y, x + n * p - 1, y + n * p - 1], fill=STAR)
    crop = SPRITE.crop(CROP)
    big = crop.resize((crop.width * scale, crop.height * scale), Image.NEAREST)
    line = int(size * sea) // p * p
    im.alpha_composite(big, ((size - big.width) // 2, line - big.height + 2 * p))
    # the sea in front, hiding where the crop ends: chunky pixel waves with a white crest
    w = 2 * p
    d.rectangle([0, line, size, size], fill=SEA)
    for i in range(0, size // w + 2):
        h = (0, 1, 1, 0, 0, 0)[i % 6]
        x0 = i * w
        d.rectangle([x0, line - h * p, x0 + w - 1, line], fill=SEA)
        d.rectangle([x0, line - h * p - p, x0 + w - 1, line - h * p - 1], fill=FOAM if h else SEA_HI)
    for fx, fy in ((0.18, 0.5), (0.62, 0.35), (0.84, 0.7)):
        x = int(fx * size) // p * p
        yy = line + max(3 * p, int((size - line) * fy)) // p * p
        if yy < size - p:
            d.rectangle([x, yy, x + 4 * p - 1, yy + p - 1], fill=SEA_HI)
    return im.convert("RGB")


if __name__ == "__main__":
    icon(180, 2, 0.86).save(os.path.join(OUT, "icon-180.png"), optimize=True)
    icon(192, 2, 0.86).save(os.path.join(OUT, "icon-192.png"), optimize=True)
    icon(512, 5).save(os.path.join(OUT, "icon-512.png"), optimize=True)
    icon(512, 4, 0.80).save(os.path.join(OUT, "icon-maskable-512.png"), optimize=True)
    print("icons ->", OUT)
