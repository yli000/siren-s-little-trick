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
  function rarity(sh) { return Siren.RARITY[sh.rarity]; }

  // ================================================================ 首页

  Screens.title = {
    enter: function () {},
    draw: function (t) {
      var g = Gfx.ctx();
      var W = Gfx.W();
      var H = Gfx.H();
      var L = Gfx.L;
      var st = Gfx.STAGES[0];
      var blink = Math.floor(t / 3.3) % 4 === 3 && (t % 3.3) < 0.18;
      // 远处的小船：最近来过的 3 艘（审查第 9 条）；还没有就随便放 3 个剪影
      var rec = Progress.recent();
      var far = rec.length ? rec : ['tug', 'sail', 'ferry'];
      Gfx.world(blink ? 'listen' : 'calm', t, null, st, 1, 0, function (s) {
        var gg = Gfx.ctx();
        for (var i = 0; i < far.length; i += 1) {
          var bx = ((30 + i * 67 + t * (2.2 + i * 0.7)) % (W + 40)) - 20;
          Gfx.sprT(gg, 's12_' + far[i], bx, L.hz - 8 + (i === 1 ? 0 : 1), s.far, 'mul');
        }
      });

      // 标题：中文一行逐字起伏，英文两行（行距收紧，副标题不压到她的头发：发顶约在 sirenY + 12）
      var title = t_('title');
      var en = Progress.lang() === 'en';
      var lines = en ? ["Siren's", 'Little Trick'] : [title];
      var lh = en ? 23 : 28;
      var y0 = en ? Math.max(2, Math.min(8, L.sirenY + 12 - 14 - 2 * lh - 2)) : 30;
      for (var li = 0; li < lines.length; li += 1) {
        var s = lines[li];
        var x = Math.round((W - Gfx.tw(s, 2)) / 2);
        for (var i = 0; i < s.length; i += 1) {
          var bob = Gfx.reduceMotion ? 0 : Math.round(1.6 * Math.sin(t * 2.2 - (i + li * 3) * 0.7));
          Gfx.text(g, s[i], x, y0 + li * lh + bob, { c: C.CREAM, s: 2, o: C.INK, sh: C.INK });
          x += Gfx.tw(s[i], 2);
        }
      }
      var ty = y0 + lines.length * lh + (en ? 2 : 4);
      var tl = Gfx.wrap(t_('tagline'), W - 24);
      for (var tli = 0; tli < tl.length; tli += 1) Gfx.text(g, tl[tli], W / 2, ty + tli * 14, { c: '#fff6ec', a: 'c', o: C.INK });
      if (Math.floor(t * 1.2) % 3 === 0 && Math.random() < 0.3) Gfx.emit({ k: 'spark', x: 14 + Math.random() * 150, y: 24 + Math.random() * 40, life: 0.5, c: '#fff6d0' });
      Gfx.drawParts();

      // 四个同款选项
      var bw = 104;
      var bh = 22;
      var gap = 6;
      var top = Math.max(L.rockFoot + 4, H - 4 * (bh + gap) - 6);
      var items = [
        ['start', function () { App().go('select'); }],
        ['practice', function () { App().go('practice'); }],
        ['codex', function () { App().go('codex', { from: 'title' }); }],
        ['settings', function () { App().go('settings'); }]
      ];
      for (var k = 0; k < items.length; k += 1) {
        UI.btn('m' + k, Math.round((W - bw) / 2), top + k * (bh + gap), bw, bh, t_(items[k][0]), items[k][1], { primary: k === 0 });
      }
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

  /** 常客船的小图：来过就是彩色，没来过是剪影 */
  function regularSlot(song, x, y) {
    var g = Gfx.ctx();
    var key = song.regular;
    g.fillStyle = C.INK; g.fillRect(x, y, 36, 30);
    g.fillStyle = Progress.has(key) ? '#3d5bb0' : '#1a2150'; g.fillRect(x + 1, y + 1, 34, 28);
    if (Progress.has(key)) {
      g.fillStyle = '#57b9f5'; g.fillRect(x + 1, y + 18, 34, 11);
      Gfx.spr(g, 's32_' + key, x + 2, y + 3);
    } else {
      Gfx.sprT(g, 's32_' + key, x + 2, y + 3, '#2c3672');
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
            regularSlot(song, x + 122, y2 + 5);
          }, highlight ? { line: C.GOLD } : null);
        })(songs[i], top + 2 + (i + 1) * rowH - off);
      }
      g.restore();
      UI.scrollbar(sel.scroll);

      // 顶栏画在列表上面
      UI.topBar(null, function () { App().go('title'); });
      if (Progress.keyKnown()) UI.pill(W - 8 - (Gfx.tw(t_('yourKey')) + 10), 10, t_('yourKey'), C.TEAL, C.INK);
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
      g.fillStyle = '#12173c'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#1b2150';
      for (var py = 0; py < H; py += 4) for (var px = (py / 4 % 2) * 4; px < W; px += 8) g.fillRect(px, py, 1, 1);
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
        var rc = rarity(sh).color;
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
        var rc2 = rarity(s2).color;
        var lines = got ? Gfx.wrap(UI.L(s2.desc), 136) : Gfx.wrap(t_('notYet'), 136).concat(Gfx.wrap(t_('notYet2'), 136));
        var ch = 76 + 30 + lines.length * 14 + 12;
        var y0 = Math.max(30, Math.round((H - ch) / 2));
        Gfx.dim(0.74);
        UI.block(back);
        Gfx.panel(g, 12, y0, 156, ch, 8, C.NAVY, got ? rc2[0] : C.NAVY_LL, C.INK);
        frame(56, y0 + 10, 68, 56, got ? rc2[0] : '#3b4a80', got ? rc2[1] : '#0c1030');
        if (got) { seaCell(58, y0 + 12, 64, 52); Gfx.spr(g, 'ship_' + s2.key, 58, y0 + 12); }
        else { g.fillStyle = '#1a2150'; g.fillRect(58, y0 + 12, 64, 52); Gfx.sprT(g, 'ship_' + s2.key, 58, y0 + 12, '#2c3672'); }
        Gfx.text(g, got ? UI.L(s2.name) : '？？？', W / 2, y0 + 72, { c: C.CREAM, a: 'c' });
        var stars = rarity(s2).stars;
        var meta = 'No.' + ('0' + (cdx.sel + 1)).slice(-2) + '  ' + t_(s2.rarity) + (got && Progress.visits(s2.key) > 1 ? '  ' + t_('visits', { n: Progress.visits(s2.key) }) : '');
        Gfx.text(g, meta, W / 2, y0 + 88, { c: got ? rc2[0] : C.DIM, a: 'c' });
        for (var sI = 0; sI < 4; sI += 1) UI.star(W / 2 - 17 + sI * 9, y0 + 104, got && sI < stars);
        for (var li = 0; li < lines.length; li += 1) Gfx.text(g, lines[li], 22, y0 + 116 + li * 14, { c: '#d6dcff' });
      }
    },
    back: function () {
      if (cdx.from === 'arrive') App().go('arrive', { resume: true });
      else App().go(cdx.from === 'select' ? 'select' : 'title');
    }
  };

  // ================================================================ 练习列表

  Screens.practice = {
    enter: function () {},
    draw: function (t) {
      var g = Gfx.ctx();
      var W = Gfx.W();
      var H = Gfx.H();
      Gfx.backdrop(Gfx.DAY, t);
      Gfx.dim(0.35);
      UI.topBar(t_('practiceTitle'), function () { App().go('title'); });
      var list = Siren.Practice.EXERCISES;
      var ch = 44;
      var top = Math.max(36, Math.round((H - list.length * (ch + 6)) / 2));
      for (var i = 0; i < list.length; i += 1) {
        (function (ex, y) {
          UI.card('ex' + ex.id, 8, y, 164, ch, function () { App().startPractice(ex.id); }, function (x, yy) {
            var gg = Gfx.ctx();
            Gfx.text(gg, (i + 1) + '  ' + t_('ex_' + ex.id), x + 9, yy + 6, { c: C.CREAM });
            Gfx.text(gg, Gfx.fit(t_('exb_' + ex.id), 140), x + 9, yy + 24, { c: '#b9c4ff' });
            if (Progress.practiceDone(ex.id)) Gfx.sprT(gg, 'i_check', x + 148, yy + 8, C.GOLD);
          });
        })(list[i], top + i * (ch + 6));
      }
      if (Progress.keyKnown()) UI.pill(W - 8 - (Gfx.tw(t_('yourKey')) + 10), 10, t_('yourKey'), C.TEAL, C.INK);
    },
    back: function () { App().go('title'); }
  };

  // ================================================================ 设置

  var set = { page: 'main', scroll: { y: 0, v: 0 }, confirm: false };

  function row(id, y, label, value, act) {
    UI.card(id, 8, y, 164, 30, act, function (x, yy) {
      var g = Gfx.ctx();
      Gfx.text(g, label, x + 9, yy + 8, { c: C.CREAM });
      if (value === '>') Gfx.sprT(g, 'i_next', x + 150, yy + 11, '#b9c4ff');
      else if (value) Gfx.text(g, Gfx.fit(value, 156 - 9 - Gfx.tw(label) - 10), x + 156, yy + 8, { c: '#b9c4ff', a: 'r' });
    });
  }

  function micLabel() {
    var s = Siren.Session.micState();
    if (s === 'granted') return t_('micOk');
    if (s === 'denied') return t_('micNo');
    return t_('micUnknown');
  }

  Screens.settings = {
    enter: function (p) { set.page = p.page || 'main'; set.confirm = false; set.scroll.y = 0; },
    draw: function (t, dt) {
      var g = Gfx.ctx();
      var W = Gfx.W();
      var H = Gfx.H();
      g.fillStyle = '#12173c'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#1b2150';
      for (var py = 0; py < H; py += 4) for (var px = (py / 4 % 2) * 4; px < W; px += 8) g.fillRect(px, py, 1, 1);

      if (set.page === 'main') {
        UI.topBar(t_('settingsTitle'), function () { App().go('title'); });
        var y = 40;
        row('sfx', y, t_('sfx'), Progress.sfxOff() ? t_('off') : t_('on'), function () {
          Progress.setSfxOff(!Progress.sfxOff());
          Audio.setSfxMuted(Progress.sfxOff());
        });
        y += 36;
        row('lang', y, t_('language'), t_('langName'), function () { Progress.setLang(Progress.lang() === 'zh' ? 'en' : 'zh'); });
        y += 36;
        var micState = Siren.Session.micState();
        row('mic', y, t_('mic'), micLabel(), micState === 'denied' ? function () { App().retryMic(); } : null);
        y += 48;
        row('log', y, t_('changelog'), '>', function () { set.page = 'log'; set.scroll.y = 0; });
        y += 36;
        row('about', y, t_('about'), '>', function () { set.page = 'about'; });
        y += 48;
        row('reset', y, t_('reset'), '', function () { set.confirm = true; });
      } else if (set.page === 'log') {
        UI.topBar(t_('changelog'), function () { set.page = 'main'; });
        var top = 34;
        var viewH = H - top - 6;
        var blocks = [];
        var total = 0;
        var log = Siren.CHANGELOG;
        for (var v = 0; v < log.length; v += 1) {
          var items = UI.lang() === 'en' ? log[v].en : log[v].zh;
          var wrapped = items.map(function (s) { return Gfx.wrap(s, 136); });
          var h = 22 + wrapped.reduce(function (a, w) { return a + w.length * 14 + 4; }, 0);
          blocks.push({ ver: log[v].version, date: UI.L(log[v].date), lines: wrapped, h: h });
          total += h + 8;
        }
        var off = UI.scroller(set.scroll, top, viewH, total, dt);
        g.save(); g.beginPath(); g.rect(0, top, W, viewH); g.clip();
        var yy = top + 4 - off;
        for (var b = 0; b < blocks.length; b += 1) {
          var bl = blocks[b];
          Gfx.panel(g, 8, yy, 164, bl.h, 6, C.PAPER, C.INK, C.INK);
          Gfx.text(g, 'v' + bl.ver, 16, yy + 5, { c: C.PAPER_INK });
          Gfx.text(g, bl.date, 164, yy + 5, { c: C.PAPER_DIM, a: 'r' });
          var ly = yy + 24;
          for (var it = 0; it < bl.lines.length; it += 1) {
            g.fillStyle = C.CORAL; g.fillRect(16, ly + 6, 3, 3);
            for (var ln = 0; ln < bl.lines[it].length; ln += 1) Gfx.text(g, bl.lines[it][ln], 24, ly + ln * 14, { c: C.PAPER_INK });
            ly += bl.lines[it].length * 14 + 4;
          }
          yy += bl.h + 8;
        }
        g.restore();
        UI.scrollbar(set.scroll);
      } else if (set.page === 'about') {
        UI.topBar(t_('about'), function () { set.page = 'main'; });
        var ay = 46;
        Gfx.text(g, t_('title'), W / 2, ay, { c: C.CREAM, a: 'c', o: C.INK });
        Gfx.text(g, t_('version') + ' ' + Siren.version, W / 2, ay + 18, { c: '#b9c4ff', a: 'c' });
        Gfx.panel(g, 8, ay + 42, 164, 44, 6, C.NAVY_L, C.NAVY_LL, C.INK);
        Gfx.text(g, t_('authors'), 18, ay + 48, { c: '#b9c4ff' });
        Gfx.text(g, t_('authorNames'), 18, ay + 64, { c: C.CREAM });
        var pl = Gfx.wrap(t_('privacy'), 140);
        for (var i = 0; i < pl.length; i += 1) Gfx.text(g, pl[i], W / 2, ay + 104 + i * 14, { c: '#d6dcff', a: 'c' });
        var fl = Gfx.wrap(t_('fontCredit'), 150);
        for (var j = 0; j < fl.length; j += 1) Gfx.text(g, fl[j], W / 2, H - 30 - (fl.length - 1 - j) * 14, { c: C.DIM, a: 'c' });
      }

      if (set.confirm) {
        Gfx.dim(0.7);
        UI.block(function () { set.confirm = false; });
        var cl = Gfx.wrap(t_('resetConfirm'), 136);
        var chh = 26 + cl.length * 14 + 40;
        var cy = Math.round((H - chh) / 2);
        Gfx.panel(g, 14, cy, W - 28, chh, 8, C.NAVY, C.NAVY_LL, C.INK);
        for (var c2 = 0; c2 < cl.length; c2 += 1) Gfx.text(g, cl[c2], W / 2, cy + 14 + c2 * 14, { c: C.CREAM, a: 'c' });
        UI.btn('cno', 24, cy + chh - 34, 62, 24, t_('cancel'), function () { set.confirm = false; }, { primary: true });
        UI.btn('cyes', 94, cy + chh - 34, 62, 24, t_('confirm'), function () { Progress.reset(); set.confirm = false; UI.toast(t_('resetDone'), 1.6); });
        UI.setBack(function () { set.confirm = false; });
      }
    },
    back: function () { App().go('title'); }
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
