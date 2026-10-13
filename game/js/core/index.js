/* 塞壬的小把戏 —— 后端入口：index.js（v2）
 *
 * 前端只用这几个命名空间：
 *   Siren.Session   一首歌 / 一组练习 / 哼一声的流程（getState 每帧读 + 少量事件）
 *   Siren.Progress  图鉴、唱过的歌、练习、音区、设置
 *   Siren.Audio     界面音效、海浪、静音
 *   Siren.Music     简谱解析（画旋律走向缩略图用）
 *
 * 加载顺序（不可乱）：
 *   data/songs.js → data/ships.js → store → pitch → music → judge → audio → progress → practice → session → index
 */

(function (global) {
  'use strict';

  var Siren = global.Siren = global.Siren || {};

  if (!Siren.Session) {
    if (global.console && global.console.error) {
      global.console.error('[Siren] session.js 未加载，请检查 index.html 的脚本顺序');
    }
    return;
  }

  Siren.version = '2.0.0';

  // 只读的能力自检（供前端判断环境）
  Siren.capabilities = {
    audioContext: !!(global.AudioContext || global.webkitAudioContext),
    getUserMedia: !!(global.navigator && global.navigator.mediaDevices &&
      typeof global.navigator.mediaDevices.getUserMedia === 'function'),
    localStorage: Siren.Store ? Siren.Store.localStorageAvailable : false
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
