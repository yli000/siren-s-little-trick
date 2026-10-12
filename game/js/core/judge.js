/* 塞壬的小把戏 —— 后端：judge.js（v2 逐帧判定）
 *
 * 取代 v1 的「切音符 → 配对 → 四维打分」（segment.js + score.js）。
 * 依据：docs/04-v2-修改意见.md §3 与附录审查第 6、7 条。
 *
 * 思路（K 歌游戏的通行做法）：不切音符，**每一帧都拿玩家的音高去对这一刻该唱的目标音**。
 *   1. 有效帧：有音高，且电平高于静音门槛（底噪 × 1.8，且不高于本句峰值的 20%）
 *   2. 估整体偏移：时间偏移 L（−150～+300ms，25ms 一档穷举，只看什么时候在出声）；
 *      调偏移 K = 折八度后差值的众数，**判第 i 个音时不用它自己的帧**（留一法）：
 *      每个音算一票，再加上前几句定下的调（先验）。第一句还没有调时，第 0、1 个音借后一个音来定。
 *      否则 K 会跟着正在判的音走，随便哼一个音都是 Perfect（QA 实测：单音哼 18/26 Perfect）
 *   3. 一帧的得分：与目标音（加 K）的差折八度后 ≤ 50 音分记 1，≥ 120 音分记 0，中间线性
 *   4. 一个音的准确度 a：它的时间窗（平移 L，前 60ms 不算）里所有帧（含没出声的帧）的平均得分
 *   5. 档位：a ≥ .75 Perfect / ≥ .5 Great / ≥ .25 Good / 其余 Miss
 *   6. 一句的分数 = 已判各音 a 的平均 × 100（档位与分数同源）
 *
 * 为什么能修好 v1 的几个问题：
 *   · 滑音：只丢过渡的一两帧，不会多出"音符"
 *   · 颤音：大部分帧仍在 ±150 音分内，平均分仍高
 *   · 半音：没有"走向"维度，也就没有 Math.round(±0.5) 的不对称
 *   · 整体调 / 整体延迟：K、L 每次判音都参与，屏幕上的档位和分数用的是同一套补偿
 *
 * 实时：每个音在「结束 + L + 300ms」后判定并冻结，之后不再改（一首歌第一句的第 0、1 个音各晚一个音）。
 *
 * 本文件不触碰 document / window 渲染（D0 硬规则 1）；不返回任何中文文案（D7.4）。
 */

