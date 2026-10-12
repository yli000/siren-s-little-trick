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
        '海面换成了像素画，竖着拿手机就能玩',
        '20 首歌，挑一首唱给她听',
        '每唱完一首，会有一艘船循着歌声开过来；21 艘船等你收进图鉴',
        '新增练习：跟她练几组音，她会记住你唱得舒服的音区',
        '颤音、滑音、用自己的调唱，她都听得懂了',
        '可以暂停了；声音和语言（English）在设置里'
      ],
      en: [
        'The sea is pixel art now. Hold your phone upright and play',
        '20 songs. Pick one and sing it back to her',
        'Finish a song and a ship follows your voice in. 21 ships to collect',
        "New: Practice. Warm up with her and she'll remember your comfortable range",
        'She follows vibrato, slides and your own key now',
        'Pause anytime. Sound and language (中文) are in Settings'
      ]
    }
  ];
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
