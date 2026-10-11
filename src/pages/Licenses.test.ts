import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// 许可页里链到的全文都要真的在 public/licenses/ 里（构建时原样复制进 dist）
test('许可全文文件都在', () => {
  const page = readFileSync(new URL('./Licenses.tsx', import.meta.url), 'utf8');
  const links = [...page.matchAll(/'(\/licenses\/[^']+\.txt)'/g)].map((m) => m[1]);
  expect(links.length).toBeGreaterThanOrEqual(4);
  for (const href of links) {
    const file = new URL('../../public' + href, import.meta.url);
    expect(existsSync(file), href).toBe(true);
    expect(readFileSync(file, 'utf8').length, href).toBeGreaterThan(1000);
  }
});
