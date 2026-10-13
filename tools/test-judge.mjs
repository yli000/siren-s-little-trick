#!/usr/bin/env node
/**
 * v2 逐帧判定（judge.js）：合成人声 → 真实 YIN → 判定，覆盖 v1 判错的那几种情况。
 * 对照 docs/04-v2-修改意见.md §3.4 的目标。
 *
 * 用法：node tools/test-judge.mjs
 */
import { loadCore } from './lib/load-core.mjs';
import { singer, detect } from './lib/voice.mjs';

const S = loadCore(['js/core/pitch.js', 'js/core/music.js', 'js/core/judge.js', 'data/songs.js']);
const { Pitch, Music, Judge, SONGS } = S;

let pass = 0;
const fails = [];
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  OK   ${name}${detail ? '  — ' + detail : ''}`); }
  else { fails.push(name); console.log(`  FAIL ${name}${detail ? '  — ' + detail : ''}`); }
};

const NOISE = 0.003;

/** 一句歌 + 一种唱法 → 判定结果（实时推帧 + 实时 poll，与游戏里一致） */
function run(phrase, key, bpm, sing, opts = {}) {
  const { notes, durMs } = Music.phraseNotes(phrase, key, bpm);
  const frames = detect(Pitch, singer(notes, sing), { fromMs: -150, toMs: durMs + 400, noise: NOISE });
  const j = Judge.create(notes, { keyFree: opts.keyFree !== false, noiseFloor: NOISE });
  const live = [];
  for (const f of frames) {
    j.push(f);
    for (const r of j.poll(f.t)) live.push(r);
  }
  const res = j.finish();
  for (const r of res.newly) live.push(r);
  const tiers = live.map((r) => r.tier);
  const count = (t) => tiers.filter((x) => x === t).length;
  return { res, tiers, count, notes };
}

const rank = { perfect: 3, great: 2, good: 1, miss: 0, quiet: 0 };
const avgRank = (tiers) => tiers.reduce((s, t) => s + rank[t], 0) / tiers.length;
const show = (r) => `${r.res.score} 分 · ${r.tiers.map((t) => t[0].toUpperCase()).join('')}`;

const ODE = SONGS.find((s) => s.id === 'ode');
const P = ODE.phrases[0];          // 3 3 4 5 5 4 3 2（含 mi-fa 半音）
const KEY = ODE.key;
const BPM = ODE.bpm;

console.log('v2 逐帧判定');

const clean = run(P, KEY, BPM, {});
check('干净演唱：Perfect 为主', clean.count('perfect') >= 6 && clean.res.score >= 85, show(clean));

const glide = run(P, KEY, BPM, { slideMs: 120, gapMs: 0 });
check('滑音：与干净演唱差距 ≤ 1 档', avgRank(clean.tiers) - avgRank(glide.tiers) <= 1 && glide.res.score >= 70, show(glide));

const vib = run(P, KEY, BPM, { vibratoCents: 60 });
check('颤音 ±60 音分：Great 以上为主', avgRank(vib.tiers) >= 2 && vib.res.score >= 60, show(vib));

const semi = run('3 4 3 4 3:4', KEY, BPM, {});
check('半音来回（mi-fa-mi-fa-mi）：与其他句无差别', semi.count('perfect') >= 4, show(semi));

const lateLow = run(P, KEY, BPM, { semis: -1, latencyMs: 150 });
check('整体低 1 个半音、晚 150ms：Perfect 为主', lateLow.count('perfect') >= 6, show(lateLow) + ` · K=${lateLow.res.k.toFixed(2)} L=${lateLow.res.l}`);

const octave = run(P, KEY, BPM, { semis: -12 });
check('低八度（男声）：Perfect 为主', octave.count('perfect') >= 6, show(octave));

const far = run(P, KEY, BPM, { semis: -4 });
check('整体低 4 个半音（唱歌不限调）：Perfect 为主', far.count('perfect') >= 6, show(far));

const farStrict = run(P, KEY, BPM, { semis: -4 }, { keyFree: false });
check('整体低 4 个半音（练习「找第一个音」要求对准）：几乎全错', farStrict.count('perfect') + farStrict.count('great') <= 1, show(farStrict));

const flat = run(P, KEY, BPM, { semis: -0.3 });
check('整体偏低 30 音分（要求对准时）：仍算唱中', run(P, KEY, BPM, { semis: -0.3 }, { keyFree: false }).count('perfect') >= 6, show(flat));

const silent = run(P, KEY, BPM, { drop: () => true });
check('完全不出声：判为没出声，不给 Miss', silent.res.silent && silent.tiers.every((t) => t === 'quiet'), silent.tiers.join(','));

const half = run(P, KEY, BPM, { drop: (i) => i >= 4 });
check('只唱前半句：后半句是 Miss（不是 quiet）', half.tiers.slice(0, 4).every((t) => t === 'perfect' || t === 'great') && half.tiers.slice(5).every((t) => t === 'miss'), half.tiers.join(','));

const OFF = [300, -250, 180, -420, 260, -180, 350, -300];
const wrong = run(P, KEY, BPM, { detune: (i) => OFF[i] });
check('每个音各自唱偏 2–4 个半音：比唱对低得多', wrong.res.score <= clean.res.score - 40, show(wrong));

// 音程唱小（跑调的人最常见的错误：所有音程只唱到 60%）
const squeeze = run(P, KEY, BPM, { detune: (i) => { const n = Music.phraseNotes(P, KEY, BPM).notes; return (n[0].midi - n[i].midi) * 40; } });
check('音程唱小到 60%：分数介于对和错之间', squeeze.res.score < clean.res.score - 10 && squeeze.res.score > wrong.res.score, show(squeeze));

// 一直哼同一个音（QA 发现：K 跟着正在判的音走时，单音哼也能拿一排 Perfect）
{
  const { notes } = Music.phraseNotes(P, KEY, BPM);
  const drone = run(P, KEY, BPM, { detune: (i) => (notes[0].midi - notes[i].midi) * 100 });
  check('一直哼同一个音：只有本来就是这个音的地方算对', drone.res.score <= 55 && drone.count('perfect') <= 4, show(drone));
}

// 只有第一个音唱错：错的就是第一个，后面照样 Perfect（不能反过来）
{
  const first = run(P, KEY, BPM, { detune: (i) => (i === 0 ? 250 : 0) });
  check('只有第一个音唱偏：第一个 Miss，后面 Perfect', first.tiers[0] === 'miss' && first.tiers.slice(1).filter((t) => t === 'perfect').length >= 6, show(first));
}

// 第一个音不再白送：随便一个音开头，第一个音按第二个音来定调
{
  const MARY = SONGS.find((s) => s.id === 'mary');
  const { notes } = Music.phraseNotes(MARY.phrases[0], MARY.key, MARY.bpm);
  const wrong0 = run(MARY.phrases[0], MARY.key, MARY.bpm, { detune: (i) => (i === 0 ? -300 : 0) });
  check('Mary 第一句第一个音唱偏 3 个半音：Miss', wrong0.tiers[0] === 'miss', show(wrong0));
  check('（同上）第二个音不受连累', wrong0.tiers[1] === 'perfect', show(wrong0));
  void notes;
}

// 乱唱：每个音随机偏 1–5 个半音（不是整体移调）
{
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const offs = P.split(' ').map(() => (1 + Math.floor(rnd() * 5)) * (rnd() < 0.5 ? -100 : 100));
  const rand = run(P, KEY, BPM, { detune: (i) => offs[i] });
  check('乱唱：Perfect 不超过 3 个', rand.count('perfect') <= 3, show(rand));
}

// 句与句之间：前几句定下的调是先验，一个音唱偏不会把调带跑
{
  const { notes } = Music.phraseNotes(P, KEY, BPM);
  const frames = detect(Pitch, singer(notes, { detune: (i) => (i === 0 ? 200 : 0) }), { fromMs: -150, toMs: Music.phraseNotes(P, KEY, BPM).durMs + 400, noise: NOISE });
  const j = Judge.create(notes, { keyFree: true, kInit: 0, kWeight: Judge.priorWeight(7), noiseFloor: NOISE });
  frames.forEach((f) => j.push(f));
  const res = j.finish();
  check('有先验时第一个音唱偏：只扣这一个', res.notes[0].tier === 'miss' && res.notes[1].tier === 'perfect', res.notes.map((n) => n.tier[0]).join(''));
  check('整句的调 K 与支持帧数', Math.abs(res.k) < 0.3 && res.kSupport >= 6, `K=${res.k.toFixed(2)} support=${res.kSupport}`);
}

// 实时 poll 与 finish 一致：每个音只判一次
check('每个音只判一次', clean.tiers.length === clean.notes.length, `${clean.tiers.length}/${clean.notes.length}`);

// 档位与分数同源：全 Perfect 的句子分数不会低
check('档位与分数同源', clean.res.notes.every((n) => (n.tier === 'perfect') === (n.a >= 0.75)));

// 点按兜底
{
  const { notes } = Music.phraseNotes(P, KEY, BPM);
  const t = Judge.createTap(notes, 0);
  const out = [];
  notes.forEach((n, i) => { const r = t.tap(n.startMs + (i === 3 ? 160 : 40)); if (r) out.push(r.tier); });
  const fin = t.finish();
  check('点按：时间对就是 Perfect，差 160ms 是 Great', out[0] === 'perfect' && out[3] === 'great', out.join(','));
  check('点按：一句结束全部判完', fin.notes.length === notes.length);
}

console.log(`\n${pass} 项通过，${fails.length} 项失败`);
if (fails.length) process.exit(1);
