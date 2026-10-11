import { expect, test } from 'vitest';
import { parseInteger, convertIntegers } from './logic';
test('大整数与任意进制无损往返', () => {
  const n = 123456789012345678901234567890n;
  for (let b = 2; b <= 36; b++) expect(parseInteger(n.toString(b), b)).toBe(n);
});
test('前缀负号与零', () => {
  expect(parseInteger('-0xFF', 16)).toBe(-255n);
  expect(parseInteger('+0B101', 2)).toBe(5n);
  expect(parseInteger('-0', 10)).toBe(0n);
  expect(parseInteger('0b', 16)).toBe(11n);
});
test('批量转换保留空行', () =>
  expect(convertIntegers('255\r\n\r\n-42', { from: 10, to: 16, upper: true, prefix: true })).toEqual({
    output: '0xFF\n\n-0x2A',
    count: 2
  }));
test('拒绝无效输入并定位行号', () => {
  for (const s of ['0x', '12.3', '2', '0b2']) expect(() => parseInteger(s, 2)).toThrow();
  expect(() => convertIntegers('12\nxx', { from: 10, to: 16, upper: false, prefix: false })).toThrow('第 2 行');
  expect(() => parseInteger('1', 1)).toThrow();
  expect(() => parseInteger('1'.repeat(10001), 10)).toThrow('最多');
});
