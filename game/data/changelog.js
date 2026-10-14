/* 塞壬的小把戏 —— 更新日志（设置 → 更新日志）
 * 只写玩家能感受到的变化，一条一句。新版本加在最前面。
 */
(function (global) {
  'use strict';
  var Siren = global.Siren = global.Siren || {};

  Siren.CHANGELOG = [
    {
      version: '2.0.0',
      date: { zh: '2026-10-13', en: 'Oct 13, 2026' },
      zh: [
        '游戏视觉更新',
        '曲库新增',
        '增加船只图鉴',
        '新增开嗓练习'
      ],
      en: [
        'A new look',
        'More songs',
        'Ship collection',
        'Warm-up practice'
      ]
    }
  ];
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
