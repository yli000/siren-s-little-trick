/* 塞壬的小把戏 —— 更新日志（设置 → 更新日志）
 * 只写玩家能感受到的变化，一条一句。新版本加在最前面。
 * 设置里一次显示一版，用版本下拉框切换（小窗不能滚动，这样版本再多高度也不变）。每条尽量一行。
 * { text, web: true } 的条目只在网页版显示（比如「添加到手机桌面」，小红书里用不到）。
 */
(function (global) {
  'use strict';
  var Siren = global.Siren = global.Siren || {};

  Siren.CHANGELOG = [
    {
      version: '2.1.0',
      date: { zh: '2026-10-23', en: '2026-10-23' },
      zh: [
        '新增曲库',
        '新增船只',
        '新增玩法引导',
        { text: '可以添加到手机桌面', web: true }
      ],
      en: [
        'More songs',
        'More ships',
        'How-to-play guide',
        { text: 'Add to home screen', web: true }
      ]
    },
    {
      version: '2.0.0',
      date: { zh: '2026-10-13', en: '2026-10-13' },
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
