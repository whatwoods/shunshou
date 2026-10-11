import { it, expect } from 'vitest';
import { convertChinese } from './logic';
it('按词组转换多义字并保留换行和标点', async () => {
  expect(await convertChinese('头发，发展\n后台', 'cn', 't')).toBe('頭髮，發展\n後臺');
});
it('转换台湾地区用词并支持反向转换', async () => {
  expect(await convertChinese('鼠标和软件', 'cn', 'twp')).toBe('滑鼠和軟體');
  expect(await convertChinese('滑鼠和軟體', 'twp', 'cn')).toBe('鼠标和软件');
});
it('空文本与相同地区不改动', async () => {
  expect(await convertChinese('', 'cn', 't')).toBe('');
  expect(await convertChinese('ABC😀', 'cn', 'cn')).toBe('ABC😀');
});
it('拒绝过大文本', async () => {
  await expect(convertChinese('字'.repeat(2_000_001), 'cn', 't')).rejects.toThrow('200 万');
});
