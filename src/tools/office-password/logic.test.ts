import { it, expect } from 'vitest';
import { defaults, generate, pool, randomIndex } from './logic';
it('rejects modulo-biased draws', () => {
  let n = 0;
  expect(
    randomIndex(10, (a) => {
      a[0] = n++ === 0 ? 4294967295 : 23;
      return a;
    })
  ).toBe(3);
  expect(n).toBe(2);
});
it('honors character exclusions and empty pools', () => {
  expect(pool(defaults)).not.toMatch(/[Il1O0o]/);
  expect(() => generate({ ...defaults, upper: false, lower: false, digits: false, symbols: false })).toThrow();
  expect(generate({ ...defaults, count: 3 }).values.every((v) => v.length === 20)).toBe(true);
});
it('reports actual phrase entropy', () => {
  const r = generate({ ...defaults, phrase: true, words: 7 });
  expect(r.entropy).toBe(77);
  expect(r.values[0].split('-')).toHaveLength(7);
});