(function (global) {
  'use strict';

  var Siren = global.Siren = global.Siren || {};
  var Pitch = Siren.Pitch;

  var CFG = {
    FRAME_MS: 50,
    LAT_MIN_MS: -150,
    LAT_MAX_MS: 300,
    LAT_STEP_MS: 25,
    ONSET_GRACE_MS: 60,       // 每个音开头不计分的余量（起音、滑进来）
    CENTS_FULL: 50,           // ≤ 此值整帧满分
    CENTS_ZERO: 120,          // ≥ 此值整帧零分（差一个半音 ≈ Good，再远就不算）
    JUDGE_DELAY_MS: 300,      // 音结束后多久判定（等帧来估偏移）
    SILENCE_FACTOR: 1.8,      // 静音门槛 = 底噪 × 此值
    SILENCE_PEAK_RATIO: 0.2,  // 且不高于本句峰值的此比例（底噪估高时的兜底）
    SILENT_RATIO: 0.12,       // 一句里有声帧比例低于此值 → 视为"没出声"
    TIERS: [['perfect', 0.75], ['great', 0.5], ['good', 0.25]],
    TAP_TIERS: [['perfect', 100], ['great', 180], ['good', 300]],
    TAP_WINDOW_MS: 400,
    K_PRIOR_FIRST: 0.5,       // 一首歌第一句：调的先验只算半个音的票（几乎由你自己定）
    K_PRIOR_MIN: 1,           // 之后各句：上一句有 1 个音以上支持这个调 → 1 票，3 个以上 → 1.5 票
    K_PRIOR_MAX: 1.5          //   （一个音唱偏不会把调带跑；真换了调，两个音之后就跟上）
  };

  // ---------------------------------------------------------------- 小工具

  /** 半音差折到 [-6, 6) */
  function fold(semis) {
    var x = ((semis % 12) + 12) % 12;
    return x >= 6 ? x - 12 : x;
  }

  /** 折八度后的半音差 → 一帧的得分（0–1） */
  function credit(diffSemis) {
    var cents = Math.abs(fold(diffSemis)) * 100;
    if (cents <= CFG.CENTS_FULL) return 1;
    if (cents >= CFG.CENTS_ZERO) return 0;
    return 1 - (cents - CFG.CENTS_FULL) / (CFG.CENTS_ZERO - CFG.CENTS_FULL);
  }

  function tierOf(a) {
    for (var i = 0; i < CFG.TIERS.length; i += 1) if (a >= CFG.TIERS[i][1]) return CFG.TIERS[i][0];
    return 'miss';
  }

  function silenceLevel(noiseFloor, peak) {
    var s = noiseFloor > 0 ? noiseFloor * CFG.SILENCE_FACTOR : 0;
    if (peak > 0 && s > 0) s = Math.min(s, peak * CFG.SILENCE_PEAK_RATIO);
    return s;
  }

  function isVoiced(f, silence) {
    return f.hz > 0 && f.rms >= silence;
  }

  /** t 时刻（已减去 L）落在哪个目标音里；不在任何音里返回 -1 */
  function noteIndexAt(notes, t) {
    for (var i = 0; i < notes.length; i += 1) {
      var n = notes[i];
      if (t >= n.startMs && t < n.startMs + n.durMs) return i;
    }
    return -1;
  }

  // ---------------------------------------------------------------- 偏移估计

  /**
   * 估计整体时间偏移 L 与调偏移 K。
   * @param {Array} notes   目标音 [{midi, startMs, durMs}]
   * @param {Array} frames  帧 [{t, hz, midi, rms}]
   * @param {Object} o      { keyFree, kInit, kWeight, lInit, silence, upto, skip }
   *                        upto = 估 K 只用到第几个音（含）；skip = 估 K 时跳过的音（正在判的那个）；
   *                        kWeight = 先验 kInit 算几个音的票
   * @returns {{l:number, k:number, hits:number, voiced:number}}
   */
  function estimate(notes, frames, o) {
    var keyFree = o.keyFree !== false;
    var lInit = o.lInit || 0;
    var kInit = keyFree ? (o.kInit || 0) : 0;
    var kWeight = o.kWeight || 0;
    var upto = o.upto === undefined ? notes.length - 1 : o.upto;
    var skip = o.skip === undefined ? -1 : o.skip;
    var silence = o.silence || 0;

    // 第一步：时间偏移 L 只看"什么时候在出声"，不看音高。
    //   有声帧落在目标音里 +1，落在整句之外 −1；平手时偏向上一句的 L。
    //   ⚠️ 不能让 L 跟着音高去凑：唱错音时，L 会滑到能把别的音对上的位置，
    //      结果乱唱也能拿到一串 Perfect（实测 53 分）。
    var bestL = lInit;
    var bestAct = -Infinity;
    var voicedCount = 0;
    for (var L = CFG.LAT_MIN_MS; L <= CFG.LAT_MAX_MS; L += CFG.LAT_STEP_MS) {
      var act = 0;
      voicedCount = 0;
      for (var i = 0; i < frames.length; i += 1) {
        var f = frames[i];
        if (!isVoiced(f, silence)) continue;
        voicedCount += 1;
        act += noteIndexAt(notes, f.t - L) >= 0 ? 1 : -1;
      }
      act -= Math.abs(L - lInit) * 0.004;
      if (act > bestAct) { bestAct = act; bestL = L; }
    }
    if (!voicedCount) return { l: lInit, k: kInit, hits: 0, voiced: 0 };

    // 第二步：在这个 L 下估调偏移 K（练习要求对准时 K = 0）。
    //   每个音算一票（票平分给它的各帧），免得一个长音唱偏就把调带跑。
    var per = {};
    var order = [];
    for (var m = 0; m < frames.length; m += 1) {
      var g = frames[m];
      if (!isVoiced(g, silence)) continue;
      var tt = g.t - bestL;
      var ni = noteIndexAt(notes, tt);
      if (ni < 0 || ni > upto || ni === skip) continue;
      if (tt < notes[ni].startMs + CFG.ONSET_GRACE_MS) continue;
      if (!per[ni]) { per[ni] = []; order.push(ni); }
      per[ni].push(fold(g.midi - notes[ni].midi));
    }
    var diffs = [];
    var wts = [];
    for (var q = 0; q < order.length; q += 1) {
      var arr = per[order[q]];
      for (var r = 0; r < arr.length; r += 1) { diffs.push(arr[r]); wts.push(1 / arr.length); }
    }
    if (!diffs.length) return { l: bestL, k: kInit, hits: 0, voiced: voicedCount };
    var K = keyFree ? modeOf(diffs, wts, kInit, kWeight) : 0;
    var hits = 0;
    for (var j = 0; j < diffs.length; j += 1) hits += credit(diffs[j] - K);
    return { l: bestL, k: K, hits: hits, voiced: voicedCount };
  }

  /**
   * 折八度差值的加权"众数"：取让 ±0.5 半音内票数最多的中心，再在 ±0.75 内取加权平均细化。
   * prior（前几句定下的 K）算 weight 票；平手时偏向 prior。
   */
  function modeOf(diffs, wts, prior, weight) {
    var w = weight || 0;
    var bestC = prior;
    var bestN = -Infinity;
    var cands = diffs.concat([prior]);
    for (var i = 0; i < cands.length; i += 1) {
      var c = cands[i];
      var n = Math.abs(fold(prior - c)) <= 0.5 ? w : 0;
      for (var j = 0; j < diffs.length; j += 1) if (Math.abs(fold(diffs[j] - c)) <= 0.5) n += wts[j];
      n -= Math.abs(fold(c - prior)) * 0.001;
      if (n > bestN + 1e-9) { bestN = n; bestC = c; }
    }
    var dp = fold(prior - bestC);
    var sum = Math.abs(dp) <= 0.75 ? dp * w : 0;
    var cnt = Math.abs(dp) <= 0.75 ? w : 0;
    for (var k = 0; k < diffs.length; k += 1) {
      var d = fold(diffs[k] - bestC);
      if (Math.abs(d) <= 0.75) { sum += d * wts[k]; cnt += wts[k]; }
    }
    return fold(bestC + (cnt ? sum / cnt : 0));
  }

  /** 一个音的准确度 a（0–1）与它窗口里的帧数、有声帧数 */
  function noteAccuracy(note, frames, L, K, silence) {
    var from = note.startMs + L + CFG.ONSET_GRACE_MS;
    var to = note.startMs + note.durMs + L;
    if (to - from < CFG.FRAME_MS) from = to - CFG.FRAME_MS;   // 极短的音至少看一帧
    var sum = 0;
    var count = 0;
    var voiced = 0;
    for (var i = 0; i < frames.length; i += 1) {
      var f = frames[i];
      if (f.t < from || f.t >= to) continue;
      count += 1;
      if (!isVoiced(f, silence)) continue;
      voiced += 1;
      sum += credit(f.midi - (note.midi + K));
    }
    return { a: count ? sum / count : 0, frames: count, voiced: voiced };
  }

  // ---------------------------------------------------------------- 实时判定器

  /**
   * 创建一句的判定器。
   * @param {Array} notes  目标音（毫秒，0 = 第一个音该开口的时刻）
   * @param {Object} [opts] keyFree（默认 true）/ kInit / kWeight（先验算几个音的票，默认 0.5）/ lInit / noiseFloor
   */
  function create(notes, opts) {
    opts = opts || {};
    var frames = [];
    var judged = [];
    var peak = 0;
    var k0 = opts.keyFree === false ? 0 : (opts.kInit || 0);
    var kW = opts.kWeight === undefined ? CFG.K_PRIOR_FIRST : opts.kWeight;
    var k = k0;
    var l = opts.lInit || 0;
    var noise = opts.noiseFloor || 0;
    var keyFree = opts.keyFree !== false;
    var lastNote = notes[notes.length - 1];
    var spanFrom = notes.length ? notes[0].startMs - 150 : 0;
    var spanTo = lastNote ? lastNote.startMs + lastNote.durMs + 300 : 0;

    function silence() { return silenceLevel(noise, peak); }

    function voicedRatio() {
      var s = silence();
      var total = 0;
      var v = 0;
      for (var i = 0; i < frames.length; i += 1) {
        var f = frames[i];
        if (f.t < spanFrom || f.t > spanTo) continue;
        total += 1;
        if (isVoiced(f, s)) v += 1;
      }
      return total ? v / total : 0;
    }

    /**
     * 还没有可靠的调（一首歌的第一句）时，第 0、1 个音要借后一个音来定调；
     * 有了前几句的调，就只看前面的音 + 先验，判定不拖后。
     */
    function looksAhead(i) {
      return keyFree && kW < CFG.K_PRIOR_MIN && i <= 1 && i + 1 < notes.length;
    }
    function waitFor(i) { return looksAhead(i) ? i + 1 : i; }

    /** 有几个音支持调偏移 K（这个音过了起音余量的有声帧里，过半与 K 差 ≤ 半个半音） */
    function support(K) {
      var s = silence();
      var agree = {};
      var all = {};
      for (var i = 0; i < frames.length; i += 1) {
        var f = frames[i];
        if (!isVoiced(f, s)) continue;
        var tt = f.t - l;
        var ni = noteIndexAt(notes, tt);
        if (ni < 0 || tt < notes[ni].startMs + CFG.ONSET_GRACE_MS) continue;
        all[ni] = (all[ni] || 0) + 1;
        if (Math.abs(fold(f.midi - notes[ni].midi - K)) <= 0.5) agree[ni] = (agree[ni] || 0) + 1;
      }
      var n = 0;
      for (var key in all) if (Object.prototype.hasOwnProperty.call(all, key) && (agree[key] || 0) * 2 >= all[key]) n += 1;
      return n;
    }

    function judgeNext() {
      var i = judged.length;
      // 留一法：K 不用这个音自己的帧
      var ahead = looksAhead(i);
      var est = estimate(notes, frames, {
        keyFree: keyFree, kInit: k0, kWeight: kW, lInit: l, silence: silence(),
        upto: ahead ? i + 1 : i - 1,
        skip: ahead ? i : -1
      });
      if (est.voiced > 0) l = est.l;
      k = est.hits > 0 ? est.k : k0;
      var r = noteAccuracy(notes[i], frames, l, k, silence());
      var tier = tierOf(r.a);
      // 一个音一点声都没有、且这句到目前几乎都没出声 → 不给档位（「quiet」），
      // 免得怕唱的人一开口前就先收到一排 Miss（审查第 7 条）
      if (r.voiced === 0 && voicedRatio() < CFG.SILENT_RATIO) tier = 'quiet';
      var out = { index: i, a: r.a, tier: tier, midi: notes[i].midi };
      judged.push(out);
      return out;
    }

    return {
      /** 送入一帧：{ t(ms，相对第一个音), hz, rms } */
      push: function (f) {
        var fr = { t: f.t, hz: f.hz > 0 ? f.hz : 0, rms: f.rms || 0, midi: f.hz > 0 ? Pitch.hzToMidi(f.hz) : 0 };
        if (fr.rms > peak) peak = fr.rms;
        frames.push(fr);
        return fr;
      },
      /** 到 t 时刻为止，判定所有该判的音；返回新判出的结果 */
      poll: function (t) {
        var out = [];
        while (judged.length < notes.length) {
          var n = notes[waitFor(judged.length)];
          if (t < n.startMs + n.durMs + l + CFG.JUDGE_DELAY_MS) break;
          out.push(judgeNext());
        }
        return out;
      },
      /** 收尾：判完剩下的音，给出整句结果 */
      finish: function () {
        var newly = [];
        while (judged.length < notes.length) newly.push(judgeNext());
        var ratio = voicedRatio();
        var silent = ratio < CFG.SILENT_RATIO;
        var sum = 0;
        for (var i = 0; i < judged.length; i += 1) sum += judged[i].a;
        // 整句的调：所有音一起估；kSupport = 有多少帧支持它（下一句的先验权重据此定）
        var whole = estimate(notes, frames, { keyFree: keyFree, kInit: k0, kWeight: kW, lInit: l, silence: silence() });
        var kAll = whole.hits > 0 ? whole.k : k0;
        return {
          notes: judged.slice(),
          newly: newly,
          score: judged.length ? Math.round(100 * sum / judged.length) : 0,
          voicedRatio: ratio,
          silent: silent,
          peak: peak,
          k: kAll,
          kSupport: support(kAll),
          l: l
        };
      },
      /** 当前的整体偏移（画音高线用：先减 K 再画，见审查第 6 条） */
      live: function () { return { k: k, l: l }; },
      /** 这一帧有没有被当成有声 */
      voiced: function (f) { return isVoiced(f, silence()); },
      setNoiseFloor: function (v) { noise = v || 0; },
      judged: function () { return judged.slice(); },
      frames: function () { return frames; }
    };
  }

  // ---------------------------------------------------------------- 点按兜底（没有麦克风时）

  /**
   * 点按模式：每点一下对一个音，只看时间。
   * @param {Array} notes
   * @param {number} lInit 预期的整体延迟（触屏延迟）
   */
  function createTap(notes, lInit) {
    var taps = [];
    var judged = [];
    var l = lInit || 0;
    function judgeAt(i, tap) {
      var n = notes[i];
      var tier = 'miss';
      var a = 0;
      if (tap !== null) {
        var dt = Math.abs(tap - (n.startMs + l));
        for (var j = 0; j < CFG.TAP_TIERS.length; j += 1) {
          if (dt <= CFG.TAP_TIERS[j][1]) { tier = CFG.TAP_TIERS[j][0]; break; }
        }
        a = tier === 'perfect' ? 1 : tier === 'great' ? 0.66 : tier === 'good' ? 0.33 : 0;
      } else if (!taps.length) {
        tier = 'quiet';
      }
      var out = { index: i, a: a, tier: tier, midi: n.midi };
      judged.push(out);
      return out;
    }
    return {
      tap: function (t) {
        taps.push(t);
        var i = judged.length;
        if (i >= notes.length) return null;
        if (Math.abs(t - (notes[i].startMs + l)) <= CFG.TAP_WINDOW_MS) return judgeAt(i, t);
        return null;
      },
      poll: function (t) {
        var out = [];
        while (judged.length < notes.length && t > notes[judged.length].startMs + l + CFG.TAP_WINDOW_MS) {
          out.push(judgeAt(judged.length, null));
        }
        return out;
      },
      finish: function () {
        var newly = [];
        while (judged.length < notes.length) newly.push(judgeAt(judged.length, null));
        var sum = 0;
        for (var i = 0; i < judged.length; i += 1) sum += judged[i].a;
        return { notes: judged.slice(), newly: newly, score: Math.round(100 * sum / Math.max(1, judged.length)), voicedRatio: taps.length ? 1 : 0, silent: !taps.length, peak: 0, k: 0, l: l };
      },
      live: function () { return { k: 0, l: l }; },
      judged: function () { return judged.slice(); }
    };
  }

  function config() { return JSON.parse(JSON.stringify(CFG)); }

  /** 由上一句的 kSupport（支持这个调的音数）算下一句调先验的权重 */
  function priorWeight(kSupport) {
    if (kSupport >= 3) return CFG.K_PRIOR_MAX;
    if (kSupport >= 1) return CFG.K_PRIOR_MIN;
    return CFG.K_PRIOR_FIRST;
  }

  Siren.Judge = {
    create: create,
    createTap: createTap,
    estimate: estimate,
    noteAccuracy: noteAccuracy,
    tierOf: tierOf,
    credit: credit,
    fold: fold,
    silenceLevel: silenceLevel,
    priorWeight: priorWeight,
    config: config
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
