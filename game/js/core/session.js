/* 塞壬的小把戏 —— 后端：session.js（v2 流程：一首歌 / 一组练习 / 第一次的「怎么玩」教程）
 *
 * 取代 v1 的 game.js（5 句随机旋律 + 船队）。依据 docs/04-v2-修改意见.md §1.4–1.6、§3、§4 与附录审查。
 *
 * 一句的节奏（唱歌和练习相同）：
 *
 *   intro   1.2s   歌名卡（只在一首歌开头）；麦克风已开，测底噪
 *   listen         她唱这一句
 *   countin 2 拍   嗒、嗒（按这首歌的拍速）；海浪淡到 0；她的混响尾音被切掉
 *   sing           第 3 拍 = 第一个音该开口的时刻（t = 0）。每 50ms 一帧送进 judge；
 *                  每个音结束后 300ms 判定，发 'note' 事件。**录音期间不播任何声音**
 *   result  0.8s   这一句的档位停留；测底噪
 *   → 下一句；整句几乎没出声 → 她再唱一遍（最多两次，之后静静进入下一句）
 *
 * 暂停：立刻停掉所有声音、采样，释放麦克风；继续时重新拿麦克风（继续按钮就是手势），
 *       从当前这一句的 listen 重新开始；若这一句已经判完（停在 result），直接进入下一步。
 * 没有麦克风（没授权）：照常唱，每个音都算 Miss。
 *
 * 前端只通过 getState()（每帧读）和少量事件（note / phase / finish / notice）与本模块交互。
 * 本文件不触碰 document / window 渲染（D0 硬规则 1）；不返回任何中文文案（D7.4）。
 */

