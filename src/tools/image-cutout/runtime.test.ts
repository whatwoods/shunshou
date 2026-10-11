import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

// runtime/ 里拆开的 wasm 必须和装着的 onnxruntime-web 同一版本：升级后要重新拆（split -b 14000000），并改文件名里的版本号
it('拆开的 WebGPU 运行时和装着的 onnxruntime-web 一致', () => {
  const require = createRequire(import.meta.url);
  const wasm = require.resolve('onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', `file://${wasm}`), 'utf8')) as { version: string };
  const dir = new URL('./runtime/', import.meta.url);
  const parts = readdirSync(dir)
    .filter((f) => f.endsWith('.bin'))
    .sort();
  expect(parts.every((f) => f.startsWith(`ort-${pkg.version}-asyncify-`))).toBe(true);
  const joined = Buffer.concat(parts.map((f) => readFileSync(new URL(f, dir))));
  const original = readFileSync(wasm);
  expect(joined.equals(original)).toBe(true);
  // 每块都要在 Cloudflare 单文件 25 MiB 以内
  for (const f of parts) expect(statSync(new URL(f, dir)).size).toBeLessThan(25 * 1024 * 1024);
});
