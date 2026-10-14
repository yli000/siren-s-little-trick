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
      micHow: "点地址栏左边的图标，进「网站设置」，把麦克风改成「允许」。",
      micOff: "麦克风好像没打开。",
      tutContinue: "继续",

      micSkip: "先这样",
      micRetry: "打开麦克风",
      title: '塞壬的小把戏',
      start: '开始', practice: '练习', codex: '图鉴', settings: '设置',

      random: '随便来一首', startHere: '从这首开始',

      herTurn: '塞壬先唱', yourTurn: '轮到你', again: '没听到你，塞壬再唱一遍', retry: '再来一遍',
      lowInput: '没听到声音，靠近一点麦克风',

      paused: '暂停', resume: '继续', restart: '重新开始', quit: '退出',

      ok: '好',

      tutTitle: '怎么玩',
      tutIntro: "塞壬唱一句，你跟一句。",
      tutIntroGo: '先试一句',
      tutListen: "先听塞壬唱。音块越高，音越高。",
      tutTurn: "开口唱吧 :)",
      tutSing: "红线是你的声音，贴着音块唱。",
      tutQuiet: "好像没听到你的声音。",
      tutEnd: "接下来唱一整首歌啦。",
      tutEndMiss: "再听一遍？",

      tutAgain: '再试一次', tutStart: '开始唱',

      humTitle: '哼一声', humHint: '随便哼一个舒服的音',

      newFind: '新发现!', visitN: '第 {n} 次来', singAgain: '再唱一遍', another: '换一首',

      codexTitle: '船只图鉴', notYet: '它还没有来过。', notYet2: '再唱几首，也许今晚就来。', visits: '来过 {n} 次',

      practiceTitle: '练习',
      ex_find: '单音', ex_steps: '音阶', ex_ladder: '音域', ex_leaps: '音程', ex_memory: '旋律',
      learnedKey: '塞壬记住你的调了', exDone: '这组练完了', moreEx: '下一组', toSongs: '去唱歌',

      settingsTitle: '设置', sfx: '音效', on: '开', off: '关',
      language: '语言',
      mic: '麦克风', micOk: '已授权', micNo: '未授权',
      micBlockedTitle: '麦克风未授权', 
      changelog: '更新日志', about: '关于',

      authors: '作者', authorNames: 'potato · 奶糖 · 元元', version: '版本'
    },
    en: {
      micHow: "Tap the icon left of the address bar, open \"Site settings\" and set the microphone to \"Allow\".",
      micOff: "The mic seems to be off.",
      tutContinue: "Continue",

      micSkip: "Not now",
      micRetry: "Allow mic",
      title: "Siren's Little Trick",
      start: 'Start', practice: 'Practice', codex: 'Ships', settings: 'Settings',

      random: 'Surprise me', startHere: 'Start here',

      herTurn: 'The Siren sings first', yourTurn: 'Your turn', again: "Didn't hear you. She'll sing it again", retry: 'One more time',
      lowInput: "Can't hear you. Come a little closer.",

      paused: 'Paused', resume: 'Resume', restart: 'Restart', quit: 'Quit',

      ok: 'OK',

      tutTitle: 'How to play',
      tutIntro: "The Siren sings a line, you sing it back.",
      tutIntroGo: 'Try one line',
      tutListen: "Listen to the Siren first. Higher blocks, higher notes.",
      tutTurn: "Your turn to sing :)",
      tutSing: "The red line is your voice. Keep it on the blocks.",
      tutQuiet: "Didn't quite hear you.",
      tutEnd: "Next up: a whole song.",
      tutEndMiss: "Hear it again?",

      tutAgain: "Once more", tutStart: "Let's sing",

      humTitle: 'Hum a note', humHint: 'Any note that feels easy',

      newFind: 'New!', visitN: 'Visit #{n}', singAgain: 'Sing again', another: 'Another',

      codexTitle: 'Ships', notYet: "It hasn't come yet.", notYet2: 'Sing a few more. Maybe tonight.', visits: '{n} visits',

      practiceTitle: 'Practice',
      ex_find: 'Single Notes', ex_steps: 'Scales', ex_ladder: 'Range', ex_leaps: 'Intervals', ex_memory: 'Melodies',
      learnedKey: "The Siren will sing in your key now", exDone: 'All done', moreEx: 'Next', toSongs: 'Go sing',

      settingsTitle: 'Settings', sfx: 'Sound effects', on: 'On', off: 'Off',
      language: 'Language',
      mic: 'Microphone', micOk: 'Allowed', micNo: 'Not allowed',
      micBlockedTitle: 'Mic not allowed', 
      changelog: "What's new", about: 'About',

      authors: 'Made by', authorNames: 'potato · naitang · meta', version: 'Version'
    }
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
