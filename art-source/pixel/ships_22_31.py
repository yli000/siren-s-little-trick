"""Source of the 10 ships #22–31 (their SVGs are already appended to ships-svg.json; rerun only to redraw them).
Drawn in the same conventions as art-source/pixel/ships-svg.json:
viewBox -160 -160 320 260, ink outlines #2b2e42, flat fills with a darker clipped shade on the right,
the shared face set, and the shared foam at the waterline. Writes new-ships-svg.json next to this file;
to apply a redraw, replace the last 10 entries of ships-svg.json with it and run build.py."""
import json, os

INK = "#2b2e42"
HERE = os.path.dirname(os.path.abspath(__file__))


# ------------------------------------------------------------------ shared pieces (same as the existing 21)
def face(kind, x, y, s=0.6, rot=0):
    blush = '<ellipse cx="-42" cy="-8" rx="9" ry="5" fill="#ff9fb0" opacity=".8"/><ellipse cx="42" cy="-8" rx="9" ry="5" fill="#ff9fb0" opacity=".8"/>'
    eyes = ('<ellipse cx="-24" cy="-24" rx="6.5" ry="9" fill="%s"/><circle cx="-22" cy="-28" r="2.6" fill="#fff"/>'
            '<ellipse cx="24" cy="-24" rx="6.5" ry="9" fill="%s"/><circle cx="26" cy="-28" r="2.6" fill="#fff"/>') % (INK, INK)
    smile = '<path d="M-9,-5 Q0,3 9,-5" fill="none" stroke="%s" stroke-width="4.5" stroke-linecap="round"/>' % INK
    if kind == "happy":
        body = eyes + smile + blush
    elif kind == "calm":       # eyes closed, content
        body = ('<path d="M-34,-22 Q-24,-31 -14,-22 M14,-22 Q24,-31 34,-22" fill="none" stroke="%s" stroke-width="5" stroke-linecap="round"/>' % INK) + smile + blush
    elif kind == "small":      # dot eyes, w mouth
        body = ('<circle cx="-22" cy="-24" r="6" fill="%s"/><circle cx="-20" cy="-26.5" r="2" fill="#fff"/>'
                '<circle cx="22" cy="-24" r="6" fill="%s"/><circle cx="24" cy="-26.5" r="2" fill="#fff"/>'
                '<path d="M-9,-10 Q-4.5,-4 0,-10 Q4.5,-4 9,-10" fill="none" stroke="%s" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>') % (INK, INK, INK) + blush
    elif kind == "dark":       # for a black body: white eyes with ink pupils, white smile
        body = ('<ellipse cx="-24" cy="-24" rx="9" ry="11" fill="#fff" stroke="%s" stroke-width="2.5"/><ellipse cx="-23" cy="-22" rx="5" ry="7" fill="%s"/><circle cx="-21" cy="-25" r="2" fill="#fff"/>'
                '<ellipse cx="24" cy="-24" rx="9" ry="11" fill="#fff" stroke="%s" stroke-width="2.5"/><ellipse cx="25" cy="-22" rx="5" ry="7" fill="%s"/><circle cx="27" cy="-25" r="2" fill="#fff"/>'
                '<path d="M-9,-4 Q0,4 9,-4" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>') % (INK, INK, INK, INK) + blush
    else:
        raise ValueError(kind)
    return '<g transform="translate(%s,%s) rotate(%s) scale(%s)">%s</g>' % (x, y, rot, s, body)


def foam(hw, y):
    peaks = [33.7, 22.7, 30.7, 27.8, 33.3, 26.9, 33.0]
    n = len(peaks)
    step = 2 * hw / n
    d = "M%s,%s L%s,%s" % (-hw, y + 14, -hw, y)
    for i, p in enumerate(peaks):
        x0 = -hw + i * step
        d += " Q%.1f,%.1f %.1f,%s" % (x0 + step / 2, y - p, x0 + step, y)
    d += " L%s,%s Q0,%s %s,%s Z" % (hw, y + 14, y + 26, -hw, y + 14)
    return ('<path d="%s" fill="#fff" stroke="#a9dcff" stroke-width="3" stroke-linejoin="round"/>' % d
            + '<path d="M%.1f,%s Q0,%s %.1f,%s" fill="none" stroke="#d6efff" stroke-width="4" stroke-linecap="round"/>' % (-0.7 * hw, y + 12, y + 20, 0.7 * hw, y + 12)
            + '<circle cx="%s" cy="%s" r="5" fill="#fff"/><circle cx="%s" cy="%s" r="4" fill="#fff"/>' % (-hw - 4, y - 16, hw + 6, y - 10)
            + '<circle cx="%s" cy="%s" r="3.2" fill="#fff"/><circle cx="%s" cy="%s" r="3.6" fill="#fff"/>' % (-hw + 18, y - 34, hw - 10, y - 36))


