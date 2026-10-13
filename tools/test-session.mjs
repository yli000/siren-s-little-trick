#!/usr/bin/env node
/**
 * v2 流程（session.js + progress.js + practice.js）：虚拟时钟驱动整首歌 / 整组练习。
 * 假麦克风直接按当前目标音"唱"，用来验证流程、事件、存档与清理，而不是音高检测本身
 * （音高检测见 test-pitch.mjs，判定见 test-judge.mjs）。
 *
 * 用法：node tools/test-session.mjs
 */
import { loadCore } from './lib/load-core.mjs';
import { makeClock, makeAudioStub } from './lib/fakes.mjs';

const FILES = ['data/songs.js', 'data/ships.js', 'js/core/store.js', 'js/core/pitch.js', 'js/core/music.js', 'js/core/judge.js',
  'js/core/audio.js', 'js/core/progress.js', 'js/core/practice.js', 'js/core/session.js', 'js/core/index.js'];

let pass = 0;
const fails = [];
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  OK   ${name}${detail ? '  — ' + detail : ''}`); }
  else { fails.push(name); console.log(`  FAIL ${name}${detail ? '  — ' + detail : ''}`); }
};

/** 每个场景一个全新的沙箱 */
async function world() {
  const clock = makeClock();
  const audio = makeAudioStub(clock);
  const S = loadCore(FILES, { AudioContext: audio.FakeAudioContext });
  S.Session._setClock(clock);
  await S.Session.init();
  const events = [];
  for (const type of ['phase', 'note', 'phraseEnd', 'finish', 'notice', 'pause', 'hum']) {
    S.Session.on(type, (p) => events.push({ type, p, at: clock.now() }));
  }
  return { S, clock, events };
}

/** 假歌手：按 getState() 里的目标音唱（可整体移调、延迟、只在某些句沉默） */
function singer(S, o = {}) {
  const { semis = 0, latency = 80, quietPhrase = () => false, humMidi = 0 } = o;
  return () => {
    const st = S.Session.getState();
    if (st.phase === 'hum') return humMidi ? { hz: S.Pitch.midiToHz(humMidi), rms: 0.2 } : { hz: 0, rms: 0.001 };
    if (st.phase !== 'sing' && st.phase !== 'countin') return { hz: 0, rms: 0.001 };
    if (quietPhrase(st.phraseIdx)) return { hz: 0, rms: 0.001 };
    const t = st.singT - latency;
    for (const n of st.notes) {
      if (t >= n.startMs && t < n.startMs + n.durMs - 40) return { hz: S.Pitch.midiToHz(n.midi + semis), rms: 0.2 };
    }
    return { hz: 0, rms: 0.001 };
  };
}

console.log('v2 流程');

// ---------------------------------------------------------------- 1. 唱完一首
{
  const { S, clock, events } = await world();
  S.Session._setMicStub(singer(S, { semis: -2 }));
  const song = S.SONGS.find((s) => s.id === 'mary');
  S.Session.startSong(song);
  await clock.advance(120000);
  const fin = events.find((e) => e.type === 'finish');
  const notes = events.filter((e) => e.type === 'note');
  const want = song.phrases.reduce((n, p) => n + S.Music.phraseNotes(p, 60, 100).notes.length, 0);
  check('唱完一首：收到 finish', !!fin, fin ? `${Math.round(fin.at / 1000)}s` : '');
  check('每个音都有档位，且只判一次', notes.length === want, `${notes.length}/${want}`);
  const good = notes.filter((e) => e.p.tier === 'perfect' || e.p.tier === 'great').length;
  check('用自己的调（低 2 个半音）唱：Perfect/Great 为主', good >= want - 1, `${good}/${want}`);
  check('唱完立刻存档：图鉴里有这艘船', fin && S.Progress.visits(S.SHIPS[fin.p.ship.index].key) === 1);
  check('记住上次唱的歌', S.Progress.lastSong() === 'mary');
  check('唱完后没有残留的歌声', S.Audio.voiceCount() === 0);
  check('一首歌约 1 分钟以内', fin && fin.at < 75000, `${Math.round(fin.at / 1000)}s`);
  const phases = events.filter((e) => e.type === 'phase').map((e) => e.p.phase);
  check('节奏：intro → listen → countin → sing → result …', phases.slice(0, 5).join(',') === 'intro,listen,countin,sing,result', phases.slice(0, 6).join(','));
}

// ---------------------------------------------------------------- 2. 没出声
{
  const { S, clock, events } = await world();
  S.Session._setMicStub(singer(S, { quietPhrase: (i) => i === 1 }));
  const song = S.SONGS.find((s) => s.id === 'mary');
  S.Session.startSong(song);
  await clock.advance(180000);
  const listens = events.filter((e) => e.type === 'phase' && e.p.phase === 'listen').map((e) => e.p.phraseIdx);
  check('第 2 句没出声：她再唱两遍后静静往下走', listens.filter((i) => i === 1).length === 3, listens.join(','));
  const quietTiers = events.filter((e) => e.type === 'note' && e.p.tier === 'quiet').length;
  const missTiers = events.filter((e) => e.type === 'note' && e.p.tier === 'miss').length;
  check('没出声的句子不出 Miss', quietTiers > 0 && missTiers === 0, `quiet ${quietTiers} / miss ${missTiers}`);
  check('仍然唱完并出船', !!events.find((e) => e.type === 'finish'));
}

// ---------------------------------------------------------------- 3. 暂停 / 继续 / 退出
{
  const { S, clock, events } = await world();
  S.Session._setMicStub(singer(S));
  const song = S.SONGS.find((s) => s.id === 'twinkle');
  S.Session.startSong(song);
  await clock.advance(9000);
  const before = S.Session.getState();
  S.Session.pause();
  check('暂停：立刻没有歌声', S.Audio.voiceCount() === 0);
  const n0 = events.length;
  await clock.advance(20000);
  check('暂停期间流程不往下走', events.length === n0 && S.Session.getState().paused);
  S.Session.resume();
  await clock.advance(50);
  const st = S.Session.getState();
  check('继续：从同一句的「听她唱」重新开始', st.phase === 'listen' && st.phraseIdx === before.phraseIdx, `${st.phase} #${st.phraseIdx}`);
  await clock.advance(2000);
  S.Session.abort();
  check('退出：没有歌声、没有定时器', S.Audio.voiceCount() === 0 && clock.pending() === 0, `voices ${S.Audio.voiceCount()} timers ${clock.pending()}`);
  const n1 = events.length;
  await clock.advance(30000);
  check('退出后不再有任何事件', events.length === n1);
}

