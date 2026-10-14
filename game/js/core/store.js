/* 塞壬的小把戏 —— 后端：store.js（本地存储）
 *
 * 依据：
 *   · 02-后端开发规格书 D1「存储：localStorage，键名前缀 siren.」
 *   · 小工具能力清单 §3.7：**推荐用 `window.xhs.miniTool.setStorage`**，
 *     并明确「不要把浏览器自带存储当作可靠的持久化方案」
 *   · PRD §7.5.1.3-C：改用 setStorage，低版本降级回 localStorage
 *
 * ⚠️ 本模块的核心设计难点：**异步持久层 + 同步读数**。
 *    `miniTool.setStorage / getStorage` 都是 Promise 的，而 `Store.get()` 被前端
 *    与 session.js 同步调用（无法改成 async，否则要动契约与前端代码）。
 *    解法：**内存缓存为主 + 异步写穿（write-through）**
 *      · 读：永远读内存缓存，同步、零延迟 → 调用方完全不用改
 *      · 写：同步更新缓存（立刻可读），再后台异步落盘到 miniTool
 *      · 启动：`init()` 异步把持久层的数据灌进缓存（一次性）
 *    没调 `init()` 也能工作——只是拿不到上次的数据，不会崩。
 *
 * 降级链：miniTool.setStorage（客户端 ≥ 9.46.0）→ localStorage → 纯内存
 *
 * 本文件不触碰 document / window 渲染（D0 硬规则 1）；localStorage 是 D0 明确豁免项。
 */

