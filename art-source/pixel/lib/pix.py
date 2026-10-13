"""Pixel toolkit: vector -> pixel sprites, hand-pixelled sprites, UI primitives, text."""
import io, re, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import cairosvg

HERE = os.path.dirname(os.path.abspath(__file__))
INK = (43, 46, 66, 255)


def rgb(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


# ------------------------------------------------------------------ vector -> pixels
def _palette_of(svg):
    cols = sorted(set(c.lower() for c in re.findall(r"#[0-9a-fA-F]{6}", svg)))
    pal = np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in cols])
    extra = np.array([[255, 196, 196], [255, 170, 182], [255, 255, 255]])
    return np.vstack([pal, extra])


def pixelize(svg, out_w, out_h, k=6, out_thresh=0.3, alpha_keep=0.5, close=True):
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=out_w * k, output_height=out_h * k)
    im = np.array(Image.open(io.BytesIO(png)).convert("RGBA")).astype(int)
    pal = _palette_of(svg)
    ink = np.array(INK[:3])
    rgbv, a = im[..., :3], im[..., 3]
    d = ((rgbv[..., None, :] - pal[None, None, :, :]) ** 2).sum(-1)
    idx = d.argmin(-1)
    out_idx = int(((pal - ink) ** 2).sum(1).argmin())
    idx[a < 128] = -1
    H, W = out_h, out_w
    blocks = idx[:H * k, :W * k].reshape(H, k, W, k).transpose(0, 2, 1, 3).reshape(H, W, k * k)
    res = np.full((H, W), -1)
    for y in range(H):
        for x in range(W):
            b = blocks[y, x]
            n = b.size
            if (b == out_idx).sum() >= out_thresh * n:
                res[y, x] = out_idx
                continue
            if (b == -1).sum() > alpha_keep * n:
                continue
            v = b[(b != -1) & (b != out_idx)]
            if v.size == 0:
                res[y, x] = out_idx
                continue
            vals, cnt = np.unique(v, return_counts=True)
            res[y, x] = vals[cnt.argmax()]
    if close:
        filled = res != -1
        pad = np.pad(filled, 1)
        edge = filled & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
        res[edge] = out_idx
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if res[y, x] == out_idx:
                n4 = [res[y - 1, x], res[y + 1, x], res[y, x - 1], res[y, x + 1]]
                if all(v == n4[0] for v in n4) and n4[0] not in (-1, out_idx):
                    res[y, x] = n4[0]
    img = np.zeros((H, W, 4), dtype=np.uint8)
    m = res != -1
    img[m, :3] = pal[res[m]]
    img[m, 3] = 255
    return Image.fromarray(img, "RGBA")


def trim(im):
    box = im.getbbox()
    return im.crop(box) if box else im


def silhouette(im, color=(43, 46, 66, 255)):
    a = np.array(im)
    out = np.zeros_like(a)
    m = a[..., 3] > 0
    out[m] = color
    return Image.fromarray(out, "RGBA")


# ------------------------------------------------------------------ hand-pixelled sprites
def from_map(rows, legend):
    h, w = len(rows), max(len(r) for r in rows)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != "." and ch != " ":
                px[x, y] = legend[ch]
    return im


BASE_LEGEND = {"K": INK, "W": rgb("#ffffff"), "S": rgb("#dde6f3"), "R": rgb("#ef5b57"), "F": rgb("#ffffff"),
               "f": rgb("#bfe6ff"), "B": rgb("#9fdcff"), "Y": rgb("#ffcf3a"), "y": rgb("#d99a14"), "P": rgb("#ff9fb0")}