// ---------------------------------------------------------------- 3b. 在「结果」停留时暂停（QA 第 1 条）
async function untilPhase(S, clock, pred, maxMs = 200000) {
  for (let t = 0; t < maxMs; t += 25) {
    if (pred(S.Session.getState())) return true;
    await clock.advance(25);
  }
  return false;
}
{
  const { S, clock, events } = await world();
  S.Session._setMicStub(singer(S));
  S.Session.startPractice('steps');
  await untilPhase(S, clock, (st) => st.phase === 'result' && st.phraseIdx === st.phraseCount - 1);
  S.Session.pause();
  await clock.advance(3000);
  let err = null;
  try { S.Session.resume(); await clock.advance(200); } catch (e) { err = e; }
  const fin = events.find((e) => e.type === 'finish');
  check('练习最后一步判完时暂停 → 继续：直接做完，不报错', !err && !!fin && fin.p.exercise === 'steps', err ? String(err) : '');
}
{
  const { S, clock, events } = await world();
  S.Session._setMicStub(singer(S));
  const song = S.SONGS.find((s) => s.id === 'mary');
  S.Session.startSong(song);
  await untilPhase(S, clock, (st) => st.phase === 'result' && st.phraseIdx === 0);
  S.Session.pause();
  const frozen = S.Session.getState().phaseT;
  await clock.advance(1500);
  check('暂停时画面停住（phaseT 不走）', S.Session.getState().phaseT === frozen);
  S.Session.resume();
  await clock.advance(100);
  const st = S.Session.getState();
  check('唱歌：结果停留时暂停 → 继续：进入下一句，不重唱判完的这句', st.phase === 'listen' && st.phraseIdx === 1, `${st.phase} #${st.phraseIdx}`);
  await clock.advance(150000);
  const fin = events.find((e) => e.type === 'finish');
  check('（同上）每句只记一次结果', fin && fin.p.results.length === song.phrases.length, fin ? `${fin.p.results.length}/${song.phrases.length}` : 'no finish');
}

// ---------------------------------------------------------------- 3c. 一直哼同一个音（QA 第 4 条）
{
  const { S, clock, events } = await world();
  S.Session._setMicStub(() => {
    const st = S.Session.getState();
    return st.phase === 'sing' ? { hz: S.Pitch.midiToHz(64), rms: 0.2 } : { hz: 0, rms: 0.001 };
  });
  S.Session.startSong(S.SONGS.find((s) => s.id === 'twinkle'));
  await clock.advance(150000);
  const notes = events.filter((e) => e.type === 'note');
  const perfect = notes.filter((e) => e.p.tier === 'perfect').length;
  check('一直哼同一个音唱完小星星：Perfect 不超过三成', notes.length > 30 && perfect <= notes.length * 0.3, `${perfect}/${notes.length}`);
}

// ---------------------------------------------------------------- 4. 练习
{
  const { S, clock, events } = await world();
  S.Session._setMicStub(singer(S, { humMidi: 58 }));
  S.Session.startPractice('find');
  await clock.advance(60000);
  const fin = events.find((e) => e.type === 'finish');
  check('练习「找到第一个音」：做完', fin && fin.p.exercise === 'find');
  check('测到舒服的音高并存下', S.Progress.range() && Math.round(S.Progress.range().comfort) === 58, JSON.stringify(S.Progress.range()));
  check('练习完成打勾', S.Progress.practiceDone('find'));

  check('第 1 组测到了音：说「她记住你的调了」', fin && fin.p.learnedRange === true);
  check('第 1 组之后唱歌就按你的调', S.Progress.keyKnown() && S.Progress.songShift(S.SONGS[0]) !== 0, `twinkle 移 ${S.Progress.songShift(S.SONGS[0])}`);

  events.length = 0;
  S.Session.startPractice('ladder');
  await clock.advance(90000);
  const r = S.Progress.range();
  check('爬梯子：唱得上去就记下最高与最低', r.hi - r.lo === 13, JSON.stringify(r));
  check('有音区后，唱歌按音区定调', S.Progress.hasRange() && typeof S.Progress.songShift(S.SONGS[0]) === 'number', `twinkle 移 ${S.Progress.songShift(S.SONGS[0])}`);
}

