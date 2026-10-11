import { describe, expect, it } from 'vitest';
import { randomBelow, integers, parseNames, drawNames, groupNames } from './core';
describe('安全随机抽取', () => {
  it('拒绝有偏尾部，保留边界', () => {
    const values = [0xffffffff, 0xfffffffe, 17];
    expect(randomBelow(10, () => values.shift()!)).toBe(7);
    expect(randomBelow(2 ** 32, () => 0xffffffff)).toBe(0xffffffff);
    expect(randomBelow(1, () => 123)).toBe(0);
  });
  it('支持负数、全范围无重复抽取和重复抽取', () => {
    expect(integers(-2, 2, 5, false, () => 0).sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
    expect(integers(-2, 2, 3, true, () => 0)).toEqual([-2, -2, -2]);
    expect(integers(0, 2 ** 32 - 1, 2, false, () => 0)).toEqual([0, 2 ** 32 - 1]);
  });
  it('拒绝不合法范围和过量请求', () => {
    expect(() => integers(1, 2, 3, false)).toThrow();
    expect(() => integers(2, 1, 1, true)).toThrow();
    expect(() => integers(0, 2 ** 32, 1, true)).toThrow();
    expect(() => integers(0, 2, 1.5, true)).toThrow();
    expect(() => integers(0, 2, 10001, true)).toThrow();
    expect(() => integers(NaN, 2, 1, true)).toThrow();
    expect(() => randomBelow(0)).toThrow();
  });
  it('修剪空白、跳过空行、可选去重', () => {
    expect(parseNames(' A\r\nB\n A \n', true)).toEqual(['A', 'B']);
    expect(parseNames('A\rA', false)).toEqual(['A', 'A']);
    expect(() => parseNames(' ', true)).toThrow();
    expect(() => parseNames('a\n'.repeat(10001), false)).toThrow();
    expect(drawNames(['A', 'B'], 2, false, () => 0)).toEqual(['A', 'B']);
  });
  it('随机分组人数差不超过一且成员不丢失', () => {
    const groups = groupNames(['A', 'B', 'C', 'D', 'E'], 2, () => 0);
    expect(groups.map((g) => g.length)).toEqual([3, 2]);
    expect(groups.flat().sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(() => groupNames(['A'], 2)).toThrow();
  });
});