def shape(cid, d, fill, shade=None, shade_x=None, sw=5.5, extra=""):
    """A filled path with a darker band clipped to its right side, then the ink outline on top."""
    out = '<clipPath id="%s"><path d="%s"/></clipPath><path d="%s" fill="%s"/>' % (cid, d, d, fill)
    if shade:
        out += '<rect x="%s" y="-170" width="400" height="300" fill="%s" clip-path="url(#%s)"/>' % (shade_x, shade, cid)
    out += extra.replace("CLIP", "url(#%s)" % cid)
    out += '<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>' % (d, INK, sw)
    return out


def stick(d, color, w=4, ink_w=10):
    return ('<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round"/>' % (d, INK, ink_w)
            + '<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round"/>' % (d, color, w))


def note(x, y, s=1.0, rot=-12):
    return ('<g transform="translate(%s,%s) rotate(%s) scale(%s)"><ellipse cx="0" cy="0" rx="8" ry="6" fill="%s" transform="rotate(-20)"/>'
            '<path d="M6.5,-2 L6.5,-30 Q14,-26 18,-18" fill="none" stroke="%s" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>') % (x, y, rot, s, INK, INK)


def svg(body):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-160 -160 320 260">%s</svg>' % body


# ------------------------------------------------------------------ 22 乌篷船
def wupeng():
    b = ""
    for x, y in ((-96, -104), (-40, -128), (20, -112), (78, -132), (120, -96)):        # rain
        b += '<path d="M%s,%s q7,12 0,18 q-7,-6 0,-18 Z" fill="#8fd0ff" stroke="%s" stroke-width="3" stroke-linejoin="round"/>' % (x, y, INK)
    b += stick("M104,-34 L150,62", "#c98a52", 4.5, 11)                                    # 橹
    awning = "M-64,14 L-64,-26 Q-62,-66 -2,-68 Q58,-66 60,-26 L60,14 Z"
    weave = "".join('<path d="M%s,-80 l46,100 M%s,-80 l-46,100" stroke="#575d7c" stroke-width="3" clip-path="CLIP"/>' % (x, x) for x in range(-90, 100, 18))
    b += shape("wp1", awning, "#3e4359", "#353a4f", 30, 5, weave)
    b += shape("wp2", "M64,14 L64,-14 Q66,-36 94,-36 L96,14 Z", "#3e4359", "#353a4f", 84, 4.5,
               '<path d="M62,-30 l40,50 M80,-40 l-30,60" stroke="#575d7c" stroke-width="3" clip-path="CLIP"/>')
    hull = "M-138,-14 Q-120,10 -60,14 L60,14 Q120,10 138,-14 Q126,38 76,58 L-76,58 Q-126,38 -138,-14 Z"
    b += shape("wp3", hull, "#b7814f", "#9a6a3e", 70, 5.5,
               '<path d="M-126,16 Q0,44 126,16" fill="none" stroke="#8a5a32" stroke-width="3.5" clip-path="CLIP"/>')
    b += '<path d="M-134,-10 Q-120,8 -60,12 L60,12 Q120,8 134,-10" fill="none" stroke="#7a4a28" stroke-width="3" opacity=".6"/>'
    b += face("happy", -6, 46, 0.55)
    b += foam(138, 80)
    return b