TUG_M = {
    "idle": [
        ".........KK......",
        ".........KRK.....",
        ".........KRRK....",
        ".........KK......",
        "....KKKKKKKKK....",
        "....KWWWWWWSK....",
        "....KWKWWWKSK....",
        "....KPWKKWPSK....",
        "..KKKKKKKKKKKKK..",
        "..KWWWWWWWWWWWK..",
        "..KKKKKKKKKKKKK..",
        "...KHHHHHHHHDK...",
        "...KHHHHHHHDDK...",
        ".F..KKKKKKKKK..F.",
        "FFFFFFFFFFFFFFFFF",
        ".fFFFfFFFFfFFFFf.",
    ],
    "dizzy": [
        ".........KK......",
        ".........KRK.....",
        ".........KRRK....",
        ".........KK......",
        "....KKKKKKKKK....",
        "....KKWKWKWKK....",
        "....KWKWWWKWK....",
        "....KKWKWKWKK....",
        "..KKKKKKKKKKKKK..",
        "..KWWWWWWWWWWWK..",
        "..KKKKKKKKKKKKK..",
        "...KHHHHHHHHDK...",
        "...KHHHHHHHDDK...",
        ".F..KKKKKKKKK..F.",
        "FFFFFFFFFFFFFFFFF",
        ".fFFFfFFFFfFFFFf.",
    ],
}
TUG_S = [
    "......KK...",
    "......KRK..",
    "...KKKKK...",
    "...KWWSK...",
    ".KKKKKKKKK.",
    ".KWWWWWWWK.",
    ".KKKKKKKKK.",
    "..KHHHHDK..",
    ".F.KKKKK.F.",
    "FFFFFFFFFFF",
]
TUG_XS = [
    "...KR..",
    "..KKK..",
    ".KWWWK.",
    "KKKKKKK",
    ".KHHHK.",
    "FFFFFFF",
]
HULLS = {"red": ("#ef5b57", "#c8403f"), "green": ("#5cc47a", "#3f9e5c"), "blue": ("#4a7fe0", "#345fb8"),
         "yellow": ("#f7c843", "#d9a124"), "purple": ("#a178e0", "#7e58c0"), "pink": ("#f07bbd", "#cd5a9b")}


def tug_small(size, color="red", face="idle"):
    rows = {"m": TUG_M[face], "s": TUG_S, "xs": TUG_XS}[size]
    lg = dict(BASE_LEGEND)
    lg["H"], lg["D"] = rgb(HULLS[color][0]), rgb(HULLS[color][1])
    return from_map(rows, lg)


ICON_MIC = [
    "...KKKKK...",
    "..KWWWWWK..",
    "..KWSSSWK..",
    "..KWWWWWK..",
    "..KWSSSWK..",
    "K.KWWWWWK.K",
    "K.KWSSSWK.K",
    "K..KWWWK..K",
    ".K..KKK..K.",
    "..KK...KK..",
    "....KKK....",
    ".....K.....",
    ".....K.....",
    "...KKKKK...",
]
ICON_NOTE = [
    "...yyyy..",
    "...yYYYy.",
    "...yYyYy.",
    "...yY.yy.",
    "...yY....",
    ".yyyY....",
    "yYYYY....",
    "yYYYy....",
    ".yyy.....",
]
ICON_NOTE2 = [
    "...yyyyyyy",
    "...yYYYYYy",
    "...yYyyyYy",
    "...yY...Yy",
    "...yY...Yy",
    ".yyyY.yyYy",
    "yYYYYyYYYy",
    "yYYYyyYYYy",
    ".yyy..yyy.",
]
ICON_HEART = [
    ".KK.KK.",
    "KRRKRRK",
    "KRRRRRK",
    ".KRRRK.",
    "..KRK..",
    "...K...",
]
ICON_BOOK = [
    ".KKKKKKKKKKK.",
    "KWWWWWKWWWWWK",
    "KWSSSWKWSSSWK",
    "KWWWWWKWWWWWK",
    "KWSSSWKWSSSWK",
    "KWWWWWKWWWWWK",
    "KWSSWWKWWSSWK",
    "KWWWWWKWWWWWK",
    "KKKKKKKKKKKKK",
    ".KKKKK.KKKKK.",
]
ICON_SHELL = [
    "...KKKKK...",
    "..KWSWSWK..",
    ".KWSWSWSWK.",
    "KWSWSWSWSWK",
    "KWSWSWSWSWK",
    ".KWSWSWSWK.",
    "..KWSWSWK..",
    "...KKKKK...",
    "....KWK....",
    "....KKK....",
]
ICON_GULL = [
    "K...K",
    ".K.K.",
    "..K..",
]