(function (global) {
  'use strict';

  var Siren = global.Siren = global.Siren || {};

  var PREFIX = 'siren.';

  /**
   * v2 键表。⚠️ init / clearAll 只认这张表里的键：新增存储项必须先登记在这里。
   * v1 的键（best.wrecked / plays / seed / tutorialDone …）随玩法一起废止，不再读写。
   */
  var KEYS = {
    LANG: PREFIX + 'lang',                 // 'zh' | 'en'（没选过就跟随系统）
    SFX_OFF: PREFIX + 'sfxOff',            // 音效与海浪关闭（她的歌声不受影响）
    MIC_OK: PREFIX + 'mic.ok',             // 上次麦克风是否可用（'1' / '0'）
    ONBOARDED: PREFIX + 'onboarded',       // 是否已「哼一声试试」
    CODEX: PREFIX + 'codex',               // JSON { shipKey: 来访次数 }
    RECENT: PREFIX + 'recent',             // JSON [最近来过的船 key]，最多 3 个
    SONGS: PREFIX + 'songs',               // JSON { songId: { plays, lastShip } }
    LAST_SONG: PREFIX + 'lastSong',        // 上次唱的歌
    PRACTICE: PREFIX + 'practice',         // JSON { exerciseId: true }
    RANGE: PREFIX + 'range',               // JSON { comfort, lo, hi }（海妖音域里的 MIDI）
    PREF_SHIFT: PREFIX + 'prefShift',      // 唱歌时被动学到的偏好移调（半音）
    LATENCY: PREFIX + 'latency'            // 上次估出的整体延迟（ms）
  };

  /** Storage JS API 所需的最低客户端版本（官方文档 §3.7：客户端 9.46.0） */
  var STORAGE_MIN_CLIENT_VERSION = 9460;

  // ---------------------------------------------------------------- 可用性探测

  /** localStorage 是否真的可用（Safari 隐私模式下 getItem 就会抛） */
  var lsAvailable = (function () {
    try {
      var probe = PREFIX + '__probe';
      global.localStorage.setItem(probe, '1');
      var ok = global.localStorage.getItem(probe) === '1';
      global.localStorage.removeItem(probe);
      return ok;
    } catch (e) {
      return false;
    }
  })();

  /** 容器是否注入了端能力（普通浏览器里为 undefined） */
  function miniTool() {
    var xhs = global.xhs;
    return (xhs && xhs.miniTool) ? xhs.miniTool : null;
  }

  /**
   * 读客户端 buildVersion。
   * 官方文档 §3.6：末 3 位是编译序号必须忽略；同步值可能缺失，需逐级判空。
   */
  function readBuildVersion() {
    var xhs = global.xhs;
    var env = xhs && xhs.launchOptions && xhs.launchOptions.miniToolEnv;
    return Number(env && env.buildVersion) || 0;
  }

  function clientVersionAtLeast(min) {
    var bv = readBuildVersion();
    if (!bv) return false;
    return Math.floor(bv / 1000) >= min;
  }

  // ---------------------------------------------------------------- 内存缓存

  var cache = {};          // 全部读写都走它，同步
  var backend = 'memory';  // 'miniTool' | 'localStorage' | 'memory'（诊断用）
  var ready = false;       // init() 是否已完成

  /** 从 localStorage 灌入缓存（同步，作为基线） */
  function loadFromLocalStorage() {
    if (!lsAvailable) return;
    try {
      for (var k in KEYS) {
        if (!Object.prototype.hasOwnProperty.call(KEYS, k)) continue;
        var v = global.localStorage.getItem(KEYS[k]);
        if (v !== null) cache[KEYS[k]] = v;
      }
    } catch (e) { /* 忽略 */ }
  }

  /** 写穿到 localStorage（同步，作为二级降级） */
  function writeToLocalStorage(key, value) {
    if (!lsAvailable) return;
    try { global.localStorage.setItem(key, value); } catch (e) { /* 配额满/被禁 */ }
  }

  /** 写穿到 miniTool（异步，失败不抛，只记诊断计数） */
  var persistFailures = 0;
  function writeToMiniTool(key, value) {
    var mt = miniTool();
    if (!mt || typeof mt.setStorage !== 'function') return;
    if (!clientVersionAtLeast(STORAGE_MIN_CLIENT_VERSION)) return;
    try {
      var p = mt.setStorage({ key: key, data: value });
      if (p && typeof p.catch === 'function') {
        p.catch(function () { persistFailures += 1; });
      }
    } catch (e) {
      persistFailures += 1;
    }
  }

  /**
   * 异步初始化：把持久层的数据灌进缓存。
   *
   * 必须在读任何业务数据之前调用一次（`session.js` 的 `init()` 里已 await）。
   * 未调用也能工作，但拿不到上次的数据——所以**不能省**。
   *
   * @returns {Promise<string>} 实际生效的后端名，便于诊断
   */
  function init() {
    if (ready) return Promise.resolve(backend);
    loadFromLocalStorage();   // 先拿 localStorage 作为基线

    var mt = miniTool();
    var canUseMt = mt && typeof mt.getStorage === 'function' &&
      clientVersionAtLeast(STORAGE_MIN_CLIENT_VERSION);

    if (!canUseMt) {
      backend = lsAvailable ? 'localStorage' : 'memory';
      ready = true;
      return Promise.resolve(backend);
    }

    backend = 'miniTool';
    var keys = [];
    for (var k in KEYS) {
      if (Object.prototype.hasOwnProperty.call(KEYS, k)) keys.push(KEYS[k]);
    }

    return Promise.all(keys.map(function (key) {
      return mt.getStorage({ key: key }).then(function (res) {
        // 官方：返回 { data }；data 可能是任意可 JSON 序列化值
        if (res && res.data !== undefined && res.data !== null) {
          cache[key] = String(res.data);
        }
      }).catch(function () { /* 该键不存在或读取失败，保留 localStorage 的值 */ });
    })).then(function () {
      ready = true;
      return backend;
    }).catch(function () {
      backend = lsAvailable ? 'localStorage' : 'memory';
      ready = true;
      return backend;
    });
  }

  // ---------------------------------------------------------------- 同步 API

  function get(key, fallback) {
    if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
    return fallback;
  }

  function set(key, value) {
    var s = String(value);
    cache[key] = s;                     // ① 同步生效，立刻可读
    writeToLocalStorage(key, s);        // ② 降级层同步写
    writeToMiniTool(key, s);            // ③ 首选层异步写穿（不阻塞）
    return true;
  }

  function getNumber(key, fallback) {
    var raw = get(key, null);
    if (raw === null) return fallback;
    var n = Number(raw);
    return isFinite(n) ? n : fallback;
  }

  function getBool(key, fallback) {
    var raw = get(key, null);
    if (raw === null) return fallback;
    return raw === '1' || raw === 'true';
  }

  function setBool(key, value) {
    return set(key, value ? '1' : '0');
  }

  function remove(key) {
    delete cache[key];
    if (lsAvailable) {
      try { global.localStorage.removeItem(key); } catch (e) { /* 忽略 */ }
    }
    var mt = miniTool();
    if (mt && typeof mt.removeStorage === 'function' &&
        clientVersionAtLeast(STORAGE_MIN_CLIENT_VERSION)) {
      try {
        var p = mt.removeStorage({ key: key });
        if (p && typeof p.catch === 'function') p.catch(function () { persistFailures += 1; });
      } catch (e) { persistFailures += 1; }
    }
  }

  function clearAll() {
    for (var k in KEYS) {
      if (Object.prototype.hasOwnProperty.call(KEYS, k)) remove(KEYS[k]);
    }
  }

  /** JSON 读写（坏数据当作没有） */
  function getJSON(key, fallback) {
    var raw = get(key, null);
    if (raw === null) return fallback;
    try { var v = JSON.parse(raw); return v === null || v === undefined ? fallback : v; } catch (e) { return fallback; }
  }

  function setJSON(key, value) {
    return set(key, JSON.stringify(value));
  }

  /**
   * 是否"至少有一个能存的层"。
   * ⚠️ 语义变化：以前表示 localStorage 可用；现在内存缓存恒可用，
   *    所以**恒为 true**。保留这个名字是为了不破坏已有调用点；
   *    想知道真实后端请用 `backend()`。
   */
  var available = true;

  Siren.Store = {
    KEYS: KEYS,
    init: init,
    available: available,
    backend: function () { return backend; },
    ready: function () { return ready; },
    persistFailures: function () { return persistFailures; },
    localStorageAvailable: lsAvailable,
    miniToolAvailable: function () { return !!miniTool(); },
    clientVersion: function () { return readBuildVersion(); },
    get: get,
    set: set,
    getNumber: getNumber,
    getBool: getBool,
    setBool: setBool,
    remove: remove,
    clearAll: clearAll,
    getJSON: getJSON,
    setJSON: setJSON,
    _resetForTest: function () { cache = {}; ready = false; persistFailures = 0; }
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
