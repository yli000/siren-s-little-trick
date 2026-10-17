"""The 10 new ships (#22–31), drawn in the same conventions as art-source/pixel/ships-svg.json:
viewBox -160 -160 320 260, ink outlines #2b2e42, flat fills with a darker clipped shade on the right,
the shared face set, and the shared foam at the waterline. Writes new-ships-svg.json next to this file."""
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


# ------------------------------------------------------------------ 22 乌篷船：一个大篷（菱形编织纹），船身上沿平直，两头几乎不翘
def wupeng():
    b = ""
    for x, y in ((-96, -104), (-40, -128), (20, -112), (78, -132), (120, -96)):        # rain
        b += '<path d="M%s,%s q7,12 0,18 q-7,-6 0,-18 Z" fill="#8fd0ff" stroke="%s" stroke-width="3" stroke-linejoin="round"/>' % (x, y, INK)
    b += stick("M106,-30 L150,62", "#c98a52", 4.5, 11)                                    # 橹
    awning = "M-68,14 L-68,-26 Q-66,-66 -4,-68 Q58,-66 60,-26 L60,14 Z"
    weave = "".join('<path d="M%s,-80 l46,100 M%s,-80 l-46,100" stroke="#575d7c" stroke-width="3" clip-path="CLIP"/>' % (x, x) for x in range(-94, 100, 18))
    b += shape("wp1", awning, "#3e4359", "#353a4f", 28, 5, weave)
    hull = "M-144,9 Q-140,14 -122,14 L122,14 Q140,14 146,7 Q138,38 94,56 L-94,56 Q-138,38 -144,9 Z"
    b += shape("wp3", hull, "#b7814f", "#9a6a3e", 76, 5.5,
               '<path d="M-150,27 L150,27 M-150,41 L150,41" stroke="#9a6a3e" stroke-width="3" clip-path="CLIP"/>')
    b += '<path d="M-140,10 Q-136,12 -120,12 L120,12 Q136,12 142,8" fill="none" stroke="#7a4a28" stroke-width="3" opacity=".6"/>'
    b += face("happy", -4, 48, 0.55)
    b += foam(146, 80)
    return b


GOLD = "#e3b04b"
BLUE = "#2f5fb3"


def rose(x, y, s=1.0):
    return ('<g transform="translate(%s,%s) scale(%s)"><path d="M-6,3 q-8,-3 -11,3 q7,4 11,-3 Z M6,3 q8,-3 11,3 q-7,4 -11,-3 Z" fill="#8fcf8a"/>'
            '<circle r="6.5" fill="#f6a3bd"/><path d="M-2.5,1 a3,3 0 1,1 4,1.5" fill="none" stroke="#d9668e" stroke-width="2" stroke-linecap="round"/></g>') % (x, y, s)


# ------------------------------------------------------------------ 23 橡皮鸭：经典玩具鸭的比例——大圆脑袋、胖身子、小翘尾巴、扁嘴微笑、一只亮晶晶的眼睛
def duck():
    b = note(128, -104, 0.85, -8)
    body = "M-104,-6 Q-120,-34 -108,-52 Q-98,-62 -88,-46 Q-80,-32 -66,-31 Q-40,-38 0,-30 Q96,-28 104,22 Q102,68 0,70 Q-98,68 -108,30 Q-110,12 -104,-6 Z"
    b += shape("dk1", body, "#ffd93b", "#f3b712", 60)
    b += '<path d="M-58,10 Q-28,-8 10,8 Q-16,32 -58,10 Z" fill="#ffcb1f" stroke="#e5a50a" stroke-width="3.5" stroke-linejoin="round"/>'
    b += shape("dk3", "M-20,-60 A54,54 0 1,1 88,-60 A54,54 0 1,1 -20,-60 Z", "#ffd93b", "#f3b712", 70)
    b += shape("dk4", "M78,-60 Q100,-68 117,-60 Q127,-53 121,-45 Q112,-36 96,-36 Q82,-36 78,-44 Z", "#ff8a1f", "#f0700f", 108, 4.5)
    b += '<path d="M86,-48 Q102,-40 120,-52" fill="none" stroke="#c9560a" stroke-width="3" stroke-linecap="round"/>'
    b += ('<ellipse cx="54" cy="-68" rx="10.5" ry="14" fill="%s"/><circle cx="58" cy="-75" r="4.8" fill="#fff"/>'
          '<circle cx="50" cy="-61" r="2.2" fill="#fff"/>') % INK
    b += '<ellipse cx="42" cy="-44" rx="12" ry="7" fill="#ff9fb0" opacity=".9"/>'
    b += '<path d="M-2,-88 Q8,-106 28,-110" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".85"/><circle cx="-9" cy="-74" r="4" fill="#fff" opacity=".85"/>'
    b += '<path d="M-84,-18 Q-62,-28 -36,-27" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7"/>'
    b += foam(128, 80)
    return b


