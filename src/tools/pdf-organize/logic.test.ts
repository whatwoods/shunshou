import { expect, it } from 'vitest';
import { moveItem } from '../../lib/pdf/logic';
it('moves to either end without mutating original order', () => {
  const input = ['a', 'b', 'c'];
  expect(moveItem(input, 0, 2)).toEqual(['b', 'c', 'a']);
  expect(moveItem(input, 2, 0)).toEqual(['c', 'a', 'b']);
  expect(input).toEqual(['a', 'b', 'c']);
});
it('ignores out-of-bounds and unchanged moves', () => {
  const input = [1, 2];
  expect(moveItem(input, -1, 0)).toBe(input);
  expect(moveItem(input, 0, 2)).toBe(input);
  expect(moveItem(input, 1, 1)).toBe(input);
});
