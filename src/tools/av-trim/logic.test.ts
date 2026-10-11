import { describe, expect, it } from 'vitest';
import { validateRange } from '../../lib/av/logic';
describe('片段范围', () => {
  it('拒绝颠倒、空范围、越界和非数字', () => {
    for (const [start, end] of [
      [1, 1],
      [2, 1],
      [-1, 1],
      [0, 11],
      [NaN, 1]
    ])
      expect(() => validateRange(start, end, 10)).toThrow();
  });
  it('允许到文件末尾，容忍毫秒舍入', () => {
    expect(validateRange(0, 10, 10)).toEqual({ start: 0, end: 10 });
    expect(validateRange(0, 10.0005, 10)).toEqual({ start: 0, end: 10 });
  });
});
