import { expect, test } from 'vitest';
import { unicodeEncode, unicodeDecode, transformEscape } from './logic';
test('UTF16代理对与码点往返', () => {
  for (const value of ['中文😀', 'a\n\t"\\', '\ud800'])
    for (const cp of [false, true]) expect(unicodeDecode(unicodeEncode(value, cp))).toBe(value);
  expect(unicodeEncode('😀')).toBe('\\ud83d\\ude00');
});
test('常见转义与字面反斜杠', () => {
  expect(unicodeDecode('a\\n\\x41\\u{1f600}')).toBe('a\nA😀');
  expect(unicodeDecode('\\\\u4f60')).toBe('\\u4f60');
});
test('非法转义定位且拒绝八进制', () => {
  for (const value of ['\\', '\\u123', '\\xG0', '\\u{110000}', '\\u{}', '\\01', '\\q']) expect(() => unicodeDecode(value)).toThrow();
});
test('HTML命名数字实体和脚本仅文字', () => {
  const text = '<script>alert("你好")</script>&😀';
  expect(transformEscape(transformEscape(text, 'html', false), 'html', true)).toBe(text);
  expect(transformEscape('&copy; &#x1F600;', 'html', true)).toBe('© 😀');
});
test('JSON字符串严格转换含空值', () => {
  expect(transformEscape('""', 'json', true)).toBe('');
  expect(transformEscape(transformEscape('a\n"😀', 'json', false), 'json', true)).toBe('a\n"😀');
  for (const s of ['{}', '12', 'null', '"bad']) expect(() => transformEscape(s, 'json', true)).toThrow();
});