# ------------------------------------------------------------------ 24 金鱼缸（原八音盒船）
def fishbowl():
    b = '<g transform="translate(0,-12)">'
    bowl = "M-44,-96 Q-98,-74 -96,-20 Q-92,56 0,58 Q92,56 96,-20 Q98,-74 44,-96 Z"
    b += '<clipPath id="fb1"><path d="%s"/></clipPath><path d="%s" fill="#e9f8ff"/>' % (bowl, bowl)
    b += '<path d="M-110,-46 q14,-7 28,0 t28,0 t28,0 t28,0 t28,0 t28,0 t28,0 t28,0 L120,70 L-110,70 Z" fill="#8fd3f7" clip-path="url(#fb1)"/>'
    b += '<rect x="40" y="-60" width="80" height="130" fill="#7cc6ef" clip-path="url(#fb1)"/>'
    for x, y, c in ((-70, 46, "#f7c843"), (-50, 50, "#ff9fb0"), (-28, 48, "#9ad46f"), (-6, 51, "#c7b8f0"), (16, 48, "#f7c843"),
                    (36, 51, "#ff9fb0"), (58, 47, "#9ad46f"), (78, 42, "#c7b8f0"), (-86, 38, "#9ad46f")):
        b += '<ellipse cx="%s" cy="%s" rx="10" ry="6.5" fill="%s" stroke="%s" stroke-width="2.5" clip-path="url(#fb1)"/>' % (x, y, c, INK)
    # a tiny castle
    b += ('<g clip-path="url(#fb1)"><path d="M-64,42 L-64,0 L-58,0 L-58,6 L-52,6 L-52,0 L-46,0 L-46,6 L-40,6 L-40,0 L-34,0 L-34,42 Z" fill="#cfd6e8" stroke="%s" stroke-width="3" stroke-linejoin="round"/>'
          '<path d="M-56,42 L-56,30 Q-49,22 -42,30 L-42,42 Z" fill="#5a5f80"/>'
          '<path d="M-49,0 L-49,-16 L-38,-11 L-49,-7" fill="#f0584f" stroke="%s" stroke-width="2.5" stroke-linejoin="round"/></g>') % (INK, INK)
    b += '<path d="M64,48 Q52,28 64,12 Q74,-4 62,-20" fill="none" stroke="%s" stroke-width="9" stroke-linecap="round" clip-path="url(#fb1)"/>' % INK
    b += '<path d="M64,48 Q52,28 64,12 Q74,-4 62,-20" fill="none" stroke="#6bbf6a" stroke-width="4" stroke-linecap="round" clip-path="url(#fb1)"/>'
    # the goldfish, looking out
    b += ('<g transform="translate(6,-8)">'
          '<path d="M-24,0 L-46,-18 Q-40,0 -46,18 Z" fill="#ff8a3d" stroke="%s" stroke-width="4" stroke-linejoin="round"/>'
          '<path d="M-6,-14 Q2,-30 14,-16 Z" fill="#ff8a3d" stroke="%s" stroke-width="3.5" stroke-linejoin="round"/>'
          '<ellipse cx="0" cy="0" rx="28" ry="18" fill="#ff8a3d" stroke="%s" stroke-width="4.5"/>'
          '<path d="M-14,-12 Q-20,0 -14,12" fill="none" stroke="#f26b1f" stroke-width="3" stroke-linecap="round"/>'
          '<ellipse cx="12" cy="-4" rx="5" ry="6.5" fill="%s"/><circle cx="13.5" cy="-7" r="2" fill="#fff"/>'
          '<path d="M18,6 Q22,9 26,5" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round"/>'
          '<ellipse cx="4" cy="6" rx="5" ry="3" fill="#ff9fb0" opacity=".9"/></g>') % (INK, INK, INK, INK, INK)
    for x, y, r in ((40, -26, 4), (46, -42, 5.5), (38, -60, 3.5)):
        b += '<circle cx="%s" cy="%s" r="%s" fill="#fff" fill-opacity=".7" stroke="%s" stroke-width="2"/>' % (x, y, r, INK)
    b += '<path d="%s" fill="none" stroke="%s" stroke-width="5" stroke-linejoin="round"/>' % (bowl, INK)
    b += '<path d="M-74,-56 Q-86,-18 -74,18" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".9"/><circle cx="-66" cy="-70" r="4" fill="#fff"/>'
    b += '<ellipse cx="0" cy="-96" rx="46" ry="8" fill="#f2fbff" stroke="%s" stroke-width="4.5"/>' % INK
    b += "</g>"
    b += foam(118, 80)
    return b


