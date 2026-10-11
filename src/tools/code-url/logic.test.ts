import { expect, test } from 'vitest';
import { parseUrl, updateUrl, transformUrl } from './logic';
test('重复参数与中文编码', () => {
  const url = 'https://example.com/a?x=1&x=2&name=%E4%B8%AD#test';
  const p = parseUrl(url);
  expect(p.params).toEqual([
    ['x', '1'],
    ['x', '2'],
    ['name', '中']
  ]);
  expect(parseUrl(updateUrl(url, [['x', 'a & b']], '/new', '#top')).params).toEqual([['x', 'a & b']]);
});
test('整条URI与参数编码区别', () => {
  expect(transformUrl('https://a/b?q=中', 'encode', false)).toContain('https://a/b?q=');
  expect(transformUrl('a&b', 'encode', true)).toBe('a%26b');
  expect(() => transformUrl('%GG', 'decode', true)).toThrow();
});
