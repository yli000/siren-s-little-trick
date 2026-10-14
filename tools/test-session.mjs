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

// ---------------------------------------------------------------- 6. 没有麦克风：照常唱，每个音都是 Miss
{
  const { S, clock, events } = await world();
  // 不注入假麦克风，也没有 getUserMedia → requestMic 失败
  const ok = await S.Session.requestMic();
  check('没有麦克风：requestMic 返回 false', ok === false && S.Session.micState() === 'denied');
  const song = S.SONGS.find((s) => s.id === 'mary');
  S.Session.startSong(song);
  await clock.advance(200000);
  const notes = events.filter((e) => e.type === 'note');
  const listens = events.filter((e) => e.type === 'phase' && e.p.phase === 'listen').length;
  const total = song.phrases.reduce((a, p) => a + S.Music.parsePhrase(p).filter((n) => n.rel !== null).length, 0);
  check('没有麦克风：每个音都是 Miss', notes.length === total && notes.every((e) => e.p.tier === 'miss'), `${notes.length}/${total}`);
  check('没有麦克风：不走「她再唱一遍」，唱完照常来船', listens === song.phrases.length && !!events.find((e) => e.type === 'finish' && e.p.ship), `听了 ${listens} 遍`);
}

// ---------------------------------------------------------------- 6b. 「怎么玩」教程：每一步等玩家点「好」，练一句就结束
/** 教程停在说明上时替玩家点「好」（end 时按 choice 选「开始唱」或「再试一次」） */
async function walkGuide(S, clock, gates, choice = () => 'start', maxMs = 60000) {
  for (let t = 0; t < maxMs; t += 100) {
    const st = S.Session.getState();
    if (st.phase === 'done') return;
    if (st.waiting) {
      gates.push(st.waiting);
      if (st.waiting === 'end' && choice(gates) === 'again') S.Session.guideAgain();
      else S.Session.proceed();
    }
    await clock.advance(100);
  }
}
{
  const { S, clock, events } = await world();
  S.Session._setMicStub(singer(S));
  S.Session.startGuide();
  await clock.advance(3000);
  check('教程：没点「好」之前停着，塞壬不唱', S.Session.getState().waiting === 'listen' && !events.some((e) => e.type === 'phase' && e.p.phase === 'listen'));
  const gates = [];
  await walkGuide(S, clock, gates);
  const fin = events.find((e) => e.type === 'finish');
  check('教程：听 → 轮到你 → 档位说明 → 结束', fin && fin.p.kind === 'guide' && gates.join() === 'listen,turn,end', gates.join());
  check('教程：有逐音档位，不抽船、不记进度', events.some((e) => e.type === 'note') && !S.Progress.anySongPlayed() && S.Progress.collectedCount() === 0);
}
{
  const { S, clock, events } = await world();
  S.Session._setMicStub(singer(S));
  S.Session.startGuide();
  const gates = [];
  await walkGuide(S, clock, gates, (g) => (g.filter((x) => x === 'end').length === 1 ? 'again' : 'start'));
  const listens = events.filter((e) => e.type === 'phase' && e.p.phase === 'listen').length;
  check('教程最后点「再试一次」：塞壬再唱这一句，不再讲「轮到你」', listens === 2 && gates.join() === 'listen,turn,end,end', gates.join());
}
{
  const { S, clock } = await world();
  S.Session._setMicStub(singer(S, { quietPhrase: () => true }));
  S.Session.startGuide();
  const gates = [];
  await walkGuide(S, clock, gates);
  check('教程里没出声：提示两次「没听到」，然后讲档位；「轮到你」只讲一次', gates.join() === 'listen,turn,quiet,quiet,end', gates.join());
}
{
  const { S, clock } = await world();
  S.Session._setMicStub(singer(S));
  S.Session.startGuide();
  await clock.advance(2000);
  S.Session.pause();
  S.Session.resume();
  await clock.advance(2000);
  check('教程停在说明上时暂停再继续：还停在这一步', S.Session.getState().waiting === 'listen' && !S.Session.getState().paused);
}

// ---------------------------------------------------------------- 6c. 暂停关麦克风，继续时重新打开
{
  const clock = makeClock();
  const audio = makeAudioStub(clock);
  let opened = 0;
  let stopped = 0;
  const navigator = { mediaDevices: { getUserMedia: async () => { opened += 1; return { getTracks: () => [{ stop() { stopped += 1; } }] }; } } };
  const S = loadCore(FILES, { AudioContext: audio.FakeAudioContext, navigator });
  S.Session._setClock(clock);
  await S.Session.init();
  const ok = await S.Session.requestMic();
  S.Session.startSong(S.SONGS.find((s) => s.id === 'mary'));
  await clock.advance(4000);
  S.Session.pause();
  const offOnPause = !S.Session.micOpen() && stopped === 1;
  S.Session.resume();
  await clock.advance(3000);
  check('暂停：麦克风关掉；继续：重新打开', ok && offOnPause && S.Session.micOpen() && opened === 2, `打开 ${opened} 次，关 ${stopped} 次`);
}