# ------------------------------------------------------------------ 23 橡皮鸭
def duck():
    b = note(132, -86, 0.9)
    body = "M-124,-34 Q-100,-10 -84,-12 Q-30,-18 20,-14 Q100,-16 106,26 Q102,72 0,74 Q-104,72 -114,30 Q-120,4 -124,-34 Z"
    b += shape("dk1", body, "#ffd23f", "#f2b705", 60)
    b += shape("dk2", "M-62,14 Q-20,-8 26,14 Q-12,44 -62,14 Z", "#ffc21a", "#f2b705", 10, 4)
    b += shape("dk3", "M10,-56 A46,44 0 1,1 102,-56 A46,44 0 1,1 10,-56 Z", "#ffd23f", "#f2b705", 82)
    b += shape("dk4", "M96,-62 Q126,-70 132,-52 Q122,-40 98,-44 Z", "#ff8a3d", None, None, 4.5)
    b += shape("dk5", "M98,-44 Q120,-40 124,-32 Q108,-24 94,-34 Z", "#f06a2a", None, None, 4.5)
    b += '<ellipse cx="72" cy="-72" rx="7" ry="9.5" fill="%s"/><circle cx="74" cy="-76" r="2.8" fill="#fff"/>' % INK
    b += '<ellipse cx="66" cy="-48" rx="10" ry="5.5" fill="#ff9fb0" opacity=".85"/>'
    b += '<path d="M-50,30 Q-20,40 10,30" fill="none" stroke="#f2b705" stroke-width="4" stroke-linecap="round" opacity=".7"/>'
    b += foam(130, 80)
    return b


# ------------------------------------------------------------------ 24 八音盒船
def musicbox():
    b = note(-128, -88, 1.0) + note(-96, -122, 0.8, 8)
    # lid, open behind the box: pink velvet with a little oval mirror
    b += shape("mb1", "M-98,-16 L-90,-104 L90,-104 L98,-16 Z", "#c47a45", "#a9653a", 70, 5)
    b += shape("mb2", "M-80,-24 L-74,-94 L74,-94 L80,-24 Z", "#f4a7b4", "#e88fa0", 40, 3.5)
    b += '<ellipse cx="0" cy="-74" rx="22" ry="14" fill="#dff3ff" stroke="%s" stroke-width="3"/><path d="M-10,-80 l8,-4 M-4,-72 l12,-6" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' % INK
    # the little dancer turning on her plinth
    b += '<ellipse cx="0" cy="-20" rx="16" ry="5" fill="#f7c843" stroke="%s" stroke-width="3"/>' % INK
    b += '<path d="M0,-22 L0,-36" stroke="%s" stroke-width="4" stroke-linecap="round"/>' % INK
    b += '<ellipse cx="0" cy="-40" rx="17" ry="6" fill="#ff9fb0" stroke="%s" stroke-width="3"/>' % INK
    b += '<rect x="-5" y="-56" width="10" height="16" rx="4" fill="#ff9fb0" stroke="%s" stroke-width="3"/>' % INK
    b += '<path d="M-4,-54 Q-16,-70 -2,-76 M4,-54 Q16,-70 2,-76" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round"/>' % INK
    b += '<circle cx="0" cy="-63" r="7" fill="#ffe0c8" stroke="%s" stroke-width="3"/>' % INK
    b += '<path d="M-30,-30 Q0,-14 30,-30" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>'
    # wind-up key on the side
    b += stick("M112,22 L132,22", "#f7c843", 5, 11)
    b += '<path d="M132,22 m0,-4 q10,-16 18,-6 q-4,10 -18,6 Z M132,22 m0,4 q10,16 18,6 q-4,-10 -18,-6 Z" fill="#f7c843" stroke="%s" stroke-width="3.5" stroke-linejoin="round"/>' % INK
    # the box
    b += shape("mb3", "M-112,-16 L112,-16 L112,70 Q112,76 104,76 L-104,76 Q-112,76 -112,70 Z", "#c47a45", "#a9653a", 76,
               5.5, '<rect x="-120" y="-20" width="240" height="14" fill="#f7c843" clip-path="CLIP"/><path d="M-120,-6 L120,-6" stroke="%s" stroke-width="3" clip-path="CLIP"/>' % INK)
    b += '<path d="M-100,6 L100,6" stroke="#a9653a" stroke-width="3" opacity=".7"/>'
    b += face("happy", 0, 44, 0.6)
    b += foam(134, 80)
    return b


