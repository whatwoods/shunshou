import { describe, expect, it } from 'vitest';
import { pageGroups } from '../../lib/pdf/logic';
describe('PDF page groups', () => {
  it('splits ranges into files and removes duplicated pages per group', () =>
    expect(pageGroups(8, 'ranges', '1-3,3,5;6-8', 2)).toEqual([
      [0, 1, 2, 4],
      [5, 6, 7]
    ]));
  it('handles Chinese separators and empty range', () => {
    expect(pageGroups(8, 'ranges', '1-3，5；6-8', 2)).toEqual([
      [0, 1, 2, 4],
      [5, 6, 7]
    ]);
    expect(pageGroups(4, 'ranges', '1-2；3-4', 2)).toEqual([
      [0, 1],
      [2, 3]
    ]);
    expect(pageGroups(3, 'ranges', '', 2)).toEqual([[0, 1, 2]]);
  });
  it('preserves a final short group', () => expect(pageGroups(5, 'every', '', 2)).toEqual([[0, 1], [2, 3], [4]]));
  it('splits each page', () => expect(pageGroups(3, 'each', '', 2)).toEqual([[0], [1], [2]]));
  it.each(['0', '2-1', '1-6', '1,,2', '1;', 'abc', '1.5', '-2'])('rejects invalid range %s', (value) =>
    expect(() => pageGroups(5, 'ranges', value, 2)).toThrow()
  );
  it('rejects invalid group size', () => expect(() => pageGroups(5, 'every', '', 0)).toThrow());
});
