/* 塞壬的小把戏 —— 后端：practice.js（v2 练习：出题、自适应、测音区）
 *
 * 依据：docs/04-v2-修改意见.md §4 与附录审查第 2、11、18 条。
 *
 * 五组练习，每组对准一个"为什么过不去"：
 *   find    找到第一个音   先随便哼一个舒服的音；她唱一个长音，你哼同一个（要对准，只允许差整八度）
 *   steps   一步一步走     级进
 *   leaps   跳过去         跳进，逐级拉宽（音程唱小）
 *   ladder  爬梯子         同一个音型升 1、3、5 再降 2、4 个半音；往上第一次唱不好就转去往下
 *   memory  记更长         3 → 5 → 7 个音
 *
 * 规则：一步的分数 ≥ 60 进入下一步；否则再来一遍，**最多 3 遍，第 3 遍后直接放行**（练习不卡人）。
 * 爬梯子每一级只唱一遍。不给玩家看任何分数或音域数字。
 *
 * 本文件不触碰 document / window 渲染（D0 硬规则 1）。
 */

(function (global) {
  'use strict';

  var Siren = global.Siren = global.Siren || {};

  var PASS = 60;
  var LADDER_PASS = 50;
  var MAX_TRIES = 3;
  var SIREN_LO = 57;   // 她唱的音区：长音放在 A3 起的这一个八度里，练习主音再低 2 个半音

  var EXERCISES = [
    { id: 'find', learnsRange: true },
    { id: 'steps' },
    { id: 'leaps' },
    { id: 'ladder', learnsRange: true },
    { id: 'memory' }
  ];

  /** 把任意 MIDI 折进 [lo, lo + 12) 这个八度里 */
  function foldInto(midi, lo) {
    return lo + ((((midi - lo) % 12) + 12) % 12);
  }

  /** 练习的主音：有舒服音高就以它为中心，没有就用 C4 */
  function tonicFor(comfort) {
    if (!(comfort > 0)) return 60;
    return Math.round(foldInto(comfort - 2, SIREN_LO - 2));
  }

  /**
   * 生成一组练习的题目序列。
   * @returns {Array<{kind:'hum'|'phrase', src?, tonic?, bpm?, keyFree?, rung?}>}
   */
  function itemsFor(id, comfort) {
    var T = tonicFor(comfort);
    switch (id) {
      case 'find': {
        var c = comfort > 0 ? Math.round(foldInto(comfort, SIREN_LO)) : 62;
        return [
          { kind: 'hum' },
          { kind: 'phrase', src: '1:6', tonic: c, bpm: 90, keyFree: false, rel: 0 },
          { kind: 'phrase', src: '1:6', tonic: c + 2, bpm: 90, keyFree: false, rel: 2 },
          { kind: 'phrase', src: '1:6', tonic: c - 3, bpm: 90, keyFree: false, rel: -3 }
        ];
      }
      case 'steps':
        return [
          { kind: 'phrase', src: '1 2 1:4', tonic: T, bpm: 96, keyFree: true },
          { kind: 'phrase', src: '1 2 3 2 1:4', tonic: T, bpm: 96, keyFree: true },
          { kind: 'phrase', src: '1:1 2:1 3:1 4:1 5:2 4:1 3:1 2:1 1:1 1:4', tonic: T, bpm: 96, keyFree: true }
        ];
      case 'leaps':
        return [
          { kind: 'phrase', src: '1 3 1:4', tonic: T, bpm: 90, keyFree: true },
          { kind: 'phrase', src: '1 5 1:4', tonic: T, bpm: 90, keyFree: true },
          { kind: 'phrase', src: "1 1' 1:4", tonic: T, bpm: 90, keyFree: true }
        ];
      case 'ladder':
        return [1, 3, 5, -2, -4].map(function (off) {
          return { kind: 'phrase', src: '1 2 3 2 1:4', tonic: T + off, bpm: 100, keyFree: false, rung: off };
        });
      case 'memory':
        return [
          { kind: 'phrase', src: '1 3 2:4', tonic: T, bpm: 96, keyFree: true },
          { kind: 'phrase', src: '1 2 3 5 3:4', tonic: T, bpm: 96, keyFree: true },
          { kind: 'phrase', src: '1 2 3 1 3 4 5:4', tonic: T, bpm: 104, keyFree: true }
        ];
      default:
        throw new Error('没有这组练习：' + id);
    }
  }

  /**
   * 一组练习的推进器（纯逻辑，不计时、不发声，由 session.js 驱动）。
   * @param {string} id
   * @param {number} comfort  已知的舒服音高（MIDI），没有则 0
   */
  function create(id, comfort) {
    var items = itemsFor(id, comfort);
    var idx = 0;
    var tries = 0;
    var ladderUpFailed = false;
    var ladderHi = null;
    var ladderLo = null;
    var learned = { comfort: comfort > 0 ? comfort : 0 };
    var T = tonicFor(comfort);

    function skipFailedUpRungs() {
      while (idx < items.length && items[idx].rung > 0 && ladderUpFailed) idx += 1;
    }

    return {
      id: id,
      total: function () { return items.length; },
      index: function () { return idx; },
      current: function () { return idx < items.length ? items[idx] : null; },
      tries: function () { return tries; },
      done: function () { return idx >= items.length; },
      /** 哼一声测到了舒服音高：重新出题（后面的长音以它为准） */
      setComfort: function (midi) {
        if (!(midi > 0)) return;
        learned.comfort = midi;
        var rest = itemsFor(id, midi);
        items = items.slice(0, idx + 1).concat(rest.slice(idx + 1));
        T = tonicFor(midi);
      },
      /**
       * 报告一遍的结果。
       * @param {{score:number, silent:boolean}} r
       * @returns {'retry'|'next'|'done'}
       */
      report: function (r) {
        var item = items[idx];
        if (!item) return 'done';
        if (item.kind === 'hum') {
          idx += 1;
          tries = 0;
          return idx >= items.length ? 'done' : 'next';
        }
        if (id === 'ladder') {
          var ok = !r.silent && r.score >= LADDER_PASS;
          if (item.rung > 0) {
            if (ok) ladderHi = Math.max(ladderHi === null ? -Infinity : ladderHi, item.rung);
            else ladderUpFailed = true;
          } else if (ok) {
            ladderLo = Math.min(ladderLo === null ? Infinity : ladderLo, item.rung);
          }
          idx += 1;
          skipFailedUpRungs();
          tries = 0;
          return idx >= items.length ? 'done' : 'next';
        }
        tries += 1;
        if (r.score >= PASS || tries >= MAX_TRIES) {
          idx += 1;
          tries = 0;
          return idx >= items.length ? 'done' : 'next';
        }
        return 'retry';
      },
      /** 练完后要存下来的音区信息（不是每组都有） */
      learned: function () {
        var out = {};
        if (learned.comfort > 0) out.comfort = learned.comfort;
        if (id === 'ladder') {
          // 音型最高是 3（主音上 4 个半音）
          out.hi = T + 4 + (ladderHi === null ? 0 : ladderHi);
          out.lo = T + (ladderLo === null ? 0 : ladderLo);
        }
        return out;
      }
    };
  }

  Siren.Practice = {
    EXERCISES: EXERCISES,
    create: create,
    itemsFor: itemsFor,
    tonicFor: tonicFor,
    foldInto: foldInto,
    PASS: PASS,
    MAX_TRIES: MAX_TRIES
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