# ------------------------------------------------------------------ 25 茶杯船
def teacup():
    b = ""
    cup = "M-102,-20 Q-100,52 -40,68 L40,68 Q100,52 102,-20 Z"
    pattern = ('<path d="M-104,10 Q0,30 104,10" fill="none" stroke="#5b8fd9" stroke-width="7" clip-path="CLIP"/>'
               + "".join('<circle cx="%s" cy="%s" r="3.2" fill="#5b8fd9" clip-path="CLIP"/>' % (x, 22 + abs(x) * -0.06 + 8) for x in range(-80, 90, 32)))
    b += shape("tc1", cup, "#ffffff", "#dde6f3", 66, 5.5, pattern)
    # broken handle: a stub with a jagged end
    b += '<path d="M100,-8 Q124,-12 126,6 L119,4 L122,12 L114,10 Q112,2 98,6 Z" fill="#fff" stroke="%s" stroke-width="4.5" stroke-linejoin="round"/>' % INK
    # rim and inside, with the ring of old tea
    b += '<ellipse cx="0" cy="-20" rx="104" ry="18" fill="#fff" stroke="%s" stroke-width="5"/>' % INK
    b += '<ellipse cx="0" cy="-18" rx="90" ry="11" fill="#efe6d2"/>'
    b += '<ellipse cx="2" cy="-16" rx="66" ry="7" fill="none" stroke="#c9a06a" stroke-width="3.5"/>'
    b += '<path d="M-94,-24 Q-60,-34 -20,-35" fill="none" stroke="#5b8fd9" stroke-width="3" stroke-linecap="round" opacity=".6"/>'
    b += face("calm", -6, 50, 0.58)
    b += foam(124, 80)
    return b


# ------------------------------------------------------------------ 26 帆布鞋
def sneaker():
    b = '<g transform="translate(0,-22)">'
    upper = "M-122,40 Q-128,-14 -98,-28 L-40,-32 Q10,-18 44,-4 Q110,8 128,34 L128,40 Z"
    b += shape("sn1", upper, "#f0584f", "#d84a42", 70)
    b += '<path d="M-106,-26 Q-72,-40 -38,-30 Q-72,-18 -106,-26 Z" fill="#5a2a35" stroke="%s" stroke-width="4" stroke-linejoin="round"/>' % INK
    b += shape("sn2", "M58,40 Q62,6 92,8 Q124,14 128,40 Z", "#ffffff", "#dde6f3", 112, 4.5)
    sole = "M-124,38 L130,38 L130,52 Q128,68 104,68 L-104,68 Q-124,68 -124,52 Z"
    b += shape("sn3", sole, "#ffffff", "#dde6f3", 96, 5,
               '<path d="M-130,48 L134,48" stroke="#4a6fd1" stroke-width="4" clip-path="CLIP"/>')
    holes = [(-30, -22), (-10, -16), (10, -10), (30, -4)]
    b += '<path d="M-30,-22 L-10,-16 M-30,-22 L-6,-24 M-10,-16 L10,-10 M-10,-16 L14,-18 M10,-10 L30,-4" stroke="#fff" stroke-width="4" stroke-linecap="round"/>'
    b += "".join('<circle cx="%s" cy="%s" r="4" fill="#fff" stroke="%s" stroke-width="2.5"/>' % (x, y, INK) for x, y in holes)
    # the bow
    b += '<path d="M-14,-40 Q-22,-18 -30,-14 M-14,-40 Q-2,-20 4,-18" fill="none" stroke="%s" stroke-width="8" stroke-linecap="round"/>' % INK
    b += '<path d="M-14,-40 Q-22,-18 -30,-14 M-14,-40 Q-2,-20 4,-18" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>'
    b += '<ellipse cx="-30" cy="-46" rx="15" ry="9" transform="rotate(-18 -30 -46)" fill="#fff" stroke="%s" stroke-width="4"/>' % INK
    b += '<ellipse cx="2" cy="-46" rx="15" ry="9" transform="rotate(18 2 -46)" fill="#fff" stroke="%s" stroke-width="4"/>' % INK
    b += '<circle cx="-14" cy="-42" r="6" fill="#fff" stroke="%s" stroke-width="3.5"/>' % INK
    b += face("happy", -66, 24, 0.5)
    b += "</g>"
    b += foam(136, 80)
    return b


