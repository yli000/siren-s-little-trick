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
   * 抽一艘船：与唱得好坏、唱哪首歌都无关，每艘船的机会一样。
   * 为了让玩家把每艘船都见到：还有没见过的船时，只在没见过的里面抽（唱满和船一样多的歌就见齐）；
   * 见齐之后在全部里面抽，只是不和上一艘相同。
   * @param {string} songId  （不影响结果，保留参数以兼容调用方）
   * @param {Function} [rng] 0–1 随机数（测试可注入）
   * @returns {number} SHIPS 下标
   */
  function pickShip(songId, rng) {
    rng = rng || Math.random;
    var ships = Siren.SHIPS;
    var c = codex();
    var last = recent()[0];
    var unseen = [];
    var others = [];
    for (var i = 0; i < ships.length; i += 1) {
      if (!c[ships[i].key]) unseen.push(i);
      if (ships[i].key !== last) others.push(i);
    }
    var pool = unseen.length ? unseen : (others.length ? others : ships.map(function (_, k) { return k; }));
    return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
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

  /**
   * 定调用的音区：第 4 组测出的最高 / 最低优先；否则用第 1 组哼出的舒服音高
   * （舒服的音一般在自己音区偏下，往下留 4 个、往上留 8 个半音）。都没有返回 null。
   * 第一次玩时「哼一声试试」测到的音不算——那只是随便哼一下（§4：第 1、4 组）。
   */
  function keyRange() {
    var r = range();
    if (hasRange()) return r;
    if (r && r.fromFind && r.comfort > 0) return { lo: r.comfort - 4, hi: r.comfort + 8 };
    return null;
  }
  /** 唱歌会不会按玩家的调来（界面上的「按你的调」） */
  function keyKnown() { return !!keyRange() || Math.abs(prefShift()) >= 1; }

  /** 这首歌对这个玩家移几个半音 */
  function songShift(song) {
    return Siren.Music.fitShift(song, keyRange(), prefShift());
  }

  /**
   * 唱完一首后被动学习偏好调（审查第 11 条：没练过的人也受益）。
   * @param {number} usedShift  这首歌实际移了几个半音
   * @param {Array<number>} ks  各句估出的调偏移 K（玩家相对她唱高 / 低多少）
   */
  function learnShift(usedShift, ks) {
    if (keyRange() || !ks.length) return prefShift();
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
    [K.CODEX, K.RECENT, K.SONGS, K.LAST_SONG, K.PRACTICE, K.RANGE, K.PREF_SHIFT, K.LATENCY, K.ONBOARDED]
      .forEach(function (key) { Store.remove(key); });
  }

  Siren.Progress = {
    codex: codex, visits: visits, has: has, collectedCount: collectedCount, recent: recent, shipIndex: shipIndex,
    pickShip: pickShip, recordArrival: recordArrival,
    songById: songById, songInfo: songInfo, lastSong: lastSong, setLastSong: setLastSong, anySongPlayed: anySongPlayed,
    practiceDone: practiceDone, markPractice: markPractice,
    range: range, setRange: setRange, hasRange: hasRange, keyRange: keyRange, keyKnown: keyKnown, prefShift: prefShift, songShift: songShift, learnShift: learnShift,
    latency: latency, setLatency: setLatency,
    lang: lang, setLang: setLang, sfxOff: sfxOff, setSfxOff: setSfxOff, onboarded: onboarded, setOnboarded: setOnboarded,
    reset: reset
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
