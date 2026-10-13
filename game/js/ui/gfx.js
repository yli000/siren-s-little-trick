/* 塞壬的小把戏 —— 前端：gfx.js（画布、像素图、位图字体、海面与塞壬）
 *
 * 逻辑画布 180 像素宽、320–400 像素高（随手机比例），整数倍最近邻放大到屏幕。
 * 所有界面都画在这一块画布上；本文件只提供画法，不管流程。
 */
(function (global) {
  'use strict';

  var Siren = global.Siren = global.Siren || {};
  var doc = global.document;

  var W = 180;
  var H = 360;
  var C = {
    INK: '#1b1f3f', CREAM: '#fff3d6', GOLD: '#ffcf3a', GOLD_D: '#c98a12', CORAL: '#f26b5e', TEAL: '#3ccfc4',
    NAVY: '#161b45', NAVY_L: '#2a3270', NAVY_LL: '#5a66b8', DIM: '#8f9be0',
    PAPER: '#fff3d6', PAPER_LINE: '#ecdcbc', PAPER_INK: '#3b3552', PAPER_DIM: '#a8946c'
  };
  var TIER = {
    perfect: { c: C.GOLD, d: C.GOLD_D, label: 'Perfect' },
    great: { c: '#8fdc7a', d: '#4f9f52', label: 'Great' },
    good: { c: '#9fdcff', d: '#5fb4ec', label: 'Good' },
    miss: { c: '#7f88b8', d: '#555d8c', label: 'Miss' },
    quiet: { c: '#3a4490', d: '#2a3270', label: '' }
  };

  // sky: top → horizon；sea: horizon → bottom
  var STAGES = [
    { name: 'dusk', sky: ['#4f6fd6', '#8d8fe6', '#f3a9c2', '#ffd591'], sea: ['#6f8fe6', '#5576d6', '#4160c0', '#3350aa'], glint: '#ffe2a8', star: 0, sun: 4, moon: -1, tint: '#ffe9d2', self: '#fff6ec', far: '#c9a6d6', cloud: '#ffd9c8' },
    { name: 'glow', sky: ['#3d4fb6', '#7b60cc', '#e27eaa', '#ffa27c'], sea: ['#5d6fd4', '#4759bc', '#3748a4', '#2b3b8e'], glint: '#ffc0a0', star: 0.25, sun: 12, moon: -1, tint: '#f6cfd8', self: '#fdeaee', far: '#9a7ec0', cloud: '#f2a6c0' },
    { name: 'blue', sky: ['#27357f', '#3f4aa6', '#7a5fb8', '#c273aa'], sea: ['#3c4cac', '#303f96', '#273482', '#202b6e'], glint: '#b9a6f0', star: 0.55, sun: 99, moon: 0, tint: '#c2bcf2', self: '#e6e2fb', far: '#5f5a9e', cloud: '#8f7ac8' },
    { name: 'night', sky: ['#161d4f', '#232c6e', '#34408c', '#5a4f9a'], sea: ['#252e7c', '#1d2569', '#171e58', '#121849'], glint: '#8f9be0', star: 0.85, sun: 99, moon: 1, tint: '#a4abea', self: '#d6daf9', far: '#3a3f7c', cloud: '#4a4f96' },
    { name: 'deep', sky: ['#0c1030', '#141a48', '#1d2560', '#2a3478'], sea: ['#161c54', '#111646', '#0d113a', '#0a0d2e'], glint: '#7f8cd8', star: 1, sun: 99, moon: 2, tint: '#929ae0', self: '#cdd2f7', far: '#262b5e', cloud: '#2f3570' }
  ];
  var DAY = { name: 'day', self: '#ffffff', sky: ['#8fd4fc', '#a6defd', '#bfe9ff', '#d6f1ff'], sea: ['#57b9f5', '#3fa8ef', '#2f97e6', '#2587da'], glint: '#bfe9ff', star: 0, sun: -60, moon: -1, tint: '#ffffff', far: '#ffffff', cloud: '#ffffff' };

  // ---------------------------------------------------------------- 画布

  function mk(w, h) {
    var c = doc.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  var screen = doc.getElementById('screen');
  var sctx = screen.getContext('2d');
  var lg = mk(W, 400);
  var g = lg.getContext('2d');
  var tmp = mk(W, 400);
  var tg = tmp.getContext('2d');
  var bufA = mk(W, 400);
  var sirenC = mk(128, 200);
  var sc = sirenC.getContext('2d');
  var sirenM = mk(128, 200);
  var sm = sirenM.getContext('2d');
  var atlas = new global.Image();
  var fontImg = new global.Image();
  var reduceMotion = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var L = {};
  var A = Siren.SPRITES;
  var FONT = Siren.FONT;

  function layout() {
    L.hz = Math.round(H * 0.36);
    L.sirenX = 26;
    L.sirenY = L.hz - 58;
    L.rockFoot = L.sirenY + 146;
    L.panelY = H - 112;
    L.micY = H - 27;
    bandCache = {};
  }

  function resize() {
    var wrap = screen.parentNode;
    var vw = wrap.clientWidth || global.innerWidth;
    var vh = wrap.clientHeight || global.innerHeight;
    var phone = global.innerWidth <= 560;
    var cw;
    var ch;
    if (phone) {
      H = Math.max(320, Math.min(400, Math.round(W * vh / vw)));
      var k = Math.min(vw / W, vh / H);
      cw = W * k;
      ch = H * k;
    } else {
      H = 372;
      ch = Math.min(vh, 800);
      cw = ch * W / H;
      if (cw > vw) { cw = vw; ch = cw * H / W; }
    }
    var dpr = Math.max(1, Math.min(3, global.devicePixelRatio || 1));
    screen.style.width = Math.floor(cw) + 'px';
    screen.style.height = Math.floor(ch) + 'px';
    screen.width = Math.floor(cw * dpr);
    screen.height = Math.floor(ch * dpr);
    layout();
  }

  function present() {
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(lg, 0, 0, W, H, 0, 0, screen.width, screen.height);
  }

  // ---------------------------------------------------------------- 像素图

  function spr(ctx, name, x, y) {
    var r = A[name];
    if (r) ctx.drawImage(atlas, r[0], r[1], r[2], r[3], Math.round(x), Math.round(y), r[2], r[3]);
  }
  var tintCache = {};
  /** 纯色剪影（'flat'）或乘色（'mul'） */
  function tinted(name, color, mode) {
    var key = name + '|' + color + '|' + mode;
    if (tintCache[key]) return tintCache[key];
    var r = A[name];
    var c = mk(r[2], r[3]);
    var x = c.getContext('2d');
    x.drawImage(atlas, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
    if (mode === 'mul') {
      x.globalCompositeOperation = 'multiply';
      x.fillStyle = color;
      x.fillRect(0, 0, r[2], r[3]);
      x.globalCompositeOperation = 'destination-in';
      x.drawImage(atlas, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
    } else {
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = color;
      x.fillRect(0, 0, r[2], r[3]);
    }
    tintCache[key] = c;
    return c;
  }
  function sprT(ctx, name, x, y, color, mode) {
    if (!A[name]) return;
    ctx.drawImage(tinted(name, color, mode || 'flat'), Math.round(x), Math.round(y));
  }
  function size(name) { var r = A[name]; return r ? { w: r[2], h: r[3] } : { w: 0, h: 0 }; }

  // ---------------------------------------------------------------- 位图字体

  var fontTint = {};
  function fontOf(color) {
    if (fontTint[color]) return fontTint[color];
    var c = mk(fontImg.width, fontImg.height);
    var x = c.getContext('2d');
    x.drawImage(fontImg, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    fontTint[color] = c;
    return c;
  }
  function glyph(ch) { return FONT.g[ch] || FONT.g['?']; }
  function tw(str, s) {
    var w = 0;
    for (var i = 0; i < str.length; i += 1) w += glyph(str[i])[2];
    return w * (s || 1);
  }
  function glyphs(ctx, str, x, y, color, s) {
    var img = fontOf(color);
    for (var i = 0; i < str.length; i += 1) {
      var gl = glyph(str[i]);
      if (str[i] !== ' ') ctx.drawImage(img, gl[0], gl[1], gl[2], FONT.h, x, y, gl[2] * s, FONT.h * s);
      x += gl[2] * s;
    }
  }
  /** opt: c 颜色 / s 整数倍 / a 'l'|'c'|'r' / o 描边色 / sh 阴影色。y 是这一行的顶边。 */
  function text(ctx, str, x, y, opt) {
    opt = opt || {};
    str = String(str);
    var s = opt.s || 1;
    var w = tw(str, s);
    x = Math.round(opt.a === 'c' ? x - w / 2 : opt.a === 'r' ? x - w : x);
    y = Math.round(y);
    if (opt.o) {
      if (opt.sh) for (var dx = -1; dx <= 1; dx += 1) glyphs(ctx, str, x + dx, y + 2, opt.sh, s);
      for (var ox = -1; ox <= 1; ox += 1) for (var oy = -1; oy <= 1; oy += 1) if (ox || oy) glyphs(ctx, str, x + ox, y + oy, opt.o, s);
    } else if (opt.sh) glyphs(ctx, str, x, y + 1, opt.sh, s);
    glyphs(ctx, str, x, y, opt.c || C.CREAM, s);
    return w;
  }
  /** 放不下就截断加省略号 */
  function fit(str, width) {
    if (tw(str) <= width) return str;
    var out = str;
    while (out.length > 1 && tw(out + '…') > width) out = out.slice(0, -1);
    return out.replace(/[\s,，、]+$/, '') + '…';
  }

  var NO_START = '，。！？、；：）》」,.!?;:)\'"';
  /** 中英混排换行：中文按字，英文按词 */
  function wrap(str, width) {
    var tokens = [];
    var word = '';
    for (var i = 0; i < str.length; i += 1) {
      var ch = str[i];
      var ascii = ch.charCodeAt(0) < 128;
      if (ascii && ch !== ' ') { word += ch; continue; }
      if (word) { tokens.push(word); word = ''; }
      tokens.push(ch);
    }
    if (word) tokens.push(word);
    var lines = [];
    var cur = '';
    for (var t = 0; t < tokens.length; t += 1) {
      var tok = tokens[t];
      if (cur === '' && tok === ' ') continue;
      if (tw(cur + tok) > width && cur !== '' && NO_START.indexOf(tok[0]) < 0) {
        lines.push(cur.replace(/\s+$/, ''));
        cur = tok === ' ' ? '' : tok;
      } else {
        cur += tok;
      }
    }
    if (cur) lines.push(cur.replace(/\s+$/, ''));
    return lines;
  }

  // ---------------------------------------------------------------- 形状

  function inset(r, j) { return Math.max(0, r - Math.round(Math.sqrt(Math.max(0, r * r - (r - j - 0.5) * (r - j - 0.5))))); }
  function shape(ctx, x, y, w, h, r, fill) {
    ctx.fillStyle = fill;
    r = Math.min(r, w >> 1, h >> 1);
    for (var j = 0; j < h; j += 1) {
      var k = j < r ? inset(r, j) : (j >= h - r ? inset(r, h - 1 - j) : 0);
      ctx.fillRect(x + k, y + j, w - 2 * k, 1);
    }
  }
  /** 像素圆角面板：1px 描边 + 硬投影 */
  function panel(ctx, x, y, w, h, r, fill, line, shadow) {
    x = Math.round(x);
    y = Math.round(y);
    if (shadow) shape(ctx, x, y + 2, w, h, r, shadow);
    shape(ctx, x, y, w, h, r, line);
    shape(ctx, x + 1, y + 1, w - 2, h - 2, Math.max(0, r - 1), fill);
  }
  function disc(ctx, cx, cy, r, fill) {
    ctx.fillStyle = fill;
    for (var dy = -r; dy <= r; dy += 1) {
      var hw = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.6));
      ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
  }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var patCache = {};
  /** 有序抖动填充：color 的 0–16 级 */
  function pat(ctx, color, level) {
    level = Math.max(0, Math.min(16, Math.round(level)));
    var key = color + level;
    if (!patCache[key]) {
      var c = mk(4, 4);
      var x = c.getContext('2d');
      x.fillStyle = color;
      for (var i = 0; i < 16; i += 1) if (BAYER[i] < level) x.fillRect(i % 4, i >> 2, 1, 1);
      patCache[key] = c;
    }
    return ctx.createPattern(patCache[key], 'repeat');
  }
  function dim(a) { g.globalAlpha = a; g.fillStyle = '#080b26'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  /** 像素抖动渐黑：level 0（不黑）– 1（全黑） */
  function fade(level, color) {
    if (level <= 0) return;
    g.fillStyle = pat(g, color || '#05071a', level * 16);
    g.fillRect(0, 0, W, H);
  }
  function hex(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }

  // ---------------------------------------------------------------- 海面

  var bandCache = {};
  function bands(st, hz) {
    var key = st.name + H + '|' + hz;
    if (bandCache[key]) return bandCache[key];
    var hh = H + 80;
    var c = mk(W, hh);
    var x = c.getContext('2d');
    var img = x.createImageData(W, hh);
    var d = img.data;
    function fill(y0, y1, cols) {
      var n = cols.length;
      var bh = (y1 - y0) / n;
      var rgb = cols.map(hex);
      for (var y = y0; y < y1; y += 1) {
        var t = (y - y0) / bh;
        var i = Math.min(n - 1, Math.floor(t));
        var left = (1 - (t - Math.floor(t))) * bh;
        for (var px = 0; px < W; px += 1) {
          var col = rgb[i];
          if (i < n - 1) {
            if (left <= 2 && (px + y) % 2 === 0) col = rgb[i + 1];
            else if (left <= 5 && px % 4 === (y % 2) * 2 && y % 2 === 0) col = rgb[i + 1];
          }
          var o = (y * W + px) * 4;
          d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
        }
      }
    }
    fill(0, hz, st.sky);
    fill(hz, hh, st.sea);
    x.putImageData(img, 0, 0);
    bandCache[key] = c;
    return c;
  }

  var stars = [];
  var glints = [];
  var clouds = [{ x: 20, y: 0.16, n: 0, v: 1.6 }, { x: 120, y: 0.42, n: 1, v: 1.1 }, { x: 70, y: 0.66, n: 2, v: 0.8 }];
  (function seed() {
    var s = 7;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    for (var i = 0; i < 46; i += 1) stars.push({ x: Math.floor(rnd() * W), y: rnd(), need: rnd(), ph: rnd() * 6.28, sp: 0.6 + rnd() * 1.6, big: rnd() < 0.18 });
    for (var j = 0; j < 44; j += 1) glints.push({ x: rnd() * W, y: rnd(), len: 2 + Math.floor(rnd() * 5), v: (rnd() < 0.5 ? -1 : 1) * (2 + rnd() * 5), ph: rnd() * 6.28 });
  })();

  /** 面朝塞壬的海面（首页、选歌、唱歌） */
  function backdrop(st, t, extra) {
    var hz = L.hz;
    g.drawImage(bands(st, hz), 0, 0);
    if (st.star > 0) {
      for (var i = 0; i < stars.length; i += 1) {
        var s = stars[i];
        if (s.need > st.star) continue;
        var sy = Math.floor(s.y * (hz - 14));
        var tw_ = Math.sin(t * s.sp + s.ph);
        g.fillStyle = tw_ > 0.2 ? '#ffffff' : '#aab4f0';
        g.fillRect(s.x, sy, 1, 1);
        if (s.big && tw_ > 0.75) { g.fillRect(s.x - 1, sy, 3, 1); g.fillRect(s.x, sy - 1, 1, 3); }
      }
    }
    var lx = 34;
    var lc = null;
    if (st.sun < 60 && st.sun > -40) {
      var cy = hz + st.sun;
      g.save(); g.beginPath(); g.rect(0, 0, W, hz); g.clip();
      disc(g, lx, cy, 19, '#ffe9a8');
      disc(g, lx, cy, 15, '#fff6d0');
      g.restore();
      lc = '#fff1c0';
    } else if (st.moon >= 0) {
      var my = hz - 34 - st.moon * 24;
      g.fillStyle = pat(g, '#dfe4ff', 3);
      for (var dy = -15; dy <= 15; dy += 1) { var hw = Math.floor(Math.sqrt(225 - dy * dy)); g.fillRect(lx - hw, my + dy, hw * 2 + 1, 1); }
      disc(g, lx, my, 9, '#fff6d8');
      g.fillStyle = '#e9dcae'; g.fillRect(lx - 4, my - 3, 2, 2); g.fillRect(lx + 2, my + 2, 3, 2); g.fillRect(lx + 1, my - 5, 1, 1);
      lc = '#e6e2ff';
    }
    for (var c = 0; c < clouds.length; c += 1) {
      var cl = clouds[c];
      var cx = ((cl.x + t * cl.v) % (W + 60)) - 50;
      var cyy = Math.floor(cl.y * (hz - 30)) + 4;
      if (st === DAY) spr(g, 'cloud' + cl.n, cx, cyy); else sprT(g, 'cloud' + cl.n, cx, cyy, st.cloud, 'mul');
    }
    var ix = W - 50;
    var iy = hz - 36;
    if (st === DAY) spr(g, 'island', ix, iy); else sprT(g, 'island', ix, iy, st.far, 'mul');
    if (st.star > 0.2 && Math.floor(t / 1.4) % 2 === 0) { g.fillStyle = '#fff3b0'; g.fillRect(ix + 14, iy + 5, 7, 1); g.fillRect(ix + 17, iy + 2, 1, 7); g.fillRect(ix + 16, iy + 4, 3, 3); }
    if (extra) extra(st);
    if (lc) {
      for (var y = hz + 2; y < hz + 74 && y < H; y += 2) {
        var k = (y - hz) / 74;
        var wv = 3 + Math.floor(k * 10) + Math.floor(2 * Math.sin(t * 3 + y * 0.9));
        g.fillStyle = (y % 4 === 0) ? lc : pat(g, lc, 8);
        g.fillRect(lx - wv + Math.round(2 * Math.sin(t * 1.7 + y)), y, wv * 2, 1);
      }
    }
    seaGlints(st, t, hz);
  }

  function seaGlints(st, t, hz) {
    g.fillStyle = st.glint;
    for (var q = 0; q < glints.length; q += 1) {
      var gl = glints[q];
      var gy = hz + 3 + Math.floor(gl.y * gl.y * (H + 40 - hz));
      if (gy >= H) continue;
      var depth = (gy - hz) / (H - hz);
      var len = Math.max(1, Math.round(gl.len * (0.4 + depth)));
      var gx = (((gl.x + t * gl.v * (0.3 + depth)) % (W + 20)) + W + 20) % (W + 20) - 10;
      if (Math.sin(t * 1.3 + gl.ph) > -0.4) g.fillRect(Math.round(gx), gy, len, 1);
    }
  }

  /** 转过来看海的镜头（结尾开船）：月亮、短月光、星星 */
  function backdropRev(st, t, hz) {
    g.drawImage(bands(st, hz), 0, 0);
    for (var i = 0; i < stars.length; i += 1) {
      var sv = stars[i];
      if (sv.need > st.star) continue;
      var sy = Math.floor(sv.y * (hz - 10));
      var tw_ = Math.sin(t * sv.sp + sv.ph);
      var sx = (sv.x * 7 + 31) % W;
      g.fillStyle = tw_ > 0.2 ? '#ffffff' : '#aab4f0';
      g.fillRect(sx, sy, 1, 1);
      if (sv.big && tw_ > 0.75) { g.fillRect(sx - 1, sy, 3, 1); g.fillRect(sx, sy - 1, 1, 3); }
    }
    var mx = 116;
    var my = Math.max(14, hz - 50);
    g.fillStyle = pat(g, '#dfe4ff', 2);
    for (var dy = -16; dy <= 16; dy += 1) { var hw = Math.floor(Math.sqrt(256 - dy * dy)); g.fillRect(mx - hw, my + dy, hw * 2 + 1, 1); }
    disc(g, mx, my, 10, '#fff6d8');
    g.fillStyle = '#e9dcae'; g.fillRect(mx - 5, my - 3, 3, 2); g.fillRect(mx + 3, my + 2, 2, 2); g.fillRect(mx + 1, my - 6, 1, 1);
    for (var y = hz + 2; y < hz + 64 && y < H; y += 2) {
      var k = (y - hz) / 64;
      var wv = 2 + Math.floor(k * 9) + Math.floor(1.5 * Math.sin(t * 3 + y * 0.9));
      g.fillStyle = k < 0.35 && y % 4 === 0 ? '#e6e2ff' : pat(g, '#e6e2ff', Math.round(9 - k * 7));
      g.fillRect(mx - wv + Math.round(2 * Math.sin(t * 1.7 + y)), y, wv * 2, 1);
    }
    seaGlints(st, t, hz);
  }

  // ---------------------------------------------------------------- 塞壬

  var META = Siren.SIREN_META;
  /** face: calm / sing / listen；glow 0–1 是她身后的光晕 */
  function siren(face, t, st, glow) {
    var name = 'siren_' + face;
    var r = A[name];
    if (!r) return;
    var sw = r[2];
    var shh = r[3];
    var x = L.sirenX;
    var y = L.sirenY;
    var hgt = Math.max(shh, L.rockFoot - L.sirenY);
    var ext = hgt - shh;
    if (glow > 0) {
      var gx = L.sirenX + 70;
      var gy = L.sirenY + 46;
      [[46, 1], [36, 2], [26, 4]].forEach(function (p) {
        g.fillStyle = pat(g, '#b9c4ff', p[1] * glow);
        for (var dy = -p[0]; dy <= p[0]; dy += 1) { var hw = Math.floor(Math.sqrt(p[0] * p[0] - dy * dy)); g.fillRect(gx - hw, gy + dy, hw * 2, 1); }
      });
    }
    sc.clearRect(0, 0, 128, 200);
    var edge = reduceMotion ? 0 : META.edge;
    sc.drawImage(atlas, r[0] + edge, r[1], sw - edge, shh, edge, 0, sw - edge, shh);
    for (var cx = 0; cx < edge; cx += 1) {   // 头发末梢被风吹动
      var amp = 1.6 * (1 - cx / edge);
      sc.drawImage(atlas, r[0] + cx, r[1], 1, shh, cx, Math.round(amp * Math.sin(t * 2.6 + cx * 0.28)), 1, shh);
    }
    for (var e = 0; e < ext; e += 1) sc.drawImage(atlas, r[0], r[1] + shh - 1, sw, 1, 0, shh + e, sw, 1);
    if (st !== DAY) {   // 月光：乘色后裁回她自己的形状
      sm.clearRect(0, 0, 128, 200);
      sm.drawImage(sirenC, 0, 0);
      sc.globalCompositeOperation = 'multiply';
      sc.fillStyle = st.self;
      sc.fillRect(0, 0, sw, hgt);
      sc.globalCompositeOperation = 'destination-in';
      sc.drawImage(sirenM, 0, 0);
      sc.globalCompositeOperation = 'source-over';
    }
    g.drawImage(sirenC, 0, 0, sw, hgt, x, y, sw, hgt);
    var fy = L.rockFoot - 3;
    var fx = L.sirenX + 21;
    var f = (Math.floor(t * 2.2) % 2) ? 'foam_a' : 'foam_b';
    if (st === DAY) spr(g, f, fx, fy); else sprT(g, f, fx, fy, st.tint, 'mul');
    g.fillStyle = st === DAY ? '#ffffff' : st.tint;
    var b = Math.floor(t * 2.2) % 4;
    g.fillRect(fx + 4 + b, fy - 3, 1, 1);
    g.fillRect(fx + 76 - b, fy - 4, 1, 1);
    g.fillRect(fx - 2, fy - 1 - (b % 2), 2, 1);
  }

  /**
   * 海面 + 塞壬。天色切换时（mix < 1）用抖动在两种天色之间过渡。
   * @param {string} face   calm / sing / listen
   * @param {Object} prev   上一个天色
   * @param {Object} st     当前天色
   * @param {number} mix    0–1
   */
  function world(face, t, prev, st, mix, glow, extra) {
    if (mix < 1 && prev && prev !== st) {
      backdrop(prev, t, extra);
      tg.clearRect(0, 0, W, H);
      var keep = g;
      g = tg;
      backdrop(st, t, extra);
      g = keep;
      tg.globalCompositeOperation = 'destination-in';
      tg.fillStyle = pat(tg, '#000000', mix * 16);
      tg.fillRect(0, 0, W, H);
      tg.globalCompositeOperation = 'source-over';
      g.drawImage(tmp, 0, 0);
    } else {
      backdrop(st, t, extra);
    }
    siren(face, t, st, glow);
  }

  // ---------------------------------------------------------------- 粒子

  var parts = [];
  function emit(p) { p.age = 0; parts.push(p); }
  function burst(x, y, n, color) {
    for (var i = 0; i < n; i += 1) {
      var a = Math.random() * 6.28;
      var v = 14 + Math.random() * 26;
      emit({ k: 'spark', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, life: 0.35 + Math.random() * 0.3, c: color });
    }
  }
  function stepParts(dt) {
    for (var i = parts.length - 1; i >= 0; i -= 1) {
      var p = parts[i];
      p.age += dt;
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      if (p.k === 'spark') p.vy += 60 * dt;
      if (p.age > p.life) parts.splice(i, 1);
    }
  }
  function drawParts() {
    for (var i = 0; i < parts.length; i += 1) {
      var p = parts[i];
      var x = Math.round(p.x);
      var y = Math.round(p.y);
      if (p.k === 'note') spr(g, p.n2 ? 'i_note2' : 'i_note', x + Math.round(2 * Math.sin(p.age * 5 + p.ph)), y);
      else if (p.k === 'heart') spr(g, 'i_heart', x + Math.round(2 * Math.sin(p.age * 4 + p.ph)), y);
      else if (p.k === 'spark') {
        g.fillStyle = p.c;
        g.fillRect(x, y, 1, 1);
        if (p.age < p.life * 0.5) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
      }
    }
  }

  // ---------------------------------------------------------------- 导出

  function load(done) {
    var n = 0;
    function one() { n += 1; if (n === 2) done(); }
    atlas.onload = one;
    fontImg.onload = one;
    atlas.src = './assets/pixel/atlas.png';
    fontImg.src = './assets/pixel/font.png';
  }

  Siren.Gfx = {
    C: C, TIER: TIER, STAGES: STAGES, DAY: DAY, L: L,
    W: function () { return W; }, H: function () { return H; },
    ctx: function () { return g; }, setCtx: function (c) { g = c; },
    main: lg, tmp: tmp, tmpCtx: tg, bufA: bufA, mk: mk, screen: screen,
    load: load, resize: resize, present: present,
    spr: spr, sprT: sprT, size: size, has: function (n) { return !!A[n]; },
    text: text, tw: tw, fit: fit, wrap: wrap, lineH: function () { return FONT.h; },
    shape: shape, panel: panel, disc: disc, pat: pat, dim: dim, fade: fade,
    backdrop: backdrop, backdropRev: backdropRev, siren: siren, world: world,
    parts: parts, emit: emit, burst: burst, stepParts: stepParts, drawParts: drawParts,
    reduceMotion: reduceMotion
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