# ------------------------------------------------------------------ 27 豌豆荚
def peapod():
    b = '<path d="M-132,-12 Q-152,-20 -148,-40 Q-142,-56 -128,-48" fill="none" stroke="%s" stroke-width="9" stroke-linecap="round"/>' % INK
    b += '<path d="M-132,-12 Q-152,-20 -148,-40 Q-142,-56 -128,-48" fill="none" stroke="#6bb24c" stroke-width="4" stroke-linecap="round"/>'
    b += stick("M132,-14 Q150,-30 142,-46 Q134,-56 128,-46 Q126,-38 136,-38", "#7cc35a", 3.5, 8)
    b += shape("pp1", "M-132,-12 Q-90,-34 0,-32 Q100,-34 134,-16 Q100,6 0,8 Q-100,6 -132,-12 Z", "#b7e48d", "#a3d878", 80, 4.5)
    # five peas lined up by height; the smallest takes the highest note
    peas = [(-86, 25), (-42, 23), (0, 21), (38, 19), (70, 16)]
    for i, (x, r) in enumerate(peas):
        cy = 12 - r
        b += shape("pp%d" % (10 + i), "M%s,%s a%s,%s 0 1,0 %s,0 a%s,%s 0 1,0 %s,0 Z" % (x - r, cy, r, r, 2 * r, r, r, -2 * r),
                   "#9ddc6a", "#86c955", x + r * 0.35, 4)
        if i < 4:   # singing with eyes closed
            b += '<path d="M%s,%s q4,-4 8,0 M%s,%s q4,-4 8,0" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round"/>' % (x - 12, cy - 3, x + 4, cy - 3, INK)
        else:       # the smallest, eyes open
            b += '<circle cx="%s" cy="%s" r="2.6" fill="%s"/><circle cx="%s" cy="%s" r="2.6" fill="%s"/>' % (x - 6, cy - 4, INK, x + 6, cy - 4, INK)
        b += '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#7a2a3a" stroke="%s" stroke-width="2"/>' % (x, cy + 7, 3 if i < 4 else 4, 3.5 if i < 4 else 5, INK)
        b += '<ellipse cx="%s" cy="%s" rx="4" ry="2.5" fill="#ff9fb0" opacity=".8"/><ellipse cx="%s" cy="%s" rx="4" ry="2.5" fill="#ff9fb0" opacity=".8"/>' % (x - 13, cy + 3, x + 13, cy + 3)
    b += note(88, -52, 0.85) + note(-70, -64, 0.65, 10)
    hull = "M-134,-12 Q-118,62 0,64 Q118,62 136,-16 Q104,20 0,22 Q-104,20 -134,-12 Z"
    b += shape("pp2", hull, "#7cc35a", "#62a944", 70, 5.5,
               '<path d="M-110,26 Q0,52 112,22" fill="none" stroke="#62a944" stroke-width="3" clip-path="CLIP"/>')
    b += foam(136, 80)
    return b


