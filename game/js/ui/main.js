/* 塞壬的小把戏 —— 前端：main.js（启动、主循环、切屏、弹层、返回键）
 *
 * 屏幕：title / select / play / arrive / codex / practice / settings
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
    micHint: false,       // 点了「打开麦克风」浏览器却没弹授权框：之后的说明里补上去哪里打开
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
    // 离开唱歌界面：停掉一切声音、关掉麦克风。只在唱的时候开着麦克风，
    // 手机的"正在使用麦克风"提示就如实告诉玩家现在有没有在听（每次打开都会弹一次，这是系统的提示）。
    var singing = name === 'play';
    if (prev === 'play' && !singing) Session.abort();
    if (!singing) Session.releaseMic();
    scr.enter(App.params, prev);
    guardHistory();
  };

  // ---------------------------------------------------------------- 唱歌之前：麦克风与第一次的「怎么玩」

  /**
   * 拿麦克风（必须在点击里调用）：没授权过就直接弹浏览器的授权框。拿不到也照常唱，每个音都算 Miss。
   * 等授权的时候玩家可能已经走开了（返回、去了设置）：那就不再往下走。
   */
  function withMic(then) {
    var nav = App.nav;
    Session.requestMic().then(function (ok) {
      if (App.nav !== nav || App.modal) { if (App.name !== 'play') Session.releaseMic(); return; }
      if (!ok && !App.deniedToast) {
        // 第一次发现没有麦克风：说清楚后果和去哪里打开，玩家点了「知道了」再往下走
        App.deniedToast = true;
        var go = function (got) { App.modal = null; then(!!got); };
        var skip = function () { go(false); };
        // 「打开麦克风」：再要一次，浏览器会再弹授权框；没弹出来（之前点过拒绝、被记住了）就补一句去哪里打开
        var retry = function () { App.retryMic(function (got) { if (got) go(true); }); };
        UI.setPrimary(retry);
        App.modal = { draw: function () {
          UI.popup(UI.t('micOff'), App.micHint ? UI.t('micHow') : null, [{ label: UI.t('micSkip'), act: skip }, { label: UI.t('micRetry'), act: retry, primary: true }], null);
        }, onBack: skip };
        return;
      }
      then(ok);
    });
  }

  /** 第一次唱之前：一张「怎么玩」的卡 → 点「先试一句」（这一下拿麦克风，浏览器会弹授权框）→ 教程 → 进玩家点的那首 */
  function showGuideCard(go) {
    function ok() { App.modal = null; go(); }
    function close() { App.modal = null; }
    UI.setPrimary(ok);   // 卡片一出现回车就是「先试一句」，不必等下一帧画出按钮
    App.modal = {
      draw: function () { UI.popup(UI.t('tutTitle'), UI.t('tutIntro'), [{ label: UI.t('tutIntroGo'), act: ok }], close); }
    };
  }

  function beforeSinging(start) {
    var from = App.name;
    if (!Progress.onboarded()) {
      showGuideCard(function () {
        withMic(function () { App.go('play', { kind: 'guide', next: start, from: from }); });
      });
      return;
    }
    withMic(function () { start(); });
  }

  App.startSong = function (song) {
    beforeSinging(function () { App.go('play', { kind: 'song', song: song }); });
  };
  App.startPractice = function (exId) {
    beforeSinging(function () { App.go('play', { kind: 'practice', exercise: exId }); });
  };
  /**
   * 「打开麦克风」：再要一次麦克风（这一下是点击，浏览器会再弹授权框）。
   * 浏览器记住了拒绝就不会再弹：这时 micHint 打开，说明里补上去网站设置里打开的那一句。done(ok)
   */
  App.retryMic = function (done) {
    Session.requestMic().then(function (ok) {
      App.micHint = !ok;
      if (ok && App.name !== 'play') Session.releaseMic();   // 不在唱歌：试通了就先关上，唱的时候再开
      if (done) done(ok);
    });
  };

  /** 教程最后点「再试一次」/「打开麦克风」：没有麦克风就先再要一次，拿到了才重来 */
  App.guideAgain = function () {
    if (Session.micOpen()) { Session.guideAgain(); return; }
    App.retryMic(function (ok) { if (ok && App.name === 'play') Session.guideAgain(); });
  };

  /**
   * 设置里点「未授权」：打开一下麦克风，浏览器自己的授权框就会弹出来；
   * 不管结果如何，马上关掉（不在唱歌）
   */
  App.askMic = function (done) {
    Session.requestMic().then(function (ok) {
      if (App.name !== 'play') Session.releaseMic();
      if (done) done(ok);
    });
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
    if (App.modal) {   // 先关掉弹出的卡片；「麦克风未授权」那张按返回就等于点了「知道了」
      var m = App.modal;
      App.modal = null;
      if (m.onBack) m.onBack();
      guardHistory();
      return;
    }
    if (App.name === 'title') return;
    if (!UI.back()) App.go('title');
    guardHistory();
  });

  // ---------------------------------------------------------------- 切后台自动暂停

  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden) {
      var scr = Siren.Screens[App.name];
      if (scr && scr.onHide) scr.onHide();
      Session.releaseMic();  // 切后台：麦克风立刻关
      Audio.hold();          // 海浪、音效一起停；回来再响
      return;
    }
    if (unlocked) Audio.wake();
  });
  // 有的容器切回来时不发 visibilitychange：页面重新拿到焦点 / 重新显示时也试着恢复
  global.addEventListener('pageshow', function () { if (unlocked && !doc.hidden) Audio.wake(); });
  global.addEventListener('focus', function () { if (unlocked && !doc.hidden) Audio.wake(); });

  // ---------------------------------------------------------------- 第一次点击：解锁声音

  var unlocked = false;
  function unlock() {
    // 每次点击都是一次手势：音频没在跑（锁屏回来、被来电打断、iOS 的 interrupted）就在这里拉起来
    if (unlocked) { Audio.kick(!doc.hidden); return; }
    unlocked = true;
    try {
      Audio.ensureAudio();
      Audio.setSfxMuted(Progress.sfxOff());
      Audio.seaStart();
    } catch (e) { /* 没有 AudioContext 也能看 */ }
  }

  // ---------------------------------------------------------------- 主循环

  var last = 0;
  /** 浏览器标签页的标题和页面语言跟着游戏语言走（没选过语言时就是系统语言） */
  var shownLang = null;
  function syncDocLang() {
    var l = Progress.lang();
    if (l === shownLang) return;
    shownLang = l;
    doc.title = UI.t('title');
    if (doc.documentElement) doc.documentElement.lang = l === 'en' ? 'en' : 'zh-CN';
  }

  function frame(nowMs) {
    var dt = Math.min(0.05, (nowMs - last) / 1000 || 0);
    last = nowMs;
    App.clock += dt;
    var t = App.clock;
    var g = Gfx.ctx();
    g.imageSmoothingEnabled = false;
    UI.beginFrame(t);
    syncDocLang();
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
