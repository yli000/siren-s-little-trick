"""Scene props for the v2 atlas: clouds and the far island (trimmed from the prototype's kit.py)."""
import numpy as np
from PIL import Image, ImageDraw
import pix

r = pix.rgb
C = dict(
    cloud="#ffffff", cloud_s="#dff2ff",
    yellow_h="#ffe98a", coral="#f26b5e", moss="#7cc46b",
)


def cloud(img, x, y, w=30):
    """flat-bottomed puff with one shade row"""
    h = max(6, w // 3)
    m = Image.new("L", (w, h + 2), 0)
    d = ImageDraw.Draw(m)
    for (fx, fy, fd) in ((0.0, 0.45, 0.42), (0.2, 0.0, 0.5), (0.5, 0.2, 0.42), (0.68, 0.5, 0.32)):
        dd = int(w * fd)
        d.ellipse([int(fx * w), int(fy * h), int(fx * w) + dd, int(fy * h) + dd], fill=255)
    a = np.array(m) > 0
    a[h:, :] = False
    out = np.zeros((h + 2, w, 4), dtype=np.uint8)
    out[a] = r(C["cloud"])
    low = np.zeros_like(a); low[h - 2:h, :] = True
    out[a & low] = r(C["cloud_s"])
    img.alpha_composite(Image.fromarray(out, "RGBA"), (x, y))


def island(img, x, y):
    """far lighthouse island sitting on the horizon; softer outline than foreground sprites"""
    far = r("#4a5a86")
    d = ImageDraw.Draw(img)
    d.polygon([(x, y), (x + 4, y - 8), (x + 16, y - 12), (x + 34, y - 11), (x + 44, y - 5), (x + 46, y)], fill=r("#a9b3c6"), outline=far)
    d.polygon([(x + 30, y - 1), (x + 34, y - 10), (x + 44, y - 5), (x + 45, y - 1)], fill=r("#8b96ad"))
    d.polygon([(x + 3, y - 8), (x + 9, y - 13), (x + 22, y - 16), (x + 35, y - 14), (x + 38, y - 10), (x + 20, y - 9)], fill=r(C["moss"]), outline=far)
    d.line([(x + 12, y - 12), (x + 26, y - 14)], fill=r("#a8de88"))
    # lighthouse
    lx = x + 16
    d.rectangle([lx, y - 27, lx + 4, y - 16], fill=r("#ffffff"), outline=far)
    d.line([(lx + 1, y - 23), (lx + 3, y - 23)], fill=r(C["coral"]))
    d.line([(lx + 1, y - 19), (lx + 3, y - 19)], fill=r(C["coral"]))
    d.rectangle([lx - 1, y - 30, lx + 5, y - 28], fill=r(C["yellow_h"]), outline=far)
    d.polygon([(lx, y - 31), (lx + 2, y - 34), (lx + 4, y - 31)], fill=r(C["coral"]), outline=far)
    # house
    d.rectangle([x + 24, y - 20, x + 31, y - 15], fill=r("#ffffff"), outline=far)
    d.polygon([(x + 23, y - 20), (x + 27, y - 24), (x + 32, y - 20)], fill=r(C["coral"]), outline=far)
    img.alpha_composite(pix.foam_strip(52, 2), (x - 3, y - 2))