# ------------------------------------------------------------------ 28 三角钢琴
def piano():
    b = ""
    lid = "M-46,-16 L118,-16 L116,-124 Q30,-104 -46,-16 Z"
    b += shape("pn1", lid, "#3d4160", "#33374f", 80, 5,
               '<path d="M-20,-24 L108,-24 L106,-108 Q30,-92 -20,-24 Z" fill="#474c6e" clip-path="CLIP"/>')
    b += stick("M24,-16 L50,-74", "#c9a06a", 4, 9)                                       # the prop stick
    b += '<rect x="-40" y="-24" width="156" height="8" rx="2" fill="#f7c843" stroke="%s" stroke-width="3"/>' % INK   # strings
    case = "M-116,-16 L120,-16 Q130,-16 130,-6 L130,50 Q130,60 120,60 L-116,60 Q-126,60 -126,50 L-126,-6 Q-126,-16 -116,-16 Z"
    b += shape("pn2", case, "#3d4160", "#33374f", 94, 5.5,
               '<path d="M-110,0 L100,0" stroke="#6b7194" stroke-width="4" stroke-linecap="round" clip-path="CLIP"/>')
    # a band of keys across the case, one of them grey with a plaster on it
    b += '<rect x="-114" y="-6" width="112" height="30" rx="3" fill="#fff" stroke="%s" stroke-width="4"/>' % INK
    b += "".join('<path d="M%s,-4 L%s,22" stroke="#aab2c8" stroke-width="2.5"/>' % (x, x) for x in range(-100, -4, 14))
    b += '<rect x="-72" y="-4" width="13" height="26" fill="#b9c0d6"/>'
    b += "".join('<rect x="%s" y="-6" width="8" height="16" rx="1.5" fill="%s"/>' % (x - 4, INK) for x in (-100, -86, -44, -30, -16))
    b += '<rect x="-80" y="4" width="28" height="11" rx="4" transform="rotate(-16 -66 9)" fill="#f2c49b" stroke="%s" stroke-width="2.5"/>' % INK
    b += '<path d="M-70,6 l0,6 M-62,5 l0,6" transform="rotate(-16 -66 9)" stroke="#d9a47a" stroke-width="2"/>'
    b += face("dark", 62, 40, 0.55)
    b += note(-130, -70, 0.8)
    b += foam(138, 80)
    return b


# ------------------------------------------------------------------ 29 水果箱
def crate():
    b = ""
    b += stick("M58,-28 Q94,-30 92,-64 Q90,-80 76,-76", "#ffb35c", 7, 14)                 # tail
    # the cat
    b += shape("ct1", "M-62,-74 L-56,-108 L-34,-86 Z", "#ffb35c", None, None, 4.5)
    b += shape("ct2", "M2,-74 L-4,-108 L-26,-86 Z", "#ffb35c", None, None, 4.5)
    b += '<path d="M-54,-96 L-44,-86 M-6,-96 L-16,-86" stroke="#ff9fb0" stroke-width="5" stroke-linecap="round"/>'
    head = "M-70,-52 Q-72,-92 -30,-92 Q12,-92 10,-52 Q8,-22 -30,-22 Q-68,-22 -70,-52 Z"
    b += shape("ct3", head, "#ffb35c", "#f39a3c", -6, 5,
               '<path d="M-38,-92 L-38,-80 M-30,-92 L-30,-78 M-22,-92 L-22,-80" stroke="#e8823a" stroke-width="4" stroke-linecap="round" clip-path="CLIP"/>')
    b += face("small", -30, -34, 0.55)
    b += '<path d="M-30,-44 l-4,-3 h8 Z" fill="#ff8a98" stroke="%s" stroke-width="1.5"/>' % INK
    b += '<path d="M-56,-46 l-14,-3 M-56,-40 l-14,3 M-4,-46 l14,-3 M-4,-40 l14,3" stroke="%s" stroke-width="2" stroke-linecap="round"/>' % INK
    # an apple beside it
    b += '<circle cx="40" cy="-36" r="15" fill="#f0584f" stroke="%s" stroke-width="4"/><path d="M40,-50 l2,-8" stroke="%s" stroke-width="3.5" stroke-linecap="round"/>' % (INK, INK)
    b += '<path d="M43,-56 q10,-6 14,2 q-8,4 -14,-2 Z" fill="#7cc35a" stroke="%s" stroke-width="2.5"/><circle cx="34" cy="-41" r="3" fill="#fff" opacity=".8"/>' % INK
    # the crate: boards, corner posts, the "handle with care" stamp
    box = "M-104,-28 L104,-28 L104,70 L-104,70 Z"
    boards = ('<path d="M-110,4 L110,4 M-110,36 L110,36" stroke="#a86c3c" stroke-width="5" clip-path="CLIP"/>'
              '<path d="M-110,10 L110,10 M-110,42 L110,42" stroke="#f0c98a" stroke-width="2.5" opacity=".8" clip-path="CLIP"/>')
    b += shape("ct4", box, "#e3b06b", "#d29a55", 70, 5.5, boards)
    b += '<rect x="-104" y="-28" width="16" height="98" fill="#cf9752" stroke="%s" stroke-width="4"/><rect x="88" y="-28" width="16" height="98" fill="#c08646" stroke="%s" stroke-width="4"/>' % (INK, INK)
    b += "".join('<circle cx="%s" cy="%s" r="2.2" fill="%s"/>' % (x, y, INK) for x in (-96, 96) for y in (-16, 18))
    # paws over the edge
    b += '<ellipse cx="-50" cy="-28" rx="11" ry="7" fill="#ffb35c" stroke="%s" stroke-width="4"/><ellipse cx="-10" cy="-28" rx="11" ry="7" fill="#ffb35c" stroke="%s" stroke-width="4"/>' % (INK, INK)
    b += ('<g transform="translate(36,20) rotate(-6)"><rect x="-26" y="-16" width="52" height="32" rx="3" fill="none" stroke="#d8453c" stroke-width="3.5"/>'
          '<path d="M-7,-10 L7,-10 Q7,0 0,2 Q-7,0 -7,-10 Z M0,2 L0,9 M-5,10 L5,10" fill="none" stroke="#d8453c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></g>')
    b += foam(130, 80)
    return b