# ------------------------------------------------------------------ 25 茶杯船：英式骨瓷，带碟子
def teacup():
    b = ""
    b += '<path d="M-128,28 Q-124,52 0,56 Q124,52 128,28 Z" fill="#e3e0ee" stroke="%s" stroke-width="4.5" stroke-linejoin="round"/>' % INK
    b += '<ellipse cx="0" cy="28" rx="130" ry="21" fill="#fff" stroke="%s" stroke-width="5"/>' % INK
    b += '<ellipse cx="0" cy="28" rx="120" ry="16" fill="none" stroke="%s" stroke-width="3"/>' % GOLD
    import math
    for k in range(14):
        t = math.pi * 2 * k / 14 + 0.2
        b += rose(round(105 * math.cos(t), 1), round(28 + 12 * math.sin(t), 1), 0.55)
    b += '<ellipse cx="0" cy="28" rx="64" ry="9" fill="#f1eef7"/>'
    b += '<rect x="-34" y="14" width="68" height="16" rx="6" fill="#fff" stroke="%s" stroke-width="4"/><path d="M-30,22 L30,22" stroke="%s" stroke-width="2.5"/>' % (INK, GOLD)
    cup = "M-88,-62 Q-86,-10 -44,12 Q-36,18 -32,20 L32,20 Q36,18 44,12 Q86,-10 88,-62 Z"
    pattern = ('<path d="M-92,-50 Q0,-36 92,-50" fill="none" stroke="%s" stroke-width="3" clip-path="CLIP"/>'
               '<path d="M-64,2 Q0,16 64,2" fill="none" stroke="%s" stroke-width="2.5" clip-path="CLIP"/>') % (GOLD, GOLD)
    pattern += "".join(rose(x, y, 0.9) for x, y in ((-62, -36), (-26, -31), (26, -31), (62, -36)))
    b += shape("tc1", cup, "#ffffff", "#ece9f4", 58, 5.5, pattern)
    # the handle broke off: two little stubs with jagged ends
    b += '<path d="M85,-48 Q100,-52 107,-44 L101,-42 L105,-37 L97,-38 Q92,-42 83,-40 Z" fill="#fff" stroke="%s" stroke-width="4" stroke-linejoin="round"/>' % INK
    b += '<path d="M66,-10 Q80,-6 85,2 L78,2 L81,8 L73,6 Q68,0 58,-2 Z" fill="#fff" stroke="%s" stroke-width="4" stroke-linejoin="round"/>' % INK
    b += '<ellipse cx="0" cy="-62" rx="90" ry="15" fill="#fff" stroke="%s" stroke-width="5"/>' % INK
    b += '<ellipse cx="0" cy="-61" rx="78" ry="10" fill="#efe3c8"/>'
    b += '<ellipse cx="3" cy="-60" rx="56" ry="6" fill="none" stroke="#c99a5c" stroke-width="3"/>'
    b += '<ellipse cx="0" cy="-62" rx="85" ry="12.5" fill="none" stroke="%s" stroke-width="2.5"/>' % GOLD
    b += face("calm", 0, 4, 0.5)
    b += foam(134, 82)
    return b


