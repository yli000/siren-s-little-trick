/**
 * 在 Node 里加载浏览器风格的经典脚本（挂在 window.Siren 上的那些），供测试使用。
 * 每次调用返回一个全新的、互相隔离的 Siren 命名空间。
 *
 *   const S = loadCore(['js/core/pitch.js', 'js/core/judge.js']);
 *   S.Judge.create(...)
 *
 * extra 里的键会挂到沙箱全局上（例如假的 AudioContext、performance、setTimeout）。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const GAME = path.resolve(HERE, '..', '..', 'game');

export function loadCore(files, extra = {}) {
  const sandbox = {
    console, Math, Date, JSON, Promise, Float32Array, Float64Array, Uint8Array, Int16Array, Array, Object, String, Number, Error,
    setTimeout, clearTimeout, setInterval, clearInterval,
    performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
    ...extra,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  for (const f of files) {
    const src = fs.readFileSync(path.join(GAME, f), 'utf8');
    vm.runInContext(src, sandbox, { filename: f });
  }
  return sandbox.Siren;
}
