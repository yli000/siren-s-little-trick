/* 塞壬的小把戏 —— 界面文案（v2，中 / 英）
 *
 * 文案约束（PRD P4，v2 沿用）：短、轻、不评价。不出现"低了 / 晚了 / 跑调"之类的诊断。
 * {n} 会被替换成数字。改了文案要重跑 art-source/pixel/build.py（位图字体只含用到的字）。
 */
(function (global) {
  'use strict';
  var Siren = global.Siren = global.Siren || {};

  /** 语言下拉框里的选项：每种语言用它自己的名字 */
  Siren.LANGS = [{ id: 'zh', name: '中文' }, { id: 'en', name: 'English' }];

  Siren.I18N = {
    zh: {
      title: '塞壬的小把戏',
      start: '开始', practice: '练习', codex: '图鉴', settings: '设置',

      random: '随便来一首', startHere: '从这首开始',

      herTurn: '她先唱', yourTurn: '轮到你', again: '她再唱一遍', retry: '再来一遍',
      lowInput: '没听到声音，靠近一点麦克风',

      paused: '暂停', resume: '继续', restart: '重新开始', quit: '退出',

      ok: '好', micNone: '麦克风未授权',
      guideTitle: '跟唱', guideBody: '她先唱一句，轮到你时跟着唱一句', guideGo: '试试',

      humTitle: '哼一声', humHint: '随便哼一个舒服的音',

      newFind: '新发现!', visitN: '第 {n} 次来', singAgain: '再唱一遍', another: '换一首',
      common: '普通', rare: '稀有', epic: '史诗', legend: '传说',

      codexTitle: '船只图鉴', notYet: '它还没有来过。', notYet2: '再唱几首，也许今晚就来。', visits: '来过 {n} 次',

      practiceTitle: '练习',
      ex_find: '单音', ex_steps: '音阶', ex_ladder: '音域', ex_leaps: '音程', ex_memory: '旋律',
      learnedKey: '她记住你的调了', exDone: '这组练完了', moreEx: '下一组', toSongs: '去唱歌',

      settingsTitle: '设置', sfx: '音效', on: '开', off: '关',
      language: '语言',
      mic: '麦克风', micOk: '已授权', micNo: '未授权',
      micOffTitle: '取消授权', micOffBody: '请在浏览器的网站设置里关闭麦克风',
      micBlockedTitle: '麦克风未授权', micBlockedBody: '请在浏览器的网站设置里允许使用麦克风',
      changelog: '更新日志', about: '关于',

      authors: '作者', authorNames: 'potato · 奶糖 · 元元', version: '版本'
    },
    en: {
      title: "Siren's Little Trick",
      start: 'Start', practice: 'Practice', codex: 'Ships', settings: 'Settings',

      random: 'Surprise me', startHere: 'Start here',

      herTurn: 'She sings first', yourTurn: 'Your turn', again: 'Once more from her', retry: 'One more time',
      lowInput: "Can't hear you. Come a little closer.",

      paused: 'Paused', resume: 'Resume', restart: 'Restart', quit: 'Quit',

      ok: 'OK', micNone: 'No mic access',
      guideTitle: 'Sing it back', guideBody: 'She sings a line. On your turn, sing it back.', guideGo: "Let's try",

      humTitle: 'Hum a note', humHint: 'Any note that feels easy',

      newFind: 'New!', visitN: 'Visit #{n}', singAgain: 'Sing again', another: 'Another',
      common: 'Common', rare: 'Rare', epic: 'Epic', legend: 'Legend',

      codexTitle: 'Ships', notYet: "It hasn't come yet.", notYet2: 'Sing a few more. Maybe tonight.', visits: '{n} visits',

      practiceTitle: 'Practice',
      ex_find: 'Single Notes', ex_steps: 'Scales', ex_ladder: 'Range', ex_leaps: 'Intervals', ex_memory: 'Melodies',
      learnedKey: "She'll sing in your key now", exDone: 'All done', moreEx: 'Next', toSongs: 'Go sing',

      settingsTitle: 'Settings', sfx: 'Sound effects', on: 'On', off: 'Off',
      language: 'Language',
      mic: 'Microphone', micOk: 'Allowed', micNo: 'Not allowed',
      micOffTitle: 'Turn off the mic', micOffBody: "Turn it off in your browser's site settings.",
      micBlockedTitle: 'Mic not allowed', micBlockedBody: "Allow the microphone in your browser's site settings.",
      changelog: "What's new", about: 'About',

      authors: 'Made by', authorNames: 'potato · naitang · meta', version: 'Version'
    }
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
