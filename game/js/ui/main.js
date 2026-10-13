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
    // 离开唱歌界面：停掉一切声音。麦克风不马上关——唱完一首接着换一首、再来一遍时，
    // 手机不用每次都重新打开麦克风（每打开一次，系统或浏览器就会弹一次"正在使用麦克风"）。
    // 不在唱歌界面待了 MIC_IDLE_MS 才关；切后台立刻关。
    var singing = name === 'play';
    if (prev === 'play' && !singing) Session.abort();
    if (singing) cancelMicRelease(); else scheduleMicRelease();
    scr.enter(App.params, prev);
    guardHistory();
  };

  // ---------------------------------------------------------------- 麦克风什么时候关

  App.MIC_IDLE_MS = 45000;   // 离开唱歌界面多久之后关麦克风（测试里会改短）
  var micTimer = null;
  function cancelMicRelease() { if (micTimer) { global.clearTimeout(micTimer); micTimer = null; } }
  function scheduleMicRelease() {
    cancelMicRelease();
    if (!Session.micOpen()) return;
    micTimer = global.setTimeout(function () { micTimer = null; if (App.name !== 'play') Session.releaseMic(); }, App.MIC_IDLE_MS);
  }

  // ---------------------------------------------------------------- 唱歌之前：麦克风与第一次的跟唱引导

  /**
   * 拿麦克风（必须在点击里调用）：没授权过就直接弹浏览器的授权框。拿不到也照常唱，每个音都算 Miss。
   * 等授权的时候玩家可能已经走开了（返回、去了设置）：那就不再往下走。
   */
  function withMic(then) {
    var nav = App.nav;
    Session.requestMic().then(function (ok) {
      if (App.nav !== nav || App.modal) { if (App.name !== 'play') scheduleMicRelease(); return; }
      if (!ok && !App.deniedToast) { App.deniedToast = true; UI.toast(UI.t('micNone'), 2.4); }
      then(ok);
    });
  }

  /** 第一次唱之前：一张卡说清楚怎么玩 → 她唱一句、你跟一句 → 进玩家点的那首 */
  function showGuideCard(go) {
    function ok() { App.modal = null; go(); }
    function close() { App.modal = null; }
    UI.setPrimary(ok);   // 卡片一出现回车就是「试试」，不必等下一帧画出按钮
    App.modal = {
      draw: function () { UI.popup(UI.t('guideTitle'), UI.t('guideBody'), [{ label: UI.t('guideGo'), act: ok }], close); }
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
  /** 设置里点「未授权」：弹浏览器的授权框；拿到了也不留着（不在唱歌） */
  App.askMic = function (done) {
    Session.requestMic().then(function (ok) {
      if (App.name !== 'play') scheduleMicRelease();
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
      cancelMicRelease();
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
