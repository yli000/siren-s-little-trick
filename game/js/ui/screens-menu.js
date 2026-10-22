/* 塞壬的小把戏 —— 前端：screens-menu.js（首页、选歌、图鉴、练习列表、设置）*/
(function (global) {
  'use strict';

  var Siren = global.Siren = global.Siren || {};
  var Gfx = Siren.Gfx;
  var UI = Siren.UI;
  var C = Gfx.C;
  var Progress = Siren.Progress;
  var Audio = Siren.Audio;
  var Screens = Siren.Screens = Siren.Screens || {};
  var t_ = UI.t;
  function App() { return Siren.App; }
  function ships() { return Siren.SHIPS; }

  // ================================================================ 首页

  // 她在首页也一句一句地唱（和唱歌时同一套表情与飘出来的音符，只有动作没有声音）。
  // [开口时刻, 时长]（秒），一轮 TUNE_LEN 秒
  var TUNE = [[0, 0.38], [0.45, 0.38], [0.9, 0.38], [1.35, 0.38], [1.8, 0.8], [3.3, 0.38], [3.75, 0.38], [4.2, 0.9]];
  var TUNE_LEN = 6.4;
  var tuneSeen = -1;

  function titleFace(t) {
    var L = Gfx.L;
    var cyc = Math.floor(t / TUNE_LEN);
    var u = t - cyc * TUNE_LEN;
    var face = 'calm';
    for (var i = 0; i < TUNE.length; i += 1) {
      var n = TUNE[i];
      if (u < n[0]) break;
      var id = cyc * TUNE.length + i;
      if (id > tuneSeen) {
        tuneSeen = id;
        if (u - n[0] < 0.2 && !Gfx.reduceMotion) Gfx.emit({ k: 'note', x: L.sirenX + 96 + Math.random() * 12, y: L.sirenY + 44, vy: -16, vx: 5, life: 1.5, ph: Math.random() * 6, n2: i % 2 });
      }
      if (u < n[0] + n[1] * 0.8) face = 'sing';
    }
    return face;
  }

  /** 首页的四个选项：黄色按钮竖排（按钮矮一点、间距大一点，不那么挤） */
  function titleMenu(items) {
    var W = Gfx.W();
    var H = Gfx.H();
    var bw = 96;
    var bh = 20;
    var gap = 9;
    var top = Math.max(Gfx.L.rockFoot + 6, H - items.length * (bh + gap) - 8);
    for (var k = 0; k < items.length; k += 1) {
      UI.btn('m' + k, Math.round((W - bw) / 2), top + k * (bh + gap), bw, bh, t_(items[k][0]), items[k][1], { primary: k === 0, look: 'gold' });
    }
  }

  Screens.title = {
    enter: function () {},
    draw: function (t) {
      var g = Gfx.ctx();
      var W = Gfx.W();
      var L = Gfx.L;
      var st = Gfx.STAGES[0];
      // 远处的小船：最近来过的 3 艘（审查第 9 条）；还没有就随便放 3 个剪影
      var rec = Progress.recent();
      var far = rec.length ? rec : ['tug', 'sail', 'ferry'];
      Gfx.world(titleFace(t), t, null, st, 1, 0, function (s) {
        var gg = Gfx.ctx();
        for (var i = 0; i < far.length; i += 1) {
          var bx = ((30 + i * 67 + t * (2.2 + i * 0.7)) % (W + 40)) - 20;
          Gfx.sprT(gg, 's12_' + far[i], bx, L.hz - 8 + (i === 1 ? 0 : 1), s.far, 'mul');
        }
      });
      Gfx.drawParts();

      // 标题：中文一行逐字起伏，英文两行（行距收紧，不压到她的头发：发顶约在 sirenY + 12）
      var title = t_('title');
      var en = Progress.lang() === 'en';
      var lines = en ? ["Siren's", 'Little Trick'] : [title];
      var lh = en ? 24 : 28;
      var y0 = en ? Math.max(2, Math.min(8, L.sirenY + 12 - 2 * lh - 2)) : 30;
      for (var li = 0; li < lines.length; li += 1) {
        var s = lines[li];
        var x = Math.round((W - Gfx.tw(s, 2)) / 2);
        for (var i = 0; i < s.length; i += 1) {
          var bob = Gfx.reduceMotion ? 0 : Math.round(1.6 * Math.sin(t * 2.2 - (i + li * 3) * 0.7));
          Gfx.text(g, s[i], x, y0 + li * lh + bob, { c: C.CREAM, s: 2, o: C.INK, sh: C.INK });
          x += Gfx.tw(s[i], 2);
        }
      }
      if (Math.floor(t * 1.2) % 3 === 0 && Math.random() < 0.3) Gfx.emit({ k: 'spark', x: 14 + Math.random() * 150, y: 24 + Math.random() * 40, life: 0.5, c: '#fff6d0' });

      titleMenu([
        ['start', function () { App().go('select'); }],
        ['practice', function () { App().go('practice'); }],
        ['codex', function () { App().go('codex', { from: 'title' }); }],
        ['settings', function () { App().go('settings'); }]
      ]);
    },
    back: function () {}
  };

  // ================================================================ 选歌

  var sel = { scroll: { y: 0, v: 0 } };

  function contour(song, x, y, w, h) {
    var g = Gfx.ctx();
    var p = Siren.Music.parsePhrase(song.phrases[0]).filter(function (n) { return n.rel !== null; });
    var lo = 99;
    var hi = -99;
    var tot = 0;
    var i;
    for (i = 0; i < p.length; i += 1) { lo = Math.min(lo, p[i].rel); hi = Math.max(hi, p[i].rel); tot += p[i].eighths; }
    var cur = 0;
    for (i = 0; i < p.length; i += 1) {
      var bx = x + Math.round(cur / tot * w);
      var bw = Math.max(2, Math.round(p[i].eighths / tot * w) - 1);
      var by = y + h - 2 - Math.round((p[i].rel - lo) / Math.max(1, hi - lo) * (h - 2));
      g.fillStyle = C.INK; g.fillRect(bx, by, bw, 2);
      g.fillStyle = C.TEAL; g.fillRect(bx, by, bw, 1);
      cur += p[i].eighths;
    }
  }

  /** 这首歌上次来的那艘船；还没唱过就是一个问号 */
  function lastShipSlot(song, x, y) {
    var g = Gfx.ctx();
    var key = Progress.songInfo(song.id).lastShip;
    g.fillStyle = C.INK; g.fillRect(x, y, 36, 30);
    g.fillStyle = key ? '#3d5bb0' : '#1a2150'; g.fillRect(x + 1, y + 1, 34, 28);
    if (key) {
      g.fillStyle = '#57b9f5'; g.fillRect(x + 1, y + 18, 34, 11);
      Gfx.spr(g, 's32_' + key, x + 2, y + 3);
    } else {
      Gfx.text(g, '?', x + 18, y + 8, { c: '#5a66b8', a: 'c' });
    }
  }

  function pickRandomSong() {
    var list = Siren.SONGS;
    var fresh = list.filter(function (s) { return Progress.songInfo(s.id).plays === 0; });
    var pool = fresh.length ? fresh : list;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  Screens.select = {
    enter: function () {
      sel.scroll.v = 0;
      // 记住上次唱的那首：滚到它附近（审查第 14 条）
      var last = Progress.lastSong();
      var idx = -1;
      for (var i = 0; i < Siren.SONGS.length; i += 1) if (Siren.SONGS[i].id === last) idx = i;
      sel.scroll.y = idx > 2 ? (idx - 1) * 44 : 0;
    },
    draw: function (t, dt) {
      var g = Gfx.ctx();
      var W = Gfx.W();
      var H = Gfx.H();
      Gfx.backdrop(Gfx.STAGES[0], t);
      Gfx.dim(0.3);
      var top = 32;
      var viewH = H - top - 4;
      var songs = Siren.SONGS;
      var rowH = 44;
      var contentH = (songs.length + 1) * rowH + 4;
      var off = UI.scroller(sel.scroll, top, viewH, contentH, dt);
      var firstTime = !Progress.anySongPlayed();

      g.save();
      g.beginPath(); g.rect(0, top, W, viewH); g.clip();
      // 随便来一首
      var y = top + 2 - off;
      UI.card('rnd', 8, y, 164, 38, function () { App().startSong(pickRandomSong()); }, function (x, yy) {
        Gfx.sprT(Gfx.ctx(), 'i_dice', x + 12, yy + 14, C.CREAM);
        Gfx.text(Gfx.ctx(), t_('random'), x + 28, yy + 13, { c: C.CREAM });
      });
      for (var i = 0; i < songs.length; i += 1) {
        (function (song, yy) {
          if (yy > H || yy < top - rowH) return;
          var highlight = firstTime && song.id === 'twinkle';
          UI.card('song' + song.id, 8, yy, 164, 40, function () { App().startSong(song); }, function (x, y2) {
            var gg = Gfx.ctx();
            Gfx.text(gg, Gfx.fit(UI.L(song.title), 112), x + 8, y2 + 5, { c: C.CREAM });
            UI.levelDots(x + 9, y2 + 27, song.level);
            // 第一次来：小星星的走向线换成「从这首开始」（放在卡片里，不压别的东西）
            if (highlight) UI.pill(x + 32, y2 + 22, t_('startHere'), C.GOLD, C.INK);
            else contour(song, x + 34, y2 + 23, 70, 10);
            if (Progress.songInfo(song.id).plays > 0) Gfx.sprT(gg, 'i_check', x + 106, y2 + 26, C.GOLD);
            lastShipSlot(song, x + 122, y2 + 5);
          }, highlight ? { line: C.GOLD } : null);
        })(songs[i], top + 2 + (i + 1) * rowH - off);
      }
      g.restore();
      UI.scrollbar(sel.scroll);

      // 顶栏画在列表上面
      UI.topBar(null, function () { App().go('title'); });
    },
    back: function () { App().go('title'); }
  };

  // ================================================================ 图鉴

  var cdx = { scroll: { y: 0, v: 0 }, sel: -1, from: 'title' };

  function seaCell(x, y, w, h) {
    var g = Gfx.ctx();
    g.fillStyle = '#bfe9ff'; g.fillRect(x, y, w, h);
    var y0 = y + Math.floor(h * 0.42);
    g.fillStyle = '#57b9f5'; g.fillRect(x, y0, w, y + h - y0);
    g.fillStyle = '#3fa8ef'; g.fillRect(x, y + h - Math.floor(h * 0.22), w, Math.floor(h * 0.22));
    g.fillStyle = '#8fd4fc'; g.fillRect(x + 4, y0 + 3, 3, 1); g.fillRect(x + w - 11, y0 + 6, 4, 1);
  }
  function frame(x, y, w, h, light, dark) {
    var g = Gfx.ctx();
    g.fillStyle = dark; g.fillRect(x, y, w, h);
    g.fillStyle = light; g.fillRect(x + 1, y + 1, w - 2, h - 2);
  }

  Screens.codex = {
    enter: function (p) {
      cdx.from = p.from || 'title';
      cdx.sel = typeof p.sel === 'number' ? p.sel : -1;
      cdx.scroll.v = 0;
    },
    draw: function (t, dt) {
      var g = Gfx.ctx();
      var W = Gfx.W();
      var H = Gfx.H();
      g.drawImage(Gfx.dotBg(), 0, 0);
      var list = ships();
      var n = list.length;
      var rows = Math.ceil(n / 3);
      var top = 36;
      var viewH = H - top - 6;
      var off = UI.scroller(cdx.scroll, top, viewH, rows * 48 + 4, dt);
      g.save(); g.beginPath(); g.rect(0, top, W, viewH); g.clip();
      for (var i = 0; i < n; i += 1) {
        var sh = list[i];
        var cx = 9 + (i % 3) * 55;
        var cy = top + 2 + Math.floor(i / 3) * 48 - off;
        if (cy > H || cy < top - 50) continue;
        var rc = Siren.SHIP_STYLE.frame;
        if (Progress.has(sh.key)) { frame(cx, cy, 52, 43, rc[0], rc[1]); seaCell(cx + 2, cy + 2, 48, 39); Gfx.spr(g, 's48_' + sh.key, cx + 2, cy + 2); }
        else { frame(cx, cy, 52, 43, '#3b4a80', '#0c1030'); g.fillStyle = '#1a2150'; g.fillRect(cx + 2, cy + 2, 48, 39); Gfx.sprT(g, 's48_' + sh.key, cx + 2, cy + 2, '#2c3672'); }
        if (cdx.sel < 0 && cy + 43 > top) (function (idx) { UI.hit('cell' + idx, cx, Math.max(top, cy), 52, 43, function () { cdx.sel = idx; Audio.sfx('open'); }); })(i);
      }
      g.restore();
      UI.scrollbar(cdx.scroll);
      g.fillStyle = '#12173c'; g.fillRect(0, 0, W, top - 2);
      var back = function () { if (cdx.sel >= 0) cdx.sel = -1; else Screens.codex.back(); };
      UI.topBar(null, back);
      Gfx.text(g, t_('codexTitle'), 34, 11, { c: C.CREAM });
      var countStr = Progress.collectedCount() + ' / ' + n;
      Gfx.panel(g, W - 58, 9, 50, 16, 7, C.NAVY_L, C.NAVY_LL, null);
      Gfx.text(g, countStr, W - 33, 10, { c: C.CREAM, a: 'c' });

      if (cdx.sel >= 0) {
        var s2 = list[cdx.sel];
        var got = Progress.has(s2.key);
        var rc2 = Siren.SHIP_STYLE.frame;
        var lines = got ? Gfx.wrap(UI.L(s2.desc), 136) : Gfx.wrap(t_('notYet'), 136).concat(Gfx.wrap(t_('notYet2'), 136));
        var ch = 76 + 18 + lines.length * 14 + 12;
        var y0 = Math.max(30, Math.round((H - ch) / 2));
        Gfx.dim(0.74);
        UI.block(back);
        Gfx.panel(g, 12, y0, 156, ch, 8, C.NAVY, got ? rc2[0] : C.NAVY_LL, C.INK);
        frame(56, y0 + 10, 68, 56, got ? rc2[0] : '#3b4a80', got ? rc2[1] : '#0c1030');
        if (got) { seaCell(58, y0 + 12, 64, 52); Gfx.spr(g, 'ship_' + s2.key, 58, y0 + 12); }
        else { g.fillStyle = '#1a2150'; g.fillRect(58, y0 + 12, 64, 52); Gfx.sprT(g, 'ship_' + s2.key, 58, y0 + 12, '#2c3672'); }
        Gfx.text(g, got ? UI.L(s2.name) : '？？？', W / 2, y0 + 72, { c: C.CREAM, a: 'c' });
        var meta = 'No.' + ('0' + (cdx.sel + 1)).slice(-2) + (got && Progress.visits(s2.key) > 1 ? '  ' + t_('visits', { n: Progress.visits(s2.key) }) : '');
        Gfx.text(g, meta, W / 2, y0 + 88, { c: got ? rc2[0] : C.DIM, a: 'c' });
        for (var li = 0; li < lines.length; li += 1) Gfx.text(g, lines[li], 22, y0 + 104 + li * 14, { c: '#d6dcff' });
      }
    },
    back: function () {
      if (cdx.from === 'arrive') App().go('arrive', { resume: true });
      else App().go(cdx.from === 'select' ? 'select' : 'title');
    }
  };

  // ================================================================ 练习列表

  function practiceUnlocked(id) { return Siren.Practice.unlocked(id, Progress.practiceDone); }

  Screens.practice = {
    enter: function () {},
    draw: function (t) {
      var H = Gfx.H();
      Gfx.backdrop(Gfx.DAY, t);
      Gfx.dim(0.35);
      UI.topBar(t_('practiceTitle'), function () { App().go('title'); });
      var list = Siren.Practice.EXERCISES;
      var ch = 32;
      var gap = 8;
      var top = Math.max(40, Math.round((H - list.length * (ch + gap)) / 2));
      for (var i = 0; i < list.length; i += 1) {
        (function (ex, y) {
          var open = practiceUnlocked(ex.id);
          UI.card('ex' + ex.id, 8, y, 164, ch, open ? function () { App().startPractice(ex.id); } : null, function (x, yy) {
            var gg = Gfx.ctx();
            Gfx.text(gg, t_('ex_' + ex.id), x + 12, yy + 9, { c: open ? C.CREAM : '#5a66b8' });
            if (!open) UI.lock(x + 146, yy + 11);
            else if (Progress.practiceDone(ex.id)) Gfx.sprT(gg, 'i_check', x + 144, yy + 13, C.GOLD);
          }, open ? null : { fill: '#1f2660', line: '#3a4490' });
        })(list[i], top + i * (ch + gap));
      }
    },
    back: function () { App().go('title'); }
  };

  // ================================================================ 设置

  // open：展开的是哪一项（更新日志 / 关于，一次只开一项）；drop：语言下拉框；pop：麦克风弹窗
  var set = { open: null, drop: false, pop: null, logVer: 0, logDrop: false };
  var logPick = null;   // 版本下拉框的位置：画更新日志那一行时记下来，最后盖在最上面画

  function micGranted() { return Siren.Session.micState() === 'granted'; }

  /**
   * 麦克风这一行主要是看状态。
   * 已授权：网页收不回权限，点了也不会有浏览器的框，所以不能点。
   * 未授权：打开一下麦克风，浏览器自己的授权框就弹出来（马上再关掉）。
   * 被浏览器拒绝过：浏览器不会再弹框，网页也触发不了，只能告诉玩家去哪里打开。
   */
  function micTap() {
    if (Siren.Session.micPermission() === 'denied') { set.pop = 'blocked'; return; }
    App().askMic(function (ok) { if (!ok && App().name === 'settings') set.pop = 'blocked'; });
  }

  /** 小红书容器里（有 window.xhs）不显示只属于网页版的条目 */
  function inMiniTool() { return !!global.xhs; }

  /**
   * 更新日志一次显示一版，用版本下拉框切换：设置小窗不能滚动，360×640 的屏幕上只放得下一版。
   * 默认是最新一版。
   */
  function logBody(w) {
    var log = Siren.CHANGELOG;
    var v = log[Math.min(set.logVer, log.length - 1)];
    var items = (UI.lang() === 'en' ? v.en : v.zh).filter(function (it) { return typeof it === 'string' || !it.web || !inMiniTool(); });
    return {
      head: 'v' + v.version, date: UI.L(v.date),
      items: items.map(function (it) { return Gfx.wrap(typeof it === 'string' ? it : it.text, w - 30); })
    };
  }
  function logHeight(b) {
    var h = 22;
    b.items.forEach(function (it) { h += it.length * 14 + 2; });
    return h + 6;
  }

  /**
   * 画设置的各项，返回占用的高度。x、w：卡片的左边和宽度。
   * 语言下拉框在最后单独画（盖在下面几项上面），所以这里把它的位置记下来。
   */
  function settingsRows(x, y0, w) {
    var g = Gfx.ctx();
    var y = y0;
    var gap = 6;
    var langY = 0;
    function row(id, label, value, act, extra) {
      var bodyH = extra ? extra.h : 0;
      UI.card(id, x, y, w, 30 + bodyH, null, function (cx, cy) {
        Gfx.text(g, label, cx + 10, cy + 8, { c: C.CREAM });
        if (value && value.caret !== undefined) {
          if (value.text) Gfx.text(g, value.text, cx + w - 18, cy + 8, { c: '#b9c4ff', a: 'r' });
          UI.caret(cx + w - 14, cy + 13, value.caret);
        } else if (value) Gfx.text(g, Gfx.fit(value, w - 30 - Gfx.tw(label)), cx + w - 10, cy + 8, { c: '#b9c4ff', a: 'r' });
        if (extra) {
          g.fillStyle = C.NAVY_LL; g.fillRect(cx + 8, cy + 29, w - 16, 1);
          extra.draw(cx, cy + 34);
        }
      });
      if (act) UI.hit(id, x, y, w, 30, act);
      y += 30 + bodyH + gap;
    }

    row('sfx', t_('sfx'), Progress.sfxOff() ? t_('off') : t_('on'), function () {
      Progress.setSfxOff(!Progress.sfxOff());
      Audio.setSfxMuted(Progress.sfxOff());
    });
    langY = y;
    var cur = Siren.LANGS.filter(function (l) { return l.id === Progress.lang(); })[0];
    row('lang', t_('language'), { text: cur ? cur.name : '', caret: set.drop }, function () { set.drop = !set.drop; });
    row('mic', t_('mic'), micGranted() ? t_('micOk') : t_('micNo'), micGranted() ? null : micTap);

    var lb = logBody(w);
    row('log', t_('changelog'), { caret: set.open === 'log' }, function () { set.open = set.open === 'log' ? null : 'log'; set.logDrop = false; },
      set.open === 'log' ? { h: logHeight(lb) + 4, draw: function (cx, cy) {
        // 版本下拉框：点开选一版，下面就换成那一版的内容
        var bw = Gfx.tw(lb.head) + 24;
        Gfx.panel(g, cx + 8, cy - 4, bw, 19, 4, set.logDrop ? C.NAVY_LL : C.NAVY, C.NAVY_LL, null);
        Gfx.text(g, lb.head, cx + 14, cy, { c: C.CREAM });
        UI.caret(cx + 8 + bw - 10, cy + 5, set.logDrop);
        UI.hit('logver', cx + 8, cy - 4, bw, 19, function () { set.logDrop = !set.logDrop; });
        Gfx.text(g, lb.date, cx + w - 10, cy, { c: C.DIM, a: 'r' });
        logPick = { x: cx + 8, y: cy + 17 };
        cy += 22;
        lb.items.forEach(function (it) {
          g.fillStyle = C.CORAL; g.fillRect(cx + 12, cy + 6, 3, 3);
          for (var ln = 0; ln < it.length; ln += 1) Gfx.text(g, it[ln], cx + 20, cy + ln * 14, { c: '#d6dcff' });
          cy += it.length * 14 + 2;
        });
      } } : null);
    row('about', t_('about'), { caret: set.open === 'about' }, function () { set.open = set.open === 'about' ? null : 'about'; },
      set.open === 'about' ? { h: 58, draw: function (cx, cy) {
        Gfx.text(g, t_('version'), cx + 10, cy, { c: C.DIM });
        Gfx.text(g, Siren.version, cx + w - 10, cy, { c: '#d6dcff', a: 'r' });
        Gfx.text(g, t_('authors'), cx + 10, cy + 18, { c: C.DIM });
        authorLine(cx + 10, cy + 34, w - 20);
      } } : null);
    return { h: y - gap - y0, langY: langY };
  }

  /**
   * 作者名：名字之间用一个小圆点隔开（原来的「 · 」是全角点加两个空格，占 24 像素，小窗里放不下）。
   * 像素字不能再缩小，只能把间隔收窄；万一还放不下就换行。
   */
  function authorLine(x, y, width) {
    var g = Gfx.ctx();
    var names = t_('authorNames').split(' · ');
    var GAP = 4;
    var cx = x;
    var cy = y;
    for (var i = 0; i < names.length; i += 1) {
      var nw = Gfx.tw(names[i]);
      if (i > 0) {
        if (cx + GAP * 2 + 2 + nw > x + width) { cx = x; cy += 14; }
        else { g.fillStyle = C.DIM; g.fillRect(cx + GAP, cy + 6, 2, 2); cx += GAP * 2 + 2; }
      }
      Gfx.text(g, names[i], cx, cy, { c: C.CREAM });
      cx += nw;
    }
  }

  /** settingsRows 会占多高（小窗要先知道卡片多高） */
  function settingsHeight(w) {
    var h = 5 * 30 + 4 * 6;
    if (set.open === 'log') h += logHeight(logBody(w)) + 4;
    if (set.open === 'about') h += 58;
    return h;
  }

  /** 更新日志的版本下拉框：贴在版本号下面，新的在上面；版本多到放不下时只列放得下的那些 */
  function logDrop(w) {
    if (!logPick) return;
    var g = Gfx.ctx();
    UI.block(function () { set.logDrop = false; });
    var log = Siren.CHANGELOG;
    var n = Math.max(1, Math.min(log.length, Math.floor((Gfx.H() - logPick.y - 12) / 22)));
    var dw = w - 16;
    var dx = logPick.x;
    var dy = logPick.y;
    Gfx.panel(g, dx, dy, dw, n * 22 + 6, 6, C.NAVY, C.NAVY_LL, C.INK);
    for (var i = 0; i < n; i += 1) {
      (function (k, oy) {
        var on = k === set.logVer;
        if (on) { g.fillStyle = C.NAVY_L; g.fillRect(dx + 3, oy, dw - 6, 20); }
        Gfx.text(g, 'v' + log[k].version, dx + 10, oy + 4, { c: on ? C.CREAM : '#b9c4ff' });
        Gfx.text(g, UI.L(log[k].date), dx + dw - 10, oy + 4, { c: C.DIM, a: 'r' });
        UI.hit('logv_' + k, dx + 3, oy, dw - 6, 20, function () { set.logVer = k; set.logDrop = false; });
      })(i, dy + 3 + i * 22);
    }
    UI.setBack(function () { set.logDrop = false; });
  }

  /** 语言下拉框：贴在语言那一行下面，右对齐 */
  function langDrop(x, w, langY) {
    var g = Gfx.ctx();
    UI.block(function () { set.drop = false; });
    var opts = Siren.LANGS;
    var dw = 92;
    var dx = x + w - dw;
    var dy = langY + 30;
    Gfx.panel(g, dx, dy, dw, opts.length * 22 + 6, 6, C.NAVY, C.NAVY_LL, C.INK);
    for (var i = 0; i < opts.length; i += 1) {
      (function (o, oy) {
        var on = o.id === Progress.lang();
        if (on) { g.fillStyle = C.NAVY_L; g.fillRect(dx + 3, oy, dw - 6, 20); }
        Gfx.text(g, o.name, dx + 10, oy + 4, { c: on ? C.CREAM : '#b9c4ff' });
        if (on) Gfx.sprT(g, 'i_check', dx + dw - 16, oy + 7, C.GOLD);
        UI.hit('lang_' + o.id, dx + 3, oy, dw - 6, 20, function () { Progress.setLang(o.id); set.drop = false; });
      })(opts[i], dy + 3 + i * 22);
    }
    UI.setBack(function () { set.drop = false; });
  }

  function micPopup() {
    var close = function () { set.pop = null; };
    UI.popup(t_('micBlockedTitle'), t_('micHow'), [
      { label: t_('ok'), act: close },
      { label: t_('micRetry'), act: function () { App().retryMic(function (ok) { if (ok) set.pop = null; }); }, primary: true }
    ], close);
  }

  Screens.settings = {
    enter: function () {
      set.open = null; set.drop = false; set.pop = null; set.logVer = 0; set.logDrop = false;
      Siren.Session.refreshMic();
    },
    draw: function (t) {
      var g = Gfx.ctx();
      var W = Gfx.W();
      var H = Gfx.H();
      var back = function () { App().go('title'); };
      // 小窗：首页的海面还在后面，设置是浮在上面的一张卡片
      Gfx.world('calm', t, null, Gfx.STAGES[0], 1, 0);
      Gfx.dim(0.55);
      UI.block(back);
      var x = 18;
      var w = W - 36;
      var ph = 40 + settingsHeight(w) + 12;
      var py = Math.max(10, Math.round((H - ph) / 2));
      Gfx.panel(g, 10, py, W - 20, ph, 8, '#12173c', C.NAVY_LL, C.INK);
      UI.hit('sheet', 10, py, W - 20, ph, function () {}, { silent: true });   // 点在卡片空白处不算点到外面
      Gfx.text(g, t_('settingsTitle'), W / 2, py + 12, { c: C.CREAM, a: 'c' });
      UI.btn('close', W - 34, py + 8, 18, 18, null, back, { icon: 'i_x' });
      UI.setBack(back);
      var r = settingsRows(x, py + 36, w);
      if (set.drop) langDrop(x, w, r.langY);
      if (set.open === 'log' && set.logDrop) logDrop(w);
      if (set.pop) micPopup();
    },
    back: function () { App().go('title'); },
    _ui: set   // 截图、测试用：直接设成「下拉框打开 / 某一项展开 / 弹窗」
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
