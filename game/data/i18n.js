/* 塞壬的小把戏 —— 界面文案（v2，中 / 英）
 *
 * 文案约束（PRD P4，v2 沿用）：短、轻、不评价。不出现"低了 / 晚了 / 跑调"之类的诊断。
 * {n} 会被替换成数字。改了文案要重跑 art-source/pixel/build.py（位图字体只含用到的字）。
 */
(function (global) {
  'use strict';
  var Siren = global.Siren = global.Siren || {};

  Siren.I18N = {
    zh: {
      title: '塞壬的小把戏',
      tagline: '小声哼也行，她听得见',
      start: '开始', practice: '练习', codex: '图鉴', settings: '设置',

      random: '随便来一首', startHere: '从这首开始', yourKey: '按你的调',

      herTurn: '她先唱', yourTurn: '轮到你', again: '她再唱一遍', retry: '再来一遍',
      tapHint: '跟着节奏点这里', lowInput: '没听到声音，靠近一点麦克风',

      paused: '暂停', resume: '继续', restart: '重新开始', quit: '退出',

      micTitle: '她要听你唱', micBody: '声音只在你的手机里处理，不会上传', ok: '好',
      micDenied: '没有麦克风也能玩：轮到你时跟着节奏点麦克风',

      humTitle: '哼一声试试', humHint: '随便哼一个舒服的音', humHeard: '她听见了', humNot: '好像没听到，再哼一次？',
      tryAgain: '再试一次', go: '开始唱', skip: '跳过',

      newFind: '新发现!', visitN: '第 {n} 次来', singAgain: '再唱一遍', another: '换一首',
      common: '普通', rare: '稀有', epic: '史诗', legend: '传说',

      codexTitle: '船只图鉴', notYet: '它还没有来过。', notYet2: '再唱几首，也许今晚就来。', visits: '来过 {n} 次',

      practiceTitle: '练习',
      ex_find: '找到第一个音', exb_find: '哼一个音，再跟她对准',
      ex_steps: '一步一步走', exb_steps: '一个音挨着一个音',
      ex_leaps: '跳过去', exb_leaps: '把距离唱够',
      ex_ladder: '爬梯子', exb_ladder: '往上走走，往下走走',
      ex_memory: '记更长', exb_memory: '三个音，五个音，七个音',
      learnedKey: '她记住你的调了', exDone: '这组练完了', moreEx: '再练一组', toSongs: '去唱歌',

      settingsTitle: '设置', sfx: '音效与海浪', on: '开', off: '关',
      language: '语言', langName: '中文',
      mic: '麦克风', micOk: '已允许', micNo: '未允许，点此重试', micUnknown: '还没用过',
      changelog: '更新日志', about: '关于', reset: '清除进度',
      resetConfirm: '图鉴、唱过的歌和练习记录都会清空', confirm: '清空', cancel: '取消', resetDone: '已清空',

      authors: '作者', authorNames: 'potato · 奶糖 · 元元', version: '版本',
      privacy: '离线运行，声音只在你的手机里处理', fontCredit: '字体 Fusion Pixel（SIL OFL 1.1）'
    },
    en: {
      title: "Siren's Little Trick",
      tagline: 'Hum softly. She hears you.',
      start: 'Start', practice: 'Practice', codex: 'Ships', settings: 'Settings',

      random: 'Surprise me', startHere: 'Start here', yourKey: 'In your key',

      herTurn: 'She sings first', yourTurn: 'Your turn', again: 'Once more from her', retry: 'One more time',
      tapHint: 'Tap here to the beat', lowInput: "Can't hear you. Come a little closer.",

      paused: 'Paused', resume: 'Resume', restart: 'Restart', quit: 'Quit',

      micTitle: 'She wants to hear you', micBody: 'Your voice stays on your phone. Nothing is uploaded.', ok: 'OK',
      micDenied: 'No mic? Tap the mic to the beat on your turn.',

      humTitle: 'Hum a note', humHint: 'Any note that feels easy', humHeard: 'She heard you', humNot: "Didn't hear it. Hum again?",
      tryAgain: 'Try again', go: "Let's sing", skip: 'Skip',

      newFind: 'New!', visitN: 'Visit #{n}', singAgain: 'Sing again', another: 'Another',
      common: 'Common', rare: 'Rare', epic: 'Epic', legend: 'Legend',

      codexTitle: 'Ships', notYet: "It hasn't come yet.", notYet2: 'Sing a few more. Maybe tonight.', visits: '{n} visits',

      practiceTitle: 'Practice',
      ex_find: 'Find the note', exb_find: 'Hum, then match her',
      ex_steps: 'Step by step', exb_steps: 'One note to the next',
      ex_leaps: 'Leaps', exb_leaps: 'Reach across the gap',
      ex_ladder: 'Ladder', exb_ladder: 'Step up, step down',
      ex_memory: 'Longer lines', exb_memory: 'Three notes, then more',
      learnedKey: "She'll sing in your key now", exDone: 'All done', moreEx: 'Another one', toSongs: 'Go sing',

      settingsTitle: 'Settings', sfx: 'Effects & waves', on: 'On', off: 'Off',
      language: 'Language', langName: 'English',
      mic: 'Microphone', micOk: 'Allowed', micNo: 'Denied. Retry', micUnknown: 'Not used yet',
      changelog: "What's new", about: 'About', reset: 'Reset progress',
      resetConfirm: 'Your ships, songs and practice will be cleared', confirm: 'Clear', cancel: 'Cancel', resetDone: 'Cleared',

      authors: 'Made by', authorNames: 'potato · naitang · meta', version: 'Version',
      privacy: 'Runs offline. Your voice never leaves your phone.', fontCredit: 'Font: Fusion Pixel (SIL OFL 1.1)'
    }
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
