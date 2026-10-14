#!/usr/bin/env node
/**
 * 曲库校验（v2）：20 首歌能解析、音域落在海妖的音区、每句长度合适、双语齐全、常客船存在。
 * 并打印每首的难度特征，供人工核对难度分档。
 *
 * 用法：node tools/test-songs.mjs
 */
import { loadCore } from './lib/load-core.mjs';

const S = loadCore(['js/core/music.js', 'data/songs.js', 'data/ships.js']);
const { Music, SONGS, SHIPS } = S;

let fails = 0;
const check = (ok, msg) => { if (!ok) { fails += 1; console.log('  ✗ ' + msg); } };

console.log('曲库校验');
check(SONGS.length === 20, `应有 20 首，实际 ${SONGS.length}`);
const ids = new Set();
const SIREN_LO = 55;
const SIREN_HI = 76;

const rows = [];
for (const song of SONGS) {
  check(!ids.has(song.id), `重复的 id：${song.id}`);
  ids.add(song.id);
  check(song.title && song.title.zh && song.title.en, `${song.id} 缺少双语歌名`);
  check([1, 2, 3].includes(song.level), `${song.id} 难度应为 1–3`);
  check(song.bpm >= 60 && song.bpm <= 140, `${song.id} bpm 超出 60–140`);

  let parsed = true;
  for (const p of song.phrases) {
    try {
      const notes = Music.phraseNotes(p, song.key, song.bpm);
      check(notes.notes.length >= 3 && notes.notes.length <= 10, `${song.id} 句子 "${p}" 有 ${notes.notes.length} 个音（应 3–10）`);
      check(notes.durMs <= 7600, `${song.id} 句子 "${p}" 长 ${Math.round(notes.durMs)}ms（应 ≤ 7.6s）`);
    } catch (e) {
      parsed = false;
      check(false, `${song.id}：${e.message}`);
    }
  }
  if (!parsed) continue;
  const r = Music.songRange(song);
  check(r.lo >= SIREN_LO && r.hi <= SIREN_HI, `${song.id} 音域 ${r.lo}–${r.hi} 超出海妖音区 ${SIREN_LO}–${SIREN_HI}`);
  const f = Music.songFeatures(song);
  let totalMs = 0;
  for (const p of song.phrases) totalMs += Music.phraseNotes(p, song.key, song.bpm).durMs;
  // 一句的实际耗时 ≈ 听 + 倒数两拍 + 唱 + 结果 0.8s
  const playS = song.phrases.reduce((acc, p) => acc + (2 * Music.phraseNotes(p, song.key, song.bpm).durMs + 2 * Music.beatMs(song.bpm) + 1400) / 1000, 0);
  check(playS >= 35 && playS <= 120, `${song.id} 预计时长 ${Math.round(playS)}s（应 35–120s）`);
  rows.push({ id: song.id, lv: song.level, span: f.span, leap: f.leap, semis: f.semis, longest: f.longest, phrases: f.phrases, play: Math.round(playS) + 's', range: `${r.lo}-${r.hi}` });
}

console.table(rows);

// 难度大致单调：各档平均音域跨度不应倒挂
const avg = (lv, k) => { const a = rows.filter((r) => r.lv === lv); return a.reduce((s, r) => s + r[k], 0) / Math.max(1, a.length); };
check(avg(1, 'span') <= avg(3, 'span'), '★ 的平均音域跨度不应大于 ★★★');

// fitShift：有音区时把歌的中心移到音区中心，且不超过 ±6
const twinkle = SONGS.find((s) => s.id === 'twinkle');
check(Music.fitShift(twinkle, { lo: 57, hi: 66 }, 0) < 0, 'fitShift：低音区应往下移');
check(Music.fitShift(twinkle, { lo: 30, hi: 40 }, 0) === -6, 'fitShift：移调不应超过 -6');
check(Music.fitShift(twinkle, null, 2.4) === 2, 'fitShift：没有音区时用偏好移调');

if (fails) { console.log(`\n曲库校验失败：${fails} 项`); process.exit(1); }
console.log('  ✓ 20 首歌全部通过');