def icon(rows, extra=None):
    lg = dict(BASE_LEGEND)
    if extra:
        lg.update(extra)
    return from_map(rows, lg)


# ------------------------------------------------------------------ UI primitives
def rr_mask(w, h, r):
    m = np.ones((h, w), dtype=bool)
    r = min(r, w // 2, h // 2)
    for j in range(r):
        for i in range(r):
            if (r - 0.5 - i) ** 2 + (r - 0.5 - j) ** 2 > r * r + 0.3:
                m[j, i] = m[j, w - 1 - i] = m[h - 1 - j, i] = m[h - 1 - j, w - 1 - i] = False
    return m


def _edge(m):
    pad = np.pad(m, 1)
    return m & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])


def panel(img, x, y, w, h, fill, r=3, outline=INK, shadow=2, shade=None, hi=None):
    """pixel rounded panel: hard drop shadow, 1px outline, optional bottom shade band and top highlight line"""
    m = rr_mask(w, h, r)
    e = _edge(m)
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    arr[m] = fill
    if shade is not None:
        band = np.zeros_like(m)
        band[h - 4:h - 1, :] = True
        arr[m & band] = shade
    if hi is not None:
        band = np.zeros_like(m)
        band[1:2, :] = True
        inner = m & ~e
        arr[inner & band] = hi
    arr[e] = outline
    if shadow:
        sh = np.zeros((h, w, 4), dtype=np.uint8)
        sh[m] = outline
        img.alpha_composite(Image.fromarray(sh, "RGBA"), (x, y + shadow))
    img.alpha_composite(Image.fromarray(arr, "RGBA"), (x, y))


def disc(img, cx, cy, r, fill, outline=INK, shadow=2, hi=None):
    d = 2 * r + 1
    yy, xx = np.mgrid[0:d, 0:d]
    m = (xx - r) ** 2 + (yy - r) ** 2 <= r * r + r * 0.4
    e = _edge(m)
    arr = np.zeros((d, d, 4), dtype=np.uint8)
    arr[m] = fill
    if hi is not None:
        hm = ((xx - r + 2) ** 2 + (yy - r + 2) ** 2 <= (r - 3) ** 2) & ~((xx - r + 1) ** 2 + (yy - r + 1) ** 2 <= (r - 3) ** 2) & (xx < r) & (yy < r)
        arr[hm & m & ~e] = hi
    arr[e] = outline
    if shadow:
        sh = np.zeros((d, d, 4), dtype=np.uint8)
        sh[m] = outline
        img.alpha_composite(Image.fromarray(sh, "RGBA"), (cx - r, cy - r + shadow))
    img.alpha_composite(Image.fromarray(arr, "RGBA"), (cx - r, cy - r))


def rect(img, x, y, w, h, fill):
    ImageDraw.Draw(img).rectangle([x, y, x + w - 1, y + h - 1], fill=fill)


def paste(img, spr, x, y, anchor="tl"):
    if anchor == "bc":
        x, y = x - spr.width // 2, y - spr.height
    elif anchor == "c":
        x, y = x - spr.width // 2, y - spr.height // 2
    img.alpha_composite(spr, (int(x), int(y)))


def scale(spr, n):
    return spr.resize((spr.width * n, spr.height * n), Image.NEAREST)


def flip(spr):
    return spr.transpose(Image.FLIP_LEFT_RIGHT)


# ------------------------------------------------------------------ text (preview only)
_fonts = {}


def font(px=12):
    if px not in _fonts:
        _fonts[px] = ImageFont.truetype(os.path.join(HERE, f"fusion{px}px.ttf"), px)
    return _fonts[px]


