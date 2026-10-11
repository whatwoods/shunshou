import { describe, expect, it } from 'vitest';
import { colorInfo, contrastInfo, makePalette } from './logic';
describe('颜色与对比度', () => {
  it('HEX RGB HSL OKLCH 可互转', () => {
    expect(colorInfo('rgb(255 0 0)').hex).toBe('#ff0000');
    expect(colorInfo('hsl(120 100% 50%)').hex).toBe('#00ff00');
    const red = colorInfo('#ff0000');
    expect(colorInfo(red.oklch).hex).toBe('#ff0000');
    expect(colorInfo('#11223380').hex).toBe('#11223380');
  });
  it('标准黑白对比度及透明前景合成', () => {
    expect(contrastInfo('#000', '#fff').ratio).toBe(21);
    expect(contrastInfo('#fff', '#fff').ratio).toBe(1);
    expect(contrastInfo('rgb(0 0 0 / 50%)', '#fff').ratio).toBeCloseTo(3.97665, 4);
    expect(() => contrastInfo('#000', '#ffffff80')).toThrow();
  });
  it('输出色板和越界色提示', () => {
    expect(makePalette('#1f4fd1', 'shades')).toHaveLength(5);
    expect(new Set(makePalette('#1f4fd1', 'analogous')).size).toBe(5);
    expect(colorInfo('oklch(60% .4 150)').clipped).toBe(true);
    expect(() => colorInfo('not-a-color')).toThrow();
  });
});