# ------------------------------------------------------------------ 备选：青花盖碗（选它的话文案要改，盖碗没有把手）
def gaiwan():
    b = ""
    b += '<path d="M-124,28 Q-120,50 0,54 Q120,50 124,28 Z" fill="#e3e8f4" stroke="%s" stroke-width="4.5" stroke-linejoin="round"/>' % INK
    b += '<ellipse cx="0" cy="28" rx="126" ry="20" fill="#fff" stroke="%s" stroke-width="5"/>' % INK
    b += '<ellipse cx="0" cy="28" rx="114" ry="15" fill="none" stroke="%s" stroke-width="3.5"/>' % BLUE
    b += '<ellipse cx="0" cy="28" rx="66" ry="9" fill="#eef3fb"/>'
    b += '<rect x="-36" y="14" width="72" height="16" rx="5" fill="#fff" stroke="%s" stroke-width="4"/><path d="M-32,22 L32,22" stroke="%s" stroke-width="2.5"/>' % (INK, BLUE)
    bowl = "M-82,-44 Q-80,0 -42,16 Q-36,20 -32,22 L32,22 Q36,20 42,16 Q80,0 82,-44 Z"
    petals = "".join('<path d="M%s,20 q10,-22 20,0" fill="none" stroke="%s" stroke-width="3" clip-path="CLIP"/>' % (x, BLUE) for x in range(-90, 90, 20))
    clouds = ('<path d="M-74,-22 q8,-12 18,-3 q7,-10 16,0 M40,-22 q8,-12 18,-3 q7,-10 16,0" fill="none" stroke="%s" stroke-width="3.5" stroke-linecap="round" clip-path="CLIP"/>'
              '<path d="M-90,-36 Q0,-24 90,-36" fill="none" stroke="%s" stroke-width="5" clip-path="CLIP"/>') % (BLUE, BLUE)
    b += shape("gw1", bowl, "#ffffff", "#e8eef8", 60, 5.5, petals + clouds)
    # the lid, sitting a little crooked
    lid = "M-74,-44 Q-66,-74 0,-78 Q66,-74 74,-44 Q0,-36 -74,-44 Z"
    lidpat = ('<path d="M-80,-50 Q0,-40 80,-50" fill="none" stroke="%s" stroke-width="4" clip-path="CLIP"/>'
              '<path d="M-34,-62 q8,-10 16,-2 q6,-8 14,0 M8,-62 q8,-10 16,-2 q6,-8 14,0" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round" clip-path="CLIP"/>') % (BLUE, BLUE)
    b += '<ellipse cx="0" cy="-44" rx="82" ry="12" fill="#fff" stroke="%s" stroke-width="5"/>' % INK
    b += '<g transform="rotate(-7 0 -44)">' + shape("gw2", lid, "#ffffff", "#e8eef8", 44, 5, lidpat)
    b += '<rect x="-13" y="-92" width="26" height="17" rx="6" fill="#fff" stroke="%s" stroke-width="4.5"/><path d="M-9,-83 L9,-83" stroke="%s" stroke-width="3"/></g>' % (INK, BLUE)
    b += face("calm", 0, 2, 0.5)
    b += foam(130, 82)
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


# ------------------------------------------------------------------ 29 热气球（原水果箱）
def balloon():
    env = "M0,-156 Q80,-154 78,-90 Q74,-54 30,-30 L-30,-30 Q-74,-54 -78,-90 Q-80,-154 0,-156 Z"
    gores = ('<path d="M0,-160 Q-56,-96 -14,-28 L14,-28 Q56,-96 0,-160 Z" fill="#fff3d6" clip-path="CLIP"/>'
             '<path d="M0,-160 Q-104,-118 -58,-34 L-46,-34 Q-86,-112 0,-160 Z" fill="#f7c843" clip-path="CLIP"/>'
             '<path d="M0,-160 Q104,-118 58,-34 L46,-34 Q86,-112 0,-160 Z" fill="#f7c843" clip-path="CLIP"/>')
    b = shape("bl1", env, "#f0584f", "#d84a42", 56, 5.5, gores)
    b += face("happy", 0, -78, 0.68)
    b += '<path d="M-22,-16 L-42,10 M-8,-16 L-14,10 M8,-16 L14,10 M22,-16 L42,10" stroke="%s" stroke-width="3" stroke-linecap="round"/>' % INK
    b += '<path d="M-30,-30 L30,-30 L22,-14 L-22,-14 Z" fill="#f7c843" stroke="%s" stroke-width="4" stroke-linejoin="round"/>' % INK
    for x in (-52, 52):   # sandbags
        b += '<path d="M%s,18 L%s,24 Q%s,40 %s,40 Q%s,40 %s,24 Z" fill="#e6d29e" stroke="%s" stroke-width="3" stroke-linejoin="round"/>' % (
            x, x - 7, x - 10, x, x + 10, x + 7, INK)
    weave = ('<path d="M-60,24 L60,24 M-60,36 L60,36 M-60,48 L60,48" stroke="#b37645" stroke-width="3" clip-path="CLIP"/>'
             + "".join('<path d="M%s,14 L%s,62" stroke="#c48a52" stroke-width="2.5" clip-path="CLIP"/>' % (x, x) for x in range(-38, 44, 12)))
    b += shape("bl2", "M-44,12 L44,12 L40,60 Q38,64 32,64 L-32,64 Q-38,64 -40,60 Z", "#d9a066", "#c48a52", 24, 5, weave)
    b += '<rect x="-50" y="6" width="100" height="11" rx="5" fill="#b37645" stroke="%s" stroke-width="4"/>' % INK
    b += ('<g transform="translate(26,-2) rotate(12)"><rect x="-9" y="-12" width="18" height="22" rx="1.5" fill="#fff" stroke="%s" stroke-width="2.5"/>'
          '<path d="M-5,-5 L5,-5 M-5,0 L3,0" stroke="%s" stroke-width="2" stroke-linecap="round"/></g>') % (INK, INK)
    b += foam(110, 80)
    return b


