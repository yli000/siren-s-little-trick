/* 塞壬的小把戏 —— 后端：music.js（简谱解析与移调）
 *
 * v2：歌曲与练习都用同一种简谱字符串描述，一句一个字符串。
 *
 *   记号    含义
 *   1–7     大调音级（do re mi fa sol la si）
 *   0       休止
 *   #  b    升 / 降半音，写在数字前：#5  b7
 *   '  ,    高 / 低八度，写在数字后，可叠加：1'  5,  6,,
 *   :n      时值，以八分音符为单位，可带小数；省略为 2（一拍）
 *
 *   例："5:3 6:1 5 4 3 4 5:4" = 伦敦桥第一句
 *
 * 本文件不触碰 document / window 渲染（D0 硬规则 1）。
 */

(function (global) {
  'use strict';

  var Siren = global.Siren = global.Siren || {};

  var MAJOR = [0, 2, 4, 5, 7, 9, 11];
  var TOKEN = /^([#b]?)([0-7])([',]*)(?::(\d+(?:\.\d+)?))?$/;

  /**
   * 解析一句简谱。
   * @param {string} src
   * @returns {Array<{rel:number|null, eighths:number}>} rel = 相对主音的半音数；休止为 null
   */
  function parsePhrase(src) {
    var out = [];
    var tokens = String(src).trim().split(/\s+/);
    for (var i = 0; i < tokens.length; i += 1) {
      var m = TOKEN.exec(tokens[i]);
      if (!m) throw new Error('无法解析的简谱记号：' + tokens[i] + '（在 "' + src + '"）');
      var eighths = m[4] ? Number(m[4]) : 2;
      if (m[2] === '0') { out.push({ rel: null, eighths: eighths }); continue; }
      var rel = MAJOR[Number(m[2]) - 1];
      if (m[1] === '#') rel += 1;
      if (m[1] === 'b') rel -= 1;
      for (var k = 0; k < m[3].length; k += 1) rel += m[3][k] === "'" ? 12 : -12;
      out.push({ rel: rel, eighths: eighths });
    }
    return out;
  }

  /**
   * 一句 → 目标音符（毫秒，从这一句第一个音开始计时）。
   * @param {string} src     简谱
   * @param {number} tonic   主音的 MIDI 号（已含移调）
   * @param {number} bpm     每分钟四分音符数
   * @returns {{notes:Array<{midi,startMs,durMs}>, durMs:number}}
   */
  function phraseNotes(src, tonic, bpm) {
    var eighthMs = 30000 / bpm;
    var parsed = parsePhrase(src);
    var notes = [];
    var cursor = 0;
    for (var i = 0; i < parsed.length; i += 1) {
      var d = parsed[i].eighths * eighthMs;
      if (parsed[i].rel !== null) notes.push({ midi: tonic + parsed[i].rel, startMs: cursor, durMs: d });
      cursor += d;
    }
    return { notes: notes, durMs: cursor };
  }

  /** 一首歌的音域（不含移调）：{ lo, hi }（MIDI） */
  function songRange(song) {
    var lo = Infinity;
    var hi = -Infinity;
    for (var i = 0; i < song.phrases.length; i += 1) {
      var p = parsePhrase(song.phrases[i]);
      for (var j = 0; j < p.length; j += 1) {
        if (p[j].rel === null) continue;
        lo = Math.min(lo, song.key + p[j].rel);
        hi = Math.max(hi, song.key + p[j].rel);
      }
    }
    return { lo: lo, hi: hi };
  }

  /**
   * 难度特征（供曲库排序与测试打印）。
   * span 音域跨度 / leap 最大跳进 / semis 半音步数 / longest 最长一句的音数 / notes 总音数
   */
  function songFeatures(song) {
    var r = songRange(song);
    var leap = 0;
    var semis = 0;
    var longest = 0;
    var total = 0;
    for (var i = 0; i < song.phrases.length; i += 1) {
      var p = parsePhrase(song.phrases[i]).filter(function (n) { return n.rel !== null; });
      longest = Math.max(longest, p.length);
      total += p.length;
      for (var j = 1; j < p.length; j += 1) {
        var step = Math.abs(p[j].rel - p[j - 1].rel);
        leap = Math.max(leap, step);
        if (step === 1) semis += 1;
      }
    }
    return { span: r.hi - r.lo, leap: leap, semis: semis, longest: longest, notes: total, phrases: song.phrases.length };
  }

  /**
   * 把一首歌移到玩家的音区。
   * @param {Object} song
   * @param {Object|null} range   { lo, hi } 玩家音区（海妖音域里的 MIDI），没有则 null
   * @param {number} pref        玩家偏好的整体移调（半音，唱歌时被动学到的），没有则 0
   * @returns {number} 移调半音数，限制在 ±6
   */
  function fitShift(song, range, pref) {
    var r = songRange(song);
    var s;
    if (range && isFinite(range.lo) && isFinite(range.hi) && range.hi > range.lo) {
      s = Math.round((range.lo + range.hi) / 2 - (r.lo + r.hi) / 2);
    } else {
      s = Math.round(pref || 0);
    }
    return Math.max(-6, Math.min(6, s));
  }

  /** 每拍毫秒 */
  function beatMs(bpm) { return 60000 / bpm; }

  Siren.Music = {
    parsePhrase: parsePhrase,
    phraseNotes: phraseNotes,
    songRange: songRange,
    songFeatures: songFeatures,
    fitShift: fitShift,
    beatMs: beatMs,
    MAJOR: MAJOR
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