def text_sprite(s, px=12, fill=INK, mult=1, outline=None, shadow=None):
    """glyphs are scaled first, then outlined by exactly 1 logical px (matches a 4px CSS text-shadow)"""
    f = font(px)
    asc, desc = f.getmetrics()
    adv = int(round(f.getlength(s)))
    m = Image.new("L", (adv + 2, asc + desc), 0)
    d = ImageDraw.Draw(m)
    d.fontmode = "1"
    d.text((0, 0), s, font=f, fill=255)
    if mult > 1:
        m = m.resize((m.width * mult, m.height * mult), Image.NEAREST)
    g = np.array(m) > 127
    pad = 3
    G = np.pad(g, pad)
    h, w = G.shape
    out = np.zeros((h, w, 4), dtype=np.uint8)
    if outline:
        O = np.zeros_like(G)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                O |= np.roll(np.roll(G, dy, 0), dx, 1)
        if shadow:
            out[np.roll(O, 2, 0)] = shadow
        out[O] = outline
    elif shadow:
        out[np.roll(G, 1, 0)] = shadow
    out[G] = fill
    return Image.fromarray(out, "RGBA"), dict(pad=pad, asc=asc * mult, desc=desc * mult, adv=adv * mult)


def wrap(s, px, width):
    f = font(px)
    lines, cur = [], ""
    for ch in s:
        if ch == "\n":
            lines.append(cur); cur = ""; continue
        if f.getlength(cur + ch) > width:
            lines.append(cur); cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


# ------------------------------------------------------------------ foam
FOAM_EDGE = rgb("#a9dcff")


def soften_foam(im, y0):
    """the auto outline wraps foam in ink; below y0, ink that only touches foam turns into a soft blue edge"""
    a = np.array(im)
    H, W = a.shape[:2]
    ink = (a[..., 0] == INK[0]) & (a[..., 1] == INK[1]) & (a[..., 2] == INK[2]) & (a[..., 3] > 0)
    white = (a[..., 0] > 250) & (a[..., 1] > 250) & (a[..., 2] > 250) & (a[..., 3] > 0)
    soft = (a[..., 0] == FOAM_EDGE[0]) & (a[..., 1] == FOAM_EDGE[1]) & (a[..., 3] > 0)
    empty = a[..., 3] == 0
    other = ~(ink | white | soft | empty)
    out = a.copy()
    for y in range(y0, H):
        for x in range(W):
            if not ink[y, x]:
                continue
            ys, xs = slice(max(0, y - 1), y + 2), slice(max(0, x - 1), x + 2)
            if other[ys, xs].any():
                continue
            if white[ys, xs].any() or soft[ys, xs].any():
                out[y, x] = FOAM_EDGE if (y == H - 1 or empty[min(H - 1, y + 1), x] or y > H - 3) else (255, 255, 255, 255)
    # lonely leftovers
    return Image.fromarray(out, "RGBA")


def foam_strip(w, seed=0):
    """hand pattern: scalloped top, solid middle, dotted blue underside"""
    rnd = np.random.default_rng(seed)
    im = Image.new("RGBA", (w, 5), (0, 0, 0, 0))
    px = im.load()
    for x in range(2, w - 2):
        if (x + seed) % 4 in (0, 1):
            px[x, 0] = (255, 255, 255, 255)
    for x in range(1, w - 1):
        px[x, 1] = (255, 255, 255, 255)
    for x in range(0, w):
        px[x, 2] = (255, 255, 255, 255)
    for x in range(1, w - 1):
        px[x, 3] = FOAM_EDGE if (x + seed) % 5 in (0, 1) else (255, 255, 255, 255)
    for x in range(3, w - 3):
        if (x + seed) % 7 in (0, 1, 2):
            px[x, 4] = FOAM_EDGE
    return im


def with_foam(spr, seed=0, extra=3):
    w, h = spr.size
    out = Image.new("RGBA", (w + 2 * extra, h + 3), (0, 0, 0, 0))
    out.alpha_composite(spr, (extra, 0))
    out.alpha_composite(foam_strip(w + 2 * extra, seed), (0, h - 2))
    px = out.load()
    px[0, h - 5] = (255, 255, 255, 255)
    px[w + 2 * extra - 1, h - 4] = (255, 255, 255, 255)
    return out