# ------------------------------------------------------------------ 26 泡泡浴缸（原帆布鞋）
def bathtub():
    b = ""
    for x in (-74, 74):   # lion feet
        b += '<path d="M%s,30 Q%s,50 %s,52 Q%s,54 %s,46 Q%s,38 %s,30 Z" fill="#f7c843" stroke="%s" stroke-width="4" stroke-linejoin="round"/>' % (
            x - 12, x - 16, x - 4, x + 4, x + 8, x + 8, x + 6, INK)
    for x, y, r in ((-84, -52, 14), (-60, -60, 18), (-36, -54, 14), (-12, -66, 20), (14, -58, 15), (38, -64, 17), (62, -54, 13),
                    (-26, -84, 10), (22, -86, 9), (-50, -80, 7)):
        b += '<circle cx="%s" cy="%s" r="%s" fill="#fff" stroke="#a9dcff" stroke-width="3"/><circle cx="%s" cy="%s" r="%s" fill="#e4f4ff"/>' % (
            x, y, r, x - r * 0.35, y - r * 0.35, r * 0.25)
    b += stick("M-108,-40 L-108,-70 Q-108,-80 -96,-80 L-84,-80", "#f7c843", 6, 12)
    b += '<path d="M-116,-80 L-100,-80 M-108,-88 L-108,-72" stroke="%s" stroke-width="5" stroke-linecap="round"/>' % INK
    b += '<path d="M-84,-74 q5,8 0,12 q-5,-4 0,-12 Z" fill="#8fd0ff" stroke="%s" stroke-width="2.5"/>' % INK
    tub = "M-118,-34 L118,-34 Q116,24 76,36 L-76,36 Q-116,24 -118,-34 Z"
    b += shape("bt1", tub, "#ffffff", "#dde6f3", 72, 5.5)
    b += '<rect x="-126" y="-46" width="252" height="15" rx="7.5" fill="#fff" stroke="%s" stroke-width="5"/>' % INK
    chain = [(104, -40), (110, -26), (117, -13), (123, 0), (128, 13), (132, 25)]
    b += "".join('<circle cx="%s" cy="%s" r="3.4" fill="none" stroke="%s" stroke-width="2.5"/>' % (x, y, INK) for x, y in chain)
    b += '<ellipse cx="134" cy="36" rx="10" ry="6" fill="%s"/>' % INK
    b += face("happy", 0, 10, 0.6)
    b += foam(126, 80)
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


SHIPS = [("wupeng", wupeng), ("duck", duck), ("fishbowl", fishbowl), ("teacup", teacup), ("bathtub", bathtub),
         ("peapod", peapod), ("piano", piano), ("balloon", balloon), ("seaplane", seaplane), ("planks", planks)]
SPARES = [("gaiwan", gaiwan)]

if __name__ == "__main__":
    out = [{"key": k, "svg": svg(f())} for k, f in SHIPS]
    json.dump(out, open(os.path.join(HERE, "new-ships-svg.json"), "w", encoding="utf-8"), ensure_ascii=False)
    spares = [{"key": k, "svg": svg(f())} for k, f in SPARES]
    json.dump(spares, open(os.path.join(HERE, "spare-ships-svg.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(len(out), "ships,", len(spares), "spares")
