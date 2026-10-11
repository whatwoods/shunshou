import { expect, test } from 'vitest';
import { encodeText, decodeText, encodeBytes, decodeBytes } from './logic';
test('UTF8和URL-safe往返', () => {
  for (const value of ['中文😀', 'hello', '\u0000']) expect(decodeText(encodeText(value, true))).toBe(value);
});
test('文件分块保持正确padding', () => {
  const bytes = Uint8Array.from({ length: 50000 }, (_, i) => i % 256);
  expect(decodeBytes(encodeBytes(bytes))).toEqual(bytes);
});
test('data URL与非法输入', () => {
  expect(decodeText('data:text/plain;base64,aGk=')).toBe('hi');
  expect(() => decodeBytes('a')).toThrow();
  expect(() => decodeBytes('??')).toThrow();
});
test('大文件编码按块读取并保持正确边界', async () => {
  const { encodeBlob } = await import('./logic');
  const bytes = Uint8Array.from({ length: 3 * 1024 * 1024 + 5 }, (_, i) => i % 253);
  expect(await encodeBlob(new Blob([bytes]))).toBe(encodeBytes(bytes));
});
test('含参数与空白的 data URL MIME', async () => {
  const { dataUrlMime } = await import('./logic');
  expect(dataUrlMime('\n data:image/png;charset=utf-8;base64,aGk=')).toBe('image/png');
});
