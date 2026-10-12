/* 塞壬的小把戏 —— 后端：progress.js（v2 进度：图鉴、唱过的歌、练习、音区、抽船）
 *
 * 依据：docs/04-v2-修改意见.md §1.3 / §1.5 / §4 与附录审查第 9、11、15 条。
 * 全部数据走 Store（内存缓存 + 异步写穿），读写都是同步的。
 *
 * 本文件不触碰 document / window 渲染（D0 硬规则 1）。
 */

(function (global) {
  'use strict';

  var Siren = global.Siren = global.Siren || {};
  var Store = Siren.Store;
  var K = Store.KEYS;

  var REGULAR_BONUS = 3;   // 这首歌的常客船
  var UNSEEN_BONUS = 3;    // 没见过的船
  var PITY_AFTER = 2;      // 连续来了几艘见过的船之后，下一艘必是新船

  // ---------------------------------------------------------------- 图鉴

  function codex() { return Store.getJSON(K.CODEX, {}); }
  function visits(key) { return codex()[key] || 0; }
  function has(key) { return visits(key) > 0; }
  function collectedCount() {
    var c = codex();
    var n = 0;
    for (var i = 0; i < Siren.SHIPS.length; i += 1) if (c[Siren.SHIPS[i].key]) n += 1;
    return n;
  }
  function recent() { return Store.getJSON(K.RECENT, []); }

  function shipIndex(key) {
    for (var i = 0; i < Siren.SHIPS.length; i += 1) if (Siren.SHIPS[i].key === key) return i;
    return -1;
  }

  /**
   * 抽一艘船（与唱得好坏无关）。
   * 稀有度权重同档平分；没见过的 ×3；这首歌的常客 ×3；
   * 连续 PITY_AFTER 艘见过的船之后，只在没见过的船里抽（还有的话）。
   * @param {string} songId
   * @param {Function} [rng] 0–1 随机数（测试可注入）
   * @returns {number} SHIPS 下标
   */
  function pickShip(songId, rng) {
    rng = rng || Math.random;
    var ships = Siren.SHIPS;
    var c = codex();
    var song = songById(songId);
    var regular = song ? song.regular : null;
    var perRarity = {};
    for (var i = 0; i < ships.length; i += 1) perRarity[ships[i].rarity] = (perRarity[ships[i].rarity] || 0) + 1;

    var anyNew = false;
    for (var j = 0; j < ships.length; j += 1) if (!c[ships[j].key]) anyNew = true;
    var onlyNew = anyNew && Store.getNumber(K.DUPES, 0) >= PITY_AFTER;

    var pool = [];
    var total = 0;
    for (var k = 0; k < ships.length; k += 1) {
      var s = ships[k];
      if (onlyNew && c[s.key]) continue;
      var w = Siren.RARITY[s.rarity].weight / perRarity[s.rarity];
      if (!c[s.key]) w *= UNSEEN_BONUS;
      if (s.key === regular) w *= REGULAR_BONUS;
      pool.push([k, w]);
      total += w;
    }
    var r = rng() * total;
    for (var m = 0; m < pool.length; m += 1) {
      r -= pool[m][1];
      if (r <= 0) return pool[m][0];
    }
    return pool[pool.length - 1][0];
  }

  /**
   * 一首歌唱完：立刻记下来的船（审查第 15 条：唱完那一刻就存档，动画只是播放）。
   * @returns {{index:number, isNew:boolean, visits:number}}
   */
  function recordArrival(songId, shipIdx) {
    var key = Siren.SHIPS[shipIdx].key;
    var c = codex();
    var isNew = !c[key];
    c[key] = (c[key] || 0) + 1;
    Store.setJSON(K.CODEX, c);

    var rec = recent().filter(function (k) { return k !== key; });
    rec.unshift(key);
    Store.setJSON(K.RECENT, rec.slice(0, 3));
    Store.set(K.DUPES, isNew ? 0 : Store.getNumber(K.DUPES, 0) + 1);

    var songs = Store.getJSON(K.SONGS, {});
    var info = songs[songId] || { plays: 0, lastShip: null };
    info.plays += 1;
    info.lastShip = key;
    songs[songId] = info;
    Store.setJSON(K.SONGS, songs);
    return { index: shipIdx, isNew: isNew, visits: c[key] };
  }

  // ---------------------------------------------------------------- 歌

  function songById(id) {
    var list = Siren.SONGS || [];
    for (var i = 0; i < list.length; i += 1) if (list[i].id === id) return list[i];
    return null;
  }
  function songInfo(id) { return Store.getJSON(K.SONGS, {})[id] || { plays: 0, lastShip: null }; }
  function lastSong() { return Store.get(K.LAST_SONG, null); }
  function setLastSong(id) { Store.set(K.LAST_SONG, id); }
  function anySongPlayed() {
    var s = Store.getJSON(K.SONGS, {});
    for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k) && s[k].plays > 0) return true;
    return false;
  }

  // ---------------------------------------------------------------- 练习与音区

  function practiceDone(id) { return !!Store.getJSON(K.PRACTICE, {})[id]; }
  function markPractice(id) {
    var p = Store.getJSON(K.PRACTICE, {});
    p[id] = true;
    Store.setJSON(K.PRACTICE, p);
  }
  function range() { return Store.getJSON(K.RANGE, null); }
  function setRange(patch) {
    var r = range() || {};
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) r[k] = patch[k];
    Store.setJSON(K.RANGE, r);
    return r;
  }
  /** 有没有一个可用于定调的音区（练过第 4 组「爬梯子」） */
  function hasRange() {
    var r = range();
    return !!(r && isFinite(r.lo) && isFinite(r.hi) && r.hi > r.lo);
  }
  function prefShift() { return Store.getNumber(K.PREF_SHIFT, 0); }

  /** 这首歌对这个玩家移几个半音 */
  function songShift(song) {
    var r = range();
    return Siren.Music.fitShift(song, hasRange() ? r : null, prefShift());
  }

  /**
   * 唱完一首后被动学习偏好调（审查第 11 条：没练过的人也受益）。
   * @param {number} usedShift  这首歌实际移了几个半音
   * @param {Array<number>} ks  各句估出的调偏移 K（玩家相对她唱高 / 低多少）
   */
  function learnShift(usedShift, ks) {
    if (hasRange() || !ks.length) return prefShift();
    var sorted = ks.slice().sort(function (a, b) { return a - b; });
    var med = sorted[Math.floor(sorted.length / 2)];
    if (Math.abs(med) < 1) return prefShift();
    var next = 0.7 * prefShift() + 0.3 * (usedShift + med);
    next = Math.max(-6, Math.min(6, next));
    Store.set(K.PREF_SHIFT, next.toFixed(2));
    return next;
  }

  function latency() { return Store.getNumber(K.LATENCY, 0); }
  function setLatency(ms) { Store.set(K.LATENCY, Math.round(ms)); }

  // ---------------------------------------------------------------- 设置

  function lang() {
    var v = Store.get(K.LANG, null);
    if (v === 'zh' || v === 'en') return v;
    var nav = global.navigator && (global.navigator.language || global.navigator.userLanguage) || 'zh';
    return /^zh/i.test(nav) ? 'zh' : 'en';
  }
  function setLang(v) { Store.set(K.LANG, v === 'en' ? 'en' : 'zh'); }
  function sfxOff() { return Store.getBool(K.SFX_OFF, false); }
  function setSfxOff(v) { Store.setBool(K.SFX_OFF, v); }
  function onboarded() { return Store.getBool(K.ONBOARDED, false); }
  function setOnboarded() { Store.setBool(K.ONBOARDED, true); }

  /** 清除进度：图鉴、唱过的歌、练习、音区；保留语言与声音设置 */
  function reset() {
    [K.CODEX, K.RECENT, K.DUPES, K.SONGS, K.LAST_SONG, K.PRACTICE, K.RANGE, K.PREF_SHIFT, K.LATENCY, K.ONBOARDED]
      .forEach(function (key) { Store.remove(key); });
  }

  Siren.Progress = {
    codex: codex, visits: visits, has: has, collectedCount: collectedCount, recent: recent, shipIndex: shipIndex,
    pickShip: pickShip, recordArrival: recordArrival,
    songById: songById, songInfo: songInfo, lastSong: lastSong, setLastSong: setLastSong, anySongPlayed: anySongPlayed,
    practiceDone: practiceDone, markPractice: markPractice,
    range: range, setRange: setRange, hasRange: hasRange, prefShift: prefShift, songShift: songShift, learnShift: learnShift,
    latency: latency, setLatency: setLatency,
    lang: lang, setLang: setLang, sfxOff: sfxOff, setSfxOff: setSfxOff, onboarded: onboarded, setOnboarded: setOnboarded,
    reset: reset,
    PITY_AFTER: PITY_AFTER
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
