/* 塞壬的小把戏 —— 前端：screens-play.js（唱歌 / 练习 / 第一次的跟唱引导、结尾开船）*/
(function (global) {
  'use strict';

  var Siren = global.Siren = global.Siren || {};
  var Gfx = Siren.Gfx;
  var UI = Siren.UI;
  var C = Gfx.C;
  var TIER = Gfx.TIER;
  var Session = Siren.Session;
  var Progress = Siren.Progress;
  var Audio = Siren.Audio;
  var Music = Siren.Music;
  var Screens = Siren.Screens = Siren.Screens || {};
  var t_ = UI.t;
  function App() { return Siren.App; }

  // ================================================================ 唱歌 / 练习

  var P = {
    kind: null, song: null, exercise: null, prev: null, cur: null, mix: 1, stageIdx: 0,
    label: null, firstTime: false, vg: 0, done: null, lo: 60, hi: 72, lastEmit: -1, lastPhrase: -1, next: null, from: 'select'
  };

  Session.on('note', function (e) {
    if (App().name !== 'play' || e.tier === 'quiet') return;
    var st = Session.getState();
    var n = st.notes[e.index];
    if (!n) return;
    var gm = noteGeom(n, st.phraseMs);
    P.label = { text: TIER[e.tier].label, c: TIER[e.tier].c, x: gm.x + gm.w / 2, at: App().clock };
    // 录音时不出声（会被录进去，审查第 1 条）；只给画面上的回应
    if (e.tier === 'perfect' && Math.random() < 0.45) {
      Gfx.emit({ k: 'heart', x: Gfx.L.sirenX + 92 + Math.random() * 16, y: Gfx.L.sirenY + 50, vy: -14, life: 1.2, ph: Math.random() * 6 });
    }
  });
  Session.on('finish', function (f) {
    if (f.kind === 'song' && App().name === 'play') {
      App().go('arrive', { ship: f.ship, song: P.song });
    } else if (f.kind === 'practice' && App().name === 'play') {
      P.done = { at: App().clock, learned: f.learnedRange, exercise: f.exercise };
      Audio.sfx('reveal');
    } else if (f.kind === 'guide' && App().name === 'play') {
      // 引导就一句：唱完直接进玩家点的那首歌 / 那组练习
      Progress.setOnboarded();
      if (P.next) P.next();
    }
  });

  function stageFor(st) {
    if (P.kind !== 'song') return Gfx.DAY;
    var idx = Math.round(st.phraseIdx * 4 / Math.max(1, st.phraseCount - 1));
    return Gfx.STAGES[Math.max(0, Math.min(4, idx))];
  }

  function noteGeom(n, phraseMs) {
    var L = Gfx.L;
    var ix = 16;
    var iw = 148;
    var ih = 40;
    var iy = L.panelY + 12;
    var step = Math.max(2, Math.min(5, Math.floor((ih - 8) / Math.max(1, P.hi - P.lo))));
    return {
      x: ix + Math.round(n.startMs / phraseMs * iw),
      w: Math.max(5, Math.round(n.durMs / phraseMs * iw) - 2),
      y: iy + ih - 8 - Math.round((n.midi - P.lo) * step),
      ix: ix, iw: iw, step: step
    };
  }
  function midiY(midi) {
    var L = Gfx.L;
    var ih = 40;
    var step = Math.max(2, Math.min(5, Math.floor((ih - 8) / Math.max(1, P.hi - P.lo))));
    return L.panelY + 12 + ih - 8 - Math.round((midi - P.lo) * step);
  }

  Screens.play = {
    enter: function (p) {
      P.kind = p.kind;
      P.song = p.song || null;
      P.exercise = p.exercise || null;
      P.cur = P.kind === 'song' ? Gfx.STAGES[0] : Gfx.DAY;
      P.prev = P.cur;
      P.mix = 1;
      P.label = null;
      P.done = null;
      P.vg = 0;
      P.lastEmit = -1;
      P.lastPhrase = -1;
      P.firstTime = (P.kind === 'song' && !Progress.anySongPlayed()) || P.kind === 'guide';
      P.next = p.next || null;
      P.from = p.from === 'practice' ? 'practice' : 'select';
      if (P.kind === 'guide') {
        Session.startGuide();
      } else if (P.kind === 'song') {
        var r = Music.songRange(P.song);
        var shift = Progress.songShift(P.song);
        P.lo = r.lo + shift;
        P.hi = r.hi + shift;
        Session.startSong(P.song);
      } else {
        Session.startPractice(P.exercise);
      }
    },
    onHide: function () { if (!P.done) Session.pause(); },
    draw: function (t, dt) {
      var g = Gfx.ctx();
      var W = Gfx.W();
      var L = Gfx.L;
      var st = Session.getState();
      if (st.phase === 'idle') return;

      // 练习、引导的音高范围每句不同
      if (P.kind !== 'song' && st.notes && st.notes.length && st.phraseIdx !== P.lastPhrase) {
        var lo = 999;
        var hi = -999;
        st.notes.forEach(function (n) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); });
        P.lo = lo - 2;
        P.hi = hi + 2;
      }
      if (st.phraseIdx !== P.lastPhrase) { P.lastPhrase = st.phraseIdx; P.lastEmit = -1; }

      var want = stageFor(st);
      if (want !== P.cur) { P.prev = P.cur; P.cur = want; P.mix = 0; }
      if (P.mix < 1) P.mix = Math.min(1, P.mix + dt / 1.3);

      var listenT = st.phase === 'listen' ? st.phaseT - st.listenLeadMs : -1;
      var singing = false;
      if (listenT >= 0) {
        for (var i = 0; i < st.notes.length; i += 1) {
          var n = st.notes[i];
          if (listenT >= n.startMs && listenT < n.startMs + n.durMs * 0.8) singing = true;
          if (listenT >= n.startMs && i > P.lastEmit) {
            P.lastEmit = i;
            Gfx.emit({ k: 'note', x: L.sirenX + 96 + Math.random() * 12, y: L.sirenY + 44, vy: -16, vx: 5, life: 1.5, ph: Math.random() * 6, n2: i % 2 });
          }
        }
      }
      var rec = !st.paused && st.mic && (st.phase === 'sing' || st.phase === 'countin' || st.phase === 'hum');
      var face = singing && !st.paused ? 'sing' : rec ? 'listen' : 'calm';
      if (rec) P.vg = Math.max(P.vg * Math.pow(0.3, dt), st.level || 0);
      else P.vg *= Math.pow(0.3, dt);
      var base = P.kind === 'song' ? [0, 0, 0.35, 0.7, 1][Gfx.STAGES.indexOf(P.cur)] || 0 : 0;
      Gfx.world(face, t, P.prev, P.cur, P.mix, Math.min(1, base + P.vg * 0.6));
      Gfx.drawParts();

      // 顶栏：暂停、标题、进度点
      var title = P.kind === 'song' ? UI.L(P.song.title) : P.kind === 'guide' ? t_('tutTitle') : t_('ex_' + P.exercise);
      UI.topBar(title, function () { Session.pause(); }, { pause: true });
      var count = st.phraseCount;
      var dw = Math.min(9, Math.floor(120 / Math.max(1, count)));
      for (var d = 0; d < count; d += 1) {
        var px = Math.round(W / 2 - (count * dw - 3) / 2) + d * dw;
        var done = d < st.phraseIdx;
        var cur = d === st.phraseIdx;
        g.fillStyle = C.INK; g.fillRect(px - 1, 27, dw - 1, 8);
        // 进度点只表示唱到哪了，不是成绩：唱过的是米色，不用金色（金色是 Perfect）
        g.fillStyle = done ? C.CREAM : cur ? (Math.floor(t * 3) % 2 ? C.CREAM : '#8f9be0') : '#46508f';
        g.fillRect(px, 28, dw - 3, 6);
      }

      drawTrack(st, t);
      captions(st, t);

      if (st.paused) pauseOverlay();
      else if (P.done) doneOverlay(t);
      else if (st.waiting) coach(st, t);
      else UI.setBack(function () { Session.pause(); });
    },
    back: function () { Session.pause(); }
  };

  function drawTrack(st, t) {
    var g = Gfx.ctx();
    var W = Gfx.W();
    var L = Gfx.L;
    var py = L.panelY;
    Gfx.panel(g, 8, py, 164, 62, 8, C.NAVY, C.NAVY_LL, C.INK);
    g.drawImage(Gfx.cached('trackDots', 148, 31, function (x) {
      x.fillStyle = '#232a63';
      for (var r = 0; r < 4; r += 1) for (var dx = 0; dx < 148; dx += 4) x.fillRect(dx, r * 10, 1, 1);
    }), 16, py + 18);

    var live = st.live || { k: 0, l: 0 };
    var head = -1;
    if (st.phase === 'listen') head = (st.phaseT - st.listenLeadMs) / st.phraseMs;
    else if (st.phase === 'sing') head = (st.singT - live.l) / st.phraseMs;

    if (st.phase === 'hum') { humTrace(st, py); micDisc(st, t); return; }

    var lastPt = st.trace && st.trace.length ? st.trace[st.trace.length - 1] : null;
    for (var i = 0; i < st.notes.length; i += 1) {
      var n = st.notes[i];
      var gm = noteGeom(n, st.phraseMs);
      var tier = st.tiers[i];
      var on = head >= 0 && head * st.phraseMs >= n.startMs && head * st.phraseMs < n.startMs + n.durMs;
      var bump = on ? 1 : 0;
      if (st.phase === 'listen' && !(head >= 0 && head * st.phraseMs >= n.startMs)) {
        g.fillStyle = '#46508f';
        for (var hx = gm.x; hx < gm.x + gm.w; hx += 2) g.fillRect(hx, gm.y + 2, 1, 1);
        continue;
      }
      var fill;
      var shade;
      var outline = C.INK;
      if (st.phase === 'listen') { fill = C.TEAL; shade = '#20a3a3'; }
      else if (tier && TIER[tier]) { fill = TIER[tier].c; shade = TIER[tier].d; }
      else {
        // 还没判：亮描边；正在唱、声音也在容差里时整块亮起来（审查第 5 条）
        var near = on && lastPt && Math.abs(lastPt.midi - n.midi) <= 0.5 && st.singT - lastPt.t < 150;
        // 已经唱过、还在等判定（音结束后约 0.3 秒）：先填上浅色，不让人以为没算
        var past = head >= 0 && head * st.phraseMs >= n.startMs + n.durMs;
        fill = near ? '#d9e0ff' : past ? '#5a66b8' : '#2a3270';
        shade = near ? '#9fb0ff' : past ? '#46508f' : '#232a63';
        outline = C.CREAM;
      }
      g.fillStyle = outline; g.fillRect(gm.x - 1, gm.y - 1 - bump, gm.w + 2, 7 + bump * 2);
      g.fillStyle = fill; g.fillRect(gm.x, gm.y - bump, gm.w, 5 + bump * 2);
      g.fillStyle = shade; g.fillRect(gm.x, gm.y + 3 + bump, gm.w, 2);
      if (tier && tier !== 'quiet' && tier !== 'miss') { g.fillStyle = '#ffffff'; g.fillRect(gm.x + 1, gm.y - bump, Math.max(1, gm.w - 3), 1); }
    }

    // 你的音高线：2px，带亮色线头（已按调偏移平移，见 session.displayMidi）
    if ((st.phase === 'sing' || st.phase === 'result') && st.trace.length) {
      var prev = null;
      for (var k = 0; k < st.trace.length; k += 1) {
        var pt = st.trace[k];
        var x = 16 + Math.round((pt.t - live.l) / st.phraseMs * 148);
        var y = midiY(pt.midi) + 1;
        if (x < 12 || x > 168) { prev = null; continue; }
        g.fillStyle = C.CORAL;
        if (prev && pt.t - prev.t < 130) {
          var steps = Math.max(Math.abs(x - prev.x), Math.abs(y - prev.y), 1);
          for (var s = 0; s <= steps; s += 1) {
            g.fillRect(Math.round(prev.x + (x - prev.x) * s / steps), Math.round(prev.y + (y - prev.y) * s / steps), 2, 2);
          }
        } else g.fillRect(x, y, 2, 2);
        prev = { x: x, y: y, t: pt.t };
      }
      if (prev && st.phase === 'sing' && st.singT - st.trace[st.trace.length - 1].t < 150) {
        g.fillStyle = '#ffffff'; g.fillRect(prev.x - 1, prev.y - 1, 4, 4);
        g.fillStyle = C.CORAL; g.fillRect(prev.x, prev.y, 2, 2);
      }
    }
    if (head >= 0 && head <= 1.02) {
      var hx2 = 16 + Math.round(Math.min(1, head) * 148);
      g.fillStyle = C.CREAM;
      g.fillRect(hx2, py + 5, 1, 52);
      g.fillRect(hx2 - 2, py + 2, 5, 1);
      g.fillRect(hx2 - 1, py + 3, 3, 1);
    }

    // 刚判出的档位：一次只留一个标签（审查第 13 条）
    if (P.label && App().clock - P.label.at < 0.8) {
      var age = App().clock - P.label.at;
      var lx = Math.max(24, Math.min(W - 24, P.label.x));
      Gfx.text(g, P.label.text, lx, py - 14 - Math.round(age * 8), { c: P.label.c, a: 'c', o: C.INK });
    }
    micDisc(st, t);
  }

  /** 「哼一声」时：只画你的音高线，围绕中位数上下 */
  function humTrace(st, py) {
    var g = Gfx.ctx();
    var tr = st.trace || [];
    if (!tr.length) return;
    var arr = tr.map(function (p) { return p.midi; }).sort(function (a, b) { return a - b; });
    var mid = arr[Math.floor(arr.length / 2)];
    var prev = null;
    for (var i = 0; i < tr.length; i += 1) {
      var x = 16 + Math.round(tr[i].t / 2600 * 148);
      var y = py + 30 - Math.round(Math.max(-5, Math.min(5, tr[i].midi - mid)) * 4);
      g.fillStyle = C.CORAL;
      if (prev && tr[i].t - prev.t < 130) {
        var steps = Math.max(Math.abs(x - prev.x), Math.abs(y - prev.y), 1);
        for (var s = 0; s <= steps; s += 1) g.fillRect(Math.round(prev.x + (x - prev.x) * s / steps), Math.round(prev.y + (y - prev.y) * s / steps), 2, 2);
      } else g.fillRect(x, y, 2, 2);
      prev = { x: x, y: y, t: tr[i].t };
    }
    if (prev) { g.fillStyle = '#ffffff'; g.fillRect(prev.x - 1, prev.y - 1, 4, 4); }
  }

  function micDisc(st, t) {
    var g = Gfx.ctx();
    var W = Gfx.W();
    var L = Gfx.L;
    var rec = !st.paused && st.mic && (st.phase === 'sing' || st.phase === 'hum');
    var cx = W / 2;
    var cy = L.micY;
    if (rec) {
      // 外圈随音量起伏（审查第 5 条）
      var rr = 18 + Math.round((st.level || 0) * 7) + Math.floor((t * 3) % 2);
      g.fillStyle = Gfx.pat(g, C.CORAL, 6);
      for (var dy = -rr; dy <= rr; dy += 1) { var hw = Math.floor(Math.sqrt(rr * rr - dy * dy)); g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); }
    }
    Gfx.disc(g, cx, cy + 2, 16, C.INK);
    Gfx.disc(g, cx, cy, 16, C.INK);
    Gfx.disc(g, cx, cy, 15, rec ? C.CORAL : C.NAVY_L);
    // 平时是灰色的麦克风，轮到你唱时变红；没有麦克风时画一道斜杠
    if (rec) Gfx.spr(g, 'i_mic', cx - 5, cy - 7);
    else Gfx.sprT(g, 'i_mic', cx - 5, cy - 7, st.mic === false && st.phase !== 'idle' ? '#5a66b8' : C.DIM);
    if (st.mic === false && st.phase !== 'idle') {
      g.fillStyle = C.CORAL;
      for (var k = -7; k <= 7; k += 1) g.fillRect(cx + k, cy - k, 2, 1);
      // 点一下带斜杠的麦克风：再要一次（下一句就用上）
      if (!st.paused && !st.waiting) UI.hit('micRetry', cx - 20, cy - 20, 40, 40, function () { App().retryMic(); });
    }
  }

  function captions(st, t) {
    var g = Gfx.ctx();
    var W = Gfx.W();
    var L = Gfx.L;
    var py = L.panelY;
    if (st.phase === 'intro' && P.kind === 'song') {
      var s2 = '《' + UI.L(P.song.title) + '》';
      if (UI.lang() === 'en') s2 = UI.L(P.song.title);
      s2 = Gfx.fit(s2, 150);
      var w = Gfx.tw(s2) + 20;
      Gfx.panel(g, Math.round(W / 2 - w / 2), py - 40, w, 26, 8, C.NAVY, C.GOLD, C.INK);
      Gfx.text(g, s2, W / 2, py - 34, { c: C.CREAM, a: 'c' });
    }
    if (st.phase === 'listen') {
      var cap = null;
      if (st.again) cap = t_(st.againReason === 'retry' ? 'retry' : 'again');
      else if (P.firstTime && st.phraseIdx === 0) cap = t_('herTurn');
      if (cap) Gfx.text(g, cap, W / 2, py - 22, { c: '#9ff3e8', a: 'c', o: C.INK });
    }
    // 教程：倒数一开始就提示「让红线贴着音块走」，开口时不用再读字
    var tut = P.kind === 'guide' && (st.phase === 'countin' || st.phase === 'sing');
    if (tut) Gfx.text(g, t_('tutSing'), W / 2, py - 62, { c: C.CREAM, a: 'c', o: C.INK });
    if (st.phase === 'countin' || (st.phase === 'sing' && st.singT < 450 && P.kind !== 'guide')) {
      // 「轮到你」+ 三格倒数：嘀、嘀、叮（叮和麦克风那一格就是第一个音）
      var big = !(st.phase === 'countin' && st.phaseT < 100);
      Gfx.text(g, t_('yourTurn'), W / 2, py - (big ? 44 : 34), { c: C.GOLD, s: big ? 2 : 1, a: 'c', o: C.INK, sh: C.INK });
      var lead = st.countinLeadMs;
      var lit = [
        st.phase === 'sing' || st.phaseT >= lead,
        st.phase === 'sing' || st.phaseT >= lead + st.beatMs,
        st.phase === 'sing'
      ];
      for (var c = 0; c < 3; c += 1) {
        var bx = W / 2 - 17 + c * 12;
        var by = py - 14;
        g.fillStyle = C.INK; g.fillRect(bx - 1, by - 1, 11, 11);
        g.fillStyle = lit[c] ? (c === 2 ? C.CORAL : C.GOLD) : '#46508f';
        g.fillRect(bx, by, 9, 9);
        if (c === 2) {
          g.fillStyle = lit[c] ? '#ffffff' : '#8f9be0';
          g.fillRect(bx + 3, by + 1, 3, 5); g.fillRect(bx + 2, by + 5, 1, 1); g.fillRect(bx + 6, by + 5, 1, 1); g.fillRect(bx + 4, by + 7, 1, 1);
        }
      }
    }
    if (st.phase === 'hum') {
      Gfx.text(g, t_('humTitle'), W / 2, py - 44, { c: C.GOLD, s: 2, a: 'c', o: C.INK, sh: C.INK });
      Gfx.text(g, t_('humHint'), W / 2, py - 16, { c: C.CREAM, a: 'c', o: C.INK });
    }
  }

  // ---------------------------------------------------------------- 「怎么玩」：每一步之前的说明

  /** 把 rects 以外的地方压暗，rects 画一圈金色的框 */
  function spotlight(rects, t) {
    var g = Gfx.ctx();
    var W = Gfx.W();
    var H = Gfx.H();
    var x0 = 999;
    var y0 = 999;
    var x1 = -1;
    var y1 = -1;
    rects.forEach(function (r) { x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[0] + r[2]); y1 = Math.max(y1, r[1] + r[3]); });
    g.globalAlpha = 0.62;
    g.fillStyle = '#080b26';
    g.fillRect(0, 0, W, y0);
    g.fillRect(0, y1, W, H - y1);
    g.fillRect(0, y0, x0, y1 - y0);
    g.fillRect(x1, y0, W - x1, y1 - y0);
    g.globalAlpha = 1;
    var on = Math.floor(t * 2) % 2 === 0;
    g.fillStyle = on ? C.GOLD : C.GOLD_D;
    g.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, 1); g.fillRect(x0 - 2, y1 + 1, x1 - x0 + 4, 1);
    g.fillRect(x0 - 2, y0 - 2, 1, y1 - y0 + 4); g.fillRect(x1 + 1, y0 - 2, 1, y1 - y0 + 4);
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  /** 说明气泡：放在框的上面，底边一个小尖角指下去 */
  function bubble(text, below, buttons) {
    var g = Gfx.ctx();
    var W = Gfx.W();
    var lines = Gfx.wrap(text, W - 44);
    var h = 14 + lines.length * 14 + 6 + 30;
    var y = Math.max(34, below - 10 - h);
    Gfx.panel(g, 12, y, W - 24, h, 8, C.PAPER, C.INK, C.INK);
    for (var i = 0; i < lines.length; i += 1) Gfx.text(g, lines[i], 22, y + 9 + i * 14, { c: C.PAPER_INK });
    // 尖角
    for (var k = 0; k < 6; k += 1) { g.fillStyle = C.INK; g.fillRect(W / 2 - 6 + k, y + h + k - 1, 13 - 2 * k, 1); }
    for (var k2 = 0; k2 < 5; k2 += 1) { g.fillStyle = C.PAPER; g.fillRect(W / 2 - 5 + k2, y + h + k2 - 1, 11 - 2 * k2, 1); }
    var by = y + h - 30;
    if (buttons.length === 1) UI.btn('coach0', W / 2 - 36, by, 72, 22, buttons[0].label, buttons[0].act, { primary: true });
    else {
      var bw = Math.floor((W - 24 - 30) / 2);
      for (var b = 0; b < buttons.length; b += 1) UI.btn('coach' + b, 24 + b * (bw + 6), by, bw, 22, buttons[b].label, buttons[b].act, { primary: !!buttons[b].primary });
    }
  }

  function coach(st, t) {
    var L = Gfx.L;
    var W = Gfx.W();
    var panel = [8, L.panelY, 164, 62];
    var micR = [W / 2 - 20, L.micY - 20, 40, 42];
    UI.block();
    UI.setBack(function () { Session.pause(); });
    var ok = { label: t_('ok'), act: function () { Session.proceed(); }, primary: true };
    var box;
    if (st.waiting === 'listen') {
      box = spotlight([panel], t);
      bubble(t_('tutListen'), box.y0, [ok]);
    } else if (st.waiting === 'turn' && !st.mic) {
      // 没有麦克风：不讲「变红时开口」，先说清楚怎么打开；打开了这一步就换成正常的说明
      box = spotlight([micR], t);
      bubble(t_('tutTurnNoMic'), L.panelY, [
        { label: t_('tutContinue'), act: function () { Session.proceed(); } },
        { label: t_('micRetry'), act: function () { App().retryMic(); }, primary: true }
      ]);
    } else if (st.waiting === 'turn') {
      box = spotlight([panel, micR], t);
      bubble(t_('tutTurn'), box.y0, [ok]);
    } else if (st.waiting === 'quiet') {
      // 不框麦克风：框住了玩家会以为要按它
      Gfx.dim(0.62);
      bubble(t_('tutQuiet'), L.panelY, [ok]);
    } else if (st.waiting === 'end') {
      // 按这一遍的结果说：有对上的音就讲颜色；全是 Miss 就说红线要落在音块上；没有麦克风就说清楚
      // 一半以上是 Miss 就说「没太跟上」，并把「再试一次」放在主位
      var judged = (st.tiers || []).filter(function (x) { return !!x; });
      var misses = judged.filter(function (x) { return x === 'miss' || x === 'quiet'; }).length;
      var again = { label: t_(st.mic ? 'tutAgain' : 'micRetry'), act: function () { App().guideAgain(); } };
      var start = { label: t_('tutStart'), act: function () { Session.proceed(); } };
      box = spotlight([panel], t);
      if (!st.mic) { again.primary = true; bubble(t_('tutEndNoMic'), box.y0, [start, again]); }
      else if (misses * 2 > judged.length) { again.primary = true; bubble(t_('tutEndMiss'), box.y0, [again, start]); }
      else { start.primary = true; bubble(t_('tutEnd'), box.y0, [again, start]); }
    }
  }

  function pauseOverlay() {
    var g = Gfx.ctx();
    var W = Gfx.W();
    var H = Gfx.H();
    Gfx.dim(0.66);
    UI.block();
    var h = 128;
    var y = Math.round((H - h) / 2);
    Gfx.panel(g, 24, y, W - 48, h, 8, C.NAVY, C.NAVY_LL, C.INK);
    Gfx.text(g, t_('paused'), W / 2, y + 10, { c: C.CREAM, a: 'c' });
    var bw = W - 72;
    UI.btn('resume', 36, y + 32, bw, 24, t_('resume'), function () { Session.resume(); }, { primary: true });
    UI.btn('restart', 36, y + 62, bw, 24, t_('restart'), function () { P.lastPhrase = -1; Session.restart(); });
    UI.btn('quit', 36, y + 92, bw, 24, t_('quit'), function () { App().go(P.kind === 'song' ? 'select' : P.kind === 'guide' ? P.from : 'practice'); });
    UI.setBack(function () { Session.resume(); });
  }

  function doneOverlay(t) {
    var g = Gfx.ctx();
    var W = Gfx.W();
    var H = Gfx.H();
    var age = t - P.done.at;
    if (age < 0.3) return;
    Gfx.dim(Math.min(0.6, (age - 0.3) * 2));
    UI.block();
    var msg = P.done.learned ? t_('learnedKey') : t_('exDone');
    var lines = Gfx.wrap(msg, 128);
    var list = Siren.Practice.EXERCISES;
    var nextEx = null;
    for (var e = 0; e < list.length - 1; e += 1) if (list[e].id === P.done.exercise) nextEx = list[e + 1].id;
    var h = 40 + lines.length * 14 + (nextEx ? 64 : 34);
    var y = Math.round((H - h) / 2);
    Gfx.panel(g, 18, y, W - 36, h, 8, C.NAVY, C.GOLD, C.INK);
    Gfx.sprT(g, 'i_check', W / 2 - 4, y + 12, C.GOLD);
    for (var i = 0; i < lines.length; i += 1) Gfx.text(g, lines[i], W / 2, y + 26 + i * 14, { c: C.CREAM, a: 'c' });
    var locked = age < 0.6;
    if (nextEx) UI.btn('moreEx', 30, y + h - 62, W - 60, 24, t_('moreEx'), function () { App().startPractice(nextEx); }, { locked: locked, primary: true });
    UI.btn('toSongs', 30, y + h - 32, W - 60, 24, t_('toSongs'), function () { App().go('select'); }, { locked: locked, primary: !nextEx });
    UI.setBack(function () { App().go('practice'); });
    if (Math.random() < 0.15) Gfx.emit({ k: 'spark', x: 20 + Math.random() * 140, y: y - 4 + Math.random() * 10, life: 0.6, c: C.GOLD });
  }

  // ================================================================ 结尾：一艘船循着歌声开过来

  // 1) 船笛，她转头去听  2) 黑一下  3) 转过来看海，船从地平线开近  4) 揭晓：名牌、星级、印章、介绍卡逐字
  var AR = { pan0: 0.9, panD: 0.6, app0: 1.5, appD: 2.7, hold: 0.25 };
  var STEPS = [[12, 's12_'], [20, 's20_'], [32, 's32_'], [48, 's48_'], [64, 'ship_'], [88, 'b88_'], [120, 'big_']];
  var a = null;

  function arriveLayout() {
    var Hh = Gfx.H();
    var lines = a.lines;
    var lineH = 14;
    var cardH = 22 + lines.length * lineH + 6;
    var bigH = 98;
    var C0 = bigH - 6 + 30 + 10 + cardH;
    var top = 26;
    var bottom = Hh - 44;
    var final = 'big_';
    if (C0 > bottom - top) { final = 'b88_'; bigH = 72; C0 = bigH - 6 + 30 + 10 + cardH; }
    var y = top + Math.max(0, Math.floor((bottom - top - C0) / 2));
    var sz = Gfx.size(final + a.ship.key);
    return {
      final: final, finalW: sz.w, finalH: sz.h,
      shipY: y, cardH: cardH, lineH: lineH,
      hz: y + Math.round(bigH * 0.4),
      banY: y + bigH - 6, cardY: y + bigH - 6 + 30 + 10,
      btnY: Hh - 36
    };
  }

  function revealT() { return AR.app0 + AR.appD + AR.hold; }

  function drawSea(t, lay) {
    var g = Gfx.ctx();
    var W = Gfx.W();
    var st = Gfx.STAGES[4];
    Gfx.backdropRev(st, t, lay.hz);
    var steps = STEPS.filter(function (s) { return s[0] <= lay.finalW; });
    var u = Math.max(0, Math.min(1, (a.t - AR.app0) / AR.appD));
    var wTarget = 12 + (lay.finalW - 12) * Math.pow(u, 2.1);
    var step = steps[0];
    for (var k = 0; k < steps.length; k += 1) if (steps[k][0] <= wTarget + 0.01) step = steps[k];
    var name = step[1] + a.ship.key;
    var sz = Gfx.size(name);
    var f = (step[0] - 12) / Math.max(1, lay.finalW - 12);
    var cx = Math.round(118 + (W / 2 - 118) * f + (u < 1 ? 2 * Math.sin(a.t * 2.2) * (1 - f) : 0));
    var bottom = Math.round(lay.hz + 3 + (lay.shipY + lay.finalH - lay.hz - 3) * f + (a.revealed ? Math.round(Math.sin(t * 2.2)) : (u < 1 ? Math.sin(a.t * 5) * 0.6 : 0)));
    var x = cx - Math.floor(sz.w / 2);
    var y = bottom - sz.h;
    if (!a.revealed || a.t < a.rt + 1.2) {
      // 尾迹：两条泡沫线拉回她第一次出现的地平线
      var vx = 118;
      var vy = lay.hz + 2;
      g.fillStyle = Gfx.pat(g, '#c9d6ff', 5);
      [[x + Math.round(sz.w * 0.12), bottom - 2], [x + Math.round(sz.w * 0.88), bottom - 2]].forEach(function (p) {
        var nn = Math.max(1, Math.abs(p[1] - vy));
        for (var j = 0; j <= nn; j += 1) { var q = j / nn; g.fillRect(Math.round(vx + (p[0] - vx) * q), Math.round(vy + (p[1] - vy) * q), 1 + Math.round(q * 2), 1); }
      });
    }
    if (!a.revealed) {
      Gfx.sprT(g, name, x, y, '#070a1e');
      var lx = x + Math.floor(sz.w / 2);
      var ly = y + Math.floor(sz.h * 0.35);
      var s = step[0] >= 64 ? 2 : 1;
      if (Math.floor(a.t * 4) % 2) { g.fillStyle = Gfx.pat(g, '#ffe98a', 6); g.fillRect(lx - 3 * s, ly - 3 * s, 7 * s, 7 * s); }
      g.fillStyle = '#ffe98a'; g.fillRect(lx - s, ly, 3 * s, s); g.fillRect(lx, ly - s, s, 3 * s);
    } else if (a.t < a.rt + 0.12) Gfx.sprT(g, name, x, y, '#ffffff');
    else Gfx.spr(g, name, x, y);
    return { x: x, y: y, w: sz.w, h: sz.h };
  }

  Screens.arrive = {
    enter: function (p) {
      if (p.resume && a) {
        // 从图鉴回来：直接停在最后的画面（审查第 15 条）
        a.t = Math.max(a.t, revealT() + 3);
        a.typeAll = true;
        a.horn = true;
        a.doneAt = -10;
        return;
      }
      var ship = Siren.SHIPS[p.ship.index];
      a = {
        i: p.ship.index, ship: ship, isNew: p.ship.isNew, visits: p.ship.visits, song: p.song,
        t: 0, revealed: false, horn: false, rt: -1, stamped: false, typedShown: 0, typeAll: false, doneAt: null
      };
      a.lines = Gfx.wrap(UI.L(ship.desc), 144);
    },
    onHide: function () {},
    draw: function (t, dt) {
      var g = Gfx.ctx();
      var W = Gfx.W();
      a.t += dt;
      a.lines = Gfx.wrap(UI.L(a.ship.desc), 144);
      var lay = arriveLayout();
      var RT = revealT();
      if (!a.horn && a.t > 0.3) { a.horn = true; Audio.sfx('horn'); }
      var box = null;

      if (a.t < AR.pan0) {
        Gfx.world('listen', t, null, Gfx.STAGES[4], 1, 1);
      } else if (a.t < AR.pan0 + AR.panD) {
        // 黑一下：她这边渐黑 → 全黑一拍 → 海面渐亮
        var p = (a.t - AR.pan0) / AR.panD;
        var lvl;
        if (p < 0.42) { Gfx.world('listen', t, null, Gfx.STAGES[4], 1, 1); lvl = p / 0.42; }
        else if (p < 0.58) { lvl = 1; }
        else { drawSea(t, lay); lvl = 1 - (p - 0.58) / 0.42; }
        Gfx.fade(lvl);
      } else {
        var shake = a.revealed && a.t < a.rt + 0.22 ? Math.round((Math.random() * 2 - 1) * 2 * (1 - (a.t - a.rt) / 0.22)) : 0;
        g.save(); g.translate(shake, 0);
        box = drawSea(t, lay);
        g.restore();
        if (!a.revealed && a.t >= RT) {
          a.revealed = true;
          a.rt = a.t;
          Audio.sfx('reveal');
          Gfx.parts.length = 0;
          Gfx.burst(box.x + box.w / 2, box.y + box.h / 2, 26, '#fff6d0');
          Gfx.burst(box.x + box.w / 2, box.y + box.h / 2, 12, C.GOLD);
        }
        Gfx.drawParts();
      }

      if (!a.revealed) {
        // 点一下：让船现在就到
        UI.hit('hurry', 0, 0, W, Gfx.H(), function () { if (a.t < AR.app0 + AR.appD) { a.t = AR.app0 + AR.appD; a.horn = true; } }, { silent: true });
        UI.setBack(function () { App().go('select'); });
        return;
      }

      var rt = a.t - a.rt;
      var rc = Siren.SHIP_STYLE.ribbon;
      if (rt > 0.15) { var kb = Math.min(1, (rt - 0.15) / 0.2); UI.ribbon(W / 2, lay.banY - Math.round((1 - kb) * (1 - kb) * 10), UI.L(a.ship.name), rc); }
      if (rt > 0.8) {
        if (!a.stamped) { a.stamped = true; if (a.isNew) Audio.sfx('stamp'); }
        var ks = Math.min(1, (rt - 0.8) / 0.12);
        var sy2 = lay.shipY + 2 - Math.round((1 - ks) * 8);
        if (a.isNew) {
          var nw = Gfx.tw(t_('newFind')) + 12;
          Gfx.panel(g, 10, sy2, nw, 18, 5, ks < 1 ? '#ffffff' : C.CORAL, C.INK, C.INK);
          Gfx.text(g, t_('newFind'), 10 + nw / 2, sy2 + 3, { c: C.CREAM, a: 'c', o: '#a93e35' });
        } else {
          var vs = t_('visitN', { n: a.visits });
          var vw = Gfx.tw(vs) + 12;
          Gfx.panel(g, 10, sy2, vw, 16, 5, C.NAVY_L, C.NAVY_LL, C.INK);
          Gfx.text(g, vs, 10 + vw / 2, sy2 + 2, { c: C.CREAM, a: 'c' });
        }
      }
      if (rt > 0.5) {
        var kc = Math.min(1, (rt - 0.5) / 0.35);
        var cy = lay.cardY + Math.round((1 - kc * (2 - kc)) * (Gfx.H() - lay.cardY + 10));
        var cx = 10;
        var cw = 160;
        Gfx.panel(g, cx, cy, cw, lay.cardH, 4, C.PAPER, C.INK, C.INK);
        // 一条胶带把纸贴住
        g.fillStyle = C.INK; g.fillRect(W / 2 - 14, cy - 4, 28, 9);
        g.fillStyle = '#f7c5bb'; g.fillRect(W / 2 - 13, cy - 3, 26, 7);
        g.fillStyle = '#fbe0d8'; g.fillRect(W / 2 - 11, cy - 2, 18, 1);
        Gfx.text(g, 'No.' + ('0' + (a.i + 1)).slice(-2), cx + cw - 10, cy + 5, { c: C.PAPER_DIM, a: 'r' });
        var total = 0;
        var li;
        for (li = 0; li < a.lines.length; li += 1) total += a.lines[li].length;
        var shown = a.typeAll ? total : Math.max(0, Math.floor((rt - 0.9) * 26));
        if (shown > total) shown = total;
        if (shown > a.typedShown) { if (Math.floor(shown / 2) > Math.floor(a.typedShown / 2)) Audio.sfx('type'); a.typedShown = shown; }
        var left = shown;
        for (li = 0; li < a.lines.length; li += 1) {
          var ly2 = cy + 22 + li * lay.lineH;
          g.fillStyle = C.PAPER_LINE; g.fillRect(cx + 8, ly2 + 13, cw - 16, 1);
          if (left > 0) { Gfx.text(g, a.lines[li].slice(0, left), cx + 9, ly2, { c: C.PAPER_INK }); left -= a.lines[li].length; }
        }
        if (shown < total) {
          UI.hit('typeall', 0, 0, W, Gfx.H(), function () { a.typeAll = true; }, { silent: true });
        } else if (a.doneAt === null) a.doneAt = a.t;
      }
      if (a.doneAt !== null) {
        var locked = a.t - a.doneAt < 0.3;   // 刚出现的按钮先锁 0.3s，防止连点误触（审查第 15 条）
        UI.btn('again', 12, lay.btnY, 72, 24, t_('singAgain'), function () { App().startSong(a.song); }, { primary: true, locked: locked });
        UI.btn('other', 88, lay.btnY, 56, 24, t_('another'), function () { App().go('select'); }, { locked: locked });
        UI.btn('book', 148, lay.btnY, 20, 24, null, function () { App().go('codex', { from: 'arrive', sel: a.i }); }, { icon: 'i_book', locked: locked });
      }
      UI.setBack(function () { App().go('select'); });
    },
    back: function () { App().go('select'); }
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