// ---------------------------------------------------------------- 5. 练习：唱不好也不卡人
{
  const { S, clock, events } = await world();
  S.Session._setMicStub(singer(S, { semis: 0.0, latency: 900 }));   // 严重拖拍 → 分数低
  S.Session.startPractice('steps');
  await clock.advance(200000);
  const listens = events.filter((e) => e.type === 'phase' && e.p.phase === 'listen').length;
  check('一步最多 3 遍，之后放行', !!events.find((e) => e.type === 'finish') && listens <= 9, `${listens} 遍`);
}

// ---------------------------------------------------------------- 5b. 练习：完全不出声（QA 建议）
{
  const { S, clock, events } = await world();
  S.Session._setMicStub(singer(S, { quietPhrase: () => true }));
  S.Session.startPractice('steps');
  await clock.advance(200000);
  const listens = events.filter((e) => e.type === 'phase' && e.p.phase === 'listen').length;
  check('练习里不出声：每步最多听 3 遍，然后做完', !!events.find((e) => e.type === 'finish') && listens <= 9, `${listens} 遍`);
}

// ---------------------------------------------------------------- 5c. 「她记住你的调了」只在真的测到时出现（QA 第 5 条）
{
  const { S, clock, events } = await world();
  S.Progress.setRange({ comfort: 60 });   // 第一次玩时「哼一声」测到的
  S.Session._setMicStub(singer(S));
  S.Session.startPractice('leaps');
  await clock.advance(120000);
  const fin = events.find((e) => e.type === 'finish');
  check('跳过去：不说「她记住你的调了」', fin && fin.p.learnedRange === false);
  check('只有第一次的「哼一声」：唱歌不移调', !S.Progress.keyKnown() && S.Progress.songShift(S.SONGS[0]) === 0);
}

// ---------------------------------------------------------------- 6. 没有麦克风：点按
{
  const { S, clock, events } = await world();
  // 不注入假麦克风，也没有 getUserMedia → requestMic 失败
  const ok = await S.Session.requestMic();
  check('没有麦克风：requestMic 返回 false', ok === false && S.Session.micState() === 'denied');
  const song = S.SONGS.find((s) => s.id === 'mary');
  S.Session.startSong(song);
  let tapped = 0;
  for (let i = 0; i < 3000 && !events.find((e) => e.type === 'finish'); i += 1) {
    const st = S.Session.getState();
    if ((st.phase === 'sing' || st.phase === 'countin') && st.tap) {
      const next = st.notes.find((n, idx) => st.tiers[idx] === undefined && Math.abs(st.singT - (n.startMs + 60)) < 30);
      if (next) { S.Session.tap(); tapped += 1; }
    }
    await clock.advance(25);
  }
  const notes = events.filter((e) => e.type === 'note');
  check('点按：跟着节奏点就有 Perfect', notes.filter((e) => e.p.tier === 'perfect').length >= notes.length - 2, `${notes.filter((e) => e.p.tier === 'perfect').length}/${notes.length}，点了 ${tapped} 下`);
}

// ---------------------------------------------------------------- 7. 抽船保底与清除进度
{
  const { S } = await world();
  const P = S.Progress;
  // 先把除了一艘以外的船都收进图鉴
  const c = {};
  S.SHIPS.forEach((s, i) => { if (i !== 5) c[s.key] = 1; });
  S.Store.setJSON(S.Store.KEYS.CODEX, c);
  S.Store.set(S.Store.KEYS.DUPES, P.PITY_AFTER);
  const idx = P.pickShip('twinkle', () => 0.999);
  check('连续来了 2 艘见过的船：下一艘必是新船', idx === 5, S.SHIPS[idx].key);
  P.setLang('en');
  P.reset();
  check('清除进度：图鉴清空，语言保留', P.collectedCount() === 0 && P.lang() === 'en');

  // 常客权重：大量抽样里，小星星的常客（月亮船）出现得比别的传说船多
  S.Store.remove(S.Store.KEYS.CODEX);
  S.Store.remove(S.Store.KEYS.DUPES);
  let moon = 0;
  let ghost = 0;
  let seed = 7;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 6000; i += 1) {
    const k = S.SHIPS[P.pickShip('twinkle', rng)].key;
    if (k === 'moon') moon += 1;
    if (k === 'ghost') ghost += 1;
  }
  check('常客船权重 ×3', moon > ghost * 2.2, `moon ${moon} / ghost ${ghost}`);
}

console.log(`\n${pass} 项通过，${fails.length} 项失败`);
if (fails.length) process.exit(1);