# ------------------------------------------------------------------ 30 水上飞机
def seaplane():
    b = ""
    b += shape("sp1", "M-126,-28 L-140,-88 L-114,-88 L-92,-40 Z", "#f0584f", "#d84a42", -118, 4.5)   # tail fin
    b += stick("M-50,2 L-56,30 M60,2 L66,30", "#9aa6c2", 4, 9)                                    # float struts
    floats = "M-108,30 L92,30 Q124,30 130,20 L-100,20 Q-116,22 -108,30 Z"
    b += shape("sp2", "M-110,40 L96,40 Q126,40 132,24 L-104,24 Q-118,26 -110,40 Z", "#f7c843", "#e5ab2a", 60, 5)
    fus = "M-128,-26 Q-126,-48 -96,-48 L60,-44 Q112,-40 124,-20 Q112,2 60,4 L-96,4 Q-126,2 -128,-26 Z"
    b += shape("sp3", fus, "#f0584f", "#d84a42", 80, 5.5,
               '<path d="M-130,-14 L130,-14" stroke="#fff" stroke-width="7" clip-path="CLIP"/>')
    b += '<rect x="34" y="-40" width="40" height="18" rx="7" fill="#9fdcff" stroke="%s" stroke-width="3.5"/><path d="M42,-36 l8,0" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' % INK
    # propeller
    b += '<ellipse cx="132" cy="-46" rx="5" ry="20" fill="#d9e1ef" stroke="%s" stroke-width="3"/><ellipse cx="132" cy="6" rx="5" ry="20" fill="#d9e1ef" stroke="%s" stroke-width="3"/>' % (INK, INK)
    b += '<circle cx="128" cy="-20" r="9" fill="#f7c843" stroke="%s" stroke-width="3.5"/>' % INK
    # the wing, with a blanket put out to dry
    b += stick("M-30,-48 L-38,-66 M40,-46 L46,-66", "#9aa6c2", 4, 9)
    b += '<rect x="-92" y="-78" width="190" height="14" rx="7" fill="#f0584f" stroke="%s" stroke-width="5"/>' % INK
    quilt = "M-62,-72 L30,-72 L30,-30 Q22,-24 14,-30 Q6,-24 -2,-30 Q-10,-24 -18,-30 Q-26,-24 -34,-30 Q-42,-24 -50,-30 Q-56,-24 -62,-30 Z"
    checks = "".join('<rect x="%s" y="%s" width="12" height="12" fill="#ffb3c4" clip-path="CLIP"/>' % (x, y)
                     for x in range(-62, 32, 24) for y in (-72, -48)) + "".join(
                     '<rect x="%s" y="-60" width="12" height="12" fill="#ffb3c4" clip-path="CLIP"/>' % x for x in range(-50, 32, 24))
    b += shape("sp4", quilt, "#fff4c4", None, None, 4.5, checks)
    b += '<rect x="-52" y="-82" width="7" height="14" rx="2" fill="#7fc4b8" stroke="%s" stroke-width="2.5"/><rect x="14" y="-82" width="7" height="14" rx="2" fill="#7fc4b8" stroke="%s" stroke-width="2.5"/>' % (INK, INK)
    b += face("happy", 84, -4, 0.45)
    b += foam(134, 80)
    return b


