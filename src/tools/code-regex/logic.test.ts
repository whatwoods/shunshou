import { expect, test } from 'vitest';
import { runRegex } from './logic';
test('命名分组和替换', () => {
  const r = runRegex('(?<x>\\d+)', 'g', 'a12b34', '[$<x>]');
  expect(r.output).toBe('a[12]b[34]');
  expect(r.matches[0].named).toEqual({ x: '12' });
  expect(r.matches[0].spans[0]).toEqual([1, 3]);
});
test('零宽 Unicode 匹配前进', () => expect(runRegex('(?:)', 'gu', '😀', 'x').matches.map((m) => m.index)).toEqual([0, 2]));
test('非全局与错误表达式', () => {
  expect(runRegex('a', '', 'aaa', 'b').matches).toHaveLength(1);
  expect(() => runRegex('[', 'g', '', '')).toThrow();
});
test('v 标志零宽匹配按码点前进', () => expect(runRegex('(?:)', 'gv', '😀', 'x').matches.map((m) => m.index)).toEqual([0, 2]));
test('前瞻捕获预览体积有限', () => {
  const result = runRegex('(?=(?<tail>.*))', 'g', 'a'.repeat(10000), '');
  expect(JSON.stringify(result.matches).length).toBeLessThan(1000000);
  expect(result.groupsTruncated).toBe(true);
});
