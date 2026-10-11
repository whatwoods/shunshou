import { expect, it } from 'vitest';
import { pageNumberText } from '../../lib/pdf/logic';
it('starts at requested number after skipped cover', () => {
  const s = { start: 3, skipCover: true, numberStyle: 'chinese' as const };
  expect(pageNumberText(0, 5, s)).toBe('');
  expect(pageNumberText(1, 5, s)).toBe('第 3 页');
});
it('excludes cover from total', () => expect(pageNumberText(1, 5, { start: 1, skipCover: true, numberStyle: 'total' })).toBe('1 of 4'));
it('numbers first page when cover is kept', () =>
  expect(pageNumberText(0, 5, { start: 0, skipCover: false, numberStyle: 'plain' })).toBe('0'));
