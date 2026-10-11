// 动图识别：两帧 GIF、APNG、动画 WebP 要认出来，普通单帧图不能误报
import { expect, it } from 'vitest';
import { isAnimated } from './animated';

// 1×1 的 GIF，frames 帧（每帧一个像素）
function gif(frames: number) {
  const head = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255];
  const frame = [0x21, 0xf9, 4, 0, 10, 0, 0, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 0x01, 0];
  return new Uint8Array([...head, ...Array.from({ length: frames }, () => frame).flat(), 0x3b]);
}
const chunk = (type: string, data: number[]) => [0, 0, 0, data.length, ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
function png(frames?: number) {
  const ihdr = chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  const actl = frames ? chunk('acTL', [0, 0, 0, frames, 0, 0, 0, 0]) : [];
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ihdr, ...actl, ...chunk('IDAT', [0]), ...chunk('IEND', [])]);
}
function webp(type: 'VP8X' | 'VP8 ', flags = 0) {
  const body =
    type === 'VP8X'
      ? [...'VP8X'].map((c) => c.charCodeAt(0)).concat([10, 0, 0, 0, flags, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      : [...'VP8 '].map((c) => c.charCodeAt(0)).concat([2, 0, 0, 0, 0, 0]);
  return new Uint8Array(
    [...'RIFF']
      .map((c) => c.charCodeAt(0))
      .concat(
        [0, 0, 0, 0],
        [...'WEBP'].map((c) => c.charCodeAt(0)),
        body
      )
  );
}

it('认出动图', async () => {
  expect(await isAnimated(new Blob([gif(2)]))).toBe(true);
  expect(await isAnimated(new Blob([png(3)]))).toBe(true);
  expect(await isAnimated(new Blob([webp('VP8X', 0x02)]))).toBe(true);
});
it('单帧图不误报', async () => {
  expect(await isAnimated(new Blob([gif(1)]))).toBe(false);
  expect(await isAnimated(new Blob([png()]))).toBe(false);
  expect(await isAnimated(new Blob([png(1)]))).toBe(false);
  expect(await isAnimated(new Blob([webp('VP8X', 0x10)]))).toBe(false);
  expect(await isAnimated(new Blob([webp('VP8 ')]))).toBe(false);
  expect(await isAnimated(new Blob([new Uint8Array([0xff, 0xd8, 0xff])]))).toBe(false);
});
