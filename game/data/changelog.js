/* 塞壬的小把戏 —— 更新日志（设置 → 更新日志）
 * 只写玩家能感受到的变化，一条一句。新版本加在最前面。
 * 设置里只显示最新一版（小窗不能滚动，小屏上只放得下一版，每条尽量一行）。旧版本留在这里当记录。
 */
(function (global) {
  'use strict';
  var Siren = global.Siren = global.Siren || {};

  Siren.CHANGELOG = [
    {
      version: '2.1.0',
      date: { zh: '2026-10-23', en: 'Oct 23, 2026' },
      zh: [
        '新增 11 首歌',
        '新增 10 艘船',
        '新增「怎么玩」引导',
        '每句开唱前有提示音'
      ],
      en: [
        '11 new songs',
        '10 new ships',
        'A how-to-play guide',
        'Count-in beeps'
      ]
    },
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
