/**
 * 测试桩：虚拟时钟 + 假 AudioContext（currentTime 跟着虚拟时钟走）。
 */

/**
 * 虚拟时钟：把 setTimeout / setInterval 变成可控推进。
 * 必须异步推进：流程里有 Promise（requestMic / init），同步循环会饿死 microtask。
 */
export function makeClock() {
  let now = 0;
  let seq = 1;
  const timers = new Map();
  const yieldLoop = () => new Promise((r) => setImmediate(r));
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = seq++;
      timers.set(id, { at: now + Math.max(0, ms || 0), fn, interval: null });
      return id;
    },
    setInterval(fn, ms) {
      const id = seq++;
      timers.set(id, { at: now + Math.max(1, ms || 1), fn, interval: Math.max(1, ms || 1) });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    clearInterval(id) { timers.delete(id); },
    async advance(ms, maxSteps = 400000) {
      const target = now + ms;
      let steps = 0;
      for (;;) {
        let next = null;
        for (const [id, t] of timers) {
          if (t.at <= target && (next === null || t.at < next.t.at)) next = { id, t };
        }
        if (!next) break;
        if (++steps > maxSteps) throw new Error('虚拟时钟步数超限，可能有定时器自激');
        now = next.t.at;
        if (next.t.interval === null) timers.delete(next.id);
        else next.t.at = now + next.t.interval;
        next.t.fn();
        if (steps % 20 === 0) await yieldLoop();
      }
      now = target;
      await yieldLoop();
    },
    pending: () => timers.size,
  };
}

export function makeAudioStub(clock) {
  function param(value = 0) {
    const p = {
      value,
      setValueAtTime(v) { p.value = v; return p; },
      linearRampToValueAtTime(v) { p.value = v; return p; },
      exponentialRampToValueAtTime(v) { p.value = v; return p; },
      cancelScheduledValues() { return p; },
    };
    return p;
  }
  function node(extra = {}) {
    return Object.assign({ connect() { return this; }, disconnect() { return this; } }, extra);
  }
  const created = { oscillators: 0, started: 0, stopped: 0 };

  class FakeAudioContext {
    constructor() {
      this.sampleRate = 48000;
      this.state = 'running';
      this.destination = node();
    }
    get currentTime() { return clock.now() / 1000; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createGain() { return node({ gain: param(1) }); }
    createOscillator() {
      created.oscillators += 1;
      return node({
        type: 'sine', frequency: param(440), detune: param(0),
        start() { created.started += 1; }, stop() { created.stopped += 1; }, setPeriodicWave() {},
      });
    }
    createBiquadFilter() { return node({ type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) }); }
    createDelay() { return node({ delayTime: param(0) }); }
    createConvolver() { return node({ buffer: null }); }
    createDynamicsCompressor() {
      return node({ threshold: param(-24), knee: param(30), ratio: param(12), attack: param(0.003), release: param(0.25) });
    }
    createPeriodicWave() { return {}; }
    createBuffer(channels, length) {
      const data = [];
      for (let i = 0; i < channels; i += 1) data.push(new Float32Array(length));
      return { numberOfChannels: channels, length, sampleRate: 48000, getChannelData: (c) => data[c] };
    }
    createBufferSource() { return node({ buffer: null, loop: false, playbackRate: param(1), start() {}, stop() {} }); }
    createMediaStreamSource() { return node(); }
    createAnalyser() { return node({ fftSize: 2048, getFloatTimeDomainData(a) { a.fill(0); } }); }
  }
  return { FakeAudioContext, created };
}
