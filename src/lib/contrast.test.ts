import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// 灰字（--ink-2 / --ink-3）在所有会放小字的底色上都要达到 WCAG AA 4.5:1，浅色深色各量一遍。
// 颜色从 styles.css 读，改了色值这里会跟着验
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
function block(selector: string) {
  const start = css.indexOf(selector + ' {');
  const body = css.slice(start, css.indexOf('\n}', start));
  return (name: string) => body.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))![1];
}
const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

for (const [theme, selector] of [
  ['浅色', ':root'],
  ['深色', ":root[data-theme='dark']"]
] as const) {
  test(`${theme}：灰字在各种底色上对比度 ≥ 4.5`, () => {
    const v = block(selector);
    for (const fg of ['ink-2', 'ink-3'])
      for (const bg of ['bg', 'bg-warm', 'surface', 'surface-2', 'field'])
        expect(ratio(v(fg), v(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
}
