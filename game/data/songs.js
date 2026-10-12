/* 塞壬的小把戏 —— 曲库（v2，20 首）
 *
 * 只收旋律，不收歌词与编曲；全部为公有领域旋律（上线前请再确认一次）。
 * 记号见 js/core/music.js：1–7 音级，# b 升降，' , 高低八度，:n 时值（八分音符为单位，默认 2）。
 *
 * key      主音 MIDI（默认调，玩家做过练习后会再移调）
 * bpm      每分钟四分音符数
 * level    难度 1–3
 * regular  这首歌的「常客」船（抽船时权重 ×3）
 */
(function (global) {
  'use strict';
  var Siren = global.Siren = global.Siren || {};

  Siren.SONGS = [
    // ---------------------------------------------------------------- ★
    { id: 'twinkle', title: { zh: '小星星', en: 'Twinkle, Twinkle, Little Star' }, level: 1, key: 62, bpm: 96, regular: 'moon',
      origin: 'French folk tune, 1761',
      phrases: ['1 1 5 5 6 6 5:4', '4 4 3 3 2 2 1:4', '5 5 4 4 3 3 2:4', '5 5 4 4 3 3 2:4', '1 1 5 5 6 6 5:4', '4 4 3 3 2 2 1:4'] },
    { id: 'jacques', title: { zh: '两只老虎', en: 'Frère Jacques' }, level: 1, key: 62, bpm: 112, regular: 'tug',
      origin: 'French folk tune, 18th c.',
      phrases: ['1 2 3 1 1 2 3 1', '3 4 5:4 3 4 5:4', '5:1 6:1 5:1 4:1 3 1', '5:1 6:1 5:1 4:1 3 1', '1 5, 1:4 1 5, 1:4'] },
    { id: 'mary', title: { zh: '玛丽有只小羊羔', en: 'Mary Had a Little Lamb' }, level: 1, key: 64, bpm: 108, regular: 'paper',
      origin: 'American nursery tune, 1830',
      phrases: ['3 2 1 2 3 3 3:4', '2 2 2:4 3 5 5:4', '3 2 1 2 3 3 3 3', '2 2 3 2 1:8'] },
    { id: 'row', title: { zh: '划船歌', en: 'Row, Row, Row Your Boat' }, level: 1, key: 60, bpm: 104, regular: 'raft',
      origin: 'American nursery tune, 1852',
      phrases: ['1:3 1:3 1:2 2:1 3:3', '3:2 2:1 3:2 4:1 5:6', "1':1 1':1 1':1 5:1 5:1 5:1", '3:1 3:1 3:1 1:1 1:1 1:1', '5:2 4:1 3:2 2:1 1:6'] },
    { id: 'london', title: { zh: '伦敦桥', en: 'London Bridge Is Falling Down' }, level: 1, key: 62, bpm: 108, regular: 'ferry',
      origin: 'English nursery tune, 17th c.',
      phrases: ['5:3 6:1 5 4 3 4 5:4', '2 3 4:4 3 4 5:4', '5:3 6:1 5 4 3 4 5:4', '2:4 5:4 3 1:6'] },
    { id: 'lightly', title: { zh: '小蜜蜂', en: 'Lightly Row' }, level: 1, key: 64, bpm: 112, regular: 'lotusleaf',
      origin: 'German folk tune, 19th c.',
      phrases: ['5 3 3:4 4 2 2:4', '1 2 3 4 5 5 5:4', '5 3 3:4 4 2 2:4', '1 3 5 5 3:8', '2 2 2 2 2 3 4:4', '3 3 3 3 3 4 5:4', '5 3 3:4 4 2 2:4', '1 3 5 5 1:8'] },
    { id: 'ode', title: { zh: '欢乐颂', en: 'Ode to Joy' }, level: 1, key: 62, bpm: 116, regular: 'sail',
      origin: 'Beethoven, 1824',
      phrases: ['3 3 4 5 5 4 3 2', '1 1 2 3 3:3 2:1 2:4', '3 3 4 5 5 4 3 2', '1 1 2 3 2:3 1:1 1:4', '2 2 3 1 2 3:1 4:1 3 1', '2 3:1 4:1 3 2 1 2 5,:4', '3 3 4 5 5 4 3 2', '1 1 2 3 2:3 1:1 1:4'] },

    // ---------------------------------------------------------------- ★★
    { id: 'jingle', title: { zh: '铃儿响叮当', en: 'Jingle Bells' }, level: 2, key: 62, bpm: 120, regular: 'icebreaker',
      origin: 'J. Pierpont, 1857',
      phrases: ['3 3 3:4 3 3 3:4', '3 5 1:3 2:1 3:8', '4 4 4:3 4:1 4 3 3 3:1 3:1', '3 2 2 3 2:4 5:4', '3 3 3:4 3 3 3:4', '3 5 1:3 2:1 3:8', '4 4 4:3 4:1 4 3 3 3:1 3:1', '5 5 4 2 1:8'] },
    { id: 'clementine', title: { zh: '新年好', en: 'Oh My Darling, Clementine' }, level: 2, key: 62, bpm: 112, regular: 'dragon',
      origin: 'American folk tune, 1884',
      phrases: ['1:1 1:1 1:2 5,:2 3:1 3:1 3:2 1:2', '1:1 3:1 5:2 5:2 4:1 3:1 2:4', '2:1 3:1 4:2 4:2 3:1 2:1 3:2 1:2', '1:1 3:1 2:2 5,:2 7,:1 2:1 1:4',
        '1:1 1:1 1:2 5,:2 3:1 3:1 3:2 1:2', '1:1 3:1 5:2 5:2 4:1 3:1 2:4', '2:1 3:1 4:2 4:2 3:1 2:1 3:2 1:2', '1:1 3:1 2:2 5,:2 7,:1 2:1 1:4'] },
    { id: 'macdonald', title: { zh: '老麦克唐纳', en: 'Old MacDonald Had a Farm' }, level: 2, key: 65, bpm: 116, regular: 'melon',
      origin: 'American folk tune, before 1917',
      phrases: ['1 1 1 5, 6, 6, 5,:4', '3 3 2 2 1:6', '5,:1 5,:1 1 1 1 5,:1 5,:1 1 1 1:4', '1 1 1 5, 6, 6, 5,:4', '3 3 2 2 1:6'] },
    { id: 'lullaby', title: { zh: '摇篮曲', en: "Brahms' Lullaby" }, level: 2, key: 60, bpm: 80, regular: 'fishing',
      origin: 'Brahms, 1868',
      phrases: ['3:1 3:1 5:4 3:1 3:1 5:4', "3:1 5:1 1':3 7:1 6:2 6:2 5:4", '2:1 3:1 4:4 2:1 2:1 3:2 4:4', "2:1 4:1 7:2 6:2 5:2 7:2 1':4", "1:1 1:1 1':4 6:1 4:1 5:4", '3:1 1:1 4:2 3:2 2:2 1:4'] },
    { id: 'silent', title: { zh: '平安夜', en: 'Silent Night' }, level: 2, key: 57, bpm: 100, regular: 'lantern',
      origin: 'F. Gruber, 1818',
      phrases: ['5:3 6:1 5:2 3:6', '5:3 6:1 5:2 3:6', "2':4 2':2 7:6", "1':4 1':2 5:6", "6:4 6:2 1':3 7:1 6:2 5:3 6:1 5:2 3:6", "2':4 2':2 4':3 2':1 7:2 1':6 3':6", "1':3 5:1 3:2 5:3 4:1 2:2 1:8"] },
    { id: 'grace', title: { zh: '奇异恩典', en: 'Amazing Grace' }, level: 2, key: 62, bpm: 96, regular: 'lightship',
      origin: 'American hymn tune “New Britain”, 1829',
      phrases: ['5,:2 1:4 3:1 1:1 3:4 2:2 1:4 6,:2 5,:4', '5,:2 1:4 3:1 1:1 3:4 2:2 5:8', '3:2 5:4 3:1 1:1 3:4 2:2 1:4 6,:2 5,:4', '5,:2 1:4 3:1 1:1 3:4 2:2 1:8'] },
    { id: 'home', title: { zh: '念故乡', en: 'Going Home (New World)' }, level: 2, key: 62, bpm: 66, regular: 'mail',
      origin: 'Dvořák, 1893',
      phrases: ['3:3 5:1 5:4 3:3 2:1 1:4', '2:2 3:2 5:2 3:2 2:8', '3:3 5:1 5:4 3:3 2:1 1:4', '2:2 3:2 2:2 1:2 1:8'] },
    { id: 'yankee', title: { zh: '扬基歌', en: 'Yankee Doodle' }, level: 2, key: 65, bpm: 120, regular: 'pirate',
      origin: 'American folk tune, 18th c.',
      phrases: ['1 1 2 3 1 3 2 5,', '1 1 2 3 1:4 7,:4', '1 1 2 3 4 3 2 1', '7, 5, 6, 7, 1:4 1:4', '6, 7, 6, 5, 6, 7, 1:4', '5, 6, 5, 4, 3,:4 5,:4', '6, 7, 6, 5, 6, 7, 1 6,', '5, 1 7, 2 1:4 1:4'] },

    // ---------------------------------------------------------------- ★★★
    { id: 'auld', title: { zh: '友谊地久天长', en: 'Auld Lang Syne' }, level: 3, key: 62, bpm: 84, regular: 'treasure',
      origin: 'Scottish folk tune, 1788',
      phrases: ['5,:2 1:3 1:1 1:2 3:2 2:3 1:1 2:2', '3:2 1:3 1:1 3:2 5:2 6:6', '6:2 5:3 3:1 3:2 1:2 2:3 1:1 2:2', '3:2 1:3 6,:1 6,:2 5,:2 1:6', '6:2 5:3 3:1 3:2 1:2 2:3 1:1 2:2', '3:2 1:3 6,:1 6,:2 5,:2 1:6'] },
    { id: 'jasmine', title: { zh: '茉莉花', en: 'Jasmine Flower' }, level: 3, key: 62, bpm: 80, regular: 'swan',
      origin: 'Chinese folk song, 18th c.',
      phrases: ["3:2 3:1 5:1 6:1 1':1 1':1 6:1", '5:2 5:1 6:1 5:4', "3:2 3:1 5:1 6:1 1':1 1':1 6:1", '5:2 5:1 6:1 5:4', '5:2 5:2 5:2 3:1 5:1 6:2 6:2 5:4', '3:2 2:1 3:1 5:2 3:1 2:1 1:2 1:1 2:1 1:4'] },
    { id: 'greensleeves', title: { zh: '绿袖子', en: 'Greensleeves' }, level: 3, key: 65, bpm: 100, regular: 'ghost',
      origin: 'English ballad, 16th c.',
      phrases: ['6,:2 1:4 2:2 3:3 4:1 3:2 2:4', '7,:2 5,:3 6,:1 7,:2 1:4 6,:2', '6,:3 #5,:1 6,:2 7,:4 #5,:2 3,:6', '6,:2 1:4 2:2 3:3 4:1 3:2 2:4', '7,:2 5,:3 6,:1 7,:2 1:4 6,:2', '6,:3 #5,:1 6,:2 7,:4 #5,:2 6,:6'] },
    { id: 'elise', title: { zh: '致爱丽丝', en: 'Für Elise' }, level: 3, key: 58, bpm: 132, regular: 'cruise',
      origin: 'Beethoven, 1810',
      phrases: ["3':1 #2':1 3':1 #2':1 3':1 7:1 2':1 1':1 6:4", "1:1 3:1 6:1 7:4 3:1 #5:1 7:1 1':4", "3':1 #2':1 3':1 #2':1 3':1 7:1 2':1 1':1 6:4", "1:1 3:1 6:1 7:4 3:1 1':1 7:1 6:4",
        "3':1 #2':1 3':1 #2':1 3':1 7:1 2':1 1':1 6:4", "1:1 3:1 6:1 7:4 3:1 #5:1 7:1 1':4", "3':1 #2':1 3':1 #2':1 3':1 7:1 2':1 1':1 6:4", "1:1 3:1 6:1 7:4 3:1 1':1 7:1 6:4"] },
    { id: 'minuet', title: { zh: '小步舞曲', en: 'Minuet in G' }, level: 3, key: 62, bpm: 120, regular: 'sub',
      origin: 'C. Petzold, 1725',
      phrases: ['5:2 1:1 2:1 3:1 4:1 5:2 1:2 1:2', "6:2 4:1 5:1 6:1 7:1 1':2 1:2 1:2", '4:2 5:1 4:1 3:1 2:1 3:2 4:1 3:1 2:1 1:1', '7,:2 1:1 2:1 3:1 1:1 2:6',
        '5:2 1:1 2:1 3:1 4:1 5:2 1:2 1:2', "6:2 4:1 5:1 6:1 7:1 1':2 1:2 1:2", '4:2 5:1 4:1 3:1 2:1 3:2 4:1 3:1 2:1 1:1', '2:2 3:1 2:1 1:1 7,:1 1:6'] }
  ];
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