# ------------------------------------------------------------------ 31 木板筏
def planks():
    b = ""
    # bedsheet sail on a yard, two patches
    sail = "M-58,-112 Q6,-102 66,-112 Q76,-62 70,-18 Q8,-26 -54,-18 Q-64,-66 -58,-112 Z"
    stripes = "".join('<path d="M%s,-120 L%s,0" stroke="#cfe0f6" stroke-width="7" clip-path="CLIP"/>' % (x, x + 4) for x in range(-50, 80, 22))
    b += shape("pl1", sail, "#f7f2e6", "#e8e1cf", 44, 5, stripes)
    b += ('<g transform="translate(-28,-80) rotate(-8)"><rect x="-14" y="-12" width="28" height="24" fill="#f7c843" stroke="%s" stroke-width="3"/>'
          '<rect x="-10" y="-8" width="20" height="16" fill="none" stroke="%s" stroke-width="1.6" stroke-dasharray="3 3"/></g>') % (INK, INK)
    b += ('<g transform="translate(34,-46) rotate(7)"><rect x="-16" y="-11" width="32" height="22" fill="#ff9fb0" stroke="%s" stroke-width="3"/>'
          '<rect x="-12" y="-7" width="24" height="14" fill="none" stroke="%s" stroke-width="1.6" stroke-dasharray="3 3"/></g>') % (INK, INK)
    b += stick("M-66,-114 L74,-114", "#a86c3c", 4.5, 10)
    b += stick("M4,-132 L4,18", "#a86c3c", 5, 11)                                          # mast
    # rope wound around the mast
    for y in (-14, -6, 2, 10):
        b += '<ellipse cx="4" cy="%s" rx="11" ry="4" fill="none" stroke="%s" stroke-width="7"/><ellipse cx="4" cy="%s" rx="11" ry="4" fill="none" stroke="#e8d3a0" stroke-width="3"/>' % (y, INK, y)
    # planks of different lengths, a little crooked
    for i, (x0, x1, y, col, rot) in enumerate(((-118, 104, 16, "#c98a52", -1.5), (-132, 126, 30, "#b37645", 1.0),
                                               (-110, 132, 44, "#d9a066", -0.8), (-126, 112, 58, "#c98a52", 1.4))):
        b += '<rect x="%s" y="%s" width="%s" height="15" rx="3" transform="rotate(%s 0 %s)" fill="%s" stroke="%s" stroke-width="4.5"/>' % (x0, y, x1 - x0, rot, y, col, INK)
        b += '<path d="M%s,%s l14,0 M%s,%s l20,0" transform="rotate(%s 0 %s)" stroke="#8a5a32" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>' % (x0 + 30, y + 7, x0 + 120, y + 9, rot, y)
    for x in (-84, 64):   # lashings
        b += '<rect x="%s" y="12" width="12" height="66" rx="3" fill="#e8d3a0" stroke="%s" stroke-width="3.5"/>' % (x - 6, INK)
        b += '<path d="M%s,22 l12,-6 M%s,36 l12,-6 M%s,50 l12,-6 M%s,64 l12,-6" stroke="#b89a5e" stroke-width="2.5"/>' % (x - 6, x - 6, x - 6, x - 6)
    b += face("happy", -30, 50, 0.5)
    b += foam(140, 82)
    return b


SHIPS = [("wupeng", wupeng), ("duck", duck), ("musicbox", musicbox), ("teacup", teacup), ("sneaker", sneaker),
         ("peapod", peapod), ("piano", piano), ("crate", crate), ("seaplane", seaplane), ("planks", planks)]

if __name__ == "__main__":
    out = [{"key": k, "svg": svg(f())} for k, f in SHIPS]
    json.dump(out, open(os.path.join(HERE, "new-ships-svg.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(len(out), "ships")
