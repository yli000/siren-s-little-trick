/* 塞壬的小把戏 —— 前端：main.js（启动、主循环、切屏、弹层、返回键）
 *
 * 屏幕：title / select / play / hum / arrive / codex / practice / settings
 * 每个屏幕是 Siren.Screens[name] = { enter(params), draw(t, dt), back() }。
 */
(function (global) {
  'use strict';

  var Siren = global.Siren = global.Siren || {};
  var Gfx = Siren.Gfx;
  var UI = Siren.UI;
  var Session = Siren.Session;
  var Progress = Siren.Progress;
  var Audio = Siren.Audio;
  var doc = global.document;

  var App = {
    name: null,
    params: null,
    clock: 0,
    modal: null,          // { draw(t), ... } 画在最上层
    trans: 1,
    nav: 0,               // 每切一次屏幕 +1：异步回来的结果（麦克风授权）据此判断玩家是不是已经走开了
    deniedToast: false,
    dev: /[?&]dev=1/.test(global.location ? global.location.search : '')
  };
  Siren.App = App;

  // ---------------------------------------------------------------- 切屏

  var snap = null;
  var snapCtx = null;

  /** 切到另一个屏幕；带一个像素抖动的溶解过渡 */
  App.go = function (name, params) {
    var scr = Siren.Screens[name];
    if (!scr) throw new Error('没有这个屏幕：' + name);
    if (!snap) { snap = Gfx.mk(Gfx.W(), 400); snapCtx = snap.getContext('2d'); }
    snapCtx.clearRect(0, 0, snap.width, snap.height);
    snapCtx.drawImage(Gfx.main, 0, 0);
    App.trans = 0;
    App.nav += 1;
    var prev = App.name;
    App.name = name;
    App.params = params || {};
    App.modal = null;
    Gfx.parts.length = 0;
    // 离开唱歌相关的屏幕：停掉一切声音、释放麦克风（§2：手机上的麦克风指示灯要灭）
    var singing = name === 'play' || name === 'hum';
    if ((prev === 'play' || prev === 'hum') && !singing) Session.abort();
    if (!singing) Session.releaseMic();
    scr.enter(App.params, prev);
    guardHistory();
  };

  // ---------------------------------------------------------------- 唱歌之前：麦克风与「哼一声」

  function needMicCard() {
    return Siren.capabilities.getUserMedia && Session.micState() === 'unknown';
  }

  /**
   * 拿麦克风（必须在点击里调用），拿不到就进点按模式。
   * 等授权的时候玩家可能已经走开了（返回、去了设置）：那就放掉麦克风，不再往下走。
   */
  function withMic(then) {
    var nav = App.nav;
    Session.requestMic().then(function (ok) {
      if (App.nav !== nav || App.modal) {
        if (App.name !== 'play' && App.name !== 'hum') Session.releaseMic();
        return;
      }
      if (!ok && !App.deniedToast) { App.deniedToast = true; UI.toast(UI.t('micDenied'), 3.5); }
      then(ok);
    });
  }

  function showMicCard(then) {
    App.modal = {
      draw: function () {
        var g = Gfx.ctx();
        var W = Gfx.W();
        var H = Gfx.H();
        Gfx.dim(0.6);
        UI.block();
        var body = Gfx.wrap(UI.t('micBody'), 128);
        var h = 66 + body.length * 14 + 34;
        var y = Math.round((H - h) / 2);
        Gfx.panel(g, 14, y, W - 28, h, 8, Gfx.C.NAVY, Gfx.C.NAVY_LL, Gfx.C.INK);
        Gfx.disc(g, W / 2, y + 22, 13, Gfx.C.INK);
        Gfx.disc(g, W / 2, y + 21, 12, Gfx.C.CORAL);
        Gfx.spr(g, 'i_mic', W / 2 - 5, y + 14);
        Gfx.text(g, UI.t('micTitle'), W / 2, y + 40, { c: Gfx.C.CREAM, a: 'c' });
        for (var i = 0; i < body.length; i += 1) Gfx.text(g, body[i], W / 2, y + 58 + i * 14, { c: '#c6ccf5', a: 'c' });
        UI.btn('micok', W / 2 - 40, y + h - 32, 80, 24, UI.t('ok'), function () {
          App.modal = null;
          withMic(then);
        }, { primary: true });
      }
    };
  }

  /** 第一次唱之前：要麦克风 → 哼一声试试 → 开始 */
  function beforeSinging(start) {
    var from = App.name;
    function afterMic(ok) {
      if (ok && !Progress.onboarded()) App.go('hum', { next: start, from: from });
      else start();
    }
    if (needMicCard()) showMicCard(afterMic);
    else withMic(afterMic);
  }

  App.startSong = function (song) {
    beforeSinging(function () { App.go('play', { kind: 'song', song: song }); });
  };
  App.startPractice = function (exId) {
    beforeSinging(function () { App.go('play', { kind: 'practice', exercise: exId }); });
  };
  App.retryMic = function () {
    withMic(function () { /* 设置页会读新的状态 */ });
  };

  // ---------------------------------------------------------------- 返回键 / 侧滑（审查第 12 条，需真机验证）

  var guarded = false;
  function guardHistory() {
    var h = global.history;
    if (!h || typeof h.pushState !== 'function') return;
    if (App.name !== 'title' && !guarded) {
      try { h.pushState({ siren: 1 }, ''); guarded = true; } catch (e) { /* 容器不支持就算了 */ }
    }
  }
  global.addEventListener('popstate', function () {
    guarded = false;
    if (App.modal) { App.modal = null; guardHistory(); return; }   // 先关掉弹出的卡片
    if (App.name === 'title') return;
    if (!UI.back()) App.go('title');
    guardHistory();
  });

  // ---------------------------------------------------------------- 切后台自动暂停

  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden) {
      var scr = Siren.Screens[App.name];
      if (scr && scr.onHide) scr.onHide();
      Audio.hold();          // 海浪、音效一起停；回来再响
      return;
    }
    if (unlocked) Audio.wake();
  });

  // ---------------------------------------------------------------- 第一次点击：解锁声音

  var unlocked = false;
  function unlock() {
    if (unlocked) { Audio.ensureAudio(); return; }
    unlocked = true;
    try {
      Audio.ensureAudio();
      Audio.setSfxMuted(Progress.sfxOff());
      Audio.seaStart();
    } catch (e) { /* 没有 AudioContext 也能看 */ }
  }

  // ---------------------------------------------------------------- 主循环

  var last = 0;
  function frame(nowMs) {
    var dt = Math.min(0.05, (nowMs - last) / 1000 || 0);
    last = nowMs;
    App.clock += dt;
    var t = App.clock;
    var g = Gfx.ctx();
    g.imageSmoothingEnabled = false;
    UI.beginFrame(t);
    Gfx.stepParts(dt);
    var scr = Siren.Screens[App.name];
    if (scr) scr.draw(t, dt);
    if (App.modal) App.modal.draw(t, dt);
    UI.drawToast();
    if (App.trans < 1 && snap) {
      App.trans = Math.min(1, App.trans + dt / 0.38);
      var tg = Gfx.tmpCtx;
      tg.clearRect(0, 0, Gfx.W(), Gfx.H());
      tg.drawImage(snap, 0, 0);
      tg.globalCompositeOperation = 'destination-in';
      tg.fillStyle = Gfx.pat(tg, '#000000', (1 - App.trans) * 16);
      tg.fillRect(0, 0, Gfx.W(), Gfx.H());
      tg.globalCompositeOperation = 'source-over';
      g.drawImage(Gfx.tmp, 0, 0, Gfx.W(), Gfx.H(), 0, 0, Gfx.W(), Gfx.H());
    }
    Gfx.present();
    global.requestAnimationFrame(frame);
  }

  function boot() {
    Gfx.resize();
    global.addEventListener('resize', Gfx.resize);
    UI.bindInput(unlock);
    Session.on('notice', function (n) { if (n.code === 'LOW_INPUT') UI.toast(UI.t('lowInput')); });
    Promise.all([
      Session.init(),
      new Promise(function (resolve) { Gfx.load(resolve); })
    ]).then(function () {
      var bootEl = doc.getElementById('boot');
      if (bootEl) bootEl.parentNode.removeChild(bootEl);
      App.go('title');
      App.trans = 1;
      global.requestAnimationFrame(function (n) { last = n; frame(n); });
    });
    if (App.dev) global.__siren = App;   // 只在 ?dev=1 时开放，供自动测试切屏
  }

  boot();
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
