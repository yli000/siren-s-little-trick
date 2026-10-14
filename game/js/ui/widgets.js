/* 塞壬的小把戏 —— 前端：widgets.js（统一按钮、卡片、滚动、弹层、文案）
 *
 * v2 只有一种按钮（修改意见 §1.2）：同一套底色、描边和按下效果；主次只靠位置区分。
 * 列表项（歌曲、练习、设置）是同一种卡片换内容。
 */
(function (global) {
  'use strict';

  var Siren = global.Siren = global.Siren || {};
  var Gfx = Siren.Gfx;
  var C = Gfx.C;

  // ---------------------------------------------------------------- 文案

  function lang() { return Siren.Progress.lang(); }
  /** 取文案：t('visitN', { n: 3 }) */
  function t(key, vars) {
    var dict = Siren.I18N[lang()] || Siren.I18N.zh;
    var s = dict[key];
    if (s === undefined) s = Siren.I18N.zh[key] !== undefined ? Siren.I18N.zh[key] : key;
    if (vars) for (var k in vars) if (Object.prototype.hasOwnProperty.call(vars, k)) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }
  /** 双语字段：{ zh, en } → 当前语言 */
  function L(obj) { return obj ? (obj[lang()] || obj.zh) : ''; }

  // ---------------------------------------------------------------- 点击区域

  var regions = [];
  var activeScroll = null;
  var drag = null;
  var pressed = null;
  var soundOnUp = false;
  var primary = null;
  var backAct = null;
  var now = 0;

  function beginFrame(time) {
    regions = [];
    primary = null;
    backAct = null;
    activeScroll = null;
    now = time;
  }

  /** 注册一个点击区域（后注册的在上层） */
  function hit(id, x, y, w, h, act, opt) {
    regions.push({ id: id, x: x - 2, y: y - 2, w: w + 4, h: h + 5, act: act, opt: opt || {} });
  }

  /** 弹层：先挡住下面所有东西 */
  function block(act) {
    regions.push({ id: '__block', x: 0, y: 0, w: Gfx.W(), h: Gfx.H(), act: act || function () {}, opt: { silent: true } });
  }

  function find(p) {
    for (var i = regions.length - 1; i >= 0; i -= 1) {
      var r = regions[i];
      if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) return r;
    }
    return null;
  }

  // ---------------------------------------------------------------- 按钮

  /**
   * 按钮。全游戏一种样式；首页用 opt.look = 'gold'（原型里的黄色）。
   * opt.icon 单色图标（会被染成文字色）· opt.locked 暂不可点（刚出现的按钮防误触）· opt.primary 回车触发
   */
  function btn(id, x, y, w, h, label, act, opt) {
    opt = opt || {};
    var g = Gfx.ctx();
    var down = pressed === id;
    var yy = y + (down ? 2 : 0);
    var locked = !!opt.locked;
    var gold = opt.look === 'gold';
    if (gold) {
      Gfx.panel(g, x, yy, w, h, 6, C.GOLD, C.INK, down ? null : C.INK);
      g.fillStyle = '#ffe98a'; g.fillRect(x + 4, yy + 2, w - 8, 1);
      g.fillStyle = C.GOLD_D; g.fillRect(x + 3, yy + h - 3, w - 6, 1);
    } else {
      Gfx.panel(g, x, yy, w, h, 6, locked ? '#232a63' : C.NAVY_L, C.NAVY_LL, down ? null : C.INK);
      if (!locked) { g.fillStyle = '#3a4490'; g.fillRect(x + 4, yy + 2, w - 8, 1); }
    }
    var col = gold ? C.INK : locked ? '#5a66b8' : C.CREAM;
    var iw = opt.icon ? Gfx.size(opt.icon).w + (label ? 4 : 0) : 0;
    var lw = label ? Gfx.tw(label) : 0;
    var x0 = Math.round(x + (w - iw - lw) / 2);
    if (opt.icon) {
      var sz = Gfx.size(opt.icon);
      var iy = yy + Math.floor((h - sz.h) / 2);
      if (opt.raw || opt.icon === 'i_book') Gfx.spr(g, opt.icon, x0, iy); else Gfx.sprT(g, opt.icon, x0, iy, col);
    }
    if (label) Gfx.text(g, label, x0 + iw, yy + Math.floor((h - Gfx.lineH()) / 2) + 1, { c: col });
    if (!locked) hit(id, x, y, w, h, act);
    if (opt.primary && !locked) primary = act;
  }

  /** 左上角 / 右上角的小方形图标按钮（返回、暂停） */
  function iconBtn(id, x, y, icon, act, opt) {
    btn(id, x, y, 18, 18, null, act, { icon: icon });
    if (opt && opt.back) backAct = act;
  }

  /** 列表卡片：同一种底板，内容由 draw(x, y) 画 */
  function card(id, x, y, w, h, act, draw, opt) {
    opt = opt || {};
    var g = Gfx.ctx();
    var down = pressed === id;
    var yy = y + (down ? 2 : 0);
    Gfx.panel(g, x, yy, w, h, 6, opt.fill || C.NAVY_L, opt.line || C.NAVY_LL, down ? null : C.INK);
    if (draw) draw(x, yy);
    if (act) hit(id, x, y, w, h, act, { clip: opt.clip });
  }

  /** 顶栏：左边返回或暂停，中间标题 */
  function topBar(title, onBack, opt) {
    opt = opt || {};
    var g = Gfx.ctx();
    if (onBack) iconBtn('back', 8, 8, opt.pause ? 'i_pause' : 'i_back', onBack, { back: true });
    if (title) Gfx.text(g, Gfx.fit(title, Gfx.W() - 64), Gfx.W() / 2, 10, { c: C.CREAM, a: 'c', o: C.INK });
  }

  // ---------------------------------------------------------------- 滚动

  /**
   * 一个可拖动的纵向列表。state = { y, v, max }（由屏幕持有，跨帧保留）。
   * 返回本帧的偏移量；内容需要画在 [top, top + viewH) 里并自行裁剪。
   */
  function scroller(state, top, viewH, contentH, dt) {
    state.max = Math.max(0, contentH - viewH);
    state.top = top;
    state.viewH = viewH;
    if (!drag || drag.state !== state) {
      // 惯性
      if (Math.abs(state.v) > 1) {
        state.y += state.v * dt;
        state.v *= Math.pow(0.04, dt);
      } else state.v = 0;
    }
    if (state.y < 0) { state.y = 0; state.v = 0; }
    if (state.y > state.max) { state.y = state.max; state.v = 0; }
    activeScroll = state;
    return Math.round(state.y);
  }
  function scrollbar(state) {
    if (!(state.max > 0)) return;
    var g = Gfx.ctx();
    var th = Math.max(16, Math.round(state.viewH * state.viewH / (state.viewH + state.max)));
    var x = Gfx.W() - 4;
    g.fillStyle = '#2a3270';
    g.fillRect(x, state.top, 2, state.viewH);
    g.fillStyle = C.DIM;
    g.fillRect(x, state.top + Math.round((state.viewH - th) * state.y / state.max), 2, th);
  }

  // ---------------------------------------------------------------- 小部件

  var STAR = ['...K...', '..KYK..', 'KKKYKKK', 'KYYYYYK', '.KYYYK.', 'KYKKKYK', 'KK...KK'];
  function star(x, y, on) {
    var g = Gfx.ctx();
    for (var r = 0; r < 7; r += 1) for (var c = 0; c < 7; c += 1) {
      var ch = STAR[r][c];
      if (ch === '.') continue;
      g.fillStyle = ch === 'K' ? C.INK : (on ? C.GOLD : '#46508f');
      g.fillRect(x + c, y + r, 1, 1);
    }
    if (on) { g.fillStyle = '#fff6c0'; g.fillRect(x + 3, y + 2, 1, 1); }
  }

  /** 难度点：level 个亮点（共 3 个） */
  function levelDots(x, y, level) {
    var g = Gfx.ctx();
    for (var k = 0; k < 3; k += 1) {
      g.fillStyle = k < level ? C.GOLD : '#46508f';
      g.fillRect(x + k * 7, y, 5, 5);
      g.fillStyle = k < level ? '#ffe98a' : '#5a66b8';
      g.fillRect(x + 1 + k * 7, y + 1, 2, 2);
    }
  }

  /** 名牌丝带：两端折角，名字 2 倍字号 */
  function ribbon(cx, y, str, rc) {
    var g = Gfx.ctx();
    var s = Gfx.tw(str, 2) + 24 <= Gfx.W() - 30 ? 2 : 1;
    var w = Math.max(84, Gfx.tw(str, s) + 24);
    var x = Math.round(cx - w / 2);
    var h = s === 2 ? 30 : 20;
    var tail = h - 8;
    for (var side = 0; side < 2; side += 1) {
      for (var j = 0; j < tail; j += 1) {
        var notch = Math.round(5 - Math.abs(j - (tail - 1) / 2) * 5 / ((tail - 1) / 2));
        var x0 = side ? x + w - 4 : x - 12 + notch;
        var x1 = side ? x + w + 12 - notch : x + 4;
        g.fillStyle = C.INK; g.fillRect(x0 - 1, y + 7 + j, x1 - x0 + 2, 1);
        if (j > 0 && j < tail - 1) { g.fillStyle = rc[1]; g.fillRect(x0, y + 7 + j, x1 - x0, 1); }
      }
    }
    Gfx.panel(g, x, y, w, h, 3, rc[0], C.INK, C.INK);
    g.fillStyle = '#ffffff';
    g.globalAlpha = 0.35;
    g.fillRect(x + 3, y + 2, w - 6, 1);
    g.globalAlpha = 1;
    Gfx.text(g, str, cx, y + (s === 2 ? 2 : 4), { c: C.INK, s: s, a: 'c' });
    return h;
  }

  /** 下拉箭头：open 时朝上 */
  function caret(x, y, open, color) {
    var g = Gfx.ctx();
    g.fillStyle = color || '#b9c4ff';
    for (var r = 0; r < 3; r += 1) {
      var yy = open ? y + 2 - r : y + r;
      g.fillRect(x + r, yy, 5 - 2 * r, 1);
    }
  }

  /** 小锁（练习没解锁时） */
  function lock(x, y, color) {
    var g = Gfx.ctx();
    g.fillStyle = color || '#5a66b8';
    g.fillRect(x + 1, y, 3, 1); g.fillRect(x, y + 1, 1, 3); g.fillRect(x + 4, y + 1, 1, 3);
    g.fillRect(x - 1, y + 4, 7, 5);
    g.fillStyle = C.NAVY_L; g.fillRect(x + 2, y + 6, 1, 2);
  }

  /**
   * 居中的小弹窗：标题、正文、按钮。buttons = [{ label, act, primary }]（一个或两个）。
   * onClose：点弹窗外面、按返回时调用。
   */
  function popup(title, body, buttons, onClose) {
    var g = Gfx.ctx();
    var W = Gfx.W();
    var H = Gfx.H();
    Gfx.dim(0.66);
    block(onClose || function () {});
    var lines = body ? Gfx.wrap(body, W - 56) : [];
    var h = 34 + lines.length * 14 + (lines.length ? 8 : 0) + 30;
    var y = Math.round((H - h) / 2);
    Gfx.panel(g, 16, y, W - 32, h, 8, C.NAVY, C.NAVY_LL, C.INK);
    Gfx.text(g, title, W / 2, y + 12, { c: C.CREAM, a: 'c' });
    for (var i = 0; i < lines.length; i += 1) Gfx.text(g, lines[i], W / 2, y + 32 + i * 14, { c: '#c6ccf5', a: 'c' });
    var by = y + h - 32;
    if (buttons.length === 1) btn('pop0', W / 2 - 40, by, 80, 24, buttons[0].label, buttons[0].act, { primary: true });
    else {
      var bw = Math.floor((W - 32 - 24 - 8) / 2);
      for (var k = 0; k < buttons.length; k += 1) btn('pop' + k, 28 + k * (bw + 8), by, bw, 24, buttons[k].label, buttons[k].act, { primary: !!buttons[k].primary });
    }
    if (onClose) backAct = onClose;
  }

  /** 小标签 */
  function pill(x, y, label, fill, color, line) {
    var g = Gfx.ctx();
    var w = Gfx.tw(label) + 10;
    Gfx.panel(g, x, y, w, 15, 5, fill, line || C.INK, null);
    Gfx.text(g, label, x + w / 2, y + 1, { c: color || C.CREAM, a: 'c' });
    return w;
  }

  // ---------------------------------------------------------------- 提示条

  var toastMsg = null;
  var toastUntil = 0;
  function toast(msg, secs) { toastMsg = msg; toastUntil = now + (secs || 2.6); }
  function drawToast() {
    if (!toastMsg || now > toastUntil) return;
    var g = Gfx.ctx();
    var lines = Gfx.wrap(toastMsg, Gfx.W() - 40);
    var h = lines.length * 14 + 8;
    var y = 34;
    Gfx.panel(g, 12, y, Gfx.W() - 24, h, 6, C.NAVY, C.NAVY_LL, C.INK);
    for (var i = 0; i < lines.length; i += 1) Gfx.text(g, lines[i], Gfx.W() / 2, y + 4 + i * 14, { c: C.CREAM, a: 'c' });
  }

  // ---------------------------------------------------------------- 输入

  function pos(ev) {
    var r = Gfx.screen.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * Gfx.W(), y: (ev.clientY - r.top) / r.height * Gfx.H() };
  }

  function bindInput(onFirstTouch) {
    var s = Gfx.screen;
    s.addEventListener('pointerdown', function (ev) {
      if (onFirstTouch) onFirstTouch();
      var p = pos(ev);
      var r = find(p);
      pressed = r ? r.id : null;
      drag = null;
      if (activeScroll && p.y >= activeScroll.top && p.y < activeScroll.top + activeScroll.viewH && (!r || r.opt.clip !== false)) {
        drag = { state: activeScroll, y0: p.y, s0: activeScroll.y, last: p.y, lastT: now, moved: false };
        activeScroll.v = 0;
      }
      // 按下就出声（以前等手指抬起才响，手机上会觉得慢半拍）；能拖动的列表里还分不清是点还是滑，等抬起再响
      soundOnUp = !!(r && !r.opt.silent && drag);
      if (r && !r.opt.silent && !drag) Siren.Audio.sfx('tap');
      try { s.setPointerCapture(ev.pointerId); } catch (e) { /* 不是必须的 */ }
      ev.preventDefault();
    });
    s.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var p = pos(ev);
      if (Math.abs(p.y - drag.y0) > 4) { drag.moved = true; pressed = null; }
      if (drag.moved) {
        drag.state.y = drag.s0 - (p.y - drag.y0);
        var dtm = Math.max(0.016, now - drag.lastT);
        drag.state.v = -(p.y - drag.last) / dtm;
        drag.last = p.y;
        drag.lastT = now;
      }
    });
    s.addEventListener('pointerup', function (ev) {
      var p = pos(ev);
      var r = find(p);
      var moved = drag && drag.moved;
      if (r && r.id === pressed && !moved) {
        if (soundOnUp) Siren.Audio.sfx('tap');
        r.act();
      }
      pressed = null;
      drag = null;
    });
    s.addEventListener('pointercancel', function () { pressed = null; drag = null; });
    s.addEventListener('wheel', function (ev) {
      if (activeScroll) { activeScroll.y += ev.deltaY * 0.4; activeScroll.v = 0; ev.preventDefault(); }
    }, { passive: false });
    global.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        if (onFirstTouch) onFirstTouch();
        if (primary) { Siren.Audio.sfx('tap'); primary(); ev.preventDefault(); }
      } else if (ev.key === 'Escape' && backAct) { backAct(); ev.preventDefault(); }
      else if (activeScroll && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
        activeScroll.y += ev.key === 'ArrowDown' ? 40 : -40;
        ev.preventDefault();
      }
    });
  }

  Siren.UI = {
    t: t, L: L, lang: lang,
    beginFrame: beginFrame, hit: hit, block: block,
    btn: btn, iconBtn: iconBtn, card: card, topBar: topBar, caret: caret, lock: lock, popup: popup,
    scroller: scroller, scrollbar: scrollbar, clearScroll: function () { activeScroll = null; },
    star: star, levelDots: levelDots, ribbon: ribbon, pill: pill,
    toast: toast, drawToast: drawToast,
    bindInput: bindInput,
    back: function () { if (backAct) backAct(); return !!backAct; },
    setBack: function (fn) { backAct = fn; },
    setPrimary: function (fn) { primary = fn; }
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