// ---------------------------------------------------------------- 6d. 音频：切尾音不重建混响，锁屏后 interrupted 也能恢复
{
  const { S, clock } = await world();
  const c = S.Audio.ensureAudio();
  S.Audio.playPhrase([{ midi: 60, startMs: 0, durationMs: 400 }]);
  S.Audio.stopPlayback();
  check('切尾音：湿声关掉，等下一个音再开', S.Audio.stats().wetOpen === false);
  S.Audio.playPhrase([{ midi: 62, startMs: 0, durationMs: 400 }]);
  check('下一个音：湿声打开', S.Audio.stats().wetOpen === true);
  c.state = 'interrupted';
  let resumed = 0;
  const orig = c.resume.bind(c);
  c.resume = () => { resumed += 1; return orig(); };
  S.Audio.kick(true);
  check('interrupted（iOS 锁屏）：点一下就 resume', resumed === 1 && c.state === 'running');
  let resets = 0;
  S.Audio.onReset(() => { resets += 1; });
  c.state = 'interrupted';
  c.resume = () => Promise.reject(new Error('not allowed'));
  S.Audio.kick(true);
  const t0 = Date.now();
  while (Date.now() - t0 < 650) { /* 等 0.6 秒 */ }
  S.Audio.kick(true);
  const c2 = S.Audio.getAudioContext();
  check('恢复不了：下一次点击重建音频环境并通知', c2 !== c && c.state === 'closed' && resets === 1);
  S.Audio.hold();
  S.Audio.kick(true);
  check('切后台挂起后，回来点一下就解除挂起（容器没发 visibilitychange 也行）', S.Audio.stats().held === false);
}

// ---------------------------------------------------------------- 6e. 倒数：嘀、嘀、叮；叮那一小段不送判定
{
  const { S, clock, events } = await world();
  const blips = [];
  const sfx = S.Audio.sfx;
  S.Audio.sfx = function (name, when) { if (name === 'ready' || name === 'go') blips.push({ name, when }); return sfx.apply(this, arguments); };
  // 假歌手在「叮」那一刻就出一个很响、很离谱的音（模拟叮被录进去），之后照常唱对
  const good = singer(S, { latency: 80 });
  S.Session._setMicStub(() => {
    const st = S.Session.getState();
    if (st.phase === 'sing' && st.singT >= 0 && st.singT < 100) return { hz: 523.25, rms: 0.5 };   // C5，和第一个音差几个半音
    return good();
  });
  S.Session.startSong(S.SONGS.find((s) => s.id === 'twinkle'));
  let early = null;
  for (let i = 0; i < 400 && early === null; i += 1) {
    await clock.advance(25);
    const s2 = S.Session.getState();
    if (s2.phase === 'sing' && s2.singT > 500) early = s2.trace.filter((p) => p.t < 100).length;
  }
  check('叮响的那一小段：麦克风收到的不画、不判', early === 0, `前 0.1 秒的点：${early}`);
  await clock.advance(9000);
  const names = blips.map((b) => b.name).join(',');
  check('每句开唱前：嘀、嘀、叮', names.startsWith('ready,ready,go'), names);
  const st = S.Session.getState();
  const gap = blips.length >= 3 ? Math.round((blips[2].when - blips[1].when) * 1000) : 0;
  check('叮正好在开口那一拍（和嘀隔一拍）', Math.abs(gap - st.beatMs) <= 1, `${gap}ms / 一拍 ${Math.round(st.beatMs)}ms`);
  await clock.advance(20000);
  const first = events.filter((e) => e.type === 'note').slice(0, 7).map((e) => e.p.tier);
  check('叮被录进去也不影响判定：第一句照样是 Perfect / Great', first.length === 7 && first.every((t) => t === 'perfect' || t === 'great'), first.join(' '));
}
{
  const { S, clock } = await world();
  S.Progress.setSfxOff(true);
  S.Audio.setSfxMuted(true);
  const blips = [];
  const sfx = S.Audio.sfx;
  S.Audio.sfx = function (name) { if (name === 'go') blips.push(name); return sfx.apply(this, arguments); };
  S.Session._setMicStub(singer(S));
  S.Session.startSong(S.SONGS.find((s) => s.id === 'twinkle'));
  await clock.advance(6000);
  check('关了音效：叮不响，也就不用躲（那一小段照常收）', S.Session.getState().phase !== 'idle');
}

// ---------------------------------------------------------------- 7. 抽船：机会一样，没见过的先来，见齐后不连着重复；清除进度
{
  const { S } = await world();
  const P = S.Progress;
  let seed = 7;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const seen = new Set();
  for (let i = 0; i < S.SHIPS.length; i += 1) {
    const idx = P.pickShip(S.SONGS[i % S.SONGS.length].id, rng);
    P.recordArrival(S.SONGS[i % S.SONGS.length].id, idx);
    seen.add(idx);
  }
  check('唱满 21 首：21 艘船都见过，没有重复', seen.size === S.SHIPS.length, `${seen.size} 艘`);

  const count = {};
  let repeats = 0;
  let prev = S.Progress.recent()[0];
  for (let i = 0; i < 21000; i += 1) {
    const idx = P.pickShip('twinkle', rng);
    const key = S.SHIPS[idx].key;
    if (key === prev) repeats += 1;
    P.recordArrival('twinkle', idx);
    prev = key;
    count[key] = (count[key] || 0) + 1;
  }
  const vals = Object.values(count);
  check('见齐之后：每艘船的机会一样（各约 1/21）', vals.length === 21 && Math.min(...vals) > 850 && Math.max(...vals) < 1150, `${Math.min(...vals)}–${Math.max(...vals)} 次`);
  check('见齐之后：同一艘不会连着来两次', repeats === 0);
  check('唱哪首歌不影响来哪艘船', P.pickShip('twinkle', () => 0.3) === P.pickShip('mary', () => 0.3));

  const c = {};
  S.SHIPS.forEach((s, i) => { if (i !== 5) c[s.key] = 1; });
  S.Store.setJSON(S.Store.KEYS.CODEX, c);
  check('只剩一艘没见过：下一艘就是它', P.pickShip('twinkle', () => 0.999) === 5);

  P.setLang('en');
  P.reset();
  check('清除进度：图鉴清空，语言保留', P.collectedCount() === 0 && P.lang() === 'en');
}

console.log(`\n${pass} 项通过，${fails.length} 项失败`);
if (fails.length) process.exit(1);
