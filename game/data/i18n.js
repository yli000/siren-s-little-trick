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

      herTurn: '塞壬先唱', yourTurn: '轮到你', again: '没听到你，塞壬再唱一遍', retry: '再来一遍',
      lowInput: '没听到声音，靠近一点麦克风',

      paused: '暂停', resume: '继续', restart: '重新开始', quit: '退出',

      ok: '好', gotIt: '知道了',
      micNoneTitle: '麦克风未授权', micNoneBody: '塞壬听不到你唱，每个音都会算 Miss。可以在浏览器的网站设置里允许使用麦克风。',
      tutTitle: '怎么玩',
      tutIntro: '塞壬先唱一句，你跟着唱一句，一句一句把一首歌唱完。唱完一首，会有一艘船循着歌声开过来。',
      tutIntroGo: '先试一句',
      tutListen: '塞壬要唱了。她唱到哪个音，下面的音块就亮起来：越靠右越晚唱，位置越高音越高。',
      tutTurn: '轮到你了。听到「嗒、嗒」两声，下面的麦克风变红时直接开口，不用按它。把刚才那句唱回来，哼或者唱「啦」都行。你的声音会画成一条红线。',
      tutSing: '让红线贴着音块走',
      tutQuiet: '没听到你的声音。麦克风变红时直接开口，不用按它；如果已经唱了，把手机拿近一点。',
      tutEnd: '每个音唱完会变色：金色 Perfect、绿色 Great、蓝色 Good、灰色 Miss，表示你和塞壬唱得有多像。接下来是一整首歌。',
      tutEndMiss: '这次都是 Miss：红线要落在音块上才算对上。再试一次？',
      tutEndNoMic: '麦克风没有授权，塞壬听不到你，所以都是 Miss。在浏览器的网站设置里允许麦克风后，再试一次。',
      tutAgain: '再试一次', tutStart: '开始唱',

      humTitle: '哼一声', humHint: '随便哼一个舒服的音',

      newFind: '新发现!', visitN: '第 {n} 次来', singAgain: '再唱一遍', another: '换一首',
      common: '普通', rare: '稀有', epic: '史诗', legend: '传说',

      codexTitle: '船只图鉴', notYet: '它还没有来过。', notYet2: '再唱几首，也许今晚就来。', visits: '来过 {n} 次',

      practiceTitle: '练习',
      ex_find: '单音', ex_steps: '音阶', ex_ladder: '音域', ex_leaps: '音程', ex_memory: '旋律',
      learnedKey: '塞壬记住你的调了', exDone: '这组练完了', moreEx: '下一组', toSongs: '去唱歌',

      settingsTitle: '设置', sfx: '音效', on: '开', off: '关',
      language: '语言',
      mic: '麦克风', micOk: '已授权', micNo: '未授权',
      micBlockedTitle: '麦克风未授权', micBlockedBody: '请在浏览器的网站设置里允许使用麦克风',
      changelog: '更新日志', about: '关于',

      authors: '作者', authorNames: 'potato · 奶糖 · 元元', version: '版本'
    },
    en: {
      title: "Siren's Little Trick",
      start: 'Start', practice: 'Practice', codex: 'Ships', settings: 'Settings',

      random: 'Surprise me', startHere: 'Start here',

      herTurn: 'The Siren sings first', yourTurn: 'Your turn', again: "Didn't hear you. She'll sing it again", retry: 'One more time',
      lowInput: "Can't hear you. Come a little closer.",

      paused: 'Paused', resume: 'Resume', restart: 'Restart', quit: 'Quit',

      ok: 'OK', gotIt: 'Got it',
      micNoneTitle: 'Mic not allowed', micNoneBody: "The Siren can't hear you, so every note counts as a Miss. You can allow the microphone in your browser's site settings.",
      tutTitle: 'How to play',
      tutIntro: 'The Siren sings a line, then you sing it back, line by line through a song. Finish a song and a ship follows your voice in.',
      tutIntroGo: 'Try one line',
      tutListen: 'The Siren is about to sing. Each note lights up a block below: further right is later, higher up is a higher note.',
      tutTurn: 'Your turn. After two clicks, when the mic below turns red, just start singing. No need to tap it. Sing that line back: hum or "la" is fine. Your voice shows up as a red line.',
      tutSing: 'Keep the red line on the blocks',
      tutQuiet: "Didn't hear you. When the mic turns red, just sing, no need to tap it. If you did sing, hold the phone closer.",
      tutEnd: 'Each note changes color when it ends: gold Perfect, green Great, blue Good, grey Miss, by how close you were. Next comes a whole song.',
      tutEndMiss: 'All Miss this time: the red line has to sit on the blocks. Try again?',
      tutEndNoMic: "The mic isn't allowed, so the Siren can't hear you and every note is a Miss. Allow it in your browser's site settings, then try again.",
      tutAgain: 'Try again', tutStart: "Let's sing",

      humTitle: 'Hum a note', humHint: 'Any note that feels easy',

      newFind: 'New!', visitN: 'Visit #{n}', singAgain: 'Sing again', another: 'Another',
      common: 'Common', rare: 'Rare', epic: 'Epic', legend: 'Legend',

      codexTitle: 'Ships', notYet: "It hasn't come yet.", notYet2: 'Sing a few more. Maybe tonight.', visits: '{n} visits',

      practiceTitle: 'Practice',
      ex_find: 'Single Notes', ex_steps: 'Scales', ex_ladder: 'Range', ex_leaps: 'Intervals', ex_memory: 'Melodies',
      learnedKey: "The Siren will sing in your key now", exDone: 'All done', moreEx: 'Next', toSongs: 'Go sing',

      settingsTitle: 'Settings', sfx: 'Sound effects', on: 'On', off: 'Off',
      language: 'Language',
      mic: 'Microphone', micOk: 'Allowed', micNo: 'Not allowed',
      micBlockedTitle: 'Mic not allowed', micBlockedBody: "Allow the microphone in your browser's site settings.",
      changelog: "What's new", about: 'About',

      authors: 'Made by', authorNames: 'potato · naitang · meta', version: 'Version'
    }
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