(function (global) {
  'use strict';

  var Siren = global.Siren = global.Siren || {};
  var Pitch = Siren.Pitch;
  var Audio = Siren.Audio;
  var Judge = Siren.Judge;
  var Music = Siren.Music;
  var Practice = Siren.Practice;
  var Progress = Siren.Progress;
  var Store = Siren.Store;

  var CFG = {
    FRAME_MS: 50,
    INTRO_MS: 1200,
    LISTEN_LEAD_S: 0.12,      // 她开口前的排程提前量
    LISTEN_TAIL_MS: 250,
    COUNTIN_LEAD_MS: 60,
    PRE_ROLL_MS: 150,         // 第一个音之前也收帧（早开口的人）
    POST_ROLL_MS: 450,        // 最后一个音之后再收多久
    RESULT_MS: 800,
    MAX_QUIET_RETRIES: 2,
    HUM_MS: 2600,
    GUIDE: { src: '1 2 3:4', bpm: 92 },   // 「怎么玩」教程：就练这一句
    NOISE_SETTLE_MS: 150,
    LOW_INPUT_RMS: 0.004      // 一句里最大电平都低于此值 → 提示靠近麦克风
  };

  // ---------------------------------------------------------------- 事件

  var listeners = {};
  function on(type, fn) {
    (listeners[type] = listeners[type] || []).push(fn);
    return function () { off(type, fn); };
  }
  function off(type, fn) {
    var a = listeners[type];
    if (!a) return;
    var i = a.indexOf(fn);
    if (i >= 0) a.splice(i, 1);
  }
  function emit(type, payload) {
    var a = (listeners[type] || []).slice();
    for (var i = 0; i < a.length; i += 1) {
      try { a[i](payload); } catch (e) { if (global.console) global.console.warn('[Siren] listener error', type, e); }
    }
  }

  // ---------------------------------------------------------------- 时钟与定时器

  var clock = {
    now: function () {
      return global.performance && global.performance.now ? global.performance.now() : Date.now();
    },
    setTimeout: function (fn, ms) { return global.setTimeout(fn, ms); },
    clearTimeout: function (id) { global.clearTimeout(id); },
    setInterval: function (fn, ms) { return global.setInterval(fn, ms); },
    clearInterval: function (id) { global.clearInterval(id); }
  };
  var token = 0;
  var timers = [];
  var sampler = null;

  function later(fn, ms) {
    var my = token;
    var id = clock.setTimeout(function () {
      timers = timers.filter(function (t) { return t !== id; });
      if (my === token) fn();
    }, Math.max(0, ms));
    timers.push(id);
    return id;
  }
  function stopTimers() {
    for (var i = 0; i < timers.length; i += 1) clock.clearTimeout(timers[i]);
    timers = [];
    if (sampler !== null) { clock.clearInterval(sampler); sampler = null; }
  }

  // ---------------------------------------------------------------- 麦克风

  var mic = { state: 'unknown', perm: null, stream: null, source: null, analyser: null, buf: null, gainBuf: null, gain: 1, noise: 0.004, peak: 0 };
  /** 测试注入：替代真实麦克风，返回 { hz, rms }（hz 已是检测后的结果）。 */
  var micStub = null;

  function micReady() { return !!(micStub || mic.analyser); }

  /**
   * 申请麦克风。⚠️ 必须在用户手势里调用（容器要求）。
   * @returns {Promise<boolean>}
   */
  var micPending = null;   // 正在等授权时再点一次：返回同一个 Promise，不会开出两路麦克风

  function requestMic() {
    if (micStub) { mic.state = 'granted'; return Promise.resolve(true); }
    if (mic.analyser) return Promise.resolve(true);
    if (micPending) return micPending;
    micPending = openMic();
    micPending.then(function () { micPending = null; });
    return micPending;
  }

  function openMic() {
    var nav = global.navigator;
    if (!nav || !nav.mediaDevices || typeof nav.mediaDevices.getUserMedia !== 'function') {
      mic.state = 'denied';
      return Promise.resolve(false);
    }
    var req;
    try {
      req = nav.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      mic.state = 'denied';
      return Promise.resolve(false);
    }
    return Promise.resolve(req).then(function (stream) {
      if (mic.stream && mic.stream !== stream) { try { mic.stream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (e) { /* 忽略 */ } }
      var c = Audio.ensureAudio();
      mic.stream = stream;
      mic.source = c.createMediaStreamSource(stream);
      mic.analyser = c.createAnalyser();
      mic.analyser.fftSize = 2048;
      mic.analyser.smoothingTimeConstant = 0;
      mic.source.connect(mic.analyser);   // ⚠️ 绝不接到 destination，否则啸叫
      mic.buf = new Float32Array(2048);
      mic.state = 'granted';
      mic.perm = 'granted';
      Store.setBool(Store.KEYS.MIC_OK, true);
      // 浏览器或系统把麦克风收走了（权限被关、被别的应用占用）：当作没麦克风，下次唱的时候再拿
      stream.getTracks().forEach(function (tr) {
        tr.onended = function () { if (mic.stream === stream) releaseMic(); };
      });
      return true;
    }).catch(function () {
      mic.state = 'denied';
      Store.setBool(Store.KEYS.MIC_OK, false);
      return false;
    });
  }

  /**
   * 向浏览器问一下现在的麦克风权限（不弹框）：设置页用它显示「已授权 / 未授权」。
   * 浏览器不支持 Permissions API 时沿用上次记下的结果。
   */
  function refreshMic() {
    var nav = global.navigator;
    if (micStub || !nav || !nav.permissions || typeof nav.permissions.query !== 'function') return Promise.resolve(mic.state);
    var q;
    try { q = nav.permissions.query({ name: 'microphone' }); } catch (e) { return Promise.resolve(mic.state); }
    return Promise.resolve(q).then(function (st) {
      function apply() {
        mic.perm = st.state;
        if (st.state === 'granted') mic.state = 'granted';
        else if (st.state === 'denied') { mic.state = 'denied'; releaseMic(); }
        else if (!mic.analyser) mic.state = 'unknown';   // prompt：在浏览器里被重置过
      }
      apply();
      st.onchange = apply;
      return mic.state;
    }).catch(function () { return mic.state; });
  }

  function releaseMic() {
    if (mic.stream) {
      var tracks = mic.stream.getTracks();
      for (var i = 0; i < tracks.length; i += 1) tracks[i].stop();
    }
    if (mic.source) { try { mic.source.disconnect(); } catch (e) { /* 忽略 */ } }
    mic.stream = null;
    mic.source = null;
    mic.analyser = null;
    mic.buf = null;
    mic.gainBuf = null;
  }

  function rmsOf(buf) {
    var s = 0;
    for (var i = 0; i < buf.length; i += 1) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }

  /** 读一帧：{ hz, rms }。rms 是原始电平，音高检测用增益后的副本。 */
  function readFrame() {
    if (micStub) return micStub(clock.now());
    if (!mic.analyser) return { hz: 0, rms: 0 };
    mic.analyser.getFloatTimeDomainData(mic.buf);
    var rms = rmsOf(mic.buf);
    var detect = mic.buf;
    if (mic.gain > 1.05) {
      if (!mic.gainBuf) mic.gainBuf = new Float32Array(mic.buf.length);
      mic.gainBuf.set(mic.buf);
      Audio.applyInputGain(mic.gainBuf, mic.gain);
      detect = mic.gainBuf;
    }
    var r = Pitch.detectPitch(detect, Audio.ensureAudio().sampleRate, 2048);
    return { hz: r.hz > 0 ? r.hz : 0, rms: rms };
  }

  // ---------------------------------------------------------------- 状态

  var S = null;   // 当前这一轮（一首歌 / 一组练习 / 哼一声）

  function blank() {
    return {
      kind: null, phase: 'idle', phaseAt: 0, paused: false,
      song: null, shift: 0, phraseIdx: 0, phraseCount: 0, phrases: [],
      practice: null, exercise: null,
      notes: [], phraseMs: 0, beatMs: 600, tonic: 60,
      judge: null, results: [], ks: [], kws: [], ls: [], tiers: [], trace: [], level: 0,
      quietRetries: 0, again: false, againReason: null, t0: 0, sangFrames: 0,
      finished: null, humSamples: [], next: null, pausedAt: 0, resuming: false,
      waiting: null, gateFn: null
    };
  }

  function setPhase(p) {
    S.phase = p;
    S.phaseAt = clock.now();
    emit('phase', { phase: p, phraseIdx: S.phraseIdx });
  }

  // ---------------------------------------------------------------- 底噪

  function sampleNoise(ms) {
    if (!micReady()) return;
    var samples = [];
    var my = token;
    var start = clock.now();
    function step() {
      if (my !== token || !S) return;
      var f = readFrame();
      samples.push(f.rms);
      if (clock.now() - start < ms) later(step, 40);
      else {
        samples.sort(function (a, b) { return a - b; });
        // 取中位数：估低只是多收几帧噪声（YIN 会挡掉），估高会让整句作废
        mic.noise = Math.max(0.0005, samples[Math.floor(samples.length / 2)] || mic.noise);
      }
    }
    later(step, CFG.NOISE_SETTLE_MS);
  }

  // ---------------------------------------------------------------- 一句

  /** 当前这一句的目标音（毫秒，0 = 第一个音该开口的时刻） */
  function loadPhrase() {
    var src;
    var tonic;
    var bpm;
    if (S.kind === 'song') {
      src = S.song.phrases[S.phraseIdx];
      tonic = S.song.key + S.shift;
      bpm = S.song.bpm;
    } else if (S.kind === 'guide') {
      src = CFG.GUIDE.src;
      tonic = S.tonic;
      bpm = CFG.GUIDE.bpm;
    } else {
      var item = S.practice.current();
      src = item.src;
      tonic = item.tonic;
      bpm = item.bpm;
    }
    var p = Music.phraseNotes(src, tonic, bpm);
    S.notes = p.notes;
    S.phraseMs = p.durMs;
    S.beatMs = Music.beatMs(bpm);
    S.tonic = tonic;
    S.tiers = [];
    S.trace = [];
    S.level = 0;
  }

  function startListen() {
    if (!S) return;
    loadPhrase();
    Audio.stopPlayback();
    Audio.seaLevel(0.6, 0.6);
    setPhase('listen');
    var c = Audio.getAudioContext();
    var playNotes = S.notes.map(function (n) { return { midi: n.midi, startMs: n.startMs, durationMs: n.durMs }; });
    if (c) Audio.playPhrase(playNotes, { when: c.currentTime + CFG.LISTEN_LEAD_S });
    later(S.kind === 'guide' ? function () { gate('turn', startCountin); } : startCountin,
      CFG.LISTEN_LEAD_S * 1000 + S.phraseMs + CFG.LISTEN_TAIL_MS);
  }

  function startCountin() {
    if (!S) return;
    // 切掉她的混响尾音（否则会被当成底噪或被录进去），海浪淡出
    Audio.stopPlayback();
    Audio.seaLevel(0, 0.25);
    setPhase('countin');
    var c = Audio.getAudioContext();
    var lead = CFG.COUNTIN_LEAD_MS;
    if (c) {
      Audio.sfx('tick', c.currentTime + lead / 1000);
      Audio.sfx('tick', c.currentTime + (lead + S.beatMs) / 1000);
    }
    S.t0 = clock.now() + lead + 2 * S.beatMs;
    var opts = {
      keyFree: S.kind !== 'practice' ? true : S.practice.current().keyFree !== false,
      kInit: S.ks.length ? S.ks[S.ks.length - 1] : 0,
      kWeight: S.kws.length ? S.kws[S.kws.length - 1] : Judge.config().K_PRIOR_FIRST,
      lInit: S.ls.length ? S.ls[S.ls.length - 1] : Progress.latency(),
      noiseFloor: mic.noise
    };
    S.judge = Judge.create(S.notes, opts);
    S.sangFrames = 0;
    mic.peak = 0;
    // 第一个音之前 PRE_ROLL_MS 就开始收帧（没有麦克风就不收，这一句每个音都算 Miss）
    later(function () {
      if (micReady()) sampler = clock.setInterval(pump, CFG.FRAME_MS);
    }, lead + 2 * S.beatMs - CFG.PRE_ROLL_MS);
    later(function () { setPhase('sing'); }, lead + 2 * S.beatMs);
    var last = S.notes[S.notes.length - 1];
    later(finishPhrase, lead + 2 * S.beatMs + last.startMs + last.durMs + CFG.POST_ROLL_MS + Math.max(0, opts.lInit));
  }

  function pump() {
    if (!S || !S.judge) return;
    var t = clock.now() - S.t0;
    var f = readFrame();
    if (f.rms > mic.peak) mic.peak = f.rms;
    var fr = S.judge.push({ t: t, hz: f.hz, rms: f.rms });
    S.level = Math.min(1, (f.rms * mic.gain) / 0.08);
    if (S.judge.voiced(fr)) {
      S.sangFrames += 1;
      var live = S.judge.live();
      var disp = displayMidi(fr.midi, t, live);
      if (disp !== null) S.trace.push({ t: t, midi: disp });
    }
    var out = S.judge.poll(t);
    for (var i = 0; i < out.length; i += 1) pushTier(out[i]);
  }

  /**
   * 音高线怎么画（审查第 6 条）：先减去调偏移 K，再折到"这一刻该唱的那个音"附近，
   * 这样用自己的调、低八度唱的人，看到的线也贴着音块走，而不是在说"你低了"。
   */
  function displayMidi(midi, t, live) {
    var tt = t - live.l;
    var ref = null;
    for (var i = 0; i < S.notes.length; i += 1) {
      var n = S.notes[i];
      if (tt >= n.startMs - 100 && tt < n.startMs + n.durMs + 100) { ref = n.midi; break; }
    }
    if (ref === null) return null;
    return ref + Judge.fold(midi - live.k - ref);
  }

  function pushTier(r) {
    S.tiers[r.index] = r.tier;
    emit('note', { index: r.index, tier: r.tier, a: r.a, phase: S.phase });
  }

  function finishPhrase() {
    if (!S || !S.judge) return;
    if (sampler !== null) { clock.clearInterval(sampler); sampler = null; }
    var noMic = !micReady();
    var res = S.judge.finish();
    if (noMic) {
      // 没有麦克风：每个音都是 Miss，不走"她再唱一遍"
      res.newly = S.notes.map(function (n, idx) { return { index: idx, tier: 'miss', a: 0 }; });
      res.score = 0;
      res.silent = false;
    }
    for (var i = 0; i < res.newly.length; i += 1) pushTier(res.newly[i]);
    S.judge = null;
    S.level = 0;

    // 输入增益自适应：用这一句实测的峰值算下一句的增益（只增不减）
    if (!noMic && mic.peak > 0) {
      var g = Audio.computeInputGain(mic.peak, mic.noise);
      if (g > mic.gain) mic.gain = g;
    }

    var quiet = res.silent;
    if (quiet && micReady() && mic.peak < CFG.LOW_INPUT_RMS) emit('notice', { code: 'LOW_INPUT' });

    setPhase('result');
    sampleNoise(CFG.RESULT_MS - 250);
    var r = { phraseIdx: S.phraseIdx, score: res.score, silent: quiet, tiers: S.tiers.slice(), k: res.k, l: res.l };
    emit('phraseEnd', r);

    if (S.kind === 'guide') {
      // 教程：没出声就说一声再来（最多两次）；唱了就讲档位，玩家决定再试一次还是开始唱
      S.again = false;
      if (quiet && S.quietRetries < CFG.MAX_QUIET_RETRIES) {
        S.quietRetries += 1;
        then(function () { gate('quiet', startListen); });
      } else {
        S.quietRetries = 0;
        then(function () { gate('end', finishGuide); });
      }
      return;
    }

    if (quiet && S.kind !== 'practice' && S.quietRetries < CFG.MAX_QUIET_RETRIES) {
      // 几乎没出声：不给档位，她再唱一遍（审查第 7 条）。练习不走这条：没出声也算一遍，最多 3 遍
      S.quietRetries += 1;
      S.again = true;
      S.againReason = 'quiet';
      then(startListen);
      return;
    }
    S.again = false;
    S.againReason = null;
    S.quietRetries = 0;
    if (!quiet && !noMic) {
      S.ks.push(res.k);
      S.kws.push(Judge.priorWeight ? Judge.priorWeight(res.kSupport) : 1);
      S.ls.push(res.l);
    }

    if (S.kind === 'song') {
      S.results.push(r);
      if (S.phraseIdx + 1 < S.phraseCount) then(function () { S.phraseIdx += 1; startListen(); });
      else then(finishSong);
    } else {
      var verdict = S.practice.report({ score: res.score, silent: quiet });
      S.again = verdict === 'retry';
      S.againReason = S.again ? (quiet ? 'quiet' : 'retry') : null;
      then(verdict === 'done' ? finishPractice : nextPracticeItem);
    }
  }

  /**
   * 这一句判完后的下一步：结果停留 RESULT_MS 后执行。
   * 记在 S.next 里——在结果停留时暂停，继续时直接执行它，不会把判完的这一句再唱一遍。
   */
  function then(fn) {
    S.next = fn;
    later(function () {
      if (!S || S.next !== fn) return;
      S.next = null;
      fn();
    }, CFG.RESULT_MS);
  }

  // ---------------------------------------------------------------- 一首歌

  /**
   * 开始一首歌。须先 requestMic()（拒绝时自动进入点按模式）。
   * @param {Object} song   Siren.SONGS 里的一项
   */
  function startSong(song) {
    abortRun();
    S = blank();
    S.kind = 'song';
    S.song = song;
    S.shift = Progress.songShift(song);
    S.phraseCount = song.phrases.length;
    Progress.setLastSong(song.id);
    Audio.ensureAudio();
    Audio.seaStart();
    Audio.seaLevel(0.6, 0.4);
    setPhase('intro');
    sampleNoise(CFG.INTRO_MS - 300);
    later(startListen, CFG.INTRO_MS);
  }

  function finishSong() {
    if (!S) return;
    // 唱完那一刻就抽船并存档（审查第 15 条）；后面的开船动画只是播放
    var idx = Progress.pickShip(S.song.id);
    var arrival = Progress.recordArrival(S.song.id, idx);
    if (S.ls.length) {
      var ls = S.ls.slice().sort(function (a, b) { return a - b; });
      Progress.setLatency(ls[Math.floor(ls.length / 2)]);
    }
    Progress.learnShift(S.shift, S.ks);
    S.finished = { kind: 'song', songId: S.song.id, results: S.results.slice(), ship: arrival };
    setPhase('done');
    Audio.seaLevel(0.6, 1.5);
    emit('finish', S.finished);
  }

  // ---------------------------------------------------------------- 一组练习

  function startPractice(exId) {
    abortRun();
    S = blank();
    S.kind = 'practice';
    S.exercise = exId;
    var r = Progress.range();
    S.practice = Practice.create(exId, r && r.comfort ? r.comfort : 0);
    S.phraseCount = S.practice.total();
    Audio.ensureAudio();
    Audio.seaStart();
    Audio.seaLevel(0.6, 0.4);
    setPhase('intro');
    sampleNoise(CFG.INTRO_MS - 300);
    later(nextPracticeItem, CFG.INTRO_MS);
  }

  function nextPracticeItem() {
    if (!S) return;
    S.phraseIdx = S.practice.index();
    var item = S.practice.current();
    if (!item) { finishPractice(); return; }
    if (item.kind === 'hum') { startHumPhase(function (midi) { S.practice.setComfort(midi); S.practice.report({ score: 100, silent: false }); nextPracticeItem(); }); return; }
    startListen();
  }

  function finishPractice() {
    if (!S) return;
    // 只有这一遍真的测到了东西（第 1 组哼到了舒服的音、第 4 组至少过了一级）才存、才说「她记住你的调了」
    var learned = S.practice.learned();
    var keys = Object.keys(learned);
    if (keys.length) {
      if (learned.comfort && S.exercise === 'find') learned.fromFind = true;
      Progress.setRange(learned);
    }
    Progress.markPractice(S.exercise);
    S.finished = { kind: 'practice', exercise: S.exercise, learnedRange: keys.length > 0 };
    setPhase('done');
    emit('finish', S.finished);
  }

  // ---------------------------------------------------------------- 哼一声

  /**
   * 「哼一声试试」/ 测舒服的音高：收 HUM_MS 的帧，取有声帧音高的中位数。
   * 练习「单音」的第一步。
   */
  function startHumPhase(done) {
    S.humSamples = [];
    S.trace = [];
    Audio.stopPlayback();
    Audio.seaLevel(0, 0.3);
    setPhase('hum');
    S.t0 = clock.now();
    var noise = mic.noise;
    if (micReady()) {
      sampler = clock.setInterval(function () {
        var t = clock.now() - S.t0;
        var f = readFrame();
        S.level = Math.min(1, (f.rms * mic.gain) / 0.08);
        if (f.hz > 0 && f.rms >= noise * 1.8) {
          var m = Pitch.hzToMidi(f.hz);
          S.humSamples.push(m);
          S.trace.push({ t: t, midi: m });
        }
      }, CFG.FRAME_MS);
    }
    later(function () {
      if (sampler !== null) { clock.clearInterval(sampler); sampler = null; }
      S.level = 0;
      var arr = S.humSamples.slice().sort(function (a, b) { return a - b; });
      var med = arr.length >= 6 ? arr[Math.floor(arr.length / 2)] : 0;
      emit('hum', { midi: med, heard: arr.length >= 6 });
      done(med);
    }, CFG.HUM_MS);
  }

  // ---------------------------------------------------------------- 「怎么玩」教程

  /**
   * 第一次唱之前的教程：只练一句。每一步之前停下来（gate），前端讲这一步要做什么，
   * 玩家点了「好」（proceed）才往下走：
   *   listen  塞壬要唱了，看音块           → 塞壬唱
   *   turn    轮到你：嗒、嗒，麦克风变红开口 → 倒数、你唱、出档位
   *   quiet   没听到声音（最多两次）        → 塞壬再唱
   *   end     讲档位；再试一次 / 开始唱      → 结束（不计进度、不抽船）
   */
  function startGuide() {
    abortRun();
    S = blank();
    S.kind = 'guide';
    S.phraseCount = 1;
    var r = Progress.range();
    S.tonic = Practice.tonicFor(r && r.comfort ? r.comfort : 0);
    Audio.ensureAudio();
    Audio.seaStart();
    Audio.seaLevel(0.6, 0.4);
    setPhase('intro');
    sampleNoise(500);
    loadPhrase();   // 讲音块时就把这一句的音块摆出来
    later(function () { gate('listen', startListen); }, 600);
  }

  function gate(name, fn) {
    if (!S) return;
    S.waiting = name;
    S.gateFn = fn;
    emit('gate', { name: name });
  }

  /** 教程：玩家看完这一步的说明，点了「好」 */
  function proceed() {
    if (!S || !S.waiting || S.paused) return;
    var fn = S.gateFn;
    S.waiting = null;
    S.gateFn = null;
    fn();
  }

  /** 教程最后一步点「再试一次」：从塞壬唱这一句重来 */
  function guideAgain() {
    if (!S || S.kind !== 'guide' || S.waiting !== 'end' || S.paused) return;
    S.waiting = null;
    S.gateFn = null;
    S.quietRetries = 0;
    startListen();
  }

  function finishGuide() {
    if (!S) return;
    S.finished = { kind: 'guide' };
    setPhase('done');
    emit('finish', S.finished);
  }

  // ---------------------------------------------------------------- 暂停 / 继续 / 退出

  function pause() {
    if (!S || S.paused || S.phase === 'done' || S.phase === 'idle') return;
    token += 1;
    stopTimers();
    Audio.stopPlayback();
    Audio.seaLevel(0, 0.15);
    releaseMic();
    S.paused = true;
    S.pausedAt = clock.now();
    S.judge = null;
    S.level = 0;
    emit('pause', { phraseIdx: S.phraseIdx });
  }

  /**
   * 继续：⚠️ 要在点击里调用（会重新拿麦克风）。
   * 这一句已经判完（停在 result）→ 直接进入下一步；否则从这一句的「听她唱」重新开始。
   */
  function resume() {
    if (!S || !S.paused || S.resuming) return;
    var mine = S;
    S.resuming = true;
    var ready = mic.state === 'granted' && !micReady() ? requestMic() : Promise.resolve(true);
    ready.then(function () {
      if (S !== mine || !S.paused) {
        if (!S) releaseMic();   // 等麦克风时已经退出了：别把刚打开的麦克风留着
        return;
      }
      S.resuming = false;
      S.paused = false;
      Audio.ensureAudio();
      if (S.waiting) return;   // 教程停在说明上：继续等玩家点「好」
      if (S.next) {
        var n = S.next;
        S.next = null;
        n();
        return;
      }
      S.again = false;
      if (S.kind === 'practice') {
        var item = S.practice.current();
        if (!item) { finishPractice(); return; }
        if (item.kind === 'hum') { nextPracticeItem(); return; }
      }
      startListen();
    });
  }

  /** 重新开始这一首 / 这一组。⚠️ 要在点击里调用：暂停时麦克风已释放，这里重新拿 */
  function restart() {
    if (!S) return;
    var mine = S;
    var ready = mic.state === 'granted' && !micReady() ? requestMic() : Promise.resolve(true);
    ready.then(function () {
      if (S !== mine) {
        if (!S) releaseMic();
        return;
      }
      if (S.kind === 'song') startSong(S.song);
      else if (S.kind === 'practice') startPractice(S.exercise);
      else startGuide();
    });
  }

  /** 退出这一轮：停掉所有声音、定时器与采样（麦克风保留，离开唱歌界面时由前端 releaseMic） */
  function abortRun() {
    token += 1;
    stopTimers();
    Audio.stopPlayback();
    S = null;
  }

  function abort() {
    abortRun();
    Audio.seaLevel(0.6, 0.6);
  }

  // ---------------------------------------------------------------- 读状态

  function getState() {
    if (!S) return { kind: null, phase: 'idle' };
    var now = S.paused ? S.pausedAt : clock.now();   // 暂停时画面停住
    return {
      kind: S.kind,
      phase: S.phase,
      phaseT: now - S.phaseAt,
      paused: S.paused,
      songId: S.song ? S.song.id : null,
      exercise: S.exercise,
      phraseIdx: S.phraseIdx,
      phraseCount: S.phraseCount,
      tries: S.practice ? S.practice.tries() : 0,
      notes: S.notes,
      phraseMs: S.phraseMs,
      beatMs: S.beatMs,
      listenLeadMs: CFG.LISTEN_LEAD_S * 1000,
      countinLeadMs: CFG.COUNTIN_LEAD_MS,
      singT: now - S.t0,
      tiers: S.tiers,
      trace: S.trace,
      live: S.judge ? S.judge.live() : { k: 0, l: 0 },
      level: S.level,
      mic: micReady(),
      waiting: S.waiting,
      quietRetries: S.quietRetries,
      again: S.again,
      againReason: S.againReason,
      finished: S.finished,
      item: S.practice ? S.practice.current() : null
    };
  }

  function init() {
    return Store.init().then(function () {
      // 上次的授权结果（设置页显示用）；浏览器支持的话再问一下现在的真实状态
      var ok = Store.get(Store.KEYS.MIC_OK, null);
      if (mic.state === 'unknown' && ok !== null) mic.state = Store.getBool(Store.KEYS.MIC_OK, false) ? 'granted' : 'denied';
      Audio.setSfxMuted(Progress.sfxOff());
      // 音频环境被重建过（手机锁屏后有时只能这样恢复）：旧的麦克风接在旧环境上，放掉，下次唱时再拿
      Audio.onReset(function () { releaseMic(); });
      refreshMic();
      return true;
    });
  }

  Siren.Session = {
    init: init,
    on: on,
    off: off,
    requestMic: requestMic,
    releaseMic: releaseMic,
    refreshMic: refreshMic,
    micState: function () { return mic.state; },
    micPermission: function () { return mic.perm; },
    micOpen: function () { return !!mic.analyser; },
    startSong: startSong,
    startPractice: startPractice,
    startGuide: startGuide,
    proceed: proceed,
    guideAgain: guideAgain,
    pause: pause,
    resume: resume,
    restart: restart,
    abort: abort,
    getState: getState,
    CONFIG: CFG,
    /** 测试注入：虚拟时钟、假麦克风 */
    _setClock: function (c) { clock = c; },
    _setMicStub: function (fn) { micStub = fn; mic.state = fn ? 'granted' : 'unknown'; }
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
