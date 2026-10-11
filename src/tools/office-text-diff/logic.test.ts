import { it, expect } from 'vitest';
import { compare } from './logic';
it('aligns changed lines and preserves inline changes', () => {
  const rows = compare('hello old\nsame\n', 'hello new\nsame\n', false);
  expect(rows).toHaveLength(2);
  expect(rows[0].changes?.some((c) => c.added && c.value === 'new')).toBe(true);
  expect(rows[1].leftNumber).toBe(2);
});
it('ignores edge whitespace when requested', () => expect(compare(' a \n', 'a\n', true)[0].changes).toBeUndefined());
