import { describe, expect, it } from 'vitest';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { ditherRgba } from '../../lib/av/palette';
import { timestamps } from '../../lib/av/logic';
describe('GIF 调色板和编码', () => {
  it('量化并编码真正的两帧 GIF', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
    const palette = quantize(pixels, 256);
    const gif = GIFEncoder();
    for (let i = 0; i < 2; i++) gif.writeFrame(applyPalette(pixels, palette), 2, 2, { palette, delay: 100 });
    gif.finish();
    const bytes = gif.bytes();
    expect(new TextDecoder().decode(bytes.slice(0, 6))).toBe('GIF89a');
    expect(bytes[bytes.length - 1]).toBe(0x3b);
    expect(palette.length).toBe(4);
  });
  it('抖动不修改输入与透明度，且每次结果一致', () => {
    const pixels = new Uint8ClampedArray([120, 120, 120, 255, 130, 130, 130, 100]);
    const output = ditherRgba(pixels, 2);
    expect(output).toEqual(ditherRgba(pixels, 2));
    expect(pixels[0]).toBe(120);
    expect(output[3]).toBe(255);
    expect(output[7]).toBe(100);
  });
  it('长动图在编码前拦截', () => {
    expect(() => timestamps(0, 61, 1 / 30, 1800)).toThrow('最多 1800');
  });
});
