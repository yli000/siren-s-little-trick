/**
 * 测试用的"合成人声"：把一串音符渲染成麦克风会收到的样本，再按 50ms 一帧跑真实的 YIN（pitch.js）。
 * 能模拟：整体移调、整体延迟、滑音、颤音、个别音唱偏、漏唱、噪音。
 *
 *   const sing = singer(notes, { semis: -1, latencyMs: 150, slideMs: 100, vibratoCents: 60 });
 *   const frames = detect(Pitch, sing, { fromMs: -300, toMs: 4000 });
 */

export const SR = 48000;
export const W = 2048;
export const TICK = 50;

/**
 * @param {Array} notes  [{midi, startMs, durMs}]
 * @param {Object} o
 *   semis        整体移调（半音，可为小数）
 *   latencyMs    整体晚多少
 *   gapMs        音与音之间收声多久（默认 40）
 *   slideMs      从上一个音滑进来的时长
 *   vibratoCents 颤音幅度（± 音分），5.5Hz
 *   detune(i)    第 i 个音额外偏多少音分
 *   drop(i)      第 i 个音不唱
 *   level        演唱电平（RMS，默认 0.3）
 */
export function singer(notes, o = {}) {
  const { semis = 0, latencyMs = 0, gapMs = 40, slideMs = 0, vibratoCents = 0, detune = () => 0, drop = () => false, level = 0.3 } = o;
  return (t) => {
    const tt = t - latencyMs;
    for (let i = 0; i < notes.length; i += 1) {
      const n = notes[i];
      if (tt < n.startMs || tt >= n.startMs + n.durMs) continue;
      if (drop(i)) return null;
      if (tt >= n.startMs + n.durMs - gapMs) return null;
      let midi = n.midi + semis + detune(i) / 100;
      if (slideMs > 0 && i > 0 && !drop(i - 1) && tt - n.startMs < slideMs) {
        const prev = notes[i - 1].midi + semis + detune(i - 1) / 100;
        midi = prev + (midi - prev) * ((tt - n.startMs) / slideMs);
      }
      if (vibratoCents) midi += (vibratoCents / 100) * Math.sin(2 * Math.PI * 5.5 * tt / 1000);
      const into = tt - n.startMs;
      return { midi, rms: level * Math.min(1, 0.2 + into / 30) };
    }
    return null;
  };
}

/** 渲染并检测：返回帧 [{t, hz, rms}]（t 与 notes 同一时间轴） */
export function detect(Pitch, sing, o = {}) {
  const { fromMs = -300, toMs = 5000, noise = 0.003, seed0 = 12345 } = o;
  const frames = [];
  let phase = 0;
  let seed = seed0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let t = fromMs; t <= toMs; t += TICK) {
    const buf = new Float32Array(W);
    let sq = 0;
    for (let i = 0; i < W; i += 1) {
      const ts = t - (W - i) / SR * 1000;
      const p = sing(ts);
      let v = (rnd() * 2 - 1) * noise;
      if (p) {
        const hz = Pitch.midiToHz(p.midi);
        phase += 2 * Math.PI * hz / SR;
        // 三个谐波，近似人声
        v += p.rms * Math.SQRT2 * (0.8 * Math.sin(phase) + 0.35 * Math.sin(2 * phase) + 0.15 * Math.sin(3 * phase));
      }
      buf[i] = v;
      sq += v * v;
    }
    const r = Pitch.detectPitch(buf, SR, W);
    frames.push({ t, hz: r.hz, conf: r.conf, rms: Math.sqrt(sq / W) });
  }
  return frames;
}
