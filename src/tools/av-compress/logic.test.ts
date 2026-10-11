import { describe, expect, it } from 'vitest';
import { estimatedBytes, fitWidth } from '../../lib/av/logic';
describe('视频输出尺寸和估算', () => {
  it('不放大小视频，使用编解码器要求的偶数尺寸', () => {
    expect(fitWidth(1920, 1080, 1280)).toEqual({ width: 1280, height: 720 });
    expect(fitWidth(640, 360, 1280)).toEqual({ width: 640, height: 360 });
    expect(fitWidth(1080, 1920, 640)).toEqual({ width: 640, height: 1138 });
  });
  it('体积包含音轨的码率', () => {
    expect(estimatedBytes(8, 1, false)).toBe(1_000_000);
    expect(estimatedBytes(8, 1, true)).toBe(1_128_000);
  });
});
